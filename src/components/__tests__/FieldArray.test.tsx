/**
 * FieldArray component tests
 *
 * Tests array operations and stable key generation
 */

import { describe, it, expect } from 'vitest'
import { FormStore } from '../../core/store.js'

interface FormValues {
  items: string[]
  users: Array<{ name: string; age: number }>
}

describe('FieldArray', () => {
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
      const newItems = currentItems.filter((_, i) => i !== 1)
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
