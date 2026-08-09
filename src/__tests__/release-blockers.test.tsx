import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { FieldArray, type FieldArrayRenderProps } from '../components/FieldArray.js'
import { FormStore, setValueByPath } from '../core/store.js'
import { useForm } from '../hooks/useForm.js'

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('release-blocker regressions', () => {
  it('returns a stable field snapshot until field state changes', () => {
    const store = new FormStore({ email: '' })
    const first = store.getFieldState('email')

    expect(store.getFieldState('email')).toBe(first)

    store.setValue('email', 'next@example.com')
    const changed = store.getFieldState('email')
    expect(changed).not.toBe(first)
    expect(store.getFieldState('email')).toBe(changed)
  })

  it('supplies server snapshots for useForm, Field, and FieldArray', () => {
    function ServerForm() {
      const form = useForm({
        initialValues: { email: '', users: [{ name: 'Ada' }] },
      })

      return (
        <form>
          <form.Field name="email">
            {({ props }) => <input {...props} />}
          </form.Field>
          <form.FieldArray name="users">
            {({ fields }) => <span>{fields[0]?.value.name}</span>}
          </form.FieldArray>
        </form>
      )
    }

    expect(() => renderToString(<ServerForm />)).not.toThrow()
  })

  it('connects a bound Field to the form validation schema', async () => {
    function TestForm() {
      const form = useForm({
        initialValues: { email: '' },
        mode: 'onBlur',
        validate: {
          email: (value) => (!value ? 'Email required' : null),
        },
      })

      return (
        <form.Field name="email">
          {({ props, touched, error }) => (
            <>
              <input data-testid="bound-email" {...props} />
              {touched && error ? <span>{error}</span> : null}
            </>
          )}
        </form.Field>
      )
    }

    render(<TestForm />)
    fireEvent.blur(screen.getByTestId('bound-email'))

    expect(await screen.findByText('Email required')).toBeTruthy()
  })

  it('honors onSubmit mode without validating on blur', async () => {
    const validate = vi.fn((value: string) => (!value ? 'Required' : null))

    function TestForm() {
      const form = useForm({
        initialValues: { email: '' },
        mode: 'onSubmit',
        validate: { email: validate },
      })

      return (
        <form onSubmit={form.handleSubmit}>
          <form.Field name="email">
            {({ props }) => <input data-testid="submit-only-email" {...props} />}
          </form.Field>
          <button type="submit">Validate</button>
        </form>
      )
    }

    render(<TestForm />)
    fireEvent.blur(screen.getByTestId('submit-only-email'))
    await Promise.resolve()
    expect(validate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Validate' }))
    await waitFor(() => expect(validate).toHaveBeenCalledTimes(1))
  })

  it('uses reValidateMode instead of the initial mode after first validation', async () => {
    const validate = vi.fn((value: string) => (!value ? 'Required' : null))

    function TestForm() {
      const form = useForm({
        initialValues: { email: '' },
        mode: 'onBlur',
        reValidateMode: 'onChange',
        validate: { email: validate },
      })

      return (
        <form.Field name="email">
          {({ props }) => <input data-testid="revalidate-email" {...props} />}
        </form.Field>
      )
    }

    render(<TestForm />)
    const input = screen.getByTestId('revalidate-email')

    fireEvent.blur(input)
    await waitFor(() => expect(validate).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('revalidate-email')).toBe(input)

    fireEvent.blur(input)
    await Promise.resolve()
    expect(validate).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByTestId('revalidate-email'), {
      target: { value: 'valid' },
    })
    await waitFor(() => expect(validate).toHaveBeenCalledTimes(2))
  })

  it('validates the next value rather than the previous render value', async () => {
    const validate = vi.fn((value: string) => (value === 'next' ? null : 'Stale value'))

    function TestForm() {
      const form = useForm({
        initialValues: { name: '' },
        mode: 'onChange',
        validate: { name: validate },
      })

      return (
        <form.Field name="name">
          {({ props }) => <input data-testid="name" {...props} />}
        </form.Field>
      )
    }

    render(<TestForm />)
    fireEvent.change(screen.getByTestId('name'), { target: { value: 'next' } })

    await waitFor(() => expect(validate).toHaveBeenCalledWith(
      'next',
      expect.any(Object),
      expect.objectContaining({ name: 'name' })
    ))
  })

  it('touches invalid fields during submission so documented errors render', async () => {
    function TestForm() {
      const form = useForm({
        initialValues: { email: '' },
        validate: { email: (value) => (!value ? 'Email required' : null) },
      })

      return (
        <form onSubmit={form.handleSubmit}>
          <form.Field name="email">
            {({ props, touched, error }) => (
              <>
                <input data-testid="submit-email" {...props} />
                {touched && error ? <span>{error}</span> : null}
              </>
            )}
          </form.Field>
          <button type="submit">Submit</button>
        </form>
      )
    }

    render(<TestForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Email required')).toBeTruthy()
  })

  it('does not let stale async validation overwrite the latest result', async () => {
    const first = deferred<string | null>()
    const second = deferred<string | null>()
    const validator = vi
      .fn((_value: string) => first.promise)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const { result } = renderHook(() =>
      useForm({
        initialValues: { username: 'old' },
        reValidateMode: 'onSubmit',
        validate: { username: validator },
      })
    )

    let firstRun!: Promise<boolean>
    let secondRun!: Promise<boolean>
    act(() => {
      firstRun = result.current.validateField('username')
    })
    act(() => {
      result.current.setFieldValue('username', 'new')
      secondRun = result.current.validateField('username')
    })

    await act(async () => {
      second.resolve(null)
      await secondRun
    })
    await act(async () => {
      first.resolve('Stale error')
      await firstRun
    })

    expect(result.current.errors.username).toBeUndefined()
    expect(result.current.isValidating).toBe(false)
  })

  it('cancels pending validation during reset', async () => {
    const pending = deferred<string | null>()
    const { result } = renderHook(() =>
      useForm({
        initialValues: { username: '' },
        validate: { username: () => pending.promise },
      })
    )

    let validation!: Promise<boolean>
    act(() => {
      validation = result.current.validateField('username')
    })
    act(() => result.current.reset())

    await act(async () => {
      pending.resolve('Stale error')
      await validation
    })

    expect(result.current.errors).toEqual({})
    expect(result.current.isValidating).toBe(false)
  })

  it('preserves arrays when setting a nested array-item path', () => {
    const original = { users: [{ name: 'Ada' }, { name: 'Grace' }] }
    const updated = setValueByPath(original, 'users.0.name', 'Augusta')

    expect(Array.isArray(updated.users)).toBe(true)
    expect(updated.users).toEqual([{ name: 'Augusta' }, { name: 'Grace' }])
    expect(original.users[0]?.name).toBe('Ada')
  })

  it('rejects prototype-polluting field paths', () => {
    expect(() =>
      setValueByPath({ safe: true }, '__proto__.polluted', true)
    ).toThrow('Unsafe form field path')
    expect(() =>
      setValueByPath({ safe: true }, 'constructor.prototype.polluted', true)
    ).toThrow('Unsafe form field path')
    expect((Object.prototype as { polluted?: boolean }).polluted).toBeUndefined()
  })

  it('notifies parent and child subscriptions for overlapping path updates', () => {
    const store = new FormStore({ users: [{ name: 'Ada' }] })
    const parent = vi.fn()
    const child = vi.fn()
    store.subscribe('users', parent)
    store.subscribe('users.0.name', child)

    store.setValue('users.0.name', 'Grace')
    expect(parent).toHaveBeenCalledTimes(1)
    expect(child).toHaveBeenCalledTimes(1)

    parent.mockClear()
    child.mockClear()
    store.setValue('users', [{ name: 'Linus' }])
    expect(parent).toHaveBeenCalledTimes(1)
    expect(child).toHaveBeenCalledTimes(1)
  })

  it('resolves and runs nested array-item validation schemas', async () => {
    const { result } = renderHook(() =>
      useForm({
        initialValues: { users: [{ name: '' }, { name: 'Grace' }] },
        validate: {
          users: {
            name: (value) => (!value ? 'Name required' : null),
          },
        },
      })
    )

    await act(async () => {
      expect(await result.current.validateField('users.0.name')).toBe(false)
    })
    expect(result.current.errors['users.0.name']).toBe('Name required')

    await act(async () => {
      expect(await result.current.validate()).toBe(false)
    })
    expect(result.current.errors['users.0.name']).toBe('Name required')
    expect(result.current.errors['users.1.name']).toBeUndefined()
  })

  it('moves FieldArray keys and indexed state with their logical items', () => {
    type Values = { users: Array<{ name: string }> }
    const store = new FormStore<Values>({
      users: [{ name: 'Ada' }, { name: 'Grace' }, { name: 'Linus' }],
    })
    store.setError('users.0.name', 'Ada error')
    store.setError('users.1.name', 'Grace error')
    store.setTouched('users.2.name', true)

    let latest: FieldArrayRenderProps<{ name: string }> | undefined
    render(
      <FieldArray name="users" store={store}>
        {(props) => {
          latest = props
          return <span>{props.fields.map((field) => field.value.name).join(',')}</span>
        }}
      </FieldArray>
    )

    const initialKeys = latest?.fields.map((field) => field.key) ?? []
    act(() => latest?.helpers.move(0, 2))

    expect(latest?.fields.map((field) => field.value.name)).toEqual([
      'Grace',
      'Linus',
      'Ada',
    ])
    expect(latest?.fields.map((field) => field.key)).toEqual([
      initialKeys[1],
      initialKeys[2],
      initialKeys[0],
    ])
    expect(store.getError('users.0.name')).toBe('Grace error')
    expect(store.getError('users.2.name')).toBe('Ada error')
    expect(store.getTouched('users.1.name')).toBe(true)
  })

  it('parses number and checkbox controls without storing strings', () => {
    let currentValues: { age: number | undefined; active: boolean } | undefined

    function InputForm() {
      const form = useForm({
        initialValues: { age: undefined as number | undefined, active: false },
      })
      currentValues = form.values

      return (
        <>
          <form.Field name="age" inputType="number">
            {({ props }) => <input data-testid="age" type="number" {...props} />}
          </form.Field>
          <form.Field name="active" inputType="checkbox">
            {({ props }) => <input data-testid="active" type="checkbox" {...props} />}
          </form.Field>
        </>
      )
    }

    render(<InputForm />)
    fireEvent.change(screen.getByTestId('age'), { target: { value: '42' } })
    fireEvent.click(screen.getByTestId('active'))

    expect(currentValues?.age).toBe(42)
    expect(currentValues?.active).toBe(true)
  })

  it('locks submission before asynchronous validation can allow a duplicate submit', async () => {
    const submission = deferred<void>()
    const onSubmit = vi.fn(() => submission.promise)
    const { result } = renderHook(() =>
      useForm({ initialValues: { email: 'test@example.com' }, onSubmit })
    )

    let firstSubmit!: Promise<void>
    let duplicateSubmit!: Promise<void>
    act(() => {
      firstSubmit = result.current.handleSubmit()
      duplicateSubmit = result.current.handleSubmit()
    })

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(result.current.isSubmitting).toBe(true)

    await act(async () => {
      submission.resolve()
      await Promise.all([firstSubmit, duplicateSubmit])
    })

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(result.current.isSubmitting).toBe(false)
  })

  it('does not submit when a newer field validation supersedes form validation', async () => {
    const formValidation = deferred<string | null>()
    const fieldValidation = deferred<string | null>()
    const validator = vi
      .fn()
      .mockReturnValueOnce(formValidation.promise)
      .mockReturnValueOnce(fieldValidation.promise)
    const onSubmit = vi.fn()
    const { result } = renderHook(() =>
      useForm({
        initialValues: { email: 'test@example.com' },
        validate: { email: validator },
        onSubmit,
      })
    )

    let submission!: Promise<void>
    let latestValidation!: Promise<boolean>
    act(() => {
      submission = result.current.handleSubmit()
      latestValidation = result.current.validateField('email')
    })

    await act(async () => {
      formValidation.resolve(null)
      await submission
    })
    expect(onSubmit).not.toHaveBeenCalled()

    await act(async () => {
      fieldValidation.resolve(null)
      await latestValidation
    })
  })
})
