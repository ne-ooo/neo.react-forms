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
  | FileList

type UnsupportedFormValue =
  | symbol
  | ((...args: never[]) => unknown)
  | AggregateError
  | Promise<unknown>
  | WeakMap<object, unknown>
  | WeakSet<object>

type ExtraPropertyKeys<T, Base> = Exclude<keyof T, keyof Base>

type ContainsUnsupportedExtraProperties<T, Base, Seen = never> = [
  ExtraPropertyKeys<T, Base>,
] extends [never]
  ? false
  : {
      [Key in ExtraPropertyKeys<T, Base>]-?: Key extends keyof T
        ? ContainsUnsupportedFormValue<T[Key], Seen | T>
        : false
    }[ExtraPropertyKeys<T, Base>]

type HasExtraProperties<T, Base> = [ExtraPropertyKeys<T, Base>] extends [never]
  ? false
  : true

type TypedArrayBase<T> = T extends Int8Array
  ? Int8Array
  : T extends Uint8Array
    ? Uint8Array
    : T extends Uint8ClampedArray
      ? Uint8ClampedArray
      : T extends Int16Array
        ? Int16Array
        : T extends Uint16Array
          ? Uint16Array
          : T extends Int32Array
            ? Int32Array
            : T extends Uint32Array
              ? Uint32Array
              : T extends Float32Array
                ? Float32Array
                : T extends Float64Array
                  ? Float64Array
                  : T extends BigInt64Array
                    ? BigInt64Array
                    : T extends BigUint64Array
                      ? BigUint64Array
                      : ArrayBufferView

type ContainsUnsupportedFormValue<T, Seen = never> = 0 extends 1 & T
  ? false
  : T extends UnsupportedFormValue
    ? true
    : T extends Seen
      ? false
    : T extends Map<infer Key, infer Value>
      ? | ContainsUnsupportedFormValue<Key, Seen | T>
        | ContainsUnsupportedFormValue<Value, Seen | T>
        | ContainsUnsupportedExtraProperties<T, Map<Key, Value>, Seen>
      : T extends ReadonlyMap<infer Key, infer Value>
        ? | ContainsUnsupportedFormValue<Key, Seen | T>
          | ContainsUnsupportedFormValue<Value, Seen | T>
          | ContainsUnsupportedExtraProperties<T, ReadonlyMap<Key, Value>, Seen>
      : T extends Set<infer Item>
        ? | ContainsUnsupportedFormValue<Item, Seen | T>
          | ContainsUnsupportedExtraProperties<T, Set<Item>, Seen>
      : T extends ReadonlySet<infer Item>
        ? | ContainsUnsupportedFormValue<Item, Seen | T>
          | ContainsUnsupportedExtraProperties<T, ReadonlySet<Item>, Seen>
        : T extends (infer Item)[]
          ? | ContainsUnsupportedFormValue<Item, Seen | T>
            | ContainsUnsupportedExtraProperties<T, Array<Item>, Seen>
          : T extends readonly (infer Item)[]
            ? | ContainsUnsupportedFormValue<Item, Seen | T>
              | ContainsUnsupportedExtraProperties<T, ReadonlyArray<Item>, Seen>
            : T extends Date
              ? ContainsUnsupportedExtraProperties<T, Date, Seen>
              : T extends RegExp
                ? ContainsUnsupportedExtraProperties<T, RegExp, Seen>
                : T extends Error
                  ? | ContainsUnsupportedFormValue<T['cause'], Seen | T>
                    | ContainsUnsupportedExtraProperties<T, Error, Seen>
                  : T extends ArrayBuffer
                    ? ContainsUnsupportedExtraProperties<T, ArrayBuffer, Seen>
                    : T extends ArrayBufferView
                      ? HasExtraProperties<
                          T,
                          T extends DataView ? DataView : TypedArrayBase<T>
                        >
                      : T extends File
                        ? ContainsUnsupportedExtraProperties<T, File, Seen>
                        : T extends Blob
                          ? ContainsUnsupportedExtraProperties<T, Blob, Seen>
                          : T extends FileList
                            ? ContainsUnsupportedExtraProperties<T, FileList, Seen>
                            : T extends object
                              ? {
                                  [Key in keyof T]-?: ContainsUnsupportedFormValue<
                                    T[Key],
                                    Seen | T
                                  >
                                }[keyof T]
                              : false

/** Values accepted by the structured, detached form-state boundary. */
export type SupportedFormValues<T> = true extends ContainsUnsupportedFormValue<T>
  ? never
  : T

type PreviousPathDepth = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
type ReservedPathSegment = '__proto__' | 'prototype' | 'constructor'

type NestedPath<
  Key extends string,
  Value,
  Depth extends number,
> = NonNullable<Value> extends readonly (
  infer Item
)[]
  ?
      | Key
      | `${Key}.${number}`
      | (NonNullable<Item> extends PathLeaf
          ? never
          : NonNullable<Item> extends object
            ? `${Key}.${number}.${Path<
                NonNullable<Item>,
                PreviousPathDepth[Depth]
              >}`
            : never)
  : NonNullable<Value> extends PathLeaf
    ? Key
    : NonNullable<Value> extends object
      ? Key | `${Key}.${Path<NonNullable<Value>, PreviousPathDepth[Depth]>}`
      : Key

export type Path<T, Depth extends number = 12> = Depth extends 0
  ? never
  : T extends PathLeaf
  ? never
  : T extends object
  ? {
      [K in keyof T]-?: K extends string
        ? K extends ReservedPathSegment
          ? never
          : NestedPath<K, T[K], Depth>
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
type DateMutationMethod =
  | 'setDate'
  | 'setFullYear'
  | 'setHours'
  | 'setMilliseconds'
  | 'setMinutes'
  | 'setMonth'
  | 'setSeconds'
  | 'setTime'
  | 'setUTCDate'
  | 'setUTCFullYear'
  | 'setUTCHours'
  | 'setUTCMilliseconds'
  | 'setUTCMinutes'
  | 'setUTCMonth'
  | 'setUTCSeconds'
  | 'setYear'

type DeepReadonlyDate = Omit<Date, DateMutationMethod>
type DeepReadonlyRegExp = Omit<RegExp, 'compile' | 'lastIndex'> & {
  readonly lastIndex: number
}
type ArrayBufferMutationMethod = 'resize' | 'transfer' | 'transferToFixedLength'
type DeepReadonlyArrayBuffer = Omit<ArrayBuffer, ArrayBufferMutationMethod>
type DeepReadonlySharedArrayBuffer = Omit<SharedArrayBuffer, 'grow'>
type DeepReadonlyArrayBufferLike =
  | DeepReadonlyArrayBuffer
  | DeepReadonlySharedArrayBuffer
type DataViewMutationMethod =
  | 'setBigInt64'
  | 'setBigUint64'
  | 'setFloat16'
  | 'setFloat32'
  | 'setFloat64'
  | 'setInt8'
  | 'setInt16'
  | 'setInt32'
  | 'setUint8'
  | 'setUint16'
  | 'setUint32'
type DeepReadonlyDataView = Omit<
  DataView,
  DataViewMutationMethod | 'buffer'
> & {
  readonly buffer: DeepReadonlyArrayBufferLike
}
type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array
type TypedArrayMutationMethod = 'copyWithin' | 'fill' | 'reverse' | 'set' | 'sort'
type DeepReadonlyTypedArray<T extends TypedArray> = Omit<
  T,
  TypedArrayMutationMethod | 'buffer' | 'subarray' | number
> & {
  readonly [index: number]: T[number]
  readonly buffer: DeepReadonlyArrayBufferLike
  subarray(begin?: number, end?: number): DeepReadonlyTypedArray<T>
}
type DeepReadonlyExtras<T, Base> = {
  readonly [Key in Exclude<keyof T, keyof Base>]: DeepReadonly<T[Key]>
}

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends Date
    ? DeepReadonlyDate & DeepReadonlyExtras<T, Date>
    : T extends RegExp
      ? DeepReadonlyRegExp & DeepReadonlyExtras<T, RegExp>
      : T extends DataView
        ? DeepReadonlyDataView & DeepReadonlyExtras<T, DataView>
        : T extends TypedArray
          ? DeepReadonlyTypedArray<T> & DeepReadonlyExtras<T, TypedArray>
          : T extends ArrayBuffer
            ? DeepReadonlyArrayBuffer & DeepReadonlyExtras<T, ArrayBuffer>
            : T extends SharedArrayBuffer
              ? DeepReadonlySharedArrayBuffer &
                  DeepReadonlyExtras<T, SharedArrayBuffer>
      : T extends Error
        ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
        : T extends Promise<infer Value>
          ? Promise<DeepReadonly<Value>>
          : T extends ReadonlyMap<infer Key, infer Value>
            ? ReadonlyMap<DeepReadonly<Key>, DeepReadonly<Value>> &
                DeepReadonlyExtras<
                  T,
                  T extends Map<Key, Value>
                    ? Map<Key, Value>
                    : ReadonlyMap<Key, Value>
                >
            : T extends ReadonlySet<infer Item>
              ? ReadonlySet<DeepReadonly<Item>> &
                  DeepReadonlyExtras<
                    T,
                    T extends Set<Item> ? Set<Item> : ReadonlySet<Item>
                  >
              : T extends WeakMap<infer Key, infer Value>
                ? {
                    get(key: Key): DeepReadonly<Value> | undefined
                    has(key: Key): boolean
                  }
                : T extends WeakSet<infer Value>
                  ? { has(value: Value): boolean }
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
  value: DeepReadonly<T>,
  values?: DeepReadonly<Values>,
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
  values: DeepReadonly<Values>
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
  initialValues: SupportedFormValues<Values>

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
  onSubmit?: (values: DeepReadonly<Values>) => void | Promise<void>

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
    [K in keyof Values]?: (values: DeepReadonly<Values>) => Values[K]
  }
}

/**
 * Field state
 */
export interface FieldState<T> {
  /**
   * Current field value
   */
  readonly value: T

  /**
   * Field error message (if any)
   */
  readonly error: string | undefined

  /**
   * Whether field has been touched (blurred)
   */
  readonly touched: boolean

  /**
   * Whether field value differs from initial value
   */
  readonly dirty: boolean

  /**
   * Whether field is currently validating (async)
   */
  readonly isValidating: boolean
}

/**
 * State and operations returned by the bound useField hook.
 */
export interface UseFieldReturn<T> extends FieldState<DeepReadonly<T>> {
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
  value?: T extends string | number | readonly string[] ? DeepReadonly<T> : never
  checked?: boolean
  multiple?: boolean
  onChange: (e: FieldChangeEvent) => void
  onBlur: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
}

/**
 * Field render props
 */
export interface FieldRenderProps<T> extends FieldState<DeepReadonly<T>> {
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
  values: DeepReadonly<Values>

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
  getFieldState: <P extends Path<Values>>(
    name: P
  ) => FieldState<DeepReadonly<ValueAtPath<Values, P>>>

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
    callback: (state: FieldState<DeepReadonly<ValueAtPath<Values, P>>>) => void
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
interface FieldComponentBaseProps<Values extends object, P extends Path<Values>> {
  /**
   * Field name (type-safe path)
   */
  name: P

  /**
   * Render function
   */
  children: (field: FieldRenderProps<ValueAtPath<Values, P>>) => ReactNode

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
}

type BuiltInFieldInputConfig<Value> =
  | (string extends Value
      ? { inputType?: 'text'; parse?: never }
      : never)
  | (number | undefined extends Value
      ? { inputType: 'number'; parse?: never }
      : never)
  | (boolean extends Value
      ? { inputType: 'checkbox'; parse?: never }
      : never)
  | (FileList | null extends Value
      ? { inputType: 'file'; parse?: never }
      : never)
  | (string[] extends Value
      ? { inputType: 'select-multiple'; parse?: never }
      : never)

type FieldInputConfig<Value> =
  | BuiltInFieldInputConfig<Value>
  | {
      /**
       * Override the built-in DOM value parser.
       */
      parse: (event: FieldChangeEvent) => Value

      /**
       * The custom parser takes precedence over this parser hint.
      */
      inputType?: FieldInputType
    }

/**
 * Field component props. Built-in input parsers are available only when their
 * runtime output is assignable to the selected field value.
 */
export type FieldComponentProps<
  Values extends object,
  P extends Path<Values>,
> = FieldComponentBaseProps<Values, P> & FieldInputConfig<ValueAtPath<Values, P>>

/**
 * Field array item with stable key
 */
export interface FieldArrayItem<T> {
  /**
   * Stable key for React reconciliation
   */
  readonly key: string

  /**
   * Item value
   */
  readonly value: DeepReadonly<T>

  /**
   * Item index in array
   */
  readonly index: number
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
  readonly fields: readonly FieldArrayItem<T>[]

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
