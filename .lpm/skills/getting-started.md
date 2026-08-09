---
name: getting-started
description: How to use neo.react-forms — useForm hook with perfect TypeScript inference, Field component with field-level subscriptions, FieldArray for dynamic arrays, 36 built-in validators (required, email, min, max, pattern, compose, optional, when), Zod adapter, validation modes (onBlur, onChange, onSubmit), computed fields, async validation with debounce, accessibility helpers, subpath imports
version: "1.0.0"
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---

# Getting Started with @lpm.dev/neo.react-forms

## Overview

neo.react-forms is a React form library with no runtime dependencies. It infers types from `initialValues`. It provides field subscriptions, built-in validators, and a Zod adapter.

## Quick Start

```tsx
import { useForm } from '@lpm.dev/neo.react-forms'
import { compose, email, minLength, required } from '@lpm.dev/neo.react-forms/validators'

function SignupForm() {
  const form = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    validate: {
      email: compose([required(), email()]),
      password: compose([required(), minLength(8)]),
    },
    onSubmit: async (values) => {
      await api.signup(values)
    },
  })

  return (
    <form onSubmit={form.handleSubmit}>
      <form.Field name="email">
        {({ props, error, touched }) => (
          <div>
            <input {...props} type="email" />
            {touched && error && <span>{error}</span>}
          </div>
        )}
      </form.Field>

      <form.Field name="password">
        {({ props, error, touched }) => (
          <div>
            <input {...props} type="password" />
            {touched && error && <span>{error}</span>}
          </div>
        )}
      </form.Field>

      <button type="submit" disabled={form.isSubmitting}>
        Sign Up
      </button>
    </form>
  )
}
```

Types are inferred from `initialValues` — no generic parameter needed.

## useForm Options

```typescript
const form = useForm({
  // Required: defines form shape and types
  initialValues: {
    email: '',
    age: 0,
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    fullName: '',
    profile: { name: '' },
  },

  // Field-level validation (nested schema matching initialValues shape)
  validate: {
    email: compose([required(), email()]),
    age: min(18),
    profile: {
      name: required(),
    },
  },

  // Form-level validation (cross-field)
  validateForm: (values) => {
    const errors: Record<string, string> = {}
    if (values.password !== values.confirmPassword) {
      errors.confirmPassword = 'Passwords must match'
    }
    return errors
  },

  // Submit handler
  onSubmit: async (values) => { ... },
  onSubmitError: (error) => { ... },

  // Validation timing
  mode: 'onBlur',          // When to validate: 'onBlur' | 'onChange' | 'onSubmit' | 'all'
  reValidateMode: 'onChange', // When to re-validate after first error

  // Computed/derived fields
  computed: {
    fullName: (values) => `${values.firstName} ${values.lastName}`,
  },
})
```

## Form State

```typescript
// Values and errors
form.values              // Current form values (typed)
form.errors              // { email: 'Required', ... }
form.touched             // { email: true, ... }

// Status flags
form.isSubmitting        // true during onSubmit
form.isSubmitted         // true after first submit
form.isValid             // true if no errors
form.isDirty             // true if values differ from initial
form.isValidating        // true if any field validating
form.submitCount         // number of submit attempts

// Operations
form.setFieldValue('email', 'user@example.com')
form.setFieldError('email', 'Already taken')
form.setFieldTouched('email', true)
form.validateField('email')    // Promise<boolean>
form.validate()                // Validate all fields
form.handleSubmit(event)       // Form submit handler
form.reset()                   // Reset to initial values
form.reset({ email: 'new@default.com' })  // Reset with new defaults
form.batch(() => {             // Send one notification for synchronous updates
  form.setFieldValue('email', 'user@example.com')
  form.setFieldTouched('email', true)
})
```

## Subscription Hooks

Call the bound hooks only at the top level of a React component.

```tsx
const email = form.useField('email')
const canSubmit = form.useFormState(
  (state) => state.isValid && state.isDirty && !state.isSubmitting
)

email.setValue('user@example.com')
email.setTouched(true)
```

`useField` subscribes to one field. `useFormState` re-renders the component only when the selected result changes.

## Field Component

Each `<form.Field>` only re-renders when its specific field changes.

```tsx
<form.Field name="email">
  {({ value, error, touched, dirty, isValidating, props, setValue, validate }) => (
    <div>
      {/* Spread props for automatic value/onChange/onBlur binding */}
      <input {...props} type="email" placeholder="Email" />

      {/* Show error only after field is touched */}
      {touched && error && <span className="error">{error}</span>}

      {/* Manual control */}
      <button onClick={() => setValue('')}>Clear</button>
    </div>
  )}
</form.Field>
```

### Field-Level Validation Mode

```tsx
<form.Field name="username" mode="onChange" reValidateMode="onChange">
  {({ props, error }) => (
    <input {...props} />
  )}
</form.Field>
```

### Field-Level Validator

```tsx
<form.Field name="username" validate={async (value) => {
  const taken = await checkUsername(value)
  return taken ? 'Username taken' : null
}}>
  {({ props, error, isValidating }) => (
    <>
      <input {...props} />
      {isValidating && <span>Checking...</span>}
      {error && <span>{error}</span>}
    </>
  )}
</form.Field>
```

## FieldArray Component

```tsx
<form.FieldArray name="users">
  {({ fields, helpers }) => (
    <div>
      {fields.map((field) => (
        <div key={field.key}>
          <form.Field name={`users.${field.index}.name`}>
            {(f) => <input {...f.props} placeholder="Name" />}
          </form.Field>
          <form.Field name={`users.${field.index}.email`}>
            {(f) => <input {...f.props} type="email" />}
          </form.Field>
          <button onClick={() => helpers.remove(field.index)}>Remove</button>
        </div>
      ))}
      <button onClick={() => helpers.append({ name: '', email: '' })}>
        Add User
      </button>
    </div>
  )}
</form.FieldArray>
```

### Array Helpers

```typescript
helpers.append(value)           // Add to end
helpers.prepend(value)          // Add to start
helpers.insert(index, value)    // Insert at position
helpers.remove(index)           // Remove at position
helpers.move(from, to)          // Reorder
helpers.swap(indexA, indexB)    // Swap two items
helpers.replace(newArray)       // Replace entire array
helpers.clear()                 // Remove all items
```

Each field in the array gets a stable `key` for React reconciliation.

## Validators

### String Validators

```typescript
import { required, email, url, minLength, maxLength, pattern, alpha, alphanumeric, lowercase, uppercase, trimmed, contains, startsWith, endsWith } from '@lpm.dev/neo.react-forms/validators'

required()                    // Non-empty after trim
required('Custom message')    // Custom error message
email()                       // Valid email format
url()                         // Valid HTTP or HTTPS URL
minLength(3)                  // At least 3 characters
maxLength(100)                // At most 100 characters
pattern(/^\d{5}$/, 'Invalid ZIP')  // Custom regex
```

### Number Validators

```typescript
import { min, max, between, integer, positive, negative, nonNegative, nonPositive, safeInteger, finite, multipleOf, even, odd } from '@lpm.dev/neo.react-forms/validators'

min(0)                        // >= 0
max(100)                      // <= 100
between(1, 10)                // >= 1 and <= 10
integer()                     // Whole numbers only
positive()                    // > 0
nonNegative()                 // >= 0
multipleOf(5)                 // 0, 5, 10, 15, ...
```

### Composition

```typescript
import { compose, optional, when, custom, test, oneOf, notOneOf, equals } from '@lpm.dev/neo.react-forms/validators'

// Chain validators — returns first error
compose([required(), email(), maxLength(255)])

// Only validate if value exists
optional(email())  // null/undefined/'' passes

// Conditional validation
when(
  (value, values) => values.hasPhone,
  compose([required(), pattern(/^\d{10}$/)])
)

// Custom validator
custom((value) => {
  if (value.includes('admin')) return 'Reserved username'
  return null
})

// Simple test function
test((value) => value.length > 0, 'Required')

// Enum validation
oneOf(['admin', 'user', 'guest'], 'Invalid role')
```

## Zod Adapter

```typescript
import { z } from 'zod'
import { useForm } from '@lpm.dev/neo.react-forms'
import { zodForm } from '@lpm.dev/neo.react-forms/adapters'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  profile: z.object({
    name: z.string().min(1),
  }),
})

const form = useForm({
  ...zodForm(schema, {
    email: '',
    password: '',
    profile: { name: '' },
  }),
  onSubmit: async (values) => { ... },
})
```

`zodForm` returns `{ initialValues, validate }` — spread into useForm options.

## Async Validation

The context contains the field name, a cancellation signal, and a detached value snapshot. The snapshot has read-only properties.

```typescript
import type { Validator } from '@lpm.dev/neo.react-forms'

interface SignupValues {
  username: string
  organizationId: string
}

const checkUsername: Validator<string, SignupValues> = async (
  value,
  _values,
  context
) => {
  const exists = await api.checkUsername(
    value,
    context?.values.organizationId,
    context?.signal
  )
  return exists ? 'Username taken' : null
}

const form = useForm({
  initialValues: { username: '', organizationId: '' },
  validate: {
    username: checkUsername,
  },
})
```

## Nested Objects

```tsx
const form = useForm({
  initialValues: {
    user: {
      profile: {
        firstName: '',
        lastName: '',
      },
    },
  },
})

// Dot notation for nested paths — fully typed
<form.Field name="user.profile.firstName">
  {({ props }) => <input {...props} />}
</form.Field>
```

## Accessibility

```typescript
import { getFieldAriaProps, getErrorProps, announceValidationError } from '@lpm.dev/neo.react-forms/devtools'

// Generate ARIA attributes
const errorProps = getErrorProps('email', 'Invalid email', 'signup')
const ariaProps = getFieldAriaProps({
  name: 'email',
  hasError: true,
  isRequired: true,
  errorId: errorProps.id,
})
// { 'aria-invalid': true, 'aria-required': true, 'aria-describedby': 'signup-email-error' }

// Screen reader announcements
announceValidationError('email', 'Invalid email format')
```

## DevTools Privacy

Snapshots and debug logs redact common credential fields by default.

```typescript
import { createFormSnapshot, exposeFormToWindow } from '@lpm.dev/neo.react-forms/devtools'

const snapshot = createFormSnapshot(form, initialValues, {
  sensitiveFields: ['recoveryPhrase', /^payment\./],
})
const cleanup = exposeFormToWindow('signup', snapshot, { enabled: true })

// Call this function when the form unmounts.
cleanup()
```

Browser-global exposure is disabled in production by default. Set `includeSensitiveValues: true` only when you accept the disclosure risk.

## Subpath Imports

```typescript
// Core (useForm, Field, FieldArray)
import { useForm } from '@lpm.dev/neo.react-forms'

// Validators only
import { required, email, compose } from '@lpm.dev/neo.react-forms/validators'

// Zod adapter
import { zodForm, zodAdapter } from '@lpm.dev/neo.react-forms/adapters'

// DevTools & accessibility
import { configureDebug, getFieldAriaProps } from '@lpm.dev/neo.react-forms/devtools'
```

## TypeScript Types

```typescript
import type {
  UseFormOptions,
  UseFormReturn,
  UseFieldReturn,
  DeepReadonly,
  FieldState,
  FormStateSelector,
  ValidationSchema,
  Validator,
  ValidationMode,
  Path,
  ValueAtPath,
} from '@lpm.dev/neo.react-forms'
```
