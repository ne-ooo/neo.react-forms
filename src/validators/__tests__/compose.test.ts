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
import type { ValidationContext, Validator } from '../../types.js'

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

    it('forwards validation context to each validator', async () => {
      const context: ValidationContext = {
        name: 'email',
        signal: new AbortController().signal,
        values: undefined,
      }
      const contexts: Array<ValidationContext | undefined> = []
      const validators: Validator<string>[] = [
        (_value, _values, receivedContext) => {
          contexts.push(receivedContext)
          return null
        },
        (_value, _values, receivedContext) => {
          contexts.push(receivedContext)
          return 'Stopped'
        },
      ]

      expect(await compose(validators)('value', undefined, context)).toBe('Stopped')
      expect(contexts).toEqual([context, context])
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

    it('forwards validation context for non-empty values', async () => {
      const context: ValidationContext = {
        name: 'username',
        signal: new AbortController().signal,
        values: undefined,
      }
      const receivedContexts: Array<ValidationContext | undefined> = []
      const validator = optional<string>((_value, _values, receivedContext) => {
        receivedContexts.push(receivedContext)
        return null
      })

      await validator('neo', undefined, context)

      expect(receivedContexts).toEqual([context])
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

    it('supports async conditions and forwards validation context', async () => {
      const context: ValidationContext = {
        name: 'promoCode',
        signal: new AbortController().signal,
        values: undefined,
      }
      const conditionContexts: Array<ValidationContext | undefined> = []
      const validatorContexts: Array<ValidationContext | undefined> = []
      const validator = when<string>(
        async (_value, _values, receivedContext) => {
          conditionContexts.push(receivedContext)
          return true
        },
        (_value, _values, receivedContext) => {
          validatorContexts.push(receivedContext)
          return null
        }
      )

      await validator('SAVE10', undefined, context)

      expect(conditionContexts).toEqual([context])
      expect(validatorContexts).toEqual([context])
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

    it('preserves the validation context', async () => {
      const context: ValidationContext = {
        name: 'password',
        signal: new AbortController().signal,
        values: undefined,
      }
      let receivedContext: ValidationContext | undefined
      const validator = custom<string>((_value, _values, currentContext) => {
        receivedContext = currentContext
        return undefined
      })

      await validator('secret', undefined, context)

      expect(receivedContext).toBe(context)
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

    it('forwards the validation context to the test function', async () => {
      const context: ValidationContext = {
        name: 'age',
        signal: new AbortController().signal,
        values: undefined,
      }
      let receivedContext: ValidationContext | undefined
      const validator = test<number>(
        (_value, _values, currentContext) => {
          receivedContext = currentContext
          return true
        },
        'Invalid'
      )

      await validator(21, undefined, context)

      expect(receivedContext).toBe(context)
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
