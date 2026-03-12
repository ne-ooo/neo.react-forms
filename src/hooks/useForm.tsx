/**
 * useForm hook - The main API for @lpm.dev/neo.react-forms
 *
 * Key features:
 * - Perfect TypeScript inference from initialValues (no generics needed!)
 * - Field-level subscriptions for isolated re-renders
 * - Fully typed paths with autocomplete
 * - Built-in validation support
 */

import { useMemo, useCallback, useState, useSyncExternalStore, type FormEvent } from 'react'
import { FormStore } from '../core/store.js'
import { Field as FieldComponent } from '../components/Field.js'
import { FieldArray as FieldArrayComponent } from '../components/FieldArray.js'
import type {
  UseFormOptions,
  UseFormReturn,
  FormState,
  Path,
  ValueAtPath,
  FieldState,
  ValidationSchema,
  Validator,
  FieldComponentProps,
  FieldArrayComponentProps,
} from '../types.js'

/**
 * Run validator(s) for a field
 */
async function runValidators<T, Values = unknown>(
  value: T,
  validators: Validator<T, Values> | Validator<T, Values>[],
  values?: Values
): Promise<string | undefined> {
  const validatorArray = Array.isArray(validators) ? validators : [validators]

  for (const validator of validatorArray) {
    const error = await validator(value, values)
    if (error) {
      return error
    }
  }

  return undefined
}

/**
 * Get validator for a field from nested validation schema
 */
function getValidatorForPath<Values extends Record<string, unknown>>(
  schema: ValidationSchema<Values> | undefined,
  path: string
): Validator<unknown> | Validator<unknown>[] | undefined {
  if (!schema) return undefined

  const keys = path.split('.')
  let current: unknown = schema

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[key]
  }

  return current as Validator<unknown> | Validator<unknown>[] | undefined
}

/**
 * Main useForm hook
 *
 * @example
 * ```tsx
 * const form = useForm({
 *   initialValues: {
 *     email: '',
 *     password: '',
 *     profile: {
 *       firstName: '',
 *       lastName: ''
 *     }
 *   },
 *   validate: {
 *     email: (value) => !value ? 'Required' : null,
 *     password: (value) => value.length < 8 ? 'Too short' : null
 *   },
 *   onSubmit: async (values) => {
 *     await api.register(values)
 *   }
 * })
 *
 * // Perfect TypeScript inference!
 * form.setFieldValue('email', 'test@example.com') // ✓ typed
 * form.setFieldValue('profile.firstName', 'John') // ✓ nested paths
 * form.setFieldValue('invalid', 'value') // ✗ TypeScript error
 * ```
 */
export function useForm<Values extends Record<string, unknown>>(
  options: UseFormOptions<Values>
): UseFormReturn<Values> {
  const { initialValues, validate, validateForm, onSubmit, onSubmitError, mode = 'onBlur', reValidateMode = 'onChange', computed } = options

  // Create store (memoized - only once per form instance)
  const store = useMemo(() => new FormStore(initialValues, computed), [])

  // Force re-render when store changes
  useSyncExternalStore(
    useCallback((callback) => store.subscribeToStore(callback), [store]),
    useCallback(() => store.getVersion(), [store])
  )

  // Form-level state (not in store yet)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitCount, setSubmitCount] = useState(0)

  // Validate a single field
  const validateField = useCallback(
    async <P extends Path<Values>>(name: P): Promise<boolean> => {
      const value = store.getValue(name)
      const validators = getValidatorForPath(validate, name)

      if (!validators) {
        store.setError(name, undefined)
        return true
      }

      const values = store.getValues()
      store.startValidation(name)
      try {
        const error = await runValidators(value, validators, values)
        store.setError(name, error)
        return !error
      } finally {
        store.endValidation(name)
      }
    },
    [validate, store]
  )

  // Validate entire form
  const validateFormFn = useCallback(async (): Promise<boolean> => {
    // Run all field validators
    const values = store.getValues()
    const errors: Partial<Record<Path<Values>, string>> = {}

    if (validate) {
      // Validate all fields in schema
      const validateAllFields = async (obj: unknown, prefix = ''): Promise<void> => {
        if (obj === null || obj === undefined || typeof obj !== 'object') {
          return
        }

        for (const [key, validators] of Object.entries(obj)) {
          const path = prefix ? `${prefix}.${key}` : key

          // Check if this is a validator function or array of validators
          if (typeof validators === 'function' || Array.isArray(validators)) {
            const value = store.getValue(path as Path<Values>)
            store.startValidation(path as Path<Values>)
            try {
              const error = await runValidators(value, validators as Validator<unknown, Values> | Validator<unknown, Values>[], values)
              if (error) {
                errors[path as Path<Values>] = error
              }
            } finally {
              store.endValidation(path as Path<Values>)
            }
          } else if (typeof validators === 'object') {
            // Recurse for nested objects
            await validateAllFields(validators, path)
          }
        }
      }

      await validateAllFields(validate)
    }

    // Run form-level validation
    if (validateForm) {
      const formErrors = await validateForm(values)
      if (formErrors) {
        Object.assign(errors, formErrors)
      }
    }

    // Update all errors in store
    // First, clear all existing errors
    const currentErrors = store.getErrors()
    for (const key of Object.keys(currentErrors)) {
      store.setError(key as Path<Values>, undefined)
    }

    // Then set new errors
    for (const [key, error] of Object.entries(errors)) {
      if (error && typeof error === 'string') {
        store.setError(key as Path<Values>, error)
      }
    }

    return Object.keys(errors).length === 0
  }, [validate, validateForm, store])

  // Form submission handler
  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()

      setSubmitCount((count) => count + 1)

      // Validate form
      const isValid = await validateFormFn()

      if (!isValid) {
        return
      }

      if (!onSubmit) {
        return
      }

      try {
        setIsSubmitting(true)
        await onSubmit(store.getValues())
      } catch (error) {
        if (onSubmitError) {
          onSubmitError(error)
        } else {
          throw error
        }
      } finally {
        setIsSubmitting(false)
      }
    },
    [validateFormFn, onSubmit, onSubmitError, store]
  )

  // Field operations
  const setFieldValue = useCallback(
    <P extends Path<Values>>(name: P, value: ValueAtPath<Values, P>) => {
      store.setValue(name, value)

      // Auto-validate if in onChange mode or if field was already validated
      if (reValidateMode === 'onChange' || store.getError(name)) {
        validateField(name)
      }
    },
    [store, validateField, reValidateMode]
  )

  const setFieldError = useCallback(
    <P extends Path<Values>>(name: P, error: string | undefined) => {
      store.setError(name, error)
    },
    [store]
  )

  const setFieldTouched = useCallback(
    <P extends Path<Values>>(name: P, touched: boolean) => {
      store.setTouched(name, touched)

      // Auto-validate if in onBlur mode
      if (mode === 'onBlur' && touched) {
        validateField(name)
      }
    },
    [store, validateField, mode]
  )

  const getFieldState = useCallback(
    <P extends Path<Values>>(name: P): FieldState<ValueAtPath<Values, P>> => {
      return store.getFieldState(name)
    },
    [store]
  )

  const reset = useCallback(
    (values?: Partial<Values>) => {
      store.reset(values)
    },
    [store]
  )

  const subscribe = useCallback(
    <P extends Path<Values>>(
      name: P,
      callback: (state: FieldState<ValueAtPath<Values, P>>) => void
    ) => {
      return store.subscribe(name, callback)
    },
    [store]
  )

  // Compute form state
  const values = store.getValues()
  const errors = store.getErrors()
  const touched = store.getTouchedFields()
  const isDirty = store.isDirty()
  const isValid = store.isValid()

  const formState: FormState<Values> = {
    values,
    errors,
    touched,
    isSubmitting,
    isSubmitted: submitCount > 0,
    isValid,
    isDirty,
    isValidating: store.isValidating(),
    submitCount,
  }

  // Field component (pre-bound to this form)
  const BoundField = useCallback(
    function BoundField<P extends Path<Values>>(props: Omit<FieldComponentProps<Values, P>, 'store'>): JSX.Element {
      // Only pass field-level validation modes (convert form-level modes to field equivalents)
      const fieldMode = (mode === 'onSubmit' || mode === 'all') ? 'onBlur' : mode
      const fieldReValidateMode = (reValidateMode === 'onSubmit' || reValidateMode === 'all') ? 'onChange' : reValidateMode
      return <FieldComponent {...props} store={store} mode={fieldMode} reValidateMode={fieldReValidateMode} />
    },
    [store, mode, reValidateMode]
  ) as <P extends Path<Values>>(props: Omit<FieldComponentProps<Values, P>, 'store'>) => JSX.Element

  // FieldArray component (pre-bound to this form)
  const BoundFieldArray = useCallback(
    function BoundFieldArray<P extends Path<Values>>(props: Omit<FieldArrayComponentProps<Values, P>, 'store'>): JSX.Element {
      return <FieldArrayComponent {...props} store={store} />
    },
    [store]
  ) as <P extends Path<Values>>(props: Omit<FieldArrayComponentProps<Values, P>, 'store'>) => JSX.Element

  return {
    // Form state
    ...formState,

    // Operations
    setFieldValue,
    setFieldError,
    setFieldTouched,
    getFieldState,
    validateField,
    validate: validateFormFn,
    handleSubmit,
    reset,
    subscribe,

    // Components
    Field: BoundField,
    FieldArray: BoundFieldArray,
  }
}
