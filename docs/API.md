# API Reference

This document describes the public API for `@lpm.dev/neo.react-forms` version 1.0.0.

## Package entry points

```ts
import { FormStore, useForm } from '@lpm.dev/neo.react-forms'
import { required, compose } from '@lpm.dev/neo.react-forms/validators'
import { email } from '@lpm.dev/neo.react-forms/validators/string'
import { min } from '@lpm.dev/neo.react-forms/validators/number'
import { optional } from '@lpm.dev/neo.react-forms/validators/compose'
import { zodAdapter, zodForm } from '@lpm.dev/neo.react-forms/adapters'
import { configureDebug } from '@lpm.dev/neo.react-forms/devtools'
```

The root package also exports validators as a namespace.

```ts
import { validators } from '@lpm.dev/neo.react-forms'

validators.required()
```

## `useForm`

`useForm` creates form state, two bound hooks, and two bound components.

```ts
function useForm<Values extends object>(
  options: UseFormOptions<Values>
): UseFormReturn<Values>
```

### Options

```ts
interface UseFormOptions<Values extends object> {
  initialValues: Values
  validate?: ValidationSchema<Values>
  validateForm?: FormValidator<Values>
  onSubmit?: (values: Values) => void | Promise<void>
  onSubmitError?: (error: unknown) => void
  mode?: 'onBlur' | 'onChange' | 'onSubmit' | 'all'
  reValidateMode?: 'onBlur' | 'onChange' | 'onSubmit' | 'all'
  computed?: {
    [K in keyof Values]?: (values: Values) => Values[K]
  }
}
```

`mode` defaults to `onBlur`. `reValidateMode` defaults to `onChange`.

Computed fields must use top-level keys. Do not create a computed-field cycle.

### Returned state and operations

```ts
interface UseFormReturn<Values extends object> {
  values: Values
  errors: Partial<Record<Path<Values>, string>>
  touched: Partial<Record<Path<Values>, boolean>>
  isValid: boolean
  isDirty: boolean
  isSubmitting: boolean
  isSubmitted: boolean
  isValidating: boolean
  submitCount: number

  setFieldValue<P extends Path<Values>>(
    name: P,
    value: ValueAtPath<Values, P>
  ): void
  setFieldError<P extends Path<Values>>(
    name: P,
    error: string | undefined
  ): void
  setFieldTouched<P extends Path<Values>>(name: P, touched: boolean): void
  getFieldState<P extends Path<Values>>(
    name: P
  ): FieldState<ValueAtPath<Values, P>>
  validateField<P extends Path<Values>>(name: P): Promise<boolean>
  validate(): Promise<boolean>
  handleSubmit(event?: FormEvent): Promise<void>
  reset(values?: Partial<Values>): void
  batch<Result>(callback: () => Result): Result
  subscribe<P extends Path<Values>>(
    name: P,
    callback: (state: FieldState<ValueAtPath<Values, P>>) => void
  ): () => void

  useField<P extends Path<Values>>(
    name: P
  ): UseFieldReturn<ValueAtPath<Values, P>>
  useFormState<Selected>(
    selector: (state: DeepReadonly<FormState<Values>>) => Selected,
    isEqual?: (previous: Selected, next: Selected) => boolean
  ): Selected

  Field: BoundFieldComponent<Values>
  FieldArray: BoundFieldArrayComponent<Values>
}
```

Reading form state during render subscribes the owner to that state slice. A bound Field subscribes only to its own field state.

### `form.useField`

Call `form.useField(name)` at the top level of a React component. The hook subscribes only to the specified field.

```tsx
const email = form.useField('email')

return (
  <input
    value={email.value}
    onChange={(event) => email.setValue(event.currentTarget.value)}
    onBlur={() => email.setTouched(true)}
  />
)
```

The hook returns `value`, `error`, `touched`, `dirty`, and `isValidating`. It also returns four typed operations.

```ts
interface UseFieldReturn<Value> extends FieldState<Value> {
  setValue(value: Value): void
  setError(error: string | undefined): void
  setTouched(touched: boolean): void
  validate(): Promise<boolean>
}
```

### `form.useFormState`

Call `form.useFormState(selector)` at the top level of a React component. The component re-renders only when the selected result changes.

```tsx
const canSubmit = form.useFormState(
  (state) => state.isValid && state.isDirty && !state.isSubmitting
)
```

The default comparison uses `Object.is`. Supply an equality function when the selector returns a new object.

```tsx
const status = form.useFormState(
  (state) => ({ valid: state.isValid, dirty: state.isDirty }),
  (previous, next) =>
    previous.valid === next.valid && previous.dirty === next.dirty
)
```

### `form.batch`

`form.batch(callback)` groups synchronous updates into one notification transaction. Nested batches also send one final notification.

```ts
form.batch(() => {
  form.setFieldValue('country', 'GB')
  form.setFieldValue('city', 'London')
  form.setFieldTouched('country', true)
})
```

The store also batches reset, validation, and field-array transactions.

## `Field`

```tsx
<form.Field
  name="age"
  inputType="number"
  mode="onChange"
>
  {({ props, value, error, touched, dirty, isValidating, setValue }) => (
    <>
      <input {...props} type="number" />
      {touched && error ? <span role="alert">{error}</span> : null}
      <button type="button" onClick={() => setValue(0)}>
        Clear
      </button>
    </>
  )}
</form.Field>
```

Field options are:

- `name`: A typed field path.
- `inputType`: `text`, `number`, `checkbox`, `file`, or `select-multiple`.
- `parse`: A custom DOM event parser.
- `mode`: A field-level validation mode.
- `reValidateMode`: A field-level revalidation mode.
- `validate`: A field-level validator.

The render function receives `props`. Spread these props on the input. It also receives field state and the `setValue`, `setError`, `setTouched`, and `validate` helpers.

## `FieldArray`

`FieldArray` accepts only array-valued paths.

```tsx
<form.FieldArray name="todos">
  {({ fields, helpers }) => (
    <>
      {fields.map((field) => (
        <div key={field.key}>
          <form.Field name={`todos.${field.index}.text`}>
            {({ props }) => <input {...props} />}
          </form.Field>
          <button type="button" onClick={() => helpers.remove(field.index)}>
            Remove
          </button>
        </div>
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

Each field item has `key`, `value`, and `index` properties.

```ts
interface FieldArrayHelpers<T> {
  append(value: T): void
  prepend(value: T): void
  insert(index: number, value: T): void
  remove(index: number): void
  move(fromIndex: number, toIndex: number): void
  swap(indexA: number, indexB: number): void
  replace(values: T[]): void
  clear(): void
}
```

## Validators

Import validators from the validator entry point.

```ts
import { compose, email, required } from '@lpm.dev/neo.react-forms/validators'
```

### Validator type and context

```ts
type Validator<T, Values = unknown> = (
  value: T,
  values?: Values,
  context?: ValidationContext<Values>
) => string | null | undefined | Promise<string | null | undefined>

interface ValidationContext<Values = unknown> {
  readonly name: string
  readonly signal: AbortSignal
  readonly values: DeepReadonly<Values>
}
```

Use `context.signal` to stop obsolete asynchronous work.

Each validation run receives one detached value snapshot. The `values` argument and `context.values` reference this snapshot.

The snapshot has read-only TypeScript properties. A mutation cannot change the live form state.

### String validators

```ts
required(message?: string): Validator<string>
email(message?: string): Validator<string>
url(message?: string, options?: UrlValidatorOptions): Validator<string>
minLength(minimum: number, message?: string): Validator<string>
maxLength(maximum: number, message?: string): Validator<string>
pattern(expression: RegExp, message?: string): Validator<string>
alphanumeric(message?: string): Validator<string>
alpha(message?: string): Validator<string>
lowercase(message?: string): Validator<string>
uppercase(message?: string): Validator<string>
trimmed(message?: string): Validator<string>
contains(substring: string, message?: string): Validator<string>
startsWith(prefix: string, message?: string): Validator<string>
endsWith(suffix: string, message?: string): Validator<string>
```

`url` permits HTTP and HTTPS by default. Configure other protocols explicitly.

```ts
url('Invalid documentation link', {
  protocols: ['https', 'mailto'],
})
```

`pattern` is deterministic when an expression uses the `g` or `y` flag.

### Number validators

```ts
min(minimum: number, message?: string): Validator<number>
max(maximum: number, message?: string): Validator<number>
between(minimum: number, maximum: number, message?: string): Validator<number>
integer(message?: string): Validator<number>
positive(message?: string): Validator<number>
negative(message?: string): Validator<number>
nonNegative(message?: string): Validator<number>
nonPositive(message?: string): Validator<number>
safeInteger(message?: string): Validator<number>
finite(message?: string): Validator<number>
multipleOf(divisor: number, message?: string): Validator<number>
even(message?: string): Validator<number>
odd(message?: string): Validator<number>
```

All number validators reject `NaN` and infinity. Range limits must be finite. `multipleOf` throws `RangeError` for zero or a non-finite divisor.

### Composition validators

```ts
compose<T, Values>(
  validators: Validator<T, Values>[]
): Validator<T, Values>

optional<T, Values>(
  validator: Validator<T, Values>
): Validator<T | null | undefined, Values>

when<T, Values>(
  condition: (
    value: T,
    values?: Values,
    context?: ValidationContext<Values>
  ) => boolean | Promise<boolean>,
  validator: Validator<T, Values>
): Validator<T, Values>

custom<T, Values>(validator: Validator<T, Values>): Validator<T, Values>
test<T, Values>(
  predicate: (
    value: T,
    values?: Values,
    context?: ValidationContext<Values>
  ) => boolean | Promise<boolean>,
  message: string
): Validator<T, Values>
oneOf<T>(values: T[], message?: string): Validator<T>
notOneOf<T>(values: T[], message?: string): Validator<T>
equals<T>(expected: T, message?: string): Validator<T>
notEquals<T>(value: T, message?: string): Validator<T>
```

`compose` runs validators in order and returns the first error.

```ts
compose([required(), email(), maxLength(255)])
```

`compose`, `optional`, `when`, `custom`, and `test` preserve the validation context.

## Zod adapter

Use `zodAdapter` when you already provide initial values.

```ts
const form = useForm({
  initialValues: { email: '' },
  validate: zodAdapter(z.object({ email: z.string().email() })),
})
```

Use `zodForm` to create both options.

```ts
const schema = z.object({
  email: z.string().email(),
  age: z.number().int().min(18),
})

const form = useForm({
  ...zodForm(schema, { email: '', age: 18 }),
  onSubmit: async (values) => {
    await save(values)
  },
})
```

## DevTools privacy

Import DevTools functions as named exports.

```ts
import {
  configureDebug,
  createFormSnapshot,
  exposeFormToWindow,
  logFormState,
} from '@lpm.dev/neo.react-forms/devtools'
```

Snapshots and logs redact common secret fields by default. You can add application-specific fields.

```ts
const snapshot = createFormSnapshot(form, initialValues, {
  sensitiveFields: ['recoveryPhrase', /^identity\./],
  redactor: (value, path) => (path === 'email' ? '[EMAIL]' : value),
})

logFormState('signup', snapshot)
```

A string matches an exact path or its final field name. Use a regular expression for a path prefix or another pattern.

Set `includeSensitiveValues: true` only when you accept the disclosure risk.

Browser-global exposure needs explicit enablement. It is disabled in production by default.

```ts
const cleanup = exposeFormToWindow('signup', snapshot, {
  enabled: true,
})

cleanup()
```

Set `allowInProduction: true` only for an approved production diagnostic session.

Debug value logs use the same default redaction rules.

```ts
configureDebug({
  enabled: true,
  sensitiveFields: ['recoveryPhrase'],
})
```

## Accessibility helpers

```ts
import {
  announceToScreenReader,
  generateFieldIds,
  getErrorProps,
  getFieldAriaProps,
  getLabelProps,
} from '@lpm.dev/neo.react-forms/devtools'
```

Use a stable form prefix when more than one form can contain the same field name.

```ts
const ids = generateFieldIds('email', 'signup')
const labelProps = getLabelProps('email', 'Email', 'signup')
const errorProps = getErrorProps('email', error, 'signup')
const fieldProps = getFieldAriaProps({
  name: 'email',
  hasError: Boolean(error),
  isRequired: true,
  errorId: ids.errorId,
})
```

`announceToScreenReader` is safe during server rendering. It returns a cleanup function.

```ts
const cleanup = announceToScreenReader('Form saved')
cleanup()
```

## Type utilities

- `Path<T>` returns valid nested and array paths.
- `ArrayPath<T>` returns only array-valued paths.
- `ValueAtPath<T, P>` returns the value type at a path.
- `ValidationSchema<T>` describes field validation.

```ts
type Values = {
  users: Array<{ email: string }>
  tags: readonly string[]
}

type AnyPath = Path<Values> // 'users' | 'users.0' | 'users.0.email' | 'tags' | 'tags.0'
type ArrayOnly = ArrayPath<Values> // 'users' | 'tags'
type Email = ValueAtPath<Values, 'users.0.email'> // string
```

## Release checks

```bash
lpm run release:check
```

This command runs source, public, test, benchmark, ESM, and CommonJS checks. It also runs tests, builds, package smoke tests, explicit-GC memory tests, and the release benchmark gate.
