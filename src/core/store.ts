/**
 * Form state store with field-level subscriptions
 *
 * This is the core that enables:
 * - Field-level re-renders (1 component per change vs Formik's 30+)
 * - Isolated updates (only subscribed fields update)
 * - Predictable state management
 *
 * Key innovation: Uses a subscription model where each field
 * subscribes to its own state, preventing unnecessary re-renders.
 */

import type { Path, ValueAtPath, FieldState, SubscriptionCallback, Unsubscribe } from '../types.js'

/**
 * Get value at a nested path
 *
 * @param obj - Object to get value from
 * @param path - Dot-separated path (e.g., "user.profile.name")
 * @returns Value at path or undefined
 *
 * @example
 * getValueByPath({ user: { name: "John" } }, "user.name") // "John"
 */
export function getValueByPath<T>(obj: T, path: string): unknown {
  const keys = path.split('.')
  let value: unknown = obj

  for (const key of keys) {
    if (value === null || value === undefined || typeof value !== 'object') {
      return undefined
    }
    value = (value as Record<string, unknown>)[key]
  }

  return value
}

/**
 * Set value at a nested path (immutably)
 *
 * @param obj - Object to set value in
 * @param path - Dot-separated path
 * @param value - Value to set
 * @returns New object with updated value
 *
 * @example
 * setValueByPath({ user: { name: "John" } }, "user.name", "Jane")
 * // { user: { name: "Jane" } }
 */
export function setValueByPath<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split('.')
  const lastKey = keys[keys.length - 1]

  if (!lastKey) {
    return obj
  }

  if (keys.length === 1) {
    return { ...obj, [lastKey]: value }
  }

  const firstKey = keys[0]
  if (!firstKey) {
    return obj
  }

  const restPath = keys.slice(1).join('.')
  const nestedObj = (obj as Record<string, unknown>)[firstKey]

  return {
    ...obj,
    [firstKey]: setValueByPath(
      nestedObj !== null && nestedObj !== undefined && typeof nestedObj === 'object'
        ? nestedObj
        : {},
      restPath,
      value
    ),
  }
}

/**
 * Form state store
 *
 * Manages form state with field-level subscription support.
 * This enables isolated re-renders - only components that subscribe
 * to a specific field will re-render when that field changes.
 */
export class FormStore<Values extends Record<string, unknown>> {
  private values: Values
  private initialValues: Values
  private errors: Partial<Record<Path<Values>, string>> = {}
  private touched: Partial<Record<Path<Values>, boolean>> = {}
  private validatingFields: Set<string> = new Set()
  private pendingValidations: Map<string, AbortController> = new Map()
  private subscriptions: Map<string, Set<SubscriptionCallback<unknown>>> = new Map()
  private globalSubscribers: Set<() => void> = new Set()
  private version = 0
  private computedFields: Partial<Record<keyof Values, (values: Values) => unknown>> = {}

  constructor(initialValues: Values, computed?: Partial<Record<keyof Values, (values: Values) => unknown>>) {
    this.initialValues = structuredClone(initialValues)
    this.values = structuredClone(initialValues)
    this.computedFields = computed || {}

    // Initialize computed values
    this.updateComputedFields()
  }

  /**
   * Update all computed field values
   */
  private updateComputedFields(): void {
    for (const [key, computeFn] of Object.entries(this.computedFields)) {
      if (computeFn) {
        const computedValue = computeFn(this.values)
        ;(this.values as Record<string, unknown>)[key] = computedValue
      }
    }
  }

  /**
   * Get current version (for useSyncExternalStore)
   */
  getVersion(): number {
    return this.version
  }

  /**
   * Get current form values
   */
  getValues(): Values {
    return this.values
  }

  /**
   * Get value at specific field path
   */
  getValue<P extends Path<Values>>(name: P): ValueAtPath<Values, P> {
    return getValueByPath(this.values, name) as ValueAtPath<Values, P>
  }

  /**
   * Set value at specific field path
   */
  setValue<P extends Path<Values>>(name: P, value: ValueAtPath<Values, P>): void {
    this.values = setValueByPath(this.values, name, value)

    // Update computed fields after value change
    this.updateComputedFields()

    // Notify subscribers (including computed field subscribers)
    this.notifySubscribers(name)

    // Notify computed field subscribers
    for (const computedKey of Object.keys(this.computedFields)) {
      if (computedKey !== name) {
        this.notifySubscribers(computedKey as Path<Values>)
      }
    }

    this.notifyGlobalSubscribers()
  }

  /**
   * Get error for specific field
   */
  getError<P extends Path<Values>>(name: P): string | undefined {
    return this.errors[name]
  }

  /**
   * Set error for specific field
   */
  setError<P extends Path<Values>>(name: P, error: string | undefined): void {
    if (error === undefined) {
      delete this.errors[name]
    } else {
      this.errors[name] = error
    }
    this.notifySubscribers(name)
    this.notifyGlobalSubscribers()
  }

  /**
   * Get touched state for specific field
   */
  getTouched<P extends Path<Values>>(name: P): boolean {
    return this.touched[name] ?? false
  }

  /**
   * Set touched state for specific field
   */
  setTouched<P extends Path<Values>>(name: P, touched: boolean): void {
    if (touched) {
      this.touched[name] = true
    } else {
      delete this.touched[name]
    }
    this.notifySubscribers(name)
    this.notifyGlobalSubscribers()
  }

  /**
   * Get complete field state
   */
  getFieldState<P extends Path<Values>>(name: P): FieldState<ValueAtPath<Values, P>> {
    const value = this.getValue(name)
    const initialValue = getValueByPath(this.initialValues, name)

    return {
      value,
      error: this.getError(name),
      touched: this.getTouched(name),
      dirty: value !== initialValue,
      isValidating: this.isFieldValidating(name),
    }
  }

  /**
   * Subscribe to field changes
   *
   * Returns unsubscribe function
   */
  subscribe<P extends Path<Values>>(
    name: P,
    callback: SubscriptionCallback<ValueAtPath<Values, P>>
  ): Unsubscribe {
    const callbacks = this.subscriptions.get(name) ?? new Set()
    callbacks.add(callback as SubscriptionCallback<unknown>)
    this.subscriptions.set(name, callbacks)

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(name)
      if (callbacks) {
        callbacks.delete(callback as SubscriptionCallback<unknown>)
        if (callbacks.size === 0) {
          this.subscriptions.delete(name)
        }
      }
    }
  }

  /**
   * Notify all subscribers of a field
   */
  private notifySubscribers<P extends Path<Values>>(name: P): void {
    const callbacks = this.subscriptions.get(name)
    if (callbacks) {
      const state = this.getFieldState(name)
      callbacks.forEach((callback) => callback(state))
    }
  }

  /**
   * Subscribe to any store change (for form-level re-renders)
   */
  subscribeToStore(callback: () => void): () => void {
    this.globalSubscribers.add(callback)

    return () => {
      this.globalSubscribers.delete(callback)
    }
  }

  /**
   * Notify all global subscribers
   */
  private notifyGlobalSubscribers(): void {
    this.version++
    this.globalSubscribers.forEach((callback) => callback())
  }

  /**
   * Start async validation for a field
   */
  startValidation<P extends Path<Values>>(name: P): AbortController {
    // Cancel any pending validation for this field
    this.cancelValidation(name)

    // Create new abort controller
    const controller = new AbortController()
    this.pendingValidations.set(name, controller)

    // Mark field as validating
    this.validatingFields.add(name)
    this.notifySubscribers(name)
    this.notifyGlobalSubscribers()

    return controller
  }

  /**
   * End async validation for a field
   */
  endValidation<P extends Path<Values>>(name: P): void {
    this.validatingFields.delete(name)
    this.pendingValidations.delete(name)
    this.notifySubscribers(name)
    this.notifyGlobalSubscribers()
  }

  /**
   * Cancel pending validation for a field
   */
  cancelValidation<P extends Path<Values>>(name: P): void {
    const controller = this.pendingValidations.get(name)
    if (controller) {
      controller.abort()
      this.validatingFields.delete(name)
      this.pendingValidations.delete(name)
      this.notifySubscribers(name)
      this.notifyGlobalSubscribers()
    }
  }

  /**
   * Check if a specific field is validating
   */
  isFieldValidating<P extends Path<Values>>(name: P): boolean {
    return this.validatingFields.has(name)
  }

  /**
   * Check if any field is validating
   */
  isValidating(): boolean {
    return this.validatingFields.size > 0
  }

  /**
   * Get all fields currently validating
   */
  getValidatingFields(): string[] {
    return Array.from(this.validatingFields)
  }

  /**
   * Reset form to initial values
   */
  reset(newInitialValues?: Partial<Values>): void {
    if (newInitialValues) {
      this.initialValues = { ...this.initialValues, ...newInitialValues }
    }

    this.values = structuredClone(this.initialValues)
    this.errors = {}
    this.touched = {}

    // Notify all subscribers
    this.subscriptions.forEach((_, name) => {
      this.notifySubscribers(name as Path<Values>)
    })
    this.notifyGlobalSubscribers()
  }

  /**
   * Get all errors
   */
  getErrors(): Partial<Record<Path<Values>, string>> {
    return { ...this.errors }
  }

  /**
   * Get all touched fields
   */
  getTouchedFields(): Partial<Record<Path<Values>, boolean>> {
    return { ...this.touched }
  }

  /**
   * Check if form is dirty (any field changed)
   */
  isDirty(): boolean {
    return JSON.stringify(this.values) !== JSON.stringify(this.initialValues)
  }

  /**
   * Check if form is valid (no errors)
   */
  isValid(): boolean {
    return Object.keys(this.errors).length === 0
  }
}
