/**
 * useForm hook - The main API for @lpm.dev/neo.react-forms
 *
 * Key features:
 * - Perfect TypeScript inference from initialValues (no generics needed!)
 * - Field-level subscriptions for isolated re-renders
 * - Fully typed paths with autocomplete
 * - Built-in validation support
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from 'react'
import { FormStore, getValueByPath, type FormStoreSlice } from '../core/store.js'
import { Field as FieldComponent } from '../components/Field.js'
import { FieldArray as FieldArrayComponent } from '../components/FieldArray.js'
import {
  createBoundUseField,
  createBoundUseFormState,
  type FieldHookOperations,
} from './boundHooks.js'
import { createImmutableSnapshot } from '../utils/immutable.js'
import type {
  UseFormOptions,
  UseFormReturn,
  Path,
  ArrayPath,
  ValueAtPath,
  FieldState,
  ValidationSchema,
  Validator,
  ValidationContext,
  FieldComponentProps,
  FieldArrayComponentProps,
  DeepReadonly,
} from '../types.js'

/**
 * Run validator(s) for a field
 */
async function runValidators<T, Values = unknown>(
  value: T,
  validators: Validator<T, Values> | Validator<T, Values>[],
  values: Values | undefined,
  context: ValidationContext<Values>
): Promise<string | undefined> {
  const validatorArray = Array.isArray(validators) ? validators : [validators]

  for (const validator of validatorArray) {
    const error = await validator(value, values, context)
    if (error) {
      return error
    }
  }

  return undefined
}

/**
 * Get validator for a field from nested validation schema
 */
function getValidatorForPath<Values extends object>(
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

    // Array item validation schemas describe one item, so numeric path
    // segments do not appear in the schema itself.
    if (/^\d+$/.test(key) && !(key in (current as Record<string, unknown>))) {
      continue
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
export function useForm<Values extends object>(
  options: UseFormOptions<Values>
): UseFormReturn<Values> {
  const { initialValues, validate, validateForm, onSubmit, onSubmitError, mode = 'onBlur', reValidateMode = 'onChange', computed } = options

  // Create one store per mounted form instance. initialValues and computed are
  // intentionally snapshots; reset() is the API for changing the baseline.
  const [store] = useState(() => new FormStore(initialValues, computed))
  const [observedSlices] = useState(() => new Set<FormStoreSlice>())
  const [useBoundFormState] = useState(() => createBoundUseFormState(store))

  // Re-render only for form-state slices actually read by the owner. A form
  // that only renders bound Fields stays isolated from unrelated field work.
  useSyncExternalStore(
    useCallback(
      (callback) =>
        store.subscribeToStore((changedSlices) => {
          for (const slice of changedSlices) {
            if (observedSlices.has(slice)) {
              callback()
              return
            }
          }
        }),
      [observedSlices, store]
    ),
    useCallback(() => store.getVersion(), [store]),
    useCallback(() => store.getVersion(), [store])
  )

  const runFieldValidation = useCallback(
    async (
      name: Path<Values>,
      validators: Validator<unknown, Values> | Validator<unknown, Values>[],
      commit: boolean,
      existingController?: AbortController,
      existingValues?: DeepReadonly<Values>
    ): Promise<{ error: string | undefined; current: boolean }> => {
      const readonlyValues = existingValues ?? createImmutableSnapshot(store.getValues())
      const values = readonlyValues as Values
      const value = getValueByPath(values, name)
      const controller = existingController ?? store.startValidation(name)
      const ownsController = existingController === undefined

      try {
        const error = await runValidators(value, validators, values, {
          name,
          signal: controller.signal,
          values: readonlyValues,
        })
        const current = store.isValidationCurrent(name, controller)
        if (commit && current) {
          store.setError(name, error)
        }
        return { error, current }
      } catch (error) {
        if (controller.signal.aborted) {
          return { error: undefined, current: false }
        }
        throw error
      } finally {
        if (ownsController) store.endValidation(name, controller)
      }
    },
    [store]
  )

  // Validate a single field
  const validateField = useCallback(
    async <P extends Path<Values>>(name: P): Promise<boolean> => {
      const validators = getValidatorForPath(validate, name)

      if (!validators) {
        store.markValidated(name)
        store.setError(name, undefined)
        return true
      }

      const { error } = await runFieldValidation(
        name,
        validators as Validator<unknown, Values> | Validator<unknown, Values>[],
        true
      )
      return !error
    },
    [runFieldValidation, validate, store]
  )

  // Keep the bound Field component type stable even when callers declare the
  // validation schema inline and therefore create a new validateField closure
  // on each form render. Changing a JSX component function unmounts its input.
  const validateFieldRef = useRef(validateField)
  useEffect(() => {
    validateFieldRef.current = validateField
  }, [validateField])
  const boundValidateField = useCallback(
    <P extends Path<Values>>(name: P) => validateFieldRef.current(name),
    []
  )

  // Validate entire form
  const validateFormFn = useCallback(async (touchFields = false): Promise<boolean> => {
    // Run all field validators
    const currentValues = store.getValues()
    const readonlyValues = createImmutableSnapshot(currentValues)
    const values = readonlyValues as Values
    const errors: Partial<Record<Path<Values>, string>> = {}
    const validationTasks: Array<{
      name: Path<Values>
      validators: Validator<unknown, Values> | Validator<unknown, Values>[]
    }> = []

    if (validate) {
      // Expand nested schemas, including the schema for every current array item.
      const collectValidationTasks = (obj: unknown, prefix = ''): void => {
        if (obj === null || obj === undefined || typeof obj !== 'object') {
          return
        }

        for (const [key, validators] of Object.entries(obj)) {
          const path = prefix ? `${prefix}.${key}` : key

          // Check if this is a validator function or array of validators
          if (typeof validators === 'function' || Array.isArray(validators)) {
            validationTasks.push({
              name: path as Path<Values>,
              validators: validators as
                | Validator<unknown, Values>
                | Validator<unknown, Values>[],
            })
          } else if (typeof validators === 'object') {
            const fieldValue = getValueByPath(values, path)
            if (Array.isArray(fieldValue)) {
              fieldValue.forEach((_, index) => {
                collectValidationTasks(validators, `${path}.${index}`)
              })
            } else {
              collectValidationTasks(validators, path)
            }
          }
        }
      }

      collectValidationTasks(validate)

    }

    const controllers = store.batch(() => {
      const next = new Map<Path<Values>, AbortController>()
      for (const { name } of validationTasks) {
        next.set(name, store.startValidation(name))
      }
      return next
    })
    let validationsEnded = false
    const endValidations = (): void => {
      if (validationsEnded) return
      store.batch(() => {
        for (const [name, controller] of controllers) {
          store.endValidation(name, controller)
        }
      })
      validationsEnded = true
    }

    try {
      const results = await Promise.all(
        validationTasks.map(async ({ name, validators }) => ({
          name,
          ...(await runFieldValidation(
            name,
            validators,
            false,
            controllers.get(name),
            readonlyValues
          )),
        }))
      )

      // A newer field validation superseded this form validation. Treat the
      // form result as stale instead of clearing errors or allowing submit.
      if (results.some(({ current }) => !current)) {
        return false
      }

      for (const result of results) {
        if (result.error) errors[result.name] = result.error
      }

      // Run form-level validation
      if (validateForm) {
        const formErrors = await validateForm(values)
        if (formErrors) Object.assign(errors, formErrors)
      }

      // Do not publish a form-level result for a value snapshot that changed
      // while asynchronous validation was running.
      if (store.getValues() !== currentValues) return false

      const touchedPaths = touchFields
        ? Array.from(
            new Set<Path<Values>>([
              ...validationTasks.map(({ name }) => name),
              ...(Object.keys(errors) as Path<Values>[]),
            ])
          )
        : []

      store.batch(() => {
        for (const [name, controller] of controllers) {
          store.endValidation(name, controller)
        }
        validationsEnded = true
        store.replaceErrors(errors, touchedPaths)
      })

      return Object.keys(errors).length === 0
    } finally {
      endValidations()
    }
  }, [runFieldValidation, validate, validateForm, store])

  // Form submission handler
  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()

      const submission = store.startSubmission()
      if (!submission) return

      try {
        const isValid = await validateFormFn(true)
        if (!isValid || !onSubmit) return

        try {
          await onSubmit(store.getValues())
        } catch (error) {
          if (onSubmitError) {
            onSubmitError(error)
          } else {
            throw error
          }
        }
      } finally {
        store.endSubmission(submission)
      }
    },
    [validateFormFn, onSubmit, onSubmitError, store]
  )

  // Field operations
  const setFieldValue = useCallback(
    <P extends Path<Values>>(name: P, value: ValueAtPath<Values, P>) => {
      const wasValidated = store.hasValidated(name)
      store.setValue(name, value)

      const activeMode = wasValidated ? reValidateMode : mode
      if (activeMode === 'onChange' || activeMode === 'all') {
        void validateField(name).catch(() => undefined)
      }
    },
    [store, validateField, mode, reValidateMode]
  )

  const setFieldError = useCallback(
    <P extends Path<Values>>(name: P, error: string | undefined) => {
      store.setError(name, error)
    },
    [store]
  )

  const setFieldTouched = useCallback(
    <P extends Path<Values>>(name: P, touched: boolean) => {
      const wasValidated = store.hasValidated(name)
      store.setTouched(name, touched)

      const activeMode = wasValidated ? reValidateMode : mode
      if (touched && (activeMode === 'onBlur' || activeMode === 'all')) {
        void validateField(name).catch(() => undefined)
      }
    },
    [store, validateField, mode, reValidateMode]
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

  const batch = useCallback(
    <Result,>(callback: () => Result): Result => store.batch(callback),
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

  // Field component (pre-bound to this form)
  const BoundField = useCallback(
    function BoundField<P extends Path<Values>>(
      props: FieldComponentProps<Values, P>
    ): ReactNode {
      return (
        <FieldComponent
          {...props}
          store={store}
          mode={props.mode ?? mode}
          reValidateMode={props.reValidateMode ?? reValidateMode}
          validateField={boundValidateField}
        />
      )
    },
    [store, mode, reValidateMode, boundValidateField]
  ) as <P extends Path<Values>>(props: FieldComponentProps<Values, P>) => ReactNode

  // FieldArray component (pre-bound to this form)
  const BoundFieldArray = useCallback(
    function BoundFieldArray<P extends ArrayPath<Values>>(
      props: FieldArrayComponentProps<Values, P>
    ): ReactNode {
      return <FieldArrayComponent {...props} store={store} />
    },
    [store]
  ) as <P extends ArrayPath<Values>>(
    props: FieldArrayComponentProps<Values, P>
  ) => ReactNode

  const fieldOperations = useMemo<FieldHookOperations<Values>>(() => ({
    setFieldValue,
    setFieldError,
    setFieldTouched,
    validateField,
  }), [setFieldValue, setFieldError, setFieldTouched, validateField])
  const useBoundField = useMemo(
    () => createBoundUseField(store, fieldOperations),
    [fieldOperations, store]
  )

  return {
    // Form state is exposed through live getters. Reading a getter during
    // render subscribes the owner only to that state slice.
    get values() {
      observedSlices.add('values')
      return store.getValues()
    },
    get errors() {
      observedSlices.add('errors')
      return store.getErrors()
    },
    get touched() {
      observedSlices.add('touched')
      return store.getTouchedFields()
    },
    get isSubmitting() {
      observedSlices.add('submission')
      return store.isSubmitting()
    },
    get isSubmitted() {
      observedSlices.add('submission')
      return store.getSubmitCount() > 0
    },
    get isValid() {
      observedSlices.add('valid')
      return store.isValid()
    },
    get isDirty() {
      observedSlices.add('dirty')
      return store.isDirty()
    },
    get isValidating() {
      observedSlices.add('validating')
      return store.isValidating()
    },
    get submitCount() {
      observedSlices.add('submission')
      return store.getSubmitCount()
    },

    // Operations
    setFieldValue,
    setFieldError,
    setFieldTouched,
    getFieldState,
    validateField,
    validate: validateFormFn,
    handleSubmit,
    reset,
    batch,
    subscribe,

    // Hooks
    useField: useBoundField,
    useFormState: useBoundFormState,

    // Components
    Field: BoundField,
    FieldArray: BoundFieldArray,
  }
}
