/**
 * FieldArray component - Dynamic array field management
 *
 * Key features:
 * - Array operations: append, prepend, insert, remove, move, swap
 * - Stable key generation for React reconciliation
 * - Field-level subscriptions (isolated re-renders)
 * - Perfect TypeScript inference of array item type
 * - Uncontrolled mode by default
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import type { FormStore } from '../core/store.js'
import { createCachedLazyImmutableSnapshot } from '../utils/immutable.js'
import type { ArrayPath, DeepReadonly, ValueAtPath } from '../types.js'

type ArrayElement<Value> = Value extends readonly (infer Item)[] ? Item : never

/**
 * Array field operations helper
 */
export interface FieldArrayHelpers<T> {
  /**
   * Append item to end of array
   */
  append: (value: T) => void

  /**
   * Prepend item to start of array
   */
  prepend: (value: T) => void

  /**
   * Insert item at specific index
   */
  insert: (index: number, value: T) => void

  /**
   * Remove item at specific index
   */
  remove: (index: number) => void

  /**
   * Move item from one index to another
   */
  move: (fromIndex: number, toIndex: number) => void

  /**
   * Swap two items
   */
  swap: (indexA: number, indexB: number) => void

  /**
   * Replace entire array
   */
  replace: (values: T[]) => void

  /**
   * Clear array (remove all items)
   */
  clear: () => void
}

/**
 * Array field item with stable key
 */
export interface FieldArrayItem<T> {
  /**
   * Stable key for React reconciliation
   */
  readonly key: string

  /**
   * Item value
   */
  readonly value: DeepReadonly<T>

  /**
   * Item index in array
   */
  readonly index: number
}

/**
 * Render props for FieldArray
 */
export interface FieldArrayRenderProps<T> {
  /**
   * Array items with stable keys
   */
  readonly fields: readonly FieldArrayItem<T>[]

  /**
   * Array operation helpers
   */
  helpers: FieldArrayHelpers<T>
}

export interface FieldArrayProps<Values extends object, P extends ArrayPath<Values>> {
  /**
   * Field name (type-safe path to array field)
   */
  name: P

  /**
   * Form store instance
   */
  store: FormStore<Values>

  /**
   * Render function with array fields
   */
  children: (
    props: FieldArrayRenderProps<ArrayElement<ValueAtPath<Values, P>>>
  ) => ReactNode
}

/**
 * Generate stable key for array item
 */
let keyCounter = 0
const EMPTY_ARRAY: never[] = []

function generateKey(): string {
  return `field-array-${++keyCounter}-${Date.now()}`
}

/**
 * FieldArray component with automatic subscriptions
 *
 * @example
 * ```tsx
 * <FieldArray name="users" store={store}>
 *   {({ fields, helpers }) => (
 *     <div>
 *       {fields.map((field) => (
 *         <div key={field.key}>
 *           <Field name={`users.${field.index}.name`} store={store}>
 *             {(f) => <input {...f.props} />}
 *           </Field>
 *           <button onClick={() => helpers.remove(field.index)}>Remove</button>
 *         </div>
 *       ))}
 *       <button onClick={() => helpers.append({ name: '' })}>Add User</button>
 *     </div>
 *   )}
 * </FieldArray>
 * ```
 */
export function FieldArray<Values extends object, P extends ArrayPath<Values>>({
  name,
  store,
  children,
}: FieldArrayProps<Values, P>): ReactNode {
  type ArrayItem = ArrayElement<ValueAtPath<Values, P>>

  // Keys move with their logical item rather than remaining attached to an index.
  const keysRef = useRef<string[]>([])
  const fieldsRef = useRef<readonly FieldArrayItem<ArrayItem>[]>([])

  // Subscribe to array field changes
  const subscribe = useCallback(
    (callback: () => void) => {
      return store.subscribeToField(name, callback)
    },
    [store, name]
  )

  const getSnapshot = useCallback((): ArrayItem[] => {
    const value = store.getInternalFieldState(name).value as unknown
    return Array.isArray(value) ? value as ArrayItem[] : EMPTY_ARRAY
  }, [store, name])

  const arrayValue = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  // Generate stable keys for array items
  const rendered = useMemo(() => {
    const previousByKey = new Map(fieldsRef.current.map((field) => [field.key, field]))
    const nextKeys = arrayValue.map(
      (_, index) => keysRef.current[index] ?? generateKey()
    )
    const nextFields = arrayValue.map((value, index) => {
      const key = nextKeys[index]!
      const exposedValue = createCachedLazyImmutableSnapshot(value)

      const previous = previousByKey.get(key)
      if (
        previous &&
        previous.index === index &&
        Object.is(previous.value, exposedValue)
      ) {
        return previous
      }

      return Object.freeze({
        key,
        value: exposedValue,
        index,
      })
    })
    return { fields: Object.freeze(nextFields), keys: nextKeys }
  }, [arrayValue])
  const fields = rendered.fields

  useEffect(() => {
    keysRef.current = rendered.keys
    fieldsRef.current = rendered.fields
  }, [rendered])

  const synchronizeKeys = (length: number): void => {
    while (keysRef.current.length < length) {
      keysRef.current.push(generateKey())
    }
    if (keysRef.current.length > length) keysRef.current.length = length
  }

  // Array operation helpers
  const helpers: FieldArrayHelpers<ArrayItem> = useMemo(
    () => ({
      append: (value: ArrayItem) => {
        const currentValue = store.getInternalValue(name) as unknown
        const currentArray = Array.isArray(currentValue) ? currentValue as ArrayItem[] : EMPTY_ARRAY
        synchronizeKeys(currentArray.length)
        const newArray = [...currentArray, value]
        const newToOld = currentArray.map((_, index) => index) as Array<number | undefined>
        newToOld.push(undefined)
        keysRef.current.push(generateKey())
        store.setArrayValue(name, newArray as ValueAtPath<Values, P>, newToOld)
      },

      prepend: (value: ArrayItem) => {
        const currentValue = store.getInternalValue(name) as unknown
        const currentArray = Array.isArray(currentValue) ? currentValue as ArrayItem[] : EMPTY_ARRAY
        synchronizeKeys(currentArray.length)
        const newArray = [value, ...currentArray]
        const newToOld = [
          undefined,
          ...currentArray.map((_, index) => index),
        ]
        keysRef.current.unshift(generateKey())
        store.setArrayValue(name, newArray as ValueAtPath<Values, P>, newToOld)
      },

      insert: (index: number, value: ArrayItem) => {
        if (!Number.isInteger(index)) return
        const currentValue = store.getInternalValue(name) as unknown
        const currentArray = Array.isArray(currentValue) ? currentValue as ArrayItem[] : EMPTY_ARRAY
        synchronizeKeys(currentArray.length)
        const targetIndex = Math.max(0, Math.min(index, currentArray.length))
        const newArray = [...currentArray]
        newArray.splice(targetIndex, 0, value)
        const newToOld = currentArray.map((_, oldIndex) => oldIndex) as Array<
          number | undefined
        >
        newToOld.splice(targetIndex, 0, undefined)
        keysRef.current.splice(targetIndex, 0, generateKey())
        store.setArrayValue(name, newArray as ValueAtPath<Values, P>, newToOld)
      },

      remove: (index: number) => {
        if (!Number.isInteger(index)) return
        const currentValue = store.getInternalValue(name) as unknown
        const currentArray = Array.isArray(currentValue) ? currentValue as ArrayItem[] : EMPTY_ARRAY
        synchronizeKeys(currentArray.length)
        if (index < 0 || index >= currentArray.length) return
        const newArray = currentArray.filter((_, i) => i !== index)
        const newToOld: number[] = []
        for (let oldIndex = 0; oldIndex < currentArray.length; oldIndex++) {
          if (oldIndex !== index) newToOld.push(oldIndex)
        }
        keysRef.current.splice(index, 1)
        store.setArrayValue(name, newArray as ValueAtPath<Values, P>, newToOld)
      },

      move: (fromIndex: number, toIndex: number) => {
        if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return
        const currentValue = store.getInternalValue(name) as unknown
        const currentArray = Array.isArray(currentValue) ? currentValue as ArrayItem[] : EMPTY_ARRAY
        synchronizeKeys(currentArray.length)
        if (
          fromIndex < 0 ||
          fromIndex >= currentArray.length ||
          toIndex < 0 ||
          toIndex >= currentArray.length ||
          fromIndex === toIndex
        ) {
          return
        }

        const newArray = [...currentArray]
        const [item] = newArray.splice(fromIndex, 1)
        newArray.splice(toIndex, 0, item as ArrayItem)
        const newToOld = currentArray.map((_, oldIndex) => oldIndex)
        const [oldIndex] = newToOld.splice(fromIndex, 1)
        const [key] = keysRef.current.splice(fromIndex, 1)
        newToOld.splice(toIndex, 0, oldIndex as number)
        keysRef.current.splice(toIndex, 0, key ?? generateKey())
        store.setArrayValue(name, newArray as ValueAtPath<Values, P>, newToOld)
      },

      swap: (indexA: number, indexB: number) => {
        if (!Number.isInteger(indexA) || !Number.isInteger(indexB)) return
        const currentValue = store.getInternalValue(name) as unknown
        const currentArray = Array.isArray(currentValue) ? currentValue as ArrayItem[] : EMPTY_ARRAY
        synchronizeKeys(currentArray.length)
        if (
          indexA < 0 ||
          indexA >= currentArray.length ||
          indexB < 0 ||
          indexB >= currentArray.length ||
          indexA === indexB
        ) {
          return
        }

        const newArray = [...currentArray]
        ;[newArray[indexA], newArray[indexB]] = [
          newArray[indexB] as ArrayItem,
          newArray[indexA] as ArrayItem,
        ]
        const newToOld = currentArray.map((_, oldIndex) => oldIndex)
        ;[newToOld[indexA], newToOld[indexB]] = [newToOld[indexB]!, newToOld[indexA]!]
        ;[keysRef.current[indexA], keysRef.current[indexB]] = [
          keysRef.current[indexB]!,
          keysRef.current[indexA]!,
        ]
        store.setArrayValue(name, newArray as ValueAtPath<Values, P>, newToOld)
      },

      replace: (values: ArrayItem[]) => {
        keysRef.current = values.map(() => generateKey())
        store.setArrayValue(
          name,
          values as ValueAtPath<Values, P>,
          values.map(() => undefined)
        )
      },

      clear: () => {
        keysRef.current = []
        store.setArrayValue(name, [] as ValueAtPath<Values, P>, [])
      },
    }),
    [store, name]
  )

  const renderProps = useMemo<FieldArrayRenderProps<ArrayItem>>(
    () => ({ fields, helpers }),
    [fields, helpers]
  )

  return children(renderProps)
}
