/**
 * Enhanced error messages with suggestions
 *
 * Provides helpful error messages with actionable suggestions
 */

/**
 * Error message with suggestion
 */
export interface EnhancedError {
  /**
   * Error message
   */
  message: string

  /**
   * Helpful suggestion to fix the error
   */
  suggestion?: string

  /**
   * Error code (for programmatic handling)
   */
  code?: string
}

/**
 * Common validation error patterns
 */
const ERROR_PATTERNS: Array<{
  pattern: RegExp
  suggestion: string
  code?: string
}> = [
  // Email errors
  {
    pattern: /invalid.*email|email.*invalid/i,
    suggestion: 'Use format: name@example.com',
    code: 'INVALID_EMAIL',
  },
  {
    pattern: /email.*required|required.*email/i,
    suggestion: 'Please enter your email address',
    code: 'EMAIL_REQUIRED',
  },

  // Password errors
  {
    pattern: /password.*short|password.*\d+.*character/i,
    suggestion: 'Use at least 8 characters with a mix of letters and numbers',
    code: 'PASSWORD_TOO_SHORT',
  },
  {
    pattern: /password.*match|passwords.*match/i,
    suggestion: 'Make sure both password fields are identical',
    code: 'PASSWORDS_MISMATCH',
  },
  {
    pattern: /password.*weak|weak.*password/i,
    suggestion: 'Include uppercase, lowercase, numbers, and special characters',
    code: 'PASSWORD_WEAK',
  },

  // URL errors
  {
    pattern: /invalid.*url|url.*invalid/i,
    suggestion: 'Use format: https://example.com',
    code: 'INVALID_URL',
  },

  // Number errors
  {
    pattern: /must.*be.*\d+.*or.*older|age.*\d+/i,
    suggestion: 'You must meet the minimum age requirement',
    code: 'AGE_REQUIREMENT',
  },
  {
    pattern: /must.*be.*between|value.*between/i,
    suggestion: 'Enter a value within the allowed range',
    code: 'OUT_OF_RANGE',
  },

  // Required field errors
  {
    pattern: /required|cannot.*be.*empty|must.*provide/i,
    suggestion: 'This field is required',
    code: 'FIELD_REQUIRED',
  },

  // Length errors
  {
    pattern: /too.*short|minimum.*\d+.*character/i,
    suggestion: 'Add more characters to meet the minimum length',
    code: 'TOO_SHORT',
  },
  {
    pattern: /too.*long|maximum.*\d+.*character/i,
    suggestion: 'Reduce the number of characters',
    code: 'TOO_LONG',
  },

  // Format errors
  {
    pattern: /invalid.*format|format.*invalid/i,
    suggestion: 'Check the required format for this field',
    code: 'INVALID_FORMAT',
  },
  {
    pattern: /invalid.*phone|phone.*invalid/i,
    suggestion: 'Use format: (123) 456-7890 or 123-456-7890',
    code: 'INVALID_PHONE',
  },
]

/**
 * Enhance an error message with suggestions
 *
 * @param error - Original error message
 * @returns Enhanced error with suggestion
 *
 * @example
 * ```ts
 * const enhanced = enhanceErrorMessage('Invalid email address')
 * // { message: 'Invalid email address', suggestion: 'Use format: name@example.com', code: 'INVALID_EMAIL' }
 * ```
 */
export function enhanceErrorMessage(error: string): EnhancedError {
  if (!error) {
    return { message: error }
  }

  // Check if error matches any known pattern
  for (const { pattern, suggestion, code } of ERROR_PATTERNS) {
    if (pattern.test(error)) {
      const enhanced: EnhancedError = { message: error }
      if (suggestion !== undefined) enhanced.suggestion = suggestion
      if (code !== undefined) enhanced.code = code
      return enhanced
    }
  }

  // Return original error if no match found
  return { message: error }
}

/**
 * Format error message with suggestion
 *
 * @param error - Error message or enhanced error
 * @param format - Format type
 * @returns Formatted error string
 *
 * @example
 * ```ts
 * formatError('Invalid email', 'full')
 * // "Invalid email. Suggestion: Use format: name@example.com"
 * ```
 */
export function formatError(
  error: string | EnhancedError,
  format: 'message' | 'suggestion' | 'full' = 'message'
): string {
  const enhanced = typeof error === 'string' ? enhanceErrorMessage(error) : error

  switch (format) {
    case 'message':
      return enhanced.message

    case 'suggestion':
      return enhanced.suggestion || ''

    case 'full':
      if (enhanced.suggestion) {
        return `${enhanced.message}. Suggestion: ${enhanced.suggestion}`
      }
      return enhanced.message

    default:
      return enhanced.message
  }
}

/**
 * Common error messages (pre-defined for consistency)
 */
export const ErrorMessages = {
  // Required fields
  required: (fieldName?: string): string =>
    fieldName ? `${fieldName} is required` : 'This field is required',

  // Email
  email: 'Please enter a valid email address',
  emailRequired: 'Email address is required',

  // Password
  passwordTooShort: (minLength: number): string =>
    `Password must be at least ${minLength} characters`,
  passwordsMatch: 'Passwords must match',
  passwordWeak: 'Password must include uppercase, lowercase, number, and special character',

  // Numbers
  minNumber: (min: number): string => `Must be at least ${min}`,
  maxNumber: (max: number): string => `Must be at most ${max}`,
  numberBetween: (min: number, max: number): string => `Must be between ${min} and ${max}`,

  // Strings
  minLength: (min: number): string => `Must be at least ${min} characters`,
  maxLength: (max: number): string => `Must be at most ${max} characters`,

  // URLs
  url: 'Please enter a valid URL (e.g., https://example.com)',

  // Phone
  phone: 'Please enter a valid phone number',

  // Dates
  date: 'Please enter a valid date',
  dateAfter: (date: string): string => `Must be after ${date}`,
  dateBefore: (date: string): string => `Must be before ${date}`,

  // Generic
  invalid: (fieldName?: string): string =>
    fieldName ? `${fieldName} is invalid` : 'This field is invalid',
} as const

/**
 * Create a validation error with suggestion
 *
 * @param message - Error message
 * @param suggestion - Helpful suggestion
 * @param code - Error code
 * @returns Enhanced error
 *
 * @example
 * ```ts
 * throw createValidationError(
 *   'Password too short',
 *   'Use at least 8 characters',
 *   'PASSWORD_TOO_SHORT'
 * )
 * ```
 */
export function createValidationError(
  message: string,
  suggestion?: string,
  code?: string
): EnhancedError {
  const error: EnhancedError = { message }
  if (suggestion !== undefined) {
    error.suggestion = suggestion
  }
  if (code !== undefined) {
    error.code = code
  }
  return error
}
