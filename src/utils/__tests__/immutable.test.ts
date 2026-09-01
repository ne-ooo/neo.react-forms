import { describe, expect, it, vi } from 'vitest'
import {
  createImmutableSnapshot,
  createLazyImmutableSnapshot,
} from '../immutable.js'

describe('createImmutableSnapshot', () => {
  it('detaches maps, sets, and typed arrays from the live value', () => {
    const originalMapEntry = { count: 1 }
    const originalSetEntry = { count: 2 }
    const original = {
      map: new Map([['entry', originalMapEntry]]),
      set: new Set([originalSetEntry]),
      bytes: new Uint8Array([3, 4]),
    }

    const snapshot = createImmutableSnapshot(original)

    originalMapEntry.count = 10
    originalSetEntry.count = 20
    original.bytes[0] = 30

    expect(snapshot.map.get('entry')?.count).toBe(1)
    expect(Array.from(snapshot.set)[0]?.count).toBe(2)
    expect(snapshot.bytes[0]).toBe(3)

    ;(snapshot.map as Map<string, { count: number }>).set('snapshot-only', { count: 5 })
    ;(snapshot.set as Set<{ count: number }>).add({ count: 6 })
    ;(snapshot.bytes as Uint8Array)[1] = 40

    expect(original.map.has('snapshot-only')).toBe(false)
    expect(original.set).toHaveLength(1)
    expect(original.bytes[1]).toBe(4)
  })

  it('freezes circular object graphs without recursion errors', () => {
    interface CircularValue {
      name: string
      self?: CircularValue
    }

    const original: CircularValue = { name: 'root' }
    original.self = original

    const snapshot = createImmutableSnapshot(original)

    expect(snapshot.self).toBe(snapshot)
    expect(Object.isFrozen(snapshot)).toBe(true)
  })

  it('clones only lazy snapshot branches that are read', () => {
    const smallBranch = { name: 'Ada' }
    const largeUnrelatedBranch = new Uint8Array(1024 * 1024)
    const source = {
      email: 'person@example.com',
      profile: smallBranch,
      attachment: largeUnrelatedBranch,
    }
    const clone = globalThis.structuredClone.bind(globalThis)
    const cloneSpy = vi
      .spyOn(globalThis, 'structuredClone')
      .mockImplementation((value, options) => clone(value, options))

    const snapshot = createLazyImmutableSnapshot(source)

    expect(() => Reflect.set(snapshot, 'email', 'changed')).toThrow(
      'Form snapshots are read-only'
    )
    expect(cloneSpy).not.toHaveBeenCalled()
    expect(snapshot.email).toBe('person@example.com')
    expect(cloneSpy).not.toHaveBeenCalled()

    expect(snapshot.profile.name).toBe('Ada')
    expect(cloneSpy).not.toHaveBeenCalled()
    expect(cloneSpy).not.toHaveBeenCalledWith(largeUnrelatedBranch)
    expect(snapshot.profile).not.toBe(smallBranch)
    expect(() => Reflect.set(snapshot.profile, 'name', 'Changed')).toThrow(
      'Form snapshots are read-only'
    )

    smallBranch.name = 'Grace'
    expect(snapshot.profile.name).toBe('Ada')

    cloneSpy.mockRestore()
  })

  it('preserves shared identity and cycles through the lazy root', () => {
    const shared = { name: 'shared' }
    const source: {
      left: typeof shared
      right: typeof shared
      self?: unknown
    } = { left: shared, right: shared }
    source.self = source

    const snapshot = createLazyImmutableSnapshot(source)

    expect(snapshot.self).toBe(snapshot)
    expect(snapshot.left).toBe(snapshot.right)
    expect(snapshot.left).not.toBe(shared)
    expect(() => Reflect.set(snapshot.left, 'name', 'Changed')).toThrow(
      'Form snapshots are read-only'
    )
  })

  it('clones supported built-ins, descriptors, and error metadata lazily', () => {
    const shared = { marker: 'shared' }
    const mapKey = { id: 1 }
    const expression = /neo/gi
    expression.lastIndex = 2
    const errorSymbol = Symbol('error metadata')
    const error = new Error('failed', { cause: shared }) as Error & {
      detail: typeof shared
      [errorSymbol]: string
    }
    error.detail = shared
    error[errorSymbol] = 'symbol value'

    const descriptorObject: Record<string, unknown> = {}
    Object.defineProperty(descriptorObject, 'visible', {
      enumerable: true,
      get: () => shared,
    })
    Object.defineProperty(descriptorObject, 'hidden', {
      enumerable: false,
      value: 'not copied',
    })

    const source: Record<PropertyKey, unknown> = {
      date: new Date('2026-08-31T00:00:00.000Z'),
      expression,
      map: new Map([[mapKey, shared]]),
      set: new Set([shared]),
      buffer: new Uint8Array([1, 2, 3]).buffer,
      view: new Uint16Array([4, 5]),
      blob: new Blob(['neo'], { type: 'text/plain' }),
      error,
      array: [shared, shared],
      descriptorObject,
    }
    Object.defineProperty(source, 'accessor', {
      enumerable: true,
      get: () => shared,
    })
    Object.defineProperty(source, 'hidden', {
      enumerable: false,
      value: 'not exposed',
    })

    const snapshot = createLazyImmutableSnapshot(source) as Record<
      PropertyKey,
      unknown
    >

    expect((snapshot.date as Date).toISOString()).toBe(
      '2026-08-31T00:00:00.000Z'
    )
    expect(snapshot.date).not.toBe(source.date)
    expect((snapshot.expression as RegExp).lastIndex).toBe(2)

    const snapshotMap = snapshot.map as Map<object, typeof shared>
    const [snapshotKey, snapshotMapValue] = Array.from(snapshotMap)[0]!
    expect(snapshotKey).not.toBe(mapKey)
    expect(snapshotMapValue).not.toBe(shared)
    expect(snapshotMapValue).toEqual(shared)

    const [snapshotSetValue] = Array.from(snapshot.set as Set<typeof shared>)
    expect(snapshotSetValue).toBe(snapshotMapValue)
    expect(Array.from(new Uint8Array(snapshot.buffer as ArrayBuffer))).toEqual([
      1, 2, 3,
    ])
    expect(Array.from(snapshot.view as Uint16Array)).toEqual([4, 5])
    expect((snapshot.blob as Blob).type).toBe('text/plain')

    const snapshotError = snapshot.error as typeof error
    expect(snapshotError).toBeInstanceOf(Error)
    expect(snapshotError.message).toBe('failed')
    expect(snapshotError.cause).toBe(snapshotMapValue)
    expect(snapshotError.detail).toBe(snapshotMapValue)
    expect(snapshotError[errorSymbol]).toBe('symbol value')

    const snapshotArray = snapshot.array as typeof shared[]
    expect(snapshotArray[0]).toBe(snapshotArray[1])
    expect(snapshotArray[0]).toBe(snapshotMapValue)
    expect(
      (snapshot.descriptorObject as Record<string, unknown>).visible
    ).toBe(snapshotMapValue)
    expect('hidden' in (snapshot.descriptorObject as object)).toBe(false)
    expect(snapshot.accessor).toBe(snapshotMapValue)
    expect('hidden' in snapshot).toBe(false)
  })

  it('does not redefine every typed-array element while cloning', () => {
    const metadata = Symbol('metadata')
    const view = new Uint8Array(20_000) as Uint8Array & { [metadata]: string }
    view[metadata] = 'payload'
    const defineProperty = vi.spyOn(Object, 'defineProperty')

    const snapshot = createImmutableSnapshot(view)

    const numericDefinitions = defineProperty.mock.calls.filter(
      ([, key]) => typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key)
    )
    expect(numericDefinitions).toEqual([])
    expect(snapshot[metadata]).toBe('payload')
    expect(snapshot).toEqual(view)
  })

  it('detaches every supported local binary view family', () => {
    const dataViewBuffer = new Uint8Array([1, 2, 3, 4]).buffer
    const views: ArrayBufferView[] = [
      new DataView(dataViewBuffer, 1, 2),
      new Int8Array([-1, 2]),
      new Uint8Array([1, 2]),
      new Uint8ClampedArray([1, 255]),
      new Int16Array([-1, 2]),
      new Uint16Array([1, 2]),
      new Int32Array([-1, 2]),
      new Uint32Array([1, 2]),
      new Float32Array([1.5, 2.5]),
      new Float64Array([1.5, 2.5]),
    ]
    if (typeof BigInt64Array !== 'undefined') {
      views.push(new BigInt64Array([-1n, 2n]))
    }
    if (typeof BigUint64Array !== 'undefined') {
      views.push(new BigUint64Array([1n, 2n]))
    }

    for (const view of views) {
      const snapshot = createImmutableSnapshot(view) as ArrayBufferView

      expect(Object.getPrototypeOf(snapshot)).toBe(Object.getPrototypeOf(view))
      expect(snapshot).not.toBe(view)
      expect(snapshot.buffer).not.toBe(view.buffer)
      expect(
        Array.from(
          new Uint8Array(snapshot.buffer, snapshot.byteOffset, snapshot.byteLength)
        )
      ).toEqual(
        Array.from(new Uint8Array(view.buffer, view.byteOffset, view.byteLength))
      )
    }
  })

  it('uses a lazy immutable path for an array root', () => {
    const source = [{ value: 1 }]

    const snapshot = createLazyImmutableSnapshot(source)

    expect(snapshot).toEqual(source)
    expect(snapshot).not.toBe(source)
    expect(snapshot[0]).not.toBe(source[0])
    expect(() => Reflect.set(snapshot, '0', { value: 2 })).toThrow(
      'Form snapshots are read-only'
    )
    expect(() => Reflect.set(snapshot[0]!, 'value', 2)).toThrow(
      'Form snapshots are read-only'
    )
  })

  it('uses real detached built-ins for non-plain roots', () => {
    const date = createLazyImmutableSnapshot(new Date(123))
    const map = createLazyImmutableSnapshot(new Map([['name', 'Ada']]))
    const set = createLazyImmutableSnapshot(new Set(['Ada']))
    const expression = createLazyImmutableSnapshot(/neo/gi)
    const view = createLazyImmutableSnapshot(new Uint8Array([1, 2, 3]))

    expect(date.getTime()).toBe(123)
    expect(map.get('name')).toBe('Ada')
    expect(set.has('Ada')).toBe(true)
    expect(expression.test('NEO')).toBe(true)
    expect(Array.from(view)).toEqual([1, 2, 3])
  })
})
