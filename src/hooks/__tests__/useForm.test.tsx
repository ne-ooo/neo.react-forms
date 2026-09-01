/**
 * Tests for useForm hook
 */

import { describe, it, expect, vi } from 'vitest'
import { StrictMode, Suspense, startTransition, useState } from 'react'
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import { useForm } from '../useForm.js'
import type { Validator } from '../../types.js'

function deferred<Value>() {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function SuspendForever({ promise }: { promise: Promise<never> }): never {
  throw promise
}

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

    it('treats an empty-string validator result as an owned error', async () => {
      const onSubmit = vi.fn()
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          validate: { email: () => '' },
          onSubmit,
        })
      )

      await act(async () => {
        expect(await result.current.validateField('email')).toBe(false)
      })

      expect(Object.prototype.hasOwnProperty.call(result.current.errors, 'email')).toBe(
        true
      )
      expect(result.current.errors.email).toBe('')

      await act(async () => {
        await result.current.handleSubmit()
      })

      expect(onSubmit).not.toHaveBeenCalled()
      expect(Object.prototype.hasOwnProperty.call(result.current.errors, 'email')).toBe(
        true
      )
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

    it('submits the immutable snapshot that passed async validation', async () => {
      const pending = deferred<void>()
      const onSubmit = vi.fn()
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: 'safe@example.com', profile: { name: 'Ada' } },
          validate: {
            email: async (_value, values) => {
              await pending.promise
              return values?.profile.name === 'Ada' ? undefined : 'Changed'
            },
          },
          onSubmit,
        })
      )

      let submission!: Promise<void>
      act(() => {
        submission = result.current.handleSubmit()
      })

      expect(() => {
        ;(result.current.values.profile as { name: string }).name = 'UNVALIDATED'
      }).toThrow()

      await act(async () => {
        pending.resolve()
        await submission
      })

      expect(onSubmit).toHaveBeenCalledWith({
        email: 'safe@example.com',
        profile: { name: 'Ada' },
      })
    })

    it('preserves custom Error guards before validation', async () => {
      type GuardedError = Error & { blocked: boolean; self?: GuardedError }
      const failure = new Error('blocked') as GuardedError
      failure.blocked = true
      failure.self = failure
      const onSubmit = vi.fn()
      const validateForm = vi.fn((values: { readonly failure: GuardedError }) =>
        values.failure.blocked ? { failure: 'Blocked error' } : undefined
      )
      const { result } = renderHook(() =>
        useForm({ initialValues: { failure }, validateForm, onSubmit })
      )

      await act(async () => {
        await result.current.handleSubmit()
      })

      const validatedFailure = validateForm.mock.calls[0]?.[0].failure
      expect(validatedFailure?.blocked).toBe(true)
      expect(validatedFailure?.self).toBe(validatedFailure)
      expect(onSubmit).not.toHaveBeenCalled()
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

  describe('validator context', () => {
    it('supplies a detached and read-only value snapshot', async () => {
      interface ContextValues {
        email: string
        profile: { name: string }
        createdAt: Date
      }

      const createdAt = new Date('2026-01-01T00:00:00.000Z')
      const validator: Validator<string, ContextValues> = vi.fn((_value, values, context) => {
        expect(context?.name).toBe('email')
        expect(context?.signal).toBeInstanceOf(AbortSignal)
        expect(context?.values).toBe(values)
        expect(() => {
          ;(context?.values as { email: string }).email = 'changed'
        }).toThrow('Form snapshots are read-only')
        expect(() => {
          ;(values as { profile: { name: string } }).profile.name = 'Changed'
        }).toThrow('Form snapshots are read-only')
        ;(context?.values.createdAt as Date).setUTCFullYear(2030)
        return undefined
      })

      const { result } = renderHook(() =>
        useForm({
          initialValues: {
            email: 'user@example.com',
            profile: { name: 'Ada' },
            createdAt,
          },
          validate: { email: validator },
        })
      )

      await act(async () => {
        expect(await result.current.validateField('email')).toBe(true)
      })

      expect(validator).toHaveBeenCalledTimes(1)
      expect(result.current.values.profile.name).toBe('Ada')
      expect(result.current.values.createdAt.toISOString()).toBe(
        '2026-01-01T00:00:00.000Z'
      )
    })

    it('uses one coherent snapshot for an object field and form values', async () => {
      interface Values {
        profile: { name: string }
      }
      const validator: Validator<Values['profile'], Values> = vi.fn(
        (value, values) => {
          expect(value).toBe(values?.profile)
          expect(() => {
            ;(value as { name: string }).name = 'Changed'
          }).toThrow('Form snapshots are read-only')
          return undefined
        }
      )
      const { result } = renderHook(() =>
        useForm({
          initialValues: { profile: { name: 'Ada' } },
          validate: { profile: validator },
        })
      )

      await act(async () => {
        expect(await result.current.validateField('profile')).toBe(true)
      })
      await act(async () => {
        expect(await result.current.validate()).toBe(true)
      })

      expect(validator).toHaveBeenCalledTimes(2)
      expect(result.current.values.profile.name).toBe('Ada')
    })

    it('does not clone unrelated top-level branches for one field', async () => {
      const profile = { name: 'Ada' }
      const attachment = new Uint8Array(1024 * 1024)
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: 'user@example.com', profile, attachment },
          validate: {
            email: (_value, values) =>
              values?.profile.name === 'Ada' ? undefined : 'Unexpected profile',
          },
        })
      )
      const clone = globalThis.structuredClone.bind(globalThis)
      const cloneSpy = vi
        .spyOn(globalThis, 'structuredClone')
        .mockImplementation((value, options) => clone(value, options))

      await act(async () => {
        expect(await result.current.validateField('email')).toBe(true)
      })

      expect(cloneSpy).not.toHaveBeenCalled()
      expect(cloneSpy).not.toHaveBeenCalledWith(expect.any(Uint8Array))
      cloneSpy.mockRestore()
    })
  })

  describe('validation lifecycle regressions', () => {
    it('includes a mounted Field validator in whole-form validation and submit', async () => {
      const onSubmit = vi.fn()

      function TestForm() {
        const form = useForm({
          initialValues: { email: '' },
          validate: { email: () => undefined },
          onSubmit,
        })

        return (
          <form onSubmit={form.handleSubmit}>
            <form.Field name="email" validate={() => 'Field required'}>
              {({ props, error }) => (
                <>
                  <input data-testid="registered-email" {...props} />
                  {error ? <span>{error}</span> : null}
                </>
              )}
            </form.Field>
            <button type="submit">Submit registered field</button>
          </form>
        )
      }

      render(
        <StrictMode>
          <TestForm />
        </StrictMode>
      )
      fireEvent.click(screen.getByRole('button', { name: 'Submit registered field' }))

      expect(await screen.findByText('Field required')).toBeTruthy()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('updates and unregisters mounted Field validators', async () => {
      let validateForm!: () => Promise<boolean>
      let emailError: string | undefined

      function TestForm({
        message,
        showField,
      }: {
        message: string
        showField: boolean
      }) {
        const form = useForm({ initialValues: { email: '' } })
        validateForm = form.validate
        emailError = form.errors.email
        return showField ? (
          <form.Field name="email" validate={() => message}>
            {() => null}
          </form.Field>
        ) : null
      }

      const rendered = render(<TestForm message="First error" showField />)
      await act(async () => {
        expect(await validateForm()).toBe(false)
      })
      expect(emailError).toBe('First error')

      rendered.rerender(<TestForm message="Second error" showField />)
      await act(async () => {
        expect(await validateForm()).toBe(false)
      })
      expect(emailError).toBe('Second error')

      rendered.rerender(<TestForm message="Unused" showField={false} />)
      await act(async () => {
        expect(await validateForm()).toBe(true)
      })
      expect(emailError).toBeUndefined()
    })

    it('invalidates a pending mounted Field validator when it unmounts', async () => {
      const pending = deferred<string | null>()
      let validateForm!: () => Promise<boolean>
      let emailError: string | undefined

      function TestForm({ showField }: { showField: boolean }) {
        const form = useForm({ initialValues: { email: '' } })
        validateForm = form.validate
        emailError = form.errors.email
        return showField ? (
          <form.Field name="email" validate={() => pending.promise}>
            {() => null}
          </form.Field>
        ) : null
      }

      const rendered = render(<TestForm showField />)
      let validation!: Promise<boolean>
      act(() => {
        validation = validateForm()
      })

      rendered.rerender(<TestForm showField={false} />)
      await act(async () => {
        pending.resolve('Obsolete error')
        expect(await validation).toBe(false)
      })
      expect(emailError).toBeUndefined()
    })

    it('keeps inline mounted validators active across form-state rerenders', async () => {
      const pending = deferred<string | null>()
      let validateField!: () => Promise<boolean>

      function TestForm() {
        const form = useForm({ initialValues: { email: '' } })
        return (
          <>
            <span data-testid="validating">{String(form.isValidating)}</span>
            <form.Field name="email" validate={() => pending.promise}>
              {({ error, validate }) => {
                validateField = validate
                return error ? <span>{error}</span> : null
              }}
            </form.Field>
          </>
        )
      }

      render(
        <StrictMode>
          <TestForm />
        </StrictMode>
      )
      let validation!: Promise<boolean>
      act(() => {
        validation = validateField()
      })
      expect(screen.getByTestId('validating').textContent).toBe('true')

      await act(async () => {
        pending.resolve('Still current')
        expect(await validation).toBe(false)
      })
      expect(screen.getByText('Still current')).toBeTruthy()
    })

    it('does not commit an async field result for an older value snapshot', async () => {
      const pending = deferred<string | null>()
      const { result } = renderHook(() =>
        useForm({
          initialValues: { name: 'old' },
          reValidateMode: 'onBlur',
          validate: { name: () => pending.promise },
        })
      )

      let validation!: Promise<boolean>
      act(() => {
        validation = result.current.validateField('name')
      })
      act(() => {
        result.current.setFieldValue('name', 'new')
      })

      let validationResult!: boolean
      await act(async () => {
        pending.resolve('Error for old value')
        validationResult = await validation
      })

      expect(validationResult).toBe(false)
      expect(result.current.values.name).toBe('new')
      expect(result.current.errors.name).toBeUndefined()
    })

    it('does not commit a field result from a replaced validation schema', async () => {
      const pending = deferred<string | null>()
      type EmailValidator = Validator<string, { email: string }>
      let signal: AbortSignal | undefined
      const firstValidator: EmailValidator = (_value, _values, context) => {
        signal = context?.signal
        return pending.promise
      }
      const nextValidator: EmailValidator = () => undefined
      const { result, rerender } = renderHook(
        ({ validator }: { validator: EmailValidator }) =>
          useForm({
            initialValues: { email: '' },
            validate: { email: validator },
          }),
        {
          initialProps: { validator: firstValidator } as {
            validator: EmailValidator
          },
        }
      )

      let firstRun!: Promise<boolean>
      act(() => {
        firstRun = result.current.validateField('email')
      })
      rerender({ validator: nextValidator })
      expect(signal?.aborted).toBe(true)
      expect(result.current.isValidating).toBe(false)

      await act(async () => {
        pending.resolve('Obsolete error')
        expect(await firstRun).toBe(false)
      })
      expect(result.current.errors.email).toBeUndefined()
      await act(async () => {
        expect(await result.current.validateField('email')).toBe(true)
      })
    })

    it('does not let an older whole-form run clear a newer field result', async () => {
      const pendingForm = deferred<Record<string, string>>()
      const fieldValidator = vi
        .fn()
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce('Latest field error')
      const validateForm = vi.fn(() => pendingForm.promise)
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: 'same@example.com' },
          validate: { email: fieldValidator },
          validateForm,
        })
      )

      let wholeFormValidation!: Promise<boolean>
      act(() => {
        wholeFormValidation = result.current.validate()
      })
      await waitFor(() => expect(validateForm).toHaveBeenCalledTimes(1))

      await act(async () => {
        expect(await result.current.validateField('email')).toBe(false)
      })
      expect(result.current.errors.email).toBe('Latest field error')

      let wholeFormResult!: boolean
      await act(async () => {
        pendingForm.resolve({})
        wholeFormResult = await wholeFormValidation
      })

      expect(wholeFormResult).toBe(false)
      expect(result.current.errors.email).toBe('Latest field error')
    })

    it('publishes only the latest form-only validation run', async () => {
      const first = deferred<Record<string, string>>()
      const second = deferred<Record<string, string>>()
      const validateForm = vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
      const { result } = renderHook(() =>
        useForm({ initialValues: { email: '' }, validateForm })
      )

      let firstRun!: Promise<boolean>
      let secondRun!: Promise<boolean>
      act(() => {
        firstRun = result.current.validate()
      })
      await waitFor(() => expect(validateForm).toHaveBeenCalledTimes(1))
      act(() => {
        secondRun = result.current.validate()
      })
      await waitFor(() => expect(validateForm).toHaveBeenCalledTimes(2))

      await act(async () => {
        second.resolve({ email: 'Latest form error' })
        expect(await secondRun).toBe(false)
      })
      await act(async () => {
        first.resolve({})
        expect(await firstRun).toBe(false)
      })

      expect(result.current.errors.email).toBe('Latest form error')
    })

    it('does not let an async field result clear a newer manual error', async () => {
      const pending = deferred<string | null>()
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: 'user@example.com' },
          validate: { email: () => pending.promise },
        })
      )

      let validation!: Promise<boolean>
      act(() => {
        validation = result.current.validateField('email')
      })
      act(() => {
        result.current.setFieldError('email', 'Manual error')
      })

      await act(async () => {
        pending.resolve(null)
        expect(await validation).toBe(false)
      })
      expect(result.current.errors.email).toBe('Manual error')
    })

    it('does not submit when form-only validation is older than a manual error', async () => {
      const pending = deferred<Record<string, string>>()
      const onSubmit = vi.fn()
      const validateForm = vi.fn(() => pending.promise)
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: 'user@example.com' },
          validateForm,
          onSubmit,
        })
      )

      let submission!: Promise<void>
      act(() => {
        submission = result.current.handleSubmit()
      })
      await waitFor(() => expect(validateForm).toHaveBeenCalledTimes(1))
      act(() => {
        result.current.setFieldError('email', 'Manual error')
      })

      await act(async () => {
        pending.resolve({})
        await submission
      })
      expect(result.current.errors.email).toBe('Manual error')
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('restores an earlier mounted validator after the later one unmounts', async () => {
      let validateEmail!: () => Promise<boolean>
      let emailError: string | undefined

      function TestForm({ showSecond }: { showSecond: boolean }) {
        const form = useForm({ initialValues: { email: '' } })
        validateEmail = () => form.validateField('email')
        emailError = form.errors.email
        return (
          <>
            <form.Field name="email" validate={() => 'First error'}>
              {() => null}
            </form.Field>
            {showSecond ? (
              <form.Field name="email" validate={() => 'Second error'}>
                {() => null}
              </form.Field>
            ) : null}
          </>
        )
      }

      const rendered = render(<TestForm showSecond />)
      await act(async () => {
        expect(await validateEmail()).toBe(false)
      })
      expect(emailError).toBe('Second error')

      rendered.rerender(<TestForm showSecond={false} />)
      await act(async () => {
        expect(await validateEmail()).toBe(false)
      })
      expect(emailError).toBe('First error')
    })

    it('aborts unfinished sibling validators when whole-form validation throws', async () => {
      const unfinished = deferred<string | null>()
      let siblingSignal: AbortSignal | undefined
      const { result } = renderHook(() =>
        useForm({
          initialValues: { first: '', second: '' },
          validate: {
            first: () => {
              throw new Error('Validator failed')
            },
            second: (_value, _values, context) => {
              siblingSignal = context?.signal
              return unfinished.promise
            },
          },
        })
      )

      await expect(result.current.validate()).rejects.toThrow('Validator failed')
      expect(siblingSignal?.aborted).toBe(true)
      expect(result.current.isValidating).toBe(false)
      unfinished.resolve(null)
    })

    it('keeps lazy optional values detached from caller mutation', async () => {
      const pending = deferred<void>()
      const externalProfile = { name: 'Ada' }
      const validator = vi.fn(async (_value: string, values?: { readonly profile: { readonly name: string } }) => {
        await pending.promise
        return values?.profile.name === 'Ada' ? undefined : 'Snapshot changed'
      })
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: '', profile: externalProfile },
          validate: { email: validator },
        })
      )

      let validation!: Promise<boolean>
      act(() => {
        validation = result.current.validateField('email')
      })
      externalProfile.name = 'Grace'
      await act(async () => {
        pending.resolve()
        expect(await validation).toBe(true)
      })
    })

    it('does not clone a top-level array for nested scalar validation', async () => {
      const items = Array.from({ length: 1_000 }, (_, index) => ({ name: `${index}` }))
      const { result } = renderHook(() =>
        useForm({
          initialValues: { items },
          validate: { items: { name: () => undefined } },
        })
      )
      const clone = globalThis.structuredClone.bind(globalThis)
      const cloneSpy = vi
        .spyOn(globalThis, 'structuredClone')
        .mockImplementation((value, options) => clone(value, options))

      await act(async () => {
        expect(await result.current.validateField('items.0.name')).toBe(true)
      })
      expect(cloneSpy).not.toHaveBeenCalled()
      cloneSpy.mockRestore()
    })

    it('does not publish a validator from a suspended render', async () => {
      const never = new Promise<never>(() => undefined)
      let setVariant!: (variant: 'first' | 'second' | 'restored') => void
      let validateEmail!: () => Promise<boolean>
      const renders: string[] = []
      const validatorCalls: string[] = []

      function TestForm() {
        const [variant, updateVariant] = useState<'first' | 'second' | 'restored'>('first')
        setVariant = updateVariant
        const form = useForm({ initialValues: { email: '' } })
        validateEmail = () => form.validateField('email')
        renders.push(variant)
        return (
          <Suspense fallback={null}>
            <form.Field
              name="email"
              validate={() => {
                validatorCalls.push(variant)
                return `${variant} error`
              }}
            >
              {() => null}
            </form.Field>
            {variant === 'second' ? <SuspendForever promise={never} /> : null}
          </Suspense>
        )
      }

      render(<TestForm />)
      act(() => {
        startTransition(() => setVariant('second'))
      })
      await waitFor(() => expect(renders).toContain('second'))

      await act(async () => {
        expect(await validateEmail()).toBe(false)
      })
      expect(validatorCalls.at(-1)).toBe('first')

      act(() => setVariant('restored'))
      await act(async () => {
        expect(await validateEmail()).toBe(false)
      })
      expect(validatorCalls.at(-1)).toBe('restored')
    })

    it('aborts pending validation when the form unmounts', async () => {
      const pending = deferred<string | null>()
      let signal: AbortSignal | undefined
      const { result, unmount } = renderHook(() =>
        useForm({
          initialValues: { email: '' },
          validate: {
            email: (_value, _values, context) => {
              signal = context?.signal
              return pending.promise
            },
          },
        })
      )

      let validation!: Promise<boolean>
      act(() => {
        validation = result.current.validateField('email')
      })
      expect(signal?.aborted).toBe(false)

      unmount()
      expect(signal?.aborted).toBe(true)

      pending.resolve('Late error')
      expect(await validation).toBe(false)
    })

    it('rejects reserved form-level error paths without submitting', async () => {
      const onSubmit = vi.fn()
      const { result } = renderHook(() =>
        useForm({
          initialValues: { email: 'safe@example.com' },
          validateForm: () =>
            JSON.parse('{"__proto__":"blocked by server"}') as Record<
              'email',
              string
            >,
          onSubmit,
        })
      )

      let validationError: unknown
      await act(async () => {
        try {
          await result.current.handleSubmit()
        } catch (error) {
          validationError = error
        }
      })

      expect(validationError).toEqual(
        new Error('Unsafe form validation error path: __proto__')
      )
      expect(onSubmit).not.toHaveBeenCalled()
      expect((Object.prototype as { blocked?: string }).blocked).toBeUndefined()
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
