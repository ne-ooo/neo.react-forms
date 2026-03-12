/**
 * Validators Example - Tree-shakeable validation
 *
 * Demonstrates:
 * - String validators (required, email, minLength, pattern)
 * - Number validators (min, max, positive)
 * - Composition (compose, optional, when)
 * - Custom validators
 * - Perfect TypeScript inference
 */

import { useForm } from '@lpm.dev/neo.react-forms'
import {
  required,
  email,
  minLength,
  maxLength,
  pattern,
  alphanumeric,
  min,
  max,
  between,
  positive,
  integer,
  compose,
  optional,
  when,
  custom,
  equals,
} from '@lpm.dev/neo.react-forms/validators'

interface SignupFormValues {
  username: string
  email: string
  password: string
  confirmPassword: string
  age: number
  bio: string
  website: string
  promoCode: string
  agreeToTerms: boolean
}

export function SignupForm() {
  const form = useForm<SignupFormValues>({
    initialValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      age: 0,
      bio: '',
      website: '',
      promoCode: '',
      agreeToTerms: false,
    },
    validate: {
      // String validators
      username: compose([
        required('Username is required'),
        minLength(3, 'Username must be at least 3 characters'),
        maxLength(20, 'Username must not exceed 20 characters'),
        alphanumeric('Username must be alphanumeric'),
      ]),

      // Email validator
      email: compose([
        required('Email is required'),
        email('Invalid email address'),
      ]),

      // Password with custom validator
      password: compose([
        required('Password is required'),
        minLength(8, 'Password must be at least 8 characters'),
        custom<string>((value) => {
          if (!/[A-Z]/.test(value)) return 'Must contain uppercase letter'
          if (!/[a-z]/.test(value)) return 'Must contain lowercase letter'
          if (!/[0-9]/.test(value)) return 'Must contain number'
          if (!/[!@#$%^&*]/.test(value)) return 'Must contain special character'
          return null
        }),
      ]),

      // Conditional validator (must match password)
      confirmPassword: (value, values) => {
        return equals(values?.password || '', 'Passwords must match')(value)
      },

      // Number validators
      age: compose([
        integer('Age must be a whole number'),
        between(13, 120, 'Age must be between 13 and 120'),
      ]),

      // Optional validator
      bio: optional(
        compose([
          minLength(10, 'Bio must be at least 10 characters'),
          maxLength(500, 'Bio must not exceed 500 characters'),
        ])
      ),

      // Optional URL pattern
      website: optional(
        pattern(
          /^https?:\/\/.+/,
          'Website must start with http:// or https://'
        )
      ),

      // Conditional validator
      promoCode: when(
        (value, values) => values?.agreeToTerms === true,
        pattern(/^PROMO-[A-Z0-9]{6}$/, 'Invalid promo code format')
      ),
    },
    onSubmit: (values) => {
      console.log('Form submitted:', values)
      alert('Signup successful! Check console for values.')
    },
  })

  const { Field } = form

  return (
    <form onSubmit={form.handleSubmit} style={{ maxWidth: '500px', margin: '0 auto' }}>
      <h1>Signup Form (Validators Example)</h1>

      {/* Username */}
      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="username" style={{ display: 'block', marginBottom: '5px' }}>
          Username *
        </label>
        <Field name="username">
          {(field) => (
            <div>
              <input
                {...field.props}
                id="username"
                placeholder="john_doe123"
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

      {/* Email */}
      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="email" style={{ display: 'block', marginBottom: '5px' }}>
          Email *
        </label>
        <Field name="email">
          {(field) => (
            <div>
              <input
                {...field.props}
                id="email"
                type="email"
                placeholder="john@example.com"
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

      {/* Password */}
      <div style={{ marginBottom: '15px' }}>
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
                placeholder="Min 8 chars, uppercase, lowercase, number, special"
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

      {/* Confirm Password */}
      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="confirmPassword" style={{ display: 'block', marginBottom: '5px' }}>
          Confirm Password *
        </label>
        <Field name="confirmPassword">
          {(field) => (
            <div>
              <input
                {...field.props}
                id="confirmPassword"
                type="password"
                placeholder="Re-enter password"
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

      {/* Age */}
      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="age" style={{ display: 'block', marginBottom: '5px' }}>
          Age * (13-120)
        </label>
        <Field name="age">
          {(field) => (
            <div>
              <input
                {...field.props}
                id="age"
                type="number"
                placeholder="18"
                onChange={(e) => field.setValue(Number(e.target.value) as any)}
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

      {/* Bio (Optional) */}
      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="bio" style={{ display: 'block', marginBottom: '5px' }}>
          Bio (Optional, 10-500 chars)
        </label>
        <Field name="bio">
          {(field) => (
            <div>
              <textarea
                {...field.props}
                id="bio"
                rows={4}
                placeholder="Tell us about yourself..."
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
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                {field.value.length}/500 characters
              </div>
            </div>
          )}
        </Field>
      </div>

      {/* Website (Optional) */}
      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="website" style={{ display: 'block', marginBottom: '5px' }}>
          Website (Optional)
        </label>
        <Field name="website">
          {(field) => (
            <div>
              <input
                {...field.props}
                id="website"
                type="url"
                placeholder="https://example.com"
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

      {/* Agree to Terms (Checkbox) */}
      <div style={{ marginBottom: '15px' }}>
        <label>
          <Field name="agreeToTerms">
            {(field) => (
              <input
                type="checkbox"
                checked={field.value as boolean}
                onChange={(e) => field.setValue(e.target.checked as any)}
                style={{ marginRight: '5px' }}
              />
            )}
          </Field>
          I agree to the terms and conditions
        </label>
      </div>

      {/* Promo Code (Conditional - only validates if agreeToTerms is checked) */}
      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="promoCode" style={{ display: 'block', marginBottom: '5px' }}>
          Promo Code (Format: PROMO-XXXXXX)
        </label>
        <Field name="promoCode">
          {(field) => (
            <div>
              <input
                {...field.props}
                id="promoCode"
                placeholder="PROMO-ABC123"
                disabled={!form.values.agreeToTerms}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderColor: field.touched && field.error ? 'red' : '#ccc',
                  opacity: form.values.agreeToTerms ? 1 : 0.5,
                }}
              />
              {field.touched && field.error && (
                <div style={{ color: 'red', fontSize: '14px', marginTop: '5px' }}>
                  {field.error}
                </div>
              )}
              {!form.values.agreeToTerms && (
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  Check "Agree to terms" to enable promo code
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
          disabled={form.isSubmitting || !form.isValid}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: form.isValid ? '#0070f3' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: form.isValid ? 'pointer' : 'not-allowed',
            width: '100%',
          }}
        >
          {form.isSubmitting ? 'Signing up...' : 'Sign Up'}
        </button>
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
            },
            null,
            2
          )}
        </pre>
      </details>
    </form>
  )
}
