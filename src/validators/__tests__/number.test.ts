/**
 * Number validator tests
 */

import { describe, it, expect } from 'vitest'
import {
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
} from '../number.js'

describe('Number Validators', () => {
  describe('min', () => {
    it('should return error for value below minimum', async () => {
      const validator = min(10)
      expect(await validator(5)).toBeTruthy()
    })

    it('should return null for value at or above minimum', async () => {
      const validator = min(10)
      expect(await validator(10)).toBeNull()
      expect(await validator(15)).toBeNull()
    })

    it('should use custom error message', async () => {
      const validator = min(10, 'Custom')
      expect(await validator(5)).toBe('Custom')
    })
  })

  describe('max', () => {
    it('should return error for value above maximum', async () => {
      const validator = max(10)
      expect(await validator(15)).toBeTruthy()
    })

    it('should return null for value at or below maximum', async () => {
      const validator = max(10)
      expect(await validator(10)).toBeNull()
      expect(await validator(5)).toBeNull()
    })
  })

  describe('between', () => {
    it('should return error for value outside range', async () => {
      const validator = between(10, 20)
      expect(await validator(5)).toBeTruthy()
      expect(await validator(25)).toBeTruthy()
    })

    it('should return null for value within range', async () => {
      const validator = between(10, 20)
      expect(await validator(10)).toBeNull()
      expect(await validator(15)).toBeNull()
      expect(await validator(20)).toBeNull()
    })
  })

  describe('integer', () => {
    it('should return null for integers', async () => {
      const validator = integer()
      expect(await validator(0)).toBeNull()
      expect(await validator(42)).toBeNull()
      expect(await validator(-10)).toBeNull()
    })

    it('should return error for non-integers', async () => {
      const validator = integer()
      expect(await validator(3.14)).toBeTruthy()
      expect(await validator(0.1)).toBeTruthy()
    })
  })

  describe('positive', () => {
    it('should return null for positive numbers', async () => {
      const validator = positive()
      expect(await validator(1)).toBeNull()
      expect(await validator(0.1)).toBeNull()
      expect(await validator(100)).toBeNull()
    })

    it('should return error for zero and negative', async () => {
      const validator = positive()
      expect(await validator(0)).toBeTruthy()
      expect(await validator(-1)).toBeTruthy()
    })
  })

  describe('negative', () => {
    it('should return null for negative numbers', async () => {
      const validator = negative()
      expect(await validator(-1)).toBeNull()
      expect(await validator(-0.1)).toBeNull()
      expect(await validator(-100)).toBeNull()
    })

    it('should return error for zero and positive', async () => {
      const validator = negative()
      expect(await validator(0)).toBeTruthy()
      expect(await validator(1)).toBeTruthy()
    })
  })

  describe('nonNegative', () => {
    it('should return null for non-negative numbers', async () => {
      const validator = nonNegative()
      expect(await validator(0)).toBeNull()
      expect(await validator(1)).toBeNull()
      expect(await validator(100)).toBeNull()
    })

    it('should return error for negative numbers', async () => {
      const validator = nonNegative()
      expect(await validator(-1)).toBeTruthy()
    })
  })

  describe('nonPositive', () => {
    it('should return null for non-positive numbers', async () => {
      const validator = nonPositive()
      expect(await validator(0)).toBeNull()
      expect(await validator(-1)).toBeNull()
      expect(await validator(-100)).toBeNull()
    })

    it('should return error for positive numbers', async () => {
      const validator = nonPositive()
      expect(await validator(1)).toBeTruthy()
    })
  })

  describe('safeInteger', () => {
    it('should return null for safe integers', async () => {
      const validator = safeInteger()
      expect(await validator(0)).toBeNull()
      expect(await validator(42)).toBeNull()
      expect(await validator(Number.MAX_SAFE_INTEGER)).toBeNull()
      expect(await validator(Number.MIN_SAFE_INTEGER)).toBeNull()
    })

    it('should return error for unsafe integers', async () => {
      const validator = safeInteger()
      expect(await validator(Number.MAX_SAFE_INTEGER + 1)).toBeTruthy()
      expect(await validator(3.14)).toBeTruthy()
    })
  })

  describe('finite', () => {
    it('should return null for finite numbers', async () => {
      const validator = finite()
      expect(await validator(0)).toBeNull()
      expect(await validator(42)).toBeNull()
      expect(await validator(3.14)).toBeNull()
    })

    it('should return error for Infinity and NaN', async () => {
      const validator = finite()
      expect(await validator(Infinity)).toBeTruthy()
      expect(await validator(-Infinity)).toBeTruthy()
      expect(await validator(NaN)).toBeTruthy()
    })
  })

  describe('multipleOf', () => {
    it('should return null for multiples', async () => {
      const validator = multipleOf(5)
      expect(await validator(0)).toBeNull()
      expect(await validator(5)).toBeNull()
      expect(await validator(10)).toBeNull()
      expect(await validator(-5)).toBeNull()
    })

    it('should return error for non-multiples', async () => {
      const validator = multipleOf(5)
      expect(await validator(3)).toBeTruthy()
      expect(await validator(7)).toBeTruthy()
    })
  })

  describe('even', () => {
    it('should return null for even numbers', async () => {
      const validator = even()
      expect(await validator(0)).toBeNull()
      expect(await validator(2)).toBeNull()
      expect(await validator(-4)).toBeNull()
    })

    it('should return error for odd numbers', async () => {
      const validator = even()
      expect(await validator(1)).toBeTruthy()
      expect(await validator(3)).toBeTruthy()
    })
  })

  describe('odd', () => {
    it('should return null for odd numbers', async () => {
      const validator = odd()
      expect(await validator(1)).toBeNull()
      expect(await validator(3)).toBeNull()
      expect(await validator(-5)).toBeNull()
    })

    it('should return error for even numbers', async () => {
      const validator = odd()
      expect(await validator(0)).toBeTruthy()
      expect(await validator(2)).toBeTruthy()
    })
  })
})
