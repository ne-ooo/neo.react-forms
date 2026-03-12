/**
 * Zod adapter integration tests with useForm
 */

import { describe, it, expect } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { z } from 'zod'
import { useForm } from '../../hooks/useForm.js'
import { zodAdapter, zodForm } from '../zod.js'

describe('Zod Integration with useForm', () => {
  it('should validate form with Zod schema', async () => {
    const schema = z.object({
      email: z.string().email('Invalid email'),
      password: z.string().min(8, 'Password too short'),
    })

    const { result } = renderHook(() =>
      useForm({
        initialValues: {
          email: '',
          password: '',
        },
        validate: zodAdapter(schema),
      })
    )

    // Initial state
    expect(result.current.values).toEqual({
      email: '',
      password: '',
    })

    // Set invalid email
    act(() => {
      result.current.setFieldValue('email' as any, 'invalid')
    })

    // Validate email field
    await act(async () => {
      await result.current.validateField('email' as any)
    })

    expect(result.current.errors.email).toBe('Invalid email')

    // Set valid email
    act(() => {
      result.current.setFieldValue('email' as any, 'test@example.com')
    })

    await act(async () => {
      await result.current.validateField('email' as any)
    })

    expect(result.current.errors.email).toBeUndefined()

    // Set short password
    act(() => {
      result.current.setFieldValue('password' as any, 'short')
    })

    await act(async () => {
      await result.current.validateField('password' as any)
    })

    expect(result.current.errors.password).toBe('Password too short')

    // Set valid password
    act(() => {
      result.current.setFieldValue('password' as any, 'validpassword123')
    })

    await act(async () => {
      await result.current.validateField('password' as any)
    })

    expect(result.current.errors.password).toBeUndefined()
  })

  it('should validate nested objects with Zod', async () => {
    const schema = z.object({
      user: z.object({
        email: z.string().email('Invalid email'),
        profile: z.object({
          firstName: z.string().min(1, 'First name required'),
          lastName: z.string().min(1, 'Last name required'),
        }),
      }),
    })

    const { result } = renderHook(() =>
      useForm({
        initialValues: {
          user: {
            email: '',
            profile: {
              firstName: '',
              lastName: '',
            },
          },
        },
        validate: zodAdapter(schema),
      })
    )

    // Validate nested field
    await act(async () => {
      await result.current.validateField('user.profile.firstName' as any)
    })

    expect(result.current.errors['user.profile.firstName']).toBe('First name required')

    // Set valid value
    act(() => {
      result.current.setFieldValue('user.profile.firstName' as any, 'John')
    })

    await act(async () => {
      await result.current.validateField('user.profile.firstName' as any)
    })

    expect(result.current.errors['user.profile.firstName']).toBeUndefined()
  })

  it('should use zodForm helper', async () => {
    const schema = z.object({
      email: z.string().email('Invalid email'),
      age: z.number().min(18, 'Must be 18+'),
    })

    const { result } = renderHook(() =>
      useForm({
        ...zodForm(schema, {
          email: '',
          age: 0,
        }),
      })
    )

    // Initial values
    expect(result.current.values).toEqual({
      email: '',
      age: 0,
    })

    // Validate age
    await act(async () => {
      await result.current.validateField('age' as any)
    })

    expect(result.current.errors.age).toBe('Must be 18+')

    // Set valid age
    act(() => {
      result.current.setFieldValue('age' as any, 25)
    })

    await act(async () => {
      await result.current.validateField('age' as any)
    })

    expect(result.current.errors.age).toBeUndefined()
  })

  it('should validate complete form with Zod', async () => {
    const schema = z.object({
      email: z.string().email('Invalid email'),
      password: z.string().min(8, 'Password too short'),
      age: z.number().min(18, 'Must be 18+'),
    })

    const { result } = renderHook(() =>
      useForm({
        ...zodForm(schema, {
          email: '',
          password: '',
          age: 0,
        }),
      })
    )

    // Validate entire form (should have errors)
    await act(async () => {
      await result.current.validate()
    })

    expect(result.current.errors.email).toBeDefined()
    expect(result.current.errors.password).toBeDefined()
    expect(result.current.errors.age).toBeDefined()

    // Set all fields to valid values
    act(() => {
      result.current.setFieldValue('email' as any, 'test@example.com')
      result.current.setFieldValue('password' as any, 'validpassword123')
      result.current.setFieldValue('age' as any, 25)
    })

    // Validate entire form (should be valid)
    await act(async () => {
      await result.current.validate()
    })

    expect(result.current.errors.email).toBeUndefined()
    expect(result.current.errors.password).toBeUndefined()
    expect(result.current.errors.age).toBeUndefined()
    expect(result.current.isValid).toBe(true)
  })
})
