/**
 * Accessibility utilities tests
 */

import { describe, it, expect } from 'vitest'
import {
  getFieldAriaProps,
  generateFieldIds,
  getLabelProps,
  getErrorProps,
  getDescriptionProps,
} from '../accessibility.js'

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
})

describe('getErrorProps', () => {
  it('should return error props with id and role', () => {
    const props = getErrorProps('email')

    expect(props.id).toBe('email-error')
    expect(props.role).toBe('alert')
    expect(props['aria-live']).toBe('polite')
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
})
