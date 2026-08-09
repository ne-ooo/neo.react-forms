import { renderToString } from 'react-dom/server'
import { act, render, renderHook, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { UseFieldReturn, UseFormReturn } from '../../types.js'
import { useForm } from '../useForm.js'

interface TestValues {
  email: string
  count: number
}

describe('bound form hooks', () => {
  it('isolates useField from unrelated field updates', () => {
    let form!: UseFormReturn<TestValues>
    let emailField!: UseFieldReturn<string>
    let renders = 0

    function EmailField({ currentForm }: { currentForm: UseFormReturn<TestValues> }) {
      emailField = currentForm.useField('email')
      renders++
      return <span data-testid="email-value">{emailField.value}</span>
    }

    function TestForm() {
      form = useForm({
        initialValues: { email: '', count: 0 },
        mode: 'onSubmit',
        validate: {
          email: (value) => value ? undefined : 'Required',
        },
      })
      return <EmailField currentForm={form} />
    }

    render(<TestForm />)
    expect(renders).toBe(1)

    act(() => form.setFieldValue('count', 1))
    expect(renders).toBe(1)

    act(() => emailField.setValue('user@example.com'))
    expect(screen.getByTestId('email-value').textContent).toBe('user@example.com')
    expect(renders).toBe(2)

    act(() => {
      form.batch(() => {
        emailField.setError('Invalid')
        emailField.setTouched(true)
      })
    })
    expect(emailField.error).toBe('Invalid')
    expect(emailField.touched).toBe(true)
    expect(renders).toBe(3)
  })

  it('uses the form validation pipeline from useField', async () => {
    let form!: UseFormReturn<TestValues>
    let emailField!: UseFieldReturn<string>

    function TestForm() {
      form = useForm({
        initialValues: { email: '', count: 0 },
        validate: {
          email: (value) => value ? undefined : 'Required',
        },
      })
      emailField = form.useField('email')
      return <span>{emailField.error}</span>
    }

    render(<TestForm />)

    await act(async () => {
      expect(await emailField.validate()).toBe(false)
    })
    expect(emailField.error).toBe('Required')

    act(() => emailField.setValue('user@example.com'))
    await act(async () => {
      expect(await emailField.validate()).toBe(true)
    })
    expect(emailField.error).toBeUndefined()
  })

  it('renders a selector only when its result changes', () => {
    let form!: UseFormReturn<TestValues>
    let renders = 0

    function DirtyState({ currentForm }: { currentForm: UseFormReturn<TestValues> }) {
      const isDirty = currentForm.useFormState((state) => state.isDirty)
      renders++
      return <span data-testid="dirty-state">{String(isDirty)}</span>
    }

    function TestForm() {
      form = useForm({ initialValues: { email: '', count: 0 } })
      return <DirtyState currentForm={form} />
    }

    render(<TestForm />)
    expect(renders).toBe(1)

    act(() => form.setFieldError('email', 'Invalid'))
    expect(renders).toBe(1)

    act(() => form.setFieldValue('email', 'user@example.com'))
    expect(screen.getByTestId('dirty-state').textContent).toBe('true')
    expect(renders).toBe(2)

    act(() => form.setFieldValue('count', 1))
    expect(renders).toBe(2)
  })

  it('accepts an equality function for object selector results', () => {
    let form!: UseFormReturn<TestValues>
    let renders = 0

    function SelectedState({ currentForm }: { currentForm: UseFormReturn<TestValues> }) {
      const selected = currentForm.useFormState(
        (state) => ({ valid: state.isValid }),
        (previous, next) => previous.valid === next.valid
      )
      renders++
      return <span>{String(selected.valid)}</span>
    }

    function TestForm() {
      form = useForm({ initialValues: { email: '', count: 0 } })
      return <SelectedState currentForm={form} />
    }

    render(<TestForm />)
    act(() => form.setFieldValue('count', 1))
    expect(renders).toBe(1)

    act(() => form.setFieldError('email', 'Invalid'))
    expect(renders).toBe(2)
  })

  it('selects every form-state property through validation and submission', async () => {
    let form!: UseFormReturn<TestValues>
    let selected!: {
      email: string
      emailError: string | undefined
      emailTouched: boolean | undefined
      isSubmitting: boolean
      isSubmitted: boolean
      isValid: boolean
      isDirty: boolean
      isValidating: boolean
      submitCount: number
    }
    let releaseValidation!: () => void
    let releaseSubmission!: () => void
    const validationWait = new Promise<void>((resolve) => {
      releaseValidation = resolve
    })
    const submissionWait = new Promise<void>((resolve) => {
      releaseSubmission = resolve
    })

    function SelectedState({ currentForm }: { currentForm: UseFormReturn<TestValues> }) {
      selected = currentForm.useFormState(
        (state) => ({
          email: state.values.email,
          emailError: state.errors.email,
          emailTouched: state.touched.email,
          isSubmitting: state.isSubmitting,
          isSubmitted: state.isSubmitted,
          isValid: state.isValid,
          isDirty: state.isDirty,
          isValidating: state.isValidating,
          submitCount: state.submitCount,
        }),
        (previous, next) => JSON.stringify(previous) === JSON.stringify(next)
      )
      return null
    }

    function TestForm() {
      form = useForm({
        initialValues: { email: '', count: 0 },
        validate: {
          email: async () => {
            await validationWait
            return undefined
          },
        },
        onSubmit: async () => submissionWait,
      })
      return <SelectedState currentForm={form} />
    }

    render(<TestForm />)
    expect(selected).toEqual({
      email: '',
      emailError: undefined,
      emailTouched: undefined,
      isSubmitting: false,
      isSubmitted: false,
      isValid: true,
      isDirty: false,
      isValidating: false,
      submitCount: 0,
    })

    act(() => {
      form.batch(() => {
        form.setFieldValue('email', 'user@example.com')
        form.setFieldError('email', 'Invalid')
        form.setFieldTouched('email', true)
      })
    })
    expect(selected).toEqual(expect.objectContaining({
      email: 'user@example.com',
      emailError: 'Invalid',
      emailTouched: true,
      isValid: false,
      isDirty: true,
    }))

    let validationPromise!: Promise<boolean>
    act(() => {
      validationPromise = form.validateField('email')
    })
    expect(selected.isValidating).toBe(true)

    await act(async () => {
      releaseValidation()
      await validationPromise
    })
    expect(selected).toEqual(expect.objectContaining({
      emailError: undefined,
      isValid: true,
      isValidating: false,
    }))

    let submissionPromise!: Promise<void>
    await act(async () => {
      submissionPromise = form.handleSubmit()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(selected).toEqual(expect.objectContaining({
      isSubmitting: true,
      isSubmitted: true,
      submitCount: 1,
    }))

    await act(async () => {
      releaseSubmission()
      await submissionPromise
    })
    expect(selected.isSubmitting).toBe(false)
  })

  it('batches public form operations into one field notification', () => {
    const { result } = renderHook(() =>
      useForm({ initialValues: { email: '', count: 0 }, mode: 'onSubmit' })
    )
    const listener = vi.fn()
    const unsubscribe = result.current.subscribe('email', listener)

    act(() => {
      result.current.batch(() => {
        result.current.setFieldValue('email', 'first@example.com')
        result.current.setFieldValue('email', 'second@example.com')
        result.current.setFieldTouched('email', true)
      })
    })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      value: 'second@example.com',
      touched: true,
    }))
    unsubscribe()
  })

  it('supplies stable server snapshots for both hooks', () => {
    function ServerForm() {
      const form = useForm({ initialValues: { email: 'server@example.com', count: 0 } })
      const email = form.useField('email')
      const isDirty = form.useFormState((state) => state.isDirty)
      return <span>{email.value}:{String(isDirty)}</span>
    }

    const output = renderToString(<ServerForm />)
    expect(output).toContain('server@example.com')
    expect(output).toContain('false')
  })
})
