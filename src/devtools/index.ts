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
} from '../utils/debug.js'

// Accessibility helpers
export {
  getFieldAriaProps,
  generateFieldIds,
  getLabelProps,
  getErrorProps,
  getDescriptionProps,
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
  type FormSnapshot,
  type PerformanceMetrics,
} from '../utils/devtools.js'
