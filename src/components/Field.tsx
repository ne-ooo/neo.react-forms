/**
 * Field component - Ergonomic field rendering with automatic subscriptions
 *
 * Key features:
 * - Automatic field-level subscriptions (isolated re-renders)
 * - Render props pattern for full control
 * - Perfect TypeScript inference of field value type
 * - Uncontrolled mode by default (like RHF)
 */

import { useSyncExternalStore, useCallback, type ChangeEvent, type FocusEvent } from 'react'
import type { FormStore } from '../core/store.js'
import type { Path, ValueAtPath, FieldRenderProps } from '../types.js'

export interface FieldProps<Values extends Record<string, unknown>, P extends Path<Values>> {
  /**
   * Field name (type-safe path)
   */
  name: P

  /**
   * Form store instance
   */
  store: FormStore<Values>

  /**
   * Render function with field state
   */
  children: (field: FieldRenderProps<ValueAtPath<Values, P>>) => JSX.Element

  /**
   * Validation mode
   */
  mode?: 'onBlur' | 'onChange'

  /**
   * Re-validation mode
   */
  reValidateMode?: 'onBlur' | 'onChange'

  /**
   * Validator function(s)
   */
  validate?: (value: ValueAtPath<Values, P>) => string | null | Promise<string | null>
}

/**
 * Field component with automatic subscriptions
 *
 * @example
 * ```tsx
 * <Field name="email" store={store}>
 *   {(field) => (
 *     <div>
 *       <input {...field.props} />
 *       {field.touched && field.error && <div>{field.error}</div>}
 *     </div>
 *   )}
 * </Field>
 * ```
 */
export function Field<Values extends Record<string, unknown>, P extends Path<Values>>({
  name,
  store,
  children,
  mode = 'onBlur',
  reValidateMode = 'onChange',
  validate,
}: FieldProps<Values, P>): JSX.Element {
  // Subscribe to field state changes (isolated re-renders!)
  // Adapt store subscription to useSyncExternalStore API
  const subscribe = useCallback(
    (callback: () => void) => {
      // Store's subscribe passes field state, but useSyncExternalStore just needs a notify
      return store.subscribe(name, () => callback())
    },
    [store, name]
  )

  const getSnapshot = useCallback(
    () => store.getFieldState(name),
    [store, name]
  )

  const fieldState = useSyncExternalStore(subscribe, getSnapshot)

  // Run validation
  const runValidation = useCallback(async () => {
    if (!validate) return true

    const error = await validate(fieldState.value)
    store.setError(name, error ?? undefined)
    return !error
  }, [validate, fieldState.value, store, name])

  // Set field value
  const setValue = useCallback(
    (value: ValueAtPath<Values, P>) => {
      store.setValue(name, value)

      // Auto-validate if in onChange mode or if field was already validated
      if (reValidateMode === 'onChange' || fieldState.error) {
        runValidation()
      }
    },
    [store, name, reValidateMode, fieldState.error, runValidation]
  )

  // Set field error
  const setError = useCallback(
    (error: string | undefined) => {
      store.setError(name, error)
    },
    [store, name]
  )

  // Mark field as touched
  const setTouched = useCallback(
    (touched: boolean) => {
      store.setTouched(name, touched)

      // Auto-validate if in onBlur mode
      if (mode === 'onBlur' && touched) {
        runValidation()
      }
    },
    [store, name, mode, runValidation]
  )

  // Field props for spreading on input
  const props: import('../types.js').FieldProps<ValueAtPath<Values, P>> = {
    name,
    value: fieldState.value,
    onChange: useCallback(
      (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const value = e.target.value as unknown as ValueAtPath<Values, P>
        setValue(value)
      },
      [setValue]
    ),
    onBlur: useCallback(
      (_e: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setTouched(true)
      },
      [setTouched]
    ),
  }

  // Render props
  const renderProps: FieldRenderProps<ValueAtPath<Values, P>> = {
    ...fieldState,
    props,
    setValue,
    setError,
    setTouched,
    validate: runValidation,
  }

  return children(renderProps)
}
