# Migrating from React Hook Form to neo.react-forms

Use this guide to migrate a React Hook Form form to `@lpm.dev/neo.react-forms`.

---

## Why Migrate?

- Infer form paths and values from `initialValues`.
- Use field subscriptions and render props.
- Use built-in validators or the optional Zod adapter.

---

## API Comparison

| React Hook Form | neo.react-forms |
|-----------------|-----------------|
| `useForm()` | `useForm()` |
| `register('field')` | `<form.Field name="field">` |
| `setValue('field', val)` | `setFieldValue('field', val)` |
| `watch('field')` | `form.values.field` |
| `formState.errors` | `form.errors` |
| `handleSubmit(fn)` | `handleSubmit` |

---

## Basic Migration

**Before (RHF):**
```tsx
import { useForm } from 'react-hook-form'

function Form() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { email: '' }
  })

  return (
    <form onSubmit={handleSubmit((data) => console.log(data))}>
      <input {...register('email', {
        required: 'Required',
        pattern: { value: /@/, message: 'Invalid' }
      })} />
      {errors.email && <span>{errors.email.message}</span>}
      <button>Submit</button>
    </form>
  )
}
```

**After (neo.react-forms):**
```tsx
import { useForm } from '@lpm.dev/neo.react-forms'

function Form() {
  const form = useForm({
    initialValues: { email: '' },
    validate: {
      email: (value) => {
        if (!value) return 'Required'
        if (!value.includes('@')) return 'Invalid'
        return undefined
      }
    },
    onSubmit: (values) => console.log(values),
  })

  return (
    <form onSubmit={form.handleSubmit}>
      <form.Field name="email">
        {({ props, error }) => (
          <>
            <input {...props} />
            {error && <span>{error}</span>}
          </>
        )}
      </form.Field>
      <button>Submit</button>
    </form>
  )
}
```

---

## Key Differences

### 1. Field Registration

**RHF:** Uses `register()` refs
**neo.react-forms:** Uses `<Field>` components with subscriptions

### 2. TypeScript

**RHF:** Requires manual types: `useForm<MyFormData>()`
**neo.react-forms:** Infers from `initialValues` automatically

### 3. Validation

**RHF:** Inline validation rules
**neo.react-forms:** Separate `validate` object (cleaner)

### 4. Performance

React Hook Form uses refs. neo.react-forms uses field-level subscriptions. Measure equivalent work in your application.

---

## Migration Checklist

- [ ] Replace `register()` with `<form.Field>`
- [ ] Change `defaultValues` to `initialValues`
- [ ] Move inline validation to `validate` object
- [ ] Replace `formState.errors` with `form.errors`
- [ ] Update `handleSubmit` usage
- [ ] Remove manual TypeScript generics

---

See [API Reference](./API.md) for complete documentation.
