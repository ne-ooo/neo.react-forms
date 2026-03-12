/**
 * Error messages tests
 */

import { describe, it, expect } from 'vitest'
import {
  enhanceErrorMessage,
  formatError,
  ErrorMessages,
  createValidationError,
} from '../error-messages.js'

describe('enhanceErrorMessage', () => {
  it('should enhance email error with suggestion', () => {
    const result = enhanceErrorMessage('Invalid email address')

    expect(result.message).toBe('Invalid email address')
    expect(result.suggestion).toBe('Use format: name@example.com')
    expect(result.code).toBe('INVALID_EMAIL')
  })

  it('should enhance password error with suggestion', () => {
    const result = enhanceErrorMessage('Password must be at least 8 characters')

    expect(result.message).toBe('Password must be at least 8 characters')
    expect(result.suggestion).toBe('Use at least 8 characters with a mix of letters and numbers')
    expect(result.code).toBe('PASSWORD_TOO_SHORT')
  })

  it('should enhance URL error with suggestion', () => {
    const result = enhanceErrorMessage('Invalid URL')

    expect(result.message).toBe('Invalid URL')
    expect(result.suggestion).toBe('Use format: https://example.com')
    expect(result.code).toBe('INVALID_URL')
  })

  it('should enhance required field error', () => {
    const result = enhanceErrorMessage('This field is required')

    expect(result.message).toBe('This field is required')
    expect(result.suggestion).toBe('This field is required')
    expect(result.code).toBe('FIELD_REQUIRED')
  })

  it('should return original message if no pattern matches', () => {
    const result = enhanceErrorMessage('Some custom error message')

    expect(result.message).toBe('Some custom error message')
    expect(result.suggestion).toBeUndefined()
    expect(result.code).toBeUndefined()
  })
})

describe('formatError', () => {
  it('should format error message only', () => {
    const result = formatError('Invalid email', 'message')

    expect(result).toBe('Invalid email')
  })

  it('should format suggestion only', () => {
    const result = formatError('Invalid email', 'suggestion')

    expect(result).toBe('Use format: name@example.com')
  })

  it('should format full error with suggestion', () => {
    const result = formatError('Invalid email', 'full')

    expect(result).toBe('Invalid email. Suggestion: Use format: name@example.com')
  })

  it('should handle enhanced error object', () => {
    const enhanced = createValidationError('Test error', 'Test suggestion')
    const result = formatError(enhanced, 'full')

    expect(result).toBe('Test error. Suggestion: Test suggestion')
  })
})

describe('ErrorMessages', () => {
  it('should provide required field message', () => {
    expect(ErrorMessages.required()).toBe('This field is required')
    expect(ErrorMessages.required('Email')).toBe('Email is required')
  })

  it('should provide email messages', () => {
    expect(ErrorMessages.email).toBe('Please enter a valid email address')
    expect(ErrorMessages.emailRequired).toBe('Email address is required')
  })

  it('should provide password messages with parameters', () => {
    expect(ErrorMessages.passwordTooShort(8)).toBe('Password must be at least 8 characters')
    expect(ErrorMessages.passwordsMatch).toBe('Passwords must match')
  })

  it('should provide number range messages', () => {
    expect(ErrorMessages.minNumber(18)).toBe('Must be at least 18')
    expect(ErrorMessages.maxNumber(100)).toBe('Must be at most 100')
    expect(ErrorMessages.numberBetween(18, 65)).toBe('Must be between 18 and 65')
  })

  it('should provide length messages', () => {
    expect(ErrorMessages.minLength(3)).toBe('Must be at least 3 characters')
    expect(ErrorMessages.maxLength(50)).toBe('Must be at most 50 characters')
  })
})

describe('createValidationError', () => {
  it('should create enhanced error with all fields', () => {
    const error = createValidationError(
      'Invalid input',
      'Please check your input',
      'INVALID_INPUT'
    )

    expect(error.message).toBe('Invalid input')
    expect(error.suggestion).toBe('Please check your input')
    expect(error.code).toBe('INVALID_INPUT')
  })

  it('should create error without suggestion', () => {
    const error = createValidationError('Invalid input')

    expect(error.message).toBe('Invalid input')
    expect(error.suggestion).toBeUndefined()
    expect(error.code).toBeUndefined()
  })
})
