/**
 * Zod adapter tests
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { zodAdapter, zodForm } from '../zod.js'

describe('zodAdapter', () => {
  describe('basic validation', () => {
    it('should validate string fields', async () => {
      const schema = z.object({
        name: z.string().min(1, 'Name is required'),
      })

      const validation = zodAdapter(schema)
      const validator = validation.name as any

      // Valid value
      const validResult = await validator('John')
      expect(validResult).toBeNull()

      // Invalid value
      const invalidResult = await validator('')
      expect(invalidResult).toBe('Name is required')
    })

    it('should validate number fields', async () => {
      const schema = z.object({
        age: z.number().min(18, 'Must be 18+'),
      })

      const validation = zodAdapter(schema)
      const validator = validation.age as any

      // Valid value
      const validResult = await validator(25)
      expect(validResult).toBeNull()

      // Invalid value
      const invalidResult = await validator(15)
      expect(invalidResult).toBe('Must be 18+')
    })

    it('should validate email fields', async () => {
      const schema = z.object({
        email: z.string().email('Invalid email address'),
      })

      const validation = zodAdapter(schema)
      const validator = validation.email as any

      // Valid email
      const validResult = await validator('test@example.com')
      expect(validResult).toBeNull()

      // Invalid email
      const invalidResult = await validator('not-an-email')
      expect(invalidResult).toBe('Invalid email address')
    })

    it('should validate URL fields', async () => {
      const schema = z.object({
        website: z.string().url('Invalid URL'),
      })

      const validation = zodAdapter(schema)
      const validator = validation.website as any

      // Valid URL
      const validResult = await validator('https://example.com')
      expect(validResult).toBeNull()

      // Invalid URL
      const invalidResult = await validator('not-a-url')
      expect(invalidResult).toBe('Invalid URL')
    })
  })

  describe('nested validation', () => {
    it('should validate nested object fields', async () => {
      const schema = z.object({
        profile: z.object({
          firstName: z.string().min(1, 'First name required'),
          lastName: z.string().min(1, 'Last name required'),
        }),
      })

      const validation = zodAdapter(schema)
      const nestedValidation = validation.profile as any

      // Valid nested value
      const firstNameValidator = nestedValidation.firstName
      const validResult = await firstNameValidator('John')
      expect(validResult).toBeNull()

      // Invalid nested value
      const invalidResult = await firstNameValidator('')
      expect(invalidResult).toBe('First name required')
    })

    it('should validate deeply nested objects', async () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            email: z.string().email('Invalid email'),
          }),
        }),
      })

      const validation = zodAdapter(schema)
      const userValidation = validation.user as any
      const profileValidation = userValidation.profile as any
      const emailValidator = profileValidation.email

      // Valid email
      const validResult = await emailValidator('test@example.com')
      expect(validResult).toBeNull()

      // Invalid email
      const invalidResult = await emailValidator('invalid')
      expect(invalidResult).toBe('Invalid email')
    })
  })

  describe('complex validation', () => {
    it('should validate min/max lengths', async () => {
      const schema = z.object({
        username: z.string().min(3, 'Too short').max(20, 'Too long'),
      })

      const validation = zodAdapter(schema)
      const validator = validation.username as any

      // Valid
      const validResult = await validator('john')
      expect(validResult).toBeNull()

      // Too short
      const shortResult = await validator('ab')
      expect(shortResult).toBe('Too short')

      // Too long
      const longResult = await validator('a'.repeat(21))
      expect(longResult).toBe('Too long')
    })

    it('should validate number ranges', async () => {
      const schema = z.object({
        age: z.number().min(0, 'Negative age').max(120, 'Too old'),
      })

      const validation = zodAdapter(schema)
      const validator = validation.age as any

      // Valid
      const validResult = await validator(25)
      expect(validResult).toBeNull()

      // Negative
      const negativeResult = await validator(-1)
      expect(negativeResult).toBe('Negative age')

      // Too old
      const oldResult = await validator(150)
      expect(oldResult).toBe('Too old')
    })

    it('should validate with regex patterns', async () => {
      const schema = z.object({
        phone: z.string().regex(/^\d{3}-\d{3}-\d{4}$/, 'Invalid phone format'),
      })

      const validation = zodAdapter(schema)
      const validator = validation.phone as any

      // Valid
      const validResult = await validator('123-456-7890')
      expect(validResult).toBeNull()

      // Invalid
      const invalidResult = await validator('1234567890')
      expect(invalidResult).toBe('Invalid phone format')
    })
  })

  describe('comprehensive schema', () => {
    it('should validate complete signup form', async () => {
      const schema = z.object({
        email: z.string().email('Invalid email'),
        password: z.string().min(8, 'Password too short'),
        age: z.number().min(18, 'Must be 18+'),
        website: z.string().url('Invalid URL').optional(),
        profile: z.object({
          firstName: z.string().min(1, 'Required'),
          lastName: z.string().min(1, 'Required'),
        }),
      })

      const validation = zodAdapter(schema)

      // Validate email
      const emailValidator = validation.email as any
      expect(await emailValidator('test@example.com')).toBeNull()
      expect(await emailValidator('invalid')).toBe('Invalid email')

      // Validate password
      const passwordValidator = validation.password as any
      expect(await passwordValidator('password123')).toBeNull()
      expect(await passwordValidator('short')).toBe('Password too short')

      // Validate age
      const ageValidator = validation.age as any
      expect(await ageValidator(25)).toBeNull()
      expect(await ageValidator(15)).toBe('Must be 18+')

      // Validate nested profile
      const profileValidation = validation.profile as any
      const firstNameValidator = profileValidation.firstName
      expect(await firstNameValidator('John')).toBeNull()
      expect(await firstNameValidator('')).toBe('Required')
    })
  })
})

describe('zodForm', () => {
  it('should create form config with validation', () => {
    const schema = z.object({
      email: z.string().email(),
      age: z.number().min(18),
    })

    const config = zodForm(schema, {
      email: '',
      age: 0,
    })

    expect(config.initialValues).toEqual({
      email: '',
      age: 0,
    })

    expect(config.validate).toBeDefined()
    expect(config.validate.email).toBeDefined()
    expect(config.validate.age).toBeDefined()
  })

  it('should work with nested objects', () => {
    const schema = z.object({
      user: z.object({
        email: z.string().email(),
        profile: z.object({
          name: z.string().min(1),
        }),
      }),
    })

    const config = zodForm(schema, {
      user: {
        email: '',
        profile: {
          name: '',
        },
      },
    })

    expect(config.initialValues.user.email).toBe('')
    expect(config.initialValues.user.profile.name).toBe('')
    expect(config.validate.user).toBeDefined()
  })
})
