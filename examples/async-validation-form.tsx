/**
 * Async Validation Example - Debouncing & API validation
 *
 * Demonstrates:
 * - Async validators (username availability check)
 * - Debouncing (prevent API spam)
 * - isValidating state
 * - Race condition handling
 * - Real-world API integration pattern
 */

import { useForm } from '@lpm.dev/neo.react-forms'
import { required, email, minLength, debounceValidator } from '@lpm.dev/neo.react-forms/validators'

interface SignupFormValues {
  username: string
  email: string
  password: string
}

// Simulate API call to check username availability
async function checkUsernameAvailability(username: string): Promise<boolean> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Simulate some taken usernames
  const takenUsernames = ['admin', 'user', 'test', 'john', 'jane']
  return takenUsernames.includes(username.toLowerCase())
}

// Simulate API call to check email availability
async function checkEmailAvailability(email: string): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 800))

  const takenEmails = ['test@example.com', 'admin@example.com']
  return takenEmails.includes(email.toLowerCase())
}

export function AsyncValidationForm() {
  const form = useForm<SignupFormValues>({
    initialValues: {
      username: '',
      email: '',
      password: '',
    },
    validate: {
      // Sync + Async validation with debouncing
      username: async (value) => {
        // Sync validation first (fast fail)
        if (!value) return 'Username is required'
        if (value.length < 3) return 'Username must be at least 3 characters'
        if (!/^[a-zA-Z0-9_]+$/.test(value)) {
          return 'Username must be alphanumeric'
        }

        // Async validation (debounced automatically by form)
        const isTaken = await checkUsernameAvailability(value)
        return isTaken ? 'Username is already taken' : null
      },

      // Email with debounced async validation
      email: debounceValidator(async (value) => {
        // Sync checks
        if (!value) return 'Email is required'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Invalid email address'
        }

        // Async check
        const isTaken = await checkEmailAvailability(value)
        return isTaken ? 'Email is already registered' : null
      }, 500), // Debounce 500ms

      // Regular sync validation
      password: (value) => {
        if (!value) return 'Password is required'
        if (value.length < 8) return 'Password must be at least 8 characters'
        return null
      },
    },
    onSubmit: async (values) => {
      console.log('Form submitted:', values)
      alert('Signup successful! Check console for values.')
    },
  })

  const { Field } = form

  return (
    <form onSubmit={form.handleSubmit} style={{ maxWidth: '500px', margin: '0 auto' }}>
      <h1>Async Validation Example</h1>
      <p style={{ color: '#666' }}>
        Try usernames: <code>admin</code>, <code>user</code>, <code>test</code> (already taken)
        <br />
        Try emails: <code>test@example.com</code>, <code>admin@example.com</code> (already registered)
      </p>

      {/* Username with async validation */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="username" style={{ display: 'block', marginBottom: '5px' }}>
          Username *
          {form.getFieldState('username' as any).isValidating && (
            <span style={{ marginLeft: '10px', color: '#0070f3', fontSize: '14px' }}>
              ⏳ Checking availability...
            </span>
          )}
        </label>
        <Field name="username">
          {(field) => (
            <div>
              <input
                {...field.props}
                id="username"
                placeholder="Enter username"
                style={{
                  width: '100%',
                  padding: '8px',
                  borderColor: field.touched && field.error ? 'red' : field.isValidating ? '#0070f3' : '#ccc',
                  borderWidth: '2px',
                  borderStyle: 'solid',
                }}
              />
              {field.touched && field.error && (
                <div style={{ color: 'red', fontSize: '14px', marginTop: '5px' }}>
                  {field.error}
                </div>
              )}
              {field.touched && !field.error && !field.isValidating && field.value && (
                <div style={{ color: 'green', fontSize: '14px', marginTop: '5px' }}>
                  ✓ Username is available
                </div>
              )}
            </div>
          )}
        </Field>
      </div>

      {/* Email with debounced async validation */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="email" style={{ display: 'block', marginBottom: '5px' }}>
          Email *
          {form.getFieldState('email' as any).isValidating && (
            <span style={{ marginLeft: '10px', color: '#0070f3', fontSize: '14px' }}>
              ⏳ Checking email...
            </span>
          )}
        </label>
        <Field name="email">
          {(field) => (
            <div>
              <input
                {...field.props}
                id="email"
                type="email"
                placeholder="Enter email"
                style={{
                  width: '100%',
                  padding: '8px',
                  borderColor: field.touched && field.error ? 'red' : field.isValidating ? '#0070f3' : '#ccc',
                  borderWidth: '2px',
                  borderStyle: 'solid',
                }}
              />
              {field.touched && field.error && (
                <div style={{ color: 'red', fontSize: '14px', marginTop: '5px' }}>
                  {field.error}
                </div>
              )}
              {field.touched && !field.error && !field.isValidating && field.value && (
                <div style={{ color: 'green', fontSize: '14px', marginTop: '5px' }}>
                  ✓ Email is available
                </div>
              )}
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                ℹ️ Validation is debounced (500ms) - stops after you stop typing
              </div>
            </div>
          )}
        </Field>
      </div>

      {/* Password (sync validation only) */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="password" style={{ display: 'block', marginBottom: '5px' }}>
          Password *
        </label>
        <Field name="password">
          {(field) => (
            <div>
              <input
                {...field.props}
                id="password"
                type="password"
                placeholder="Min 8 characters"
                style={{
                  width: '100%',
                  padding: '8px',
                  borderColor: field.touched && field.error ? 'red' : '#ccc',
                }}
              />
              {field.touched && field.error && (
                <div style={{ color: 'red', fontSize: '14px', marginTop: '5px' }}>
                  {field.error}
                </div>
              )}
            </div>
          )}
        </Field>
      </div>

      {/* Submit */}
      <div style={{ marginTop: '20px' }}>
        <button
          type="submit"
          disabled={form.isSubmitting || !form.isValid || form.isValidating}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: form.isValid && !form.isValidating ? '#0070f3' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: form.isValid && !form.isValidating ? 'pointer' : 'not-allowed',
            width: '100%',
          }}
        >
          {form.isSubmitting
            ? 'Signing up...'
            : form.isValidating
            ? 'Validating...'
            : 'Sign Up'}
        </button>
        {form.isValidating && (
          <div style={{ textAlign: 'center', marginTop: '10px', color: '#0070f3' }}>
            Checking {form.getValidatingFields().join(', ')}...
          </div>
        )}
      </div>

      {/* Debug Info */}
      <details style={{ marginTop: '20px' }}>
        <summary>Debug: Form State</summary>
        <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px', fontSize: '12px' }}>
          {JSON.stringify(
            {
              values: form.values,
              errors: form.errors,
              touched: form.touched,
              isValid: form.isValid,
              isDirty: form.isDirty,
              isValidating: form.isValidating,
              validatingFields: form.getValidatingFields(),
            },
            null,
            2
          )}
        </pre>
      </details>

      {/* Tips */}
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f9ff', borderRadius: '4px' }}>
        <h3 style={{ marginTop: 0 }}>💡 Tips:</h3>
        <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
          <li>Type quickly in username/email - notice validation waits for you to stop</li>
          <li>Try taken usernames/emails to see error messages</li>
          <li>Submit button is disabled while validating</li>
          <li>Blue border indicates field is validating</li>
          <li>Green checkmark shows field is valid after async check</li>
        </ul>
      </div>
    </form>
  )
}
