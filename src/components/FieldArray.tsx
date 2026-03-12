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

import { useSyncExternalStore, useCallback, useMemo } from 'react'
import type { FormStore } from '../core/store.js'
import type { Path, ValueAtPath } from '../types.js'

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

export interface FieldArrayProps<Values extends Record<string, unknown>, P extends Path<Values>> {
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
  children: (props: FieldArrayRenderProps<ValueAtPath<Values, P> extends (infer U)[] ? U : never>) => JSX.Element
}

/**
 * Generate stable key for array item
 */
let keyCounter = 0
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
export function FieldArray<Values extends Record<string, unknown>, P extends Path<Values>>({
  name,
  store,
  children,
}: FieldArrayProps<Values, P>): JSX.Element {
  type ArrayItem = ValueAtPath<Values, P> extends (infer U)[] ? U : never

  // Map to store stable keys for array items
  const keysMapRef = useMemo(() => new Map<number, string>(), [])

  // Subscribe to array field changes
  const subscribe = useCallback(
    (callback: () => void) => {
      return store.subscribe(name, () => callback())
    },
    [store, name]
  )

  const getSnapshot = useCallback(() => {
    const value = store.getFieldState(name).value as unknown
    return Array.isArray(value) ? value : []
  }, [store, name])

  const arrayValue = useSyncExternalStore(subscribe, getSnapshot) as ArrayItem[]

  // Generate stable keys for array items
  const fields: FieldArrayItem<ArrayItem>[] = useMemo(() => {
    return arrayValue.map((value, index) => {
      // Reuse existing key if available, otherwise generate new one
      let key = keysMapRef.get(index)
      if (!key) {
        key = generateKey()
        keysMapRef.set(index, key)
      }

      return {
        key,
        value,
        index,
      }
    })
  }, [arrayValue, keysMapRef])

  // Clear unused keys (keep map size bounded)
  useMemo(() => {
    const currentIndices = new Set(arrayValue.map((_, i) => i))
    for (const index of keysMapRef.keys()) {
      if (!currentIndices.has(index)) {
        keysMapRef.delete(index)
      }
    }
  }, [arrayValue, keysMapRef])

  // Array operation helpers
  const helpers: FieldArrayHelpers<ArrayItem> = useMemo(
    () => ({
      append: (value: ArrayItem) => {
        const newArray = [...arrayValue, value]
        store.setValue(name, newArray as ValueAtPath<Values, P>)
      },

      prepend: (value: ArrayItem) => {
        const newArray = [value, ...arrayValue]
        store.setValue(name, newArray as ValueAtPath<Values, P>)
        // Shift all keys down
        const newKeysMap = new Map<number, string>()
        for (const [index, key] of keysMapRef.entries()) {
          newKeysMap.set(index + 1, key)
        }
        keysMapRef.clear()
        for (const [index, key] of newKeysMap.entries()) {
          keysMapRef.set(index, key)
        }
      },

      insert: (index: number, value: ArrayItem) => {
        const newArray = [...arrayValue]
        newArray.splice(index, 0, value)
        store.setValue(name, newArray as ValueAtPath<Values, P>)
        // Shift keys at and after insertion point
        const newKeysMap = new Map<number, string>()
        for (const [i, key] of keysMapRef.entries()) {
          newKeysMap.set(i >= index ? i + 1 : i, key)
        }
        keysMapRef.clear()
        for (const [i, key] of newKeysMap.entries()) {
          keysMapRef.set(i, key)
        }
      },

      remove: (index: number) => {
        const newArray = arrayValue.filter((_, i) => i !== index)
        store.setValue(name, newArray as ValueAtPath<Values, P>)
        // Shift keys after removal point
        keysMapRef.delete(index)
        const newKeysMap = new Map<number, string>()
        for (const [i, key] of keysMapRef.entries()) {
          newKeysMap.set(i > index ? i - 1 : i, key)
        }
        keysMapRef.clear()
        for (const [i, key] of newKeysMap.entries()) {
          keysMapRef.set(i, key)
        }
      },

      move: (fromIndex: number, toIndex: number) => {
        const newArray = [...arrayValue]
        const [item] = newArray.splice(fromIndex, 1)
        if (item !== undefined) {
          newArray.splice(toIndex, 0, item)
        }
        store.setValue(name, newArray as ValueAtPath<Values, P>)
        // Swap keys
        const fromKey = keysMapRef.get(fromIndex)
        const toKey = keysMapRef.get(toIndex)
        if (fromKey) {
          keysMapRef.set(toIndex, fromKey)
        }
        if (toKey) {
          keysMapRef.set(fromIndex, toKey)
        }
      },

      swap: (indexA: number, indexB: number) => {
        const newArray = [...arrayValue]
        const temp = newArray[indexA]
        const itemB = newArray[indexB]
        if (temp !== undefined && itemB !== undefined) {
          newArray[indexA] = itemB
          newArray[indexB] = temp
        }
        store.setValue(name, newArray as ValueAtPath<Values, P>)
        // Swap keys
        const keyA = keysMapRef.get(indexA)
        const keyB = keysMapRef.get(indexB)
        if (keyA && keyB) {
          keysMapRef.set(indexA, keyB)
          keysMapRef.set(indexB, keyA)
        }
      },

      replace: (values: ArrayItem[]) => {
        store.setValue(name, values as ValueAtPath<Values, P>)
        // Clear all keys (new array)
        keysMapRef.clear()
      },

      clear: () => {
        store.setValue(name, [] as ValueAtPath<Values, P>)
        // Clear all keys
        keysMapRef.clear()
      },
    }),
    [arrayValue, store, name, keysMapRef]
  )

  const renderProps: FieldArrayRenderProps<ArrayItem> = {
    fields,
    helpers,
  }

  return children(renderProps)
}
