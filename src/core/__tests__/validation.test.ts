/**
 * Dedicated validation logic tests
 *
 * Tests for sync validation, validation modes, and error handling
 */

import { describe, it, expect } from 'vitest'
import { FormStore } from '../store.js'
import type { ValidationSchema, Validator } from '../../types.js'

describe('Validation Logic', () => {
  describe('Field Validation', () => {
    it('should validate a field with a single validator', () => {
      const store = new FormStore({ email: '' })
      const validator: Validator<string> = (value) =>
        value ? undefined : 'Email is required'

      const error = validator(store.getValue('email'))
      expect(error).toBe('Email is required')

      store.setValue('email', 'test@example.com')
      const error2 = validator(store.getValue('email'))
      expect(error2).toBeUndefined()
    })

    it('should validate a field with multiple validators', () => {
      const store = new FormStore({ email: '' })
      const validators: Validator<string>[] = [
        (value) => (value ? undefined : 'Email is required'),
        (value) => (value.includes('@') ? undefined : 'Invalid email'),
      ]

      // Test empty value (fails first validator)
      let error: string | undefined
      for (const validator of validators) {
        error = validator(store.getValue('email'))
        if (error) break
      }
      expect(error).toBe('Email is required')

      // Test invalid email (passes first, fails second)
      store.setValue('email', 'invalid')
      error = undefined
      for (const validator of validators) {
        error = validator(store.getValue('email'))
        if (error) break
      }
      expect(error).toBe('Invalid email')

      // Test valid email (passes both)
      store.setValue('email', 'test@example.com')
      error = undefined
      for (const validator of validators) {
        error = validator(store.getValue('email'))
        if (error) break
      }
      expect(error).toBeUndefined()
    })

    it('should handle conditional validation', () => {
      const store = new FormStore({ type: 'email', value: '' })
      const validator: Validator<string, { type: string; value: string }> = (
        value,
        values
      ) => {
        if (values?.type === 'email') {
          return value.includes('@') ? undefined : 'Invalid email'
        }
        return undefined
      }

      const values = store.getValues()

      // Should validate when type is 'email'
      const error1 = validator(store.getValue('value'), values)
      expect(error1).toBe('Invalid email')

      // Should pass when value is valid email
      store.setValue('value', 'test@example.com')
      const error2 = validator(store.getValue('value'), store.getValues())
      expect(error2).toBeUndefined()

      // Should not validate when type is not 'email'
      store.setValue('type', 'phone')
      store.setValue('value', 'invalid')
      const error3 = validator(store.getValue('value'), store.getValues())
      expect(error3).toBeUndefined()
    })
  })

  describe('Error State Management', () => {
    it('should set and get field errors', () => {
      const store = new FormStore({ email: '' })

      expect(store.getError('email')).toBeUndefined()

      store.setError('email', 'Invalid email')
      expect(store.getError('email')).toBe('Invalid email')

      store.setError('email', undefined)
      expect(store.getError('email')).toBeUndefined()
    })

    it('should get all errors', () => {
      const store = new FormStore({ email: '', password: '' })

      store.setError('email', 'Invalid email')
      store.setError('password', 'Password required')

      const errors = store.getErrors()
      expect(errors).toEqual({
        email: 'Invalid email',
        password: 'Password required',
      })
    })

    it('should clear all errors', () => {
      const store = new FormStore({ email: '', password: '' })

      store.setError('email', 'Invalid email')
      store.setError('password', 'Password required')

      // Clear errors by setting to undefined
      store.setError('email', undefined)
      store.setError('password', undefined)

      const errors = store.getErrors()
      expect(errors).toEqual({})
    })

    it('should handle nested field errors', () => {
      const store = new FormStore({ address: { street: '', city: '' } })

      store.setError('address.street', 'Street is required')
      expect(store.getError('address.street')).toBe('Street is required')

      store.setError('address.city', 'City is required')
      const errors = store.getErrors()
      expect(errors).toEqual({
        'address.street': 'Street is required',
        'address.city': 'City is required',
      })
    })
  })

  describe('Validation Schema', () => {
    it('should support nested validation schema', () => {
      const schema: ValidationSchema<{
        user: { email: string; password: string }
      }> = {
        user: {
          email: (value) => (value ? undefined : 'Email required'),
          password: (value) => (value ? undefined : 'Password required'),
        },
      }

      const store = new FormStore({ user: { email: '', password: '' } })

      // Validate email
      const emailValidator = schema.user.email
      const emailError = emailValidator(store.getValue('user.email'))
      expect(emailError).toBe('Email required')

      // Validate password
      const passwordValidator = schema.user.password
      const passwordError = passwordValidator(store.getValue('user.password'))
      expect(passwordError).toBe('Password required')
    })

    it('should support array validation schema', () => {
      const schema: ValidationSchema<{ tags: string[] }> = {
        tags: (value) =>
          Array.isArray(value) && value.length > 0
            ? undefined
            : 'At least one tag required',
      }

      const store = new FormStore({ tags: [] })

      const validator = schema.tags
      const error1 = validator(store.getValue('tags'))
      expect(error1).toBe('At least one tag required')

      store.setValue('tags', ['tag1'])
      const error2 = validator(store.getValue('tags'))
      expect(error2).toBeUndefined()
    })
  })

  describe('Form State Validation', () => {
    it('should track validity through errors', () => {
      const store = new FormStore({ email: '' })

      // Initially valid (no errors)
      const errors1 = store.getErrors()
      expect(Object.keys(errors1).length).toBe(0)

      // Set error - becomes invalid
      store.setError('email', 'Invalid email')
      const errors2 = store.getErrors()
      expect(Object.keys(errors2).length).toBe(1)
      expect(errors2.email).toBe('Invalid email')

      // Clear error - becomes valid again
      store.setError('email', undefined)
      const errors3 = store.getErrors()
      expect(Object.keys(errors3).length).toBe(0)
    })

    it('should track dirty state in field state', () => {
      const store = new FormStore({ email: 'initial@example.com' })

      // Initially not dirty (value equals initial value)
      const state1 = store.getFieldState('email')
      expect(state1.dirty).toBe(false)

      // Change value - becomes dirty
      store.setValue('email', 'changed@example.com')
      const state2 = store.getFieldState('email')
      expect(state2.dirty).toBe(true)

      // Reset - becomes not dirty
      store.reset()
      const state3 = store.getFieldState('email')
      expect(state3.dirty).toBe(false)
    })

    it('should track touched state', () => {
      const store = new FormStore({ email: '' })

      // Initially not touched
      expect(store.getTouched('email')).toBe(false)

      // Mark as touched
      store.setTouched('email', true)
      expect(store.getTouched('email')).toBe(true)

      // Reset clears touched
      store.reset()
      expect(store.getTouched('email')).toBe(false)
    })

    it('should get complete field state', () => {
      const store = new FormStore({ email: 'initial@example.com' })

      const state = store.getFieldState('email')
      expect(state).toEqual({
        value: 'initial@example.com',
        error: undefined,
        touched: false,
        dirty: false,
        isValidating: false,
      })

      // Change field state
      store.setValue('email', 'new@example.com')
      store.setTouched('email', true)
      store.setError('email', 'Invalid email')

      const newState = store.getFieldState('email')
      expect(newState).toEqual({
        value: 'new@example.com',
        error: 'Invalid email',
        touched: true,
        dirty: true,
        isValidating: false,
      })
    })
  })

  describe('Validation Edge Cases', () => {
    it('should handle undefined values', () => {
      const store = new FormStore<{ optional?: string }>({})
      const validator: Validator<string | undefined> = (value) =>
        value ? undefined : 'Required'

      const error = validator(store.getValue('optional'))
      expect(error).toBe('Required')
    })

    it('should handle null values', () => {
      const store = new FormStore<{ nullable: string | null }>({ nullable: null })
      const validator: Validator<string | null> = (value) =>
        value !== null ? undefined : 'Cannot be null'

      const error = validator(store.getValue('nullable'))
      expect(error).toBe('Cannot be null')
    })

    it('should handle empty string values', () => {
      const store = new FormStore({ text: '' })
      const validator: Validator<string> = (value) =>
        value.trim() ? undefined : 'Cannot be empty'

      const error = validator(store.getValue('text'))
      expect(error).toBe('Cannot be empty')
    })

    it('should handle whitespace-only values', () => {
      const store = new FormStore({ text: '   ' })
      const validator: Validator<string> = (value) =>
        value.trim() ? undefined : 'Cannot be whitespace only'

      const error = validator(store.getValue('text'))
      expect(error).toBe('Cannot be whitespace only')
    })

    it('should handle numeric zero', () => {
      const store = new FormStore({ count: 0 })
      const validator: Validator<number> = (value) =>
        value > 0 ? undefined : 'Must be positive'

      const error = validator(store.getValue('count'))
      expect(error).toBe('Must be positive')
    })

    it('should handle boolean false', () => {
      const store = new FormStore({ agreed: false })
      const validator: Validator<boolean> = (value) =>
        value ? undefined : 'Must agree to terms'

      const error = validator(store.getValue('agreed'))
      expect(error).toBe('Must agree to terms')

      store.setValue('agreed', true)
      const error2 = validator(store.getValue('agreed'))
      expect(error2).toBeUndefined()
    })
  })
})
