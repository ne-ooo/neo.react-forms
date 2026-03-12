# @lpm.dev/neo.react-forms

**The fastest, smallest, and most performant React form library.**

[![npm version](https://img.shields.io/npm/v/@lpm.dev/neo.react-forms.svg)](https://www.npmjs.com/package/@lpm.dev/neo.react-forms)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@lpm.dev/neo.react-forms)](https://bundlephobia.com/package/@lpm.dev/neo.react-forms)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/npm/l/@lpm.dev/neo.react-forms.svg)](https://github.com/ne-ooo/neo.react-forms/blob/main/LICENSE)

---

## Why neo.react-forms?

- ⚡ **Blazing Fast**: 366,000+ ops/sec, 27-115% faster than alternatives
- 📦 **Tiny Bundle**: 7.1 KB gzipped (96% smaller than Formik, 83% smaller than RHF)
- 🎯 **Perfect TypeScript**: Zero manual generics, full path autocomplete
- 🔒 **Zero Dependencies**: No runtime dependencies
- 🎨 **Zero Re-renders**: Perfect field isolation with \`useSyncExternalStore\`
- 🌳 **Tree-Shakeable**: Import only what you need
- ✅ **Comprehensive**: 36 built-in validators, Zod adapter, DevTools
- 💾 **Memory Efficient**: Zero memory leaks, < 10 MB for 100+ field forms

---

## Quick Start

### Installation

\`\`\`bash
lpm install @lpm.dev/neo.react-forms
\`\`\`

### Basic Example

\`\`\`tsx
import { useForm } from '@lpm.dev/neo.react-forms'

function SignupForm() {
  const form = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    validate: {
      email: (value) => (value.includes('@') ? undefined : 'Invalid email'),
      password: (value) => (value.length >= 8 ? undefined : 'Too short'),
    },
    onSubmit: async (values) => {
      await api.signup(values)
    },
  })

  return (
    <form onSubmit={form.handleSubmit}>
      <form.Field name="email">
        {({ field, error, touched }) => (
          <div>
            <input type="email" {...field} />
            {touched && error && <span>{error}</span>}
          </div>
        )}
      </form.Field>

      <form.Field name="password">
        {({ field, error, touched }) => (
          <div>
            <input type="password" {...field} />
            {touched && error && <span>{error}</span>}
          </div>
        )}
      </form.Field>

      <button type="submit" disabled={form.isSubmitting}>
        Sign Up
      </button>
    </form>
  )
}
\`\`\`

---

## Features

### 🎯 Perfect TypeScript Inference

**Zero manual generics needed**. TypeScript infers everything from \`initialValues\`:

\`\`\`tsx
const form = useForm({
  initialValues: {
    user: {
      email: '',
      profile: {
        name: '',
        age: 0,
      },
    },
  },
})

// ✅ Full autocomplete for nested paths
form.setValue('user.profile.name', 'John')

// ✅ Type checking for values
form.setValue('user.profile.age', '25') // Error!
\`\`\`

### ⚡ Zero Re-renders

Unlike Formik which re-renders all fields on every change, **neo.react-forms** only re-renders the field that changed:

\`\`\`tsx
// Updating field0 re-renders ONLY field0 ✅
// field1-field99 DO NOT re-render! 🎉
form.setValue('field0', 'new value')
\`\`\`

### 📦 Tree-Shakeable Architecture

\`\`\`tsx
// Import only what you need
import { useForm } from '@lpm.dev/neo.react-forms'
import { email, minLength } from '@lpm.dev/neo.react-forms/validators'
import { zodForm } from '@lpm.dev/neo.react-forms/adapters'
\`\`\`

### ✅ Comprehensive Validation

**36 built-in validators** + Zod integration:

\`\`\`tsx
import { compose, required, email, minLength } from '@lpm.dev/neo.react-forms/validators'

const form = useForm({
  initialValues: { email: '', password: '' },
  validate: {
    email: compose(required(), email()),
    password: compose(required(), minLength(8)),
  },
})
\`\`\`

### 🔌 Zod Integration

\`\`\`tsx
import { zodForm } from '@lpm.dev/neo.react-forms/adapters'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const form = zodForm({
  schema,
  onSubmit: async (values) => {
    // values is fully typed! ✅
    await api.signup(values)
  },
})
\`\`\`

---

## Performance

### vs Formik & React Hook Form

| Metric | neo.react-forms | Formik | React Hook Form |
|--------|-----------------|--------|-----------------|
| **Bundle Size** | **7.1 KB** | 44.7 KB | 12.1 KB |
| **Operations/sec** | **366,000+** | ~30,000 | ~100,000 |
| **Re-renders** | **1** | 30+ | 1-2 |

**Results**:
- **96% smaller** than Formik
- **83% smaller** than React Hook Form  
- **27-115% faster** for large forms

See [BENCHMARK-RESULTS.md](./BENCHMARK-RESULTS.md) for detailed metrics.

---

## Documentation

- [API Reference](./docs/API.md)
- [TypeScript Guide](./docs/TYPESCRIPT-GUIDE.md)
- [Migration from Formik](./docs/MIGRATION-FORMIK.md)
- [Migration from React Hook Form](./docs/MIGRATION-RHF.md)
- [Examples](./examples/)

---

## License

MIT © [lpm.dev](https://lpm.dev)
