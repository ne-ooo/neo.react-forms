/**
 * Basic form example with @lpm.dev/neo.react-forms
 *
 * Demonstrates:
 * - Perfect TypeScript inference from initialValues
 * - Field-level validation
 * - Form submission
 * - Error handling
 */

import { useForm } from '../src/index.js'

export function BasicFormExample() {
  const form = useForm({
    initialValues: {
      email: '',
      password: '',
      profile: {
        firstName: '',
        lastName: '',
        age: 0,
      },
    },
    validate: {
      email: (value) => {
        if (!value) return 'Email is required'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email'
        return null
      },
      password: [
        (value) => (!value ? 'Password is required' : null),
        (value) => (value.length < 8 ? 'Password must be at least 8 characters' : null),
      ],
      profile: {
        firstName: (value) => (!value ? 'First name is required' : null),
        lastName: (value) => (!value ? 'Last name is required' : null),
        age: (value) => (value < 18 ? 'Must be 18 or older' : null),
      },
    },
    validateForm: (values) => {
      // Form-level validation (cross-field)
      if (values.email && values.password && values.email === values.password) {
        return {
          password: 'Password cannot be the same as email',
        }
      }
      return null
    },
    onSubmit: async (values) => {
      console.log('Form submitted:', values)
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      alert('Form submitted successfully!')
    },
    onSubmitError: (error) => {
      console.error('Submission error:', error)
      alert('Submission failed!')
    },
  })

  return (
    <form onSubmit={form.handleSubmit}>
      <h2>Registration Form</h2>

      {/* Email field */}
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={form.values.email}
          onChange={(e) => form.setFieldValue('email', e.target.value)}
          onBlur={() => form.setFieldTouched('email', true)}
        />
        {form.touched.email && form.errors.email && (
          <div style={{ color: 'red' }}>{form.errors.email}</div>
        )}
      </div>

      {/* Password field */}
      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={form.values.password}
          onChange={(e) => form.setFieldValue('password', e.target.value)}
          onBlur={() => form.setFieldTouched('password', true)}
        />
        {form.touched.password && form.errors.password && (
          <div style={{ color: 'red' }}>{form.errors.password}</div>
        )}
      </div>

      {/* Nested fields */}
      <div>
        <label htmlFor="firstName">First Name</label>
        <input
          id="firstName"
          // Perfect TypeScript inference! ✨
          value={form.values.profile.firstName}
          onChange={(e) => form.setFieldValue('profile.firstName', e.target.value)}
          onBlur={() => form.setFieldTouched('profile.firstName', true)}
        />
        {form.touched['profile.firstName'] && form.errors['profile.firstName'] && (
          <div style={{ color: 'red' }}>{form.errors['profile.firstName']}</div>
        )}
      </div>

      <div>
        <label htmlFor="lastName">Last Name</label>
        <input
          id="lastName"
          value={form.values.profile.lastName}
          onChange={(e) => form.setFieldValue('profile.lastName', e.target.value)}
          onBlur={() => form.setFieldTouched('profile.lastName', true)}
        />
        {form.touched['profile.lastName'] && form.errors['profile.lastName'] && (
          <div style={{ color: 'red' }}>{form.errors['profile.lastName']}</div>
        )}
      </div>

      <div>
        <label htmlFor="age">Age</label>
        <input
          id="age"
          type="number"
          value={form.values.profile.age}
          onChange={(e) => form.setFieldValue('profile.age', Number(e.target.value))}
          onBlur={() => form.setFieldTouched('profile.age', true)}
        />
        {form.touched['profile.age'] && form.errors['profile.age'] && (
          <div style={{ color: 'red' }}>{form.errors['profile.age']}</div>
        )}
      </div>

      {/* Form actions */}
      <div>
        <button type="submit" disabled={form.isSubmitting}>
          {form.isSubmitting ? 'Submitting...' : 'Submit'}
        </button>
        <button
          type="button"
          onClick={() => form.reset()}
          disabled={!form.isDirty}
        >
          Reset
        </button>
      </div>

      {/* Form state debug */}
      <details>
        <summary>Form State (Debug)</summary>
        <pre>
          {JSON.stringify(
            {
              values: form.values,
              errors: form.errors,
              touched: form.touched,
              isDirty: form.isDirty,
              isValid: form.isValid,
              isSubmitting: form.isSubmitting,
              submitCount: form.submitCount,
            },
            null,
            2
          )}
        </pre>
      </details>
    </form>
  )
}
