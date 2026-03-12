/**
 * DevTools integration for @lpm.dev/neo.react-forms
 *
 * Helpers for inspecting and debugging forms in browser DevTools
 */

import type { FormState, Path } from '../types.js'

/**
 * Form state snapshot for DevTools
 */
export interface FormSnapshot<Values extends Record<string, unknown>> {
  /**
   * Current form values
   */
  values: Values

  /**
   * Current errors
   */
  errors: Partial<Record<Path<Values>, string>>

  /**
   * Touched fields
   */
  touched: Partial<Record<Path<Values>, boolean>>

  /**
   * Form state flags
   */
  state: {
    isValid: boolean
    isDirty: boolean
    isSubmitting: boolean
    isSubmitted: boolean
    isValidating: boolean
    submitCount: number
  }

  /**
   * Field-level state
   */
  fields: Array<{
    name: string
    value: any
    error?: string
    touched: boolean
    dirty: boolean
  }>

  /**
   * Snapshot timestamp
   */
  timestamp: number
}

/**
 * Create a form state snapshot for DevTools inspection
 *
 * @param formState - Current form state
 * @param initialValues - Initial form values (for dirty detection)
 * @returns Form snapshot
 *
 * @example
 * ```ts
 * const snapshot = createFormSnapshot(form, initialValues)
 * console.log('Form State:', snapshot)
 * ```
 */
export function createFormSnapshot<Values extends Record<string, unknown>>(
  formState: FormState<Values>,
  initialValues: Values
): FormSnapshot<Values> {
  // Extract field information
  const fields: Array<{
    name: string
    value: any
    error?: string
    touched: boolean
    dirty: boolean
  }> = []

  function extractFields(obj: any, parentPath = ''): void {
    for (const [key, value] of Object.entries(obj)) {
      const path = parentPath ? `${parentPath}.${key}` : key

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Recurse for nested objects
        extractFields(value, path)
      } else {
        // Add field info
        const initialValue = getNestedValue(initialValues, path)
        const error = formState.errors[path as Path<Values>]
        const fieldInfo: any = {
          name: path,
          value,
          touched: formState.touched[path as Path<Values>] ?? false,
          dirty: value !== initialValue,
        }
        if (error !== undefined) {
          fieldInfo.error = error
        }
        fields.push(fieldInfo)
      }
    }
  }

  extractFields(formState.values)

  return {
    values: formState.values,
    errors: formState.errors,
    touched: formState.touched,
    state: {
      isValid: formState.isValid,
      isDirty: formState.isDirty,
      isSubmitting: formState.isSubmitting,
      isSubmitted: formState.isSubmitted,
      isValidating: formState.isValidating,
      submitCount: formState.submitCount,
    },
    fields,
    timestamp: Date.now(),
  }
}

/**
 * Get nested value from object by path
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

/**
 * Log form state to console in a developer-friendly format
 *
 * @param formId - Form identifier
 * @param snapshot - Form snapshot
 *
 * @example
 * ```ts
 * logFormState('signup-form', createFormSnapshot(form, initialValues))
 * ```
 */
export function logFormState<Values extends Record<string, unknown>>(
  formId: string,
  snapshot: FormSnapshot<Values>
): void {
  console.group(`📋 Form State: ${formId}`)

  // Overall state
  console.log('State:', snapshot.state)

  // Values
  console.log('Values:', snapshot.values)

  // Errors (if any)
  if (Object.keys(snapshot.errors).length > 0) {
    console.error('Errors:', snapshot.errors)
  }

  // Touched fields
  const touchedFields = Object.keys(snapshot.touched)
  if (touchedFields.length > 0) {
    console.log('Touched Fields:', touchedFields)
  }

  // Field details
  console.table(
    snapshot.fields.map((field) => ({
      Field: field.name,
      Value: JSON.stringify(field.value),
      Error: field.error || '-',
      Touched: field.touched ? '✓' : '',
      Dirty: field.dirty ? '✓' : '',
    }))
  )

  console.groupEnd()
}

/**
 * Expose form state to window for DevTools access
 *
 * @param formId - Form identifier
 * @param snapshot - Form snapshot
 *
 * @example
 * ```ts
 * // In development, expose form to window
 * if (process.env.NODE_ENV === 'development') {
 *   exposeFormToWindow('signup-form', createFormSnapshot(form, initialValues))
 * }
 *
 * // Then in DevTools console:
 * window.__NEO_FORMS__.['signup-form']
 * ```
 */
export function exposeFormToWindow<Values extends Record<string, unknown>>(
  formId: string,
  snapshot: FormSnapshot<Values>
): void {
  if (typeof window === 'undefined') return

  // Create global forms object if it doesn't exist
  if (!(window as any).__NEO_FORMS__) {
    ;(window as any).__NEO_FORMS__ = {}
  }

  ;(window as any).__NEO_FORMS__[formId] = snapshot

  // Log helpful message
  console.log(
    `📋 Form "${formId}" exposed to DevTools: window.__NEO_FORMS__['${formId}']`
  )
}

/**
 * Create a form state diff between two snapshots
 *
 * @param before - Previous snapshot
 * @param after - Current snapshot
 * @returns Diff object
 */
export function diffFormState<Values extends Record<string, unknown>>(
  before: FormSnapshot<Values>,
  after: FormSnapshot<Values>
): {
  changedFields: string[]
  newErrors: Partial<Record<Path<Values>, string>>
  clearedErrors: string[]
  touchedFields: string[]
} {
  const changedFields: string[] = []
  const newErrors: Partial<Record<Path<Values>, string>> = {}
  const clearedErrors: string[] = []
  const touchedFields: string[] = []

  // Find changed fields
  after.fields.forEach((afterField) => {
    const beforeField = before.fields.find((f) => f.name === afterField.name)
    if (!beforeField || beforeField.value !== afterField.value) {
      changedFields.push(afterField.name)
    }
  })

  // Find new errors
  for (const [field, error] of Object.entries(after.errors)) {
    if (typeof error === 'string' && !before.errors[field as Path<Values>]) {
      newErrors[field as Path<Values>] = error
    }
  }

  // Find cleared errors
  for (const field of Object.keys(before.errors)) {
    if (!after.errors[field as Path<Values>]) {
      clearedErrors.push(field)
    }
  }

  // Find newly touched fields
  for (const [field, touched] of Object.entries(after.touched)) {
    if (touched && !before.touched[field as Path<Values>]) {
      touchedFields.push(field)
    }
  }

  return {
    changedFields,
    newErrors,
    clearedErrors,
    touchedFields,
  }
}

/**
 * Performance metrics for form operations
 */
export interface PerformanceMetrics {
  /**
   * Time to validate a field (ms)
   */
  validationTime: number

  /**
   * Time to submit form (ms)
   */
  submissionTime: number

  /**
   * Time to re-render after value change (ms)
   */
  renderTime: number

  /**
   * Total fields in form
   */
  fieldCount: number

  /**
   * Number of re-renders
   */
  renderCount: number
}

/**
 * Create performance monitor for a form
 *
 * @returns Performance monitor object
 */
export function createPerformanceMonitor(): {
  startTimer: (operation: string) => () => void
  getMetrics: () => Record<string, number>
  logMetrics: () => void
} {
  const metrics: Record<string, number[]> = {}

  return {
    startTimer: (operation: string) => {
      const start = performance.now()
      return () => {
        const duration = performance.now() - start
        if (!metrics[operation]) {
          metrics[operation] = []
        }
        metrics[operation].push(duration)
      }
    },

    getMetrics: () => {
      const result: Record<string, number> = {}
      for (const [operation, times] of Object.entries(metrics)) {
        const avg = times.reduce((sum, t) => sum + t, 0) / times.length
        result[operation] = Math.round(avg * 100) / 100
      }
      return result
    },

    logMetrics: () => {
      const result = Object.entries(metrics).map(([operation, times]) => {
        const avg = times.reduce((sum, t) => sum + t, 0) / times.length
        const min = Math.min(...times)
        const max = Math.max(...times)
        return {
          Operation: operation,
          'Avg (ms)': Math.round(avg * 100) / 100,
          'Min (ms)': Math.round(min * 100) / 100,
          'Max (ms)': Math.round(max * 100) / 100,
          Count: times.length,
        }
      })

      console.group('⚡ Form Performance Metrics')
      console.table(result)
      console.groupEnd()
    },
  }
}
