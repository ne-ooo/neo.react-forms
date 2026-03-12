# TypeScript Guide

Advanced TypeScript usage with @lpm.dev/neo.react-forms.

---

## Perfect Type Inference

**Zero manual generics needed!** TypeScript infers everything from \`initialValues\`:

\`\`\`tsx
const form = useForm({
  initialValues: {
    user: {
      name: '',
      age: 0,
    },
  },
})

// ✅ Full autocomplete
form.setValue('user.name', 'John')
//            ^^^^^^^^^^^ Autocomplete shows all paths

// ✅ Type checking
form.setValue('user.age', '25')
//                        ^^^^ Error: Type 'string' not assignable to 'number'

// ✅ Return type inference
const name = form.getValue('user.name') // string
const age = form.getValue('user.age')   // number
\`\`\`

---

## Type Utilities

### Path<T>

Generate all valid paths for a type:

\`\`\`tsx
type User = {
  name: string
  profile: {
    age: number
  }
}

type UserPath = Path<User>
// 'name' | 'profile' | 'profile.age'
\`\`\`

### ValueAtPath<T, P>

Get the type at a specific path:

\`\`\`tsx
type AgeType = ValueAtPath<User, 'profile.age'> // number
\`\`\`

---

## Typed Validators

Validators are fully typed:

\`\`\`tsx
import { Validator } from '@lpm.dev/neo.react-forms'

// Simple validator
const emailValidator: Validator<string> = (value) => {
  return value.includes('@') ? undefined : 'Invalid email'
}

// Validator with form values access
const confirmPasswordValidator: Validator<string, FormValues> = (
  value,
  values
) => {
  return value === values.password ? undefined : 'Passwords must match'
}
\`\`\`

---

## Zod Integration

Perfect type inference from Zod schemas:

\`\`\`tsx
import { zodForm } from '@lpm.dev/neo.react-forms/adapters'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  age: z.number().int().min(18),
})

const form = zodForm({
  schema,
  onSubmit: (values) => {
    // values is typed as:
    // { email: string; age: number }
    values.email // string
    values.age   // number
  },
})
\`\`\`

---

## Strict Mode

neo.react-forms is built with TypeScript strict mode:

\`\`\`json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  }
}
\`\`\`

---

## Advanced Patterns

### Conditional Types

\`\`\`tsx
type ConditionalForm<T> = T extends { requiresPassword: true }
  ? { password: string }
  : {}

const form = useForm<ConditionalForm<Config>>({
  initialValues: config.requiresPassword
    ? { password: '' }
    : {},
})
\`\`\`

### Discriminated Unions

\`\`\`tsx
type FormValues =
  | { type: 'email'; email: string }
  | { type: 'phone'; phone: string }

const form = useForm<FormValues>({
  initialValues: { type: 'email', email: '' },
  validate: {
    email: (value, values) => {
      if (values.type === 'email') {
        // TypeScript knows email exists here
        return value.includes('@') ? undefined : 'Invalid'
      }
      return undefined
    },
  },
})
\`\`\`

---

## Type-Safe Field Arrays

\`\`\`tsx
interface Todo {
  text: string
  done: boolean
}

const form = useForm({
  initialValues: {
    todos: [] as Todo[],
  },
})

// ✅ Fully typed
<form.FieldArray name="todos">
  {({ append }) => (
    <button onClick={() => append({ text: '', done: false })}>
      {/*                       ^^^^^^^^^^^^^^^^^^^^^^^ */}
      {/*                       Typed as Todo */}
      Add
    </button>
  )}
</form.FieldArray>
\`\`\`

---

## Tips

1. **Let TypeScript infer** - Don't add manual types unless necessary
2. **Use autocomplete** - Press Ctrl+Space to see available paths
3. **Check errors** - Hover over red squiggles for helpful messages
4. **Trust the types** - If TypeScript says it's wrong, it probably is

---

See [API Reference](./API.md) for complete type definitions.
