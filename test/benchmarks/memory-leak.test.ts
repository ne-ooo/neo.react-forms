/**
 * Memory leak detection tests
 *
 * Ensures no memory leaks in form lifecycle
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { FormStore } from '../src/core/store.js'
import { MemoryTracker } from './utils/benchmark-helpers.js'

describe('Memory Leak Tests', () => {
  let tracker: MemoryTracker

  beforeEach(() => {
    tracker = new MemoryTracker()
  })

  it('should not leak memory when creating and destroying stores', () => {
    tracker.start()

    // Create and destroy 1000 stores
    for (let i = 0; i < 1000; i++) {
      const store = new FormStore({ field: `value${i}` })
      tracker.sample()
      // Store goes out of scope and should be GC'd
    }

    // Force GC if available
    if (global.gc) {
      global.gc()
    }

    const stats = tracker.getStats()

    // Memory should stabilize (not grow linearly)
    // Peak should be reasonable (< 10 MB for 1000 stores)
    expect(stats.peak).toBeLessThan(10)

    console.log('Store creation/destruction memory:', tracker.formatStats())
  })

  it('should not leak memory with subscriptions', () => {
    tracker.start()

    const store = new FormStore({ field: '' })

    // Create and destroy 10000 subscriptions
    for (let i = 0; i < 10000; i++) {
      const unsubscribe = store.subscribe('field', () => {})
      unsubscribe() // Immediately unsubscribe
      if (i % 1000 === 0) {
        tracker.sample()
      }
    }

    // Force GC
    if (global.gc) {
      global.gc()
    }

    const stats = tracker.getStats()

    // Memory should not grow significantly (10k subscriptions = ~10MB max)
    expect(stats.peak).toBeLessThan(15)

    console.log('Subscription lifecycle memory:', tracker.formatStats())
  })

  it('should not leak memory with value updates', () => {
    tracker.start()

    const store = new FormStore({ field: '' })

    // Update value 10000 times
    for (let i = 0; i < 10000; i++) {
      store.setValue('field', `value${i}`)
      if (i % 1000 === 0) {
        tracker.sample()
      }
    }

    // Force GC
    if (global.gc) {
      global.gc()
    }

    const stats = tracker.getStats()

    // Memory should not grow significantly (old values should be GC'd)
    expect(stats.peak).toBeLessThan(5)

    console.log('Value update memory:', tracker.formatStats())
  })

  it('should not leak memory with subscriber notifications', () => {
    tracker.start()

    const store = new FormStore({ field: '' })
    let callCount = 0

    // Add subscriber
    const unsubscribe = store.subscribe('field', () => {
      callCount++
    })

    // Update value 10000 times (triggers notifications)
    for (let i = 0; i < 10000; i++) {
      store.setValue('field', `value${i}`)
      if (i % 1000 === 0) {
        tracker.sample()
      }
    }

    unsubscribe()

    // Verify notifications worked
    expect(callCount).toBe(10000)

    // Force GC
    if (global.gc) {
      global.gc()
    }

    const stats = tracker.getStats()

    // Memory should not grow significantly
    expect(stats.peak).toBeLessThan(5)

    console.log('Notification memory:', tracker.formatStats())
  })

  it('should not leak memory with multiple fields', () => {
    tracker.start()

    // Create form with 100 fields
    const initialValues: Record<string, string> = {}
    for (let i = 0; i < 100; i++) {
      initialValues[`field${i}`] = ''
    }

    const store = new FormStore(initialValues)

    // Update all fields 100 times
    for (let iter = 0; iter < 100; iter++) {
      for (let i = 0; i < 100; i++) {
        store.setValue(`field${i}` as any, `value${iter}`)
      }
      if (iter % 10 === 0) {
        tracker.sample()
      }
    }

    // Force GC
    if (global.gc) {
      global.gc()
    }

    const stats = tracker.getStats()

    // Memory should be reasonable for 100 fields
    expect(stats.peak).toBeLessThan(10)

    console.log('Multiple fields memory:', tracker.formatStats())
  })

  it('should clean up on reset', () => {
    tracker.start()

    const store = new FormStore({ field: '' })

    // Make changes and reset 1000 times
    for (let i = 0; i < 1000; i++) {
      store.setValue('field', `value${i}`)
      store.setError('field', `error${i}`)
      store.setTouched('field', true)
      store.reset()

      if (i % 100 === 0) {
        tracker.sample()
      }
    }

    // Force GC
    if (global.gc) {
      global.gc()
    }

    const stats = tracker.getStats()

    // Reset should clean up properly
    expect(stats.peak).toBeLessThan(5)

    console.log('Reset memory:', tracker.formatStats())
  })

  it('should handle subscriber cleanup properly', () => {
    tracker.start()

    const store = new FormStore({ field: '' })

    // Add and remove subscribers many times
    for (let i = 0; i < 1000; i++) {
      const unsubscribes: Array<() => void> = []

      // Add 100 subscribers
      for (let j = 0; j < 100; j++) {
        unsubscribes.push(store.subscribe('field', () => {}))
      }

      // Remove all subscribers
      unsubscribes.forEach((unsub) => unsub())

      if (i % 100 === 0) {
        tracker.sample()
      }
    }

    // Verify no subscribers remain
    const subscriberCount = (store as any).subscriptions.get('field')?.size || 0
    expect(subscriberCount).toBe(0)

    // Force GC
    if (global.gc) {
      global.gc()
    }

    const stats = tracker.getStats()

    // Memory should not grow (100k subscriptions lifecycle = ~15MB max)
    expect(stats.peak).toBeLessThan(20)

    console.log('Subscriber cleanup memory:', tracker.formatStats())
  })
})
