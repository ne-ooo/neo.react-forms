# API Reference

Complete API documentation for @lpm.dev/neo.react-forms

---

## Table of Contents

- [useForm](#useform)
- [Field Component](#field-component)
- [FieldArray Component](#fieldarray-component)
- [Validators](#validators)
- [Adapters](#adapters)
- [DevTools](#devtools)

---

## useForm

Main hook for creating forms.

### Signature

```tsx
function useForm<Values extends Record<string, unknown>>(
  options: UseFormOptions<Values>
): UseFormReturn<Values>
```

### Options

```tsx
interface UseFormOptions<Values> {
  // Initial form values (required)
  initialValues: Values

  // Field-level validation schema
  validate?: ValidationSchema<Values>

  // Form-level validation function
  validateForm?: (values: Values) => Partial<Record<Path<Values>, string>> | Promise<...>

  // Submit handler (required)
  onSubmit: (values: Values) => void | Promise<void>

  // Submit error handler
  onSubmitError?: (error: unknown) => void

  // Validation mode (default: 'onBlur')
  mode?: 'onBlur' | 'onChange' | 'onSubmit'

  // Re-validation mode (default: 'onChange')
  reValidateMode?: 'onChange' | 'onBlur'

  // Computed fields
  computed?: {
    [K in Path<Values>]?: (values: Values) => ValueAtPath<Values, K>
  }
}
```

### Return Value

```tsx
interface UseFormReturn<Values> {
  // Current form values
  values: Values
  initialValues: Values

  // Error state
  errors: Partial<Record<Path<Values>, string>>
  touched: Partial<Record<Path<Values>, boolean>>

  // Form state
  isValid: boolean
  isDirty: boolean
  isSubmitting: boolean
  isSubmitted: boolean
  isValidating: boolean
  validatingFields: string[]
  submitCount: number

  // Value operations
  setValue: <P extends Path<Values>>(
    name: P,
    value: ValueAtPath<Values, P>
  ) => void

  getValue: <P extends Path<Values>>(
    name: P
  ) => ValueAtPath<Values, P>

  // Error operations
  setError: <P extends Path<Values>>(
    name: P,
    error: string | undefined
  ) => void

  getError: <P extends Path<Values>>(
    name: P
  ) => string | undefined

  // Touched operations
  setTouched: <P extends Path<Values>>(
    name: P,
    touched: boolean
  ) => void

  getTouched: <P extends Path<Values>>(
    name: P
  ) => boolean

  // Validation
  validateField: <P extends Path<Values>>(
    name: P
  ) => Promise<boolean>

  validateForm: () => Promise<boolean>

  // Form operations
  reset: () => void
  handleSubmit: (e?: FormEvent) => Promise<void>

  // Components
  Field: FieldComponent<Values>
  FieldArray: FieldArrayComponent<Values>
}
```

### Example

```tsx
const form = useForm({
  initialValues: {
    email: '',
    password: '',
  },
  validate: {
    email: (value) => value.includes('@') ? undefined : 'Invalid email',
    password: (value) => value.length >= 8 ? undefined : 'Too short',
  },
  onSubmit: async (values) => {
    await api.login(values)
  },
})
```

---

## Field Component

Render a form field with automatic subscriptions.

### Props

```tsx
interface FieldProps<Values, P extends Path<Values>> {
  // Field name (path)
  name: P

  // Render function
  children: (props: FieldRenderProps<Values, P>) => ReactNode
}

interface FieldRenderProps<Values, P extends Path<Values>> {
  // Field props for input binding
  field: {
    name: P
    value: ValueAtPath<Values, P>
    onChange: (e: ChangeEvent<HTMLInputElement>) => void
    onBlur: () => void
  }

  // Field state
  value: ValueAtPath<Values, P>
  error: string | undefined
  touched: boolean
  dirty: boolean
  isValidating: boolean

  // Helper methods
  setValue: (value: ValueAtPath<Values, P>) => void
  setError: (error: string | undefined) => void
  setTouched: (touched: boolean) => void
}
```

### Example

```tsx
<form.Field name="email">
  {({ field, error, touched }) => (
    <div>
      <input {...field} />
      {touched && error && <span>{error}</span>}
    </div>
  )}
</form.Field>
```

---

## FieldArray Component

Manage dynamic array fields.

### Props

```tsx
interface FieldArrayProps<Values, P extends Path<Values>> {
  // Array field name (path)
  name: P

  // Render function
  children: (props: FieldArrayRenderProps<Values, P>) => ReactNode
}

interface FieldArrayRenderProps<Values, P extends Path<Values>> {
  // Array items with stable keys
  fields: Array<{ key: string; index: number }>

  // Array operations
  append: (value: ArrayElement<ValueAtPath<Values, P>>) => void
  prepend: (value: ArrayElement<ValueAtPath<Values, P>>) => void
  insert: (index: number, value: ArrayElement<ValueAtPath<Values, P>>) => void
  remove: (index: number) => void
  move: (from: number, to: number) => void
  swap: (indexA: number, indexB: number) => void
  replace: (index: number, value: ArrayElement<ValueAtPath<Values, P>>) => void
  clear: () => void
}
```

### Example

```tsx
<form.FieldArray name="todos">
  {({ fields, append, remove }) => (
    <>
      {fields.map((field, index) => (
        <div key={field.key}>
          <input
            value={form.values.todos[index].text}
            onChange={(e) =>
              form.setValue(`todos.${index}.text`, e.target.value)
            }
          />
          <button onClick={() => remove(index)}>Remove</button>
        </div>
      ))}
      <button onClick={() => append({ text: '', done: false })}>
        Add
      </button>
    </>
  )}
</form.FieldArray>
```

---

## Validators

Built-in validation functions.

### String Validators

```tsx
// Required field
required(message?: string): Validator<unknown>

// Email validation
email(message?: string): Validator<string>

// URL validation
url(message?: string): Validator<string>

// Min/max length
minLength(min: number, message?: string): Validator<string>
maxLength(max: number, message?: string): Validator<string>

// Pattern matching
pattern(regex: RegExp, message?: string): Validator<string>

// Character types
alphanumeric(message?: string): Validator<string>
alpha(message?: string): Validator<string>
lowercase(message?: string): Validator<string>
uppercase(message?: string): Validator<string>

// String utilities
trimmed(message?: string): Validator<string>
contains(substring: string, message?: string): Validator<string>
startsWith(prefix: string, message?: string): Validator<string>
endsWith(suffix: string, message?: string): Validator<string>
```

### Number Validators

```tsx
// Min/max value
min(min: number, message?: string): Validator<number>
max(max: number, message?: string): Validator<number>
between(min: number, max: number, message?: string): Validator<number>

// Number types
integer(message?: string): Validator<number>
safeInteger(message?: string): Validator<number>
finite(message?: string): Validator<number>

// Sign validators
positive(message?: string): Validator<number>
negative(message?: string): Validator<number>
nonNegative(message?: string): Validator<number>
nonPositive(message?: string): Validator<number>

// Math validators
multipleOf(factor: number, message?: string): Validator<number>
even(message?: string): Validator<number>
odd(message?: string): Validator<number>
```

### Composition Utilities

```tsx
// Combine multiple validators
compose<T>(...validators: Validator<T>[]): Validator<T>

// Optional field (skip validation if empty)
optional<T>(validator: Validator<T>): Validator<T | undefined>

// Conditional validation
when<T, Values>(
  condition: (value: T, values: Values) => boolean,
  validator: Validator<T, Values>
): Validator<T, Values>

// Custom validator
custom<T>(
  validate: (value: T) => string | undefined
): Validator<T>

// Test function
test<T>(
  predicate: (value: T) => boolean,
  message: string
): Validator<T>

// Enum validators
oneOf<T>(values: T[], message?: string): Validator<T>
notOneOf<T>(values: T[], message?: string): Validator<T>
equals<T>(value: T, message?: string): Validator<T>
notEquals<T>(value: T, message?: string): Validator<T>
```

### Example

```tsx
import { compose, required, email, minLength } from '@lpm.dev/neo.react-forms/validators'

const form = useForm({
  initialValues: { email: '', password: '' },
  validate: {
    email: compose(required(), email()),
    password: compose(required(), minLength(8)),
  },
})
```

---

## Adapters

### Zod Adapter

```tsx
import { zodForm, zodAdapter } from '@lpm.dev/neo.react-forms/adapters'
import { z } from 'zod'

// Method 1: zodForm (recommended)
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const form = zodForm({
  schema,
  onSubmit: async (values) => {
    // values is fully typed from schema!
    await api.signup(values)
  },
})

// Method 2: zodAdapter
const form = useForm({
  initialValues: { email: '', password: '' },
  validate: zodAdapter(schema),
  onSubmit: async (values) => {
    await api.signup(values)
  },
})
```

---

## DevTools

Developer utilities for debugging and accessibility.

### Debug Mode

```tsx
import { devtools } from '@lpm.dev/neo.react-forms/devtools'

// Configure debug mode
devtools.configureDebug({
  enabled: true,
  logValueChanges: true,
  logValidation: true,
  logSubmissions: true,
  logger: console.log, // optional custom logger
})

// Get current config
const config = devtools.getDebugConfig()
```

### Enhanced Error Messages

```tsx
// Enhance error with suggestions
const enhanced = devtools.enhanceErrorMessage('Invalid email address')
// {
//   message: 'Invalid email address',
//   suggestion: 'Use format: name@example.com',
//   code: 'INVALID_EMAIL'
// }

// Format error
const formatted = devtools.formatError('Invalid email', 'full')
// 'Invalid email. Suggestion: Use format: name@example.com'

// Pre-made error messages
devtools.ErrorMessages.required() // 'This field is required'
devtools.ErrorMessages.email // 'Please enter a valid email address'
devtools.ErrorMessages.passwordTooShort(8) // 'Password must be at least 8 characters'
```

### Accessibility Helpers

```tsx
// Get ARIA props for a field
const ariaProps = devtools.getFieldAriaProps({
  name: 'email',
  hasError: true,
  isRequired: true,
  errorId: 'email-error',
  descriptionId: 'email-desc',
})
// {
//   'aria-invalid': true,
//   'aria-required': true,
//   'aria-describedby': 'email-error email-desc'
// }

// Screen reader announcements
devtools.announceToScreenReader('Form submitted successfully')
devtools.announceValidationError('email', 'Invalid email address')
```

### DevTools Integration

```tsx
// Create form snapshot
const snapshot = devtools.createFormSnapshot(form, initialValues)

// Expose to DevTools console
devtools.exposeFormToWindow('signup-form', snapshot)
// Access in console: window.__NEO_FORMS__['signup-form']

// Log form state
devtools.logFormState('signup-form', snapshot)

// Diff two snapshots
const diff = devtools.diffFormState(beforeSnapshot, afterSnapshot)
// { changedFields, newErrors, clearedErrors, touchedFields }

// Performance monitoring
const monitor = devtools.createPerformanceMonitor()
const stopTimer = monitor.startTimer('validation')
// ... do work
stopTimer()
monitor.logMetrics()
```

---

## Type Utilities

### Path<T>

Generate all valid paths for a type:

```tsx
type User = {
  name: string
  profile: {
    age: number
    address: {
      street: string
    }
  }
}

type UserPath = Path<User>
// 'name' | 'profile' | 'profile.age' | 'profile.address' | 'profile.address.street'
```

### ValueAtPath<T, P>

Get the type at a specific path:

```tsx
type AgeType = ValueAtPath<User, 'profile.age'> // number
type StreetType = ValueAtPath<User, 'profile.address.street'> // string
```

---

## Complete Example

```tsx
import { useForm } from '@lpm.dev/neo.react-forms'
import { compose, required, email, minLength } from '@lpm.dev/neo.react-forms/validators'

function CompleteForm() {
  const form = useForm({
    initialValues: {
      email: '',
      password: '',
      confirmPassword: '',
      tags: [],
    },
    validate: {
      email: compose(required(), email()),
      password: compose(required(), minLength(8)),
      confirmPassword: (value, values) =>
        value === values.password ? undefined : 'Passwords must match',
    },
    onSubmit: async (values) => {
      await api.signup(values)
    },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  })

  return (
    <form onSubmit={form.handleSubmit}>
      <form.Field name="email">
        {({ field, error, touched }) => (
          <div>
            <label>Email</label>
            <input type="email" {...field} />
            {touched && error && <span>{error}</span>}
          </div>
        )}
      </form.Field>

      <form.Field name="password">
        {({ field, error, touched }) => (
          <div>
            <label>Password</label>
            <input type="password" {...field} />
            {touched && error && <span>{error}</span>}
          </div>
        )}
      </form.Field>

      <form.Field name="confirmPassword">
        {({ field, error, touched }) => (
          <div>
            <label>Confirm Password</label>
            <input type="password" {...field} />
            {touched && error && <span>{error}</span>}
          </div>
        )}
      </form.Field>

      <form.FieldArray name="tags">
        {({ fields, append, remove }) => (
          <div>
            <label>Tags</label>
            {fields.map((field, index) => (
              <div key={field.key}>
                <input
                  value={form.values.tags[index]}
                  onChange={(e) =>
                    form.setValue(`tags.${index}`, e.target.value)
                  }
                />
                <button type="button" onClick={() => remove(index)}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" onClick={() => append('')}>
              Add Tag
            </button>
          </div>
        )}
      </form.FieldArray>

      <button type="submit" disabled={form.isSubmitting || !form.isValid}>
        {form.isSubmitting ? 'Submitting...' : 'Submit'}
      </button>

      {form.isSubmitted && <p>Form submitted successfully!</p>}
    </form>
  )
}
```
