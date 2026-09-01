/**
 * FieldArray component tests
 *
 * Tests array operations and stable key generation
 */

import { Suspense, memo, startTransition, useState } from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { FormStore } from '../../core/store.js'
import {
  FieldArray,
  type FieldArrayItem,
  type FieldArrayRenderProps,
} from '../FieldArray.js'

interface FormValues {
  items: string[]
  users: Array<{ name: string; age: number }>
}

function SuspendForever({ promise }: { promise: Promise<never> }): never {
  throw promise
}

describe('FieldArray', () => {
  describe('component rendering and helpers', () => {
    it('preserves unchanged row and helper identities on a nested update', () => {
      type Values = { users: Array<{ name: string }> }
      const store = new FormStore<Values>({
        users: Array.from({ length: 100 }, (_, index) => ({ name: `user-${index}` })),
      })
      const renderCounts = new Map<string, number>()
      const Row = memo(function Row({
        field,
      }: {
        field: FieldArrayItem<{ name: string }>
      }) {
        renderCounts.set(field.key, (renderCounts.get(field.key) ?? 0) + 1)
        return <span>{field.value.name}</span>
      })
      let latest: FieldArrayRenderProps<{ name: string }> | undefined

      render(
        <FieldArray name="users" store={store}>
          {(props) => {
            latest = props
            return props.fields.map((field) => <Row key={field.key} field={field} />)
          }}
        </FieldArray>
      )

      const initialFields = latest!.fields
      const initialHelpers = latest!.helpers
      const initialKeys = initialFields.map((field) => field.key)

      expect(Reflect.set(initialFields[0]!, 'index', 99)).toBe(false)
      expect(Reflect.set(initialFields[0]!, 'key', 'poisoned')).toBe(false)
      expect(Reflect.set(initialFields, '0', initialFields[1])).toBe(false)

      act(() => store.setValue('users.0.name', 'changed'))

      expect(latest!.helpers).toBe(initialHelpers)
      expect(latest!.fields[0]).not.toBe(initialFields[0])
      for (let index = 1; index < initialFields.length; index++) {
        expect(latest!.fields[index]).toBe(initialFields[index])
      }
      expect(renderCounts.get(initialKeys[0]!)).toBe(2)
      for (const key of initialKeys.slice(1)) {
        expect(renderCounts.get(key)).toBe(1)
      }
    })

    it('uses current store values when a captured helper runs repeatedly', () => {
      const store = new FormStore({ items: ['a'] })
      let latest: FieldArrayRenderProps<string> | undefined
      render(
        <FieldArray name="items" store={store}>
          {(props) => {
            latest = props
            return null
          }}
        </FieldArray>
      )
      const helpers = latest!.helpers

      act(() => {
        helpers.append('b')
        helpers.append('c')
      })

      expect(store.getValue('items')).toEqual(['a', 'b', 'c'])
      expect(latest!.helpers).toBe(helpers)
    })

    it('moves and swaps in-bounds undefined items', () => {
      type Values = { items: Array<string | undefined> }
      const store = new FormStore<Values>({ items: [undefined, 'b', 'c'] })
      let latest: FieldArrayRenderProps<string | undefined> | undefined
      render(
        <FieldArray name="items" store={store}>
          {(props) => {
            latest = props
            return null
          }}
        </FieldArray>
      )

      act(() => latest!.helpers.move(0, 2))
      expect(store.getValue('items')).toEqual(['b', 'c', undefined])

      act(() => latest!.helpers.swap(0, 2))
      expect(store.getValue('items')).toEqual([undefined, 'c', 'b'])
    })

    it('ignores non-integer operation indices', () => {
      const store = new FormStore({ items: ['a', 'b', 'c'] })
      let latest: FieldArrayRenderProps<string> | undefined
      let notifications = 0
      store.subscribe('items', () => {
        notifications++
      })
      render(
        <FieldArray name="items" store={store}>
          {(props) => {
            latest = props
            return null
          }}
        </FieldArray>
      )

      act(() => {
        latest!.helpers.insert(0.5, 'x')
        latest!.helpers.remove(Number.NaN)
        latest!.helpers.move(0, 1.5)
        latest!.helpers.swap(0, Number.POSITIVE_INFINITY)
      })

      expect(store.getValue('items')).toEqual(['a', 'b', 'c'])
      expect(notifications).toBe(0)
    })

    it('does not publish row-key changes from a suspended render', async () => {
      const committedStore = new FormStore({ items: ['a', 'b', 'c'] })
      const speculativeStore = new FormStore({ items: ['a'] })
      const never = new Promise<never>(() => undefined)
      const renders: string[] = []
      let setView!: (view: 'committed' | 'speculative' | 'restored') => void
      let latestKeys: string[] = []

      function TestArray() {
        const [view, updateView] = useState<
          'committed' | 'speculative' | 'restored'
        >('committed')
        setView = updateView
        renders.push(view)
        const store = view === 'speculative' ? speculativeStore : committedStore
        return (
          <Suspense fallback={null}>
            <FieldArray name="items" store={store}>
              {({ fields }) => {
                latestKeys = fields.map((field) => field.key)
                return null
              }}
            </FieldArray>
            {view === 'speculative' ? <SuspendForever promise={never} /> : null}
          </Suspense>
        )
      }

      render(<TestArray />)
      const committedKeys = [...latestKeys]

      act(() => {
        startTransition(() => setView('speculative'))
      })
      await waitFor(() => expect(renders).toContain('speculative'))
      act(() => setView('restored'))

      expect(latestKeys).toEqual(committedKeys)
    })
  })

  describe('array operations via store', () => {
    it('should handle array append operation', () => {
      const store = new FormStore<FormValues>({
        items: ['a', 'b'],
        users: [],
      })

      const currentItems = store.getValue('items' as any)
      store.setValue('items' as any, [...currentItems, 'c'])

      expect(store.getValue('items' as any)).toEqual(['a', 'b', 'c'])
    })

    it('should handle array prepend operation', () => {
      const store = new FormStore<FormValues>({
        items: ['a', 'b'],
        users: [],
      })

      const currentItems = store.getValue('items' as any)
      store.setValue('items' as any, ['z', ...currentItems])

      expect(store.getValue('items' as any)).toEqual(['z', 'a', 'b'])
    })

    it('should handle array insert operation', () => {
      const store = new FormStore<FormValues>({
        items: ['a', 'c'],
        users: [],
      })

      const currentItems = store.getValue('items' as any)
      const newItems = [...currentItems]
      newItems.splice(1, 0, 'b')
      store.setValue('items' as any, newItems)

      expect(store.getValue('items' as any)).toEqual(['a', 'b', 'c'])
    })

    it('should handle array remove operation', () => {
      const store = new FormStore<FormValues>({
        items: ['a', 'b', 'c'],
        users: [],
      })

      const currentItems = store.getValue('items' as any)
      const newItems = currentItems.filter((_item: string, index: number) => index !== 1)
      store.setValue('items' as any, newItems)

      expect(store.getValue('items' as any)).toEqual(['a', 'c'])
    })

    it('should handle array move operation', () => {
      const store = new FormStore<FormValues>({
        items: ['a', 'b', 'c'],
        users: [],
      })

      const currentItems = store.getValue('items' as any)
      const newItems = [...currentItems]
      const [item] = newItems.splice(0, 1)
      if (item) newItems.splice(2, 0, item)
      store.setValue('items' as any, newItems)

      expect(store.getValue('items' as any)).toEqual(['b', 'c', 'a'])
    })

    it('should handle array swap operation', () => {
      const store = new FormStore<FormValues>({
        items: ['a', 'b', 'c'],
        users: [],
      })

      const currentItems = store.getValue('items' as any)
      const newItems = [...currentItems]
      const temp = newItems[0]
      const last = newItems[2]
      if (temp && last) {
        newItems[0] = last
        newItems[2] = temp
      }
      store.setValue('items' as any, newItems)

      expect(store.getValue('items' as any)).toEqual(['c', 'b', 'a'])
    })

    it('should handle array replace operation', () => {
      const store = new FormStore<FormValues>({
        items: ['a', 'b', 'c'],
        users: [],
      })

      store.setValue('items' as any, ['x', 'y', 'z'])

      expect(store.getValue('items' as any)).toEqual(['x', 'y', 'z'])
    })

    it('should handle array clear operation', () => {
      const store = new FormStore<FormValues>({
        items: ['a', 'b', 'c'],
        users: [],
      })

      store.setValue('items' as any, [])

      expect(store.getValue('items' as any)).toEqual([])
    })
  })

  describe('nested array fields', () => {
    it('should handle nested object arrays', () => {
      const store = new FormStore<FormValues>({
        items: [],
        users: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ],
      })

      const currentUsers = store.getValue('users' as any)
      expect(currentUsers).toHaveLength(2)
      expect(currentUsers[0]).toEqual({ name: 'Alice', age: 30 })
    })

    it('should update nested array item fields', () => {
      const store = new FormStore<FormValues>({
        items: [],
        users: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ],
      })

      // Update nested field
      const users = store.getValue('users' as any)
      const updatedUsers = [...users]
      updatedUsers[0] = { ...updatedUsers[0]!, age: 31 }
      store.setValue('users' as any, updatedUsers)

      expect(store.getValue('users' as any)[0]?.age).toBe(31)
    })
  })

  describe('array field subscriptions', () => {
    it('should notify subscribers when array changes', () => {
      const store = new FormStore<FormValues>({
        items: ['a', 'b'],
        users: [],
      })

      let notifyCount = 0
      const unsubscribe = store.subscribe('items' as any, () => {
        notifyCount++
      })

      // Change array
      store.setValue('items' as any, ['a', 'b', 'c'])
      expect(notifyCount).toBe(1)

      // Change again
      store.setValue('items' as any, ['x', 'y'])
      expect(notifyCount).toBe(2)

      unsubscribe()
    })

    it('should not notify unrelated field subscribers', () => {
      const store = new FormStore<FormValues>({
        items: ['a'],
        users: [],
      })

      let itemsNotified = 0
      let usersNotified = 0

      store.subscribe('items' as any, () => {
        itemsNotified++
      })
      store.subscribe('users' as any, () => {
        usersNotified++
      })

      // Change items only
      store.setValue('items' as any, ['a', 'b'])

      expect(itemsNotified).toBe(1)
      expect(usersNotified).toBe(0)
    })
  })

  describe('array validation', () => {
    it('should validate array fields', () => {
      const store = new FormStore<FormValues>({
        items: [],
        users: [],
      })

      // Set error on array field
      store.setError('items' as any, 'At least one item required')

      expect(store.getFieldState('items' as any).error).toBe('At least one item required')
    })

    it('should clear array field errors', () => {
      const store = new FormStore<FormValues>({
        items: [],
        users: [],
      })

      store.setError('items' as any, 'Error')
      expect(store.getFieldState('items' as any).error).toBe('Error')

      store.setError('items' as any, undefined)
      expect(store.getFieldState('items' as any).error).toBeUndefined()
    })
  })
})
