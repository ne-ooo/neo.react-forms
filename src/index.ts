/**
 * @lpm.dev/neo.react-forms
 *
 * Modern, performant React form library
 * - 78% smaller than Formik (< 10KB vs 44.7KB)
 * - Perfect TypeScript inference from initialValues
 * - Field-level subscriptions for isolated re-renders
 * - Zero runtime dependencies
 * - Tree-shakeable validators and adapters
 */

// Main hook
export { useForm } from './hooks/useForm.js'

// Types
export type {
  // Core types
  Path,
  ValueAtPath,
  ValidationMode,
  Validator,
  FormValidator,
  FieldValidation,
  ValidationSchema,

  // Form types
  UseFormOptions,
  UseFormReturn,
  FormState,
  FormOperations,

  // Field types
  FieldState,
  FieldProps,
  FieldRenderProps,
  FieldComponentProps,

  // Field array types
  FieldArrayItem,
  FieldArrayHelpers,
  FieldArrayRenderProps,
  FieldArrayComponentProps,

  // Utility types
  SubscriptionCallback,
  Unsubscribe,
} from './types.js'

// Core store (advanced usage only)
export { FormStore, getValueByPath, setValueByPath } from './core/store.js'

// Tree-shakeable validators (import only what you need!)
export * as validators from './validators/index.js'

// Schema adapters (Zod, Yup, etc.)
export { zodAdapter, zodForm, type ZodInfer } from './adapters/index.js'

// Developer tools (debug, accessibility, error messages)
export * as devtools from './devtools/index.js'
