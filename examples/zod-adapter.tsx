/**
 * Zod Adapter Example
 *
 * Shows how to use Zod schemas with @lpm.dev/neo.react-forms
 * for automatic validation and type inference
 */

import React from 'react'
import { z } from 'zod'
import { useForm, zodAdapter, zodForm } from '@lpm.dev/neo.react-forms'

// Define Zod schema
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[0-9]/, 'Must contain number'),
  age: z.number().min(18, 'Must be 18 or older').max(120, 'Invalid age'),
  website: z.string().url('Invalid URL').optional(),
  profile: z.object({
    firstName: z.string().min(1, 'First name required'),
    lastName: z.string().min(1, 'Last name required'),
    bio: z.string().max(500, 'Bio too long').optional(),
  }),
  terms: z.boolean().refine((val) => val === true, 'You must accept the terms'),
})

// Infer TypeScript type from Zod schema
type SignupFormValues = z.infer<typeof signupSchema>

export function ZodAdapterExample() {
  // Option 1: Use zodAdapter directly
  const form = useForm({
    initialValues: {
      email: '',
      password: '',
      age: 0,
      website: '',
      profile: {
        firstName: '',
        lastName: '',
        bio: '',
      },
      terms: false,
    },
    validate: zodAdapter(signupSchema),
    onSubmit: async (values) => {
      console.log('Form submitted:', values)
      alert('Form submitted successfully!')
    },
  })

  // Option 2: Use zodForm helper (shorter)
  // const form = useForm({
  //   ...zodForm(signupSchema, {
  //     email: '',
  //     password: '',
  //     age: 0,
  //     website: '',
  //     profile: {
  //       firstName: '',
  //       lastName: '',
  //       bio: '',
  //     },
  //     terms: false,
  //   }),
  //   onSubmit: async (values) => {
  //     console.log('Form submitted:', values)
  //   },
  // })

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h1>Signup Form (Zod Validation)</h1>

      <form onSubmit={form.handleSubmit}>
        {/* Email field */}
        <form.Field name="email">
          {({ props, error, touched }) => (
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="email">Email *</label>
              <input {...props} type="email" id="email" />
              {touched && error && <div style={{ color: 'red' }}>{error}</div>}
            </div>
          )}
        </form.Field>

        {/* Password field */}
        <form.Field name="password">
          {({ props, error, touched }) => (
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="password">Password *</label>
              <input {...props} type="password" id="password" />
              {touched && error && <div style={{ color: 'red' }}>{error}</div>}
              <small>Min 8 chars, must include uppercase and number</small>
            </div>
          )}
        </form.Field>

        {/* Age field */}
        <form.Field name="age">
          {({ props, error, touched, value, setValue }) => (
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="age">Age *</label>
              <input
                {...props}
                type="number"
                id="age"
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
              />
              {touched && error && <div style={{ color: 'red' }}>{error}</div>}
            </div>
          )}
        </form.Field>

        {/* Website field (optional) */}
        <form.Field name="website">
          {({ props, error, touched }) => (
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="website">Website</label>
              <input {...props} type="url" id="website" />
              {touched && error && <div style={{ color: 'red' }}>{error}</div>}
            </div>
          )}
        </form.Field>

        {/* Nested profile fields */}
        <fieldset style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '20px' }}>
          <legend>Profile</legend>

          <form.Field name="profile.firstName">
            {({ props, error, touched }) => (
              <div style={{ marginBottom: '15px' }}>
                <label htmlFor="firstName">First Name *</label>
                <input {...props} type="text" id="firstName" />
                {touched && error && <div style={{ color: 'red' }}>{error}</div>}
              </div>
            )}
          </form.Field>

          <form.Field name="profile.lastName">
            {({ props, error, touched }) => (
              <div style={{ marginBottom: '15px' }}>
                <label htmlFor="lastName">Last Name *</label>
                <input {...props} type="text" id="lastName" />
                {touched && error && <div style={{ color: 'red' }}>{error}</div>}
              </div>
            )}
          </form.Field>

          <form.Field name="profile.bio">
            {({ props, error, touched }) => (
              <div style={{ marginBottom: '15px' }}>
                <label htmlFor="bio">Bio (optional)</label>
                <textarea {...props} id="bio" rows={4} maxLength={500} />
                {touched && error && <div style={{ color: 'red' }}>{error}</div>}
              </div>
            )}
          </form.Field>
        </fieldset>

        {/* Terms checkbox */}
        <form.Field name="terms">
          {({ value, setValue, error, touched }) => (
            <div style={{ marginBottom: '20px' }}>
              <label>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => setValue(e.target.checked)}
                />
                {' '}I accept the terms and conditions *
              </label>
              {touched && error && <div style={{ color: 'red' }}>{error}</div>}
            </div>
          )}
        </form.Field>

        {/* Submit button */}
        <button type="submit" disabled={form.isSubmitting}>
          {form.isSubmitting ? 'Submitting...' : 'Sign Up'}
        </button>

        {/* Form state */}
        <div style={{ marginTop: '30px', padding: '15px', background: '#f5f5f5' }}>
          <h3>Form State</h3>
          <ul>
            <li>Valid: {form.isValid ? '✅' : '❌'}</li>
            <li>Dirty: {form.isDirty ? 'Yes' : 'No'}</li>
            <li>Errors: {Object.keys(form.errors).length}</li>
            <li>Touched: {Object.keys(form.touched).length}</li>
          </ul>

          {Object.keys(form.errors).length > 0 && (
            <>
              <h4>Errors:</h4>
              <pre style={{ fontSize: '12px' }}>
                {JSON.stringify(form.errors, null, 2)}
              </pre>
            </>
          )}
        </div>
      </form>
    </div>
  )
}

// Simpler example with minimal schema
const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
})

export function SimpleZodExample() {
  const form = useForm({
    ...zodForm(loginSchema, {
      email: '',
      password: '',
    }),
    onSubmit: async (values) => {
      console.log('Login:', values)
    },
  })

  return (
    <form onSubmit={form.handleSubmit}>
      <form.Field name="email">
        {({ props, error, touched }) => (
          <div>
            <input {...props} placeholder="Email" />
            {touched && error && <span>{error}</span>}
          </div>
        )}
      </form.Field>

      <form.Field name="password">
        {({ props, error, touched }) => (
          <div>
            <input {...props} type="password" placeholder="Password" />
            {touched && error && <span>{error}</span>}
          </div>
        )}
      </form.Field>

      <button type="submit">Login</button>
    </form>
  )
}
