---
name: anti-patterns
description: Common mistakes when using neo.react-forms — broad form state reads reduce field isolation, compose returns the first error, reset merges values, computed fields must not form cycles, touched state persists, async validators cancel previous work, FieldArray requires field.key
version: "1.0.0"
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---

# Anti-Patterns for @lpm.dev/neo.react-forms

### [CRITICAL] Reading `form.values` inside `<form.Field>` defeats field-level subscriptions

Wrong:

```tsx
// AI reads form.values inside Field — causes re-render on ANY field change
<form.Field name="email">
  {({ props, error }) => (
    <div>
      <input {...props} />
      {/* This reads form.values — now this Field re-renders when ANY value changes */}
      <span>Welcome, {form.values.name}</span>
    </div>
  )}
</form.Field>
```

Correct:

```tsx
// Use separate Field components for each value
<form.Field name="email">
  {({ props, error }) => (
    <div>
      <input {...props} />
    </div>
  )}
</form.Field>

{/* Display name in its own Field subscription */}
<form.Field name="name">
  {({ value }) => <span>Welcome, {value}</span>}
</form.Field>

// Or use form.subscribe() for cross-field reads
const [name, setName] = useState('')
useEffect(() => {
  return form.subscribe('name', (state) => setName(state.value))
}, [])
```

Reading `form.values` or `form.errors` subscribes the form owner to a broad state slice. A change to that slice renders the owner again.

Use a separate Field for each value. This keeps the form owner out of field updates.

Source: `src/hooks/useForm.tsx` and `src/components/Field.tsx` — slice and field subscriptions

### [HIGH] `compose()` returns only the FIRST error — not all errors

Wrong:

```tsx
// AI expects all validation errors at once
const validate = compose([required(), minLength(8), pattern(/[A-Z]/, 'Need uppercase')])

// If value is empty, ONLY "Required" is returned
// minLength and pattern errors are NOT shown
```

Correct:

```tsx
// compose() short-circuits on first error — this is by design
compose([required(), minLength(8), pattern(/[A-Z]/)])
// Empty → "Required"
// "ab" → "Must be at least 8 characters"
// "abcdefgh" → "Need uppercase"

// Order validators from most basic to most specific:
compose([
  required(),           // 1. Is it present?
  minLength(8),         // 2. Is it long enough?
  pattern(/[A-Z]/),     // 3. Has uppercase?
  pattern(/\d/),        // 4. Has digit?
])

// If you need ALL errors simultaneously, use a custom validator:
custom((value) => {
  const errors = []
  if (value.length < 8) errors.push('Min 8 characters')
  if (!/[A-Z]/.test(value)) errors.push('Need uppercase')
  if (!/\d/.test(value)) errors.push('Need digit')
  return errors.length ? errors.join(', ') : null
})
```

`compose()` runs validators sequentially and returns the first non-null error. Put the most fundamental checks first (required → format → business logic).

Source: `src/validators/compose.ts` — returns on first error

### [HIGH] Do not expect `onSubmit` validation to run on blur

Wrong:

```tsx
const form = useForm({
  initialValues: { email: '' },
  validate: { email: required() },
  mode: 'onSubmit',
})

// Wrong expectation: blur validates the field.
// Actual behavior: only form.handleSubmit() starts the first validation.
```

Correct:

```tsx
// Keep the form in onSubmit mode.
// After the first validation, reValidateMode controls later checks.
const form = useForm({
  initialValues: { email: '' },
  validate: { email: required() },
  mode: 'onSubmit',
  reValidateMode: 'onChange',
})
```

The form-level mode is also the default Field mode. `onSubmit` does not validate on change or blur. After validation, `reValidateMode` controls the next check.

Source: `src/hooks/useForm.tsx` and `src/components/Field.tsx` — validation mode handling

### [HIGH] `reset()` merges new values — it doesn't replace

Wrong:

```tsx
// AI expects reset to fully replace initial values
form.reset({ email: 'new@example.com' })
// AI thinks form.values is now { email: 'new@example.com' }
// Actual: { email: 'new@example.com', password: '' (original), name: '' (original) }
```

Correct:

```tsx
// reset() merges the provided values with existing initialValues
form.reset({ email: 'new@example.com' })
// Result: { email: 'new@example.com', password: '', name: '' }
// Only email changed, other fields keep their initial values

// Full reset to original initialValues:
form.reset()

// Reset also clears errors, touched state, and updates computed fields
```

`reset()` accepts a `Partial<Values>` — it merges with the current initial values, it doesn't replace them. Call `reset()` with no arguments to reset everything to the original initial values.

Source: `src/core/store.ts` — reset merges with initial values

### [INFO] `isDirty` uses incremental path data

`isDirty` does not serialize the form. The store updates dirty paths when a value changes.

The dirty state supports nested objects, arrays, dates, and BigInt values. Reading `isDirty` subscribes the form owner only to dirty-state changes.

Source: `src/core/store.ts` — incremental dirty-path data

### [MEDIUM] Computed fields must not form dependency cycles

Computed fields can depend on source fields or other computed fields. The declaration order does not change the result.

The store updates only computed fields that depend on a changed source. It notifies subscribers only when a computed result changes.

The store rejects self-dependencies and circular dependencies with an error. The store also rejects computed functions that mutate form values.

Source: `src/core/store.ts` — computed dependency resolution

### [MEDIUM] `touched` never auto-resets — only the `<form.Field>` `onBlur` sets it

Wrong:

```tsx
// AI expects touched to reset when value changes back
form.setFieldValue('email', '')
form.setFieldTouched('email', true)
form.setFieldValue('email', 'user@example.com')
// touched is still true! Setting value doesn't reset touched
```

Correct:

```tsx
// touched is a one-way flag — once set, stays set until form.reset()
// This is intentional: the user HAS interacted with the field

// Field.props.onBlur handles touch automatically
<form.Field name="email">
  {({ props }) => <input {...props} />}
  {/* props includes onBlur that calls setFieldTouched(true) */}
</form.Field>

// To manually untouched (rare):
form.setFieldTouched('email', false)

// reset() clears all touched state
form.reset()
```

Touch state represents "has the user interacted with this field." It's set by the blur handler in `<form.Field>` props and only cleared by `reset()`. This prevents premature error display.

Source: `src/core/store.ts` — setTouched is explicit, no auto-reset

### [MEDIUM] Use `field.key` not `field.index` as React key in FieldArray

Wrong:

```tsx
// AI uses index as React key — causes state bugs on reorder/remove
<form.FieldArray name="items">
  {({ fields, helpers }) => (
    fields.map((field) => (
      <div key={field.index}>  {/* ❌ Index changes on remove/reorder! */}
        <form.Field name={`items.${field.index}.name`}>
          {(f) => <input {...f.props} />}
        </form.Field>
      </div>
    ))
  )}
</form.FieldArray>
```

Correct:

```tsx
// Use field.key — stable across add/remove/move/swap
<form.FieldArray name="items">
  {({ fields, helpers }) => (
    fields.map((field) => (
      <div key={field.key}>  {/* ✓ Stable identifier */}
        <form.Field name={`items.${field.index}.name`}>
          {(f) => <input {...f.props} />}
        </form.Field>
        <button onClick={() => helpers.remove(field.index)}>Remove</button>
      </div>
    ))
  )}
</form.FieldArray>
```

`field.key` is a unique, stable identifier generated by FieldArray. Using `field.index` as the React key causes input state to be lost when items are removed, reordered, or swapped — a common React anti-pattern.

Source: `src/components/FieldArray.tsx` — generates stable keys per item

### [MEDIUM] Async validators cancel previous — don't rely on all calls completing

Wrong:

```tsx
// AI expects every validation call to complete
let validationCount = 0
const checkAvailability = async (value: string) => {
  validationCount++  // Counting completed validations
  const result = await api.check(value)
  return result.taken ? 'Taken' : null
}

// As user types "abc", only the LAST call completes
// "a" → cancelled, "ab" → cancelled, "abc" → completes
// validationCount may be 1, not 3
```

Correct:

```tsx
// Use debounceValidator to reduce API calls
import { debounceValidator } from '@lpm.dev/neo.react-forms/validators'

const checkAvailability = debounceValidator(async (value: string) => {
  const result = await api.check(value)
  return result.taken ? 'Taken' : null
}, 300)

// Only fires after 300ms of inactivity
// Previous pending calls are cancelled via AbortController
// Field shows isValidating: true during the check
```

When a new validation starts on the same field, the previous validation is cancelled via AbortController. This prevents stale validation results from overwriting newer ones. Use `debounceValidator` to also reduce the number of API calls.

Source: `src/core/store.ts` — startValidation cancels previous via AbortController

### [CRITICAL] Do not expose sensitive DevTools values without approval

Wrong:

```tsx
const snapshot = createFormSnapshot(form, initialValues, {
  includeSensitiveValues: true,
})
exposeFormToWindow('payment', snapshot, {
  enabled: true,
  includeSensitiveValues: true,
  allowInProduction: true,
})
```

Correct:

```tsx
const snapshot = createFormSnapshot(form, initialValues)
const cleanup = exposeFormToWindow('payment', snapshot, {
  enabled: true,
})

useEffect(() => cleanup, [cleanup])
```

Snapshots and logs redact common credential fields by default. Global exposure needs explicit enablement. Production exposure needs a second opt-in. Remove the global value with the returned cleanup function.

Source: `src/utils/devtools.ts` — privacy defaults and exposure cleanup
