/**
 * Tests for FormStore - Core state management with subscriptions
 */

import { describe, it, expect, vi } from 'vitest'
import { FormStore, getValueByPath, setValueByPath } from '../store.js'

describe('getValueByPath', () => {
  it('should get value at top-level path', () => {
    const obj = { name: 'John', age: 30 }
    expect(getValueByPath(obj, 'name')).toBe('John')
    expect(getValueByPath(obj, 'age')).toBe(30)
  })

  it('should get value at nested path', () => {
    const obj = {
      user: {
        profile: {
          name: 'John',
          age: 30,
        },
      },
    }
    expect(getValueByPath(obj, 'user.profile.name')).toBe('John')
    expect(getValueByPath(obj, 'user.profile.age')).toBe(30)
  })

  it('should return undefined for non-existent path', () => {
    const obj = { user: { name: 'John' } }
    expect(getValueByPath(obj, 'user.email')).toBeUndefined()
    expect(getValueByPath(obj, 'invalid.path')).toBeUndefined()
  })

  it('should return undefined when traversing through null/undefined', () => {
    const obj = { user: null }
    expect(getValueByPath(obj, 'user.name')).toBeUndefined()
  })
})

describe('setValueByPath', () => {
  it('should set value at top-level path immutably', () => {
    const obj = { name: 'John', age: 30 }
    const updated = setValueByPath(obj, 'name', 'Jane')

    expect(updated).toEqual({ name: 'Jane', age: 30 })
    expect(updated).not.toBe(obj) // Immutable
    expect(obj.name).toBe('John') // Original unchanged
  })

  it('should set value at nested path immutably', () => {
    const obj = {
      user: {
        profile: {
          name: 'John',
          age: 30,
        },
      },
    }

    const updated = setValueByPath(obj, 'user.profile.name', 'Jane')

    expect(getValueByPath(updated, 'user.profile.name')).toBe('Jane')
    expect(getValueByPath(updated, 'user.profile.age')).toBe(30)
    expect(updated).not.toBe(obj) // Immutable
    expect(getValueByPath(obj, 'user.profile.name')).toBe('John') // Original unchanged
  })

  it('should create nested structure if missing', () => {
    const obj = {}
    const updated = setValueByPath(obj, 'user.profile.name', 'John')

    expect(getValueByPath(updated, 'user.profile.name')).toBe('John')
  })

  it('should handle empty path', () => {
    const obj = { name: 'John' }
    const updated = setValueByPath(obj, '', 'value')

    expect(updated).toBe(obj) // No change for empty path
  })
})

describe('FormStore', () => {
  describe('constructor', () => {
    it('should initialize with initial values', () => {
      const initialValues = { email: '', password: '' }
      const store = new FormStore(initialValues)

      expect(store.getValues()).toEqual(initialValues)
    })

    it('should clone initial values (not mutate)', () => {
      const initialValues = { email: 'test@example.com' }
      const store = new FormStore(initialValues)

      store.setValue('email', 'new@example.com')

      expect(initialValues.email).toBe('test@example.com') // Original unchanged
    })
  })

  describe('getValue / setValue', () => {
    it('should get and set top-level values', () => {
      const store = new FormStore({ name: 'John', age: 30 })

      expect(store.getValue('name')).toBe('John')
      expect(store.getValue('age')).toBe(30)

      store.setValue('name', 'Jane')
      expect(store.getValue('name')).toBe('Jane')
    })

    it('should get and set nested values', () => {
      const store = new FormStore({
        user: {
          profile: {
            name: 'John',
            age: 30,
          },
        },
      })

      expect(store.getValue('user.profile.name')).toBe('John')

      store.setValue('user.profile.name', 'Jane')
      expect(store.getValue('user.profile.name')).toBe('Jane')
      expect(store.getValue('user.profile.age')).toBe(30) // Other fields unchanged
    })
  })

  describe('getError / setError', () => {
    it('should get and set field errors', () => {
      const store = new FormStore({ email: '' })

      expect(store.getError('email')).toBeUndefined()

      store.setError('email', 'Invalid email')
      expect(store.getError('email')).toBe('Invalid email')
    })

    it('should clear error when set to undefined', () => {
      const store = new FormStore({ email: '' })

      store.setError('email', 'Invalid email')
      expect(store.getError('email')).toBe('Invalid email')

      store.setError('email', undefined)
      expect(store.getError('email')).toBeUndefined()
    })
  })

  describe('getTouched / setTouched', () => {
    it('should get and set touched state', () => {
      const store = new FormStore({ email: '' })

      expect(store.getTouched('email')).toBe(false)

      store.setTouched('email', true)
      expect(store.getTouched('email')).toBe(true)
    })

    it('should clear touched when set to false', () => {
      const store = new FormStore({ email: '' })

      store.setTouched('email', true)
      expect(store.getTouched('email')).toBe(true)

      store.setTouched('email', false)
      expect(store.getTouched('email')).toBe(false)
    })
  })

  describe('getFieldState', () => {
    it('should return complete field state', () => {
      const store = new FormStore({ email: 'test@example.com' })

      const state = store.getFieldState('email')

      expect(state).toEqual({
        value: 'test@example.com',
        error: undefined,
        touched: false,
        dirty: false,
        isValidating: false,
      })
    })

    it('should mark field as dirty when value changes', () => {
      const store = new FormStore({ email: 'test@example.com' })

      store.setValue('email', 'new@example.com')
      const state = store.getFieldState('email')

      expect(state.dirty).toBe(true)
    })

    it('should not mark field as dirty when value is same', () => {
      const store = new FormStore({ email: 'test@example.com' })

      store.setValue('email', 'test@example.com')
      const state = store.getFieldState('email')

      expect(state.dirty).toBe(false)
    })

    it('should include error in field state', () => {
      const store = new FormStore({ email: '' })

      store.setError('email', 'Required')
      const state = store.getFieldState('email')

      expect(state.error).toBe('Required')
    })

    it('should include touched in field state', () => {
      const store = new FormStore({ email: '' })

      store.setTouched('email', true)
      const state = store.getFieldState('email')

      expect(state.touched).toBe(true)
    })
  })

  describe('subscribe', () => {
    it('should notify subscriber when field value changes', () => {
      const store = new FormStore({ email: '' })
      const callback = vi.fn()

      store.subscribe('email', callback)
      store.setValue('email', 'test@example.com')

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 'test@example.com',
          dirty: true,
        })
      )
    })

    it('should notify subscriber when field error changes', () => {
      const store = new FormStore({ email: '' })
      const callback = vi.fn()

      store.subscribe('email', callback)
      store.setError('email', 'Invalid email')

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid email',
        })
      )
    })

    it('should notify subscriber when field touched changes', () => {
      const store = new FormStore({ email: '' })
      const callback = vi.fn()

      store.subscribe('email', callback)
      store.setTouched('email', true)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          touched: true,
        })
      )
    })

    it('should NOT notify subscriber for other field changes', () => {
      const store = new FormStore({ email: '', password: '' })
      const callback = vi.fn()

      store.subscribe('email', callback)
      store.setValue('password', 'secret123')

      expect(callback).not.toHaveBeenCalled() // Field isolation!
    })

    it('should support multiple subscribers for same field', () => {
      const store = new FormStore({ email: '' })
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      store.subscribe('email', callback1)
      store.subscribe('email', callback2)

      store.setValue('email', 'test@example.com')

      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
    })

    it('should allow unsubscribe', () => {
      const store = new FormStore({ email: '' })
      const callback = vi.fn()

      const unsubscribe = store.subscribe('email', callback)

      store.setValue('email', 'test@example.com')
      expect(callback).toHaveBeenCalledTimes(1)

      unsubscribe()

      store.setValue('email', 'new@example.com')
      expect(callback).toHaveBeenCalledTimes(1) // No new call after unsubscribe
    })
  })

  describe('reset', () => {
    it('should reset form to initial values', () => {
      const store = new FormStore({ email: '', password: '' })

      store.setValue('email', 'test@example.com')
      store.setValue('password', 'secret123')
      store.setError('email', 'Invalid')
      store.setTouched('password', true)

      store.reset()

      expect(store.getValues()).toEqual({ email: '', password: '' })
      expect(store.getError('email')).toBeUndefined()
      expect(store.getTouched('password')).toBe(false)
    })

    it('should reset to new initial values if provided', () => {
      const store = new FormStore({ email: '', password: '' })

      store.setValue('email', 'test@example.com')

      store.reset({ email: 'new@example.com' })

      expect(store.getValue('email')).toBe('new@example.com')
      expect(store.getValue('password')).toBe('')
    })

    it('should notify subscribers on reset', () => {
      const store = new FormStore({ email: 'test@example.com' })
      const callback = vi.fn()

      store.subscribe('email', callback)
      store.setValue('email', 'new@example.com')

      callback.mockClear()

      store.reset()

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 'test@example.com',
        })
      )
    })
  })

  describe('getErrors', () => {
    it('should return all errors', () => {
      const store = new FormStore({ email: '', password: '' })

      store.setError('email', 'Invalid email')
      store.setError('password', 'Too short')

      const errors = store.getErrors()

      expect(errors).toEqual({
        email: 'Invalid email',
        password: 'Too short',
      })
    })

    it('should return empty object when no errors', () => {
      const store = new FormStore({ email: '' })

      expect(store.getErrors()).toEqual({})
    })
  })

  describe('getTouchedFields', () => {
    it('should return all touched fields', () => {
      const store = new FormStore({ email: '', password: '' })

      store.setTouched('email', true)
      store.setTouched('password', true)

      const touched = store.getTouchedFields()

      expect(touched).toEqual({
        email: true,
        password: true,
      })
    })

    it('should return empty object when no fields touched', () => {
      const store = new FormStore({ email: '' })

      expect(store.getTouchedFields()).toEqual({})
    })
  })

  describe('isDirty', () => {
    it('should return true when form values changed', () => {
      const store = new FormStore({ email: '' })

      expect(store.isDirty()).toBe(false)

      store.setValue('email', 'test@example.com')

      expect(store.isDirty()).toBe(true)
    })

    it('should return false when values same as initial', () => {
      const store = new FormStore({ email: 'test@example.com' })

      store.setValue('email', 'new@example.com')
      expect(store.isDirty()).toBe(true)

      store.setValue('email', 'test@example.com')
      expect(store.isDirty()).toBe(false)
    })
  })

  describe('isValid', () => {
    it('should return true when no errors', () => {
      const store = new FormStore({ email: '' })

      expect(store.isValid()).toBe(true)
    })

    it('should return false when errors exist', () => {
      const store = new FormStore({ email: '' })

      store.setError('email', 'Required')

      expect(store.isValid()).toBe(false)
    })

    it('should return true after errors cleared', () => {
      const store = new FormStore({ email: '' })

      store.setError('email', 'Required')
      expect(store.isValid()).toBe(false)

      store.setError('email', undefined)
      expect(store.isValid()).toBe(true)
    })
  })
})
