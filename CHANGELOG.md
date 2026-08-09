# Changelog

All notable changes to @lpm.dev/neo.react-forms will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- Add the typed `form.useField(name)` hook for isolated field subscriptions.
- Add the selector-based `form.useFormState(selector)` hook.
- Add `form.batch()` for synchronous notification transactions.
- Add detached, read-only form values to each field-validation context.
- Document custom sensitive-field paths for DevTools redaction.

### Security

- Redact common credential fields in snapshots and debug logs by default.
- Require explicit enablement for browser-global form exposure.
- Disable browser-global exposure in production by default.
- Restrict the URL validator to HTTP and HTTPS by default.

### Fixed

- Forward validation context through composition helpers.
- Make global and sticky regular expression validators deterministic.
- Reject non-finite numbers across number validators.
- Reject zero and non-finite `multipleOf` divisors.
- Make screen-reader announcements safe during server rendering.
- Add safe, prefixed accessibility IDs and reliable live-region cleanup.

### Documentation

- Correct Field render props, form operation names, FieldArray helpers, and Zod examples.
- Document DevTools privacy options and the release gate.

## [1.0.0] - 2026-02-20

### Initial Release

### Added

#### Core Features
- ⚡ **useForm hook** - Main form management hook with perfect TypeScript inference
- 🎨 **Field component** - Field-level subscriptions with zero re-render cascade
- 📋 **FieldArray component** - Dynamic array field management with 8 operations
- 🔄 **Async validation** - Built-in debouncing and race condition handling
- 🧮 **Computed fields** - Automatic field value computation
- 🎯 **Conditional validation** - Validators with access to all form values
- 🌐 **SSR support** - Full server-side rendering compatibility

#### Validation (36 Validators)
- 📝 **14 string validators** - required, email, url, minLength, maxLength, pattern, alphanumeric, alpha, lowercase, uppercase, trimmed, contains, startsWith, endsWith
- 🔢 **13 number validators** - min, max, between, integer, positive, negative, nonNegative, nonPositive, safeInteger, finite, multipleOf, even, odd
- 🔗 **9 composition utilities** - compose, optional, when, custom, test, oneOf, notOneOf, equals, notEquals

#### Adapters
- 🔌 **Zod adapter** - Full Zod schema integration with perfect type inference
- 🎭 **zodForm helper** - Quick setup for Zod-based forms

#### Developer Tools
- 🐛 **Debug mode** - Configurable logging for form operations
- ♿ **Accessibility helpers** - ARIA attribute generation and screen reader support
- 💡 **Enhanced error messages** - Error suggestions and codes
- 🔍 **DevTools integration** - Form state snapshots, diffing, and window exposure
- ⚡ **Performance monitoring** - Built-in performance tracking utilities

#### Performance
- Field-level subscriptions with `useSyncExternalStore`
- Tree-shakeable package entry points
- Memory regression tests

#### Developer Experience
- 🎯 **Perfect TypeScript** - Zero manual generics, full path autocomplete
- 🌳 **Tree-shakeable** - Import only what you need
- 🔒 **Zero dependencies** - No runtime dependencies
- 📚 **Comprehensive docs** - API reference, migration guides, TypeScript guide
- ✅ Automated tests and public package typechecks

### Links
- [Documentation](./README.md)
- [API Reference](./docs/API.md)
- [Benchmark Guide](./BENCHMARKS.md)
- [Migration from Formik](./docs/MIGRATION-FORMIK.md)
- [Migration from React Hook Form](./docs/MIGRATION-RHF.md)

---

## Future Plans

### Planned Features
- Additional schema adapters (Valibot, ArkType)
- React Native support
- Form persistence utilities
- Additional validators (credit card, phone, etc.)
- Chrome DevTools extension

---

**Full Changelog**: https://github.com/ne-ooo/neo.react-forms/commits/main
