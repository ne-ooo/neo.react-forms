/**
 * Short, dependency-free benchmark coverage for the release gate.
 *
 * This suite verifies that representative hot paths execute successfully.
 * Full comparative benchmarks remain available through `lpm run bench`.
 */

import { describe } from 'vitest'
import { FormStore } from '../../src/core/store.js'
import { benchmark as bench, generateFormData } from './utils/benchmark-helpers.js'

describe('Release benchmark smoke gate', () => {
  const values = generateFormData(100)
  const largeArrayStore = new FormStore({
    items: Array.from({ length: 20_000 }, (_, index) => ({ value: index })),
  })
  largeArrayStore.subscribeToField('items', () => {})
  let nextLargeArrayValue = -1

  bench('create a 100-field store', () => {
    void new FormStore(values)
  })

  bench('update one field with 100 isolated subscriptions', () => {
    const store = new FormStore(values)
    const unsubscribes = Object.keys(values).map((name) =>
      store.subscribe(name, () => {})
    )

    store.setValue('field50', 'changed')
    unsubscribes.forEach((unsubscribe) => unsubscribe())
  })

  bench('batch 100 field updates into one transaction', () => {
    const store = new FormStore(values)
    store.batch(() => {
      for (let index = 0; index < 100; index++) {
        store.setValue(`field${index}`, `changed-${index}`)
      }
    })
  })

  bench('update one item under a 20k-item React field subscription', () => {
    largeArrayStore.setValue('items.10000.value', nextLargeArrayValue--)
  })
})
