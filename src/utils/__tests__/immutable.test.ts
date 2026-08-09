import { describe, expect, it } from 'vitest'
import { createImmutableSnapshot } from '../immutable.js'

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
})
