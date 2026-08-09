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
    describedByIds.push(...errorId.trim().split(/\s+/))
  }
  if (descriptionId) {
    describedByIds.push(...descriptionId.trim().split(/\s+/))
  }
  const uniqueDescribedByIds = [...new Set(describedByIds.filter(Boolean))]
  if (uniqueDescribedByIds.length > 0) {
    props['aria-describedby'] = uniqueDescribedByIds.join(' ')
  }

  return props
}

/**
 * Generate unique IDs for error and description elements
 *
 * @param fieldName - Field name
 * @param idPrefix - Stable form prefix that prevents duplicate page IDs
 * @returns Object with error and description IDs
 *
 * @example
 * ```tsx
 * const ids = generateFieldIds('email')
 * // { errorId: 'email-error', descriptionId: 'email-description' }
 * ```
 */
export function generateFieldIds(fieldName: string, idPrefix?: string): {
  errorId: string
  descriptionId: string
} {
  const safeFieldName = createSafeHtmlId(fieldName)
  const safePrefix = idPrefix ? `${createSafeHtmlId(idPrefix)}-` : ''

  return {
    errorId: `${safePrefix}${safeFieldName}-error`,
    descriptionId: `${safePrefix}${safeFieldName}-description`,
  }
}

/** Convert a form field name to a safe HTML ID. */
export function createSafeHtmlId(value: string): string {
  const safeValue = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')

  return safeValue || 'field'
}

/**
 * Check if a validator indicates a required field
 *
 * @param validator - Validator function or array
 * @returns true if field is required
 */
export function isFieldRequired(validator: unknown): boolean {
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
 * @param idPrefix - Stable form prefix
 * @returns Label props with htmlFor
 */
export function getLabelProps(
  fieldName: string,
  labelText?: string,
  idPrefix?: string
): {
  htmlFor: string
  children?: string
} {
  const safeFieldName = createSafeHtmlId(fieldName)
  const safePrefix = idPrefix ? `${createSafeHtmlId(idPrefix)}-` : ''

  return {
    htmlFor: `${safePrefix}${safeFieldName}`,
    ...(labelText ? { children: labelText } : {}),
  }
}

/**
 * Get accessible error message props
 *
 * @param fieldName - Field name
 * @param error - Error message
 * @param idPrefix - Stable form prefix
 * @returns Error message props with id and role
 */
export function getErrorProps(
  fieldName: string,
  error?: string,
  idPrefix?: string
): {
  id: string
  role: 'alert'
  'aria-live': 'assertive'
  children?: string
} {
  const { errorId } = generateFieldIds(fieldName, idPrefix)

  return {
    id: errorId,
    role: 'alert',
    'aria-live': 'assertive',
    ...(error ? { children: error } : {}),
  }
}

/**
 * Get accessible description props
 *
 * @param fieldName - Field name
 * @param description - Description text
 * @param idPrefix - Stable form prefix
 * @returns Description props with id
 */
export function getDescriptionProps(
  fieldName: string,
  description?: string,
  idPrefix?: string
): {
  id: string
  children?: string
} {
  const { descriptionId } = generateFieldIds(fieldName, idPrefix)

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
 * @returns Cleanup function that removes the live region
 *
 * @example
 * ```ts
 * announceToScreenReader('Form submitted successfully')
 * ```
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): () => void {
  const noCleanupNeeded = (): void => {}
  if (
    !message.trim() ||
    typeof document === 'undefined' ||
    !document.body
  ) {
    return noCleanupNeeded
  }

  // Create a visually hidden element for screen readers
  const announcement = document.createElement('div')
  announcement.setAttribute('role', priority === 'assertive' ? 'alert' : 'status')
  announcement.setAttribute('aria-live', priority)
  announcement.setAttribute('aria-atomic', 'true')
  announcement.setAttribute('data-neo-form-announcement', priority)
  announcement.style.position = 'absolute'
  announcement.style.clip = 'rect(0 0 0 0)'
  announcement.style.clipPath = 'inset(50%)'
  announcement.style.width = '1px'
  announcement.style.height = '1px'
  announcement.style.margin = '-1px'
  announcement.style.overflow = 'hidden'
  announcement.style.padding = '0'
  announcement.style.whiteSpace = 'nowrap'

  document.body.appendChild(announcement)

  // Add the text after the live region enters the document. This also permits
  // repeated announcements that contain the same text.
  const updateTimer = setTimeout(() => {
    if (announcement.isConnected) announcement.textContent = message
  }, 0)

  const removeTimer = setTimeout(() => {
    announcement.remove()
  }, 1000)

  return () => {
    clearTimeout(updateTimer)
    clearTimeout(removeTimer)
    announcement.remove()
  }
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
