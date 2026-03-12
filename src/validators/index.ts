/**
 * Tree-shakeable validators
 *
 * Import only what you need:
 * ```ts
 * import { required, email, min, max } from '@lpm.dev/neo.react-forms/validators'
 * ```
 *
 * Or import from specific categories:
 * ```ts
 * import { required, email } from '@lpm.dev/neo.react-forms/validators/string'
 * import { min, max } from '@lpm.dev/neo.react-forms/validators/number'
 * ```
 */

// String validators
export {
  required,
  email,
  url,
  minLength,
  maxLength,
  pattern,
  alphanumeric,
  alpha,
  lowercase,
  uppercase,
  trimmed,
  contains,
  startsWith,
  endsWith,
} from './string.js'

// Number validators
export {
  min,
  max,
  between,
  integer,
  positive,
  negative,
  nonNegative,
  nonPositive,
  safeInteger,
  finite,
  multipleOf,
  even,
  odd,
} from './number.js'

// Composition utilities
export {
  compose,
  optional,
  when,
  custom,
  test,
  oneOf,
  notOneOf,
  equals,
  notEquals,
} from './compose.js'

// Async validation utilities
export { debounce, debounceValidator } from '../utils/debounce.js'
