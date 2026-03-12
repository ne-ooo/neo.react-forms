/**
 * String validators - Tree-shakeable validation functions
 *
 * Import only what you need:
 * import { required, email, minLength } from '@lpm.dev/neo.react-forms/validators'
 */

import type { Validator } from '../types.js'

/**
 * Required field validator
 *
 * @param message - Custom error message
 * @returns Validator function
 *
 * @example
 * ```ts
 * validate: {
 *   email: required('Email is required')
 * }
 * ```
 */
export function required(message = 'This field is required'): Validator<string> {
  return (value: string) => {
    if (!value || value.trim() === '') {
      return message
    }
    return null
  }
}

/**
 * Email validator
 *
 * @param message - Custom error message
 * @returns Validator function
 *
 * @example
 * ```ts
 * validate: {
 *   email: email('Invalid email address')
 * }
 * ```
 */
export function email(message = 'Invalid email address'): Validator<string> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return (value: string) => {
    if (value && !emailRegex.test(value)) {
      return message
    }
    return null
  }
}

/**
 * URL validator
 *
 * @param message - Custom error message
 * @returns Validator function
 *
 * @example
 * ```ts
 * validate: {
 *   website: url('Invalid URL')
 * }
 * ```
 */
export function url(message = 'Invalid URL'): Validator<string> {
  return (value: string) => {
    if (!value) return null
    try {
      new URL(value)
      return null
    } catch {
      return message
    }
  }
}

/**
 * Minimum length validator
 *
 * @param min - Minimum length
 * @param message - Custom error message
 * @returns Validator function
 *
 * @example
 * ```ts
 * validate: {
 *   password: minLength(8, 'Password must be at least 8 characters')
 * }
 * ```
 */
export function minLength(min: number, message?: string): Validator<string> {
  return (value: string) => {
    if (value && value.length < min) {
      return message || `Must be at least ${min} characters`
    }
    return null
  }
}

/**
 * Maximum length validator
 *
 * @param max - Maximum length
 * @param message - Custom error message
 * @returns Validator function
 *
 * @example
 * ```ts
 * validate: {
 *   bio: maxLength(500, 'Bio must not exceed 500 characters')
 * }
 * ```
 */
export function maxLength(max: number, message?: string): Validator<string> {
  return (value: string) => {
    if (value && value.length > max) {
      return message || `Must not exceed ${max} characters`
    }
    return null
  }
}

/**
 * Pattern validator (regex)
 *
 * @param pattern - Regular expression
 * @param message - Custom error message
 * @returns Validator function
 *
 * @example
 * ```ts
 * validate: {
 *   username: pattern(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores')
 * }
 * ```
 */
export function pattern(pattern: RegExp, message = 'Invalid format'): Validator<string> {
  return (value: string) => {
    if (value && !pattern.test(value)) {
      return message
    }
    return null
  }
}

/**
 * Alphanumeric validator (letters and numbers only)
 *
 * @param message - Custom error message
 * @returns Validator function
 */
export function alphanumeric(message = 'Only letters and numbers allowed'): Validator<string> {
  return pattern(/^[a-zA-Z0-9]*$/, message)
}

/**
 * Alpha validator (letters only)
 *
 * @param message - Custom error message
 * @returns Validator function
 */
export function alpha(message = 'Only letters allowed'): Validator<string> {
  return pattern(/^[a-zA-Z]*$/, message)
}

/**
 * Lowercase validator
 *
 * @param message - Custom error message
 * @returns Validator function
 */
export function lowercase(message = 'Must be lowercase'): Validator<string> {
  return (value: string) => {
    if (value && value !== value.toLowerCase()) {
      return message
    }
    return null
  }
}

/**
 * Uppercase validator
 *
 * @param message - Custom error message
 * @returns Validator function
 */
export function uppercase(message = 'Must be uppercase'): Validator<string> {
  return (value: string) => {
    if (value && value !== value.toUpperCase()) {
      return message
    }
    return null
  }
}

/**
 * Trim validator (no leading/trailing whitespace)
 *
 * @param message - Custom error message
 * @returns Validator function
 */
export function trimmed(message = 'No leading or trailing whitespace allowed'): Validator<string> {
  return (value: string) => {
    if (value && value !== value.trim()) {
      return message
    }
    return null
  }
}

/**
 * Contains validator (must include substring)
 *
 * @param substring - Substring to check for
 * @param message - Custom error message
 * @returns Validator function
 */
export function contains(substring: string, message?: string): Validator<string> {
  return (value: string) => {
    if (value && !value.includes(substring)) {
      return message || `Must contain "${substring}"`
    }
    return null
  }
}

/**
 * Starts with validator
 *
 * @param prefix - Prefix to check for
 * @param message - Custom error message
 * @returns Validator function
 */
export function startsWith(prefix: string, message?: string): Validator<string> {
  return (value: string) => {
    if (value && !value.startsWith(prefix)) {
      return message || `Must start with "${prefix}"`
    }
    return null
  }
}

/**
 * Ends with validator
 *
 * @param suffix - Suffix to check for
 * @param message - Custom error message
 * @returns Validator function
 */
export function endsWith(suffix: string, message?: string): Validator<string> {
  return (value: string) => {
    if (value && !value.endsWith(suffix)) {
      return message || `Must end with "${suffix}"`
    }
    return null
  }
}
