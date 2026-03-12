/**
 * Advanced features tests
 * - Computed fields
 * - Conditional validation
 * - Form-level validation
 * - SSR support
 */

import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useForm } from '../useForm.js'

describe('Advanced Features', () => {
  describe('computed fields', () => {
    it('should compute field values from other fields', () => {
      interface FormValues {
        firstName: string
        lastName: string
        fullName: string
      }

      const { result } = renderHook(() =>
        useForm<FormValues>({
          initialValues: {
            firstName: 'John',
            lastName: 'Doe',
            fullName: '',
          },
          computed: {
            fullName: (values) => `${values.firstName} ${values.lastName}`.trim(),
          },
        })
      )

      // Initial computed value
      expect(result.current.values.fullName).toBe('John Doe')
    })

    it('should update computed fields when dependencies change', () => {
      interface FormValues {
        price: number
        quantity: number
        total: number
      }

      const { result } = renderHook(() =>
        useForm<FormValues>({
          initialValues: {
            price: 10,
            quantity: 2,
            total: 0,
          },
          computed: {
            total: (values) => values.price * values.quantity,
          },
        })
      )

      expect(result.current.values.total).toBe(20)

      act(() => {
        result.current.setFieldValue('price' as any, 15)
      })

      expect(result.current.values.total).toBe(30)

      act(() => {
        result.current.setFieldValue('quantity' as any, 3)
      })

      expect(result.current.values.total).toBe(45)
    })

    it('should handle multiple computed fields', () => {
      interface FormValues {
        firstName: string
        lastName: string
        fullName: string
        initials: string
      }

      const { result } = renderHook(() =>
        useForm<FormValues>({
          initialValues: {
            firstName: 'Jane',
            lastName: 'Smith',
            fullName: '',
            initials: '',
          },
          computed: {
            fullName: (values) => `${values.firstName} ${values.lastName}`.trim(),
            initials: (values) => `${values.firstName[0] || ''}${values.lastName[0] || ''}`.toUpperCase(),
          },
        })
      )

      expect(result.current.values.fullName).toBe('Jane Smith')
      expect(result.current.values.initials).toBe('JS')

      act(() => {
        result.current.setFieldValue('firstName' as any, 'John')
      })

      expect(result.current.values.fullName).toBe('John Smith')
      expect(result.current.values.initials).toBe('JS')
    })

    it('should not allow setting computed field values directly', () => {
      interface FormValues {
        firstName: string
        lastName: string
        fullName: string
      }

      const { result } = renderHook(() =>
        useForm<FormValues>({
          initialValues: {
            firstName: 'John',
            lastName: 'Doe',
            fullName: '',
          },
          computed: {
            fullName: (values) => `${values.firstName} ${values.lastName}`.trim(),
          },
        })
      )

      // Try to set computed field directly
      act(() => {
        result.current.setFieldValue('fullName' as any, 'Manual Name')
      })

      // Should be overwritten by computed value
      expect(result.current.values.fullName).toBe('John Doe')
    })
  })

  describe('conditional validation', () => {
    it('should validate based on other field values', async () => {
      interface FormValues {
        useShipping: boolean
        shippingAddress: string
      }

      const { result } = renderHook(() =>
        useForm<FormValues>({
          initialValues: {
            useShipping: false,
            shippingAddress: '',
          },
          validate: {
            shippingAddress: (value, values) => {
              if (values?.useShipping && !value) {
                return 'Shipping address is required'
              }
              return null
            },
          },
        })
      )

      // Validate when useShipping is false
      act(() => {
        result.current.validateField('shippingAddress' as any)
      })

      await waitFor(() => {
        expect(result.current.errors.shippingAddress).toBeUndefined()
      })

      // Enable shipping
      act(() => {
        result.current.setFieldValue('useShipping' as any, true)
        result.current.validateField('shippingAddress' as any)
      })

      await waitFor(() => {
        expect(result.current.errors.shippingAddress).toBe('Shipping address is required')
      })

      // Set address
      act(() => {
        result.current.setFieldValue('shippingAddress' as any, '123 Main St')
        result.current.validateField('shippingAddress' as any)
      })

      await waitFor(() => {
        expect(result.current.errors.shippingAddress).toBeUndefined()
      })
    })

    it('should support conditional validation with when helper', async () => {
      interface FormValues {
        agreeToTerms: boolean
        promoCode: string
      }

      const { result } = renderHook(() =>
        useForm<FormValues>({
          initialValues: {
            agreeToTerms: false,
            promoCode: '',
          },
          validate: {
            promoCode: (value, values) => {
              // Only validate if agreed to terms
              if (!values?.agreeToTerms) return null

              if (!value) return 'Promo code is required'
              if (!/^PROMO-[A-Z0-9]{6}$/.test(value)) {
                return 'Invalid promo code format'
              }
              return null
            },
          },
        })
      )

      // Should not validate when terms not agreed
      act(() => {
        result.current.validateField('promoCode' as any)
      })

      await waitFor(() => {
        expect(result.current.errors.promoCode).toBeUndefined()
      })

      // Should validate when terms agreed
      act(() => {
        result.current.setFieldValue('agreeToTerms' as any, true)
        result.current.validateField('promoCode' as any)
      })

      await waitFor(() => {
        expect(result.current.errors.promoCode).toBe('Promo code is required')
      })
    })
  })

  describe('form-level validation', () => {
    it('should run form-level validation after field validation', async () => {
      interface FormValues {
        password: string
        confirmPassword: string
      }

      const { result } = renderHook(() =>
        useForm<FormValues>({
          initialValues: {
            password: '',
            confirmPassword: '',
          },
          validate: {
            password: (value) => (!value ? 'Password is required' : null),
            confirmPassword: (value) => (!value ? 'Confirm password is required' : null),
          },
          validateForm: (values) => {
            const errors: Partial<Record<keyof FormValues, string>> = {}

            if (values.password && values.confirmPassword && values.password !== values.confirmPassword) {
              errors.confirmPassword = 'Passwords must match'
            }

            return errors
          },
        })
      )

      // Set different passwords
      act(() => {
        result.current.setFieldValue('password' as any, 'password123')
        result.current.setFieldValue('confirmPassword' as any, 'different')
      })

      // Validate form
      await act(async () => {
        await result.current.validate()
      })

      expect(result.current.errors.confirmPassword).toBe('Passwords must match')

      // Set matching passwords
      act(() => {
        result.current.setFieldValue('confirmPassword' as any, 'password123')
      })

      await act(async () => {
        await result.current.validate()
      })

      expect(result.current.errors.confirmPassword).toBeUndefined()
    })

    it('should validate multiple cross-field rules', async () => {
      interface FormValues {
        minAge: number
        maxAge: number
        startDate: string
        endDate: string
      }

      const { result } = renderHook(() =>
        useForm<FormValues>({
          initialValues: {
            minAge: 0,
            maxAge: 0,
            startDate: '',
            endDate: '',
          },
          validateForm: (values) => {
            const errors: Partial<Record<keyof FormValues, string>> = {}

            if (values.minAge >= values.maxAge) {
              errors.maxAge = 'Max age must be greater than min age'
            }

            if (values.startDate && values.endDate && values.startDate >= values.endDate) {
              errors.endDate = 'End date must be after start date'
            }

            return errors
          },
        })
      )

      act(() => {
        result.current.setFieldValue('minAge' as any, 30)
        result.current.setFieldValue('maxAge' as any, 20)
      })

      await act(async () => {
        await result.current.validate()
      })

      expect(result.current.errors.maxAge).toBe('Max age must be greater than min age')
    })
  })

  describe('SSR support', () => {
    it('should initialize with server-rendered values', () => {
      // Test that form can be initialized with values that would come from SSR
      const { result } = renderHook(() =>
        useForm({
          initialValues: {
            email: 'server@example.com',
            password: 'server-password',
          },
        })
      )

      // Form should initialize with SSR values
      expect(result.current.values).toEqual({
        email: 'server@example.com',
        password: 'server-password',
      })

      // State should not be dirty initially
      expect(result.current.isDirty).toBe(false)
    })

    it('should hydrate correctly and handle client interactions', () => {
      const { result } = renderHook(() =>
        useForm({
          initialValues: {
            username: 'john',
            email: 'john@example.com',
          },
        })
      )

      // Verify initial values are set (as they would be after SSR hydration)
      expect(result.current.values.username).toBe('john')
      expect(result.current.values.email).toBe('john@example.com')

      // Verify state changes work after hydration (client-side interaction)
      act(() => {
        result.current.setFieldValue('username' as any, 'jane')
      })

      expect(result.current.values.username).toBe('jane')
      expect(result.current.isDirty).toBe(true)
    })

    it('should not rely on browser-only APIs during initialization', () => {
      // Our form uses structuredClone which works in Node.js 17+
      // This test verifies no browser-only APIs are required
      const { result } = renderHook(() =>
        useForm({
          initialValues: {
            nested: {
              deep: {
                value: 'test',
              },
            },
          },
        })
      )

      expect(result.current.values.nested.deep.value).toBe('test')
    })
  })

  describe('integration: advanced features together', () => {
    it('should support computed fields + form-level validation', async () => {
      interface FormValues {
        price: number
        taxRate: number
        subtotal: number
        tax: number
        total: number
        budget: number
      }

      const { result } = renderHook(() =>
        useForm<FormValues>({
          initialValues: {
            price: 100,
            taxRate: 0.1,
            subtotal: 0,
            tax: 0,
            total: 0,
            budget: 150,
          },
          computed: {
            subtotal: (values) => values.price,
            tax: (values) => values.price * values.taxRate,
            total: (values) => values.price + values.price * values.taxRate,
          },
          validateForm: (values) => {
            const errors: Partial<Record<keyof FormValues, string>> = {}

            if (values.total > values.budget) {
              errors.price = `Total ($${values.total}) exceeds budget ($${values.budget})`
            }

            return errors
          },
        })
      )

      // Check computed values
      expect(result.current.values.subtotal).toBe(100)
      expect(result.current.values.tax).toBe(10)
      expect(result.current.values.total).toBe(110)

      // Should be valid (under budget)
      await act(async () => {
        await result.current.validate()
      })

      expect(result.current.errors.price).toBeUndefined()

      // Increase price over budget
      act(() => {
        result.current.setFieldValue('price' as any, 200)
      })

      expect(result.current.values.total).toBe(220)

      await act(async () => {
        await result.current.validate()
      })

      expect(result.current.errors.price).toContain('exceeds budget')
    })
  })
})
