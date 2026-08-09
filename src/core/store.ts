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

export type FormStoreSlice =
  | 'values'
  | 'errors'
  | 'valid'
  | 'touched'
  | 'dirty'
  | 'validating'
  | 'submission'

type StoreSubscriptionCallback = (changedSlices: ReadonlySet<FormStoreSlice>) => void

interface SubscriptionNode {
  children: Map<string, SubscriptionNode>
  path?: string
}

function createSubscriptionNode(): SubscriptionNode {
  return { children: new Map() }
}

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
  if (keys.length === 0 || keys.some((key) => !key)) {
    return obj
  }

  if (keys.some((key) => key === '__proto__' || key === 'prototype' || key === 'constructor')) {
    throw new Error(`Unsafe form field path: ${path}`)
  }

  const isArrayIndex = (key: string): boolean => /^(0|[1-9]\d*)$/.test(key)

  const setAtPath = (current: unknown, index: number): unknown => {
    const key = keys[index]
    if (key === undefined) return current

    const clone: Record<string, unknown> | unknown[] = Array.isArray(current)
      ? [...current]
      : current !== null && typeof current === 'object'
        ? { ...(current as Record<string, unknown>) }
        : isArrayIndex(key)
          ? []
          : {}

    if (index === keys.length - 1) {
      ;(clone as Record<string, unknown>)[key] = value
      return clone
    }

    const nextKey = keys[index + 1]
    const currentChild =
      current !== null && typeof current === 'object'
        ? (current as Record<string, unknown>)[key]
        : undefined
    const fallback = nextKey !== undefined && isArrayIndex(nextKey) ? [] : {}
    ;(clone as Record<string, unknown>)[key] = setAtPath(currentChild ?? fallback, index + 1)
    return clone
  }

  return setAtPath(obj, 0) as T
}

function isProxyableObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value)
  return Array.isArray(value) || prototype === Object.prototype || prototype === null
}

function isDeepEqual(
  left: unknown,
  right: unknown,
  seen = new WeakMap<object, WeakSet<object>>()
): boolean {
  if (Object.is(left, right)) return true
  if (
    left === null ||
    right === null ||
    typeof left !== 'object' ||
    typeof right !== 'object'
  ) {
    return false
  }

  const seenRights = seen.get(left)
  if (seenRights?.has(right)) return true
  if (seenRights) {
    seenRights.add(right)
  } else {
    seen.set(left, new WeakSet([right]))
  }

  if (left instanceof Date || right instanceof Date) {
    return left instanceof Date && right instanceof Date && left.getTime() === right.getTime()
  }
  if (left instanceof RegExp || right instanceof RegExp) {
    return left instanceof RegExp && right instanceof RegExp && String(left) === String(right)
  }
  if (left instanceof ArrayBuffer || right instanceof ArrayBuffer) {
    if (!(left instanceof ArrayBuffer) || !(right instanceof ArrayBuffer)) return false
    if (left.byteLength !== right.byteLength) return false
    const leftBytes = new Uint8Array(left)
    const rightBytes = new Uint8Array(right)
    if (leftBytes.length !== rightBytes.length) return false
    return leftBytes.every((byte, index) => byte === rightBytes[index])
  }
  if (ArrayBuffer.isView(left) || ArrayBuffer.isView(right)) {
    if (!ArrayBuffer.isView(left) || !ArrayBuffer.isView(right)) return false
    if (left.byteLength !== right.byteLength) return false
    const leftBytes = new Uint8Array(left.buffer, left.byteOffset, left.byteLength)
    const rightBytes = new Uint8Array(right.buffer, right.byteOffset, right.byteLength)
    if (leftBytes.length !== rightBytes.length) return false
    return leftBytes.every((byte, index) => byte === rightBytes[index])
  }
  if (left instanceof Map || right instanceof Map) {
    if (!(left instanceof Map) || !(right instanceof Map) || left.size !== right.size) {
      return false
    }
    const unmatched = Array.from(right.entries())
    return Array.from(left.entries()).every(([leftKey, leftValue]) => {
      const index = unmatched.findIndex(
        ([rightKey, rightValue]) =>
          isDeepEqual(leftKey, rightKey, seen) && isDeepEqual(leftValue, rightValue, seen)
      )
      if (index === -1) return false
      unmatched.splice(index, 1)
      return true
    })
  }
  if (left instanceof Set || right instanceof Set) {
    if (!(left instanceof Set) || !(right instanceof Set) || left.size !== right.size) {
      return false
    }
    const unmatched = Array.from(right.values())
    return Array.from(left.values()).every((leftValue) => {
      const index = unmatched.findIndex((rightValue) => isDeepEqual(leftValue, rightValue, seen))
      if (index === -1) return false
      unmatched.splice(index, 1)
      return true
    })
  }

  if (typeof Blob !== 'undefined' && (left instanceof Blob || right instanceof Blob)) {
    if (!(left instanceof Blob) || !(right instanceof Blob)) return false
    const leftFile = typeof File !== 'undefined' && left instanceof File ? left : undefined
    const rightFile = typeof File !== 'undefined' && right instanceof File ? right : undefined
    return (
      left.size === right.size &&
      left.type === right.type &&
      leftFile?.name === rightFile?.name &&
      leftFile?.lastModified === rightFile?.lastModified
    )
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false
    }
    return left.every((entry, index) => isDeepEqual(entry, right[index], seen))
  }

  if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) return false
  const leftKeys = Reflect.ownKeys(left).filter((key) =>
    Object.prototype.propertyIsEnumerable.call(left, key)
  )
  const rightKeys = Reflect.ownKeys(right).filter((key) =>
    Object.prototype.propertyIsEnumerable.call(right, key)
  )
  if (leftKeys.length !== rightKeys.length) return false

  return leftKeys.every(
    (key) =>
      Object.prototype.propertyIsEnumerable.call(right, key) &&
      isDeepEqual(
        (left as Record<PropertyKey, unknown>)[key],
        (right as Record<PropertyKey, unknown>)[key],
        seen
      )
  )
}

/**
 * Form state store
 *
 * Manages form state with field-level subscription support.
 * This enables isolated re-renders - only components that subscribe
 * to a specific field will re-render when that field changes.
 */
export class FormStore<Values extends object> {
  private values: Values
  private initialValues: Values
  private errors: Partial<Record<Path<Values>, string>> = {}
  private touched: Partial<Record<Path<Values>, boolean>> = {}
  private validatingFields: Set<string> = new Set()
  private pendingValidations: Map<string, AbortController> = new Map()
  private subscriptions: Map<string, Set<SubscriptionCallback<unknown>>> = new Map()
  private subscriptionRoot: SubscriptionNode = createSubscriptionNode()
  private globalSubscribers: Set<StoreSubscriptionCallback> = new Set()
  private fieldSnapshots: Map<string, FieldState<unknown>> = new Map()
  private validatedFields: Set<string> = new Set()
  private dirtyLeafPaths: Set<string> = new Set()
  private dirtyPathCounts: Map<string, number> = new Map()
  private version = 0
  private computedFields: Partial<Record<keyof Values, (values: Values) => unknown>> = {}
  private computedDependencies: Map<string, Set<string>> = new Map()
  private batchDepth = 0
  private pendingNotificationPaths: Set<string> = new Set()
  private pendingSlices: Set<FormStoreSlice> = new Set()
  private isFlushingNotifications = false
  private activeSubmission: object | undefined
  private submitCount = 0

  constructor(initialValues: Values, computed?: Partial<Record<keyof Values, (values: Values) => unknown>>) {
    this.computedFields = computed ? { ...computed } : {}
    const initialClone = structuredClone(initialValues)
    this.values = this.applyComputedFields(initialClone).values
    this.initialValues = structuredClone(this.values)
  }

  /**
   * Resolve computed fields lazily so dependencies are order-independent and
   * cycles are rejected before any live form state is changed.
   */
  private applyComputedFields(
    values: Values,
    changedSourcePaths?: Iterable<string>
  ): {
    values: Values
    changedPaths: string[]
  } {
    const entries = Object.entries(this.computedFields) as Array<
      [string, ((values: Values) => unknown) | undefined]
    >
    if (entries.length === 0) return { values, changedPaths: [] }

    const computeFunctions = new Map(
      entries.filter((entry): entry is [string, (values: Values) => unknown] =>
        typeof entry[1] === 'function'
      )
    )
    const affectedComputed = new Set<string>()
    if (changedSourcePaths && this.computedDependencies.size === computeFunctions.size) {
      const changedKeys = new Set(
        Array.from(changedSourcePaths, (path) => path.split('.')[0]).filter(
          (key): key is string => key !== undefined
        )
      )
      for (const key of changedKeys) {
        if (computeFunctions.has(key)) affectedComputed.add(key)
      }
      let foundDependency = true
      while (foundDependency) {
        foundDependency = false
        for (const key of computeFunctions.keys()) {
          if (affectedComputed.has(key)) continue
          const dependencies = this.computedDependencies.get(key)
          if (dependencies && Array.from(dependencies).some((dependency) => changedKeys.has(dependency))) {
            affectedComputed.add(key)
            changedKeys.add(key)
            foundDependency = true
          }
        }
      }
    } else {
      for (const key of computeFunctions.keys()) affectedComputed.add(key)
    }

    if (affectedComputed.size === 0) return { values, changedPaths: [] }

    const resolved = new Map<string, unknown>()
    const resolving: string[] = []
    const nextDependencies = new Map<string, Set<string>>()
    const readonlyProxies = new WeakMap<object, object>()
    const readonlyTargets = new WeakMap<object, object>()

    const readonlyValue = (value: unknown): unknown => {
      if (value === null || typeof value !== 'object' || !isProxyableObject(value)) {
        return value
      }

      const cached = readonlyProxies.get(value)
      if (cached) return cached

      const proxy = new Proxy(value, {
        get: (target, property, receiver) =>
          readonlyValue(Reflect.get(target, property, receiver)),
        set: () => {
          throw new Error('Computed fields must not mutate form values')
        },
        deleteProperty: () => {
          throw new Error('Computed fields must not mutate form values')
        },
        defineProperty: () => {
          throw new Error('Computed fields must not mutate form values')
        },
      })
      readonlyProxies.set(value, proxy)
      readonlyTargets.set(proxy, value)
      return proxy
    }

    const unwrapReadonly = (
      value: unknown,
      seen = new WeakMap<object, unknown>()
    ): unknown => {
      if (value === null || typeof value !== 'object') return value
      const directTarget = readonlyTargets.get(value)
      if (directTarget) return directTarget
      if (!isProxyableObject(value)) return value

      const cached = seen.get(value)
      if (cached) return cached

      const clone: Record<string, unknown> | unknown[] = Array.isArray(value) ? [] : {}
      seen.set(value, clone)
      for (const [key, entry] of Object.entries(value)) {
        ;(clone as Record<string, unknown>)[key] = unwrapReadonly(entry, seen)
      }
      return clone
    }

    let computedValues!: Values
    const resolveComputed = (key: string): unknown => {
      if (resolved.has(key)) return resolved.get(key)

      const cycleStart = resolving.indexOf(key)
      if (cycleStart !== -1) {
        const cycle = [...resolving.slice(cycleStart), key].join(' -> ')
        throw new Error(`Circular computed field dependency: ${cycle}`)
      }

      const compute = computeFunctions.get(key)
      if (!compute || !affectedComputed.has(key)) {
        return (values as Record<string, unknown>)[key]
      }

      resolving.push(key)
      nextDependencies.set(key, new Set())
      try {
        const result = unwrapReadonly(compute(computedValues))
        if (
          result !== null &&
          (typeof result === 'object' || typeof result === 'function') &&
          typeof (result as { then?: unknown }).then === 'function'
        ) {
          throw new Error(`Computed field "${key}" returned a Promise`)
        }
        resolved.set(key, result)
        return result
      } finally {
        resolving.pop()
      }
    }

    computedValues = new Proxy(values, {
      get: (target, property, receiver) => {
        const activeKey = resolving[resolving.length - 1]
        if (activeKey && typeof property === 'string') {
          nextDependencies.get(activeKey)?.add(property)
        }
        if (typeof property === 'string' && computeFunctions.has(property)) {
          return readonlyValue(resolveComputed(property))
        }
        return readonlyValue(Reflect.get(target, property, receiver))
      },
      set: () => {
        throw new Error('Computed fields must not mutate form values')
      },
      deleteProperty: () => {
        throw new Error('Computed fields must not mutate form values')
      },
      defineProperty: () => {
        throw new Error('Computed fields must not mutate form values')
      },
    }) as Values

    for (const key of affectedComputed) resolveComputed(key)

    let nextValues = values
    const changedPaths: string[] = []
    for (const [key, computedValue] of resolved) {
      if (!isDeepEqual((values as Record<string, unknown>)[key], computedValue)) {
        if (nextValues === values) {
          nextValues = { ...values }
        }
        ;(nextValues as Record<string, unknown>)[key] = computedValue
        changedPaths.push(key)
      }
    }

    for (const [key, dependencies] of nextDependencies) {
      this.computedDependencies.set(key, dependencies)
    }

    return { values: nextValues, changedPaths }
  }

  private getPathAndAncestors(path: string): string[] {
    const segments = path.split('.')
    const paths: string[] = []
    for (let index = 1; index <= segments.length; index++) {
      paths.push(segments.slice(0, index).join('.'))
    }
    return paths
  }

  private addDirtyLeaf(path: string): void {
    if (this.dirtyLeafPaths.has(path)) return
    this.dirtyLeafPaths.add(path)
    for (const ancestor of this.getPathAndAncestors(path)) {
      this.dirtyPathCounts.set(ancestor, (this.dirtyPathCounts.get(ancestor) ?? 0) + 1)
    }
  }

  private removeDirtyLeaf(path: string): void {
    if (!this.dirtyLeafPaths.delete(path)) return
    for (const ancestor of this.getPathAndAncestors(path)) {
      const nextCount = (this.dirtyPathCounts.get(ancestor) ?? 1) - 1
      if (nextCount === 0) {
        this.dirtyPathCounts.delete(ancestor)
      } else {
        this.dirtyPathCounts.set(ancestor, nextCount)
      }
    }
  }

  private collectDirtyLeaves(
    current: unknown,
    initial: unknown,
    path: string,
    output: string[]
  ): void {
    if (isDeepEqual(current, initial)) return

    const currentIsArray = Array.isArray(current)
    const initialIsArray = Array.isArray(initial)
    const currentIsRecord =
      current !== null && typeof current === 'object' && isProxyableObject(current)
    const initialIsRecord =
      initial !== null && typeof initial === 'object' && isProxyableObject(initial)

    if (
      currentIsRecord &&
      initialIsRecord &&
      currentIsArray === initialIsArray
    ) {
      const keys = new Set([
        ...Object.keys(current as Record<string, unknown>),
        ...Object.keys(initial as Record<string, unknown>),
      ])
      if (keys.size > 0) {
        for (const key of keys) {
          const childPath = path ? `${path}.${key}` : key
          this.collectDirtyLeaves(
            (current as Record<string, unknown>)[key],
            (initial as Record<string, unknown>)[key],
            childPath,
            output
          )
        }
        return
      }
    }

    if (path) output.push(path)
  }

  private refreshDirtySubtree(path: string): void {
    const current = getValueByPath(this.values, path)
    const initial = getValueByPath(this.initialValues, path)
    const canContainDirtyChildren = [current, initial].some(
      (value) =>
        value !== null &&
        typeof value === 'object' &&
        isProxyableObject(value)
    )

    if (canContainDirtyChildren) {
      const prefix = `${path}.`
      for (const dirtyPath of Array.from(this.dirtyLeafPaths)) {
        if (dirtyPath === path || dirtyPath.startsWith(prefix)) {
          this.removeDirtyLeaf(dirtyPath)
        }
      }
    } else {
      this.removeDirtyLeaf(path)
    }

    const dirtyLeaves: string[] = []
    this.collectDirtyLeaves(
      current,
      initial,
      path,
      dirtyLeaves
    )
    for (const dirtyPath of dirtyLeaves) this.addDirtyLeaf(dirtyPath)
  }

  private addSubscriptionPath(path: string): void {
    let node = this.subscriptionRoot
    for (const segment of path.split('.')) {
      let child = node.children.get(segment)
      if (!child) {
        child = createSubscriptionNode()
        node.children.set(segment, child)
      }
      node = child
    }
    node.path = path
  }

  private removeSubscriptionPath(path: string): void {
    const stack: Array<[SubscriptionNode, string]> = []
    let node = this.subscriptionRoot
    for (const segment of path.split('.')) {
      const child = node.children.get(segment)
      if (!child) return
      stack.push([node, segment])
      node = child
    }
    delete node.path

    for (let index = stack.length - 1; index >= 0; index--) {
      const entry = stack[index]
      if (!entry || node.path || node.children.size > 0) break
      const [parent, segment] = entry
      parent.children.delete(segment)
      node = parent
    }
  }

  private collectSubscriptionSubtree(node: SubscriptionNode, output: Set<string>): void {
    if (node.path) output.add(node.path)
    for (const child of node.children.values()) {
      this.collectSubscriptionSubtree(child, output)
    }
  }

  private getAffectedSubscriptionPaths(path: string, output: Set<string>): void {
    let node: SubscriptionNode | undefined = this.subscriptionRoot
    for (const segment of path.split('.')) {
      node = node.children.get(segment)
      if (!node) return
      if (node.path) output.add(node.path)
    }
    this.collectSubscriptionSubtree(node, output)
  }

  private queueNotification(
    paths: Iterable<string>,
    slices: Iterable<FormStoreSlice>
  ): void {
    for (const path of paths) this.pendingNotificationPaths.add(path)
    for (const slice of slices) this.pendingSlices.add(slice)
    if (this.batchDepth === 0) this.flushNotifications()
  }

  private flushNotifications(): void {
    if (this.isFlushingNotifications || this.batchDepth > 0) return
    this.isFlushingNotifications = true
    try {
      while (this.pendingNotificationPaths.size > 0 || this.pendingSlices.size > 0) {
        const paths = new Set(this.pendingNotificationPaths)
        const slices = new Set(this.pendingSlices)
        this.pendingNotificationPaths.clear()
        this.pendingSlices.clear()

        const affectedSubscriptions = new Set<string>()
        for (const path of paths) {
          this.getAffectedSubscriptionPaths(path, affectedSubscriptions)
        }
        for (const path of affectedSubscriptions) {
          this.notifySubscribers(path as Path<Values>)
        }

        if (slices.size > 0) {
          this.version++
          for (const callback of this.globalSubscribers) callback(slices)
        }
      }
    } finally {
      this.isFlushingNotifications = false
    }
  }

  batch<Result>(callback: () => Result): Result {
    this.batchDepth++
    try {
      return callback()
    } finally {
      this.batchDepth--
      if (this.batchDepth === 0) this.flushNotifications()
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
    if (isDeepEqual(this.getValue(name), value)) return

    const candidate = setValueByPath(this.values, name, value)
    const computed = this.applyComputedFields(candidate, [name])
    this.values = computed.values

    const changedPaths = new Set<string>([name, ...computed.changedPaths])
    const wasDirty = this.isDirty()
    for (const path of changedPaths) {
      this.refreshDirtySubtree(path)
    }
    const dirtyChanged = wasDirty !== this.isDirty()

    this.queueNotification(
      changedPaths,
      dirtyChanged ? ['values', 'dirty'] : ['values']
    )
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
    if (this.errors[name] === error) return
    const wasValid = this.isValid()

    if (error === undefined) {
      delete this.errors[name]
    } else {
      this.errors[name] = error
      this.validatedFields.add(name)
    }
    this.queueNotification(
      [name],
      wasValid === this.isValid() ? ['errors'] : ['errors', 'valid']
    )
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
    if (this.getTouched(name) === touched) return

    if (touched) {
      this.touched[name] = true
    } else {
      delete this.touched[name]
    }
    this.queueNotification([name], ['touched'])
  }

  /**
   * Get complete field state
   */
  getFieldState<P extends Path<Values>>(name: P): FieldState<ValueAtPath<Values, P>> {
    const value = this.getValue(name)

    const nextSnapshot: FieldState<ValueAtPath<Values, P>> = {
      value,
      error: this.getError(name),
      touched: this.getTouched(name),
      dirty: this.dirtyPathCounts.has(name),
      isValidating: this.isFieldValidating(name),
    }

    const cached = this.fieldSnapshots.get(name)
    if (
      cached &&
      Object.is(cached.value, nextSnapshot.value) &&
      cached.error === nextSnapshot.error &&
      cached.touched === nextSnapshot.touched &&
      cached.dirty === nextSnapshot.dirty &&
      cached.isValidating === nextSnapshot.isValidating
    ) {
      return cached as FieldState<ValueAtPath<Values, P>>
    }

    this.fieldSnapshots.set(name, nextSnapshot as FieldState<unknown>)
    return nextSnapshot
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
    if (callbacks.size === 1) this.addSubscriptionPath(name)

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(name)
      if (callbacks) {
        callbacks.delete(callback as SubscriptionCallback<unknown>)
        if (callbacks.size === 0) {
          this.subscriptions.delete(name)
          this.removeSubscriptionPath(name)
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
   * Replace validation errors and optionally touch fields in one notification.
   */
  replaceErrors(
    errors: Partial<Record<Path<Values>, string>>,
    touchedFields: Path<Values>[] = []
  ): void {
    const wasValid = this.isValid()
    const nextErrors = { ...errors }
    const errorPaths = new Set<string>([
      ...Object.keys(this.errors),
      ...Object.keys(nextErrors),
    ])
    const changedErrorPaths = Array.from(errorPaths).filter(
      (path) =>
        this.errors[path as Path<Values>] !== nextErrors[path as Path<Values>]
    )
    const newlyTouchedPaths = touchedFields.filter((name) => !this.getTouched(name))

    this.errors = nextErrors
    for (const name of Object.keys(nextErrors)) this.validatedFields.add(name)
    for (const name of touchedFields) {
      this.touched[name] = true
      this.validatedFields.add(name)
    }

    const slices: FormStoreSlice[] = []
    if (changedErrorPaths.length > 0) slices.push('errors')
    if (wasValid !== this.isValid()) slices.push('valid')
    if (newlyTouchedPaths.length > 0) slices.push('touched')
    this.queueNotification(
      [...changedErrorPaths, ...newlyTouchedPaths],
      slices
    )
  }

  /**
   * Subscribe to any store change (for form-level re-renders)
   */
  subscribeToStore(callback: StoreSubscriptionCallback): () => void {
    this.globalSubscribers.add(callback)

    return () => {
      this.globalSubscribers.delete(callback)
    }
  }

  /**
   * Start async validation for a field
   */
  startValidation<P extends Path<Values>>(name: P): AbortController {
    // Cancel any pending validation for this field without emitting an
    // intermediate non-validating state.
    this.pendingValidations.get(name)?.abort()

    // Create new abort controller
    const controller = new AbortController()
    this.pendingValidations.set(name, controller)
    this.validatedFields.add(name)

    // Mark field as validating
    const wasAnyFieldValidating = this.isValidating()
    const wasValidating = this.validatingFields.has(name)
    this.validatingFields.add(name)
    if (!wasValidating) {
      this.queueNotification(
        [name],
        wasAnyFieldValidating ? [] : ['validating']
      )
    }

    return controller
  }

  /**
   * End async validation for a field
   */
  endValidation<P extends Path<Values>>(name: P, controller?: AbortController): void {
    if (controller && this.pendingValidations.get(name) !== controller) return

    const wasValidating = this.validatingFields.delete(name)
    this.pendingValidations.delete(name)
    if (wasValidating) {
      this.queueNotification(
        [name],
        this.isValidating() ? [] : ['validating']
      )
    }
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
      this.queueNotification(
        [name],
        this.isValidating() ? [] : ['validating']
      )
    }
  }

  /**
   * Return whether a validation result still belongs to the latest run.
   */
  isValidationCurrent<P extends Path<Values>>(
    name: P,
    controller: AbortController
  ): boolean {
    return this.pendingValidations.get(name) === controller && !controller.signal.aborted
  }

  /**
   * Check whether a field has already been validated.
   */
  hasValidated<P extends Path<Values>>(name: P): boolean {
    return this.validatedFields.has(name)
  }

  /**
   * Mark a field as validated when it has no configured validators.
   */
  markValidated<P extends Path<Values>>(name: P): void {
    this.validatedFields.add(name)
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
   * Update an array and remap state from old indices to new indices.
   * Each entry contains the old index represented by the corresponding new index.
   */
  setArrayValue<P extends Path<Values>>(
    name: P,
    values: ValueAtPath<Values, P>,
    newToOldIndices: Array<number | undefined>
  ): void {
    const arrayPath = String(name)
    const prefix = `${arrayPath}.`
    const wasAnyFieldValidating = this.isValidating()
    let validationChanged = false

    for (const [path, controller] of this.pendingValidations) {
      if (path.startsWith(prefix)) {
        controller.abort()
        this.pendingValidations.delete(path)
        validationChanged = this.validatingFields.delete(path) || validationChanged
      }
    }

    const remapPath = (path: string): string | undefined => {
      if (!path.startsWith(prefix)) return path

      const suffix = path.slice(prefix.length)
      const [indexSegment, ...rest] = suffix.split('.')
      if (!indexSegment || !/^\d+$/.test(indexSegment)) return path

      const newIndex = newToOldIndices.indexOf(Number(indexSegment))
      if (newIndex === -1) return undefined
      return `${arrayPath}.${newIndex}${rest.length > 0 ? `.${rest.join('.')}` : ''}`
    }

    const remapRecord = <T>(record: Partial<Record<Path<Values>, T>>) => {
      const next: Partial<Record<Path<Values>, T>> = {}
      for (const [path, entry] of Object.entries(record) as Array<
        [string, T | undefined]
      >) {
        const remappedPath = remapPath(path)
        if (remappedPath !== undefined && entry !== undefined) {
          next[remappedPath as Path<Values>] = entry
        }
      }
      return next
    }

    const nextValidatedFields = new Set<string>()
    for (const path of this.validatedFields) {
      const remappedPath = remapPath(path)
      if (remappedPath !== undefined) nextValidatedFields.add(remappedPath)
    }

    const nextErrors = remapRecord(this.errors)
    const nextTouched = remapRecord(this.touched)
    const errorsChanged = !isDeepEqual(this.errors, nextErrors)
    const wasValid = this.isValid()
    const touchedChanged = !isDeepEqual(this.touched, nextTouched)

    const candidate = setValueByPath(this.values, arrayPath, values)
    const computed = this.applyComputedFields(candidate, [arrayPath])

    this.errors = nextErrors
    this.touched = nextTouched
    this.validatedFields = nextValidatedFields
    this.values = computed.values

    const changedPaths = new Set([arrayPath, ...computed.changedPaths])
    const wasDirty = this.isDirty()
    for (const path of changedPaths) {
      this.refreshDirtySubtree(path)
    }
    const dirtyChanged = wasDirty !== this.isDirty()

    const slices: FormStoreSlice[] = ['values']
    if (dirtyChanged) slices.push('dirty')
    if (errorsChanged) slices.push('errors')
    if (wasValid !== this.isValid()) slices.push('valid')
    if (touchedChanged) slices.push('touched')
    if (validationChanged && wasAnyFieldValidating !== this.isValidating()) {
      slices.push('validating')
    }
    this.queueNotification(changedPaths, slices)
  }

  /**
   * Acquire the synchronous submission lock and update submission state.
   */
  startSubmission(): object | undefined {
    if (this.activeSubmission) return undefined
    const token = {}
    this.activeSubmission = token
    this.submitCount++
    this.queueNotification([], ['submission'])
    return token
  }

  /**
   * Release a submission only if the token still owns the lock.
   */
  endSubmission(token: object): void {
    if (this.activeSubmission !== token) return
    this.activeSubmission = undefined
    this.queueNotification([], ['submission'])
  }

  isSubmitting(): boolean {
    return this.activeSubmission !== undefined
  }

  getSubmitCount(): number {
    return this.submitCount
  }

  /**
   * Reset form to initial values
   */
  reset(newInitialValues?: Partial<Values>): void {
    const mergedInitialValues = newInitialValues
      ? { ...this.initialValues, ...newInitialValues }
      : this.initialValues
    const resetValues = this.applyComputedFields(
      structuredClone(mergedInitialValues)
    ).values
    const subscribedPaths = Array.from(this.subscriptions.keys())

    for (const controller of this.pendingValidations.values()) {
      controller.abort()
    }
    this.pendingValidations.clear()
    this.validatingFields.clear()
    this.validatedFields.clear()

    this.values = resetValues
    this.initialValues = structuredClone(resetValues)
    this.errors = {}
    this.touched = {}
    this.dirtyLeafPaths.clear()
    this.dirtyPathCounts.clear()
    this.activeSubmission = undefined
    this.submitCount = 0

    this.queueNotification(subscribedPaths, [
      'values',
      'errors',
      'valid',
      'touched',
      'dirty',
      'validating',
      'submission',
    ])
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
    return this.dirtyLeafPaths.size > 0
  }

  /**
   * Check if form is valid (no errors)
   */
  isValid(): boolean {
    return Object.keys(this.errors).length === 0
  }
}
