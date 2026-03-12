---
name: migrate-from-formik
description: Migration guide from Formik and React Hook Form to neo.react-forms — same mental model as Formik (values/errors/touched/handleSubmit), field-level subscriptions like React Hook Form, 96% smaller than Formik, perfect TypeScript inference, 36 built-in validators, FieldArray with stable keys, Zod adapter
version: "1.0.0"
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---

# Migrating from Formik / React Hook Form to @lpm.dev/neo.react-forms

## Why Migrate

| | Formik | React Hook Form | neo.react-forms |
|---|--------|-----------------|-----------------|
| **Bundle** | ~45 KB | ~33 KB | ~7.1 KB |
| **Re-renders** | Every field on any change | Field-level | Field-level |
| **Validators** | Yup/Zod only | resolvers | 36 built-in + Zod |
| **TypeScript** | Manual generics | Good | Perfect inference |
| **Tree-shaking** | No | Partial | Full |
| **Dependencies** | 7+ | Zero | Zero |
| **FieldArray** | Separate package | Built-in | Built-in |

## Migrating from Formik

### Basic Form

```tsx
// Before — Formik
import { Formik, Form, Field, ErrorMessage } from 'formik'

<Formik
  initialValues={{ email: '', password: '' }}
  validate={(values) => {
    const errors: Record<string, string> = {}
    if (!values.email) errors.email = 'Required'
    return errors
  }}
  onSubmit={async (values) => { await api.login(values) }}
>
  <Form>
    <Field name="email" type="email" />
    <ErrorMessage name="email" component="span" />
    <Field name="password" type="password" />
    <button type="submit">Login</button>
  </Form>
</Formik>

// After — neo.react-forms
import { useForm, required, email, compose } from '@lpm.dev/neo.react-forms'

function LoginForm() {
  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: compose(required(), email()),
      password: required(),
    },
    onSubmit: async (values) => { await api.login(values) },
  })

  return (
    <form onSubmit={form.handleSubmit}>
      <form.Field name="email">
        {({ props, error, touched }) => (
          <>
            <input {...props} type="email" />
            {touched && error && <span>{error}</span>}
          </>
        )}
      </form.Field>
      <form.Field name="password">
        {({ props, error, touched }) => (
          <>
            <input {...props} type="password" />
            {touched && error && <span>{error}</span>}
          </>
        )}
      </form.Field>
      <button type="submit">Login</button>
    </form>
  )
}
```

### Key Concept Mapping

| Formik | neo.react-forms |
|--------|-----------------|
| `<Formik>` provider | `useForm()` hook |
| `<Form>` | `<form onSubmit={form.handleSubmit}>` |
| `<Field name="x">` | `<form.Field name="x">` |
| `<ErrorMessage name="x">` | Access `error` in Field render props |
| `<FieldArray name="x">` | `<form.FieldArray name="x">` |
| `formik.values` | `form.values` |
| `formik.errors` | `form.errors` |
| `formik.touched` | `form.touched` |
| `formik.isSubmitting` | `form.isSubmitting` |
| `formik.setFieldValue()` | `form.setFieldValue()` |
| `formik.resetForm()` | `form.reset()` |
| `formik.handleSubmit` | `form.handleSubmit` |

### Validation: Yup → Built-in Validators

```tsx
// Before — Formik + Yup
import * as Yup from 'yup'

const validationSchema = Yup.object({
  email: Yup.string().required('Required').email('Invalid email'),
  age: Yup.number().required().min(18, 'Must be 18+'),
  password: Yup.string().required().min(8, 'Min 8 chars'),
})

<Formik validationSchema={validationSchema} ...>

// After — built-in validators (no extra dependency)
import { required, email, min, minLength, compose } from '@lpm.dev/neo.react-forms'

useForm({
  validate: {
    email: compose(required('Required'), email('Invalid email')),
    age: compose(required(), min(18, 'Must be 18+')),
    password: compose(required(), minLength(8, 'Min 8 chars')),
  },
})
```

### Validation: Yup → Zod Adapter

```tsx
// Before — Formik + Yup
import * as Yup from 'yup'
const schema = Yup.object({ email: Yup.string().email().required() })
<Formik validationSchema={schema} ...>

// After — Zod adapter
import { z } from 'zod'
import { zodForm } from '@lpm.dev/neo.react-forms/adapters'

const schema = z.object({ email: z.string().email() })
useForm({ ...zodForm(schema, { email: '' }) })
```

### FieldArray

```tsx
// Before — Formik FieldArray
import { FieldArray } from 'formik'

<FieldArray name="friends">
  {({ push, remove }) => (
    values.friends.map((friend, index) => (
      <div key={index}>
        <Field name={`friends.${index}.name`} />
        <button onClick={() => remove(index)}>Remove</button>
      </div>
    ))
  )}
</FieldArray>

// After — neo.react-forms FieldArray
<form.FieldArray name="friends">
  {({ fields, helpers }) => (
    fields.map((field) => (
      <div key={field.key}>  {/* Stable key, not index */}
        <form.Field name={`friends.${field.index}.name`}>
          {(f) => <input {...f.props} />}
        </form.Field>
        <button onClick={() => helpers.remove(field.index)}>Remove</button>
      </div>
    ))
  )}
</form.FieldArray>
```

**Improvements over Formik FieldArray:**
- Stable keys generated automatically (no index-as-key bugs)
- 8 helpers: append, prepend, insert, remove, move, swap, replace, clear
- Only re-renders when the array changes (not the entire form)

### Performance: Formik's Biggest Problem

```tsx
// Formik: typing in ANY field re-renders ALL 30 fields
// This is Formik's core architecture — no fix possible

// neo.react-forms: typing in email ONLY re-renders email
// Other 29 fields don't re-render at all
<form.Field name="email">
  {/* Only re-renders when email changes */}
</form.Field>
```

## Migrating from React Hook Form

### Basic Form

```tsx
// Before — React Hook Form
import { useForm } from 'react-hook-form'

function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { email: '', password: '' },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email', { required: 'Required' })} />
      {errors.email && <span>{errors.email.message}</span>}
      <input {...register('password', { required: true, minLength: 8 })} type="password" />
      <button type="submit">Login</button>
    </form>
  )
}

// After — neo.react-forms
import { useForm, required, minLength, compose } from '@lpm.dev/neo.react-forms'

function LoginForm() {
  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: required('Required'),
      password: compose(required(), minLength(8)),
    },
    onSubmit: async (values) => { ... },
  })

  return (
    <form onSubmit={form.handleSubmit}>
      <form.Field name="email">
        {({ props, error, touched }) => (
          <>
            <input {...props} />
            {touched && error && <span>{error}</span>}
          </>
        )}
      </form.Field>
      <form.Field name="password">
        {({ props }) => <input {...props} type="password" />}
      </form.Field>
      <button type="submit">Login</button>
    </form>
  )
}
```

### Key Differences from React Hook Form

**1. Controlled vs Uncontrolled:**
```tsx
// React Hook Form — uncontrolled by default (register)
const { register } = useForm()
<input {...register('email')} />

// React Hook Form — controlled via Controller
<Controller name="email" control={control}
  render={({ field }) => <CustomInput {...field} />}
/>

// neo.react-forms — render props pattern (always controlled)
<form.Field name="email">
  {({ props }) => <input {...props} />}
  {/* Or custom components */}
  {({ value, setValue }) => <CustomInput value={value} onChange={setValue} />}
</form.Field>
```

**2. Validation:**
```tsx
// React Hook Form — inline rules
register('email', {
  required: 'Required',
  pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
  validate: async (value) => { ... },
})

// neo.react-forms — composable validators
validate: {
  email: compose(required(), email(), custom(async (value) => { ... })),
}
```

**3. formState proxy vs explicit state:**
```tsx
// React Hook Form — proxy-based (only tracks accessed properties)
const { formState: { errors, isDirty, isSubmitting } } = useForm()

// neo.react-forms — direct properties
form.errors
form.isDirty
form.isSubmitting
```

**4. watch() vs subscribe():**
```tsx
// React Hook Form — watch specific fields
const email = watch('email')

// neo.react-forms — subscribe to field changes
const [email, setEmail] = useState('')
useEffect(() => {
  return form.subscribe('email', (state) => setEmail(state.value))
}, [])
```

## New Features in neo.react-forms

### Perfect Type Inference

```tsx
// No generics needed — types inferred from initialValues
const form = useForm({
  initialValues: { email: '', age: 0, active: true },
})

form.setFieldValue('email', 123)  // TS error! string expected
form.setFieldValue('age', 'abc')  // TS error! number expected
form.setFieldValue('typo', '')    // TS error! 'typo' not a valid path
```

Neither Formik nor React Hook Form achieves this level of inference.

### Built-in Validators

```tsx
// 36 validators included — no Yup/Zod dependency needed
import { required, email, min, max, between, integer, positive, minLength, maxLength, pattern, compose, optional, when, oneOf } from '@lpm.dev/neo.react-forms'
```

### Computed Fields

```tsx
const form = useForm({
  initialValues: { firstName: '', lastName: '', fullName: '' },
  computed: {
    fullName: (values) => `${values.firstName} ${values.lastName}`.trim(),
  },
})
// fullName auto-updates when firstName or lastName changes
```

### Accessibility Built-in

```tsx
import { getFieldAriaProps, announceValidationError } from '@lpm.dev/neo.react-forms/devtools'
// ARIA props, screen reader announcements, error formatting
```

## Migration Checklist

### From Formik
- [ ] Replace `<Formik>` provider with `useForm()` hook
- [ ] Replace `<Form>` with `<form onSubmit={form.handleSubmit}>`
- [ ] Replace `<Field name="x">` with `<form.Field name="x">`
- [ ] Replace `<ErrorMessage>` with error display in Field render props
- [ ] Replace Yup schema with built-in validators or Zod adapter
- [ ] Replace `<FieldArray>` with `<form.FieldArray>` (use `field.key` as React key)
- [ ] Replace `formik.setFieldValue` with `form.setFieldValue`
- [ ] Replace `formik.resetForm()` with `form.reset()`
- [ ] Remove `formik`, `yup`, and `@types/yup` from dependencies

### From React Hook Form
- [ ] Replace `useForm()` import with `'@lpm.dev/neo.react-forms'`
- [ ] Replace `defaultValues` with `initialValues`
- [ ] Replace `register()` with `<form.Field>` render props
- [ ] Replace `Controller` with `<form.Field>` (same pattern)
- [ ] Move inline validation rules to `validate` schema
- [ ] Replace `watch()` with `form.subscribe()`
- [ ] Replace `useFieldArray` with `<form.FieldArray>`
- [ ] Remove `react-hook-form` and resolver packages
