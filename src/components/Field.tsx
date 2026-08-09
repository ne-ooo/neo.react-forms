/**
 * Field component - Ergonomic field rendering with automatic subscriptions
 *
 * Key features:
 * - Automatic field-level subscriptions (isolated re-renders)
 * - Render props pattern for full control
 * - Perfect TypeScript inference of field value type
 * - Uncontrolled mode by default (like RHF)
 */

import { useSyncExternalStore, useCallback, type ReactNode } from 'react'
import type { FormStore } from '../core/store.js'
import { createImmutableSnapshot } from '../utils/immutable.js'
import type {
  Path,
  ValueAtPath,
  FieldRenderProps,
  FieldProps as InputProps,
  FieldChangeEvent,
  FieldInputType,
  ValidationMode,
  Validator,
} from '../types.js'

export interface FieldProps<Values extends object, P extends Path<Values>> {
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
  children: (field: FieldRenderProps<ValueAtPath<Values, P>>) => ReactNode

  /**
   * Validation mode
   */
  mode?: ValidationMode

  /**
   * Re-validation mode
   */
  reValidateMode?: ValidationMode

  /**
   * Validator function(s)
   */
  validate?: Validator<ValueAtPath<Values, P>, Values>

  /**
   * Built-in parser and value binding for the rendered control.
   */
  inputType?: FieldInputType

  /**
   * Custom DOM event parser.
   */
  parse?: (event: FieldChangeEvent) => ValueAtPath<Values, P>

  /**
   * Form-owned validation pipeline used by the bound Field component.
   * @internal
   */
  validateField?: <Q extends Path<Values>>(name: Q) => Promise<boolean>
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
export function Field<Values extends object, P extends Path<Values>>({
  name,
  store,
  children,
  mode = 'onBlur',
  reValidateMode = 'onChange',
  validate,
  inputType = 'text',
  parse,
  validateField,
}: FieldProps<Values, P>): ReactNode {
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

  const fieldState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  // Run validation
  const runValidation = useCallback(
    async (value: ValueAtPath<Values, P> = store.getValue(name)) => {
      if (!validate && validateField) {
        return validateField(name)
      }
      if (!validate) {
        store.markValidated(name)
        return true
      }

      const controller = store.startValidation(name)
      try {
        const readonlyValues = createImmutableSnapshot(store.getValues())
        const error = await validate(value, readonlyValues as Values, {
          name,
          signal: controller.signal,
          values: readonlyValues,
        })
        if (store.isValidationCurrent(name, controller)) {
          store.setError(name, error ?? undefined)
        }
        return !error
      } catch (error) {
        if (controller.signal.aborted) return true
        throw error
      } finally {
        store.endValidation(name, controller)
      }
    },
    [validate, validateField, store, name]
  )

  // Set field value
  const setValue = useCallback(
    (value: ValueAtPath<Values, P>) => {
      const wasValidated = store.hasValidated(name)
      store.setValue(name, value)

      const activeMode = wasValidated ? reValidateMode : mode
      if (activeMode === 'onChange' || activeMode === 'all') {
        void runValidation(value).catch(() => undefined)
      }
    },
    [store, name, mode, reValidateMode, runValidation]
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
      const wasValidated = store.hasValidated(name)
      store.setTouched(name, touched)

      const activeMode = wasValidated ? reValidateMode : mode
      if (touched && (activeMode === 'onBlur' || activeMode === 'all')) {
        void runValidation().catch(() => undefined)
      }
    },
    [store, name, mode, reValidateMode, runValidation]
  )

  const onChange = useCallback(
    (event: FieldChangeEvent) => {
      if (parse) {
        setValue(parse(event))
        return
      }

      const target = event.currentTarget
      let value: unknown
      switch (inputType) {
        case 'number': {
          const input = target as HTMLInputElement
          value = input.value === '' || Number.isNaN(input.valueAsNumber)
            ? undefined
            : input.valueAsNumber
          break
        }
        case 'checkbox':
          value = (target as HTMLInputElement).checked
          break
        case 'file':
          value = (target as HTMLInputElement).files
          break
        case 'select-multiple':
          value = Array.from((target as HTMLSelectElement).selectedOptions, (option) => option.value)
          break
        case 'text':
          value = target.value
          break
      }

      setValue(value as ValueAtPath<Values, P>)
    },
    [inputType, parse, setValue]
  )

  const onBlur = useCallback(() => {
    setTouched(true)
  }, [setTouched])

  // Field props for spreading on the configured control type.
  const props: InputProps<ValueAtPath<Values, P>> = {
    name,
    onChange,
    onBlur,
  }

  if (inputType === 'checkbox') {
    props.checked = Boolean(fieldState.value)
  } else if (inputType === 'select-multiple') {
    props.value = fieldState.value as Exclude<
      InputProps<ValueAtPath<Values, P>>['value'],
      undefined
    >
    props.multiple = true
  } else if (inputType !== 'file') {
    props.value = (fieldState.value ?? '') as Exclude<
      InputProps<ValueAtPath<Values, P>>['value'],
      undefined
    >
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
