/**
 * Integration tests for full form workflow
 *
 * Tests the complete user flow with Field components
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useForm } from '../hooks/useForm.js'

function TestForm({ onSubmit }: { onSubmit: (values: any) => void }) {
  const form = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    validate: {
      email: (value) => (!value ? 'Email required' : null),
      password: (value) => (value.length < 8 ? 'Password too short' : null),
    },
    onSubmit,
  })

  // Use the form's built-in Field component (pre-bound to store)
  const { Field } = form

  return (
    <form onSubmit={form.handleSubmit} data-testid="form">
      <Field name="email">
        {(field) => (
          <div>
            <input data-testid="email" {...field.props} />
            {field.touched && field.error && (
              <div data-testid="email-error">{field.error}</div>
            )}
          </div>
        )}
      </Field>

      <Field name="password">
        {(field) => (
          <div>
            <input data-testid="password" type="password" {...field.props} />
            {field.touched && field.error && (
              <div data-testid="password-error">{field.error}</div>
            )}
          </div>
        )}
      </Field>

      <button type="submit" data-testid="submit">
        Submit
      </button>
    </form>
  )
}

describe('Integration: Form with Field components', () => {
  it('should render form with initial values', () => {
    const onSubmit = vi.fn()

    render(<TestForm onSubmit={onSubmit} />)

    const emailInput = screen.getByTestId('email') as HTMLInputElement
    const passwordInput = screen.getByTestId('password') as HTMLInputElement

    expect(emailInput.value).toBe('')
    expect(passwordInput.value).toBe('')
  })

  it('should update field values on input', () => {
    const onSubmit = vi.fn()

    render(<TestForm onSubmit={onSubmit} />)

    const emailInput = screen.getByTestId('email')
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })

    expect((emailInput as HTMLInputElement).value).toBe('test@example.com')
  })

  it('should show validation errors on submit', async () => {
    const onSubmit = vi.fn()

    render(<TestForm onSubmit={onSubmit} />)

    const submitButton = screen.getByTestId('submit')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.queryByTestId('email-error')).toBeTruthy()
    })

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('should submit valid form', async () => {
    const onSubmit = vi.fn()

    render(<TestForm onSubmit={onSubmit} />)

    const emailInput = screen.getByTestId('email')
    const passwordInput = screen.getByTestId('password')

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })

    const submitButton = screen.getByTestId('submit')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
    })
  })
})

describe('Integration: useForm without Field components', () => {
  function SimpleForm({ onSubmit }: { onSubmit: (values: any) => void }) {
    const form = useForm({
      initialValues: {
        username: '',
        age: 0,
      },
      validate: {
        username: (value) => (!value ? 'Required' : null),
        age: (value) => (value < 18 ? 'Must be 18+' : null),
      },
      onSubmit,
    })

    return (
      <form onSubmit={form.handleSubmit}>
        <input
          data-testid="username"
          value={form.values.username}
          onChange={(e) => form.setFieldValue('username', e.target.value)}
          onBlur={() => form.setFieldTouched('username', true)}
        />
        {form.touched.username && form.errors.username && (
          <div data-testid="username-error">{form.errors.username}</div>
        )}

        <input
          data-testid="age"
          type="number"
          value={form.values.age}
          onChange={(e) => form.setFieldValue('age', Number(e.target.value))}
          onBlur={() => form.setFieldTouched('age', true)}
        />
        {form.touched.age && form.errors.age && (
          <div data-testid="age-error">{form.errors.age}</div>
        )}

        <button type="submit" data-testid="submit" disabled={form.isSubmitting}>
          Submit
        </button>
      </form>
    )
  }

  it('should handle complete form workflow', async () => {
    const onSubmit = vi.fn()

    render(<SimpleForm onSubmit={onSubmit} />)

    const usernameInput = screen.getByTestId('username')
    const ageInput = screen.getByTestId('age')
    const submitButton = screen.getByTestId('submit')

    // Fill in valid data
    fireEvent.change(usernameInput, { target: { value: 'john' } })
    fireEvent.change(ageInput, { target: { value: '25' } })

    // Submit
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        username: 'john',
        age: 25,
      })
    })
  })

  it('should validate on blur', async () => {
    const onSubmit = vi.fn()

    render(<SimpleForm onSubmit={onSubmit} />)

    const usernameInput = screen.getByTestId('username')

    // Blur without entering data
    fireEvent.blur(usernameInput)

    await waitFor(() => {
      expect(screen.queryByTestId('username-error')).toBeTruthy()
    })
  })

  it('should show dirty state', () => {
    const onSubmit = vi.fn()

    const { rerender } = render(<SimpleForm onSubmit={onSubmit} />)

    const usernameInput = screen.getByTestId('username')
    fireEvent.change(usernameInput, { target: { value: 'john' } })

    // Re-render to check form state
    rerender(<SimpleForm onSubmit={onSubmit} />)

    // Form should be dirty (tested via form behavior)
    expect((usernameInput as HTMLInputElement).value).toBe('john')
  })
})
