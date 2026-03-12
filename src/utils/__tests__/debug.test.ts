/**
 * Debug utilities tests
 */

import { describe, it, expect, vi } from 'vitest'
import {
  configureDebug,
  getDebugConfig,
  debugValueChange,
  debugValidation,
  debugSubmission,
  debugFormCreated,
  createFormId,
  createTimer,
} from '../debug.js'

describe('configureDebug', () => {
  it('should configure debug mode', () => {
    configureDebug({ enabled: true })

    const config = getDebugConfig()
    expect(config.enabled).toBe(true)

    // Reset
    configureDebug({ enabled: false })
  })

  it('should configure specific logging options', () => {
    configureDebug({
      enabled: true,
      logValueChanges: false,
      logValidation: true,
    })

    const config = getDebugConfig()
    expect(config.logValueChanges).toBe(false)
    expect(config.logValidation).toBe(true)

    // Reset
    configureDebug({ enabled: false })
  })

  it('should allow custom logger', () => {
    const customLogger = vi.fn()
    configureDebug({
      enabled: true,
      logger: customLogger,
    })

    const config = getDebugConfig()
    expect(config.logger).toBe(customLogger)

    // Reset
    configureDebug({ enabled: false })
  })
})

describe('debug logging functions', () => {
  it('should call custom logger for value changes', () => {
    const logger = vi.fn()
    configureDebug({ enabled: true, logger, logValueChanges: true })

    debugValueChange('form-1', 'email', '', 'test@example.com')

    expect(logger).toHaveBeenCalled()
    expect(logger.mock.calls[0][0]).toContain('form-1.email changed')

    // Reset
    configureDebug({ enabled: false })
  })

  it('should call custom logger for validation', () => {
    const logger = vi.fn()
    configureDebug({ enabled: true, logger, logValidation: true })

    debugValidation('form-1', 'email', {
      valid: false,
      error: 'Invalid email',
      duration: 5,
    })

    expect(logger).toHaveBeenCalled()
    expect(logger.mock.calls[0][0]).toMatch(/✗.*email/)

    // Reset
    configureDebug({ enabled: false })
  })

  it('should call custom logger for submissions', () => {
    const logger = vi.fn()
    configureDebug({ enabled: true, logger, logSubmissions: true })

    debugSubmission('form-1', { success: true, duration: 100 })

    expect(logger).toHaveBeenCalled()
    expect(logger.mock.calls[0][0]).toMatch(/✓.*submitted/)

    // Reset
    configureDebug({ enabled: false })
  })

  it('should call custom logger for form creation', () => {
    const logger = vi.fn()
    configureDebug({ enabled: true, logger })

    debugFormCreated('form-1', { email: '', password: '' })

    expect(logger).toHaveBeenCalled()
    expect(logger.mock.calls[0][0]).toMatch(/Form created/)

    // Reset
    configureDebug({ enabled: false })
  })

  it('should not log when disabled', () => {
    const logger = vi.fn()
    configureDebug({ enabled: false, logger })

    debugValueChange('form-1', 'email', '', 'test@example.com')

    expect(logger).not.toHaveBeenCalled()
  })

  it('should respect logging options', () => {
    const logger = vi.fn()
    configureDebug({
      enabled: true,
      logger,
      logValueChanges: false,
    })

    debugValueChange('form-1', 'email', '', 'test@example.com')

    expect(logger).not.toHaveBeenCalled()

    // Reset
    configureDebug({ enabled: false })
  })
})

describe('createFormId', () => {
  it('should create unique form IDs', () => {
    const id1 = createFormId()
    const id2 = createFormId()

    expect(id1).not.toBe(id2)
    expect(id1).toMatch(/^form-\d+$/)
    expect(id2).toMatch(/^form-\d+$/)
  })

  it('should use custom ID if provided', () => {
    const id = createFormId('custom-form')

    expect(id).toBe('custom-form')
  })
})

describe('createTimer', () => {
  it('should measure elapsed time', () => {
    const endTimer = createTimer()

    // Wait a bit
    const start = performance.now()
    while (performance.now() - start < 5) {
      // Busy wait for ~5ms
    }

    const duration = endTimer()

    expect(duration).toBeGreaterThanOrEqual(5)
    expect(duration).toBeLessThan(100)
  })

  it('should return duration in milliseconds', () => {
    const endTimer = createTimer()
    const duration = endTimer()

    expect(typeof duration).toBe('number')
    expect(duration).toBeGreaterThanOrEqual(0)
  })
})
