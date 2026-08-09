import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { FormStore } from '../core/store.js'
import type {
  DeepReadonly,
  FormState,
  FormStateEquality,
  FormStateSelector,
  Path,
  UseFieldReturn,
  ValueAtPath,
} from '../types.js'

export interface FieldHookOperations<Values extends object> {
  setFieldValue: <P extends Path<Values>>(
    name: P,
    value: ValueAtPath<Values, P>
  ) => void
  setFieldError: <P extends Path<Values>>(
    name: P,
    error: string | undefined
  ) => void
  setFieldTouched: <P extends Path<Values>>(name: P, touched: boolean) => void
  validateField: <P extends Path<Values>>(name: P) => Promise<boolean>
}

export function createBoundUseField<Values extends object>(
  store: FormStore<Values>,
  operations: FieldHookOperations<Values>
): <P extends Path<Values>>(
  name: P
) => UseFieldReturn<ValueAtPath<Values, P>> {
  return function useField<P extends Path<Values>>(
    name: P
  ): UseFieldReturn<ValueAtPath<Values, P>> {
    const subscribe = useCallback(
      (callback: () => void) => store.subscribe(name, () => callback()),
      [name, store]
    )
    const getSnapshot = useCallback(
      () => store.getFieldState(name),
      [name, store]
    )
    const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

    const setValue = useCallback(
      (value: ValueAtPath<Values, P>) => {
        operations.setFieldValue(name, value)
      },
      [name, operations]
    )
    const setError = useCallback(
      (error: string | undefined) => {
        operations.setFieldError(name, error)
      },
      [name, operations]
    )
    const setTouched = useCallback(
      (touched: boolean) => {
        operations.setFieldTouched(name, touched)
      },
      [name, operations]
    )
    const validate = useCallback(
      () => operations.validateField(name),
      [name, operations]
    )

    return {
      ...state,
      setValue,
      setError,
      setTouched,
      validate,
    }
  }
}

function readFormState<Values extends object>(
  store: FormStore<Values>
): DeepReadonly<FormState<Values>> {
  return {
    get values() {
      return store.getValues()
    },
    get errors() {
      return store.getErrors()
    },
    get touched() {
      return store.getTouchedFields()
    },
    get isSubmitting() {
      return store.isSubmitting()
    },
    get isSubmitted() {
      return store.getSubmitCount() > 0
    },
    get isValid() {
      return store.isValid()
    },
    get isDirty() {
      return store.isDirty()
    },
    get isValidating() {
      return store.isValidating()
    },
    get submitCount() {
      return store.getSubmitCount()
    },
  } as DeepReadonly<FormState<Values>>
}

export function createBoundUseFormState<Values extends object>(
  store: FormStore<Values>
): <Selected>(
  selector: FormStateSelector<Values, Selected>,
  isEqual?: FormStateEquality<Selected>
) => Selected {
  return function useFormState<Selected>(
    selector: FormStateSelector<Values, Selected>,
    isEqual: FormStateEquality<Selected> = Object.is
  ): Selected {
    const getSnapshot = useMemo(() => {
      let hasValue = false
      let selected: Selected

      return (): Selected => {
        const next = selector(readFormState(store))
        if (!hasValue || !isEqual(selected, next)) {
          hasValue = true
          selected = next
        }
        return selected
      }
    }, [isEqual, selector, store])

    const subscribe = useCallback(
      (callback: () => void) => store.subscribeToStore(() => callback()),
      [store]
    )

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  }
}
