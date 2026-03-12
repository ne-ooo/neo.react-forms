/**
 * Tests for useForm hook
 */

import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useForm } from '../useForm.js'

describe('useForm', () => {
  describe('initialization', () => {
    it('should initialize with initial values', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: {
            email: '',
            password: '',
          },
        })
      )

      expect(result.current.values).toEqual({
        email: '',
        password: '',
      })
    })

    it('should initialize with default form state', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
        })
      )

      expect(result.current.isSubmitting).toBe(false)
      expect(result.current.isSubmitted).toBe(false)
      expect(result.current.isValid).toBe(true)
      expect(result.current.isDirty).toBe(false)
      expect(result.current.submitCount).toBe(0)
    })

    it('should accept nested initial values', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: {
            user: {
              profile: {
                firstName: 'John',
                lastName: 'Doe',
              },
            },
          },
        })
      )

      expect(result.current.values).toEqual({
        user: {
          profile: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      })
    })
  })

  describe('setFieldValue', () => {
    it('should update field value', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: {
            email: '',
            password: '',
          },
        })
      )

      act(() => {
        result.current.setFieldValue('email', 'test@example.com')
      })

      expect(result.current.values.email).toBe('test@example.com')
      expect(result.current.values.password).toBe('') // Other fields unchanged
    })

    it('should update nested field value', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: {
            user: {
              profile: {
                firstName: '',
                lastName: '',
              },
            },
          },
        })
      )

      act(() => {
        result.current.setFieldValue('user.profile.firstName', 'John')
      })

      expect(result.current.values.user.profile.firstName).toBe('John')
      expect(result.current.values.user.profile.lastName).toBe('') // Other fields unchanged
    })

    it('should mark form as dirty when value changes', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
        })
      )

      expect(result.current.isDirty).toBe(false)

      act(() => {
        result.current.setFieldValue('email', 'test@example.com')
      })

      expect(result.current.isDirty).toBe(true)
    })
  })

  describe('setFieldError', () => {
    it('should set field error', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
        })
      )

      expect(result.current.errors.email).toBeUndefined()
      expect(result.current.isValid).toBe(true)

      act(() => {
        result.current.setFieldError('email', 'Invalid email')
      })

      expect(result.current.errors.email).toBe('Invalid email')
      expect(result.current.isValid).toBe(false)
    })

    it('should clear field error when set to undefined', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
        })
      )

      act(() => {
        result.current.setFieldError('email', 'Invalid email')
      })

      expect(result.current.errors.email).toBe('Invalid email')

      act(() => {
        result.current.setFieldError('email', undefined)
      })

      expect(result.current.errors.email).toBeUndefined()
      expect(result.current.isValid).toBe(true)
    })
  })

  describe('setFieldTouched', () => {
    it('should mark field as touched', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
        })
      )

      expect(result.current.touched.email).toBeUndefined()

      act(() => {
        result.current.setFieldTouched('email', true)
      })

      expect(result.current.touched.email).toBe(true)
    })

    it('should validate field on blur when mode is onBlur', async () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          mode: 'onBlur',
          validate: {
            email: (value) => (!value ? 'Required' : null),
          },
        })
      )

      await act(async () => {
        result.current.setFieldTouched('email', true)
        // Wait for async validation
        await new Promise((resolve) => setTimeout(resolve, 10))
      })

      // Should auto-validate due to onBlur mode
      expect(result.current.errors.email).toBe('Required')
    })
  })

  describe('getFieldState', () => {
    it('should return complete field state', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: 'test@example.com' },
        })
      )

      const fieldState = result.current.getFieldState('email')

      expect(fieldState).toEqual({
        value: 'test@example.com',
        error: undefined,
        touched: false,
        dirty: false,
        isValidating: false,
      })
    })

    it('should reflect field changes in field state', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
        })
      )

      act(() => {
        result.current.setFieldValue('email', 'test@example.com')
        result.current.setFieldTouched('email', true)
      })

      // Set error separately to ensure it's applied
      act(() => {
        result.current.setFieldError('email', 'Invalid')
      })

      const fieldState = result.current.getFieldState('email')

      expect(fieldState).toEqual({
        value: 'test@example.com',
        error: 'Invalid',
        touched: true,
        dirty: true,
        isValidating: false,
      })
    })
  })

  describe('validation', () => {
    it('should validate field with single validator', async () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          validate: {
            email: (value) => (!value ? 'Required' : null),
          },
        })
      )

      const isValid = await act(async () => {
        return await result.current.validateField('email')
      })

      expect(isValid).toBe(false)
      expect(result.current.errors.email).toBe('Required')
    })

    it('should validate field with multiple validators', async () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { password: 'abc' },
          validate: {
            password: [
              (value) => (!value ? 'Required' : null),
              (value) => (value.length < 8 ? 'Too short' : null),
            ],
          },
        })
      )

      const isValid = await act(async () => {
        return await result.current.validateField('password')
      })

      expect(isValid).toBe(false)
      expect(result.current.errors.password).toBe('Too short')
    })

    it('should pass validation when valid', async () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: 'test@example.com' },
          validate: {
            email: (value) => (!value ? 'Required' : null),
          },
        })
      )

      const isValid = await act(async () => {
        return await result.current.validateField('email')
      })

      expect(isValid).toBe(true)
      expect(result.current.errors.email).toBeUndefined()
    })

    it('should support async validators', async () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { username: 'taken' },
          validate: {
            username: async (value) => {
              // Simulate API call
              await new Promise((resolve) => setTimeout(resolve, 10))
              return value === 'taken' ? 'Username taken' : null
            },
          },
        })
      )

      const isValid = await act(async () => {
        return await result.current.validateField('username')
      })

      expect(isValid).toBe(false)
      expect(result.current.errors.username).toBe('Username taken')
    })

    it('should validate entire form', async () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: {
            email: '',
            password: '',
          },
          validate: {
            email: (value) => (!value ? 'Email required' : null),
            password: (value) => (!value ? 'Password required' : null),
          },
        })
      )

      const isValid = await act(async () => {
        return await result.current.validate()
      })

      expect(isValid).toBe(false)
      expect(result.current.errors).toEqual({
        email: 'Email required',
        password: 'Password required',
      })
    })

    it('should support form-level validation', async () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: {
            password: 'password123',
            confirmPassword: 'different',
          },
          validateForm: (values) => {
            if (values.password !== values.confirmPassword) {
              return {
                confirmPassword: 'Passwords must match',
              }
            }
            return null
          },
        })
      )

      const isValid = await act(async () => {
        return await result.current.validate()
      })

      expect(isValid).toBe(false)
      expect(result.current.errors.confirmPassword).toBe('Passwords must match')
    })

    it('should auto-validate on change when reValidateMode is onChange', async () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          reValidateMode: 'onChange',
          validate: {
            email: (value) => (!value ? 'Required' : null),
          },
        })
      )

      // First validation
      await act(async () => {
        await result.current.validateField('email')
      })

      expect(result.current.errors.email).toBe('Required')

      // Change value should auto-validate
      await act(async () => {
        result.current.setFieldValue('email', 'test@example.com')
      })

      // Wait for auto-validation
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })

      expect(result.current.errors.email).toBeUndefined()
    })
  })

  describe('reset', () => {
    it('should reset form to initial values', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: {
            email: '',
            password: '',
          },
        })
      )

      act(() => {
        result.current.setFieldValue('email', 'test@example.com')
        result.current.setFieldValue('password', 'secret123')
        result.current.setFieldError('email', 'Invalid')
        result.current.setFieldTouched('password', true)
      })

      act(() => {
        result.current.reset()
      })

      expect(result.current.values).toEqual({
        email: '',
        password: '',
      })
      expect(result.current.errors).toEqual({})
      expect(result.current.touched).toEqual({})
      expect(result.current.isDirty).toBe(false)
    })

    it('should reset to new initial values if provided', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
        })
      )

      act(() => {
        result.current.setFieldValue('email', 'test@example.com')
      })

      act(() => {
        result.current.reset({ email: 'new@example.com' })
      })

      expect(result.current.values.email).toBe('new@example.com')
      expect(result.current.isDirty).toBe(false)
    })
  })

  describe('handleSubmit', () => {
    it('should call onSubmit when form is valid', async () => {
      const onSubmit = vi.fn()

      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: 'test@example.com' },
          validate: {
            email: (value) => (!value ? 'Required' : null),
          },
          onSubmit,
        })
      )

      await act(async () => {
        await result.current.handleSubmit()
      })

      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(onSubmit).toHaveBeenCalledWith({ email: 'test@example.com' })
    })

    it('should NOT call onSubmit when form is invalid', async () => {
      const onSubmit = vi.fn()

      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          validate: {
            email: (value) => (!value ? 'Required' : null),
          },
          onSubmit,
        })
      )

      await act(async () => {
        await result.current.handleSubmit()
      })

      expect(onSubmit).not.toHaveBeenCalled()
      expect(result.current.errors.email).toBe('Required')
    })

    it('should call onSubmitError when submission fails', async () => {
      const error = new Error('Submission failed')
      const onSubmit = vi.fn().mockRejectedValue(error)
      const onSubmitError = vi.fn()

      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: 'test@example.com' },
          onSubmit,
          onSubmitError,
        })
      )

      await act(async () => {
        await result.current.handleSubmit()
      })

      expect(onSubmitError).toHaveBeenCalledTimes(1)
      expect(onSubmitError).toHaveBeenCalledWith(error)
    })

    it('should prevent default when event is provided', async () => {
      const onSubmit = vi.fn()
      const event = {
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent

      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: 'test@example.com' },
          onSubmit,
        })
      )

      await act(async () => {
        await result.current.handleSubmit(event)
      })

      expect(event.preventDefault).toHaveBeenCalled()
    })
  })

  describe('TypeScript inference', () => {
    it('should infer types from initialValues', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: {
            email: '',
            age: 0,
            profile: {
              firstName: '',
              lastName: '',
            },
          },
        })
      )

      // These should be type-safe at compile time
      // TypeScript will error if we try to set wrong types

      act(() => {
        result.current.setFieldValue('email', 'test@example.com') // string ✓
        result.current.setFieldValue('age', 25) // number ✓
        result.current.setFieldValue('profile.firstName', 'John') // string ✓

        // These would cause TypeScript errors:
        // result.current.setFieldValue('email', 123) // ✗ wrong type
        // result.current.setFieldValue('invalid', 'value') // ✗ invalid path
      })

      // Runtime verification
      expect(result.current.values.email).toBe('test@example.com')
      expect(result.current.values.age).toBe(25)
      expect(result.current.values.profile.firstName).toBe('John')
    })
  })
})
