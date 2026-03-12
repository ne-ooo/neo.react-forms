/**
 * Debounce utility tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { debounce, debounceValidator } from '../debounce.js'

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should debounce function calls', async () => {
    const fn = vi.fn(async (value: string) => value.toUpperCase())
    const debounced = debounce(fn, 300)

    const promise1 = debounced('hello')
    const promise2 = debounced('world')
    const promise3 = debounced('test')

    // Only last call should execute
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(300)
    await vi.runAllTimersAsync()

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('test')

    const result = await promise3
    expect(result).toBe('TEST')
  })

  it('should cancel previous calls', async () => {
    const fn = vi.fn(async (value: number) => value * 2)
    const debounced = debounce(fn, 200)

    debounced(1)
    debounced(2)
    const promise = debounced(3)

    vi.advanceTimersByTime(200)
    await vi.runAllTimersAsync()

    const result = await promise
    expect(result).toBe(6)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should handle multiple debounce windows', async () => {
    const fn = vi.fn(async (value: string) => value)
    const debounced = debounce(fn, 100)

    // First window
    const promise1 = debounced('first')
    vi.advanceTimersByTime(100)
    await vi.runAllTimersAsync()

    // Second window
    const promise2 = debounced('second')
    vi.advanceTimersByTime(100)
    await vi.runAllTimersAsync()

    expect(await promise1).toBe('first')
    expect(await promise2).toBe('second')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should support cancel method', async () => {
    const fn = vi.fn(async (value: string) => value)
    const debounced = debounce(fn, 200)

    const promise = debounced('test')
    debounced.cancel()

    vi.advanceTimersByTime(200)
    await vi.runAllTimersAsync()

    await expect(promise).rejects.toThrow('Debounced call cancelled')
    expect(fn).not.toHaveBeenCalled()
  })

  it('should handle errors from async function', async () => {
    const fn = vi.fn(async () => {
      throw new Error('Test error')
    })
    const debounced = debounce(fn, 100)

    const promise = debounced()

    vi.advanceTimersByTime(100)
    await vi.runAllTimersAsync()

    await expect(promise).rejects.toThrow('Test error')
  })

  it('should preserve this context', async () => {
    const obj = {
      value: 42,
      getValue: debounce(async function (this: { value: number }) {
        return this.value
      }, 100),
    }

    const promise = obj.getValue()

    vi.advanceTimersByTime(100)
    await vi.runAllTimersAsync()

    const result = await promise
    expect(result).toBe(42)
  })
})

describe('debounceValidator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should create debounced validator', async () => {
    const validator = vi.fn(async (value: string) => {
      return value.length < 3 ? 'Too short' : null
    })

    const debounced = debounceValidator(validator, 200)

    const promise1 = debounced('a')
    const promise2 = debounced('ab')
    const promise3 = debounced('abc')

    vi.advanceTimersByTime(200)
    await vi.runAllTimersAsync()

    const result = await promise3
    expect(result).toBeNull()
    expect(validator).toHaveBeenCalledTimes(1)
    expect(validator).toHaveBeenCalledWith('abc')
  })

  it('should return validation errors', async () => {
    const debounced = debounceValidator(async (value: string) => {
      return value === 'invalid' ? 'Invalid value' : null
    }, 100)

    const promise = debounced('invalid')

    vi.advanceTimersByTime(100)
    await vi.runAllTimersAsync()

    const result = await promise
    expect(result).toBe('Invalid value')
  })

  it('should use default debounce time', async () => {
    const validator = vi.fn(async () => null)
    const debounced = debounceValidator(validator) // Default 300ms

    const promise = debounced('test')

    vi.advanceTimersByTime(299)
    expect(validator).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    await vi.runAllTimersAsync()

    await promise
    expect(validator).toHaveBeenCalledTimes(1)
  })

  it('should handle async validation with network delay', async () => {
    const checkUsername = debounceValidator(async (username: string) => {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 50))
      return username === 'taken' ? 'Username already taken' : null
    }, 200)

    const promise = checkUsername('taken')

    vi.advanceTimersByTime(200)
    await vi.runAllTimersAsync()

    const result = await promise
    expect(result).toBe('Username already taken')
  })
})
