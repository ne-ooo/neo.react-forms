/**
 * Validator composition utilities
 *
 * Combine multiple validators together
 */

import type { Validator } from '../types.js'

/**
 * Compose multiple validators (runs all, returns first error)
 *
 * @param validators - Array of validators to compose
 * @returns Combined validator function
 *
 * @example
 * ```ts
 * validate: {
 *   email: compose([
 *     required('Email is required'),
 *     email('Invalid email')
 *   ])
 * }
 * ```
 */
export function compose<T, Values = unknown>(validators: Validator<T, Values>[]): Validator<T, Values> {
  return async (value: T, values?: Values) => {
    for (const validator of validators) {
      const error = await validator(value, values)
      if (error) {
        return error
      }
    }
    return null
  }
}

/**
 * Optional validator (only validates if value exists)
 *
 * @param validator - Validator to make optional
 * @returns Optional validator
 *
 * @example
 * ```ts
 * validate: {
 *   website: optional(url('Invalid URL'))
 * }
 * ```
 */
export function optional<T, Values = unknown>(validator: Validator<T, Values>): Validator<T | null | undefined, Values> {
  return async (value: T | null | undefined, values?: Values) => {
    if (value === null || value === undefined || value === '') {
      return null
    }
    return validator(value as T, values)
  }
}

/**
 * Conditional validator (only validates if condition is true)
 *
 * @param condition - Function that returns true if validation should run
 * @param validator - Validator to run conditionally
 * @returns Conditional validator
 *
 * @example
 * ```ts
 * validate: {
 *   promoCode: when(
 *     (value, values) => values.usePromo,
 *     required('Promo code required when checkbox is checked')
 *   )
 * }
 * ```
 */
export function when<T, Values = unknown>(
  condition: (value: T, values?: Values) => boolean,
  validator: Validator<T, Values>
): Validator<T, Values> {
  return async (value: T, values?: Values) => {
    if (condition(value, values)) {
      return validator(value, values)
    }
    return null
  }
}

/**
 * Create custom validator
 *
 * @param validate - Validation function
 * @returns Validator function
 *
 * @example
 * ```ts
 * const passwordStrength = custom<string>((value) => {
 *   if (!/[A-Z]/.test(value)) return 'Must contain uppercase'
 *   if (!/[a-z]/.test(value)) return 'Must contain lowercase'
 *   if (!/[0-9]/.test(value)) return 'Must contain number'
 *   return null
 * })
 * ```
 */
export function custom<T, Values = unknown>(
  validate: (value: T, values?: Values) => string | null | Promise<string | null>
): Validator<T, Values> {
  return validate
}

/**
 * Test validator (custom test function)
 *
 * @param test - Test function (returns true if valid)
 * @param message - Error message
 * @returns Validator function
 *
 * @example
 * ```ts
 * validate: {
 *   age: test((age) => age >= 18, 'Must be 18 or older')
 * }
 * ```
 */
export function test<T, Values = unknown>(
  test: (value: T, values?: Values) => boolean | Promise<boolean>,
  message: string
): Validator<T, Values> {
  return async (value: T, values?: Values) => {
    const result = await test(value, values)
    return result ? null : message
  }
}

/**
 * One of validator (value must be in list)
 *
 * @param values - Allowed values
 * @param message - Custom error message
 * @returns Validator function
 *
 * @example
 * ```ts
 * validate: {
 *   role: oneOf(['admin', 'user', 'guest'], 'Invalid role')
 * }
 * ```
 */
export function oneOf<T, Values = unknown>(values: T[], message?: string): Validator<T, Values> {
  return (value: T) => {
    if (!values.includes(value)) {
      return message || `Must be one of: ${values.join(', ')}`
    }
    return null
  }
}

/**
 * Not one of validator (value must NOT be in list)
 *
 * @param values - Disallowed values
 * @param message - Custom error message
 * @returns Validator function
 */
export function notOneOf<T, Values = unknown>(values: T[], message?: string): Validator<T, Values> {
  return (value: T) => {
    if (values.includes(value)) {
      return message || `Must not be one of: ${values.join(', ')}`
    }
    return null
  }
}

/**
 * Equals validator (value must equal expected)
 *
 * @param expected - Expected value
 * @param message - Custom error message
 * @returns Validator function
 *
 * @example
 * ```ts
 * validate: {
 *   confirmPassword: equals(values.password, 'Passwords must match')
 * }
 * ```
 */
export function equals<T, Values = unknown>(expected: T, message = 'Values must match'): Validator<T, Values> {
  return (value: T) => {
    if (value !== expected) {
      return message
    }
    return null
  }
}

/**
 * Not equals validator (value must NOT equal expected)
 *
 * @param notExpected - Value to avoid
 * @param message - Custom error message
 * @returns Validator function
 */
export function notEquals<T, Values = unknown>(notExpected: T, message = 'Values must not match'): Validator<T, Values> {
  return (value: T) => {
    if (value === notExpected) {
      return message
    }
    return null
  }
}
