---
name: anti-patterns
description: Common mistakes when using neo.react-forms — Field only re-renders on its own changes (don't read form.values in Field children), compose returns first error only, onSubmit mode converts to onBlur for fields, reset merges values not replaces, isDirty uses JSON.stringify (slow for large objects), computed fields can infinite loop, touched never auto-resets, async validators cancel previous, FieldArray needs field.key not index for React key
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

The entire point of `<form.Field>` is field-level subscriptions — only re-rendering when that specific field changes. Accessing `form.values`, `form.errors`, or other form-wide state inside a Field breaks this isolation, causing all Fields to re-render on every change (like Formik).

Source: `src/components/Field.tsx` — uses `useSyncExternalStore` per field

### [HIGH] `compose()` returns only the FIRST error — not all errors

Wrong:

```tsx
// AI expects all validation errors at once
const validate = compose(required(), minLength(8), pattern(/[A-Z]/, 'Need uppercase'))

// If value is empty, ONLY "Required" is returned
// minLength and pattern errors are NOT shown
```

Correct:

```tsx
// compose() short-circuits on first error — this is by design
compose(required(), minLength(8), pattern(/[A-Z]/))
// Empty → "Required"
// "ab" → "Must be at least 8 characters"
// "abcdefgh" → "Need uppercase"

// Order validators from most basic to most specific:
compose(
  required(),           // 1. Is it present?
  minLength(8),         // 2. Is it long enough?
  pattern(/[A-Z]/),     // 3. Has uppercase?
  pattern(/\d/),        // 4. Has digit?
)

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

### [HIGH] `mode: 'onSubmit'` converts to `'onBlur'` for fields

Wrong:

```tsx
// AI expects no validation until submit
const form = useForm({
  initialValues: { email: '' },
  validate: { email: required() },
  mode: 'onSubmit',  // AI thinks: NO validation until form.handleSubmit()
})

// But fields still validate onBlur!
// User tabs out of empty email field → "Required" error appears
```

Correct:

```tsx
// 'onSubmit' mode converts to 'onBlur' at the field level
// This means: fields validate on blur, form validates on submit

// If you truly want NO validation until submit:
<form.Field name="email" mode="onSubmit">
  {({ props, error }) => ...}
</form.Field>

// Mode conversion table:
// Form mode    → Field mode
// 'onBlur'     → 'onBlur' (default)
// 'onChange'   → 'onChange'
// 'onSubmit'   → 'onBlur' (converted!)
// 'all'        → 'onChange' (converted!)
```

The form-level `mode` sets the default, but it's converted for field-level behavior. `'onSubmit'` becomes `'onBlur'` because fields need some validation feedback before the user submits. Override per-field if needed.

Source: `src/hooks/useForm.tsx` — mode conversion logic

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

### [MEDIUM] `isDirty` uses `JSON.stringify` — slow for large nested objects

Wrong:

```tsx
// AI uses isDirty in a performance-critical render path
// with a large form (100+ fields or deeply nested objects)
<button disabled={!form.isDirty || form.isSubmitting}>Save</button>
// isDirty runs JSON.stringify on EVERY render — O(n) comparison
```

Correct:

```tsx
// For simple forms, isDirty is fine
<button disabled={!form.isDirty}>Save</button>

// For large forms, track dirty state manually:
const [hasChanges, setHasChanges] = useState(false)
useEffect(() => {
  return form.subscribe('criticalField', () => setHasChanges(true))
}, [])

// Or check specific fields instead of entire form
const emailState = form.getFieldState('email')
emailState.dirty  // Only checks one field
```

`isDirty` compares `JSON.stringify(currentValues)` to `JSON.stringify(initialValues)` on every access. For forms with many fields or large nested objects, this can impact performance. Check individual field dirty state or track changes manually.

Source: `src/core/store.ts` — isDirty uses JSON.stringify comparison

### [MEDIUM] Computed fields can cause infinite loops

Wrong:

```tsx
// AI creates a computed field that depends on itself
const form = useForm({
  initialValues: { count: 0, doubled: 0 },
  computed: {
    // This triggers a value change, which triggers computed update, which...
    doubled: (values) => values.doubled + 1,  // INFINITE LOOP!
  },
})
```

Correct:

```tsx
// Computed fields should only depend on OTHER fields
const form = useForm({
  initialValues: { firstName: '', lastName: '', fullName: '' },
  computed: {
    fullName: (values) => `${values.firstName} ${values.lastName}`.trim(),
  },
})

// Computed fields update on every value change
// They notify subscribers, so Field components re-render

// Don't create circular dependencies between computed fields
// Bad: a depends on b, b depends on a
```

Computed fields run `updateComputedFields()` on every value change. If a computed field's output changes, it triggers another update. A field depending on itself or circular dependencies will loop infinitely.

Source: `src/core/store.ts` — updateComputedFields called on setValue

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
import { debounceValidator } from '@lpm.dev/neo.react-forms'

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
