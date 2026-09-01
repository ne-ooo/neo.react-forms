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
import { createLazyImmutableSnapshot } from '../utils/immutable.js'
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
  value: DeepReadonly<T>,
  validators: Validator<T, Values> | Validator<T, Values>[],
  values: DeepReadonly<Values> | undefined,
  context: ValidationContext<Values>
): Promise<string | undefined> {
  const validatorArray = Array.isArray(validators) ? validators : [validators]

  for (const validator of validatorArray) {
    const error = await validator(value, values, context)
    if (error !== null && error !== undefined) {
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
): Validator<unknown, Values> | Validator<unknown, Values>[] | undefined {
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

  return current as
    | Validator<unknown, Values>
    | Validator<unknown, Values>[]
    | undefined
}

const RESERVED_VALIDATION_PATH_SEGMENTS = new Set([
  '__proto__',
  'prototype',
  'constructor',
])

function assertSafeValidationPath(path: string): void {
  if (
    !path ||
    path.split('.').some((segment) =>
      RESERVED_VALIDATION_PATH_SEGMENTS.has(segment)
    )
  ) {
    throw new Error(`Unsafe form validation error path: ${path}`)
  }
}

function mergeFormValidationErrors<Values extends object>(
  target: Partial<Record<Path<Values>, string>>,
  source: Partial<Record<Path<Values>, string>>
): void {
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    throw new TypeError('Form validation must return an error record')
  }
  const prototype = Object.getPrototypeOf(source)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Form validation must return a plain error record')
  }

  for (const [path, error] of Object.entries(source)) {
    assertSafeValidationPath(path)
    if (typeof error !== 'string') {
      throw new TypeError(`Form validation error at "${path}" must be a string`)
    }
    target[path as Path<Values>] = error
  }
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
  const observedSlices = useRef(new Set<FormStoreSlice>())
  const renderObservedSlices = new Set<FormStoreSlice>()
  const storeRequestedOwnerRender = useRef(false)
  const renderedFromStoreUpdate = storeRequestedOwnerRender.current
  const [useBoundFormState] = useState(() => createBoundUseFormState(store))
  const registeredFieldValidators = useRef(
    new Map<
      string,
      Array<{
        token: symbol
        validator: Validator<unknown, Values>
      }>
    >()
  )
  const formValidationGeneration = useRef(0)
  const validationConfigGeneration = useRef(0)
  const previousValidationConfig = useRef({ validate, validateForm })

  const registerFieldValidator = useCallback(
    <P extends Path<Values>>(
      name: P,
      validator: Validator<ValueAtPath<Values, P>, Values>
    ): (() => void) => {
      assertSafeValidationPath(name)
      formValidationGeneration.current++
      store.cancelValidation(name)
      const token = Symbol(name)
      const registrations = registeredFieldValidators.current.get(name) ?? []
      registrations.push({
        token,
        validator: validator as Validator<unknown, Values>,
      })
      registeredFieldValidators.current.set(name, registrations)

      return () => {
        const currentRegistrations = registeredFieldValidators.current.get(name)
        if (!currentRegistrations) return
        const registrationIndex = currentRegistrations.findIndex(
          (registration) => registration.token === token
        )
        if (registrationIndex === -1) return
        const wasActive = registrationIndex === currentRegistrations.length - 1
        currentRegistrations.splice(registrationIndex, 1)
        if (currentRegistrations.length === 0) {
          registeredFieldValidators.current.delete(name)
        }
        if (wasActive) {
          formValidationGeneration.current++
          store.cancelValidation(name)
        }
      }
    },
    [store]
  )

  // Re-render only for form-state slices actually read by the owner. A form
  // that only renders bound Fields stays isolated from unrelated field work.
  useSyncExternalStore(
    useCallback(
      (callback) =>
        store.subscribeToStore((changedSlices) => {
          for (const slice of changedSlices) {
            if (observedSlices.current.has(slice)) {
              storeRequestedOwnerRender.current = true
              callback()
              return
            }
          }
        }),
      [store]
    ),
    useCallback(() => store.getVersion(), [store]),
    useCallback(() => store.getVersion(), [store])
  )

  // Commit only the slices read by this render. Reads made later from event
  // handlers or imperative code do not widen the component subscription.
  useEffect(() => {
    observedSlices.current = new Set(renderObservedSlices)
    storeRequestedOwnerRender.current = false
  })

  useEffect(() => {
    const previous = previousValidationConfig.current
    if (previous.validate === validate && previous.validateForm === validateForm) {
      return
    }
    previousValidationConfig.current = { validate, validateForm }
    if (renderedFromStoreUpdate) return
    validationConfigGeneration.current++
    formValidationGeneration.current++
    store.cancelAllValidations()
  }, [renderedFromStoreUpdate, store, validate, validateForm])

  const runFieldValidation = useCallback(
    async (
      name: Path<Values>,
      validators: Validator<unknown, Values> | Validator<unknown, Values>[],
      commit: boolean,
      existingController?: AbortController,
      existingValues?: DeepReadonly<Values>,
      existingSourceValues?: Values
    ): Promise<{ error: string | undefined; current: boolean }> => {
      const configGeneration = validationConfigGeneration.current
      const sourceValues = existingSourceValues ?? store.getInternalValues()
      const readonlyValues = existingValues ?? createLazyImmutableSnapshot(sourceValues)
      const value = getValueByPath(readonlyValues, name)
      const controller = existingController ?? store.startValidation(name)
      const ownsController = existingController === undefined

      try {
        const error = await runValidators(value, validators, readonlyValues, {
          name,
          signal: controller.signal,
          values: readonlyValues,
        })
        const current =
          store.isValidationCurrent(name, controller) &&
          store.getInternalValues() === sourceValues &&
          validationConfigGeneration.current === configGeneration
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
      const validators =
        registeredFieldValidators.current.get(name)?.at(-1)?.validator ??
        getValidatorForPath(validate, name)

      if (!validators) {
        store.cancelValidation(name)
        store.markValidated(name)
        store.setError(name, undefined)
        return true
      }

      const { error, current } = await runFieldValidation(
        name,
        validators as Validator<unknown, Values> | Validator<unknown, Values>[],
        true
      )
      return current && error === undefined
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

  useEffect(() => {
    return () => {
      formValidationGeneration.current++
      registeredFieldValidators.current.clear()
      store.dispose()
    }
  }, [store])

  // Validate entire form
  const runFormValidation = useCallback(async (
    touchFields = false
  ): Promise<{ isValid: boolean; values: DeepReadonly<Values> }> => {
    const generation = ++formValidationGeneration.current
    const errorRevision = store.getErrorRevision()
    // Run all field validators
    const currentValues = store.getInternalValues()
    const readonlyValues = createLazyImmutableSnapshot(currentValues)
    const values = readonlyValues
    const errors = Object.create(null) as Partial<Record<Path<Values>, string>>
    const validationTasks = new Map<string, {
      name: Path<Values>
      validators: Validator<unknown, Values> | Validator<unknown, Values>[]
    }>()

    if (validate) {
      // Expand nested schemas, including the schema for every current array item.
      const collectValidationTasks = (obj: unknown, prefix = ''): void => {
        if (obj === null || obj === undefined || typeof obj !== 'object') {
          return
        }

        for (const [key, validators] of Object.entries(obj)) {
          const path = prefix ? `${prefix}.${key}` : key
          assertSafeValidationPath(path)

          // Check if this is a validator function or array of validators
          if (typeof validators === 'function' || Array.isArray(validators)) {
            validationTasks.set(path, {
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

    for (const [name, registrations] of registeredFieldValidators.current) {
      const validator = registrations.at(-1)?.validator
      if (!validator) continue
      assertSafeValidationPath(name)
      validationTasks.set(name, {
        name: name as Path<Values>,
        validators: validator,
      })
    }

    const validationTaskList = Array.from(validationTasks.values())

    const controllers = store.batch(() => {
      const next = new Map<Path<Values>, AbortController>()
      for (const { name } of validationTaskList) {
        next.set(name, store.startValidation(name))
      }
      return next
    })
    let validationsEnded = false
    const endValidations = (abort = false): void => {
      if (validationsEnded) return
      store.batch(() => {
        for (const [name, controller] of controllers) {
          if (abort) controller.abort()
          store.endValidation(name, controller)
        }
      })
      validationsEnded = true
    }

    try {
      const results = await Promise.all(
        validationTaskList.map(async ({ name, validators }) => ({
          name,
          ...(await runFieldValidation(
            name,
            validators,
            false,
            controllers.get(name),
            readonlyValues,
            currentValues
          )),
        }))
      )

      // A newer field validation superseded this form validation. Treat the
      // form result as stale instead of clearing errors or allowing submit.
      if (
        generation !== formValidationGeneration.current ||
        store.getErrorRevision() !== errorRevision ||
        results.some(({ current }) => !current)
      ) {
        return { isValid: false, values }
      }

      for (const result of results) {
        if (result.error !== undefined) errors[result.name] = result.error
      }

      // Run form-level validation
      if (validateForm) {
        const formErrors = await validateForm(values)
        if (formErrors) mergeFormValidationErrors(errors, formErrors)
      }

      // Do not publish a form-level result when a newer field/form run or value
      // snapshot superseded it while asynchronous validation was running.
      if (
        generation !== formValidationGeneration.current ||
        store.getErrorRevision() !== errorRevision ||
        store.getInternalValues() !== currentValues ||
        Array.from(controllers).some(
          ([name, controller]) => !store.isValidationCurrent(name, controller)
        )
      ) {
        return { isValid: false, values }
      }

      const touchedPaths = touchFields
        ? Array.from(
            new Set<Path<Values>>([
              ...validationTaskList.map(({ name }) => name),
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

      return { isValid: Object.keys(errors).length === 0, values }
    } catch (error) {
      endValidations(true)
      throw error
    } finally {
      endValidations()
    }
  }, [runFieldValidation, validate, validateForm, store])

  const validateFormFn = useCallback(
    async (touchFields = false): Promise<boolean> =>
      (await runFormValidation(touchFields)).isValid,
    [runFormValidation]
  )

  // Form submission handler
  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault()

      const submission = store.startSubmission()
      if (!submission) return

      try {
        const { isValid, values } = await runFormValidation(true)
        if (!isValid || !onSubmit) return

        try {
          await onSubmit(values)
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
    [runFormValidation, onSubmit, onSubmitError, store]
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
    <P extends Path<Values>>(
      name: P
    ): FieldState<DeepReadonly<ValueAtPath<Values, P>>> => {
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
      callback: (
        state: FieldState<DeepReadonly<ValueAtPath<Values, P>>>
      ) => void
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
          registerValidator={registerFieldValidator}
          preserveValidateDuringStoreRender={storeRequestedOwnerRender.current}
        />
      )
    },
    [store, mode, reValidateMode, boundValidateField, registerFieldValidator]
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
    get values(): DeepReadonly<Values> {
      renderObservedSlices.add('values')
      return store.getValues() as DeepReadonly<Values>
    },
    get errors() {
      renderObservedSlices.add('errors')
      return store.getErrors()
    },
    get touched() {
      renderObservedSlices.add('touched')
      return store.getTouchedFields()
    },
    get isSubmitting() {
      renderObservedSlices.add('submission')
      return store.isSubmitting()
    },
    get isSubmitted() {
      renderObservedSlices.add('submission')
      return store.getSubmitCount() > 0
    },
    get isValid() {
      renderObservedSlices.add('valid')
      return store.isValid()
    },
    get isDirty() {
      renderObservedSlices.add('dirty')
      return store.isDirty()
    },
    get isValidating() {
      renderObservedSlices.add('validating')
      return store.isValidating()
    },
    get submitCount() {
      renderObservedSlices.add('submission')
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
