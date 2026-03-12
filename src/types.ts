/**
 * Core TypeScript types for @lpm.dev/neo.react-forms
 *
 * This file defines all the type-level magic that enables:
 * - Perfect inference from initialValues
 * - Type-safe nested path access
 * - Automatic validation schema typing
 */

import type { FormEvent, ChangeEvent, FocusEvent } from 'react'
import type { FormStore } from './core/store.js'

/**
 * Extract all possible paths from a nested object
 *
 * @example
 * type Values = { user: { email: string; profile: { age: number } } }
 * type Paths = Path<Values>
 * // "user" | "user.email" | "user.profile" | "user.profile.age"
 */
export type Path<T> = T extends object
  ? {
      [K in keyof T]-?: K extends string
        ? T[K] extends Array<infer U>
          ? `${K}` | `${K}.${number}` | `${K}.${number}.${Path<U> & string}`
          : T[K] extends object
          ? `${K}` | `${K}.${Path<T[K]> & string}`
          : `${K}`
        : never
    }[keyof T]
  : never

/**
 * Get the type of value at a specific path
 *
 * @example
 * type Value = ValueAtPath<{ user: { email: string } }, 'user.email'>
 * // string
 */
export type ValueAtPath<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? ValueAtPath<T[K], Rest>
    : never
  : P extends keyof T
  ? T[P]
  : never

/**
 * Form validation modes
 */
export type ValidationMode = 'onBlur' | 'onChange' | 'onSubmit' | 'all'

/**
 * Validation function type
 * Supports conditional validation via optional values parameter
 */
export type Validator<T, Values = unknown> = (
  value: T,
  values?: Values
) => string | null | undefined | Promise<string | null | undefined>

/**
 * Form-level validation function
 */
export type FormValidator<Values> = (
  values: Values
) => Partial<Record<Path<Values>, string>> | null | undefined

/**
 * Field validation config
 */
export type FieldValidation<T, Values = unknown> = Validator<T, Values> | Validator<T, Values>[]

/**
 * Nested validation schema matching form structure
 */
export type ValidationSchema<Values> = {
  [K in keyof Values]?: Values[K] extends Array<infer U>
    ? FieldValidation<Values[K], Values> | ValidationSchema<U>
    : Values[K] extends object
    ? ValidationSchema<Values[K]> | FieldValidation<Values[K], Values>
    : FieldValidation<Values[K], Values>
}

/**
 * Form configuration options
 */
export interface UseFormOptions<Values extends Record<string, unknown>> {
  /**
   * Initial values for the form
   * All types will be inferred from this!
   */
  initialValues: Values

  /**
   * Validation schema (optional)
   * Can be nested to match form structure
   */
  validate?: ValidationSchema<Values>

  /**
   * Form-level validation (optional)
   * Runs after all field validators
   */
  validateForm?: FormValidator<Values>

  /**
   * Submit handler (optional)
   */
  onSubmit?: (values: Values) => void | Promise<void>

  /**
   * Submit error handler (optional)
   */
  onSubmitError?: (error: unknown) => void

  /**
   * When to validate fields
   * @default 'onBlur'
   */
  mode?: ValidationMode

  /**
   * When to re-validate after initial validation
   * @default 'onChange'
   */
  reValidateMode?: ValidationMode

  /**
   * Computed fields (derived values)
   * Functions that compute values based on other form values
   *
   * @example
   * ```ts
   * computed: {
   *   fullName: (values) => `${values.firstName} ${values.lastName}`,
   *   total: (values) => values.price * values.quantity
   * }
   * ```
   */
  computed?: {
    [K in keyof Values]?: (values: Values) => Values[K]
  }
}

/**
 * Field state
 */
export interface FieldState<T> {
  /**
   * Current field value
   */
  value: T

  /**
   * Field error message (if any)
   */
  error: string | undefined

  /**
   * Whether field has been touched (blurred)
   */
  touched: boolean

  /**
   * Whether field value differs from initial value
   */
  dirty: boolean

  /**
   * Whether field is currently validating (async)
   */
  isValidating: boolean
}

/**
 * Field props for input elements
 */
export interface FieldProps<T> {
  name: string
  value: T
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  onBlur: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
}

/**
 * Field render props
 */
export interface FieldRenderProps<T> extends FieldState<T> {
  /**
   * Props to spread on input element
   */
  props: FieldProps<T>

  /**
   * Set field value
   */
  setValue: (value: T) => void

  /**
   * Set field error
   */
  setError: (error: string | undefined) => void

  /**
   * Mark field as touched
   */
  setTouched: (touched: boolean) => void

  /**
   * Validate field
   */
  validate: () => Promise<boolean>
}

/**
 * Form state
 */
export interface FormState<Values extends Record<string, unknown>> {
  /**
   * Current form values (fully typed!)
   */
  values: Values

  /**
   * Form errors
   */
  errors: Partial<Record<Path<Values>, string>>

  /**
   * Touched fields
   */
  touched: Partial<Record<Path<Values>, boolean>>

  /**
   * Whether form is submitting
   */
  isSubmitting: boolean

  /**
   * Whether form has been submitted
   */
  isSubmitted: boolean

  /**
   * Whether form is valid (no errors)
   */
  isValid: boolean

  /**
   * Whether any field has been modified
   */
  isDirty: boolean

  /**
   * Whether any validation is running
   */
  isValidating: boolean

  /**
   * Submit count
   */
  submitCount: number
}

/**
 * Form operations
 */
export interface FormOperations<Values extends Record<string, unknown>> {
  /**
   * Set field value
   */
  setFieldValue: <P extends Path<Values>>(
    name: P,
    value: ValueAtPath<Values, P>
  ) => void

  /**
   * Set field error
   */
  setFieldError: <P extends Path<Values>>(name: P, error: string | undefined) => void

  /**
   * Mark field as touched
   */
  setFieldTouched: <P extends Path<Values>>(name: P, touched: boolean) => void

  /**
   * Get field state
   */
  getFieldState: <P extends Path<Values>>(name: P) => FieldState<ValueAtPath<Values, P>>

  /**
   * Validate single field
   */
  validateField: <P extends Path<Values>>(name: P) => Promise<boolean>

  /**
   * Validate entire form
   */
  validate: () => Promise<boolean>

  /**
   * Handle form submit
   */
  handleSubmit: (e?: FormEvent) => Promise<void>

  /**
   * Reset form to initial values
   */
  reset: (values?: Partial<Values>) => void

  /**
   * Subscribe to field changes
   */
  subscribe: <P extends Path<Values>>(
    name: P,
    callback: (state: FieldState<ValueAtPath<Values, P>>) => void
  ) => () => void
}

/**
 * Return type of useForm hook
 */
export interface UseFormReturn<Values extends Record<string, unknown>>
  extends FormState<Values>,
    FormOperations<Values> {
  /**
   * Field component (pre-bound to this form)
   */
  Field: <P extends Path<Values>>(props: FieldComponentProps<Values, P>) => JSX.Element

  /**
   * FieldArray component (pre-bound to this form)
   */
  FieldArray: <P extends Path<Values>>(props: FieldArrayComponentProps<Values, P>) => JSX.Element
}

/**
 * Field component props
 */
export interface FieldComponentProps<Values extends Record<string, unknown>, P extends Path<Values>> {
  /**
   * Field name (type-safe path)
   */
  name: P

  /**
   * Render function
   */
  children: (field: FieldRenderProps<ValueAtPath<Values, P>>) => JSX.Element

  /**
   * Use controlled mode (default: false)
   */
  controlled?: boolean
}

/**
 * Field array item with stable key
 */
export interface FieldArrayItem<T> {
  /**
   * Stable key for React reconciliation
   */
  key: string

  /**
   * Item value
   */
  value: T

  /**
   * Item index in array
   */
  index: number
}

/**
 * Field array operations (helpers)
 */
export interface FieldArrayHelpers<T> {
  /**
   * Append item to end of array
   */
  append: (value: T) => void

  /**
   * Prepend item to start of array
   */
  prepend: (value: T) => void

  /**
   * Insert item at specific index
   */
  insert: (index: number, value: T) => void

  /**
   * Remove item at specific index
   */
  remove: (index: number) => void

  /**
   * Move item from one index to another
   */
  move: (fromIndex: number, toIndex: number) => void

  /**
   * Swap two items
   */
  swap: (indexA: number, indexB: number) => void

  /**
   * Replace entire array
   */
  replace: (values: T[]) => void

  /**
   * Clear array (remove all items)
   */
  clear: () => void
}

/**
 * Field array render props
 */
export interface FieldArrayRenderProps<T> {
  /**
   * Array items with stable keys
   */
  fields: FieldArrayItem<T>[]

  /**
   * Array operation helpers
   */
  helpers: FieldArrayHelpers<T>
}

/**
 * Field array component props
 */
export interface FieldArrayComponentProps<
  Values extends Record<string, unknown>,
  P extends Path<Values>
> {
  /**
   * Field name (must be array path)
   */
  name: P

  /**
   * Form store instance
   */
  store: FormStore<Values>

  /**
   * Render function
   */
  children: (props: FieldArrayRenderProps<ValueAtPath<Values, P> extends (infer U)[] ? U : never>) => JSX.Element
}

/**
 * Subscription callback
 */
export type SubscriptionCallback<T> = (state: FieldState<T>) => void

/**
 * Unsubscribe function
 */
export type Unsubscribe = () => void
