# Migrating from Formik to neo.react-forms

Use this guide to migrate a Formik form to `@lpm.dev/neo.react-forms`.

---

## Why Migrate?

- Use field-level subscriptions.
- Infer form paths and values from `initialValues`.
- Use built-in validators or the optional Zod adapter.
- Remove Formik from the runtime dependency graph.

---

## Key Differences

| Feature | Formik | neo.react-forms |
|---------|--------|-----------------|
| Bundle Size | Measure in your application | Measure in your application |
| Re-renders | Form context updates | Field subscriptions |
| TypeScript | Manual generics | **Automatic inference** |
| Performance | Measure equivalent work | Measure equivalent work |
| Dependencies | Formik and its dependencies | No runtime dependency |

---

## Basic Form Migration

### Before (Formik)

```tsx
import { Formik, Form, Field } from 'formik'

function SignupForm() {
  return (
    <Formik
      initialValues={{ email: '', password: '' }}
      validate={(values) => {
        const errors: any = {}
        if (!values.email.includes('@')) {
          errors.email = 'Invalid email'
        }
        if (values.password.length < 8) {
          errors.password = 'Too short'
        }
        return errors
      }}
      onSubmit={async (values) => {
        await api.signup(values)
      }}
    >
      {({ isSubmitting }) => (
        <Form>
          <Field name="email" type="email" />
          <Field name="password" type="password" />
          <button type="submit" disabled={isSubmitting}>
            Submit
          </button>
        </Form>
      )}
    </Formik>
  )
}
```

### After (neo.react-forms)

```tsx
import { useForm } from '@lpm.dev/neo.react-forms'

function SignupForm() {
  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (value) => value.includes('@') ? undefined : 'Invalid email',
      password: (value) => value.length >= 8 ? undefined : 'Too short',
    },
    onSubmit: async (values) => {
      await api.signup(values)
    },
  })

  return (
    <form onSubmit={form.handleSubmit}>
      <form.Field name="email">
        {({ props }) => <input type="email" {...props} />}
      </form.Field>
      
      <form.Field name="password">
        {({ props }) => <input type="password" {...props} />}
      </form.Field>

      <button type="submit" disabled={form.isSubmitting}>
        Submit
      </button>
    </form>
  )
}
```

---

## Migration Cheat Sheet

### Validation

| Formik | neo.react-forms |
|--------|-----------------|
| `validate` prop (form-level) | `validateForm` option |
| `validationSchema` (Yup) | `validate` object or `zodAdapter` |
| Custom validators | Same pattern, cleaner syntax |

**Formik:**
```tsx
validate={(values) => {
  const errors: any = {}
  if (!values.email) errors.email = 'Required'
  return errors
}}
```

**neo.react-forms:**
```tsx
validate={{
  email: (value) => value ? undefined : 'Required'
}}
```

### Field Access

| Formik | neo.react-forms |
|--------|-----------------|
| `<Field name="email" />` | `<form.Field name="email">{...}</form.Field>` |
| `formik.values.email` | `form.values.email` |
| `formik.errors.email` | `form.errors.email` |
| `formik.touched.email` | `form.touched.email` |

### Methods

| Formik | neo.react-forms |
|--------|-----------------|
| `setFieldValue(name, value)` | `setFieldValue(name, value)` |
| `setFieldError(name, error)` | `setFieldError(name, error)` |
| `setFieldTouched(name, true)` | `setFieldTouched(name, true)` |
| `validateField(name)` | `validateField(name)` |
| `validateForm()` | `validate()` |
| `resetForm()` | `reset()` |
| `handleSubmit` | `handleSubmit` |

### State

| Formik | neo.react-forms |
|--------|-----------------|
| `isValid` | `isValid` |
| `dirty` | `isDirty` |
| `isSubmitting` | `isSubmitting` |
| `submitCount` | `submitCount` |
| `isValidating` | `isValidating` |

---

## Advanced Patterns

### FieldArray Migration

**Formik:**
```tsx
import { FieldArray } from 'formik'

<FieldArray name="todos">
  {({ push, remove }) => (
    <>
      {values.todos.map((todo, index) => (
        <Field name={`todos.\${index}.text`} />
      ))}
      <button onClick={() => push({ text: '' })}>Add</button>
    </>
  )}
</FieldArray>
```

**neo.react-forms:**
```tsx
<form.FieldArray name="todos">
  {({ fields, helpers }) => (
    <>
      {fields.map((field, index) => (
        <input
          key={field.key}
          value={form.values.todos[index].text}
          onChange={(e) =>
            form.setFieldValue(`todos.\${index}.text`, e.target.value)
          }
        />
      ))}
      <button type="button" onClick={() => helpers.append({ text: '' })}>Add</button>
    </>
  )}
</form.FieldArray>
```

### Yup Schema Migration

**Formik:**
```tsx
import * as Yup from 'yup'

const schema = Yup.object({
  email: Yup.string().email().required(),
  password: Yup.string().min(8).required(),
})

<Formik validationSchema={schema} ...>
```

**neo.react-forms (use Zod instead):**
```tsx
import { useForm } from '@lpm.dev/neo.react-forms'
import { zodForm } from '@lpm.dev/neo.react-forms/adapters'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const form = useForm({
  ...zodForm(schema, { email: '', password: '' }),
  onSubmit: async (values) => { ... },
})
```

---

## Verify performance

Measure the migrated form in your application. Compare the same validation, rendering, and submission work. See [the benchmark guide](../BENCHMARKS.md) for measurement rules.

---

## Complete Example

**Before (Formik):**
```tsx
import { Formik, Form, Field, ErrorMessage, FieldArray } from 'formik'
import * as Yup from 'yup'

const schema = Yup.object({
  email: Yup.string().email().required(),
  password: Yup.string().min(8).required(),
  tags: Yup.array().of(Yup.string()),
})

function ComplexForm() {
  return (
    <Formik
      initialValues={{ email: '', password: '', tags: [] }}
      validationSchema={schema}
      onSubmit={async (values) => await api.submit(values)}
    >
      {({ values, isSubmitting }) => (
        <Form>
          <div>
            <Field name="email" type="email" />
            <ErrorMessage name="email" />
          </div>

          <div>
            <Field name="password" type="password" />
            <ErrorMessage name="password" />
          </div>

          <FieldArray name="tags">
            {({ push, remove }) => (
              <>
                {values.tags.map((tag, index) => (
                  <div key={index}>
                    <Field name={`tags.\${index}`} />
          <button type="button" onClick={() => remove(index)}>Remove</button>
                  </div>
                ))}
                <button onClick={() => push('')}>Add Tag</button>
              </>
            )}
          </FieldArray>

          <button type="submit" disabled={isSubmitting}>
            Submit
          </button>
        </Form>
      )}
    </Formik>
  )
}
```

**After (neo.react-forms):**
```tsx
import { useForm } from '@lpm.dev/neo.react-forms'
import { zodForm } from '@lpm.dev/neo.react-forms/adapters'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  tags: z.array(z.string()),
})

function ComplexForm() {
  const form = useForm({
    ...zodForm(schema, { email: '', password: '', tags: [] }),
    onSubmit: async (values) => await api.submit(values),
  })

  return (
    <form onSubmit={form.handleSubmit}>
      <form.Field name="email">
        {({ props, error, touched }) => (
          <div>
            <input type="email" {...props} />
            {touched && error && <span>{error}</span>}
          </div>
        )}
      </form.Field>

      <form.Field name="password">
        {({ props, error, touched }) => (
          <div>
            <input type="password" {...props} />
            {touched && error && <span>{error}</span>}
          </div>
        )}
      </form.Field>

      <form.FieldArray name="tags">
        {({ fields, helpers }) => (
          <>
            {fields.map((field, index) => (
              <div key={field.key}>
                <input
                  value={form.values.tags[index]}
                  onChange={(e) =>
                    form.setFieldValue(`tags.\${index}`, e.target.value)
                  }
                />
                <button type="button" onClick={() => helpers.remove(index)}>Remove</button>
              </div>
            ))}
            <button type="button" onClick={() => helpers.append('')}>Add Tag</button>
          </>
        )}
      </form.FieldArray>

      <button type="submit" disabled={form.isSubmitting}>
        Submit
      </button>
    </form>
  )
}
```

---

## Troubleshooting

### My form is slower after migration

Make sure you're using `form.Field` components for proper field isolation. Manual field binding without subscriptions won't benefit from performance optimizations.

### TypeScript errors with paths

neo.react-forms has strict path typing. Use autocomplete to find valid paths. Prefer a typed `Path<Values>` variable for a dynamic path. Avoid `any` casts.

### Validation not working

Check that validators return `null` or `undefined` for valid values. A validator returns an error string for invalid values.

---

## Need Help?

- Check the [API Reference](./API.md)
- Open an issue on [GitHub](https://github.com/ne-ooo/neo.react-forms/issues)
