# @lpm.dev/neo.react-forms

A typed React form library with field subscriptions, built-in validators, and an optional Zod adapter.

## Install

Use LPM to install the package:

```bash
lpm install @lpm.dev/neo.react-forms
```

React 18 and React 19 are supported. Zod is an optional peer dependency.

## Create a form

```tsx
import { useForm } from '@lpm.dev/neo.react-forms'
import {
  compose,
  email,
  minLength,
  required,
} from '@lpm.dev/neo.react-forms/validators'

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
            <label htmlFor="signup-email">Email</label>
            <input {...props} id="signup-email" type="email" />
            {touched && error ? <span role="alert">{error}</span> : null}
          </div>
        )}
      </form.Field>

      <form.Field name="password">
        {({ props, error, touched }) => (
          <div>
            <label htmlFor="signup-password">Password</label>
            <input {...props} id="signup-password" type="password" />
            {touched && error ? <span role="alert">{error}</span> : null}
          </div>
        )}
      </form.Field>

      <button type="submit" disabled={form.isSubmitting}>
        Sign up
      </button>
    </form>
  )
}
```

TypeScript infers the form type from `initialValues`.

```ts
form.setFieldValue('email', 'person@example.com')
form.setFieldValue('password', 42) // TypeScript error
```

## Subscribe with hooks

`form.useField(name)` subscribes a component to one field. It returns the field state and typed operations.

`form.useFormState(selector)` subscribes a component to one selected result. Other form updates do not re-render the component.

```tsx
function EmailEditor() {
  const form = useForm({
    initialValues: { email: '', acceptedTerms: false },
  })
  const email = form.useField('email')
  const canSubmit = form.useFormState(
    (state) => state.isValid && state.values.acceptedTerms
  )

  return (
    <>
      <input
        value={email.value}
        onChange={(event) => email.setValue(event.currentTarget.value)}
        onBlur={() => email.setTouched(true)}
      />
      <button disabled={!canSubmit}>Continue</button>
    </>
  )
}
```

Use `form.batch()` for synchronous updates that must send one notification.

```ts
form.batch(() => {
  form.setFieldValue('email', 'person@example.com')
  form.setFieldTouched('email', true)
})
```

## Use field arrays

Each item has a stable React key. Array operations are under `helpers`.

```tsx
<form.FieldArray name="users">
  {({ fields, helpers }) => (
    <>
      {fields.map((field) => (
        <div key={field.key}>
          <form.Field name={`users.${field.index}.name`}>
            {({ props }) => <input {...props} />}
          </form.Field>
          <button type="button" onClick={() => helpers.remove(field.index)}>
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => helpers.append({ name: '', active: true })}
      >
        Add user
      </button>
    </>
  )}
</form.FieldArray>
```

## Use Zod

`zodForm` returns `initialValues` and `validate`. Pass both values to `useForm`.

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
  onSubmit: async (values) => {
    await api.signup(values)
  },
})
```

## Use DevTools safely

Snapshots and debug logs redact common credential fields by default. This includes passwords, tokens, API keys, card data, and other secrets.

```ts
import {
  createFormSnapshot,
  exposeFormToWindow,
} from '@lpm.dev/neo.react-forms/devtools'

const snapshot = createFormSnapshot(form, initialValues, {
  sensitiveFields: ['recoveryPhrase', /^payment\./],
})

const cleanup = exposeFormToWindow('signup-form', snapshot, {
  enabled: true,
})

// Remove the browser-global value when the form unmounts.
cleanup()
```

Global exposure is disabled in production by default. Use `includeSensitiveValues: true` only when you accept the disclosure risk.

## Validate a release

The release gate runs typechecks, coverage, SSR tests, explicit-GC memory tests, package checks, and benchmark smoke tests.

```bash
lpm run release:check
```

Use the full benchmark suite for local performance work:

```bash
lpm run bench
```

Benchmark results depend on the machine and runtime. See [BENCHMARKS.md](./BENCHMARKS.md) for the measurement rules.

## Documentation

- [API reference](./docs/API.md)
- [TypeScript guide](./docs/TYPESCRIPT-GUIDE.md)
- [Formik migration](./docs/MIGRATION-FORMIK.md)
- [React Hook Form migration](./docs/MIGRATION-RHF.md)

## License

MIT
