import type { DeepReadonly } from '../types.js'

const enumerableArrayMetadataKeys = new WeakMap<object, readonly PropertyKey[]>()

function isCanonicalArrayIndex(key: PropertyKey): boolean {
  return (
    typeof key === 'string' &&
    /^(0|[1-9]\d*)$/.test(key) &&
    Number(key) <= 4_294_967_294
  )
}

function acceptsIntrinsicReceiver(
  operation: (value: object) => unknown,
  value: object
): boolean {
  try {
    operation(value)
    return true
  } catch {
    return false
  }
}

const dateGetTime = Date.prototype.getTime
const regexpSource = Object.getOwnPropertyDescriptor(RegExp.prototype, 'source')
  ?.get
const regexpFlagGetters = [
  ['d', Object.getOwnPropertyDescriptor(RegExp.prototype, 'hasIndices')?.get],
  ['g', Object.getOwnPropertyDescriptor(RegExp.prototype, 'global')?.get],
  ['i', Object.getOwnPropertyDescriptor(RegExp.prototype, 'ignoreCase')?.get],
  ['m', Object.getOwnPropertyDescriptor(RegExp.prototype, 'multiline')?.get],
  ['s', Object.getOwnPropertyDescriptor(RegExp.prototype, 'dotAll')?.get],
  ['u', Object.getOwnPropertyDescriptor(RegExp.prototype, 'unicode')?.get],
  ['v', Object.getOwnPropertyDescriptor(RegExp.prototype, 'unicodeSets')?.get],
  ['y', Object.getOwnPropertyDescriptor(RegExp.prototype, 'sticky')?.get],
] as const
const mapSize = Object.getOwnPropertyDescriptor(Map.prototype, 'size')?.get
const setSize = Object.getOwnPropertyDescriptor(Set.prototype, 'size')?.get
const weakMapHas = WeakMap.prototype.has
const weakSetHas = WeakSet.prototype.has
const arrayBufferByteLength = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  'byteLength'
)?.get
const arrayBufferResizable = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  'resizable'
)?.get
const sharedArrayBufferByteLength =
  typeof SharedArrayBuffer === 'undefined'
    ? undefined
    : Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, 'byteLength')
        ?.get
const sharedArrayBufferGrowable =
  typeof SharedArrayBuffer === 'undefined'
    ? undefined
    : Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, 'growable')
        ?.get
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object
const typedArrayBuffer = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  'buffer'
)?.get
const typedArrayByteOffset = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  'byteOffset'
)?.get
const typedArrayLength = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  'length'
)?.get
const dataViewBuffer = Object.getOwnPropertyDescriptor(DataView.prototype, 'buffer')
  ?.get
const dataViewByteOffset = Object.getOwnPropertyDescriptor(
  DataView.prototype,
  'byteOffset'
)?.get
const dataViewByteLength = Object.getOwnPropertyDescriptor(
  DataView.prototype,
  'byteLength'
)?.get
const blobSize =
  typeof Blob === 'undefined'
    ? undefined
    : Object.getOwnPropertyDescriptor(Blob.prototype, 'size')?.get
const fileName =
  typeof File === 'undefined'
    ? undefined
    : Object.getOwnPropertyDescriptor(File.prototype, 'name')?.get
const fileListLength =
  typeof FileList === 'undefined'
    ? undefined
    : Object.getOwnPropertyDescriptor(FileList.prototype, 'length')?.get

function isLocalArrayBufferView(value: ArrayBufferView): boolean {
  const prototype = Object.getPrototypeOf(value)
  return [
    DataView.prototype,
    Int8Array.prototype,
    Uint8Array.prototype,
    Uint8ClampedArray.prototype,
    Int16Array.prototype,
    Uint16Array.prototype,
    Int32Array.prototype,
    Uint32Array.prototype,
    Float32Array.prototype,
    Float64Array.prototype,
    ...(typeof BigInt64Array === 'undefined' ? [] : [BigInt64Array.prototype]),
    ...(typeof BigUint64Array === 'undefined' ? [] : [BigUint64Array.prototype]),
  ].includes(prototype)
}

function isLocalArrayBufferViewFamily(value: ArrayBufferView): boolean {
  return (
    value instanceof DataView ||
    value instanceof Int8Array ||
    value instanceof Uint8Array ||
    value instanceof Uint8ClampedArray ||
    value instanceof Int16Array ||
    value instanceof Uint16Array ||
    value instanceof Int32Array ||
    value instanceof Uint32Array ||
    value instanceof Float32Array ||
    value instanceof Float64Array ||
    (typeof BigInt64Array !== 'undefined' && value instanceof BigInt64Array) ||
    (typeof BigUint64Array !== 'undefined' && value instanceof BigUint64Array)
  )
}

function rejectBuiltInSubclass(): never {
  throw new TypeError('Form values cannot contain subclasses of built-in objects')
}

function structuredCloneIsError(value: object): boolean {
  try {
    return structuredClone(value) instanceof Error
  } catch {
    return false
  }
}

function assertLocalSupportedBuiltIn(value: object): void {
  const prototype = Object.getPrototypeOf(value)
  if (Array.isArray(value)) {
    if (prototype === Array.prototype) return
    if (value instanceof Array) rejectBuiltInSubclass()
    throw new TypeError(
      'Form values cannot contain built-in objects from another JavaScript realm'
    )
  }
  if (prototype === Object.prototype || prototype === null) {
    return
  }

  if (ArrayBuffer.isView(value)) {
    if (isLocalArrayBufferView(value)) return
    if (isLocalArrayBufferViewFamily(value)) rejectBuiltInSubclass()
    throw new TypeError(
      'Form values cannot contain built-in objects from another JavaScript realm'
    )
  }

  if (value instanceof Date) {
    if (prototype !== Date.prototype) rejectBuiltInSubclass()
    return
  }
  if (value instanceof RegExp) {
    if (prototype !== RegExp.prototype) rejectBuiltInSubclass()
    return
  }
  if (value instanceof Map) {
    if (prototype !== Map.prototype) rejectBuiltInSubclass()
    return
  }
  if (value instanceof Set) {
    if (prototype !== Set.prototype) rejectBuiltInSubclass()
    return
  }
  if (value instanceof ArrayBuffer) {
    if (prototype !== ArrayBuffer.prototype) rejectBuiltInSubclass()
    if (arrayBufferResizable?.call(value)) {
      throw new TypeError('Form values cannot contain resizable or growable buffers')
    }
    return
  }
  if (typeof SharedArrayBuffer !== 'undefined' && value instanceof SharedArrayBuffer) {
    if (prototype !== SharedArrayBuffer.prototype) rejectBuiltInSubclass()
    if (sharedArrayBufferGrowable?.call(value)) {
      throw new TypeError('Form values cannot contain resizable or growable buffers')
    }
    return
  }
  if (
    typeof AggregateError !== 'undefined' &&
    value instanceof AggregateError
  ) {
    throw new TypeError('Form values cannot contain AggregateError instances')
  }
  if (value instanceof Error) return
  if (typeof File !== 'undefined' && value instanceof File) {
    if (prototype !== File.prototype) rejectBuiltInSubclass()
    return
  }
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    if (prototype !== Blob.prototype) rejectBuiltInSubclass()
    return
  }
  if (typeof FileList !== 'undefined' && value instanceof FileList) {
    if (prototype !== FileList.prototype) rejectBuiltInSubclass()
    return
  }

  const tag = Object.prototype.toString.call(value)
  const brandedWeakCollection =
    (tag === '[object WeakMap]' &&
      acceptsIntrinsicReceiver(
        (entry) => weakMapHas.call(entry, value),
        value
      )) ||
    (tag === '[object WeakSet]' &&
      acceptsIntrinsicReceiver(
        (entry) => weakSetHas.call(entry, value),
        value
      ))
  if (brandedWeakCollection) {
    throw new TypeError('Form values cannot contain Promise, WeakMap, or WeakSet instances')
  }

  const foreignBuiltIn =
    (tag === '[object Date]' &&
      acceptsIntrinsicReceiver((entry) => dateGetTime.call(entry), value)) ||
    (tag === '[object RegExp]' &&
      regexpSource !== undefined &&
      acceptsIntrinsicReceiver((entry) => regexpSource.call(entry), value)) ||
    (tag === '[object Map]' &&
      mapSize !== undefined &&
      acceptsIntrinsicReceiver((entry) => mapSize.call(entry), value)) ||
    (tag === '[object Set]' &&
      setSize !== undefined &&
      acceptsIntrinsicReceiver((entry) => setSize.call(entry), value)) ||
    (tag === '[object ArrayBuffer]' &&
      arrayBufferByteLength !== undefined &&
      acceptsIntrinsicReceiver(
        (entry) => arrayBufferByteLength.call(entry),
        value
      )) ||
    (tag === '[object SharedArrayBuffer]' &&
      sharedArrayBufferByteLength !== undefined &&
      acceptsIntrinsicReceiver(
        (entry) => sharedArrayBufferByteLength.call(entry),
        value
      )) ||
    ((tag === '[object Blob]' || tag === '[object File]') &&
      ((blobSize !== undefined &&
        acceptsIntrinsicReceiver((entry) => blobSize.call(entry), value)) ||
        (fileName !== undefined &&
          acceptsIntrinsicReceiver((entry) => fileName.call(entry), value)))) ||
    (tag === '[object FileList]' &&
      fileListLength !== undefined &&
      acceptsIntrinsicReceiver((entry) => fileListLength.call(entry), value)) ||
    (tag === '[object Error]' && structuredCloneIsError(value))

  if (!foreignBuiltIn) return
  throw new TypeError(
    'Form values cannot contain built-in objects from another JavaScript realm'
  )
}

function readRegExpFlags(value: RegExp): string {
  let flags = ''
  for (const [flag, getter] of regexpFlagGetters) {
    if (getter?.call(value)) flags += flag
  }
  return flags
}

function createBaseArrayBufferView(
  value: ArrayBufferView,
  buffer: ArrayBuffer
): ArrayBufferView {
  const prototype = Object.getPrototypeOf(value)
  if (prototype === DataView.prototype) {
    return new DataView(
      buffer,
      dataViewByteOffset?.call(value) as number,
      dataViewByteLength?.call(value) as number
    )
  }

  const byteOffset = typedArrayByteOffset?.call(value) as number
  const length = typedArrayLength?.call(value) as number
  if (prototype === Int8Array.prototype) return new Int8Array(buffer, byteOffset, length)
  if (prototype === Uint8Array.prototype) return new Uint8Array(buffer, byteOffset, length)
  if (prototype === Uint8ClampedArray.prototype) {
    return new Uint8ClampedArray(buffer, byteOffset, length)
  }
  if (prototype === Int16Array.prototype) return new Int16Array(buffer, byteOffset, length)
  if (prototype === Uint16Array.prototype) return new Uint16Array(buffer, byteOffset, length)
  if (prototype === Int32Array.prototype) return new Int32Array(buffer, byteOffset, length)
  if (prototype === Uint32Array.prototype) return new Uint32Array(buffer, byteOffset, length)
  if (prototype === Float32Array.prototype) return new Float32Array(buffer, byteOffset, length)
  if (prototype === Float64Array.prototype) return new Float64Array(buffer, byteOffset, length)
  if (typeof BigInt64Array !== 'undefined' && prototype === BigInt64Array.prototype) {
    return new BigInt64Array(buffer, byteOffset, length)
  }
  if (typeof BigUint64Array !== 'undefined' && prototype === BigUint64Array.prototype) {
    return new BigUint64Array(buffer, byteOffset, length)
  }
  throw new TypeError('Unsupported typed view')
}

function readEnumerableArrayMetadataKeys(value: unknown[]): readonly PropertyKey[] {
  const cached = enumerableArrayMetadataKeys.get(value)
  if (cached) return cached
  const keys = Reflect.ownKeys(value).filter(
    (key) =>
      !isCanonicalArrayIndex(key) &&
      Object.prototype.propertyIsEnumerable.call(value, key)
  )
  enumerableArrayMetadataKeys.set(value, keys)
  return keys
}

/** @internal Copy cached non-index array properties during shallow path updates. */
export function copyEnumerableArrayMetadata(
  source: unknown[],
  target: unknown[]
): void {
  const keys = readEnumerableArrayMetadataKeys(source)
  for (const key of keys) {
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: true,
      value: (source as unknown as Record<PropertyKey, unknown>)[key],
      writable: true,
    })
  }
  const targetKeys = enumerableArrayMetadataKeys.get(target) ?? []
  enumerableArrayMetadataKeys.set(target, Array.from(new Set([...targetKeys, ...keys])))
}

/** @internal Track a non-index property added by an immutable path update. */
export function registerEnumerableArrayMetadataKey(
  target: unknown[],
  key: PropertyKey
): void {
  if (isCanonicalArrayIndex(key)) return
  const keys = enumerableArrayMetadataKeys.get(target) ?? []
  if (!keys.includes(key)) enumerableArrayMetadataKeys.set(target, [...keys, key])
}

function freezeSnapshot(value: unknown, seen: WeakSet<object>): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)

  if (value instanceof Map) {
    for (const [key, entry] of value) {
      freezeSnapshot(key, seen)
      freezeSnapshot(entry, seen)
    }
    Object.freeze(value)
    return
  }

  if (value instanceof Set) {
    for (const entry of value) freezeSnapshot(entry, seen)
    Object.freeze(value)
    return
  }

  if (value instanceof RegExp || ArrayBuffer.isView(value)) return

  for (const entry of Object.values(value)) freezeSnapshot(entry, seen)
  Object.freeze(value)
}

/**
 * Create a stable read-only copy for user callbacks.
 * Mutations cannot change the live store, including mutations to built-in values.
 */
export function createImmutableSnapshot<Value>(value: Value): DeepReadonly<Value> {
  if (
    value === null ||
    (typeof value !== 'object' &&
      typeof value !== 'function' &&
      typeof value !== 'symbol')
  ) {
    return value as DeepReadonly<Value>
  }
  const snapshot = cloneSnapshotGraph(value, new WeakMap<object, unknown>())
  freezeSnapshot(snapshot, new WeakSet<object>())
  return snapshot as DeepReadonly<Value>
}

const immutableSnapshotCache = new WeakMap<object, unknown>()
const lazyImmutableSnapshotCache = new WeakMap<object, unknown>()

/**
 * Reuse a detached snapshot while its immutable source identity is unchanged.
 */
export function createCachedImmutableSnapshot<Value>(
  value: Value
): DeepReadonly<Value> {
  if (
    value === null ||
    (typeof value !== 'object' &&
      typeof value !== 'function' &&
      typeof value !== 'symbol')
  ) {
    return value as DeepReadonly<Value>
  }

  if (typeof value === 'symbol') return createImmutableSnapshot(value)

  const cached = immutableSnapshotCache.get(value)
  if (cached !== undefined) return cached as DeepReadonly<Value>

  const snapshot = createImmutableSnapshot(value)
  immutableSnapshotCache.set(value, snapshot)
  return snapshot
}

function cloneSnapshotGraph(
  value: unknown,
  clones: WeakMap<object, unknown>
): unknown {
  if (typeof value === 'symbol' || typeof value === 'function') {
    throw new TypeError('Form values cannot contain symbols or functions')
  }
  if (value === null || typeof value !== 'object') return value

  assertLocalSupportedBuiltIn(value)

  if (
    typeof (value as { then?: unknown }).then === 'function' ||
    value instanceof WeakMap ||
    value instanceof WeakSet
  ) {
    throw new TypeError('Form values cannot contain Promise, WeakMap, or WeakSet instances')
  }

  const cached = clones.get(value)
  if (cached !== undefined) return cached

  const copyEnumerableProperties = (
    clone: object,
    includeSymbols = true,
    includeArrayIndices = true,
    includeStringProperties = true
  ): void => {
    const keys: PropertyKey[] = includeStringProperties
      ? Reflect.ownKeys(value)
      : includeSymbols
        ? Object.getOwnPropertySymbols(value)
        : []
    for (const key of keys) {
      if (!includeSymbols && typeof key === 'symbol') continue
      if (
        !includeArrayIndices &&
        isCanonicalArrayIndex(key)
      ) {
        continue
      }
      if (!Object.prototype.propertyIsEnumerable.call(value, key)) continue
      Object.defineProperty(clone, key, {
        configurable: true,
        enumerable: true,
        value: cloneSnapshotGraph(
          (value as unknown as Record<PropertyKey, unknown>)[key],
          clones
        ),
        writable: true,
      })
    }
  }

  if (value instanceof Date) {
    const clone = new Date(dateGetTime.call(value))
    clones.set(value, clone)
    copyEnumerableProperties(clone)
    return clone
  }

  if (value instanceof RegExp) {
    const clone = new RegExp(
      regexpSource?.call(value) as string,
      readRegExpFlags(value)
    )
    clone.lastIndex = value.lastIndex
    clones.set(value, clone)
    copyEnumerableProperties(clone)
    return clone
  }

  if (value instanceof Map) {
    const clone = new Map<unknown, unknown>()
    clones.set(value, clone)
    const entries = Map.prototype.entries.call(value) as IterableIterator<[
      unknown,
      unknown,
    ]>
    for (const [key, entry] of entries) {
      Map.prototype.set.call(
        clone,
        cloneSnapshotGraph(key, clones),
        cloneSnapshotGraph(entry, clones)
      )
    }
    copyEnumerableProperties(clone)
    return clone
  }

  if (value instanceof Set) {
    const clone = new Set<unknown>()
    clones.set(value, clone)
    const entries = Set.prototype.values.call(value) as IterableIterator<unknown>
    for (const entry of entries) {
      Set.prototype.add.call(clone, cloneSnapshotGraph(entry, clones))
    }
    copyEnumerableProperties(clone)
    return clone
  }

  if (value instanceof ArrayBuffer) {
    const byteLength = arrayBufferByteLength?.call(value) as number
    const clone = new ArrayBuffer(byteLength)
    clones.set(value, clone)
    new Uint8Array(clone).set(new Uint8Array(value))
    copyEnumerableProperties(clone)
    return clone
  }

  if (
    typeof SharedArrayBuffer !== 'undefined' &&
    value instanceof SharedArrayBuffer
  ) {
    const byteLength = sharedArrayBufferByteLength?.call(value) as number
    const clone = new ArrayBuffer(byteLength)
    clones.set(value, clone)
    new Uint8Array(clone).set(new Uint8Array(value))
    copyEnumerableProperties(clone)
    return clone
  }

  if (ArrayBuffer.isView(value)) {
    const sourceBuffer = value instanceof DataView
      ? dataViewBuffer?.call(value)
      : typedArrayBuffer?.call(value)
    const buffer = cloneSnapshotGraph(sourceBuffer, clones) as ArrayBuffer
    const clone = createBaseArrayBufferView(value, buffer)
    clones.set(value, clone)
    // Integer-indexed exotic objects expose every byte/element as an own key.
    // Enumerating those keys can throw for large views and duplicates the
    // binary copy already performed by the constructor. Symbol metadata is
    // the only extra metadata that can be copied without walking all indices.
    copyEnumerableProperties(clone, true, false, false)
    return clone
  }

  if (typeof File !== 'undefined' && value instanceof File) {
    const clone = new File([value], value.name, {
      lastModified: value.lastModified,
      type: value.type,
    })
    clones.set(value, clone)
    copyEnumerableProperties(clone, false)
    return clone
  }

  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    const clone = structuredClone(value)
    clones.set(value, clone)
    // Browser implementations can expose internal slots as enumerable symbols.
    copyEnumerableProperties(clone, false)
    return clone
  }

  if (typeof FileList !== 'undefined' && value instanceof FileList) {
    const clone = structuredClone(value)
    clones.set(value, clone)
    copyEnumerableProperties(clone, false, false)
    return clone
  }

  if (value instanceof Error) {
    const clone = Object.create(Object.getPrototypeOf(value)) as Error &
      Record<PropertyKey, unknown>
    clones.set(value, clone)
    Object.defineProperties(clone, {
      name: { configurable: true, value: value.name, writable: true },
      message: { configurable: true, value: value.message, writable: true },
      stack: { configurable: true, value: value.stack, writable: true },
    })
    if ('cause' in value) {
      Object.defineProperty(clone, 'cause', {
        configurable: true,
        value: cloneSnapshotGraph(value.cause, clones),
        writable: true,
      })
    }
    copyEnumerableProperties(clone)
    return clone
  }

  const prototype = Object.getPrototypeOf(value)
  const clone: Record<PropertyKey, unknown> | unknown[] = Array.isArray(value)
    ? new Array(value.length)
    : Object.create(prototype) as Record<PropertyKey, unknown>
  const canAssignDirectly =
    Array.isArray(value) || prototype === Object.prototype || prototype === null
  clones.set(value, clone)
  const ownKeys = Reflect.ownKeys(value)
  if (Array.isArray(value)) {
    const metadataKeys = ownKeys.filter(
      (key) =>
        !isCanonicalArrayIndex(key) &&
        Object.prototype.propertyIsEnumerable.call(value, key)
    )
    enumerableArrayMetadataKeys.set(value, metadataKeys)
    enumerableArrayMetadataKeys.set(clone, metadataKeys)
  }
  for (const key of ownKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor?.enumerable) continue
    const entry = 'value' in descriptor ? descriptor.value : Reflect.get(value, key)
    const clonedEntry = cloneSnapshotGraph(entry, clones)
    if (canAssignDirectly && key !== '__proto__') {
      ;(clone as Record<PropertyKey, unknown>)[key] = clonedEntry
    } else {
      Object.defineProperty(clone, key, {
        configurable: true,
        enumerable: true,
        value: clonedEntry,
        writable: true,
      })
    }
  }
  return clone
}

/**
 * Clone a supported form-value graph without freezing the result.
 */
export function cloneFormValue<Value>(value: Value): Value {
  return cloneSnapshotGraph(value, new WeakMap<object, unknown>()) as Value
}

/**
 * Create a recursively lazy read-only view of an immutable source root.
 * Plain-object and array branches become read-only proxies on demand, while
 * built-ins are detached only when the branch containing them is read.
 */
export function createLazyImmutableSnapshot<Value extends object>(
  value: Value
): DeepReadonly<Value> {
  const prototype = Object.getPrototypeOf(value)
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    return createImmutableSnapshot(value)
  }

  const snapshots = new WeakMap<object, unknown>()
  const lazyViews = new Set<object>()

  const snapshotObject = (source: object): unknown => {
    const cached = snapshots.get(source)
    if (cached !== undefined) return cached

    const sourcePrototype = Object.getPrototypeOf(source)
    if (
      !Array.isArray(source) &&
      sourcePrototype !== Object.prototype &&
      sourcePrototype !== null
    ) {
      const clone = cloneSnapshotGraph(source, snapshots)
      const seen = new WeakSet<object>()
      for (const lazyView of lazyViews) seen.add(lazyView)
      freezeSnapshot(clone, seen)
      return clone
    }

    const branches = new Map<PropertyKey, unknown>()
    const proxyTarget = Array.isArray(source)
      ? []
      : Object.create(sourcePrototype) as object
    let snapshot!: object

    const readBranch = (key: PropertyKey): unknown => {
      if (branches.has(key)) return branches.get(key)

      const descriptor = Object.getOwnPropertyDescriptor(source, key)
      if (!descriptor?.enumerable) return Reflect.get(source, key)
      const branch =
        'value' in descriptor ? descriptor.value : Reflect.get(source, key)
      const exposed =
        branch !== null && typeof branch === 'object'
          ? snapshotObject(branch)
          : branch
      branches.set(key, exposed)
      return exposed
    }

    snapshot = new Proxy(proxyTarget, {
      get: (_target, key) => readBranch(key),
      has: (_target, key) => {
        const descriptor = Object.getOwnPropertyDescriptor(source, key)
        return descriptor ? descriptor.enumerable === true : key in source
      },
      ownKeys: () => {
        const keys = Reflect.ownKeys(source).filter((key) =>
          Object.prototype.propertyIsEnumerable.call(source, key)
        )
        return Array.isArray(proxyTarget) ? ['length', ...keys] : keys
      },
      getOwnPropertyDescriptor: (target, key) => {
        if (Array.isArray(target) && key === 'length') {
          return Object.getOwnPropertyDescriptor(target, key)
        }
        const descriptor = Object.getOwnPropertyDescriptor(source, key)
        if (!descriptor?.enumerable) return undefined
        return {
          configurable: true,
          enumerable: true,
          value: readBranch(key),
          writable: false,
        }
      },
      set: () => {
        throw new TypeError('Form snapshots are read-only')
      },
      deleteProperty: () => {
        throw new TypeError('Form snapshots are read-only')
      },
      defineProperty: () => {
        throw new TypeError('Form snapshots are read-only')
      },
      setPrototypeOf: () => {
        throw new TypeError('Form snapshots are read-only')
      },
      preventExtensions: () => {
        throw new TypeError('Form snapshots are read-only')
      },
    })
    snapshots.set(source, snapshot)
    lazyViews.add(snapshot)
    return snapshot
  }

  return snapshotObject(value) as DeepReadonly<Value>
}

/**
 * Reuse a lazy read-only view while its immutable source identity is unchanged.
 */
export function createCachedLazyImmutableSnapshot<Value>(
  value: Value
): DeepReadonly<Value> {
  if (value === null || typeof value !== 'object') {
    return value as DeepReadonly<Value>
  }

  const cached = lazyImmutableSnapshotCache.get(value)
  if (cached !== undefined) return cached as DeepReadonly<Value>

  const snapshot = createLazyImmutableSnapshot(value)
  lazyImmutableSnapshotCache.set(value, snapshot)
  return snapshot as DeepReadonly<Value>
}
