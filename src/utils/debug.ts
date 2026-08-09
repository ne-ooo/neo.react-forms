/**
 * Debug utilities for @lpm.dev/neo.react-forms
 *
 * Provides helpful logging and debugging tools during development
 */

import {
  redactDevToolsValue,
  type DevToolsPrivacyOptions,
  type SensitiveFieldMatcher,
} from './devtools.js'

/**
 * Debug logger configuration
 */
export interface DebugConfig extends DevToolsPrivacyOptions {
  /**
   * Enable debug logging
   */
  enabled: boolean

  /**
   * Log field value changes
   */
  logValueChanges: boolean

  /**
   * Log validation runs
   */
  logValidation: boolean

  /**
   * Log form submissions
   */
  logSubmissions: boolean

  /**
   * Log field state updates (touched, dirty, etc.)
   */
  logStateUpdates: boolean

  /**
   * Custom logger function (defaults to console.log)
   */
  logger?: (message: string, data?: unknown) => void

  /** Include sensitive values in logs. This option is false by default. */
  includeSensitiveValues?: boolean

  /** Add application-specific sensitive field names or paths. */
  sensitiveFields?: readonly SensitiveFieldMatcher[]
}

/**
 * Global debug configuration
 */
let debugConfig: DebugConfig = {
  enabled: false,
  logValueChanges: true,
  logValidation: true,
  logSubmissions: true,
  logStateUpdates: false,
}

/**
 * Configure debug mode
 *
 * @param config - Debug configuration
 *
 * @example
 * ```ts
 * import { configureDebug } from '@lpm.dev/neo.react-forms'
 *
 * // Enable debug mode in development
 * if (process.env.NODE_ENV === 'development') {
 *   configureDebug({ enabled: true })
 * }
 * ```
 */
export function configureDebug(config: Partial<DebugConfig>): void {
  debugConfig = { ...debugConfig, ...config }
}

/**
 * Get current debug configuration
 */
export function getDebugConfig(): DebugConfig {
  return { ...debugConfig }
}

/**
 * Log a debug message
 */
function log(category: string, message: string, data?: unknown): void {
  if (!debugConfig.enabled) return

  const logger = debugConfig.logger || console.log
  const timestamp = new Date().toISOString().split('T')[1]?.split('.')[0] || ''
  const formattedMessage = `[${timestamp}] [neo-forms:${category}] ${message}`

  if (data !== undefined) {
    logger(formattedMessage, data)
  } else {
    logger(formattedMessage)
  }
}

/**
 * Log field value change
 */
export function debugValueChange(
  formId: string,
  fieldName: string,
  oldValue: unknown,
  newValue: unknown
): void {
  if (!debugConfig.enabled || !debugConfig.logValueChanges) return

  log('value', `${formId}.${fieldName} changed`, {
    field: fieldName,
    oldValue: redactDevToolsValue(oldValue, fieldName, debugConfig),
    newValue: redactDevToolsValue(newValue, fieldName, debugConfig),
  })
}

/**
 * Log validation run
 */
export function debugValidation(
  formId: string,
  fieldName: string,
  result: { valid: boolean; error?: string; duration: number }
): void {
  if (!debugConfig.enabled || !debugConfig.logValidation) return

  const status = result.valid ? '✓' : '✗'
  log(
    'validation',
    `${status} ${formId}.${fieldName} validated in ${result.duration}ms`,
    result.error
      ? {
          error: redactDevToolsValue(result.error, fieldName, debugConfig),
        }
      : undefined
  )
}

/**
 * Log form submission
 */
export function debugSubmission(
  formId: string,
  result: { success: boolean; duration: number; error?: unknown }
): void {
  if (!debugConfig.enabled || !debugConfig.logSubmissions) return

  const status = result.success ? '✓' : '✗'
  log(
    'submission',
    `${status} ${formId} submitted in ${result.duration}ms`,
    result.error
      ? {
          error: redactDevToolsValue(
            result.error,
            'submission.error',
            debugConfig
          ),
        }
      : undefined
  )
}

/**
 * Log field state update
 */
export function debugStateUpdate(
  formId: string,
  fieldName: string,
  state: { touched?: boolean; dirty?: boolean; error?: string }
): void {
  if (!debugConfig.enabled || !debugConfig.logStateUpdates) return

  log('state', `${formId}.${fieldName} state updated`, {
    ...state,
    ...(state.error === undefined
      ? {}
      : {
          error: redactDevToolsValue(state.error, fieldName, debugConfig),
        }),
  })
}

/**
 * Log form creation
 */
export function debugFormCreated<Values extends object>(
  formId: string,
  initialValues: Values
): void {
  if (!debugConfig.enabled) return

  log('init', `Form created: ${formId}`, {
    fields: Object.keys(initialValues),
    initialValues: redactDevToolsValue(initialValues, '', debugConfig),
  })
}

/**
 * Create a unique form ID for debugging
 */
let formIdCounter = 0
export function createFormId(customId?: string): string {
  if (customId) return customId
  return `form-${++formIdCounter}`
}

/**
 * Log form state snapshot (useful for debugging)
 */
export function debugFormState(formId: string, state: unknown): void {
  if (!debugConfig.enabled) return

  log('snapshot', `${formId} state`, redactDevToolsValue(state, '', debugConfig))
}

/**
 * Performance timer utility
 */
export function createTimer(): () => number {
  const start = performance.now()
  return () => Math.round(performance.now() - start)
}
