# @lpm.dev/neo.react-forms

`@lpm.dev/neo.react-forms` provides typed React form state, field subscriptions,
validators, and an optional Zod adapter.

## Features

- **Typed form state:** TypeScript infers field paths and values from
  `initialValues`.
- **Focused subscriptions:** Components can subscribe to one field or one
  selected form-state value.
- **Field arrays:** Array items have stable React keys and typed operations.
- **Validation:** The package includes synchronous, asynchronous, and composable
  validators.
- **Zod support:** The optional adapter accepts Zod 3 schemas.
- **Module formats:** The package provides ESM and CommonJS entry points.

## Install

Install the package and its required React peer dependency:

```bash
lpm install @lpm.dev/neo.react-forms react
```

The package supports React 18 and React 19. Zod 3 is an optional peer
dependency.

## Quick start

```tsx
import { useForm } from "@lpm.dev/neo.react-forms";
import {
  compose,
  email,
  minLength,
  required,
} from "@lpm.dev/neo.react-forms/validators";

function SignupForm() {
  const form = useForm({
    initialValues: {
      email: "",
      password: "",
    },
    validate: {
      email: compose([required(), email()]),
      password: compose([required(), minLength(8)]),
    },
    onSubmit: async (values) => {
      await api.signup(values);
    },
  });

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
  );
}
```

TypeScript infers the form type from `initialValues`.

```typescript
form.setFieldValue("email", "person@example.com");
form.setFieldValue("password", 42); // TypeScript error
```

## API

The [API reference](./docs/API.md) documents all exports, types, operations, and
validator options.

### `useForm(options)`

`useForm()` creates the form store and returns typed components, hooks, state,
and operations.

The package exposes detached, read-only values. Use the form operations to
change the form state.

Form values can contain these built-in values:

- Arrays and plain objects
- Dates, regular expressions, and errors
- Maps and sets
- Binary buffers and typed views
- Blobs and files

Promises, weak collections, functions, and symbols are not supported. Create
built-in form values in the same JavaScript realm as the form store.

Subclasses of slot-backed built-ins are not supported. These built-ins include
arrays, maps, dates, and typed views.

Error subclasses preserve their standard fields and enumerable own state.
Resizable `ArrayBuffer`, growable `SharedArrayBuffer`, and `AggregateError`
values are not supported.

Treat typed views as binary values. Store metadata in a sibling form field
because extended typed-view objects are not supported.

Array path segments must be canonical indices from `0` through `4294967294`. The
package rejects malformed numeric paths at runtime.

TypeScript's `${number}` template type cannot exclude every negative,
fractional, or exponent spelling.

### `form.useField(name)`

`form.useField()` subscribes a component to one field. It returns the field
state and typed operations.

### `form.useFormState(selector)`

`form.useFormState()` subscribes a component to one selected result. Other form
updates do not re-render the component.

```tsx
function EmailEditor() {
  const form = useForm({
    initialValues: { email: "", acceptedTerms: false },
  });
  const email = form.useField("email");
  const canSubmit = form.useFormState(
    (state) => state.isValid && state.values.acceptedTerms,
  );

  return (
    <>
      <input
        value={email.value}
        onChange={(event) => email.setValue(event.currentTarget.value)}
        onBlur={() => email.setTouched(true)}
      />
      <button disabled={!canSubmit}>Continue</button>
    </>
  );
}
```

### `form.batch(callback)`

`form.batch()` groups synchronous updates into one notification.

```typescript
form.batch(() => {
  form.setFieldValue("email", "person@example.com");
  form.setFieldTouched("email", true);
});
```

### `form.FieldArray`

`form.FieldArray` gives each item a stable React key. Its `helpers` value
contains the array operations.

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
        onClick={() => helpers.append({ name: "", active: true })}
      >
        Add user
      </button>
    </>
  )}
</form.FieldArray>;
```

### `zodForm(schema, initialValues)`

`zodForm()` returns `initialValues` and `validate`. Pass both values to
`useForm()`.

```tsx
import { z } from "zod";
import { useForm } from "@lpm.dev/neo.react-forms";
import { zodForm } from "@lpm.dev/neo.react-forms/adapters";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const form = useForm({
  ...zodForm(schema, { email: "", password: "" }),
  onSubmit: async (values) => {
    await api.signup(values);
  },
});
```

## Security

Debug snapshots and logs redact common credential fields by default. These
fields include passwords, tokens, API keys, and card data.

```typescript
import {
  createFormSnapshot,
  exposeFormToWindow,
} from "@lpm.dev/neo.react-forms/devtools";

const snapshot = createFormSnapshot(form, initialValues, {
  sensitiveFields: ["recoveryPhrase", /^payment\./],
});

const cleanup = exposeFormToWindow("signup-form", snapshot, {
  enabled: true,
});

cleanup();
```

Browser-global exposure is available by default only in `development` and `test`
environments.

Other or missing environment labels require `allowInProduction: true`. If you
accept the disclosure risk, set `includeSensitiveValues: true`.

## Performance

The repository contains reproducible benchmarks for form operations, React
rendering, large forms, and memory retention.

See [BENCHMARKS.md](./BENCHMARKS.md) for the method, results, and limits.

Run the benchmark suite:

```bash
lpm run bench
```

Benchmark results depend on the runtime and computer.

## Runtime support

- **Node.js:** 18 or later for development, builds, and server rendering
- **Browsers:** Browsers that React 18 or React 19 supports
- **React:** 18 or 19
- **Module formats:** ESM and CommonJS
- **TypeScript:** Declaration files are included

## Package entry points

| Import                                | Purpose                                       |
| ------------------------------------- | --------------------------------------------- |
| `@lpm.dev/neo.react-forms`            | Main hooks, components, types, and form store |
| `@lpm.dev/neo.react-forms/validators` | Built-in validators and composition helpers   |
| `@lpm.dev/neo.react-forms/adapters`   | Optional Zod adapter                          |
| `@lpm.dev/neo.react-forms/devtools`   | Debug snapshots and optional browser exposure |

## Documentation

- [API reference](./docs/API.md)
- [TypeScript guide](./docs/TYPESCRIPT-GUIDE.md)
- [Formik migration](./docs/MIGRATION-FORMIK.md)
- [React Hook Form migration](./docs/MIGRATION-RHF.md)

## Development

Run all release checks:

```bash
lpm run release:check
```

The release checks include types, coverage, server rendering, memory, package,
and benchmark checks.

## License

MIT. See [LICENSE](./LICENSE).
