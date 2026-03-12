/**
 * Number validators - Tree-shakeable validation functions
 *
 * Import only what you need:
 * import { min, max, integer, positive } from '@lpm.dev/neo.react-forms/validators'
 */

import type { Validator } from '../types.js'

/**
 * Minimum value validator
 *
 * @param minValue - Minimum allowed value
 * @param message - Custom error message
 * @returns Validator function
 *
 * @example
 * ```ts
 * validate: {
 *   age: min(18, 'Must be at least 18')
 * }
 * ```
 */
export function min(minValue: number, message?: string): Validator<number> {
  return (value: number) => {
    if (value < minValue) {
      return message || `Must be at least ${minValue}`
    }
    return null
  }
}

/**
 * Maximum value validator
 *
 * @param maxValue - Maximum allowed value
 * @param message - Custom error message
 * @returns Validator function
 *
 * @example
 * ```ts
 * validate: {
 *   age: max(120, 'Must be at most 120')
 * }
 * ```
 */
export function max(maxValue: number, message?: string): Validator<number> {
  return (value: number) => {
    if (value > maxValue) {
      return message || `Must be at most ${maxValue}`
    }
    return null
  }
}

/**
 * Range validator (between min and max)
 *
 * @param minValue - Minimum value
 * @param maxValue - Maximum value
 * @param message - Custom error message
 * @returns Validator function
 *
 * @example
 * ```ts
 * validate: {
 *   score: between(0, 100, 'Score must be between 0 and 100')
 * }
 * ```
 */
export function between(minValue: number, maxValue: number, message?: string): Validator<number> {
  return (value: number) => {
    if (value < minValue || value > maxValue) {
      return message || `Must be between ${minValue} and ${maxValue}`
    }
    return null
  }
}

/**
 * Integer validator
 *
 * @param message - Custom error message
 * @returns Validator function
 *
 * @example
 * ```ts
 * validate: {
 *   quantity: integer('Must be a whole number')
 * }
 * ```
 */
export function integer(message = 'Must be a whole number'): Validator<number> {
  return (value: number) => {
    if (!Number.isInteger(value)) {
      return message
    }
    return null
  }
}

/**
 * Positive number validator (> 0)
 *
 * @param message - Custom error message
 * @returns Validator function
 *
 * @example
 * ```ts
 * validate: {
 *   price: positive('Price must be positive')
 * }
 * ```
 */
export function positive(message = 'Must be positive'): Validator<number> {
  return (value: number) => {
    if (value <= 0) {
      return message
    }
    return null
  }
}

/**
 * Negative number validator (< 0)
 *
 * @param message - Custom error message
 * @returns Validator function
 */
export function negative(message = 'Must be negative'): Validator<number> {
  return (value: number) => {
    if (value >= 0) {
      return message
    }
    return null
  }
}

/**
 * Non-negative validator (>= 0)
 *
 * @param message - Custom error message
 * @returns Validator function
 */
export function nonNegative(message = 'Must be non-negative'): Validator<number> {
  return (value: number) => {
    if (value < 0) {
      return message
    }
    return null
  }
}

/**
 * Non-positive validator (<= 0)
 *
 * @param message - Custom error message
 * @returns Validator function
 */
export function nonPositive(message = 'Must be non-positive'): Validator<number> {
  return (value: number) => {
    if (value > 0) {
      return message
    }
    return null
  }
}

/**
 * Safe integer validator (within Number.MIN_SAFE_INTEGER and Number.MAX_SAFE_INTEGER)
 *
 * @param message - Custom error message
 * @returns Validator function
 */
export function safeInteger(message = 'Must be a safe integer'): Validator<number> {
  return (value: number) => {
    if (!Number.isSafeInteger(value)) {
      return message
    }
    return null
  }
}

/**
 * Finite number validator (not Infinity or NaN)
 *
 * @param message - Custom error message
 * @returns Validator function
 */
export function finite(message = 'Must be a finite number'): Validator<number> {
  return (value: number) => {
    if (!Number.isFinite(value)) {
      return message
    }
    return null
  }
}

/**
 * Multiple of validator (divisible by)
 *
 * @param divisor - The number to divide by
 * @param message - Custom error message
 * @returns Validator function
 *
 * @example
 * ```ts
 * validate: {
 *   quantity: multipleOf(5, 'Must be a multiple of 5')
 * }
 * ```
 */
export function multipleOf(divisor: number, message?: string): Validator<number> {
  return (value: number) => {
    if (value % divisor !== 0) {
      return message || `Must be a multiple of ${divisor}`
    }
    return null
  }
}

/**
 * Even number validator
 *
 * @param message - Custom error message
 * @returns Validator function
 */
export function even(message = 'Must be an even number'): Validator<number> {
  return multipleOf(2, message)
}

/**
 * Odd number validator
 *
 * @param message - Custom error message
 * @returns Validator function
 */
export function odd(message = 'Must be an odd number'): Validator<number> {
  return (value: number) => {
    if (value % 2 === 0) {
      return message
    }
    return null
  }
}
