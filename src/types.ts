/**
 * Core TypeScript types for @lpm.dev/neo.react-forms
 *
 * This file defines all the type-level magic that enables:
 * - Perfect inference from initialValues
 * - Type-safe nested path access
 * - Automatic validation schema typing
 */

import type { FormEvent, ChangeEvent, FocusEvent, ReactNode } from 'react'

/**
 * Extract all possible paths from a nested object
 *
 * @example
 * type Values = { user: { email: string; profile: { age: number } } }
 * type Paths = Path<Values>
 * // "user" | "user.email" | "user.profile" | "user.profile.age"
 */
type PathLeaf =
  | Date
  | RegExp
  | Error
  | ((...args: never[]) => unknown)
  | Promise<unknown>
  | Map<unknown, unknown>
  | ReadonlyMap<unknown, unknown>
  | Set<unknown>
  | ReadonlySet<unknown>
  | WeakMap<object, unknown>
  | WeakSet<object>
  | ArrayBuffer
  | ArrayBufferView
  | Blob
  | File

type NestedPath<Key extends string, Value> = NonNullable<Value> extends readonly (
  infer Item
)[]
  ?
      | Key
      | `${Key}.${number}`
      | (NonNullable<Item> extends PathLeaf
          ? never
          : NonNullable<Item> extends object
            ? `${Key}.${number}.${Path<NonNullable<Item>>}`
            : never)
  : NonNullable<Value> extends PathLeaf
    ? Key
    : NonNullable<Value> extends object
      ? Key | `${Key}.${Path<NonNullable<Value>>}`
      : Key

export type Path<T> = T extends PathLeaf
  ? never
  : T extends object
  ? {
      [K in keyof T]-?: K extends string
        ? NestedPath<K, T[K]>
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
type ValueAtSegment<T, K extends string> = T extends readonly (infer U)[]
  ? K extends `${number}`
    ? U
    : K extends keyof T
      ? T[K]
      : never
  : K extends keyof T
    ? T[K]
    : never

export type ValueAtPath<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? ValueAtPath<ValueAtSegment<T, K>, Rest>
  : ValueAtSegment<T, P>

/**
 * Recursively mark form values as read-only.
 */
export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends Date | RegExp | Error | Promise<unknown> | WeakMap<object, unknown> | WeakSet<object>
    ? T
    : T extends ReadonlyMap<infer Key, infer Value>
      ? ReadonlyMap<DeepReadonly<Key>, DeepReadonly<Value>>
      : T extends ReadonlySet<infer Item>
        ? ReadonlySet<DeepReadonly<Item>>
        : T extends readonly unknown[]
          ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
          : T extends object
            ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
            : T

type ArrayPathFor<T, P extends Path<T>> = P extends unknown
  ? NonNullable<ValueAtPath<T, P>> extends readonly unknown[]
    ? P
    : never
  : never

/**
 * Extract paths whose values are arrays.
 */
export type ArrayPath<T> = ArrayPathFor<T, Path<T>>

type ArrayElement<Value> = Value extends readonly (infer Item)[] ? Item : never

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
  values?: Values,
  context?: ValidationContext<Values>
) => string | null | undefined | Promise<string | null | undefined>

/**
 * Context supplied to field validators.
 */
export interface ValidationContext<Values = unknown> {
  readonly name: string
  readonly signal: AbortSignal
  readonly values: DeepReadonly<Values>
}

/**
 * Form-level validation function
 */
export type FormValidator<Values> = (
  values: Values
) =>
  | Partial<Record<Path<Values>, string>>
  | null
  | undefined
  | Promise<Partial<Record<Path<Values>, string>> | null | undefined>

/**
 * Field validation config
 */
export type FieldValidation<T, Values = unknown> = Validator<T, Values> | Validator<T, Values>[]

/**
 * Nested validation schema matching form structure
 */
type ValidationForValue<Value, RootValues extends object> = NonNullable<Value> extends readonly (
  infer Item
)[]
  ?
      | FieldValidation<Value, RootValues>
      | (NonNullable<Item> extends PathLeaf
          ? never
          : NonNullable<Item> extends object
            ? ValidationSchema<NonNullable<Item>, RootValues>
            : never)
  : NonNullable<Value> extends PathLeaf
    ? FieldValidation<Value, RootValues>
    : NonNullable<Value> extends object
      ?
          | ValidationSchema<NonNullable<Value>, RootValues>
          | FieldValidation<Value, RootValues>
      : FieldValidation<Value, RootValues>

export type ValidationSchema<
  Values extends object,
  RootValues extends object = Values,
> = {
  [K in keyof Values]?: ValidationForValue<Values[K], RootValues>
}

/**
 * Form configuration options
 */
export interface UseFormOptions<Values extends object> {
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
 * State and operations returned by the bound useField hook.
 */
export interface UseFieldReturn<T> extends FieldState<T> {
  setValue: (value: T) => void
  setError: (error: string | undefined) => void
  setTouched: (touched: boolean) => void
  validate: () => Promise<boolean>
}

/**
 * Field props for input elements
 */
export type FieldInputType = 'text' | 'number' | 'checkbox' | 'file' | 'select-multiple'

export type FieldChangeEvent = ChangeEvent<
  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
>

export interface FieldProps<T> {
  name: string
  value?: T extends string | number | readonly string[] ? T : never
  checked?: boolean
  multiple?: boolean
  onChange: (e: FieldChangeEvent) => void
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
export interface FormState<Values extends object> {
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

/** Select one value from the current form state. */
export type FormStateSelector<Values extends object, Selected> = (
  state: DeepReadonly<FormState<Values>>
) => Selected

/** Compare two selector results. */
export type FormStateEquality<Selected> = (
  previous: Selected,
  next: Selected
) => boolean

/**
 * Form operations
 */
export interface FormOperations<Values extends object> {
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
   * Run synchronous form updates in one notification transaction.
   */
  batch: <Result>(callback: () => Result) => Result

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
export interface UseFormReturn<Values extends object>
  extends FormState<Values>,
    FormOperations<Values> {
  /**
   * Field component (pre-bound to this form)
   */
  Field: <P extends Path<Values>>(props: FieldComponentProps<Values, P>) => ReactNode

  /**
   * FieldArray component (pre-bound to this form)
   */
  FieldArray: <P extends ArrayPath<Values>>(
    props: FieldArrayComponentProps<Values, P>
  ) => ReactNode

  /**
   * Subscribe to one field from a component.
   * Call this hook only at the top level of a React component.
   */
  useField: <P extends Path<Values>>(
    name: P
  ) => UseFieldReturn<ValueAtPath<Values, P>>

  /**
   * Subscribe to a selected form-state value from a component.
   * Call this hook only at the top level of a React component.
   */
  useFormState: <Selected>(
    selector: FormStateSelector<Values, Selected>,
    isEqual?: FormStateEquality<Selected>
  ) => Selected
}

/**
 * Field component props
 */
export interface FieldComponentProps<Values extends object, P extends Path<Values>> {
  /**
   * Field name (type-safe path)
   */
  name: P

  /**
   * Render function
   */
  children: (field: FieldRenderProps<ValueAtPath<Values, P>>) => ReactNode

  /**
   * How DOM input changes are converted to field values.
   * @default 'text'
   */
  inputType?: FieldInputType

  /**
   * Override the built-in DOM value parser.
   */
  parse?: (event: FieldChangeEvent) => ValueAtPath<Values, P>

  /**
   * Override the form-level validation mode for this field.
   */
  mode?: ValidationMode

  /**
   * Override the form-level re-validation mode for this field.
   */
  reValidateMode?: ValidationMode

  /**
   * Override the form validation schema for this field.
   */
  validate?: Validator<ValueAtPath<Values, P>, Values>

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
  Values extends object,
  P extends ArrayPath<Values>
> {
  /**
   * Field name (must be array path)
   */
  name: P

  /**
   * Render function
   */
  children: (
    props: FieldArrayRenderProps<ArrayElement<ValueAtPath<Values, P>>>
  ) => ReactNode
}

/**
 * Subscription callback
 */
export type SubscriptionCallback<T> = (state: FieldState<T>) => void

/**
 * Unsubscribe function
 */
export type Unsubscribe = () => void
