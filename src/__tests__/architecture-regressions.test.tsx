import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FormStore } from '../core/store.js'
import { useForm, type UseFormReturn } from '../index.js'

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('findings 9-11 architecture regressions', () => {
  it('keeps the form owner and unrelated bound fields out of a field update', () => {
    let formRenders = 0
    let emailRenders = 0
    let passwordRenders = 0

    function TestForm() {
      formRenders++
      const form = useForm({
        initialValues: { email: '', password: '' },
      })

      return (
        <>
          <form.Field name="email">
            {({ props }) => {
              emailRenders++
              return <input data-testid="isolated-email" {...props} />
            }}
          </form.Field>
          <form.Field name="password">
            {({ props }) => {
              passwordRenders++
              return <input data-testid="isolated-password" {...props} />
            }}
          </form.Field>
        </>
      )
    }

    render(<TestForm />)
    fireEvent.change(screen.getByTestId('isolated-email'), {
      target: { value: 'next@example.com' },
    })

    expect(formRenders).toBe(1)
    expect(emailRenders).toBe(2)
    expect(passwordRenders).toBe(1)
  })

  it('reacts only when an observed form-state slice changes', () => {
    type Values = { first: string; second: string }
    let form: UseFormReturn<Values> | undefined
    let renders = 0

    function DirtyProbe() {
      renders++
      form = useForm({ initialValues: { first: '', second: '' } })
      return <span data-testid="dirty-state">{String(form.isDirty)}</span>
    }

    render(<DirtyProbe />)

    act(() => form?.setFieldValue('first', 'changed'))
    expect(screen.getByTestId('dirty-state').textContent).toBe('true')
    expect(renders).toBe(2)

    // The values slice changed, but the observed dirty boolean stayed true.
    act(() => form?.setFieldValue('second', 'also changed'))
    act(() => form?.setFieldValue('first', ''))
    expect(renders).toBe(2)

    act(() => form?.setFieldValue('second', ''))
    expect(screen.getByTestId('dirty-state').textContent).toBe('false')
    expect(renders).toBe(3)
  })

  it('tracks nested dirty paths without serializing the whole form', () => {
    const store = new FormStore({
      profile: { amount: 1n, birthday: new Date('2000-01-01') },
    })

    expect(store.isDirty()).toBe(false)
    expect(store.getFieldState('profile').dirty).toBe(false)

    store.setValue('profile.amount', 2n)
    expect(store.isDirty()).toBe(true)
    expect(store.getFieldState('profile').dirty).toBe(true)
    expect(store.getFieldState('profile.birthday').dirty).toBe(false)

    store.setValue('profile.birthday', new Date('2000-01-01'))
    expect(store.getFieldState('profile.birthday').dirty).toBe(false)

    store.setValue('profile.amount', 1n)
    expect(store.isDirty()).toBe(false)
    expect(store.getFieldState('profile').dirty).toBe(false)
  })

  it('resolves computed dependencies once, in any declaration order', () => {
    type Values = {
      first: string
      last: string
      note: string
      fullName: string
      greeting: string
    }
    const computeFullName = vi.fn(
      (values: Values) => `${values.first} ${values.last}`.trim()
    )
    const computeGreeting = vi.fn(
      (values: Values) => `Hello ${values.fullName}`
    )
    const store = new FormStore<Values>(
      { first: 'Ada', last: 'Lovelace', note: '', fullName: '', greeting: '' },
      {
        // Intentionally declared before its computed dependency.
        greeting: computeGreeting,
        fullName: computeFullName,
      }
    )
    const fullNameSubscriber = vi.fn()
    const greetingSubscriber = vi.fn()
    store.subscribe('fullName', fullNameSubscriber)
    store.subscribe('greeting', greetingSubscriber)

    expect(store.getValue('fullName')).toBe('Ada Lovelace')
    expect(store.getValue('greeting')).toBe('Hello Ada Lovelace')
    expect(computeFullName).toHaveBeenCalledTimes(1)
    expect(computeGreeting).toHaveBeenCalledTimes(1)

    store.setValue('note', 'unrelated')
    expect(computeFullName).toHaveBeenCalledTimes(1)
    expect(computeGreeting).toHaveBeenCalledTimes(1)
    expect(fullNameSubscriber).not.toHaveBeenCalled()
    expect(greetingSubscriber).not.toHaveBeenCalled()

    store.setValue('first', 'Grace')
    expect(store.getValue('fullName')).toBe('Grace Lovelace')
    expect(store.getValue('greeting')).toBe('Hello Grace Lovelace')
    expect(computeFullName).toHaveBeenCalledTimes(2)
    expect(computeGreeting).toHaveBeenCalledTimes(2)
    expect(fullNameSubscriber).toHaveBeenCalledTimes(1)
    expect(greetingSubscriber).toHaveBeenCalledTimes(1)
  })

  it('rejects circular or mutating computed definitions atomically', () => {
    type Values = {
      enabled: boolean
      first: string
      second: string
      nested: { value: string }
      copy: string
    }
    const circular = new FormStore<Values>(
      {
        enabled: false,
        first: 'first',
        second: 'second',
        nested: { value: 'safe' },
        copy: '',
      },
      {
        first: (values) => (values.enabled ? values.second : 'first'),
        second: (values) => (values.enabled ? values.first : 'second'),
        copy: (values) => values.nested.value,
      }
    )

    expect(() => circular.setValue('enabled', true)).toThrow(
      'Circular computed field dependency'
    )
    expect(circular.getValue('enabled')).toBe(false)
    expect(circular.getValue('first')).toBe('first')

    expect(
      () =>
        new FormStore(
          { nested: { value: 'safe' }, result: '' },
          {
            result: (values) => {
              values.nested.value = 'mutated'
              return values.nested.value
            },
          }
        )
    ).toThrow('Computed fields must not mutate form values')
  })

  it('deduplicates field and global notifications inside a transaction', () => {
    const store = new FormStore({ first: '', second: '', third: '' })
    const globalSubscriber = vi.fn()
    const firstSubscriber = vi.fn()
    store.subscribeToStore(globalSubscriber)
    store.subscribe('first', firstSubscriber)

    let firstController!: AbortController
    let secondController!: AbortController
    let thirdController!: AbortController
    store.batch(() => {
      firstController = store.startValidation('first')
      secondController = store.startValidation('second')
      thirdController = store.startValidation('third')
      store.setError('first', 'Required')
      store.setTouched('first', true)
    })

    expect(globalSubscriber).toHaveBeenCalledTimes(1)
    expect(firstSubscriber).toHaveBeenCalledTimes(1)
    expect(globalSubscriber.mock.calls[0]?.[0]).toEqual(
      new Set(['validating', 'errors', 'valid', 'touched'])
    )

    store.batch(() => {
      store.endValidation('first', firstController)
      store.endValidation('second', secondController)
      store.endValidation('third', thirdController)
      store.setError('first', undefined)
    })

    expect(globalSubscriber).toHaveBeenCalledTimes(2)
    expect(firstSubscriber).toHaveBeenCalledTimes(2)
  })

  it('publishes whole-form validation as one start and one completion update', async () => {
    const firstValidation = deferred<string | null>()
    const secondValidation = deferred<string | null>()
    let form: UseFormReturn<{ first: string; second: string }> | undefined
    let renders = 0

    function ValidationProbe() {
      renders++
      form = useForm({
        initialValues: { first: '', second: '' },
        validate: {
          first: () => firstValidation.promise,
          second: () => secondValidation.promise,
        },
      })
      return (
        <span data-testid="validation-state">
          {String(form.isValidating)}:{Object.keys(form.errors).length}
        </span>
      )
    }

    render(<ValidationProbe />)
    let validation!: Promise<boolean>
    act(() => {
      validation = form!.validate()
    })

    await waitFor(() => {
      expect(screen.getByTestId('validation-state').textContent).toBe('true:0')
    })
    expect(renders).toBe(2)

    await act(async () => {
      firstValidation.resolve('First required')
      secondValidation.resolve('Second required')
      await validation
    })

    expect(screen.getByTestId('validation-state').textContent).toBe('false:2')
    expect(renders).toBe(3)
  })
})
