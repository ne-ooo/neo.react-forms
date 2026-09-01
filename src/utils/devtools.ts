/**
 * DevTools integration for @lpm.dev/neo.react-forms
 *
 * Helpers for inspecting and debugging forms in browser DevTools
 */

import type { FormState, Path } from '../types.js'

/** Value used when DevTools hides a sensitive field. */
export const REDACTED_VALUE = '[REDACTED]' as const

/** A field name, field path, or regular expression that identifies sensitive data. */
export type SensitiveFieldMatcher = string | RegExp

/** Privacy controls for snapshots and debug output. */
export interface DevToolsPrivacyOptions {
  /**
   * Include sensitive values in output. This option is false by default.
   */
  includeSensitiveValues?: boolean

  /** Add application-specific field names or paths to the default sensitive list. */
  sensitiveFields?: readonly SensitiveFieldMatcher[]

  /** Transform each non-sensitive leaf value before DevTools uses it. */
  redactor?: (value: unknown, path: string) => unknown
}

/** Options for browser-global form exposure. */
export interface ExposeFormOptions extends DevToolsPrivacyOptions {
  /** Explicit confirmation that the caller wants browser-global exposure. */
  enabled: true

  /** Permit exposure when NODE_ENV is production. This option is false by default. */
  allowInProduction?: boolean
}

/** The value shape used by privacy-aware DevTools snapshots. */
export type DevToolsValue<Value> = Value extends (...args: never[]) => unknown
  ? Value | typeof REDACTED_VALUE
  : Value extends readonly (infer Item)[]
    ? Array<DevToolsValue<Item>>
    : Value extends
          | Date
          | RegExp
          | Error
          | Promise<unknown>
          | Map<unknown, unknown>
          | ReadonlyMap<unknown, unknown>
          | Set<unknown>
          | ReadonlySet<unknown>
          | WeakMap<object, unknown>
          | WeakSet<object>
          | ArrayBuffer
          | ArrayBufferView
          | Blob
          | File
      ? Value | typeof REDACTED_VALUE
      : Value extends object
        ? { [Key in keyof Value]: DevToolsValue<Value[Key]> }
        : Value | typeof REDACTED_VALUE

const DEFAULT_SENSITIVE_FIELD_PATTERN =
  /password|passwd|passcode|secret|token|authorization|api.?key|private.?key|card.?number|security.?code|cvv|cvc|social.?security|ssn|(^|[^a-z])pin([^a-z]|$)/i

function isPlainRecord(value: object): boolean {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function setEnumerableProperty(
  target: object,
  key: PropertyKey,
  value: unknown
): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  })
}

function getDevToolsPropertyPath(path: string, key: PropertyKey): string {
  const segment =
    typeof key === 'symbol' ? (key.description ?? key.toString()) : key
  return path ? `${path}.${segment}` : String(segment)
}

function getEnumerableDevToolsKeys(
  value: object,
  symbolsOnly = false
): PropertyKey[] {
  const keys = symbolsOnly ? Object.getOwnPropertySymbols(value) : Reflect.ownKeys(value)
  return keys.filter((key) =>
    Object.prototype.propertyIsEnumerable.call(value, key)
  )
}

interface DevToolsBinaryCloneState {
  clones: WeakMap<object, ArrayBuffer>
  pendingSensitiveRanges: WeakMap<
    object,
    Array<{ end: number; start: number }>
  >
  transformedValues: Map<string, unknown>
}

function createDevToolsBinaryCloneState(): DevToolsBinaryCloneState {
  return {
    clones: new WeakMap<object, ArrayBuffer>(),
    pendingSensitiveRanges: new WeakMap(),
    transformedValues: new Map(),
  }
}

function scrubDevToolsBinaryRange(
  clone: ArrayBuffer,
  start: number,
  end: number
): void {
  new Uint8Array(clone).fill(0, start, end)
}

function markSensitiveDevToolsBinaryRange(
  value: object,
  state: DevToolsBinaryCloneState
): void {
  let buffer: ArrayBufferLike
  let start: number
  let end: number
  if (
    value instanceof ArrayBuffer ||
    (typeof SharedArrayBuffer !== 'undefined' && value instanceof SharedArrayBuffer)
  ) {
    buffer = value
    start = 0
    end = value.byteLength
  } else if (ArrayBuffer.isView(value)) {
    buffer = value.buffer
    start = value.byteOffset
    end = start + value.byteLength
  } else {
    return
  }

  const bufferObject = buffer as object
  const clone = state.clones.get(bufferObject)
  if (clone) {
    scrubDevToolsBinaryRange(clone, start, end)
    return
  }

  const pending = state.pendingSensitiveRanges.get(bufferObject) ?? []
  pending.push({ start, end })
  state.pendingSensitiveRanges.set(bufferObject, pending)
}

function markSensitiveDevToolsBinaryRanges(
  value: unknown,
  state: DevToolsBinaryCloneState,
  seen = new WeakSet<object>()
): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  markSensitiveDevToolsBinaryRange(value, state)

  if (
    value instanceof Error &&
    Object.prototype.hasOwnProperty.call(value, 'cause')
  ) {
    markSensitiveDevToolsBinaryRanges(value.cause, state, seen)
  }

  if (value instanceof Map) {
    for (const [key, entry] of value) {
      markSensitiveDevToolsBinaryRanges(key, state, seen)
      markSensitiveDevToolsBinaryRanges(entry, state, seen)
    }
  } else if (value instanceof Set) {
    for (const entry of value) {
      markSensitiveDevToolsBinaryRanges(entry, state, seen)
    }
  }

  for (const key of getEnumerableDevToolsKeys(
    value,
    ArrayBuffer.isView(value)
  )) {
    markSensitiveDevToolsBinaryRanges(
      (value as Record<PropertyKey, unknown>)[key],
      state,
      seen
    )
  }
}

function registerDevToolsBinaryClone(
  source: object,
  clone: ArrayBuffer,
  state: DevToolsBinaryCloneState
): ArrayBuffer {
  state.clones.set(source, clone)
  const pending = state.pendingSensitiveRanges.get(source)
  if (pending && pending.length > 0) {
    pending.sort((left, right) => left.start - right.start)
    let mergedStart = pending[0]!.start
    let mergedEnd = pending[0]!.end
    for (let index = 1; index < pending.length; index++) {
      const range = pending[index]!
      if (range.start <= mergedEnd) {
        mergedEnd = Math.max(mergedEnd, range.end)
      } else {
        scrubDevToolsBinaryRange(clone, mergedStart, mergedEnd)
        mergedStart = range.start
        mergedEnd = range.end
      }
    }
    scrubDevToolsBinaryRange(clone, mergedStart, mergedEnd)
    state.pendingSensitiveRanges.delete(source)
  }
  return clone
}

function cloneErrorValue(
  value: Error,
  seen: WeakMap<object, unknown>,
  binaryState: DevToolsBinaryCloneState
): Error {
  const existing = seen.get(value)
  if (existing) return existing as Error

  let clone: Error
  try {
    clone = structuredClone(value)
  } catch {
    clone = new Error(value.message)
    clone.name = value.name
    if (value.stack !== undefined) clone.stack = value.stack
  }
  seen.set(value, clone)

  if (Object.prototype.hasOwnProperty.call(value, 'cause')) {
    Object.defineProperty(clone, 'cause', {
      configurable: true,
      enumerable: false,
      value: cloneDevToolsLeaf(value.cause, seen, binaryState),
      writable: true,
    })
  }

  for (const key of Reflect.ownKeys(value)) {
    if (!Object.prototype.propertyIsEnumerable.call(value, key)) continue
    setEnumerableProperty(
      clone,
      key,
      cloneDevToolsLeaf(
        (value as unknown as Record<PropertyKey, unknown>)[key],
        seen,
        binaryState
      )
    )
  }

  return clone
}

function cloneDevToolsLeaf(
  value: unknown,
  seen = new WeakMap<object, unknown>(),
  binaryState = createDevToolsBinaryCloneState()
): unknown {
  if (value === null || typeof value !== 'object') return value

  const existing = seen.get(value)
  if (existing !== undefined) return existing
  if (value instanceof Error) return cloneErrorValue(value, seen, binaryState)

  if (value instanceof ArrayBuffer) {
    const existingBuffer = binaryState.clones.get(value)
    if (existingBuffer) return existingBuffer
    const clone = value.slice(0)
    seen.set(value, clone)
    return registerDevToolsBinaryClone(value, clone, binaryState)
  }

  if (
    typeof SharedArrayBuffer !== 'undefined' &&
    value instanceof SharedArrayBuffer
  ) {
    const existingBuffer = binaryState.clones.get(value)
    if (existingBuffer) return existingBuffer
    const clone = new ArrayBuffer(value.byteLength)
    new Uint8Array(clone).set(new Uint8Array(value))
    seen.set(value, clone)
    return registerDevToolsBinaryClone(value, clone, binaryState)
  }

  if (ArrayBuffer.isView(value)) {
    const buffer = cloneDevToolsLeaf(
      value.buffer,
      seen,
      binaryState
    ) as ArrayBuffer
    const length = 'length' in value
      ? (value as ArrayBufferView & { length: number }).length
      : value.byteLength
    const clone = Reflect.construct(value.constructor, [
      buffer,
      value.byteOffset,
      length,
    ]) as ArrayBufferView
    seen.set(value, clone)
    return clone
  }

  if (value instanceof RegExp) {
    const clone = new RegExp(value.source, value.flags)
    clone.lastIndex = value.lastIndex
    seen.set(value, clone)
    return clone
  }

  if (Array.isArray(value)) {
    const clone: unknown[] = new Array(value.length)
    seen.set(value, clone)
    for (const key of Reflect.ownKeys(value)) {
      if (!Object.prototype.propertyIsEnumerable.call(value, key)) continue
      setEnumerableProperty(
        clone,
        key,
        cloneDevToolsLeaf(
          (value as unknown as Record<PropertyKey, unknown>)[key],
          seen,
          binaryState
        )
      )
    }
    return clone
  }

  if (isPlainRecord(value)) {
    const clone = Object.create(Object.getPrototypeOf(value)) as Record<
      PropertyKey,
      unknown
    >
    seen.set(value, clone)
    for (const key of Reflect.ownKeys(value)) {
      if (!Object.prototype.propertyIsEnumerable.call(value, key)) continue
      setEnumerableProperty(
        clone,
        key,
        cloneDevToolsLeaf(
          (value as Record<PropertyKey, unknown>)[key],
          seen,
          binaryState
        )
      )
    }
    return clone
  }

  if (value instanceof Map) {
    const clone = new Map<unknown, unknown>()
    seen.set(value, clone)
    for (const [key, entry] of value) {
      clone.set(
        cloneDevToolsLeaf(key, seen, binaryState),
        cloneDevToolsLeaf(entry, seen, binaryState)
      )
    }
    return clone
  }

  if (value instanceof Set) {
    const clone = new Set<unknown>()
    seen.set(value, clone)
    for (const entry of value) {
      clone.add(cloneDevToolsLeaf(entry, seen, binaryState))
    }
    return clone
  }

  try {
    const clone = structuredClone(value)
    seen.set(value, clone)
    return clone
  } catch {
    // Unsupported host objects are already detached or opaque to DevTools.
    return value
  }
}

interface DevToolsEqualityState {
  binaryBufferLeftToRight: WeakMap<object, object>
  binaryBufferMappings: Array<[object, object, number]>
  binaryBufferOffsetDeltas: WeakMap<object, number>
  binaryBufferRightToLeft: WeakMap<object, object>
  leftToRight: WeakMap<object, object>
  mappings: Array<[object, object]>
  parent?: DevToolsEqualityState
  rightToLeft: WeakMap<object, object>
}

function createDevToolsEqualityState(
  parent?: DevToolsEqualityState
): DevToolsEqualityState {
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

function getMappedDevToolsBinaryBuffer(
  state: DevToolsEqualityState,
  value: object,
  direction: 'left' | 'right'
): object | undefined {
  let current: DevToolsEqualityState | undefined = state
  while (current) {
    const mapped = direction === 'left'
      ? current.binaryBufferLeftToRight.get(value)
      : current.binaryBufferRightToLeft.get(value)
    if (mapped !== undefined) return mapped
    current = current.parent
  }
  return undefined
}

function getDevToolsBinaryBufferOffsetDelta(
  state: DevToolsEqualityState,
  left: object
): number | undefined {
  let current: DevToolsEqualityState | undefined = state
  while (current) {
    const delta = current.binaryBufferOffsetDeltas.get(left)
    if (delta !== undefined) return delta
    current = current.parent
  }
  return undefined
}

function mapDevToolsBinaryBufferTopology(
  state: DevToolsEqualityState,
  left: ArrayBufferLike,
  right: ArrayBufferLike,
  offsetDelta: number
): boolean {
  const leftObject = left as object
  const rightObject = right as object
  const mappedRight = getMappedDevToolsBinaryBuffer(state, leftObject, 'left')
  if (mappedRight !== undefined) {
    return (
      mappedRight === rightObject &&
      getDevToolsBinaryBufferOffsetDelta(state, leftObject) === offsetDelta
    )
  }
  if (getMappedDevToolsBinaryBuffer(state, rightObject, 'right') !== undefined) {
    return false
  }
  state.binaryBufferLeftToRight.set(leftObject, rightObject)
  state.binaryBufferRightToLeft.set(rightObject, leftObject)
  state.binaryBufferOffsetDeltas.set(leftObject, offsetDelta)
  state.binaryBufferMappings.push([leftObject, rightObject, offsetDelta])
  return true
}

function getMappedDevToolsObject(
  state: DevToolsEqualityState,
  value: object,
  direction: 'left' | 'right'
): object | undefined {
  let current: DevToolsEqualityState | undefined = state
  while (current) {
    const mapped = direction === 'left'
      ? current.leftToRight.get(value)
      : current.rightToLeft.get(value)
    if (mapped !== undefined) return mapped
    current = current.parent
  }
  return undefined
}

function addDevToolsMapping(
  state: DevToolsEqualityState,
  left: object,
  right: object
): void {
  state.leftToRight.set(left, right)
  state.rightToLeft.set(right, left)
  state.mappings.push([left, right])
}

function commitDevToolsEqualityState(
  source: DevToolsEqualityState,
  target: DevToolsEqualityState
): void {
  for (const [left, right] of source.mappings) {
    if (getMappedDevToolsObject(target, left, 'left') === undefined) {
      addDevToolsMapping(target, left, right)
    }
  }
  for (const [left, right, offsetDelta] of source.binaryBufferMappings) {
    if (getMappedDevToolsBinaryBuffer(target, left, 'left') === undefined) {
      target.binaryBufferLeftToRight.set(left, right)
      target.binaryBufferRightToLeft.set(right, left)
      target.binaryBufferOffsetDeltas.set(left, offsetDelta)
      target.binaryBufferMappings.push([left, right, offsetDelta])
    }
  }
}

function isPrimitiveDevToolsValue(value: unknown): boolean {
  return value === null || (typeof value !== 'object' && typeof value !== 'function')
}

interface DevToolsEqualityBucketContext {
  nextPrototypeId: number
  nextSymbolId: number
  prototypeIds: WeakMap<object, number>
  symbolIds: Map<symbol, number>
}

function createDevToolsEqualityBucketContext(): DevToolsEqualityBucketContext {
  return {
    nextPrototypeId: 1,
    nextSymbolId: 1,
    prototypeIds: new WeakMap(),
    symbolIds: new Map(),
  }
}

const DEVTOOLS_IS_LITTLE_ENDIAN =
  new Uint8Array(new Uint32Array([1]).buffer)[0] === 1

function getDevToolsBinaryHash(
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
      hash = Math.imul(
        hash ^ view.getUint32(index, DEVTOOLS_IS_LITTLE_ENDIAN),
        16777619
      )
    }
  }
  const tail = new Uint8Array(
    buffer,
    byteOffset + wordBytes,
    byteLength - wordBytes
  )
  for (const byte of tail) hash = Math.imul(hash ^ byte, 16777619)
  return (hash >>> 0).toString(36)
}

function getDevToolsEqualityBucket(
  value: unknown,
  context: DevToolsEqualityBucketContext,
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
    base = `buffer:${value.byteLength}:${getDevToolsBinaryHash(
      value,
      0,
      value.byteLength
    )}:${prototypeId}`
  } else if (ArrayBuffer.isView(value)) {
    base = `view:${value.byteLength}:${getDevToolsBinaryHash(
      value.buffer,
      value.byteOffset,
      value.byteLength
    )}:${prototypeId}`
  } else if (typeof Blob !== 'undefined' && value instanceof Blob) {
    const file = typeof File !== 'undefined' && value instanceof File
      ? value
      : undefined
    base = `blob:${value.size}:${value.type}:${file?.name ?? ''}:${
      file?.lastModified ?? ''
    }:${prototypeId}`
  } else if (Array.isArray(value)) {
    base = `array:${value.length}:${prototypeId}`
  }

  if (active.has(value)) return base
  active.add(value)
  let semanticEntries: string[] = []
  if (value instanceof Error && 'cause' in value) {
    semanticEntries = [
      `cause=${getDevToolsEqualityBucket(value.cause, context, active)}`,
    ]
  } else if (value instanceof Map) {
    semanticEntries = Array.from(value.entries(), ([key, entry]) =>
      `${getDevToolsEqualityBucket(key, context, active)}=>${
        getDevToolsEqualityBucket(entry, context, active)
      }`
    ).sort()
  } else if (value instanceof Set) {
    semanticEntries = Array.from(value, (entry) =>
      getDevToolsEqualityBucket(entry, context, active)
    ).sort()
  }
  const keys = (ArrayBuffer.isView(value)
    ? Object.getOwnPropertySymbols(value)
    : Reflect.ownKeys(value)
  )
    .filter((key) => Object.prototype.propertyIsEnumerable.call(value, key))
    .map((key) => {
      if (typeof key === 'string') {
        return { key, token: `key:${JSON.stringify(key)}` }
      }
      let id = context.symbolIds.get(key)
      if (id === undefined) {
        id = context.nextSymbolId++
        context.symbolIds.set(key, id)
      }
      return { key, token: `symbol-key:${id}` }
    })
    .sort((left, right) => left.token.localeCompare(right.token))
  const properties = keys.map(({ key, token }) =>
    `${token}=${getDevToolsEqualityBucket(
      (value as Record<PropertyKey, unknown>)[key],
      context,
      active
    )}`
  )
  active.delete(value)
  return `${base}[${semanticEntries.join('|')}]{${properties.join('|')}}`
}

function areDevToolsBinaryRegionsEqual(
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
  const leftTail = new Uint8Array(
    leftBuffer,
    leftOffset + wordBytes,
    byteLength - wordBytes
  )
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

function haveEqualEnumerableProperties(
  left: object,
  right: object,
  seen: DevToolsEqualityState,
  skipArrayIndices = false,
  symbolKeysOnly = false
): boolean {
  const isArrayIndex = (key: PropertyKey): boolean =>
    typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key)
  const leftKeys = (
    symbolKeysOnly ? Object.getOwnPropertySymbols(left) : Reflect.ownKeys(left)
  ).filter(
    (key) =>
      (!skipArrayIndices || !isArrayIndex(key)) &&
      Object.prototype.propertyIsEnumerable.call(left, key)
  )
  const rightKeys = (
    symbolKeysOnly ? Object.getOwnPropertySymbols(right) : Reflect.ownKeys(right)
  ).filter(
    (key) =>
      (!skipArrayIndices || !isArrayIndex(key)) &&
      Object.prototype.propertyIsEnumerable.call(right, key)
  )
  if (leftKeys.length !== rightKeys.length) return false

  return leftKeys.every(
    (key) =>
      Object.prototype.propertyIsEnumerable.call(right, key) &&
      areDevToolsValuesEqual(
        (left as Record<PropertyKey, unknown>)[key],
        (right as Record<PropertyKey, unknown>)[key],
        seen
      )
  )
}

function areDevToolsValuesEqual(
  left: unknown,
  right: unknown,
  seen = createDevToolsEqualityState()
): boolean {
  if (Object.is(left, right)) {
    if (left !== null && typeof left === 'object') {
      if (
        left instanceof ArrayBuffer &&
        !mapDevToolsBinaryBufferTopology(seen, left, right as ArrayBuffer, 0)
      ) {
        return false
      }
      if (
        ArrayBuffer.isView(left) &&
        !mapDevToolsBinaryBufferTopology(
          seen,
          left.buffer,
          (right as ArrayBufferView).buffer,
          0
        )
      ) {
        return false
      }
      const mappedRight = getMappedDevToolsObject(seen, left, 'left')
      if (mappedRight !== undefined) return mappedRight === right
      const mappedLeft = getMappedDevToolsObject(seen, right as object, 'right')
      if (mappedLeft !== undefined) return mappedLeft === left
      addDevToolsMapping(seen, left, right as object)
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

  const mappedRight = getMappedDevToolsObject(seen, left, 'left')
  if (mappedRight !== undefined) return mappedRight === right
  const mappedLeft = getMappedDevToolsObject(seen, right, 'right')
  if (mappedLeft !== undefined) return mappedLeft === left
  addDevToolsMapping(seen, left, right)

  if (left instanceof Date || right instanceof Date) {
    return (
      left instanceof Date &&
      right instanceof Date &&
      Object.is(left.getTime(), right.getTime()) &&
      haveEqualEnumerableProperties(left, right, seen)
    )
  }
  if (left instanceof RegExp || right instanceof RegExp) {
    return (
      left instanceof RegExp &&
      right instanceof RegExp &&
      left.source === right.source &&
      left.flags === right.flags &&
      left.lastIndex === right.lastIndex &&
      haveEqualEnumerableProperties(left, right, seen)
    )
  }
  if (left instanceof Error || right instanceof Error) {
    return (
      left instanceof Error &&
      right instanceof Error &&
      left.name === right.name &&
      left.message === right.message &&
      left.stack === right.stack &&
      areDevToolsValuesEqual(left.cause, right.cause, seen) &&
      haveEqualEnumerableProperties(left, right, seen)
    )
  }
  if (left instanceof ArrayBuffer || right instanceof ArrayBuffer) {
    if (!(left instanceof ArrayBuffer) || !(right instanceof ArrayBuffer)) return false
    if (!mapDevToolsBinaryBufferTopology(seen, left, right, 0)) return false
    if (left.byteLength !== right.byteLength) return false
    return (
      areDevToolsBinaryRegionsEqual(left, 0, right, 0, left.byteLength) &&
      haveEqualEnumerableProperties(left, right, seen)
    )
  }
  if (ArrayBuffer.isView(left) || ArrayBuffer.isView(right)) {
    if (!ArrayBuffer.isView(left) || !ArrayBuffer.isView(right)) return false
    if (left.constructor !== right.constructor || left.byteLength !== right.byteLength) {
      return false
    }
    if (
      !mapDevToolsBinaryBufferTopology(
        seen,
        left.buffer,
        right.buffer,
        right.byteOffset - left.byteOffset
      )
    ) {
      return false
    }
    return (
      areDevToolsBinaryRegionsEqual(
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
    if (!(left instanceof Map) || !(right instanceof Map) || left.size !== right.size) {
      return false
    }
    const leftEntries = Array.from(left.entries())
    const entriesEqual = leftEntries.every(([key]) =>
      isPrimitiveDevToolsValue(key)
    )
      ? leftEntries.every(([leftKey, leftValue]) => {
          if (!right.has(leftKey)) return false
          const candidateSeen = createDevToolsEqualityState(seen)
          if (
            !areDevToolsValuesEqual(leftValue, right.get(leftKey), candidateSeen)
          ) {
            return false
          }
          commitDevToolsEqualityState(candidateSeen, seen)
          return true
        })
      : (() => {
          const bucketContext = createDevToolsEqualityBucketContext()
          const unmatched = new Map<string, Array<[unknown, unknown]>>()
          for (const entry of right.entries()) {
            const bucket = getDevToolsEqualityBucket(entry[0], bucketContext)
            const entries = unmatched.get(bucket) ?? []
            entries.push(entry)
            unmatched.set(bucket, entries)
          }
          return leftEntries.every(([leftKey, leftValue]) => {
            const bucket = getDevToolsEqualityBucket(leftKey, bucketContext)
            const candidates = unmatched.get(bucket)
            if (!candidates) return false
            let matchedState: DevToolsEqualityState | undefined
            const index = candidates.findIndex(([rightKey, rightValue]) => {
              const candidateSeen = createDevToolsEqualityState(seen)
              const matches = (
                areDevToolsValuesEqual(leftKey, rightKey, candidateSeen) &&
                areDevToolsValuesEqual(leftValue, rightValue, candidateSeen)
              )
              if (matches) matchedState = candidateSeen
              return matches
            })
            if (index === -1) return false
            if (matchedState) commitDevToolsEqualityState(matchedState, seen)
            const last = candidates.pop()
            if (index < candidates.length && last) candidates[index] = last
            if (candidates.length === 0) unmatched.delete(bucket)
            return true
          })
        })()
    return entriesEqual && haveEqualEnumerableProperties(left, right, seen)
  }
  if (left instanceof Set || right instanceof Set) {
    if (!(left instanceof Set) || !(right instanceof Set) || left.size !== right.size) {
      return false
    }
    const leftValues = Array.from(left.values())
    const entriesEqual = leftValues.every(isPrimitiveDevToolsValue)
      ? leftValues.every((leftValue) => right.has(leftValue))
      : (() => {
          const bucketContext = createDevToolsEqualityBucketContext()
          const unmatched = new Map<string, unknown[]>()
          for (const entry of right.values()) {
            const bucket = getDevToolsEqualityBucket(entry, bucketContext)
            const entries = unmatched.get(bucket) ?? []
            entries.push(entry)
            unmatched.set(bucket, entries)
          }
          return leftValues.every((leftValue) => {
            const bucket = getDevToolsEqualityBucket(leftValue, bucketContext)
            const candidates = unmatched.get(bucket)
            if (!candidates) return false
            let matchedState: DevToolsEqualityState | undefined
            const index = candidates.findIndex((rightValue) => {
              const candidateSeen = createDevToolsEqualityState(seen)
              const matches = areDevToolsValuesEqual(
                leftValue,
                rightValue,
                candidateSeen
              )
              if (matches) matchedState = candidateSeen
              return matches
            })
            if (index === -1) return false
            if (matchedState) commitDevToolsEqualityState(matchedState, seen)
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
    if (!(left instanceof Blob) || !(right instanceof Blob)) return false
    const leftFile = typeof File !== 'undefined' && left instanceof File ? left : undefined
    const rightFile = typeof File !== 'undefined' && right instanceof File ? right : undefined
    const metadataEqual = (
      left.size === right.size &&
      left.type === right.type &&
      leftFile?.name === rightFile?.name &&
      leftFile?.lastModified === rightFile?.lastModified
    )
    return metadataEqual && haveEqualEnumerableProperties(left, right, seen)
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false
    }
  }

  if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) return false
  return haveEqualEnumerableProperties(left, right, seen)
}

function regularExpressionMatches(expression: RegExp, value: string): boolean {
  const previousLastIndex = expression.lastIndex
  expression.lastIndex = 0
  const matches = expression.test(value)
  expression.lastIndex = previousLastIndex
  return matches
}

function regularExpressionMatchesPath(
  expression: RegExp,
  path: string,
  lastSegment: string | undefined
): boolean {
  const candidates = new Set<string>([path])
  let prefix = ''
  for (const segment of path.split('.')) {
    prefix = prefix ? `${prefix}.${segment}` : segment
    candidates.add(prefix)
  }
  for (const segment of path.split(/[.[\]]/).filter(Boolean)) {
    candidates.add(segment)
  }
  if (lastSegment !== undefined) candidates.add(lastSegment)
  return Array.from(candidates).some((candidate) =>
    regularExpressionMatches(expression, candidate)
  )
}

/** Check whether a field path contains sensitive data. */
export function isSensitiveField(
  path: string,
  additionalMatchers: readonly SensitiveFieldMatcher[] = []
): boolean {
  if (regularExpressionMatches(DEFAULT_SENSITIVE_FIELD_PATTERN, path)) return true

  const normalizedPath = path.toLowerCase()
  const pathSegments = normalizedPath.split(/[.[\]]/).filter(Boolean)
  const lastSegment = pathSegments.at(-1)

  return additionalMatchers.some((matcher) => {
    if (typeof matcher === 'string') {
      const normalizedMatcher = matcher.toLowerCase()
      return (
        normalizedPath === normalizedMatcher ||
        normalizedPath.startsWith(`${normalizedMatcher}.`) ||
        pathSegments.includes(normalizedMatcher)
      )
    }
    return regularExpressionMatchesPath(matcher, path, lastSegment)
  })
}

/** Apply the default DevTools privacy rules to a value. */
export function redactDevToolsValue(
  value: unknown,
  path: string,
  options: DevToolsPrivacyOptions = {}
): unknown {
  return redactDevToolsValueWithState(
    value,
    path,
    options,
    createDevToolsBinaryCloneState()
  )
}

function redactDevToolsValueWithState(
  value: unknown,
  path: string,
  options: DevToolsPrivacyOptions,
  binaryState: DevToolsBinaryCloneState
): unknown {
  return redactValue(
    value,
    path,
    options,
    new WeakSet<object>(),
    false,
    binaryState
  )
}

function redactValue(
  value: unknown,
  path: string,
  options: DevToolsPrivacyOptions,
  ancestors: WeakSet<object>,
  forceRedaction: boolean,
  binaryState: DevToolsBinaryCloneState
): unknown {
  const isSensitive = forceRedaction || (
    !options.includeSensitiveValues &&
    path.length > 0 &&
    isSensitiveField(path, options.sensitiveFields ?? [])
  )

  if (isSensitive && value !== null && typeof value === 'object') {
    if (forceRedaction) markSensitiveDevToolsBinaryRange(value, binaryState)
    else markSensitiveDevToolsBinaryRanges(value, binaryState)
  }

  if (!isSensitive && options.redactor) {
    const transformed = options.redactor(value, path)
    if (!Object.is(transformed, value)) {
      if (value !== null && typeof value === 'object') {
        markSensitiveDevToolsBinaryRanges(value, binaryState)
      }
      const { redactor: _redactor, ...remainingOptions } = options
      const redactedTransformed = redactValue(
        transformed,
        path,
        remainingOptions,
        ancestors,
        false,
        binaryState
      )
      binaryState.transformedValues.set(path, redactedTransformed)
      return redactedTransformed
    }
  }

  if (Array.isArray(value)) {
    if (ancestors.has(value)) return '[Circular]'
    ancestors.add(value)
    const redactedArray = value.map((item, index) =>
      redactValue(
        item,
        path ? `${path}.${index}` : String(index),
        options,
        ancestors,
        isSensitive,
        binaryState
      )
    )
    for (const key of getEnumerableDevToolsKeys(value)) {
      if (typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key)) continue
      setEnumerableProperty(
        redactedArray,
        key,
        redactValue(
          (value as unknown as Record<PropertyKey, unknown>)[key],
          getDevToolsPropertyPath(path, key),
          options,
          ancestors,
          isSensitive,
          binaryState
        )
      )
    }
    ancestors.delete(value)
    return redactedArray
  }

  if (value !== null && typeof value === 'object') {
    if (ancestors.has(value)) return '[Circular]'

    if (value instanceof Map) {
      ancestors.add(value)
      const redactedMap = new Map<unknown, unknown>()
      let index = 0
      for (const [key, entry] of value) {
        const keyPath = path ? `${path}.[key:${index}]` : `[key:${index}]`
        const entrySegment =
          typeof key === 'string' || typeof key === 'number'
            ? String(key)
            : String(index)
        const entryPath = path ? `${path}.${entrySegment}` : entrySegment
        redactedMap.set(
          redactValue(
            key,
            keyPath,
            options,
            ancestors,
            isSensitive,
            binaryState
          ),
          redactValue(
            entry,
            entryPath,
            options,
            ancestors,
            isSensitive,
            binaryState
          )
        )
        index++
      }
      for (const key of getEnumerableDevToolsKeys(value)) {
        const nestedValue = (value as unknown as Record<PropertyKey, unknown>)[key]
        const nestedPath = getDevToolsPropertyPath(path, key)
        setEnumerableProperty(
          redactedMap as unknown as Record<PropertyKey, unknown>,
          key,
          redactValue(
            nestedValue,
            nestedPath,
            options,
            ancestors,
            isSensitive,
            binaryState
          )
        )
      }
      ancestors.delete(value)
      return redactedMap
    }

    if (value instanceof Set) {
      ancestors.add(value)
      const redactedSet = new Set<unknown>()
      let index = 0
      for (const entry of value) {
        redactedSet.add(
          redactValue(
            entry,
            path ? `${path}.${index}` : String(index),
            options,
            ancestors,
            isSensitive,
            binaryState
          )
        )
        index++
      }
      for (const key of getEnumerableDevToolsKeys(value)) {
        const nestedValue = (value as unknown as Record<PropertyKey, unknown>)[key]
        const nestedPath = getDevToolsPropertyPath(path, key)
        setEnumerableProperty(
          redactedSet as unknown as Record<PropertyKey, unknown>,
          key,
          redactValue(
            nestedValue,
            nestedPath,
            options,
            ancestors,
            isSensitive,
            binaryState
          )
        )
      }
      ancestors.delete(value)
      return redactedSet
    }

    if (!isPlainRecord(value)) {
      if (isSensitive) return REDACTED_VALUE

      const clone = cloneDevToolsLeaf(
        value,
        new WeakMap<object, unknown>(),
        binaryState
      ) as Record<
        PropertyKey,
        unknown
      >
      ancestors.add(value)
      if (value instanceof Error) {
        const causePath = path ? `${path}.cause` : 'cause'
        const causeIsSensitive =
          !options.includeSensitiveValues &&
          isSensitiveField(causePath, options.sensitiveFields ?? [])
        if (
          Object.prototype.hasOwnProperty.call(value, 'cause') &&
          (!Object.is(value.cause, value) || causeIsSensitive)
        ) {
          Object.defineProperty(clone, 'cause', {
            configurable: true,
            enumerable: false,
            value: causeIsSensitive && Object.is(value.cause, value)
              ? REDACTED_VALUE
              : redactValue(
                  value.cause,
                  causePath,
                  options,
                  ancestors,
                  isSensitive,
                  binaryState
                ),
            writable: true,
          })
        }

        let redactStack = false
        for (const key of ['name', 'message'] as const) {
          const nestedPath = getDevToolsPropertyPath(path, key)
          const nestedValue = value[key]
          const protectedValue = redactValue(
            nestedValue,
            nestedPath,
            options,
            ancestors,
            false,
            binaryState
          )
          if (!Object.is(protectedValue, nestedValue)) redactStack = true
          Object.defineProperty(clone, key, {
            configurable: true,
            enumerable: Object.prototype.propertyIsEnumerable.call(value, key),
            value: protectedValue,
            writable: true,
          })
        }
        Object.defineProperty(clone, 'stack', {
          configurable: true,
          enumerable: Object.prototype.propertyIsEnumerable.call(value, 'stack'),
          value: value.stack === undefined
            ? undefined
            : redactStack
              ? REDACTED_VALUE
              : redactValue(
                  value.stack,
                  getDevToolsPropertyPath(path, 'stack'),
                  options,
                  ancestors,
                  false,
                  binaryState
                ),
          writable: true,
        })
      }
      const enumerableKeys = getEnumerableDevToolsKeys(
        value,
        ArrayBuffer.isView(value)
      )
      for (const key of enumerableKeys) {
        if (
          value instanceof Error &&
          (key === 'cause' || key === 'name' || key === 'message' || key === 'stack')
        ) {
          continue
        }
        const nestedValue = (value as Record<PropertyKey, unknown>)[key]
        const nestedPath = getDevToolsPropertyPath(path, key)
        if (
          Object.is(nestedValue, value) &&
          !isSensitiveField(nestedPath, options.sensitiveFields ?? [])
        ) {
          // The detached built-in clone already points this direct cycle back
          // to itself. Keep that identity instead of replacing it with text.
          continue
        }
        setEnumerableProperty(
          clone,
          key,
          redactValue(
            nestedValue,
            nestedPath,
            options,
            ancestors,
            false,
            binaryState
          )
        )
      }
      ancestors.delete(value)
      return clone
    }

    ancestors.add(value)
    const redactedObject: Record<PropertyKey, unknown> = {}
    for (const key of getEnumerableDevToolsKeys(value)) {
      const nestedValue = (value as Record<PropertyKey, unknown>)[key]
      const nestedPath = getDevToolsPropertyPath(path, key)
      setEnumerableProperty(
        redactedObject,
        key,
        redactValue(
          nestedValue,
          nestedPath,
          options,
          ancestors,
          isSensitive,
          binaryState
        )
      )
    }
    ancestors.delete(value)
    return redactedObject
  }

  if (isSensitive) return REDACTED_VALUE
  return value
}

/**
 * Form state snapshot for DevTools
 */
export interface FormSnapshot<Values extends object> {
  /**
   * Current form values
   */
  values: DevToolsValue<Values>

  /**
   * Current errors
   */
  errors: Partial<Record<Path<Values>, string>>

  /**
   * Touched fields
   */
  touched: Partial<Record<Path<Values>, boolean>>

  /**
   * Form state flags
   */
  state: {
    isValid: boolean
    isDirty: boolean
    isSubmitting: boolean
    isSubmitted: boolean
    isValidating: boolean
    submitCount: number
  }

  /**
   * Field-level state
   */
  fields: Array<{
    name: string
    value: unknown
    error?: string
    touched: boolean
    dirty: boolean
  }>

  /**
   * Snapshot timestamp
   */
  timestamp: number
}

/**
 * Create a form state snapshot for DevTools inspection
 *
 * @param formState - Current form state
 * @param initialValues - Initial form values (for dirty detection)
 * @param options - Privacy options. Sensitive values are redacted by default.
 * @returns Form snapshot
 *
 * @example
 * ```ts
 * const snapshot = createFormSnapshot(form, initialValues)
 * console.log('Form State:', snapshot)
 * ```
 */
export function createFormSnapshot<Values extends object>(
  formState: FormState<Values>,
  initialValues: Values,
  options: DevToolsPrivacyOptions = {}
): FormSnapshot<Values> {
  // Extract field information
  const fields: Array<{
    name: string
    value: unknown
    error?: string
    touched: boolean
    dirty: boolean
  }> = []

  const extractionAncestors = new WeakSet<object>()
  const snapshotEqualityState = createDevToolsEqualityState()
  const snapshotBinaryState = createDevToolsBinaryCloneState()
  const directlyDirtyPaths = new Set<string>()
  const redactedValues = redactDevToolsValueWithState(
    formState.values,
    '',
    options,
    snapshotBinaryState
  ) as DevToolsValue<Values>
  const errors: Partial<Record<Path<Values>, string>> = {}
  for (const [path, error] of Object.entries(formState.errors)) {
    if (typeof error === 'string') {
      errors[path as Path<Values>] = redactDevToolsErrorValue(
        error,
        path,
        options,
        snapshotBinaryState
      ) as string
    }
  }

  function extractFields(
    obj: object,
    redactedObj: unknown,
    parentPath = ''
  ): void {
    const firstChildField = fields.length
    extractionAncestors.add(obj)
    for (const [key, value] of Object.entries(obj)) {
      const path = parentPath ? `${parentPath}.${key}` : key
      const redactedValue =
        redactedObj !== null && typeof redactedObj === 'object'
          ? (redactedObj as Record<string, unknown>)[key]
          : redactedObj

      if (
        value !== null &&
        typeof value === 'object' &&
        isPlainRecord(value) &&
        redactedValue !== null &&
        typeof redactedValue === 'object' &&
        isPlainRecord(redactedValue) &&
        !extractionAncestors.has(value)
      ) {
        // Recurse for nested objects
        extractFields(value, redactedValue, path)
      } else {
        // Add field info
        const initialValue = getNestedValue(initialValues, path)
        const error = errors[path as Path<Values>]
        if (!areDevToolsValuesEqual(value, initialValue)) {
          directlyDirtyPaths.add(path)
        }
        const candidateState = createDevToolsEqualityState(snapshotEqualityState)
        const dirty = !areDevToolsValuesEqual(
          value,
          initialValue,
          candidateState
        )
        if (!dirty) {
          commitDevToolsEqualityState(candidateState, snapshotEqualityState)
        }
        const fieldInfo: {
          name: string
          value: unknown
          error?: string
          touched: boolean
          dirty: boolean
        } = {
          name: path,
          value: redactedValue,
          touched: formState.touched[path as Path<Values>] ?? false,
          dirty,
        }
        if (error !== undefined) {
          fieldInfo.error = error
        }
        fields.push(fieldInfo)
      }
    }
    extractionAncestors.delete(obj)

    if (
      parentPath &&
      !areDevToolsValuesEqual(obj, getNestedValue(initialValues, parentPath)) &&
      fields
        .slice(firstChildField)
        .every((field) => !directlyDirtyPaths.has(field.name))
    ) {
      const error = errors[parentPath as Path<Values>]
      fields.push({
        name: parentPath,
        value: redactedObj,
        ...(error === undefined ? {} : { error }),
        touched: formState.touched[parentPath as Path<Values>] ?? false,
        dirty: true,
      })
    }
  }

  extractFields(formState.values, redactedValues)

  return {
    values: redactedValues,
    errors,
    touched: { ...formState.touched },
    state: {
      isValid: formState.isValid,
      isDirty: formState.isDirty,
      isSubmitting: formState.isSubmitting,
      isSubmitted: formState.isSubmitted,
      isValidating: formState.isValidating,
      submitCount: formState.submitCount,
    },
    fields,
    timestamp: Date.now(),
  }
}

/**
 * Get nested value from object by path
 */
function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[key]
  }, obj)
}

function getProtectedDevToolsPath(
  value: unknown,
  path: string
): { complete: boolean; value: unknown } {
  let current = value
  for (const key of path.split('.')) {
    if (
      current === null ||
      typeof current !== 'object' ||
      !Object.prototype.hasOwnProperty.call(current, key)
    ) {
      return { complete: false, value: current }
    }
    current = (current as Record<string, unknown>)[key]
  }
  return { complete: true, value: current }
}

function getTransformedDevToolsAncestor(
  path: string,
  state: DevToolsBinaryCloneState
): { found: boolean; value: unknown } {
  if (state.transformedValues.has('')) {
    return { found: true, value: state.transformedValues.get('') }
  }

  let prefix = ''
  for (const segment of path.split('.')) {
    prefix = prefix ? `${prefix}.${segment}` : segment
    if (state.transformedValues.has(prefix)) {
      return { found: true, value: state.transformedValues.get(prefix) }
    }
  }
  return { found: false, value: undefined }
}

function redactDevToolsErrorValue(
  error: string,
  path: string,
  options: DevToolsPrivacyOptions,
  state: DevToolsBinaryCloneState
): string {
  const transformedAncestor = getTransformedDevToolsAncestor(path, state)
  if (transformedAncestor.found) {
    return typeof transformedAncestor.value === 'string'
      ? transformedAncestor.value
      : REDACTED_VALUE
  }
  return redactDevToolsValueWithState(error, path, options, state) as string
}

function protectSnapshot<Values extends object>(
  snapshot: FormSnapshot<Values>,
  options: DevToolsPrivacyOptions
): FormSnapshot<Values> {
  const snapshotBinaryState = createDevToolsBinaryCloneState()
  const values = redactDevToolsValueWithState(
    snapshot.values,
    '',
    options,
    snapshotBinaryState
  ) as DevToolsValue<Values>
  const errors: Partial<Record<Path<Values>, string>> = {}
  for (const [path, error] of Object.entries(snapshot.errors)) {
    if (typeof error === 'string') {
      errors[path as Path<Values>] = redactDevToolsErrorValue(
        error,
        path,
        options,
        snapshotBinaryState
      ) as string
    }
  }

  return {
    values,
    errors,
    touched: { ...snapshot.touched },
    state: { ...snapshot.state },
    fields: snapshot.fields.map((field) => {
      const protectedPath = getProtectedDevToolsPath(values, field.name)
      const protectedValue = protectedPath.complete
        ? protectedPath.value
        : typeof protectedPath.value === 'string'
          ? protectedPath.value
          : REDACTED_VALUE
      const protectedError = Object.prototype.hasOwnProperty.call(
        errors,
        field.name
      )
        ? errors[field.name as Path<Values>]
        : field.error === undefined
          ? undefined
          : redactDevToolsErrorValue(
              field.error,
              field.name,
              options,
              snapshotBinaryState
            )
      return {
        ...field,
        value: protectedValue,
        ...(protectedError === undefined ? {} : { error: protectedError }),
      }
    }),
    timestamp: snapshot.timestamp,
  }
}

/**
 * Log form state to console in a developer-friendly format
 *
 * @param formId - Form identifier
 * @param snapshot - Form snapshot
 * @param options - Privacy options. Sensitive values are redacted by default.
 *
 * @example
 * ```ts
 * logFormState('signup-form', createFormSnapshot(form, initialValues))
 * ```
 */
export function logFormState<Values extends object>(
  formId: string,
  snapshot: FormSnapshot<Values>,
  options: DevToolsPrivacyOptions = {}
): void {
  const protectedSnapshot = protectSnapshot(snapshot, options)

  console.group(`📋 Form State: ${formId}`)

  // Overall state
  console.log('State:', protectedSnapshot.state)

  // Values
  console.log('Values:', protectedSnapshot.values)

  // Errors (if any)
  if (Object.keys(protectedSnapshot.errors).length > 0) {
    console.error('Errors:', protectedSnapshot.errors)
  }

  // Touched fields
  const touchedFields = Object.keys(protectedSnapshot.touched)
  if (touchedFields.length > 0) {
    console.log('Touched Fields:', touchedFields)
  }

  // Field details
  console.table(
    protectedSnapshot.fields.map((field) => ({
      Field: field.name,
      Value: JSON.stringify(field.value),
      Error: field.error || '-',
      Touched: field.touched ? '✓' : '',
      Dirty: field.dirty ? '✓' : '',
    }))
  )

  console.groupEnd()
}

/**
 * Expose form state to window for DevTools access
 *
 * @param formId - Form identifier
 * @param snapshot - Form snapshot
 * @param options - Explicit exposure and privacy options
 *
 * @returns Cleanup function that removes this exposure
 *
 * @example
 * ```ts
 * // In development, expose form to window
 * if (process.env.NODE_ENV === 'development') {
 *   const cleanup = exposeFormToWindow(
 *     'signup-form',
 *     createFormSnapshot(form, initialValues),
 *     { enabled: true }
 *   )
 * }
 *
 * // Then in DevTools console:
 * window.__NEO_FORMS__.['signup-form']
 * ```
 */
export function exposeFormToWindow<Values extends object>(
  formId: string,
  snapshot: FormSnapshot<Values>,
  options: ExposeFormOptions
): () => void {
  const noCleanupNeeded = (): void => {}
  if (typeof window === 'undefined' || options.enabled !== true) {
    return noCleanupNeeded
  }

  const runtimeProcess = (
    globalThis as typeof globalThis & {
      process?: { env?: { NODE_ENV?: string } }
    }
  ).process
  const runtimeEnvironment = runtimeProcess?.env?.NODE_ENV
  const isDevelopmentEnvironment =
    runtimeEnvironment === 'development' || runtimeEnvironment === 'test'
  if (!isDevelopmentEnvironment && !options.allowInProduction) {
    return noCleanupNeeded
  }

  const protectedSnapshot = protectSnapshot(snapshot, options)
  const devToolsWindow = window as Window & {
    __NEO_FORMS__?: Record<string, unknown>
  }

  // Create global forms object if it doesn't exist
  if (!devToolsWindow.__NEO_FORMS__) {
    devToolsWindow.__NEO_FORMS__ = Object.create(null) as Record<string, unknown>
  }

  devToolsWindow.__NEO_FORMS__[formId] = protectedSnapshot

  // Log helpful message
  console.log(
    `📋 Form "${formId}" exposed to DevTools: window.__NEO_FORMS__['${formId}']`
  )

  return () => {
    const registry = devToolsWindow.__NEO_FORMS__
    if (!registry || registry[formId] !== protectedSnapshot) return

    delete registry[formId]
    if (Object.keys(registry).length === 0) {
      delete devToolsWindow.__NEO_FORMS__
    }
  }
}

/**
 * Create a form state diff between two snapshots
 *
 * @param before - Previous snapshot
 * @param after - Current snapshot
 * @returns Diff object
 */
export function diffFormState<Values extends object>(
  before: FormSnapshot<Values>,
  after: FormSnapshot<Values>
): {
  changedFields: string[]
  newErrors: Partial<Record<Path<Values>, string>>
  clearedErrors: string[]
  touchedFields: string[]
} {
  const changedFields: string[] = []
  const newErrors: Partial<Record<Path<Values>, string>> = {}
  const clearedErrors: string[] = []
  const touchedFields: string[] = []

  // Find changed fields
  const beforeFields = new Map(before.fields.map((field) => [field.name, field]))
  const diffEqualityState = createDevToolsEqualityState()
  after.fields.forEach((afterField) => {
    const beforeField = beforeFields.get(afterField.name)
    const candidateState = createDevToolsEqualityState(diffEqualityState)
    const valuesEqual = beforeField !== undefined && areDevToolsValuesEqual(
      beforeField.value,
      afterField.value,
      candidateState
    )
    if (valuesEqual) {
      commitDevToolsEqualityState(candidateState, diffEqualityState)
    }
    if (
      !beforeField ||
      !valuesEqual ||
      beforeField.dirty !== afterField.dirty
    ) {
      changedFields.push(afterField.name)
    }
  })
  const afterFieldNames = new Set(after.fields.map((field) => field.name))
  for (const beforeField of before.fields) {
    if (!afterFieldNames.has(beforeField.name)) {
      changedFields.push(beforeField.name)
    }
  }

  // Find new errors
  for (const [field, error] of Object.entries(after.errors)) {
    if (
      typeof error === 'string' &&
      !Object.prototype.hasOwnProperty.call(before.errors, field)
    ) {
      newErrors[field as Path<Values>] = error
    }
  }

  // Find cleared errors
  for (const field of Object.keys(before.errors)) {
    if (!Object.prototype.hasOwnProperty.call(after.errors, field)) {
      clearedErrors.push(field)
    }
  }

  // Find newly touched fields
  for (const [field, touched] of Object.entries(after.touched)) {
    if (touched && !before.touched[field as Path<Values>]) {
      touchedFields.push(field)
    }
  }

  return {
    changedFields,
    newErrors,
    clearedErrors,
    touchedFields,
  }
}

/**
 * Performance metrics for form operations
 */
export interface PerformanceMetrics {
  /**
   * Time to validate a field (ms)
   */
  validationTime: number

  /**
   * Time to submit form (ms)
   */
  submissionTime: number

  /**
   * Time to re-render after value change (ms)
   */
  renderTime: number

  /**
   * Total fields in form
   */
  fieldCount: number

  /**
   * Number of re-renders
   */
  renderCount: number
}

/**
 * Create performance monitor for a form
 *
 * @returns Performance monitor object
 */
export function createPerformanceMonitor(): {
  startTimer: (operation: string) => () => void
  getMetrics: () => Record<string, number>
  logMetrics: () => void
} {
  interface MetricAggregate {
    count: number
    max: number
    min: number
    total: number
  }

  const MAX_TRACKED_OPERATIONS = 1000
  const OVERFLOW_OPERATION = '[other operations]'
  const metrics = new Map<string, MetricAggregate>()

  const getOperationKey = (operation: string): string => {
    if (metrics.has(operation)) return operation
    return metrics.size < MAX_TRACKED_OPERATIONS - 1
      ? operation
      : OVERFLOW_OPERATION
  }

  const rounded = (value: number): number => Math.round(value * 100) / 100

  return {
    startTimer: (operation: string) => {
      const start = performance.now()
      return () => {
        const duration = performance.now() - start
        const operationKey = getOperationKey(operation)
        const aggregate = metrics.get(operationKey)
        if (aggregate) {
          aggregate.count++
          aggregate.max = Math.max(aggregate.max, duration)
          aggregate.min = Math.min(aggregate.min, duration)
          aggregate.total += duration
        } else {
          metrics.set(operationKey, {
            count: 1,
            max: duration,
            min: duration,
            total: duration,
          })
        }
      }
    },

    getMetrics: () => {
      const result: Record<string, number> = {}
      for (const [operation, aggregate] of metrics) {
        setEnumerableProperty(
          result,
          operation,
          rounded(aggregate.total / aggregate.count)
        )
      }
      return result
    },

    logMetrics: () => {
      const result = Array.from(metrics, ([operation, aggregate]) => {
        return {
          Operation: operation,
          'Avg (ms)': rounded(aggregate.total / aggregate.count),
          'Min (ms)': rounded(aggregate.min),
          'Max (ms)': rounded(aggregate.max),
          Count: aggregate.count,
        }
      })

      console.group('⚡ Form Performance Metrics')
      console.table(result)
      console.groupEnd()
    },
  }
}
