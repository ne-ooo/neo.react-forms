/**
 * Accessibility utilities for @lpm.dev/neo.react-forms
 *
 * Automatic ARIA attributes and accessibility helpers
 */

/**
 * Field accessibility props
 */
export interface A11yFieldProps {
  /**
   * Indicates if field has an error
   */
  'aria-invalid'?: boolean

  /**
   * ID of error message element
   */
  'aria-describedby'?: string

  /**
   * Indicates if field is required
   */
  'aria-required'?: boolean

  /**
   * Role for custom inputs
   */
  role?: string
}

/**
 * Generate ARIA attributes for a form field
 *
 * @param options - Field state and configuration
 * @returns ARIA attributes object
 *
 * @example
 * ```tsx
 * const ariaProps = getFieldAriaProps({
 *   name: 'email',
 *   hasError: true,
 *   isRequired: true,
 *   errorId: 'email-error'
 * })
 * // { aria-invalid: true, aria-required: true, aria-describedby: 'email-error' }
 * ```
 */
export function getFieldAriaProps(options: {
  name: string
  hasError?: boolean
  isRequired?: boolean
  errorId?: string
  descriptionId?: string
}): A11yFieldProps {
  const { hasError, isRequired, errorId, descriptionId } = options

  const props: A11yFieldProps = {}

  // Mark field as invalid if it has an error
  if (hasError) {
    props['aria-invalid'] = true
  }

  // Mark field as required
  if (isRequired) {
    props['aria-required'] = true
  }

  // Link to error message or description
  const describedByIds: string[] = []
  if (hasError && errorId) {
    describedByIds.push(errorId)
  }
  if (descriptionId) {
    describedByIds.push(descriptionId)
  }
  if (describedByIds.length > 0) {
    props['aria-describedby'] = describedByIds.join(' ')
  }

  return props
}

/**
 * Generate unique IDs for error and description elements
 *
 * @param fieldName - Field name
 * @returns Object with error and description IDs
 *
 * @example
 * ```tsx
 * const ids = generateFieldIds('email')
 * // { errorId: 'email-error', descriptionId: 'email-description' }
 * ```
 */
export function generateFieldIds(fieldName: string): {
  errorId: string
  descriptionId: string
} {
  // Replace dots with dashes for valid HTML IDs
  const safeFieldName = fieldName.replace(/\./g, '-')

  return {
    errorId: `${safeFieldName}-error`,
    descriptionId: `${safeFieldName}-description`,
  }
}

/**
 * Check if a validator indicates a required field
 *
 * @param validator - Validator function or array
 * @returns true if field is required
 */
export function isFieldRequired(validator: any): boolean {
  // Check if validator is a required validator
  // This is a heuristic - we check if validating empty value returns an error
  if (!validator) return false

  // Handle array of validators
  if (Array.isArray(validator)) {
    return validator.some((v) => isFieldRequired(v))
  }

  // We can't reliably detect required validators without running them
  // This would need to be set explicitly by the user
  return false
}

/**
 * Get accessible label props
 *
 * @param fieldName - Field name
 * @param labelText - Label text
 * @returns Label props with htmlFor
 */
export function getLabelProps(fieldName: string, labelText?: string): {
  htmlFor: string
  children?: string
} {
  const safeFieldName = fieldName.replace(/\./g, '-')

  return {
    htmlFor: safeFieldName,
    ...(labelText ? { children: labelText } : {}),
  }
}

/**
 * Get accessible error message props
 *
 * @param fieldName - Field name
 * @param error - Error message
 * @returns Error message props with id and role
 */
export function getErrorProps(fieldName: string, error?: string): {
  id: string
  role: 'alert'
  'aria-live': 'polite'
  children?: string
} {
  const { errorId } = generateFieldIds(fieldName)

  return {
    id: errorId,
    role: 'alert',
    'aria-live': 'polite',
    ...(error ? { children: error } : {}),
  }
}

/**
 * Get accessible description props
 *
 * @param fieldName - Field name
 * @param description - Description text
 * @returns Description props with id
 */
export function getDescriptionProps(fieldName: string, description?: string): {
  id: string
  children?: string
} {
  const { descriptionId } = generateFieldIds(fieldName)

  return {
    id: descriptionId,
    ...(description ? { children: description } : {}),
  }
}

/**
 * Announce message to screen readers
 *
 * @param message - Message to announce
 * @param priority - Announcement priority ('polite' or 'assertive')
 *
 * @example
 * ```ts
 * announceToScreenReader('Form submitted successfully')
 * ```
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  // Create a visually hidden element for screen readers
  const announcement = document.createElement('div')
  announcement.setAttribute('role', 'status')
  announcement.setAttribute('aria-live', priority)
  announcement.setAttribute('aria-atomic', 'true')
  announcement.style.position = 'absolute'
  announcement.style.left = '-10000px'
  announcement.style.width = '1px'
  announcement.style.height = '1px'
  announcement.style.overflow = 'hidden'
  announcement.textContent = message

  document.body.appendChild(announcement)

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement)
  }, 1000)
}

/**
 * Validation error announcer for screen readers
 */
export function announceValidationError(fieldName: string, error: string): void {
  announceToScreenReader(`${fieldName}: ${error}`, 'assertive')
}

/**
 * Form submission announcer for screen readers
 */
export function announceFormSubmission(success: boolean, message?: string): void {
  const defaultMessage = success ? 'Form submitted successfully' : 'Form submission failed'
  announceToScreenReader(message || defaultMessage, 'polite')
}
