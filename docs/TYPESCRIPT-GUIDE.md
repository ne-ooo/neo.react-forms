# TypeScript Guide

`useForm` infers the form type from `initialValues`. You usually do not need a generic argument.

## Inferred paths and values

```tsx
import { useForm } from '@lpm.dev/neo.react-forms'

const form = useForm({
  initialValues: {
    user: {
      name: '',
      age: 0,
    },
  },
})

form.setFieldValue('user.name', 'Ada')
form.setFieldValue('user.age', 42)

form.setFieldValue('user.age', '42') // TypeScript error
form.setFieldValue('user.missing', '') // TypeScript error

const age = form.getFieldState('user.age').value // number
```

## Typed subscription hooks

The bound field hook infers its value type from the path.

```tsx
const age = form.useField('user.age')

age.setValue(42)
age.setValue('42') // TypeScript error
```

The form-state selector infers its result type.

```tsx
const userName = form.useFormState((state) => state.values.user.name)
// userName is string
```

## Public type utilities

Import public types with a type-only import.

```ts
import type {
  ArrayPath,
  Path,
  ValidationContext,
  Validator,
  ValueAtPath,
} from '@lpm.dev/neo.react-forms'
```

### `Path<T>`

`Path<T>` creates valid object and array paths.

```ts
type Values = {
  profile?: {
    birthday: Date
  }
  users: Array<{ name: string; active: boolean }>
}

type ValuesPath = Path<Values>
// 'profile' | 'profile.birthday' | 'users' | `users.${number}`
// | `users.${number}.name` | `users.${number}.active`
```

Built-in leaf values do not expose their prototype methods as form paths. For example, `profile.birthday.getTime` is not a valid path.

The reserved segments `__proto__`, `prototype`, and `constructor` are not form
paths. Store such data under a different field name.

### `ArrayPath<T>`

`ArrayPath<T>` returns only paths that contain arrays.

```ts
type ListPath = ArrayPath<Values> // 'users'
```

`FieldArray` uses this type. A scalar field cannot be passed to `FieldArray`.

### `ValueAtPath<T, P>`

`ValueAtPath<T, P>` returns the value type at a path.

```ts
type UserName = ValueAtPath<Values, 'users.0.name'> // string
```

## Typed validators

```ts
interface FormValues {
  password: string
  confirmPassword: string
}

const confirmPassword: Validator<string, FormValues> = (
  value,
  _values,
  context
) => {
  if (context?.signal.aborted) return undefined
  return value === context?.values.password ? undefined : 'Passwords must match'
}
```

The validation context contains the field name, an `AbortSignal`, and a detached value snapshot. The snapshot has read-only properties.

The legacy `values` argument references the same `DeepReadonly` snapshot.

```ts
const uniqueEmail: Validator<string> = async (value, _values, context) => {
  const response = await fetch(`/api/email?value=${encodeURIComponent(value)}`, {
    signal: context?.signal,
  })
  const result = await response.json()
  return result.available ? undefined : 'Email is already registered'
}
```

Composition helpers preserve this context.

## Typed field arrays

```tsx
interface Todo {
  text: string
  done: boolean
}

const form = useForm({
  initialValues: {
    todos: [] as Todo[],
  },
})

<form.FieldArray name="todos">
  {({ fields, helpers }) => (
    <>
      {fields.map((field) => (
        <span key={field.key}>{field.value.text}</span>
      ))}
      <button
        type="button"
        onClick={() => helpers.append({ text: '', done: false })}
      >
        Add
      </button>
    </>
  )}
</form.FieldArray>
```

The argument to `helpers.append` is a `Todo`. The compiler rejects another value type.

## Input value parsing

Set `inputType` when a DOM input does not produce a string value.
The selected parser must be compatible with the field type. A number input must
allow `undefined` because clearing the DOM input stores `undefined`.

```tsx
<form.Field name="age" inputType="number">
  {({ props }) => <input {...props} type="number" />}
</form.Field>

<form.Field name="accepted" inputType="checkbox">
  {({ props }) => <input {...props} type="checkbox" />}
</form.Field>
```

Use `parse` for an application-specific conversion.

```tsx
<form.Field
  name="amount"
  parse={(event) => Math.round(Number(event.target.value) * 100)}
>
  {({ props }) => <input {...props} inputMode="decimal" />}
</form.Field>
```

## Zod inference

`zodForm` accepts a schema and initial values. Spread its result into `useForm`.

```ts
import { z } from 'zod'
import { useForm } from '@lpm.dev/neo.react-forms'
import { zodForm } from '@lpm.dev/neo.react-forms/adapters'

const schema = z.object({
  email: z.string().email(),
  age: z.number().int().min(18),
})

const form = useForm({
  ...zodForm(schema, { email: '', age: 18 }),
  onSubmit: (values) => {
    values.email // string
    values.age // number
  },
})
```

## Typecheck a consumer package

The release gate compiles public ESM and CommonJS consumers. Run it before publication.

```bash
lpm run typecheck:public
lpm run build
lpm run typecheck:package
lpm run test:package
```
