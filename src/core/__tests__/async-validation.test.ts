/**
 * Async validation state tests
 */

import { describe, it, expect } from 'vitest'
import { FormStore } from '../store.js'

interface TestFormValues {
  username: string
  email: string
  age: number
}

describe('FormStore - Async Validation State', () => {
  describe('validation state tracking', () => {
    it('should track field validation state', () => {
      const store = new FormStore<TestFormValues>({
        username: '',
        email: '',
        age: 0,
      })

      expect(store.isFieldValidating('username' as any)).toBe(false)
      expect(store.isValidating()).toBe(false)

      // Start validation
      store.startValidation('username' as any)

      expect(store.isFieldValidating('username' as any)).toBe(true)
      expect(store.isValidating()).toBe(true)

      // End validation
      store.endValidation('username' as any)

      expect(store.isFieldValidating('username' as any)).toBe(false)
      expect(store.isValidating()).toBe(false)
    })

    it('should track multiple fields validating', () => {
      const store = new FormStore<TestFormValues>({
        username: '',
        email: '',
        age: 0,
      })

      store.startValidation('username' as any)
      store.startValidation('email' as any)

      expect(store.isFieldValidating('username' as any)).toBe(true)
      expect(store.isFieldValidating('email' as any)).toBe(true)
      expect(store.isValidating()).toBe(true)

      const validatingFields = store.getValidatingFields()
      expect(validatingFields).toContain('username')
      expect(validatingFields).toContain('email')
      expect(validatingFields).toHaveLength(2)
    })

    it('should include isValidating in field state', () => {
      const store = new FormStore<TestFormValues>({
        username: 'test',
        email: '',
        age: 0,
      })

      let fieldState = store.getFieldState('username' as any)
      expect(fieldState.isValidating).toBe(false)

      store.startValidation('username' as any)

      fieldState = store.getFieldState('username' as any)
      expect(fieldState.isValidating).toBe(true)

      store.endValidation('username' as any)

      fieldState = store.getFieldState('username' as any)
      expect(fieldState.isValidating).toBe(false)
    })
  })

  describe('validation cancellation', () => {
    it('should cancel pending validation', () => {
      const store = new FormStore<TestFormValues>({
        username: '',
        email: '',
        age: 0,
      })

      const controller = store.startValidation('username' as any)
      expect(store.isFieldValidating('username' as any)).toBe(true)

      store.cancelValidation('username' as any)

      expect(store.isFieldValidating('username' as any)).toBe(false)
      expect(controller.signal.aborted).toBe(true)
    })

    it('should cancel previous validation when starting new one', () => {
      const store = new FormStore<TestFormValues>({
        username: '',
        email: '',
        age: 0,
      })

      const controller1 = store.startValidation('username' as any)
      expect(store.isFieldValidating('username' as any)).toBe(true)

      const controller2 = store.startValidation('username' as any)

      expect(controller1.signal.aborted).toBe(true)
      expect(controller2.signal.aborted).toBe(false)
      expect(store.isFieldValidating('username' as any)).toBe(true)
    })

    it('should handle cancelling non-existent validation', () => {
      const store = new FormStore<TestFormValues>({
        username: '',
        email: '',
        age: 0,
      })

      // Should not throw
      expect(() => {
        store.cancelValidation('username' as any)
      }).not.toThrow()

      expect(store.isFieldValidating('username' as any)).toBe(false)
    })
  })

  describe('validation notifications', () => {
    it('should notify subscribers when validation starts', () => {
      const store = new FormStore<TestFormValues>({
        username: '',
        email: '',
        age: 0,
      })

      let notifyCount = 0
      store.subscribe('username' as any, () => {
        notifyCount++
      })

      store.startValidation('username' as any)
      expect(notifyCount).toBe(1)
    })

    it('should notify subscribers when validation ends', () => {
      const store = new FormStore<TestFormValues>({
        username: '',
        email: '',
        age: 0,
      })

      let notifyCount = 0
      store.subscribe('username' as any, () => {
        notifyCount++
      })

      store.startValidation('username' as any)
      expect(notifyCount).toBe(1)

      store.endValidation('username' as any)
      expect(notifyCount).toBe(2)
    })

    it('should notify global subscribers', () => {
      const store = new FormStore<TestFormValues>({
        username: '',
        email: '',
        age: 0,
      })

      let globalNotifyCount = 0
      store.subscribeToStore(() => {
        globalNotifyCount++
      })

      store.startValidation('username' as any)
      expect(globalNotifyCount).toBe(1)

      store.endValidation('username' as any)
      expect(globalNotifyCount).toBe(2)
    })
  })

  describe('validation workflow', () => {
    it('should track full validation lifecycle', () => {
      const store = new FormStore<TestFormValues>({
        username: '',
        email: '',
        age: 0,
      })

      // Initial state
      expect(store.isValidating()).toBe(false)
      expect(store.getValidatingFields()).toHaveLength(0)

      // Start validation
      const controller = store.startValidation('username' as any)
      expect(store.isValidating()).toBe(true)
      expect(store.getValidatingFields()).toEqual(['username'])
      expect(controller.signal.aborted).toBe(false)

      // Simulate validation completion
      store.endValidation('username' as any)
      expect(store.isValidating()).toBe(false)
      expect(store.getValidatingFields()).toHaveLength(0)
    })

    it('should handle multiple concurrent validations', () => {
      const store = new FormStore<TestFormValues>({
        username: '',
        email: '',
        age: 0,
      })

      // Start multiple validations
      store.startValidation('username' as any)
      store.startValidation('email' as any)
      store.startValidation('age' as any)

      expect(store.isValidating()).toBe(true)
      expect(store.getValidatingFields()).toHaveLength(3)

      // End one validation
      store.endValidation('username' as any)
      expect(store.isValidating()).toBe(true)
      expect(store.getValidatingFields()).toHaveLength(2)

      // End remaining validations
      store.endValidation('email' as any)
      store.endValidation('age' as any)
      expect(store.isValidating()).toBe(false)
      expect(store.getValidatingFields()).toHaveLength(0)
    })
  })

  describe('integration with other store features', () => {
    it('should work with setValue', () => {
      const store = new FormStore<TestFormValues>({
        username: '',
        email: '',
        age: 0,
      })

      store.startValidation('username' as any)
      expect(store.isFieldValidating('username' as any)).toBe(true)

      store.setValue('username' as any, 'newvalue')
      expect(store.getValue('username' as any)).toBe('newvalue')
      expect(store.isFieldValidating('username' as any)).toBe(true)
    })

    it('should work with setError', () => {
      const store = new FormStore<TestFormValues>({
        username: '',
        email: '',
        age: 0,
      })

      store.startValidation('username' as any)
      store.setError('username' as any, 'Username taken')

      const fieldState = store.getFieldState('username' as any)
      expect(fieldState.error).toBe('Username taken')
      expect(fieldState.isValidating).toBe(true)

      store.endValidation('username' as any)
      expect(store.getError('username' as any)).toBe('Username taken')
      expect(store.isFieldValidating('username' as any)).toBe(false)
    })
  })
})
