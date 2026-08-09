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

import { useSyncExternalStore, useCallback, useMemo, useRef, type ReactNode } from 'react'
import type { FormStore } from '../core/store.js'
import type { ArrayPath, ValueAtPath } from '../types.js'

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
  key: string

  /**
   * Item value
   */
  value: T

  /**
   * Item index in array
   */
  index: number
}

/**
 * Render props for FieldArray
 */
export interface FieldArrayRenderProps<T> {
  /**
   * Array items with stable keys
   */
  fields: FieldArrayItem<T>[]

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

  // Subscribe to array field changes
  const subscribe = useCallback(
    (callback: () => void) => {
      return store.subscribe(name, () => callback())
    },
    [store, name]
  )

  const getSnapshot = useCallback((): ArrayItem[] => {
    const value = store.getFieldState(name).value as unknown
    return Array.isArray(value) ? value as ArrayItem[] : EMPTY_ARRAY
  }, [store, name])

  const arrayValue = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  while (keysRef.current.length < arrayValue.length) {
    keysRef.current.push(generateKey())
  }
  if (keysRef.current.length > arrayValue.length) {
    keysRef.current.length = arrayValue.length
  }

  // Generate stable keys for array items
  const fields: FieldArrayItem<ArrayItem>[] = useMemo(() => {
    return arrayValue.map((value, index) => {
      return {
        key: keysRef.current[index] ?? generateKey(),
        value,
        index,
      }
    })
  }, [arrayValue])

  // Array operation helpers
  const helpers: FieldArrayHelpers<ArrayItem> = useMemo(
    () => ({
      append: (value: ArrayItem) => {
        const newArray = [...arrayValue, value]
        const newToOld = arrayValue.map((_, index) => index) as Array<number | undefined>
        newToOld.push(undefined)
        keysRef.current.push(generateKey())
        store.setArrayValue(name, newArray as ValueAtPath<Values, P>, newToOld)
      },

      prepend: (value: ArrayItem) => {
        const newArray = [value, ...arrayValue]
        const newToOld = [
          undefined,
          ...arrayValue.map((_, index) => index),
        ]
        keysRef.current.unshift(generateKey())
        store.setArrayValue(name, newArray as ValueAtPath<Values, P>, newToOld)
      },

      insert: (index: number, value: ArrayItem) => {
        const targetIndex = Math.max(0, Math.min(index, arrayValue.length))
        const newArray = [...arrayValue]
        newArray.splice(targetIndex, 0, value)
        const newToOld = arrayValue.map((_, oldIndex) => oldIndex) as Array<
          number | undefined
        >
        newToOld.splice(targetIndex, 0, undefined)
        keysRef.current.splice(targetIndex, 0, generateKey())
        store.setArrayValue(name, newArray as ValueAtPath<Values, P>, newToOld)
      },

      remove: (index: number) => {
        if (index < 0 || index >= arrayValue.length) return
        const newArray = arrayValue.filter((_, i) => i !== index)
        const newToOld: number[] = []
        for (let oldIndex = 0; oldIndex < arrayValue.length; oldIndex++) {
          if (oldIndex !== index) newToOld.push(oldIndex)
        }
        keysRef.current.splice(index, 1)
        store.setArrayValue(name, newArray as ValueAtPath<Values, P>, newToOld)
      },

      move: (fromIndex: number, toIndex: number) => {
        if (
          fromIndex < 0 ||
          fromIndex >= arrayValue.length ||
          toIndex < 0 ||
          toIndex >= arrayValue.length ||
          fromIndex === toIndex
        ) {
          return
        }

        const newArray = [...arrayValue]
        const [item] = newArray.splice(fromIndex, 1)
        if (item !== undefined) {
          newArray.splice(toIndex, 0, item)
        }
        const newToOld = arrayValue.map((_, oldIndex) => oldIndex)
        const [oldIndex] = newToOld.splice(fromIndex, 1)
        const [key] = keysRef.current.splice(fromIndex, 1)
        if (oldIndex !== undefined) newToOld.splice(toIndex, 0, oldIndex)
        if (key !== undefined) keysRef.current.splice(toIndex, 0, key)
        store.setArrayValue(name, newArray as ValueAtPath<Values, P>, newToOld)
      },

      swap: (indexA: number, indexB: number) => {
        if (
          indexA < 0 ||
          indexA >= arrayValue.length ||
          indexB < 0 ||
          indexB >= arrayValue.length ||
          indexA === indexB
        ) {
          return
        }

        const newArray = [...arrayValue]
        const temp = newArray[indexA]
        const itemB = newArray[indexB]
        if (temp !== undefined && itemB !== undefined) {
          newArray[indexA] = itemB
          newArray[indexB] = temp
        }
        const newToOld = arrayValue.map((_, oldIndex) => oldIndex)
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
    [arrayValue, store, name]
  )

  const renderProps: FieldArrayRenderProps<ArrayItem> = {
    fields,
    helpers,
  }

  return children(renderProps)
}
