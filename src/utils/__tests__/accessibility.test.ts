/**
 * Accessibility utilities tests
 */

import { afterEach, describe, it, expect, vi } from 'vitest'
import {
  getFieldAriaProps,
  generateFieldIds,
  createSafeHtmlId,
  getLabelProps,
  getErrorProps,
  getDescriptionProps,
  announceToScreenReader,
} from '../accessibility.js'

afterEach(() => {
  vi.useRealTimers()
  document.querySelectorAll('[data-neo-form-announcement]').forEach((element) => {
    element.remove()
  })
})

describe('getFieldAriaProps', () => {
  it('should return empty props for valid field', () => {
    const props = getFieldAriaProps({
      name: 'email',
      hasError: false,
      isRequired: false,
    })

    expect(props).toEqual({})
  })

  it('should mark field as invalid when has error', () => {
    const props = getFieldAriaProps({
      name: 'email',
      hasError: true,
    })

    expect(props['aria-invalid']).toBe(true)
  })

  it('should mark field as required', () => {
    const props = getFieldAriaProps({
      name: 'email',
      isRequired: true,
    })

    expect(props['aria-required']).toBe(true)
  })

  it('should link to error message', () => {
    const props = getFieldAriaProps({
      name: 'email',
      hasError: true,
      errorId: 'email-error',
    })

    expect(props['aria-describedby']).toBe('email-error')
  })

  it('should link to description', () => {
    const props = getFieldAriaProps({
      name: 'email',
      descriptionId: 'email-description',
    })

    expect(props['aria-describedby']).toBe('email-description')
  })

  it('should link to both error and description', () => {
    const props = getFieldAriaProps({
      name: 'email',
      hasError: true,
      errorId: 'email-error',
      descriptionId: 'email-description',
    })

    expect(props['aria-describedby']).toBe('email-error email-description')
  })

  it('normalizes whitespace and removes duplicate description IDs', () => {
    const props = getFieldAriaProps({
      name: 'email',
      hasError: true,
      errorId: 'email-error shared-help',
      descriptionId: ' shared-help   email-description ',
    })

    expect(props['aria-describedby']).toBe(
      'email-error shared-help email-description'
    )
  })

  it('should handle all props together', () => {
    const props = getFieldAriaProps({
      name: 'email',
      hasError: true,
      isRequired: true,
      errorId: 'email-error',
      descriptionId: 'email-description',
    })

    expect(props).toEqual({
      'aria-invalid': true,
      'aria-required': true,
      'aria-describedby': 'email-error email-description',
    })
  })
})

describe('generateFieldIds', () => {
  it('should generate error and description IDs', () => {
    const ids = generateFieldIds('email')

    expect(ids.errorId).toBe('email-error')
    expect(ids.descriptionId).toBe('email-description')
  })

  it('should handle nested field names', () => {
    const ids = generateFieldIds('user.profile.email')

    expect(ids.errorId).toBe('user-profile-email-error')
    expect(ids.descriptionId).toBe('user-profile-email-description')
  })

  it('should handle array field names', () => {
    const ids = generateFieldIds('users.0.email')

    expect(ids.errorId).toBe('users-0-email-error')
    expect(ids.descriptionId).toBe('users-0-email-description')
  })

  it('sanitizes unsafe characters and empty field names', () => {
    expect(createSafeHtmlId(' billing address/card # ')).toBe(
      'billing-address-card'
    )
    expect(createSafeHtmlId('...')).toBe('field')
  })

  it('supports a form prefix to prevent duplicate IDs', () => {
    const signupIds = generateFieldIds('email', 'signup form')
    const profileIds = generateFieldIds('email', 'profile form')

    expect(signupIds.errorId).toBe('signup-form-email-error')
    expect(profileIds.errorId).toBe('profile-form-email-error')
    expect(signupIds.errorId).not.toBe(profileIds.errorId)
  })
})

describe('getLabelProps', () => {
  it('should return htmlFor with field name', () => {
    const props = getLabelProps('email')

    expect(props.htmlFor).toBe('email')
  })

  it('should include label text', () => {
    const props = getLabelProps('email', 'Email Address')

    expect(props.htmlFor).toBe('email')
    expect(props.children).toBe('Email Address')
  })

  it('should handle nested field names', () => {
    const props = getLabelProps('user.profile.email')

    expect(props.htmlFor).toBe('user-profile-email')
  })

  it('uses the same prefix as related field IDs', () => {
    expect(getLabelProps('email', 'Email', 'signup').htmlFor).toBe(
      'signup-email'
    )
  })
})

describe('getErrorProps', () => {
  it('should return error props with id and role', () => {
    const props = getErrorProps('email')

    expect(props.id).toBe('email-error')
    expect(props.role).toBe('alert')
    expect(props['aria-live']).toBe('assertive')
  })

  it('should include error message', () => {
    const props = getErrorProps('email', 'Invalid email address')

    expect(props.id).toBe('email-error')
    expect(props.children).toBe('Invalid email address')
  })

  it('should handle nested field names', () => {
    const props = getErrorProps('user.profile.email', 'Invalid email')

    expect(props.id).toBe('user-profile-email-error')
    expect(props.children).toBe('Invalid email')
  })

  it('uses a unique form prefix', () => {
    expect(getErrorProps('email', 'Invalid', 'signup').id).toBe(
      'signup-email-error'
    )
  })
})

describe('getDescriptionProps', () => {
  it('should return description props with id', () => {
    const props = getDescriptionProps('email')

    expect(props.id).toBe('email-description')
  })

  it('should include description text', () => {
    const props = getDescriptionProps('email', 'Enter your email address')

    expect(props.id).toBe('email-description')
    expect(props.children).toBe('Enter your email address')
  })

  it('should handle nested field names', () => {
    const props = getDescriptionProps('user.profile.email', 'Your email')

    expect(props.id).toBe('user-profile-email-description')
    expect(props.children).toBe('Your email')
  })

  it('uses a unique form prefix', () => {
    expect(getDescriptionProps('email', 'Help', 'signup').id).toBe(
      'signup-email-description'
    )
  })
})

describe('announceToScreenReader', () => {
  it('announces repeated messages and cleans up both live regions', () => {
    vi.useFakeTimers()

    announceToScreenReader('Saved')
    announceToScreenReader('Saved')
    vi.advanceTimersByTime(0)

    const announcements = document.querySelectorAll(
      '[data-neo-form-announcement="polite"]'
    )
    expect(announcements).toHaveLength(2)
    expect([...announcements].map((element) => element.textContent)).toEqual([
      'Saved',
      'Saved',
    ])

    vi.advanceTimersByTime(1000)
    expect(document.querySelectorAll('[data-neo-form-announcement]')).toHaveLength(
      0
    )
  })

  it('uses alert semantics for assertive announcements', () => {
    vi.useFakeTimers()

    const cleanup = announceToScreenReader('Invalid email', 'assertive')
    const announcement = document.querySelector(
      '[data-neo-form-announcement="assertive"]'
    )

    expect(announcement?.getAttribute('role')).toBe('alert')
    expect(announcement?.getAttribute('aria-live')).toBe('assertive')

    cleanup()
    cleanup()
    expect(announcement?.isConnected).toBe(false)
  })

  it('does nothing during server rendering', () => {
    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: undefined,
      writable: true,
    })

    try {
      const cleanup = announceToScreenReader('Saved')
      expect(cleanup).toBeTypeOf('function')
      expect(() => cleanup()).not.toThrow()
    } finally {
      if (documentDescriptor) {
        Object.defineProperty(globalThis, 'document', documentDescriptor)
      }
    }
  })

  it('ignores empty announcements', () => {
    announceToScreenReader('   ')

    expect(document.querySelectorAll('[data-neo-form-announcement]')).toHaveLength(
      0
    )
  })
})
