/**
 * Tests for Field component
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FormStore } from '../../core/store.js'
import { Field } from '../Field.js'

describe('Field', () => {
  describe('rendering', () => {
    it('should render field with initial value', () => {
      const store = new FormStore({ email: 'test@example.com' })

      render(
        <Field name="email" store={store}>
          {(field) => <input data-testid="email" {...field.props} />}
        </Field>
      )

      const input = screen.getByTestId('email') as HTMLInputElement
      expect(input.value).toBe('test@example.com')
    })

    it('should render nested field value', () => {
      const store = new FormStore({
        user: {
          profile: {
            name: 'John',
          },
        },
      })

      render(
        <Field name="user.profile.name" store={store}>
          {(field) => <input data-testid="name" {...field.props} />}
        </Field>
      )

      const input = screen.getByTestId('name') as HTMLInputElement
      expect(input.value).toBe('John')
    })

    it('should provide field state in render props', () => {
      const store = new FormStore({ email: '' })
      store.setError('email', 'Invalid')
      store.setTouched('email', true)

      const renderFn = vi.fn((field) => (
        <div data-testid="field-state">
          {JSON.stringify({
            value: field.value,
            error: field.error,
            touched: field.touched,
            dirty: field.dirty,
          })}
        </div>
      ))

      render(
        <Field name="email" store={store}>
          {renderFn}
        </Field>
      )

      expect(renderFn).toHaveBeenCalled()
      const call = renderFn.mock.calls[0]?.[0]
      expect(call).toMatchObject({
        value: '',
        error: 'Invalid',
        touched: true,
        dirty: false,
      })
    })
  })

  describe('value updates', () => {
    it('should update value on change', () => {
      const store = new FormStore({ email: '' })

      render(
        <Field name="email" store={store}>
          {(field) => <input data-testid="email" {...field.props} />}
        </Field>
      )

      const input = screen.getByTestId('email')
      fireEvent.change(input, { target: { value: 'test@example.com' } })

      expect(store.getValue('email')).toBe('test@example.com')
    })

    it('should mark field as touched on blur', () => {
      const store = new FormStore({ email: '' })

      render(
        <Field name="email" store={store}>
          {(field) => <input data-testid="email" {...field.props} />}
        </Field>
      )

      const input = screen.getByTestId('email')
      fireEvent.blur(input)

      expect(store.getTouched('email')).toBe(true)
    })

    it('should update field state in render props', () => {
      const store = new FormStore({ email: '' })

      const { rerender } = render(
        <Field name="email" store={store}>
          {(field) => (
            <div>
              <input data-testid="email" {...field.props} />
              <div data-testid="value">{field.value}</div>
            </div>
          )}
        </Field>
      )

      const input = screen.getByTestId('email')
      fireEvent.change(input, { target: { value: 'new@example.com' } })

      // Force re-render to see updated value
      rerender(
        <Field name="email" store={store}>
          {(field) => (
            <div>
              <input data-testid="email" {...field.props} />
              <div data-testid="value">{field.value}</div>
            </div>
          )}
        </Field>
      )

      expect(screen.getByTestId('value').textContent).toBe('new@example.com')
    })
  })

  describe('field-level subscriptions', () => {
    it('should only re-render when subscribed field changes', () => {
      const store = new FormStore({ email: '', password: '' })
      const emailRender = vi.fn((field) => <input data-testid="email" {...field.props} />)
      const passwordRender = vi.fn((field) => <input data-testid="password" {...field.props} />)

      render(
        <div>
          <Field name="email" store={store}>
            {emailRender}
          </Field>
          <Field name="password" store={store}>
            {passwordRender}
          </Field>
        </div>
      )

      // Initial renders
      expect(emailRender).toHaveBeenCalledTimes(1)
      expect(passwordRender).toHaveBeenCalledTimes(1)

      // Change email - should NOT re-render password field
      const emailInput = screen.getByTestId('email')
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })

      // Email field re-renders due to subscription
      expect(emailRender).toHaveBeenCalledTimes(2)
      // Password field does NOT re-render (field isolation!)
      expect(passwordRender).toHaveBeenCalledTimes(1)
    })
  })

  describe('validation', () => {
    it('should validate field on blur when mode is onBlur', async () => {
      const store = new FormStore({ email: '' })
      const validate = vi.fn((value: string) => (!value ? 'Required' : null))

      render(
        <Field name="email" store={store} validate={validate} mode="onBlur">
          {(field) => (
            <div>
              <input data-testid="email" {...field.props} />
              {field.error && <div data-testid="error">{field.error}</div>}
            </div>
          )}
        </Field>
      )

      const input = screen.getByTestId('email')
      fireEvent.blur(input)

      await waitFor(() => {
        expect(validate).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(store.getError('email')).toBe('Required')
      })
    })

    it('should validate field on change when reValidateMode is onChange', async () => {
      const store = new FormStore({ email: '' })
      const validate = vi.fn((value: string) => (!value ? 'Required' : null))

      // First trigger validation
      store.setError('email', 'Required')

      render(
        <Field name="email" store={store} validate={validate} reValidateMode="onChange">
          {(field) => <input data-testid="email" {...field.props} />}
        </Field>
      )

      const input = screen.getByTestId('email')
      fireEvent.change(input, { target: { value: 'test@example.com' } })

      await waitFor(() => {
        expect(validate).toHaveBeenCalledWith('test@example.com')
      })

      await waitFor(() => {
        expect(store.getError('email')).toBeUndefined()
      })
    })

    it('should support async validation', async () => {
      const store = new FormStore({ username: 'taken' })
      const validate = vi.fn(async (value: string) => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return value === 'taken' ? 'Username taken' : null
      })

      render(
        <Field name="username" store={store} validate={validate} mode="onBlur">
          {(field) => <input data-testid="username" {...field.props} />}
        </Field>
      )

      const input = screen.getByTestId('username')
      fireEvent.blur(input)

      await waitFor(() => {
        expect(validate).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(store.getError('username')).toBe('Username taken')
      })
    })
  })

  describe('render props API', () => {
    it('should provide setValue function', () => {
      const store = new FormStore({ email: '' })

      render(
        <Field name="email" store={store}>
          {(field) => (
            <button data-testid="set-value" onClick={() => field.setValue('test@example.com')}>
              Set Value
            </button>
          )}
        </Field>
      )

      const button = screen.getByTestId('set-value')
      fireEvent.click(button)

      expect(store.getValue('email')).toBe('test@example.com')
    })

    it('should provide setError function', () => {
      const store = new FormStore({ email: '' })

      render(
        <Field name="email" store={store}>
          {(field) => (
            <button data-testid="set-error" onClick={() => field.setError('Custom error')}>
              Set Error
            </button>
          )}
        </Field>
      )

      const button = screen.getByTestId('set-error')
      fireEvent.click(button)

      expect(store.getError('email')).toBe('Custom error')
    })

    it('should provide setTouched function', () => {
      const store = new FormStore({ email: '' })

      render(
        <Field name="email" store={store}>
          {(field) => (
            <button data-testid="set-touched" onClick={() => field.setTouched(true)}>
              Set Touched
            </button>
          )}
        </Field>
      )

      const button = screen.getByTestId('set-touched')
      fireEvent.click(button)

      expect(store.getTouched('email')).toBe(true)
    })

    it('should provide validate function', async () => {
      const store = new FormStore({ email: '' })
      const validate = vi.fn((value: string) => (!value ? 'Required' : null))

      render(
        <Field name="email" store={store} validate={validate}>
          {(field) => (
            <button data-testid="validate" onClick={() => field.validate()}>
              Validate
            </button>
          )}
        </Field>
      )

      const button = screen.getByTestId('validate')
      fireEvent.click(button)

      await waitFor(() => {
        expect(validate).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(store.getError('email')).toBe('Required')
      })
    })
  })
})
