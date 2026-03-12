/**
 * Validator composition tests
 */

import { describe, it, expect } from 'vitest'
import {
  compose,
  optional,
  when,
  custom,
  test,
  oneOf,
  notOneOf,
  equals,
  notEquals,
} from '../compose.js'
import { required, minLength } from '../string.js'
import { min, max } from '../number.js'

describe('Validator Composition', () => {
  describe('compose', () => {
    it('should run all validators and return first error', async () => {
      const validator = compose([
        required('Required'),
        minLength(5, 'Too short'),
      ])

      expect(await validator('')).toBe('Required')
      expect(await validator('abc')).toBe('Too short')
      expect(await validator('hello')).toBeNull()
    })

    it('should work with number validators', async () => {
      const validator = compose([
        min(0, 'Must be positive'),
        max(100, 'Must be at most 100'),
      ])

      expect(await validator(-1)).toBe('Must be positive')
      expect(await validator(101)).toBe('Must be at most 100')
      expect(await validator(50)).toBeNull()
    })
  })

  describe('optional', () => {
    it('should skip validation for empty values', async () => {
      const validator = optional(minLength(5, 'Too short'))

      expect(await validator('')).toBeNull()
      expect(await validator(null)).toBeNull()
      expect(await validator(undefined)).toBeNull()
    })

    it('should validate non-empty values', async () => {
      const validator = optional(minLength(5, 'Too short'))

      expect(await validator('abc')).toBe('Too short')
      expect(await validator('hello')).toBeNull()
    })
  })

  describe('when', () => {
    it('should only validate when condition is true', async () => {
      const validator = when(
        (value: string) => value.startsWith('test'),
        minLength(10, 'Too short')
      )

      expect(await validator('test')).toBe('Too short')
      expect(await validator('test-long-enough')).toBeNull()
      expect(await validator('hello')).toBeNull() // condition false
    })

    it('should support values parameter', async () => {
      interface Values {
        usePromo: boolean
        promoCode: string
      }

      const validator = when<string, Values>(
        (_, values) => values?.usePromo === true,
        required('Promo code required')
      )

      expect(await validator('', { usePromo: true, promoCode: '' })).toBeTruthy()
      expect(await validator('', { usePromo: false, promoCode: '' })).toBeNull()
    })
  })

  describe('custom', () => {
    it('should create custom validator', async () => {
      const passwordStrength = custom<string>((value) => {
        if (!/[A-Z]/.test(value)) return 'Must contain uppercase'
        if (!/[a-z]/.test(value)) return 'Must contain lowercase'
        if (!/[0-9]/.test(value)) return 'Must contain number'
        return null
      })

      expect(await passwordStrength('hello')).toBe('Must contain uppercase')
      expect(await passwordStrength('HELLO')).toBe('Must contain lowercase')
      expect(await passwordStrength('Hello')).toBe('Must contain number')
      expect(await passwordStrength('Hello1')).toBeNull()
    })

    it('should support async validators', async () => {
      const asyncValidator = custom<string>(async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return value === 'invalid' ? 'Invalid value' : null
      })

      expect(await asyncValidator('invalid')).toBe('Invalid value')
      expect(await asyncValidator('valid')).toBeNull()
    })
  })

  describe('test', () => {
    it('should create validator from test function', async () => {
      const validator = test(
        (age: number) => age >= 18,
        'Must be 18 or older'
      )

      expect(await validator(17)).toBe('Must be 18 or older')
      expect(await validator(18)).toBeNull()
      expect(await validator(25)).toBeNull()
    })

    it('should support async test function', async () => {
      const validator = test(
        async (value: string) => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          return value.length > 5
        },
        'Too short'
      )

      expect(await validator('abc')).toBe('Too short')
      expect(await validator('hello world')).toBeNull()
    })
  })

  describe('oneOf', () => {
    it('should return null for allowed values', async () => {
      const validator = oneOf(['admin', 'user', 'guest'])

      expect(await validator('admin')).toBeNull()
      expect(await validator('user')).toBeNull()
      expect(await validator('guest')).toBeNull()
    })

    it('should return error for disallowed values', async () => {
      const validator = oneOf(['admin', 'user', 'guest'])

      expect(await validator('superadmin')).toBeTruthy()
    })

    it('should use custom error message', async () => {
      const validator = oneOf(['admin', 'user'], 'Custom error')

      expect(await validator('guest')).toBe('Custom error')
    })
  })

  describe('notOneOf', () => {
    it('should return error for disallowed values', async () => {
      const validator = notOneOf(['admin', 'root'])

      expect(await validator('admin')).toBeTruthy()
      expect(await validator('root')).toBeTruthy()
    })

    it('should return null for allowed values', async () => {
      const validator = notOneOf(['admin', 'root'])

      expect(await validator('user')).toBeNull()
      expect(await validator('guest')).toBeNull()
    })
  })

  describe('equals', () => {
    it('should return null for matching values', async () => {
      const validator = equals('password123')

      expect(await validator('password123')).toBeNull()
    })

    it('should return error for non-matching values', async () => {
      const validator = equals('password123')

      expect(await validator('wrong')).toBeTruthy()
    })

    it('should work with numbers', async () => {
      const validator = equals(42)

      expect(await validator(42)).toBeNull()
      expect(await validator(43)).toBeTruthy()
    })
  })

  describe('notEquals', () => {
    it('should return error for matching values', async () => {
      const validator = notEquals('admin')

      expect(await validator('admin')).toBeTruthy()
    })

    it('should return null for non-matching values', async () => {
      const validator = notEquals('admin')

      expect(await validator('user')).toBeNull()
    })
  })
})
