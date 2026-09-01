/**
 * Field component - Ergonomic field rendering with automatic subscriptions
 *
 * Key features:
 * - Automatic field-level subscriptions (isolated re-renders)
 * - Render props pattern for full control
 * - Perfect TypeScript inference of field value type
 * - Controlled DOM bindings with typed parsers
 */

import {
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { getValueByPath, type FormStore } from '../core/store.js'
import {
  createCachedLazyImmutableSnapshot,
  createLazyImmutableSnapshot,
} from '../utils/immutable.js'
import type {
  Path,
  ValueAtPath,
  FieldRenderProps,
  FieldProps as InputProps,
  FieldComponentProps,
  FieldChangeEvent,
  DeepReadonly,
  Validator,
} from '../types.js'

export type FieldProps<
  Values extends object,
  P extends Path<Values>,
> = FieldComponentProps<Values, P> & {
  /** Form store instance. */
  store: FormStore<Values>

  /**
   * Form-owned validation pipeline used by the bound Field component.
   * @internal
   */
  validateField?: <Q extends Path<Values>>(name: Q) => Promise<boolean>

  /** Register a mounted field-level validator with the owning form. */
  registerValidator?: <Q extends Path<Values>>(
    name: Q,
    validator: Validator<ValueAtPath<Values, Q>, Values>
  ) => () => void

  /** @internal Preserve inline validators during a rerender requested by the store. */
  preserveValidateDuringStoreRender?: boolean
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
  registerValidator,
  preserveValidateDuringStoreRender = false,
}: FieldProps<Values, P>): ReactNode {
  const ownedValidationControllers = useRef(new Set<AbortController>())
  const validateRef = useRef(validate)
  const committedValidateRef = useRef(validate)
  const hasValidator = validate !== undefined

  useEffect(() => {
    const changed = committedValidateRef.current !== validate
    committedValidateRef.current = validate
    validateRef.current = validate
    if (!changed || preserveValidateDuringStoreRender) return

    for (const controller of ownedValidationControllers.current) {
      controller.abort()
    }
    ownedValidationControllers.current.clear()
    store.cancelValidation(name)
  }, [name, preserveValidateDuringStoreRender, store, validate])

  useEffect(() => {
    if (!hasValidator || !registerValidator) return
    return registerValidator(name, (value, values, context) =>
      validateRef.current?.(value, values, context)
    )
  }, [hasValidator, name, registerValidator])

  useEffect(() => {
    const controllers = ownedValidationControllers.current
    return () => {
      for (const controller of controllers) {
        controller.abort()
        store.endValidation(name, controller)
      }
      controllers.clear()
    }
  }, [name, store])

  // Subscribe to field state changes (isolated re-renders!)
  // Adapt store subscription to useSyncExternalStore API
  const subscribe = useCallback(
    (callback: () => void) => {
      return store.subscribeToField(name, callback)
    },
    [store, name]
  )

  const getSnapshot = useCallback(
    () => store.getInternalFieldState(name),
    [store, name]
  )

  const fieldState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const exposedValue = createCachedLazyImmutableSnapshot(
    fieldState.value
  ) as DeepReadonly<ValueAtPath<Values, P>>

  // Run validation
  const runValidation = useCallback(
    async () => {
      if (!validate && validateField) {
        return validateField(name)
      }
      if (!validate) {
        store.markValidated(name)
        return true
      }

      const sourceValues = store.getInternalValues()
      const controller = store.startValidation(name)
      ownedValidationControllers.current.add(controller)
      try {
        const readonlyValues = createLazyImmutableSnapshot(sourceValues)
        const value = getValueByPath(readonlyValues, name) as DeepReadonly<
          ValueAtPath<Values, P>
        >
        const error = await validate(value, readonlyValues, {
          name,
          signal: controller.signal,
          values: readonlyValues,
        })
        const normalizedError = error ?? undefined
        const current =
          store.isValidationCurrent(name, controller) &&
          store.getInternalValues() === sourceValues
        if (current) {
          store.setError(name, normalizedError)
        }
        return current && normalizedError === undefined
      } catch (error) {
        if (controller.signal.aborted) return false
        throw error
      } finally {
        ownedValidationControllers.current.delete(controller)
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
        void runValidation().catch(() => undefined)
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
    props.checked = Boolean(exposedValue)
  } else if (inputType === 'select-multiple') {
    props.value = exposedValue as Exclude<
      InputProps<ValueAtPath<Values, P>>['value'],
      undefined
    >
    props.multiple = true
  } else if (inputType !== 'file') {
    props.value = (exposedValue ?? '') as Exclude<
      InputProps<ValueAtPath<Values, P>>['value'],
      undefined
    >
  }

  // Render props
  const renderProps: FieldRenderProps<ValueAtPath<Values, P>> = {
    ...fieldState,
    value: exposedValue,
    props,
    setValue,
    setError,
    setTouched,
    validate: runValidation,
  }

  return children(renderProps)
}
