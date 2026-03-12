# Migrating from React Hook Form to neo.react-forms

Quick migration guide from React Hook Form (RHF) to @lpm.dev/neo.react-forms.

---

## Why Migrate?

- ⚡ **27-115% faster** for large forms
- 📦 **83% smaller bundle** (7.1 KB vs 12.1 KB)
- 🎯 **Better TypeScript** inference (no manual generics)
- ✅ **More intuitive API**

---

## API Comparison

| React Hook Form | neo.react-forms |
|-----------------|-----------------|
| \`useForm()\` | \`useForm()\` |
| \`register('field')\` | \`<form.Field name="field">\` |
| \`setValue('field', val)\` | \`setValue('field', val)\` |
| \`watch('field')\` | \`form.values.field\` |
| \`formState.errors\` | \`form.errors\` |
| \`handleSubmit(fn)\` | \`handleSubmit\` |

---

## Basic Migration

**Before (RHF):**
\`\`\`tsx
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
\`\`\`

**After (neo.react-forms):**
\`\`\`tsx
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
        {({ field, error }) => (
          <>
            <input {...field} />
            {error && <span>{error}</span>}
          </>
        )}
      </form.Field>
      <button>Submit</button>
    </form>
  )
}
\`\`\`

---

## Key Differences

### 1. Field Registration

**RHF:** Uses \`register()\` refs
**neo.react-forms:** Uses \`<Field>\` components with subscriptions

### 2. TypeScript

**RHF:** Requires manual types: \`useForm<MyFormData>()\`
**neo.react-forms:** Infers from \`initialValues\` automatically

### 3. Validation

**RHF:** Inline validation rules
**neo.react-forms:** Separate \`validate\` object (cleaner)

### 4. Performance

**RHF:** 100k ops/sec, uses refs
**neo.react-forms:** 366k ops/sec, field-level subscriptions

---

## Migration Checklist

- [ ] Replace \`register()\` with \`<form.Field>\`
- [ ] Change \`defaultValues\` to \`initialValues\`
- [ ] Move inline validation to \`validate\` object
- [ ] Replace \`formState.errors\` with \`form.errors\`
- [ ] Update \`handleSubmit\` usage
- [ ] Remove manual TypeScript generics

---

See [API Reference](./API.md) for complete documentation.
