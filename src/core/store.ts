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

import type {
  DeepReadonly,
  Path,
  ValueAtPath,
  FieldState,
  SubscriptionCallback,
  SupportedFormValues,
  Unsubscribe,
} from '../types.js'
import {
  cloneFormValue,
  copyEnumerableArrayMetadata,
  createCachedImmutableSnapshot,
  createCachedLazyImmutableSnapshot,
  createLazyImmutableSnapshot,
  registerEnumerableArrayMetadataKey,
} from '../utils/immutable.js'

export type FormStoreSlice =
  | 'values'
  | 'errors'
  | 'valid'
  | 'touched'
  | 'dirty'
  | 'validating'
  | 'submission'

type StoreSubscriptionCallback = (changedSlices: ReadonlySet<FormStoreSlice>) => void
type InternalFieldSubscriptionCallback = () => void

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

function cloneShallowContainer(
  current: object
): Record<PropertyKey, unknown> | unknown[] {
  const prototype = Object.getPrototypeOf(current)
  if (Array.isArray(current)) {
    const clone = current.slice()
    copyEnumerableArrayMetadata(current, clone)
    return clone
  }
  if (prototype === Object.prototype) {
    return { ...(current as Record<PropertyKey, unknown>) }
  }
  if (prototype === null) {
    return Object.assign(
      Object.create(null) as Record<PropertyKey, unknown>,
      current
    )
  }

  const clone = Object.create(prototype) as Record<PropertyKey, unknown>
  for (const property of Reflect.ownKeys(current)) {
    if (!Object.prototype.propertyIsEnumerable.call(current, property)) continue
    Object.defineProperty(clone, property, {
      configurable: true,
      enumerable: true,
      value: Reflect.get(current, property),
      writable: true,
    })
  }
  return clone
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

  const setAtPath = (current: unknown, index: number): unknown => {
    const key = keys[index]
    if (key === undefined) return current
    if (Array.isArray(current) && !isCanonicalArrayIndex(key)) {
      throw new Error(`Invalid array index in form field path: ${key}`)
    }
    if (
      current !== null &&
      current !== undefined &&
      typeof current !== 'object' &&
      keys.length > 1
    ) {
      throw new Error(`Cannot traverse non-object form field path: ${path}`)
    }

    const clone: Record<PropertyKey, unknown> | unknown[] =
      current !== null && typeof current === 'object'
        ? cloneShallowContainer(current)
        : isCanonicalArrayIndex(key)
          ? []
          : {}

    if (index === keys.length - 1) {
      ;(clone as Record<string, unknown>)[key] = value
      if (Array.isArray(clone)) registerEnumerableArrayMetadataKey(clone, key)
      return clone
    }

    const nextKey = keys[index + 1]
    const currentChild =
      current !== null && typeof current === 'object'
        ? (current as Record<string, unknown>)[key]
        : undefined
    const fallback = nextKey !== undefined && isCanonicalArrayIndex(nextKey) ? [] : {}
    ;(clone as Record<string, unknown>)[key] = setAtPath(currentChild ?? fallback, index + 1)
    return clone
  }

  return setAtPath(obj, 0) as T
}

function isProxyableObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value)
  return Array.isArray(value) || prototype === Object.prototype || prototype === null
}

function cloneIngressValue<Value>(value: Value): Value {
  return cloneFormValue(value)
}

function isPrimitiveValue(value: unknown): boolean {
  return value === null || (typeof value !== 'object' && typeof value !== 'function')
}

interface EqualityBucketContext {
  nextPrototypeId: number
  nextSymbolId: number
  prototypeIds: WeakMap<object, number>
  symbolIds: Map<symbol, number>
}

function createEqualityBucketContext(): EqualityBucketContext {
  return {
    nextPrototypeId: 1,
    nextSymbolId: 1,
    prototypeIds: new WeakMap(),
    symbolIds: new Map(),
  }
}

const IS_LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1

function getBinaryEqualityHash(
  buffer: ArrayBufferLike,
  byteOffset: number,
  byteLength: number
): string {
  let hash = 2166136261
  const wordLength = Math.floor(byteLength / 4)
  const wordBytes = wordLength * 4
  if (byteOffset % 4 === 0) {
    const words = new Uint32Array(buffer, byteOffset, wordLength)
    for (let index = 0; index < words.length; index++) {
      hash = Math.imul(hash ^ (words[index] ?? 0), 16777619)
    }
  } else {
    const view = new DataView(buffer, byteOffset, wordBytes)
    for (let index = 0; index < wordBytes; index += 4) {
      hash = Math.imul(hash ^ view.getUint32(index, IS_LITTLE_ENDIAN), 16777619)
    }
  }
  const tail = new Uint8Array(buffer, byteOffset + wordBytes, byteLength - wordBytes)
  for (const byte of tail) hash = Math.imul(hash ^ byte, 16777619)
  return (hash >>> 0).toString(36)
}

function getEqualityBucket(
  value: unknown,
  context: EqualityBucketContext,
  active = new WeakSet<object>()
): string {
  if (value === null) return 'null'
  switch (typeof value) {
    case 'undefined': return 'undefined'
    case 'boolean': return value ? 'boolean:1' : 'boolean:0'
    case 'number':
      return Number.isNaN(value)
        ? 'number:NaN'
        : Object.is(value, -0)
          ? 'number:-0'
          : `number:${value}`
    case 'bigint': return `bigint:${value}`
    case 'string': return `string:${JSON.stringify(value)}`
    case 'symbol': {
      let id = context.symbolIds.get(value)
      if (id === undefined) {
        id = context.nextSymbolId++
        context.symbolIds.set(value, id)
      }
      return `symbol:${id}`
    }
    case 'function': return 'function'
  }

  const prototype = Object.getPrototypeOf(value) as object | null
  let prototypeId = 0
  if (prototype) {
    const existingId = context.prototypeIds.get(prototype)
    if (existingId !== undefined) {
      prototypeId = existingId
    } else {
      prototypeId = context.nextPrototypeId++
      context.prototypeIds.set(prototype, prototypeId)
    }
  }

  let base = `object:${prototypeId}`
  if (value instanceof Date) base = `date:${value.getTime()}:${prototypeId}`
  else if (value instanceof RegExp) {
    base = `regexp:${value.source}:${value.flags}:${value.lastIndex}:${prototypeId}`
  } else if (value instanceof Error) {
    base = `error:${value.name}:${value.message}:${value.stack ?? ''}:${prototypeId}`
  } else if (value instanceof Map) base = `map:${value.size}:${prototypeId}`
  else if (value instanceof Set) base = `set:${value.size}:${prototypeId}`
  else if (value instanceof ArrayBuffer) {
    base = `buffer:${value.byteLength}:${getBinaryEqualityHash(
      value,
      0,
      value.byteLength
    )}:${prototypeId}`
  } else if (ArrayBuffer.isView(value)) {
    base = `view:${value.byteLength}:${getBinaryEqualityHash(
      value.buffer,
      value.byteOffset,
      value.byteLength
    )}:${prototypeId}`
  } else if (Array.isArray(value)) base = `array:${value.length}:${prototypeId}`

  if (active.has(value)) return base
  active.add(value)
  let semanticEntries: string[] = []
  if (value instanceof Error && 'cause' in value) {
    semanticEntries = [
      `cause=${getEqualityBucket(value.cause, context, active)}`,
    ]
  } else if (value instanceof Map) {
    semanticEntries = Array.from(value.entries(), ([key, entry]) =>
      `${getEqualityBucket(key, context, active)}=>${getEqualityBucket(
        entry,
        context,
        active
      )}`
    ).sort()
  } else if (value instanceof Set) {
    semanticEntries = Array.from(value, (entry) =>
      getEqualityBucket(entry, context, active)
    ).sort()
  }
  const keys = (ArrayBuffer.isView(value)
    ? Object.getOwnPropertySymbols(value)
    : Reflect.ownKeys(value)
  )
    .filter((key) => Object.prototype.propertyIsEnumerable.call(value, key))
    .map((key) => {
      if (typeof key === 'string') return { key, token: `key:${JSON.stringify(key)}` }
      let id = context.symbolIds.get(key)
      if (id === undefined) {
        id = context.nextSymbolId++
        context.symbolIds.set(key, id)
      }
      return { key, token: `symbol-key:${id}` }
    })
    .sort((left, right) => left.token.localeCompare(right.token))
  const properties = keys.map(({ key, token }) =>
    `${token}=${getEqualityBucket(
      (value as Record<PropertyKey, unknown>)[key],
      context,
      active
    )}`
  )
  active.delete(value)
  return `${base}[${semanticEntries.join('|')}]{${properties.join('|')}}`
}

function areBinaryRegionsEqual(
  leftBuffer: ArrayBufferLike,
  leftOffset: number,
  rightBuffer: ArrayBufferLike,
  rightOffset: number,
  byteLength: number
): boolean {
  const wordLength = Math.floor(byteLength / Uint32Array.BYTES_PER_ELEMENT)
  const wordBytes = wordLength * Uint32Array.BYTES_PER_ELEMENT

  if (leftOffset % 4 === 0 && rightOffset % 4 === 0) {
    const leftWords = new Uint32Array(leftBuffer, leftOffset, wordLength)
    const rightWords = new Uint32Array(rightBuffer, rightOffset, wordLength)
    for (let index = 0; index < wordLength; index++) {
      if (leftWords[index] !== rightWords[index]) return false
    }
  } else {
    const leftView = new DataView(leftBuffer, leftOffset, wordBytes)
    const rightView = new DataView(rightBuffer, rightOffset, wordBytes)
    for (let index = 0; index < wordBytes; index += 4) {
      if (leftView.getUint32(index) !== rightView.getUint32(index)) return false
    }
  }

  const leftTail = new Uint8Array(leftBuffer, leftOffset + wordBytes, byteLength - wordBytes)
  const rightTail = new Uint8Array(
    rightBuffer,
    rightOffset + wordBytes,
    byteLength - wordBytes
  )
  for (let index = 0; index < leftTail.length; index++) {
    if (leftTail[index] !== rightTail[index]) return false
  }
  return true
}

function isCanonicalArrayIndex(key: PropertyKey): boolean {
  return (
    typeof key === 'string' &&
    /^(0|[1-9]\d*)$/.test(key) &&
    Number(key) <= 4_294_967_294
  )
}

interface EqualityState {
  binaryBufferLeftToRight: WeakMap<object, object>
  binaryBufferMappings: Array<[object, object, number]>
  binaryBufferOffsetDeltas: WeakMap<object, number>
  binaryBufferRightToLeft: WeakMap<object, object>
  leftToRight: WeakMap<object, object>
  mappings: Array<[object, object]>
  parent?: EqualityState
  rightToLeft: WeakMap<object, object>
}

function createEqualityState(parent?: EqualityState): EqualityState {
  return parent
    ? {
        binaryBufferLeftToRight: new WeakMap(),
        binaryBufferMappings: [],
        binaryBufferOffsetDeltas: new WeakMap(),
        binaryBufferRightToLeft: new WeakMap(),
        leftToRight: new WeakMap(),
        mappings: [],
        parent,
        rightToLeft: new WeakMap(),
      }
    : {
        binaryBufferLeftToRight: new WeakMap(),
        binaryBufferMappings: [],
        binaryBufferOffsetDeltas: new WeakMap(),
        binaryBufferRightToLeft: new WeakMap(),
        leftToRight: new WeakMap(),
        mappings: [],
        rightToLeft: new WeakMap(),
      }
}

function getMappedBinaryBuffer(
  state: EqualityState,
  value: object,
  direction: 'left' | 'right'
): object | undefined {
  let current: EqualityState | undefined = state
  while (current) {
    const mapped = direction === 'left'
      ? current.binaryBufferLeftToRight.get(value)
      : current.binaryBufferRightToLeft.get(value)
    if (mapped !== undefined) return mapped
    current = current.parent
  }
  return undefined
}

function getBinaryBufferOffsetDelta(
  state: EqualityState,
  left: object
): number | undefined {
  let current: EqualityState | undefined = state
  while (current) {
    const delta = current.binaryBufferOffsetDeltas.get(left)
    if (delta !== undefined) return delta
    current = current.parent
  }
  return undefined
}

function mapBinaryBufferTopology(
  state: EqualityState,
  left: ArrayBufferLike,
  right: ArrayBufferLike,
  offsetDelta: number
): boolean {
  const leftObject = left as object
  const rightObject = right as object
  const mappedRight = getMappedBinaryBuffer(state, leftObject, 'left')
  if (mappedRight !== undefined) {
    return (
      mappedRight === rightObject &&
      getBinaryBufferOffsetDelta(state, leftObject) === offsetDelta
    )
  }
  const mappedLeft = getMappedBinaryBuffer(state, rightObject, 'right')
  if (mappedLeft !== undefined) return false
  state.binaryBufferLeftToRight.set(leftObject, rightObject)
  state.binaryBufferRightToLeft.set(rightObject, leftObject)
  state.binaryBufferOffsetDeltas.set(leftObject, offsetDelta)
  state.binaryBufferMappings.push([leftObject, rightObject, offsetDelta])
  return true
}

function getMappedEqualityObject(
  state: EqualityState,
  value: object,
  direction: 'left' | 'right'
): object | undefined {
  let current: EqualityState | undefined = state
  while (current) {
    const mapped = direction === 'left'
      ? current.leftToRight.get(value)
      : current.rightToLeft.get(value)
    if (mapped !== undefined) return mapped
    current = current.parent
  }
  return undefined
}

function addEqualityMapping(
  state: EqualityState,
  left: object,
  right: object
): void {
  state.leftToRight.set(left, right)
  state.rightToLeft.set(right, left)
  state.mappings.push([left, right])
}

function commitEqualityState(source: EqualityState, target: EqualityState): void {
  for (const [left, right] of source.mappings) {
    if (getMappedEqualityObject(target, left, 'left') === undefined) {
      addEqualityMapping(target, left, right)
    }
  }
  for (const [left, right, offsetDelta] of source.binaryBufferMappings) {
    if (getMappedBinaryBuffer(target, left, 'left') === undefined) {
      target.binaryBufferLeftToRight.set(left, right)
      target.binaryBufferRightToLeft.set(right, left)
      target.binaryBufferOffsetDeltas.set(left, offsetDelta)
      target.binaryBufferMappings.push([left, right, offsetDelta])
    }
  }
}

function haveEqualEnumerableProperties(
  left: object,
  right: object,
  seen: EqualityState,
  skipArrayIndices = false,
  symbolKeysOnly = false
): boolean {
  const leftKeys = (
    symbolKeysOnly ? Object.getOwnPropertySymbols(left) : Reflect.ownKeys(left)
  ).filter(
    (key) =>
      (!skipArrayIndices || !isCanonicalArrayIndex(key)) &&
      Object.prototype.propertyIsEnumerable.call(left, key)
  )
  const rightKeys = (
    symbolKeysOnly ? Object.getOwnPropertySymbols(right) : Reflect.ownKeys(right)
  ).filter(
    (key) =>
      (!skipArrayIndices || !isCanonicalArrayIndex(key)) &&
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

function isDeepEqual(
  left: unknown,
  right: unknown,
  seen = createEqualityState()
): boolean {
  if (Object.is(left, right)) {
    if (left !== null && typeof left === 'object') {
      if (
        left instanceof ArrayBuffer &&
        !mapBinaryBufferTopology(seen, left, right as ArrayBuffer, 0)
      ) {
        return false
      }
      if (
        ArrayBuffer.isView(left) &&
        !mapBinaryBufferTopology(
          seen,
          left.buffer,
          (right as ArrayBufferView).buffer,
          0
        )
      ) {
        return false
      }
      const mappedRight = getMappedEqualityObject(seen, left, 'left')
      if (mappedRight !== undefined) return mappedRight === right
      const mappedLeft = getMappedEqualityObject(seen, right as object, 'right')
      if (mappedLeft !== undefined) return mappedLeft === left
      addEqualityMapping(seen, left, right as object)
    }
    return true
  }
  if (
    left === null ||
    right === null ||
    typeof left !== 'object' ||
    typeof right !== 'object'
  ) {
    return false
  }

  const mappedRight = getMappedEqualityObject(seen, left, 'left')
  if (mappedRight !== undefined) return mappedRight === right
  const mappedLeft = getMappedEqualityObject(seen, right, 'right')
  if (mappedLeft !== undefined) return mappedLeft === left
  addEqualityMapping(seen, left, right)

  if (left instanceof Date || right instanceof Date) {
    return (
      left instanceof Date &&
      right instanceof Date &&
      Object.getPrototypeOf(left) === Object.getPrototypeOf(right) &&
      Object.is(left.getTime(), right.getTime()) &&
      haveEqualEnumerableProperties(left, right, seen)
    )
  }
  if (left instanceof RegExp || right instanceof RegExp) {
    return (
      left instanceof RegExp &&
      right instanceof RegExp &&
      Object.getPrototypeOf(left) === Object.getPrototypeOf(right) &&
      left.source === right.source &&
      left.flags === right.flags &&
      left.lastIndex === right.lastIndex &&
      haveEqualEnumerableProperties(left, right, seen)
    )
  }
  if (left instanceof Error || right instanceof Error) {
    if (!(left instanceof Error) || !(right instanceof Error)) return false
    if (
      Object.getPrototypeOf(left) !== Object.getPrototypeOf(right) ||
      left.name !== right.name ||
      left.message !== right.message ||
      left.stack !== right.stack ||
      !isDeepEqual(left.cause, right.cause, seen)
    ) {
      return false
    }
  }
  if (left instanceof ArrayBuffer || right instanceof ArrayBuffer) {
    if (!(left instanceof ArrayBuffer) || !(right instanceof ArrayBuffer)) return false
    if (!mapBinaryBufferTopology(seen, left, right, 0)) return false
    if (left.byteLength !== right.byteLength) return false
    return (
      areBinaryRegionsEqual(left, 0, right, 0, left.byteLength) &&
      haveEqualEnumerableProperties(left, right, seen)
    )
  }
  if (ArrayBuffer.isView(left) || ArrayBuffer.isView(right)) {
    if (!ArrayBuffer.isView(left) || !ArrayBuffer.isView(right)) return false
    if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) return false
    if (left.byteLength !== right.byteLength) return false
    if (
      !mapBinaryBufferTopology(
        seen,
        left.buffer,
        right.buffer,
        right.byteOffset - left.byteOffset
      )
    ) {
      return false
    }
    return (
      areBinaryRegionsEqual(
        left.buffer,
        left.byteOffset,
        right.buffer,
        right.byteOffset,
        left.byteLength
      ) &&
      haveEqualEnumerableProperties(left, right, seen, true, true)
    )
  }
  if (left instanceof Map || right instanceof Map) {
    if (
      !(left instanceof Map) ||
      !(right instanceof Map) ||
      Object.getPrototypeOf(left) !== Object.getPrototypeOf(right) ||
      left.size !== right.size
    ) {
      return false
    }
    const leftEntries = Array.from(left.entries())
    const primitiveKeys = leftEntries.every(([key]) => isPrimitiveValue(key))
    const entriesEqual = primitiveKeys
      ? leftEntries.every(([leftKey, leftValue]) => {
          if (!right.has(leftKey)) return false
          const candidateSeen = createEqualityState(seen)
          if (!isDeepEqual(leftValue, right.get(leftKey), candidateSeen)) {
            return false
          }
          commitEqualityState(candidateSeen, seen)
          return true
        })
      : (() => {
          const bucketContext = createEqualityBucketContext()
          const unmatched = new Map<string, Array<[unknown, unknown]>>()
          for (const entry of right.entries()) {
            const bucket = getEqualityBucket(entry[0], bucketContext)
            const entries = unmatched.get(bucket) ?? []
            entries.push(entry)
            unmatched.set(bucket, entries)
          }
          return leftEntries.every(([leftKey, leftValue]) => {
            const bucket = getEqualityBucket(leftKey, bucketContext)
            const candidates = unmatched.get(bucket)
            if (!candidates) return false
            let matchedState: EqualityState | undefined
            const index = candidates.findIndex(([rightKey, rightValue]) => {
              const candidateSeen = createEqualityState(seen)
              const matches = (
                isDeepEqual(leftKey, rightKey, candidateSeen) &&
                isDeepEqual(leftValue, rightValue, candidateSeen)
              )
              if (matches) matchedState = candidateSeen
              return matches
            })
            if (index === -1) return false
            if (matchedState) commitEqualityState(matchedState, seen)
            const last = candidates.pop()
            if (index < candidates.length && last) candidates[index] = last
            if (candidates.length === 0) unmatched.delete(bucket)
            return true
          })
        })()
    return entriesEqual && haveEqualEnumerableProperties(left, right, seen)
  }
  if (left instanceof Set || right instanceof Set) {
    if (
      !(left instanceof Set) ||
      !(right instanceof Set) ||
      Object.getPrototypeOf(left) !== Object.getPrototypeOf(right) ||
      left.size !== right.size
    ) {
      return false
    }
    const leftValues = Array.from(left.values())
    const entriesEqual = leftValues.every(isPrimitiveValue)
      ? leftValues.every((leftValue) => right.has(leftValue))
      : (() => {
          const bucketContext = createEqualityBucketContext()
          const unmatched = new Map<string, unknown[]>()
          for (const entry of right.values()) {
            const bucket = getEqualityBucket(entry, bucketContext)
            const entries = unmatched.get(bucket) ?? []
            entries.push(entry)
            unmatched.set(bucket, entries)
          }
          return leftValues.every((leftValue) => {
            const bucket = getEqualityBucket(leftValue, bucketContext)
            const candidates = unmatched.get(bucket)
            if (!candidates) return false
            let matchedState: EqualityState | undefined
            const index = candidates.findIndex((rightValue) => {
              const candidateSeen = createEqualityState(seen)
              const matches = isDeepEqual(leftValue, rightValue, candidateSeen)
              if (matches) matchedState = candidateSeen
              return matches
            })
            if (index === -1) return false
            if (matchedState) commitEqualityState(matchedState, seen)
            const last = candidates.pop()
            if (index < candidates.length && last !== undefined) {
              candidates[index] = last
            }
            if (candidates.length === 0) unmatched.delete(bucket)
            return true
          })
        })()
    return entriesEqual && haveEqualEnumerableProperties(left, right, seen)
  }

  if (typeof Blob !== 'undefined' && (left instanceof Blob || right instanceof Blob)) {
    // Blob content cannot be compared synchronously. Distinct instances must
    // be treated as changes even when their metadata is identical.
    return false
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false
    }
  }

  if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) return false
  return haveEqualEnumerableProperties(left, right, seen)
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
  private internalFieldSubscriptions: Map<
    string,
    Set<InternalFieldSubscriptionCallback>
  > = new Map()
  private subscriptionRoot: SubscriptionNode = createSubscriptionNode()
  private globalSubscribers: Set<StoreSubscriptionCallback> = new Set()
  private fieldSnapshots: Map<string, FieldState<unknown>> = new Map()
  private exposedValuesSource: Values | undefined
  private exposedValuesSnapshot: Values | undefined
  private exposedFieldSnapshots: WeakMap<object, FieldState<unknown>> = new WeakMap()
  private validatedFields: Set<string> = new Set()
  private dirtyLeafPaths: Set<string> = new Set()
  private dirtyPathCounts: Map<string, number> = new Map()
  private version = 0
  private computedFields: Partial<
    Record<keyof Values, (values: DeepReadonly<Values>) => unknown>
  > = {}
  private computedDependencies: Map<string, Set<string>> = new Map()
  private batchDepth = 0
  private pendingNotificationPaths: Set<string> = new Set()
  private pendingSlices: Set<FormStoreSlice> = new Set()
  private isFlushingNotifications = false
  private activeSubmission: object | undefined
  private submitCount = 0
  private errorRevision = 0
  private fieldErrorRevisions: Map<string, number> = new Map()
  private validationErrorRevisions: WeakMap<AbortController, number> = new WeakMap()

  constructor(
    initialValues: SupportedFormValues<Values>,
    computed?: Partial<Record<keyof Values, (values: DeepReadonly<Values>) => unknown>>
  ) {
    this.computedFields = computed ? { ...computed } : {}
    const initialClone = cloneFormValue(initialValues) as Values
    this.values = this.applyComputedFields(initialClone).values
    this.initialValues = this.values
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
      [string, ((values: DeepReadonly<Values>) => unknown) | undefined]
    >
    if (entries.length === 0) return { values, changedPaths: [] }

    const computeFunctions = new Map(
      entries.filter((entry): entry is [string, (values: DeepReadonly<Values>) => unknown] =>
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
    const detachedReadonlyValues = new WeakMap<object, object>()

    const readonlyValue = (value: unknown): unknown => {
      if (value === null || typeof value !== 'object') {
        return value
      }

      if (!isProxyableObject(value)) {
        const cachedDetached = detachedReadonlyValues.get(value)
        if (cachedDetached) return cachedDetached
        try {
          const detached = cloneFormValue(value) as object
          detachedReadonlyValues.set(value, detached)
          return detached
        } catch {
          // Values accepted by the store constructor are cloneable. This
          // fallback is for opaque values returned by another computed field.
          return value
        }
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

    let computedValues!: DeepReadonly<Values>
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
        const result = cloneIngressValue(unwrapReadonly(compute(computedValues)))
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
    }) as DeepReadonly<Values>

    for (const key of affectedComputed) resolveComputed(key)

    let nextValues = values
    const changedPaths: string[] = []
    for (const [key, computedValue] of resolved) {
      if (!isDeepEqual((values as Record<string, unknown>)[key], computedValue)) {
        if (nextValues === values) {
          nextValues = cloneShallowContainer(values) as Values
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

  private invalidateFieldSnapshotAncestors(path: string): void {
    for (const affectedPath of this.getPathAndAncestors(path)) {
      this.fieldSnapshots.delete(affectedPath)
    }
  }

  private invalidateFieldSnapshotSubtree(path: string): void {
    const prefix = `${path}.`
    for (const snapshotPath of this.fieldSnapshots.keys()) {
      if (snapshotPath === path || snapshotPath.startsWith(prefix)) {
        this.fieldSnapshots.delete(snapshotPath)
      }
    }
  }

  private invalidateExposedValues(): void {
    this.exposedValuesSource = undefined
    this.exposedValuesSnapshot = undefined
  }

  private bumpErrorRevision(paths: Iterable<string>): void {
    const revision = ++this.errorRevision
    for (const path of paths) {
      if (this.pendingValidations.has(path)) {
        this.fieldErrorRevisions.set(path, revision)
      }
    }
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
      const outputLength = output.length
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
        if (output.length > outputLength) return
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

    // A leaf can return to its original value while the immutable update has
    // changed alias topology at an ancestor. Preserve a dirty marker at the
    // nearest structurally different ancestor that has no dirty descendant.
    for (const ancestor of this.getPathAndAncestors(path).reverse()) {
      if (this.dirtyPathCounts.has(ancestor)) break
      if (
        !isDeepEqual(
          getValueByPath(this.values, ancestor),
          getValueByPath(this.initialValues, ancestor)
        )
      ) {
        this.addDirtyLeaf(ancestor)
        break
      }
    }
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

  private hasFieldSubscriptions(path: string): boolean {
    return (
      this.subscriptions.has(path) || this.internalFieldSubscriptions.has(path)
    )
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
  getValues(): DeepReadonly<Values> {
    if (this.exposedValuesSource !== this.values) {
      this.exposedValuesSource = this.values
      this.exposedValuesSnapshot = createLazyImmutableSnapshot(this.values) as Values
    }
    return this.exposedValuesSnapshot as DeepReadonly<Values>
  }

  /** @internal Read the immutable store root without creating a public view. */
  getInternalValues(): Values {
    return this.values
  }

  /**
   * Get value at specific field path
   */
  getValue<P extends Path<Values>>(
    name: P
  ): DeepReadonly<ValueAtPath<Values, P>> {
    return createCachedImmutableSnapshot(
      getValueByPath(this.values, name) as ValueAtPath<Values, P>
    )
  }

  /** @internal Read a store value without creating a public snapshot. */
  getInternalValue<P extends Path<Values>>(name: P): ValueAtPath<Values, P> {
    return getValueByPath(this.values, name) as ValueAtPath<Values, P>
  }

  /**
   * Set value at specific field path
   */
  setValue<P extends Path<Values>>(name: P, value: ValueAtPath<Values, P>): void {
    const currentValue = this.getInternalValue(name)
    const detachedValue = cloneIngressValue(value)
    let candidate: Values
    if (isDeepEqual(currentValue, detachedValue)) {
      candidate = setValueByPath(this.values, name, detachedValue)
      if (isDeepEqual(this.values, candidate)) return
    } else {
      candidate = setValueByPath(this.values, name, detachedValue)
    }

    const wasDirty = this.isDirty()
    const computed = this.applyComputedFields(candidate, [name])
    this.values = computed.values
    this.invalidateExposedValues()

    const changedPaths = new Set<string>([name, ...computed.changedPaths])
    for (const path of changedPaths) {
      this.invalidateFieldSnapshotAncestors(path)
      this.refreshDirtySubtree(path)
    }
    if (
      (currentValue !== null && typeof currentValue === 'object') ||
      (detachedValue !== null && typeof detachedValue === 'object')
    ) {
      this.invalidateFieldSnapshotSubtree(name)
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
    this.bumpErrorRevision([name])
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
  getFieldState<P extends Path<Values>>(
    name: P
  ): FieldState<DeepReadonly<ValueAtPath<Values, P>>> {
    const internal = this.getInternalFieldState(name)
    const cached = this.exposedFieldSnapshots.get(internal)
    if (cached) {
      return cached as FieldState<DeepReadonly<ValueAtPath<Values, P>>>
    }

    const internalValue = internal.value
    const exposedValue = createCachedLazyImmutableSnapshot(internalValue)
    const exposed: FieldState<DeepReadonly<ValueAtPath<Values, P>>> = Object.freeze({
      ...internal,
      value: exposedValue as DeepReadonly<ValueAtPath<Values, P>>,
    })
    this.exposedFieldSnapshots.set(internal, exposed as FieldState<unknown>)
    return exposed
  }

  /** @internal Read the stable field snapshot used by React subscriptions. */
  getInternalFieldState<P extends Path<Values>>(
    name: P
  ): FieldState<ValueAtPath<Values, P>> {
    const value = this.getInternalValue(name)

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

    const frozenSnapshot = Object.freeze(nextSnapshot)
    this.fieldSnapshots.set(name, frozenSnapshot as FieldState<unknown>)
    return frozenSnapshot
  }

  /**
   * Subscribe to field changes
   *
   * Returns unsubscribe function
   */
  subscribe<P extends Path<Values>>(
    name: P,
    callback: SubscriptionCallback<DeepReadonly<ValueAtPath<Values, P>>>
  ): Unsubscribe {
    const wasSubscribed = this.hasFieldSubscriptions(name)
    const callbacks = this.subscriptions.get(name) ?? new Set()
    callbacks.add(callback as SubscriptionCallback<unknown>)
    this.subscriptions.set(name, callbacks)
    if (!wasSubscribed) this.addSubscriptionPath(name)

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(name)
      if (callbacks) {
        callbacks.delete(callback as SubscriptionCallback<unknown>)
        if (callbacks.size === 0) {
          this.subscriptions.delete(name)
          if (!this.hasFieldSubscriptions(name)) {
            this.removeSubscriptionPath(name)
            this.fieldSnapshots.delete(name)
          }
        }
      }
    }
  }

  /** @internal Subscribe to field notifications without exposing field values. */
  subscribeToField<P extends Path<Values>>(
    name: P,
    callback: InternalFieldSubscriptionCallback
  ): Unsubscribe {
    const wasSubscribed = this.hasFieldSubscriptions(name)
    const callbacks = this.internalFieldSubscriptions.get(name) ?? new Set()
    callbacks.add(callback)
    this.internalFieldSubscriptions.set(name, callbacks)
    if (!wasSubscribed) this.addSubscriptionPath(name)

    return () => {
      const callbacks = this.internalFieldSubscriptions.get(name)
      if (!callbacks) return
      callbacks.delete(callback)
      if (callbacks.size === 0) {
        this.internalFieldSubscriptions.delete(name)
        if (!this.hasFieldSubscriptions(name)) {
          this.removeSubscriptionPath(name)
          this.fieldSnapshots.delete(name)
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
    this.internalFieldSubscriptions.get(name)?.forEach((callback) => callback())
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
    this.bumpErrorRevision(errorPaths)
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
    this.validationErrorRevisions.set(
      controller,
      this.fieldErrorRevisions.get(name) ?? 0
    )
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
    this.fieldErrorRevisions.delete(name)
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
      this.fieldErrorRevisions.delete(name)
      this.queueNotification(
        [name],
        this.isValidating() ? [] : ['validating']
      )
    }
  }

  /** @internal Cancel every pending validation after configuration replacement. */
  cancelAllValidations(): void {
    if (this.pendingValidations.size === 0) return
    const paths = Array.from(this.pendingValidations.keys())
    for (const controller of this.pendingValidations.values()) controller.abort()
    this.pendingValidations.clear()
    this.validatingFields.clear()
    this.fieldErrorRevisions.clear()
    this.queueNotification(paths, ['validating'])
  }

  /**
   * Return whether a validation result still belongs to the latest run.
   */
  isValidationCurrent<P extends Path<Values>>(
    name: P,
    controller: AbortController
  ): boolean {
    return (
      this.pendingValidations.get(name) === controller &&
      !controller.signal.aborted &&
      this.validationErrorRevisions.get(controller) ===
        (this.fieldErrorRevisions.get(name) ?? 0)
    )
  }

  /** @internal Current error-state revision for whole-form race detection. */
  getErrorRevision(): number {
    return this.errorRevision
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

    // Convert the new-index -> old-index mapping once. Looking up every
    // metadata path with Array#indexOf made large array operations quadratic.
    const oldToNewIndices = new Map<number, number>()
    for (let newIndex = 0; newIndex < newToOldIndices.length; newIndex++) {
      const oldIndex = newToOldIndices[newIndex]
      if (oldIndex !== undefined && !oldToNewIndices.has(oldIndex)) {
        oldToNewIndices.set(oldIndex, newIndex)
      }
    }

    for (const [path, controller] of this.pendingValidations) {
      if (path.startsWith(prefix)) {
        controller.abort()
        this.pendingValidations.delete(path)
        this.fieldErrorRevisions.delete(path)
        validationChanged = this.validatingFields.delete(path) || validationChanged
      }
    }

    const remapPath = (path: string): string | undefined => {
      if (!path.startsWith(prefix)) return path

      const suffix = path.slice(prefix.length)
      const [indexSegment, ...rest] = suffix.split('.')
      if (!indexSegment || !/^\d+$/.test(indexSegment)) return path

      const newIndex = oldToNewIndices.get(Number(indexSegment))
      if (newIndex === undefined) return undefined
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
    const remappedErrorPaths = new Set([
      ...Object.keys(this.errors),
      ...Object.keys(nextErrors),
    ])
    const errorsChanged = !isDeepEqual(this.errors, nextErrors)
    const wasValid = this.isValid()
    const touchedChanged = !isDeepEqual(this.touched, nextTouched)

    const currentArrayValue = getValueByPath(this.values, arrayPath)
    const detachedValues = Array.isArray(values)
      ? values.map((entry, newIndex) => {
          const oldIndex = newToOldIndices[newIndex]
          if (
            oldIndex !== undefined &&
            Array.isArray(currentArrayValue) &&
            Object.is(entry, currentArrayValue[oldIndex])
          ) {
            return entry
          }
          return cloneIngressValue(entry)
        })
      : cloneIngressValue(values)
    if (Array.isArray(detachedValues)) {
      if (Array.isArray(currentArrayValue)) {
        copyEnumerableArrayMetadata(currentArrayValue, detachedValues)
      }
      copyEnumerableArrayMetadata(values as unknown[], detachedValues)
    }
    const candidate = setValueByPath(this.values, arrayPath, detachedValues)
    const computed = this.applyComputedFields(candidate, [arrayPath])

    const wasDirty = this.isDirty()
    this.errors = nextErrors
    if (errorsChanged) {
      this.bumpErrorRevision(remappedErrorPaths)
    }
    this.touched = nextTouched
    this.validatedFields = nextValidatedFields
    this.values = computed.values
    this.invalidateExposedValues()

    // Indexed snapshots contain values and state for the old arrangement.
    // Drop the complete subtree so removed payloads can be collected and live
    // subscribers rebuild snapshots from the remapped state below.
    this.invalidateFieldSnapshotSubtree(arrayPath)

    const changedPaths = new Set([arrayPath, ...computed.changedPaths])
    for (const path of changedPaths) {
      this.invalidateFieldSnapshotAncestors(path)
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
   * Release runtime resources owned by this store.
   *
   * The values and configuration remain reusable because React StrictMode can
   * run effect cleanup and setup again for the same mounted store instance.
   */
  dispose(): void {
    for (const controller of this.pendingValidations.values()) {
      controller.abort()
    }
    this.pendingValidations.clear()
    this.validatingFields.clear()
    this.validatedFields.clear()

    for (const callbacks of this.subscriptions.values()) callbacks.clear()
    this.subscriptions.clear()
    for (const callbacks of this.internalFieldSubscriptions.values()) callbacks.clear()
    this.internalFieldSubscriptions.clear()
    this.subscriptionRoot = createSubscriptionNode()
    this.globalSubscribers.clear()
    this.fieldSnapshots.clear()
    this.exposedFieldSnapshots = new WeakMap()
    this.invalidateExposedValues()

    this.pendingNotificationPaths.clear()
    this.pendingSlices.clear()
    this.fieldErrorRevisions.clear()
    this.activeSubmission = undefined
  }

  /**
   * Reset form to initial values
   */
  reset(newInitialValues?: Partial<Values>): void {
    const mergedInitialValues = newInitialValues
      ? Object.assign(
          cloneShallowContainer(this.initialValues) as Values,
          newInitialValues
        )
      : this.initialValues
    const resetValues = this.applyComputedFields(
      cloneFormValue(mergedInitialValues)
    ).values
    const subscribedPaths = Array.from(
      new Set([
        ...this.subscriptions.keys(),
        ...this.internalFieldSubscriptions.keys(),
      ])
    )

    for (const controller of this.pendingValidations.values()) {
      controller.abort()
    }
    this.pendingValidations.clear()
    this.validatingFields.clear()
    this.validatedFields.clear()

    this.values = resetValues
    this.initialValues = resetValues
    this.errors = {}
    this.bumpErrorRevision(Object.keys(this.errors))
    this.fieldErrorRevisions.clear()
    this.touched = {}
    this.dirtyLeafPaths.clear()
    this.dirtyPathCounts.clear()
    this.fieldSnapshots.clear()
    this.exposedFieldSnapshots = new WeakMap()
    this.invalidateExposedValues()
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
    return this.dirtyLeafPaths.size > 0 || !isDeepEqual(this.values, this.initialValues)
  }

  /**
   * Check if form is valid (no errors)
   */
  isValid(): boolean {
    return Object.keys(this.errors).length === 0
  }
}
