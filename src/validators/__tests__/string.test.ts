/**
 * String validator tests
 */

import { describe, it, expect } from 'vitest'
import {
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
} from '../string.js'

describe('String Validators', () => {
  describe('required', () => {
    it('should return error for empty string', async () => {
      const validator = required()
      expect(await validator('')).toBeTruthy()
    })

    it('should return error for whitespace only', async () => {
      const validator = required()
      expect(await validator('   ')).toBeTruthy()
    })

    it('should return null for valid string', async () => {
      const validator = required()
      expect(await validator('hello')).toBeNull()
    })

    it('should use custom error message', async () => {
      const validator = required('Custom error')
      expect(await validator('')).toBe('Custom error')
    })
  })

  describe('email', () => {
    it('should return null for valid email', async () => {
      const validator = email()
      expect(await validator('test@example.com')).toBeNull()
      expect(await validator('user.name+tag@domain.co.uk')).toBeNull()
    })

    it('should return error for invalid email', async () => {
      const validator = email()
      expect(await validator('invalid')).toBeTruthy()
      expect(await validator('test@')).toBeTruthy()
      expect(await validator('@example.com')).toBeTruthy()
      expect(await validator('test @example.com')).toBeTruthy()
    })

    it('should return null for empty string', async () => {
      const validator = email()
      expect(await validator('')).toBeNull()
    })
  })

  describe('url', () => {
    it('should return null for valid URL', async () => {
      const validator = url()
      expect(await validator('https://example.com')).toBeNull()
      expect(await validator('http://localhost:3000')).toBeNull()
      expect(await validator('https://example.com/path?query=value')).toBeNull()
    })

    it('should return error for invalid URL', async () => {
      const validator = url()
      expect(await validator('not-a-url')).toBeTruthy()
      expect(await validator('example.com')).toBeTruthy()
    })

    it('should return null for empty string', async () => {
      const validator = url()
      expect(await validator('')).toBeNull()
    })
  })

  describe('minLength', () => {
    it('should return error for too short string', async () => {
      const validator = minLength(5)
      expect(await validator('abc')).toBeTruthy()
    })

    it('should return null for valid length', async () => {
      const validator = minLength(5)
      expect(await validator('hello')).toBeNull()
      expect(await validator('hello world')).toBeNull()
    })

    it('should use custom error message', async () => {
      const validator = minLength(5, 'Custom')
      expect(await validator('abc')).toBe('Custom')
    })
  })

  describe('maxLength', () => {
    it('should return error for too long string', async () => {
      const validator = maxLength(5)
      expect(await validator('hello world')).toBeTruthy()
    })

    it('should return null for valid length', async () => {
      const validator = maxLength(5)
      expect(await validator('hello')).toBeNull()
      expect(await validator('hi')).toBeNull()
    })
  })

  describe('pattern', () => {
    it('should return error for non-matching pattern', async () => {
      const validator = pattern(/^[0-9]+$/)
      expect(await validator('abc')).toBeTruthy()
    })

    it('should return null for matching pattern', async () => {
      const validator = pattern(/^[0-9]+$/)
      expect(await validator('123')).toBeNull()
    })
  })

  describe('alphanumeric', () => {
    it('should return null for alphanumeric string', async () => {
      const validator = alphanumeric()
      expect(await validator('abc123')).toBeNull()
      expect(await validator('ABC')).toBeNull()
      expect(await validator('123')).toBeNull()
    })

    it('should return error for non-alphanumeric', async () => {
      const validator = alphanumeric()
      expect(await validator('abc-123')).toBeTruthy()
      expect(await validator('hello world')).toBeTruthy()
    })
  })

  describe('alpha', () => {
    it('should return null for letters only', async () => {
      const validator = alpha()
      expect(await validator('abc')).toBeNull()
      expect(await validator('ABC')).toBeNull()
    })

    it('should return error for non-letters', async () => {
      const validator = alpha()
      expect(await validator('abc123')).toBeTruthy()
      expect(await validator('hello world')).toBeTruthy()
    })
  })

  describe('lowercase', () => {
    it('should return null for lowercase string', async () => {
      const validator = lowercase()
      expect(await validator('hello')).toBeNull()
    })

    it('should return error for uppercase', async () => {
      const validator = lowercase()
      expect(await validator('Hello')).toBeTruthy()
      expect(await validator('HELLO')).toBeTruthy()
    })
  })

  describe('uppercase', () => {
    it('should return null for uppercase string', async () => {
      const validator = uppercase()
      expect(await validator('HELLO')).toBeNull()
    })

    it('should return error for lowercase', async () => {
      const validator = uppercase()
      expect(await validator('Hello')).toBeTruthy()
      expect(await validator('hello')).toBeTruthy()
    })
  })

  describe('trimmed', () => {
    it('should return null for trimmed string', async () => {
      const validator = trimmed()
      expect(await validator('hello')).toBeNull()
    })

    it('should return error for untrimmed string', async () => {
      const validator = trimmed()
      expect(await validator(' hello')).toBeTruthy()
      expect(await validator('hello ')).toBeTruthy()
      expect(await validator(' hello ')).toBeTruthy()
    })
  })

  describe('contains', () => {
    it('should return null when substring is present', async () => {
      const validator = contains('test')
      expect(await validator('this is a test')).toBeNull()
    })

    it('should return error when substring is missing', async () => {
      const validator = contains('test')
      expect(await validator('hello world')).toBeTruthy()
    })
  })

  describe('startsWith', () => {
    it('should return null when string starts with prefix', async () => {
      const validator = startsWith('hello')
      expect(await validator('hello world')).toBeNull()
    })

    it('should return error when string does not start with prefix', async () => {
      const validator = startsWith('hello')
      expect(await validator('world hello')).toBeTruthy()
    })
  })

  describe('endsWith', () => {
    it('should return null when string ends with suffix', async () => {
      const validator = endsWith('world')
      expect(await validator('hello world')).toBeNull()
    })

    it('should return error when string does not end with suffix', async () => {
      const validator = endsWith('world')
      expect(await validator('world hello')).toBeTruthy()
    })
  })
})
