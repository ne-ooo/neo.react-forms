/**
 * DevTools integration for @lpm.dev/neo.react-forms
 *
 * Helpers for inspecting and debugging forms in browser DevTools
 */

import type { FormState, Path } from '../types.js'

/** Value used when DevTools hides a sensitive field. */
export const REDACTED_VALUE = '[REDACTED]' as const

/** A field name, field path, or regular expression that identifies sensitive data. */
export type SensitiveFieldMatcher = string | RegExp

/** Privacy controls for snapshots and debug output. */
export interface DevToolsPrivacyOptions {
  /**
   * Include sensitive values in output. This option is false by default.
   */
  includeSensitiveValues?: boolean

  /** Add application-specific field names or paths to the default sensitive list. */
  sensitiveFields?: readonly SensitiveFieldMatcher[]

  /** Transform each non-sensitive leaf value before DevTools uses it. */
  redactor?: (value: unknown, path: string) => unknown
}

/** Options for browser-global form exposure. */
export interface ExposeFormOptions extends DevToolsPrivacyOptions {
  /** Explicit confirmation that the caller wants browser-global exposure. */
  enabled: true

  /** Permit exposure when NODE_ENV is production. This option is false by default. */
  allowInProduction?: boolean
}

/** The value shape used by privacy-aware DevTools snapshots. */
export type DevToolsValue<Value> = Value extends (...args: never[]) => unknown
  ? Value | typeof REDACTED_VALUE
  : Value extends readonly (infer Item)[]
    ? Array<DevToolsValue<Item>>
    : Value extends Date | RegExp
      ? Value | typeof REDACTED_VALUE
      : Value extends object
        ? { [Key in keyof Value]: DevToolsValue<Value[Key]> }
        : Value | typeof REDACTED_VALUE

const DEFAULT_SENSITIVE_FIELD_PATTERN =
  /password|passwd|passcode|secret|token|authorization|api.?key|private.?key|card.?number|security.?code|cvv|cvc|social.?security|ssn|(^|[^a-z])pin([^a-z]|$)/i

function regularExpressionMatches(expression: RegExp, value: string): boolean {
  const previousLastIndex = expression.lastIndex
  expression.lastIndex = 0
  const matches = expression.test(value)
  expression.lastIndex = previousLastIndex
  return matches
}

/** Check whether a field path contains sensitive data. */
export function isSensitiveField(
  path: string,
  additionalMatchers: readonly SensitiveFieldMatcher[] = []
): boolean {
  if (regularExpressionMatches(DEFAULT_SENSITIVE_FIELD_PATTERN, path)) return true

  const normalizedPath = path.toLowerCase()
  const lastSegment = normalizedPath.split(/[.[\]]/).filter(Boolean).at(-1)

  return additionalMatchers.some((matcher) => {
    if (typeof matcher === 'string') {
      const normalizedMatcher = matcher.toLowerCase()
      return normalizedPath === normalizedMatcher || lastSegment === normalizedMatcher
    }
    return regularExpressionMatches(matcher, path)
  })
}

/** Apply the default DevTools privacy rules to a value. */
export function redactDevToolsValue(
  value: unknown,
  path: string,
  options: DevToolsPrivacyOptions = {}
): unknown {
  return redactValue(value, path, options, new WeakSet<object>(), false)
}

function redactValue(
  value: unknown,
  path: string,
  options: DevToolsPrivacyOptions,
  ancestors: WeakSet<object>,
  forceRedaction: boolean
): unknown {
  const isSensitive = forceRedaction || (
    !options.includeSensitiveValues &&
    path.length > 0 &&
    isSensitiveField(path, options.sensitiveFields ?? [])
  )

  if (Array.isArray(value)) {
    if (ancestors.has(value)) return '[Circular]'
    ancestors.add(value)
    const redactedArray = value.map((item, index) =>
      redactValue(
        item,
        path ? `${path}.${index}` : String(index),
        options,
        ancestors,
        isSensitive
      )
    )
    ancestors.delete(value)
    return redactedArray
  }

  if (value !== null && typeof value === 'object') {
    if (value instanceof Date) {
      return isSensitive ? REDACTED_VALUE : new Date(value)
    }
    if (value instanceof RegExp) {
      return isSensitive
        ? REDACTED_VALUE
        : new RegExp(value.source, value.flags)
    }
    if (ancestors.has(value)) return '[Circular]'

    ancestors.add(value)
    const redactedObject: Record<string, unknown> = {}
    for (const [key, nestedValue] of Object.entries(value)) {
      const nestedPath = path ? `${path}.${key}` : key
      redactedObject[key] = redactValue(
        nestedValue,
        nestedPath,
        options,
        ancestors,
        isSensitive
      )
    }
    ancestors.delete(value)
    return redactedObject
  }

  if (isSensitive) return REDACTED_VALUE
  return options.redactor ? options.redactor(value, path) : value
}

/**
 * Form state snapshot for DevTools
 */
export interface FormSnapshot<Values extends object> {
  /**
   * Current form values
   */
  values: DevToolsValue<Values>

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
    value: unknown
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
 * @param options - Privacy options. Sensitive values are redacted by default.
 * @returns Form snapshot
 *
 * @example
 * ```ts
 * const snapshot = createFormSnapshot(form, initialValues)
 * console.log('Form State:', snapshot)
 * ```
 */
export function createFormSnapshot<Values extends object>(
  formState: FormState<Values>,
  initialValues: Values,
  options: DevToolsPrivacyOptions = {}
): FormSnapshot<Values> {
  // Extract field information
  const fields: Array<{
    name: string
    value: unknown
    error?: string
    touched: boolean
    dirty: boolean
  }> = []

  function extractFields(obj: object, parentPath = ''): void {
    for (const [key, value] of Object.entries(obj)) {
      const path = parentPath ? `${parentPath}.${key}` : key

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Recurse for nested objects
        extractFields(value, path)
      } else {
        // Add field info
        const initialValue = getNestedValue(initialValues, path)
        const error = formState.errors[path as Path<Values>]
        const fieldInfo: {
          name: string
          value: unknown
          error?: string
          touched: boolean
          dirty: boolean
        } = {
          name: path,
          value: redactDevToolsValue(value, path, options),
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

  const errors: Partial<Record<Path<Values>, string>> = {}
  for (const [path, error] of Object.entries(formState.errors)) {
    if (typeof error === 'string') {
      errors[path as Path<Values>] = redactDevToolsValue(
        error,
        path,
        options
      ) as string
    }
  }

  return {
    values: redactDevToolsValue(
      formState.values,
      '',
      options
    ) as DevToolsValue<Values>,
    errors,
    touched: { ...formState.touched },
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
function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[key]
  }, obj)
}

function protectSnapshot<Values extends object>(
  snapshot: FormSnapshot<Values>,
  options: DevToolsPrivacyOptions
): FormSnapshot<Values> {
  const errors: Partial<Record<Path<Values>, string>> = {}
  for (const [path, error] of Object.entries(snapshot.errors)) {
    if (typeof error === 'string') {
      errors[path as Path<Values>] = redactDevToolsValue(
        error,
        path,
        options
      ) as string
    }
  }

  return {
    values: redactDevToolsValue(
      snapshot.values,
      '',
      options
    ) as DevToolsValue<Values>,
    errors,
    touched: { ...snapshot.touched },
    state: { ...snapshot.state },
    fields: snapshot.fields.map((field) => ({
      ...field,
      value: redactDevToolsValue(field.value, field.name, options),
      ...(field.error === undefined
        ? {}
        : {
            error: redactDevToolsValue(
              field.error,
              field.name,
              options
            ) as string,
          }),
    })),
    timestamp: snapshot.timestamp,
  }
}

/**
 * Log form state to console in a developer-friendly format
 *
 * @param formId - Form identifier
 * @param snapshot - Form snapshot
 * @param options - Privacy options. Sensitive values are redacted by default.
 *
 * @example
 * ```ts
 * logFormState('signup-form', createFormSnapshot(form, initialValues))
 * ```
 */
export function logFormState<Values extends object>(
  formId: string,
  snapshot: FormSnapshot<Values>,
  options: DevToolsPrivacyOptions = {}
): void {
  const protectedSnapshot = protectSnapshot(snapshot, options)

  console.group(`📋 Form State: ${formId}`)

  // Overall state
  console.log('State:', protectedSnapshot.state)

  // Values
  console.log('Values:', protectedSnapshot.values)

  // Errors (if any)
  if (Object.keys(protectedSnapshot.errors).length > 0) {
    console.error('Errors:', protectedSnapshot.errors)
  }

  // Touched fields
  const touchedFields = Object.keys(protectedSnapshot.touched)
  if (touchedFields.length > 0) {
    console.log('Touched Fields:', touchedFields)
  }

  // Field details
  console.table(
    protectedSnapshot.fields.map((field) => ({
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
 * @param options - Explicit exposure and privacy options
 *
 * @returns Cleanup function that removes this exposure
 *
 * @example
 * ```ts
 * // In development, expose form to window
 * if (process.env.NODE_ENV === 'development') {
 *   const cleanup = exposeFormToWindow(
 *     'signup-form',
 *     createFormSnapshot(form, initialValues),
 *     { enabled: true }
 *   )
 * }
 *
 * // Then in DevTools console:
 * window.__NEO_FORMS__.['signup-form']
 * ```
 */
export function exposeFormToWindow<Values extends object>(
  formId: string,
  snapshot: FormSnapshot<Values>,
  options: ExposeFormOptions
): () => void {
  const noCleanupNeeded = (): void => {}
  if (typeof window === 'undefined' || options.enabled !== true) {
    return noCleanupNeeded
  }

  const runtimeProcess = (
    globalThis as typeof globalThis & {
      process?: { env?: { NODE_ENV?: string } }
    }
  ).process
  if (
    runtimeProcess?.env?.NODE_ENV === 'production' &&
    !options.allowInProduction
  ) {
    return noCleanupNeeded
  }

  const protectedSnapshot = protectSnapshot(snapshot, options)
  const devToolsWindow = window as Window & {
    __NEO_FORMS__?: Record<string, unknown>
  }

  // Create global forms object if it doesn't exist
  if (!devToolsWindow.__NEO_FORMS__) {
    devToolsWindow.__NEO_FORMS__ = Object.create(null) as Record<string, unknown>
  }

  devToolsWindow.__NEO_FORMS__[formId] = protectedSnapshot

  // Log helpful message
  console.log(
    `📋 Form "${formId}" exposed to DevTools: window.__NEO_FORMS__['${formId}']`
  )

  return () => {
    const registry = devToolsWindow.__NEO_FORMS__
    if (!registry || registry[formId] !== protectedSnapshot) return

    delete registry[formId]
    if (Object.keys(registry).length === 0) {
      delete devToolsWindow.__NEO_FORMS__
    }
  }
}

/**
 * Create a form state diff between two snapshots
 *
 * @param before - Previous snapshot
 * @param after - Current snapshot
 * @returns Diff object
 */
export function diffFormState<Values extends object>(
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
