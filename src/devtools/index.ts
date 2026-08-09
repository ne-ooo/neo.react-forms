/**
 * Developer Tools for @lpm.dev/neo.react-forms
 *
 * Debugging, accessibility, and error message utilities
 */

// Debug utilities
export {
  configureDebug,
  getDebugConfig,
  debugValueChange,
  debugValidation,
  debugSubmission,
  debugStateUpdate,
  debugFormCreated,
  debugFormState,
  createFormId,
  createTimer,
  type DebugConfig,
} from '../utils/debug.js'

// Accessibility helpers
export {
  getFieldAriaProps,
  generateFieldIds,
  getLabelProps,
  getErrorProps,
  getDescriptionProps,
  createSafeHtmlId,
  announceToScreenReader,
  announceValidationError,
  announceFormSubmission,
  type A11yFieldProps,
} from '../utils/accessibility.js'

// Enhanced error messages
export {
  enhanceErrorMessage,
  formatError,
  ErrorMessages,
  createValidationError,
  type EnhancedError,
} from '../utils/error-messages.js'

// DevTools integration
export {
  createFormSnapshot,
  logFormState,
  exposeFormToWindow,
  diffFormState,
  createPerformanceMonitor,
  REDACTED_VALUE,
  isSensitiveField,
  redactDevToolsValue,
  type FormSnapshot,
  type PerformanceMetrics,
  type DevToolsValue,
  type DevToolsPrivacyOptions,
  type ExposeFormOptions,
  type SensitiveFieldMatcher,
} from '../utils/devtools.js'
