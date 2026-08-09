import type { DeepReadonly } from '../types.js'

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

  if (ArrayBuffer.isView(value)) return

  for (const entry of Object.values(value)) freezeSnapshot(entry, seen)
  Object.freeze(value)
}

/**
 * Create a stable read-only copy for user callbacks.
 * Mutations cannot change the live store, including mutations to built-in values.
 */
export function createImmutableSnapshot<Value>(value: Value): DeepReadonly<Value> {
  const snapshot = structuredClone(value)
  freezeSnapshot(snapshot, new WeakSet<object>())
  return snapshot as DeepReadonly<Value>
}
