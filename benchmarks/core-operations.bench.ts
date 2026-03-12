/**
 * Core operations benchmark
 *
 * Compares @lpm.dev/neo.react-forms vs Formik vs React Hook Form
 * for basic form operations
 */

import { bench, describe } from 'vitest'
import { FormStore } from '../src/core/store.js'
import { generateFormData } from './utils/benchmark-helpers.js'

// Note: Formik and RHF are React components, so we benchmark
// the core store operations which are framework-agnostic

describe('Core Operations: Store Performance', () => {
  const testSizes = [10, 30, 100]

  for (const size of testSizes) {
    const data = generateFormData(size)

    describe(`${size} fields`, () => {
      bench('neo.react-forms: Create store', () => {
        const store = new FormStore(data)
      })

      bench('neo.react-forms: Set value', () => {
        const store = new FormStore(data)
        store.setValue('field0', 'new value')
      })

      bench('neo.react-forms: Get value', () => {
        const store = new FormStore(data)
        store.getValue('field0')
      })

      bench('neo.react-forms: Set error', () => {
        const store = new FormStore(data)
        store.setError('field0', 'Error message')
      })

      bench('neo.react-forms: Get field state', () => {
        const store = new FormStore(data)
        store.getFieldState('field0')
      })

      bench('neo.react-forms: Subscribe to field', () => {
        const store = new FormStore(data)
        const unsubscribe = store.subscribe('field0', () => {})
        unsubscribe()
      })

      bench('neo.react-forms: Set value + notify', () => {
        const store = new FormStore(data)
        let callCount = 0
        store.subscribe('field0', () => {
          callCount++
        })
        store.setValue('field0', 'new value')
      })

      bench('neo.react-forms: Reset form', () => {
        const store = new FormStore(data)
        store.setValue('field0', 'changed')
        store.reset()
      })
    })
  }
})

describe('Core Operations: Subscription Performance', () => {
  bench('neo.react-forms: 100 subscribers to single field', () => {
    const store = new FormStore({ field: '' })
    const unsubscribes: Array<() => void> = []

    // Add 100 subscribers
    for (let i = 0; i < 100; i++) {
      const unsub = store.subscribe('field', () => {})
      unsubscribes.push(unsub)
    }

    // Update field (notifies all)
    store.setValue('field', 'value')

    // Cleanup
    unsubscribes.forEach((unsub) => unsub())
  })

  bench('neo.react-forms: 100 fields with 1 subscriber each', () => {
    const data = generateFormData(100)
    const store = new FormStore(data)
    const unsubscribes: Array<() => void> = []

    // Subscribe to each field
    for (let i = 0; i < 100; i++) {
      const unsub = store.subscribe(`field${i}` as any, () => {})
      unsubscribes.push(unsub)
    }

    // Update one field (should only notify one subscriber)
    store.setValue('field0' as any, 'value')

    // Cleanup
    unsubscribes.forEach((unsub) => unsub())
  })

  bench('neo.react-forms: Field isolation (no re-render cascade)', () => {
    const data = generateFormData(100)
    const store = new FormStore(data)
    let notifyCount = 0

    // Subscribe to field50
    store.subscribe('field50' as any, () => {
      notifyCount++
    })

    // Update field0 (should NOT notify field50 subscriber)
    store.setValue('field0' as any, 'value')

    // Verify isolation
    if (notifyCount > 0) {
      throw new Error('Field isolation failed!')
    }
  })
})

describe('Core Operations: Validation Performance', () => {
  bench('neo.react-forms: Validate single field', () => {
    const store = new FormStore({ email: 'test@example.com' })
    const validator = (value: string) =>
      value.includes('@') ? undefined : 'Invalid email'

    const error = validator(store.getValue('email'))
    store.setError('email', error)
  })

  bench('neo.react-forms: Validate 10 fields', () => {
    const data = generateFormData(10)
    const store = new FormStore(data)
    const validator = (value: string) =>
      value.length > 0 ? undefined : 'Required'

    for (let i = 0; i < 10; i++) {
      const error = validator(store.getValue(`field${i}` as any))
      store.setError(`field${i}` as any, error)
    }
  })

  bench('neo.react-forms: Validate 100 fields', () => {
    const data = generateFormData(100)
    const store = new FormStore(data)
    const validator = (value: string) =>
      value.length > 0 ? undefined : 'Required'

    for (let i = 0; i < 100; i++) {
      const error = validator(store.getValue(`field${i}` as any))
      store.setError(`field${i}` as any, error)
    }
  })
})

describe('Core Operations: Memory Efficiency', () => {
  bench('neo.react-forms: Create and destroy 1000 stores', () => {
    const stores: FormStore<any>[] = []

    for (let i = 0; i < 1000; i++) {
      stores.push(new FormStore({ field: `value${i}` }))
    }

    // Let GC collect
    stores.length = 0
  })

  bench('neo.react-forms: 1000 subscribers lifecycle', () => {
    const store = new FormStore({ field: '' })
    const unsubscribes: Array<() => void> = []

    // Subscribe
    for (let i = 0; i < 1000; i++) {
      unsubscribes.push(store.subscribe('field', () => {}))
    }

    // Unsubscribe all
    unsubscribes.forEach((unsub) => unsub())
  })
})
