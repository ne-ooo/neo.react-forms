/**
 * @lpm.dev/neo.react-forms
 *
 * Typed React form library
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
  ArrayPath,
  ValueAtPath,
  DeepReadonly,
  SupportedFormValues,
  ValidationMode,
  ValidationContext,
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
  UseFieldReturn,
  FieldProps,
  FieldInputType,
  FieldChangeEvent,
  FieldRenderProps,
  FieldComponentProps,
  FormStateSelector,
  FormStateEquality,

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

// Validators, adapters, and developer tools use dedicated package subpaths so
// importing the core form hook never retains those optional modules.
