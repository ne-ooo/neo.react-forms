/**
 * Tests for FormStore - Core state management with subscriptions
 */

import { describe, it, expect, vi } from 'vitest'
import { runInNewContext } from 'node:vm'
import { FormStore, getValueByPath, setValueByPath } from '../store.js'

describe('getValueByPath', () => {
  it('should get value at top-level path', () => {
    const obj = { name: 'John', age: 30 }
    expect(getValueByPath(obj, 'name')).toBe('John')
    expect(getValueByPath(obj, 'age')).toBe(30)
  })

  it('should get value at nested path', () => {
    const obj = {
      user: {
        profile: {
          name: 'John',
          age: 30,
        },
      },
    }
    expect(getValueByPath(obj, 'user.profile.name')).toBe('John')
    expect(getValueByPath(obj, 'user.profile.age')).toBe(30)
  })

  it('should return undefined for non-existent path', () => {
    const obj = { user: { name: 'John' } }
    expect(getValueByPath(obj, 'user.email')).toBeUndefined()
    expect(getValueByPath(obj, 'invalid.path')).toBeUndefined()
  })

  it('should return undefined when traversing through null/undefined', () => {
    const obj = { user: null }
    expect(getValueByPath(obj, 'user.name')).toBeUndefined()
  })
})

describe('setValueByPath', () => {
  it('should set value at top-level path immutably', () => {
    const obj = { name: 'John', age: 30 }
    const updated = setValueByPath(obj, 'name', 'Jane')

    expect(updated).toEqual({ name: 'Jane', age: 30 })
    expect(updated).not.toBe(obj) // Immutable
    expect(obj.name).toBe('John') // Original unchanged
  })

  it('should set value at nested path immutably', () => {
    const obj = {
      user: {
        profile: {
          name: 'John',
          age: 30,
        },
      },
    }

    const updated = setValueByPath(obj, 'user.profile.name', 'Jane')

    expect(getValueByPath(updated, 'user.profile.name')).toBe('Jane')
    expect(getValueByPath(updated, 'user.profile.age')).toBe(30)
    expect(updated).not.toBe(obj) // Immutable
    expect(getValueByPath(obj, 'user.profile.name')).toBe('John') // Original unchanged
  })

  it('should create nested structure if missing', () => {
    const obj = {}
    const updated = setValueByPath(obj, 'user.profile.name', 'John')

    expect(getValueByPath(updated, 'user.profile.name')).toBe('John')
  })

  it('should handle empty path', () => {
    const obj = { name: 'John' }
    const updated = setValueByPath(obj, '', 'value')

    expect(updated).toBe(obj) // No change for empty path
  })

  it('rejects non-canonical array indices and scalar traversal', () => {
    const source = { items: ['first', 'second'] }

    for (const path of [
      'items.-1',
      'items.1e2',
      'items.4294967295',
      'items.999999999999999999999',
    ]) {
      expect(() => setValueByPath(source, path, 'bad')).toThrow(
        'Invalid array index in form field path'
      )
    }
    expect(() => setValueByPath(source, 'items.1.5', 'bad')).toThrow(
      'Cannot traverse non-object form field path'
    )
    expect(source).toEqual({ items: ['first', 'second'] })
  })
})

describe('FormStore', () => {
  describe('constructor', () => {
    it('should initialize with initial values', () => {
      const initialValues = { email: '', password: '' }
      const store = new FormStore(initialValues)

      expect(store.getValues()).toEqual(initialValues)
    })

    it('should clone initial values (not mutate)', () => {
      const initialValues = { email: 'test@example.com' }
      const store = new FormStore(initialValues)

      store.setValue('email', 'new@example.com')

      expect(initialValues.email).toBe('test@example.com') // Original unchanged
    })

    it('exposes callable detached snapshots for built-in root values', () => {
      const dateStore = new FormStore<Date>(new Date(123))
      const mapStore = new FormStore<Map<string, string>>(
        new Map([['name', 'Ada']])
      )

      expect(dateStore.getValues().getTime()).toBe(123)
      expect(mapStore.getValues().get('name')).toBe('Ada')
    })

    it('keeps built-in values detached inside computed callbacks', () => {
      const store = new FormStore(
        {
          createdAt: new Date('2020-01-01T00:00:00.000Z'),
          metadata: new Map([['safe', 1]]),
          score: 0,
        },
        {
          score: (values) => {
            ;(values.createdAt as Date).setUTCFullYear(2030)
            ;(values.metadata as Map<string, number>).set('mutated', 2)
            return values.metadata.get('safe') ?? 0
          },
        }
      )

      expect(store.getValue('createdAt').getUTCFullYear()).toBe(2020)
      expect(store.getValue('metadata').has('mutated')).toBe(false)
      expect(store.getValue('score')).toBe(1)
    })

    it('preserves custom and null root prototypes through computed values and reset', () => {
      class RootValues {
        base = 2
        total = 0
      }

      const classStore = new FormStore(new RootValues(), {
        total: (values) => values.base * 2,
      })
      expect(classStore.getInternalValues()).toBeInstanceOf(RootValues)
      expect(classStore.getInternalValues()).toEqual(
        expect.objectContaining({ base: 2, total: 4 })
      )

      const nullRoot = Object.assign(Object.create(null) as {
        base: number
        total: number
      }, { base: 3, total: 0 })
      const nullStore = new FormStore(nullRoot, {
        total: (values) => values.base * 2,
      })
      expect(Object.getPrototypeOf(nullStore.getInternalValues())).toBeNull()
      expect(nullStore.getInternalValue('total')).toBe(6)

      nullStore.reset({ base: 5 })
      expect(Object.getPrototypeOf(nullStore.getInternalValues())).toBeNull()
      expect(nullStore.getInternalValue('total')).toBe(10)
      expect(nullStore.isDirty()).toBe(false)
    })
  })

  describe('getValue / setValue', () => {
    it('releases cached exposed roots after value changes and disposal', () => {
      type Values = {
        profile: { name: string }
        items: Array<{ name: string }>
      }
      const store = new FormStore<Values>({
        profile: { name: 'Ada' },
        items: [{ name: 'first' }],
      })
      const exposedCache = store as unknown as {
        exposedValuesSource: Values | undefined
        exposedValuesSnapshot: Values | undefined
      }

      void store.getValues().profile.name
      expect(exposedCache.exposedValuesSource).toBeDefined()
      expect(exposedCache.exposedValuesSnapshot).toBeDefined()

      store.setValue('profile.name', 'Grace')
      expect(exposedCache.exposedValuesSource).toBeUndefined()
      expect(exposedCache.exposedValuesSnapshot).toBeUndefined()

      void store.getValues().items[0]?.name
      store.setArrayValue('items', [], [])
      expect(exposedCache.exposedValuesSource).toBeUndefined()
      expect(exposedCache.exposedValuesSnapshot).toBeUndefined()

      void store.getValues().profile.name
      store.dispose()
      expect(exposedCache.exposedValuesSource).toBeUndefined()
      expect(exposedCache.exposedValuesSnapshot).toBeUndefined()
    })

    it('should get and set top-level values', () => {
      const store = new FormStore({ name: 'John', age: 30 })

      expect(store.getValue('name')).toBe('John')
      expect(store.getValue('age')).toBe(30)

      store.setValue('name', 'Jane')
      expect(store.getValue('name')).toBe('Jane')
    })

    it('should get and set nested values', () => {
      const store = new FormStore({
        user: {
          profile: {
            name: 'John',
            age: 30,
          },
        },
      })

      expect(store.getValue('user.profile.name')).toBe('John')

      store.setValue('user.profile.name', 'Jane')
      expect(store.getValue('user.profile.name')).toBe('Jane')
      expect(store.getValue('user.profile.age')).toBe(30) // Other fields unchanged
    })

    it('preserves ancestor prototypes and array metadata on nested updates', () => {
      class Profile {
        name = 'Ada'
      }
      const items = [{ value: 1 }] as Array<{ value: number }> & { meta: string }
      items.meta = 'keep'
      const nullPrototype = Object.assign(Object.create(null) as { name: string }, {
        name: 'Ada',
      })
      const store = new FormStore<any>({
        profile: new Profile(),
        items,
        nullPrototype,
      })

      store.setValue('profile.name', 'Grace')
      store.setValue('items.0.value', 2)
      store.setValue('nullPrototype.name', 'Grace')

      expect(store.getInternalValue('profile')).toBeInstanceOf(Profile)
      expect(store.getInternalValue('items').meta).toBe('keep')
      expect(Object.getPrototypeOf(store.getInternalValue('nullPrototype'))).toBeNull()
    })

    it('keeps global RegExp snapshots callable and detached', () => {
      const store = new FormStore({ matcher: /x/g })
      const matcher = store.getValue('matcher')

      expect(matcher.test('x')).toBe(true)
      expect(matcher.lastIndex).toBe(1)
      expect(store.getInternalValue('matcher').lastIndex).toBe(0)
    })

    it('does not discard distinct Error, Blob, or typed-view values', async () => {
      const store = new FormStore<{
        failure: Error
        payload: Blob
        view: ArrayBufferView
      }>({
        failure: new Error('old'),
        payload: new Blob(['aa'], { type: 'text/plain' }),
        view: new Uint8Array([1, 2]),
      })

      store.setValue('failure', new Error('new'))
      store.setValue('payload', new Blob(['bb'], { type: 'text/plain' }))
      store.setValue('view', new Uint16Array([513]))

      expect(store.getValue('failure').message).toBe('new')
      expect(await store.getValue('payload').text()).toBe('bb')
      expect(store.getValue('view')).toBeInstanceOf(Uint16Array)
    })

    it('preserves shared-buffer bytes and aliases across typed views', () => {
      const buffer = new SharedArrayBuffer(8)
      new Uint8Array(buffer).set([7, 8, 9, 10, 11, 12, 13, 14])
      const store = new FormStore<any>({
        bytes: new Uint8Array(buffer, 0, 4),
        words: new Uint16Array(buffer, 2, 2),
      })

      const bytes = store.getInternalValue('bytes') as Uint8Array
      const words = store.getInternalValue('words') as Uint16Array
      expect(Array.from(bytes)).toEqual([7, 8, 9, 10])
      expect(bytes.buffer).toBe(words.buffer)
      expect(bytes.buffer).toBeInstanceOf(ArrayBuffer)
      expect(store.getValue('bytes')[0]).toBe(7)
    })

    it('rejects subclasses of supported built-in values', () => {
      class TaggedArray extends Array<string> {}
      class TaggedDate extends Date {}
      class TaggedMap extends Map<string, number> {}
      class TaggedSet extends Set<string> {}
      class TaggedBlob extends Blob {}
      class TaggedView extends Uint8Array {}

      for (const value of [
        new TaggedArray('stable'),
        new TaggedDate(123),
        new TaggedMap([['count', 1]]),
        new TaggedSet(['stable']),
        new TaggedBlob(['stable']),
        new TaggedView([1, 2, 3]),
      ]) {
        expect(() => new FormStore<any>({ value })).toThrow(
          'Form values cannot contain subclasses of built-in objects'
        )
      }
    })

    it('rejects resizable and growable buffers', () => {
      const resizable = Reflect.construct(ArrayBuffer, [
        4,
        { maxByteLength: 16 },
      ]) as ArrayBuffer
      expect(() => new FormStore<any>({ buffer: resizable })).toThrow(
        'Form values cannot contain resizable or growable buffers'
      )

      const growable = Reflect.construct(SharedArrayBuffer, [
        4,
        { maxByteLength: 16 },
      ]) as SharedArrayBuffer
      expect(() => new FormStore<any>({ buffer: growable })).toThrow(
        'Form values cannot contain resizable or growable buffers'
      )
    })

    it('rejects AggregateError because its errors list cannot be preserved', () => {
      expect(
        () => new FormStore<any>({
          error: new AggregateError([new Error('inner')], 'outer'),
        })
      ).toThrow('Form values cannot contain AggregateError instances')
    })

    it('preserves typed-view backing-buffer topology', () => {
      const shared = new ArrayBuffer(8)
      const store = new FormStore<any>({
        data: {
          first: new Uint8Array(shared, 0, 4),
          second: new Uint8Array(shared, 4, 4),
        },
      })
      const first = new Uint8Array([0, 0, 0, 0])
      const second = new Uint8Array([0, 0, 0, 0])

      store.setValue('data', { first, second })

      const value = store.getInternalValue('data')
      expect(value.first.buffer).not.toBe(value.second.buffer)
      expect(store.isDirty()).toBe(true)
    })

    it('detects distinct typed-view buffers becoming shared', () => {
      const store = new FormStore<any>({
        data: {
          first: new Uint8Array([0, 0, 0, 0]),
          second: new Uint8Array([0, 0, 0, 0]),
        },
      })
      const shared = new ArrayBuffer(8)

      store.setValue('data', {
        first: new Uint8Array(shared, 0, 4),
        second: new Uint8Array(shared, 4, 4),
      })

      const value = store.getInternalValue('data')
      expect(value.first.buffer).toBe(value.second.buffer)
      expect(store.isDirty()).toBe(true)
    })

    it('allows one equal typed view to move within its private buffer', () => {
      const initialBuffer = new ArrayBuffer(8)
      new Uint8Array(initialBuffer, 0, 4).set([1, 2, 3, 4])
      const store = new FormStore<any>({
        view: new Uint8Array(initialBuffer, 0, 4),
      })
      const nextBuffer = new ArrayBuffer(12)
      new Uint8Array(nextBuffer, 4, 4).set([1, 2, 3, 4])

      store.setValue('view', new Uint8Array(nextBuffer, 4, 4))

      expect(store.getInternalValue('view').byteOffset).toBe(0)
      expect(store.isDirty()).toBe(false)
    })

    it('preserves relative offsets between views of one backing buffer', () => {
      const initialBuffer = new ArrayBuffer(12)
      const store = new FormStore<any>({
        data: {
          first: new Uint8Array(initialBuffer, 0, 4),
          second: new Uint8Array(initialBuffer, 4, 4),
        },
      })
      const nextBuffer = new ArrayBuffer(12)

      store.setValue('data', {
        first: new Uint8Array(nextBuffer, 4, 4),
        second: new Uint8Array(nextBuffer, 0, 4),
      })

      const value = store.getInternalValue('data')
      expect(value.first.byteOffset).toBe(4)
      expect(value.second.byteOffset).toBe(0)
      expect(store.isDirty()).toBe(true)
    })

    it('rejects built-ins created in another JavaScript realm', () => {
      const foreignDate = runInNewContext('new Date(123)') as Date
      const foreignMap = runInNewContext("new Map([['count', 1]])") as Map<
        string,
        number
      >

      expect(() => new FormStore<any>({ value: foreignDate })).toThrow(
        'Form values cannot contain built-in objects from another JavaScript realm'
      )
      expect(() => new FormStore<any>({ value: foreignMap })).toThrow(
        'Form values cannot contain built-in objects from another JavaScript realm'
      )
    })

    it('does not mistake a spoofed built-in tag for a foreign object', () => {
      const tagged = { value: 1, [Symbol.toStringTag]: 'Error' }
      const fakeWeakMap = Object.assign(
        Object.create({ [Symbol.toStringTag]: 'WeakMap' }) as object,
        { value: 2 }
      ) as { value: number }
      const fakeWeakSet = Object.assign(
        Object.create({ [Symbol.toStringTag]: 'WeakSet' }) as object,
        { value: 3 }
      ) as { value: number }
      const store = new FormStore({ tagged, fakeWeakMap, fakeWeakSet })

      expect(store.getValue('tagged').value).toBe(1)
      expect(store.getValue('fakeWeakMap').value).toBe(2)
      expect(store.getValue('fakeWeakSet').value).toBe(3)
    })

    it('does not reuse failed cycle matches between Set candidates', () => {
      const shared = { z: 0 }
      const left = new Set<any>([{ x: shared, y: 0 }, shared])
      const cyclic: { x: unknown; y: number } = { x: undefined, y: 1 }
      cyclic.x = cyclic
      const right = new Set<any>([cyclic, { x: { z: 0 }, y: 0 }])
      const store = new FormStore<any>({ data: left })
      const subscriber = vi.fn()
      store.subscribe('data', subscriber)

      store.setValue('data', right)

      expect(subscriber).toHaveBeenCalledTimes(1)
      expect(store.isDirty()).toBe(true)
      expect(
        Array.from(store.getValue('data')).some(
          (value) =>
            typeof value === 'object' &&
            value !== null &&
            (value as { x?: unknown }).x === value
        )
      ).toBe(true)
    })

    it('preserves alias-topology changes and reports their parent dirty', () => {
      const shared = { x: 1 }
      const store = new FormStore({ data: { a: shared, b: shared } })
      const subscriber = vi.fn()
      store.subscribe('data', subscriber)

      store.setValue('data', { a: { x: 1 }, b: { x: 1 } })

      const data = store.getInternalValue('data')
      expect(data.a).not.toBe(data.b)
      expect(subscriber).toHaveBeenCalledTimes(1)
      expect(store.isDirty()).toBe(true)
      expect(store.getFieldState('data').dirty).toBe(true)
    })

    it('applies a subtree-equal replacement that breaks an object alias', () => {
      const shared = { count: 1 }
      const store = new FormStore<any>({ data: { first: shared, second: shared } })

      store.setValue('data.first', { count: 1 })

      const data = store.getInternalValue('data')
      expect(data.first).not.toBe(data.second)
      expect(store.getFieldState('data').dirty).toBe(true)
      expect(store.isDirty()).toBe(true)
    })

    it('applies a subtree-equal replacement that breaks a view-buffer alias', () => {
      const shared = new ArrayBuffer(8)
      const store = new FormStore<any>({
        data: {
          first: new Uint8Array(shared, 0, 4),
          second: new Uint8Array(shared, 4, 4),
        },
      })

      store.setValue('data.first', new Uint8Array([0, 0, 0, 0]))

      const data = store.getInternalValue('data')
      expect(data.first.buffer).not.toBe(data.second.buffer)
      expect(store.getFieldState('data').dirty).toBe(true)
      expect(store.isDirty()).toBe(true)
    })

    it('keeps topology-only dirtiness after a leaf returns to its baseline', () => {
      const shared = { x: 1 }
      const store = new FormStore({ data: { a: shared, b: shared } })

      store.setValue('data.a.x', 2)
      store.setValue('data.a.x', 1)

      const data = store.getInternalValue('data')
      expect(data.a).not.toBe(data.b)
      expect(store.isDirty()).toBe(true)
      expect(store.getFieldState('data').dirty).toBe(true)
    })

    it('distinguishes nested and shared-child Set graph topologies', () => {
      const self = new Set<unknown>()
      self.add(self)
      const nestedSelf = new Set<unknown>()
      nestedSelf.add(nestedSelf)
      const nested = new Set<unknown>([nestedSelf])

      const sharedChild = { stable: true }
      const sharedEntries = new Set([
        { id: 1, child: sharedChild },
        { id: 2, child: sharedChild },
      ])
      const distinctEntries = new Set([
        { id: 2, child: { stable: true } },
        { id: 1, child: { stable: true } },
      ])
      const store = new FormStore<any>({ nested: self, entries: sharedEntries })

      store.setValue('nested', nested)
      store.setValue('entries', distinctEntries)

      expect(store.getInternalValue('nested')).not.toBe(self)
      const entries = Array.from(store.getInternalValue('entries')) as Array<{
        child: object
      }>
      expect(entries[0]?.child).not.toBe(entries[1]?.child)
      expect(store.isDirty()).toBe(true)
    })

    it('compares self-referential Set and Map values without overflowing', () => {
      const leftSet = new Set<unknown>()
      leftSet.add(leftSet)
      const rightSet = new Set<unknown>()
      rightSet.add(rightSet)
      const leftMap = new Map<unknown, unknown>()
      leftMap.set(leftMap, leftMap)
      const rightMap = new Map<unknown, unknown>()
      rightMap.set(rightMap, rightMap)
      const store = new FormStore<any>({ set: leftSet, map: leftMap })
      const setSubscriber = vi.fn()
      const mapSubscriber = vi.fn()
      store.subscribe('set', setSubscriber)
      store.subscribe('map', mapSubscriber)

      expect(() => store.setValue('set', rightSet)).not.toThrow()
      expect(() => store.setValue('map', rightMap)).not.toThrow()
      expect(setSubscriber).not.toHaveBeenCalled()
      expect(mapSubscriber).not.toHaveBeenCalled()
      expect(store.isDirty()).toBe(false)
    })

    it('treats equal binary views and invalid Dates as unchanged', () => {
      const aligned = new Uint8Array([1, 2, 3, 4])
      const offsetBuffer = new Uint8Array([0, 1, 2, 3, 4]).buffer
      const unaligned = new Uint8Array(offsetBuffer, 1, 4)
      const store = new FormStore<any>({
        dates: new Set([new Date(Number.NaN)]),
        views: new Set([aligned]),
      })
      const datesSubscriber = vi.fn()
      const viewsSubscriber = vi.fn()
      store.subscribe('dates', datesSubscriber)
      store.subscribe('views', viewsSubscriber)

      store.setValue('dates', new Set([new Date(Number.NaN)]))
      store.setValue('views', new Set([unaligned]))

      expect(datesSubscriber).not.toHaveBeenCalled()
      expect(viewsSubscriber).not.toHaveBeenCalled()
      expect(store.isDirty()).toBe(false)
    })

    it('does not discard changes to enumerable built-in metadata', () => {
      type TaggedMap = Map<string, number> & { label: string }
      const initial = new Map([['count', 1]]) as TaggedMap
      initial.label = 'initial'
      const next = new Map([['count', 1]]) as TaggedMap
      next.label = 'updated'
      const store = new FormStore<any>({ data: initial })
      const subscriber = vi.fn()
      store.subscribe('data', subscriber)

      store.setValue('data', next)

      expect(subscriber).toHaveBeenCalledTimes(1)
      expect((store.getValue('data') as TaggedMap).label).toBe('updated')
    })

    it('recognizes reordered primitive Map and Set values as unchanged', () => {
      const size = 10_000
      const ascending = Array.from({ length: size }, (_, index) => index)
      const descending = [...ascending].reverse()
      const store = new FormStore<any>({
        set: new Set(ascending),
        map: new Map(ascending.map((value) => [value, `value-${value}`])),
      })
      const setSubscriber = vi.fn()
      const mapSubscriber = vi.fn()
      store.subscribe('set', setSubscriber)
      store.subscribe('map', mapSubscriber)

      store.setValue('set', new Set(descending))
      store.setValue(
        'map',
        new Map(descending.map((value) => [value, `value-${value}`]))
      )

      expect(setSubscriber).not.toHaveBeenCalled()
      expect(mapSubscriber).not.toHaveBeenCalled()
    })

    it('rejects unsupported form values with a clear boundary error', () => {
      expect(
        () => new FormStore<any>({ task: Promise.resolve('later') })
      ).toThrow('Form values cannot contain Promise, WeakMap, or WeakSet instances')
      expect(
        () => new FormStore<any>({ callback: () => undefined })
      ).toThrow('Form values cannot contain symbols or functions')
    })

    it('detaches object values at the setValue boundary', () => {
      const store = new FormStore({ profile: { name: 'Initial' } })
      const externalProfile = { name: 'Ada' }

      store.setValue('profile', externalProfile)
      const storedProfile = store.getValue('profile')
      externalProfile.name = 'Grace'

      expect(storedProfile).not.toBe(externalProfile)
      expect(store.getValue('profile')).toEqual({ name: 'Ada' })
    })
  })

  describe('getError / setError', () => {
    it('should get and set field errors', () => {
      const store = new FormStore({ email: '' })

      expect(store.getError('email')).toBeUndefined()

      store.setError('email', 'Invalid email')
      expect(store.getError('email')).toBe('Invalid email')
    })

    it('should clear error when set to undefined', () => {
      const store = new FormStore({ email: '' })

      store.setError('email', 'Invalid email')
      expect(store.getError('email')).toBe('Invalid email')

      store.setError('email', undefined)
      expect(store.getError('email')).toBeUndefined()
    })
  })

  describe('getTouched / setTouched', () => {
    it('should get and set touched state', () => {
      const store = new FormStore({ email: '' })

      expect(store.getTouched('email')).toBe(false)

      store.setTouched('email', true)
      expect(store.getTouched('email')).toBe(true)
    })

    it('should clear touched when set to false', () => {
      const store = new FormStore({ email: '' })

      store.setTouched('email', true)
      expect(store.getTouched('email')).toBe(true)

      store.setTouched('email', false)
      expect(store.getTouched('email')).toBe(false)
    })
  })

  describe('getFieldState', () => {
    it('should return complete field state', () => {
      const store = new FormStore({ email: 'test@example.com' })

      const state = store.getFieldState('email')

      expect(state).toEqual({
        value: 'test@example.com',
        error: undefined,
        touched: false,
        dirty: false,
        isValidating: false,
      })
    })

    it('should mark field as dirty when value changes', () => {
      const store = new FormStore({ email: 'test@example.com' })

      store.setValue('email', 'new@example.com')
      const state = store.getFieldState('email')

      expect(state.dirty).toBe(true)
    })

    it('should not mark field as dirty when value is same', () => {
      const store = new FormStore({ email: 'test@example.com' })

      store.setValue('email', 'test@example.com')
      const state = store.getFieldState('email')

      expect(state.dirty).toBe(false)
    })

    it('should include error in field state', () => {
      const store = new FormStore({ email: '' })

      store.setError('email', 'Required')
      const state = store.getFieldState('email')

      expect(state.error).toBe('Required')
    })

    it('should include touched in field state', () => {
      const store = new FormStore({ email: '' })

      store.setTouched('email', true)
      const state = store.getFieldState('email')

      expect(state.touched).toBe(true)
    })

    it('does not let public mutations poison a cached field state', () => {
      const store = new FormStore({ name: 'Ada' })
      const state = store.getFieldState('name')

      expect(Reflect.set(state, 'error', 'fake')).toBe(false)
      expect(Reflect.set(state, 'touched', true)).toBe(false)

      expect(store.getFieldState('name')).toBe(state)
      expect(store.getFieldState('name').error).toBeUndefined()
      expect(store.getFieldState('name').touched).toBe(false)
    })
  })

  describe('subscribe', () => {
    it('notifies internal field subscribers without creating public snapshots', () => {
      const store = new FormStore({ items: [{ value: '' }] })
      const callback = vi.fn()
      const publicSnapshot = vi.spyOn(store, 'getFieldState')
      const unsubscribe = store.subscribeToField('items.0.value', callback)

      store.setValue('items.0.value', 'updated')

      expect(callback).toHaveBeenCalledTimes(1)
      expect(publicSnapshot).not.toHaveBeenCalled()
      expect(store.getInternalFieldState('items.0.value').value).toBe('updated')
      unsubscribe()
    })

    it('keeps shared subscription paths until public and internal listeners leave', () => {
      const store = new FormStore({ profile: { name: '' } })
      const publicCallback = vi.fn()
      const internalCallback = vi.fn()
      const unsubscribePublic = store.subscribe('profile', publicCallback)
      const unsubscribeInternal = store.subscribeToField('profile', internalCallback)

      unsubscribePublic()
      store.setValue('profile.name', 'Ada')
      expect(internalCallback).toHaveBeenCalledTimes(1)

      unsubscribeInternal()
      store.setValue('profile.name', 'Grace')
      expect(internalCallback).toHaveBeenCalledTimes(1)
    })

    it('should notify subscriber when field value changes', () => {
      const store = new FormStore({ email: '' })
      const callback = vi.fn()

      store.subscribe('email', callback)
      store.setValue('email', 'test@example.com')

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 'test@example.com',
          dirty: true,
        })
      )
    })

    it('should notify subscriber when field error changes', () => {
      const store = new FormStore({ email: '' })
      const callback = vi.fn()

      store.subscribe('email', callback)
      store.setError('email', 'Invalid email')

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid email',
        })
      )
    })

    it('should notify subscriber when field touched changes', () => {
      const store = new FormStore({ email: '' })
      const callback = vi.fn()

      store.subscribe('email', callback)
      store.setTouched('email', true)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          touched: true,
        })
      )
    })

    it('should NOT notify subscriber for other field changes', () => {
      const store = new FormStore({ email: '', password: '' })
      const callback = vi.fn()

      store.subscribe('email', callback)
      store.setValue('password', 'secret123')

      expect(callback).not.toHaveBeenCalled() // Field isolation!
    })

    it('should support multiple subscribers for same field', () => {
      const store = new FormStore({ email: '' })
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      store.subscribe('email', callback1)
      store.subscribe('email', callback2)

      store.setValue('email', 'test@example.com')

      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
    })

    it('should allow unsubscribe', () => {
      const store = new FormStore({ email: '' })
      const callback = vi.fn()

      const unsubscribe = store.subscribe('email', callback)

      store.setValue('email', 'test@example.com')
      expect(callback).toHaveBeenCalledTimes(1)

      unsubscribe()

      store.setValue('email', 'new@example.com')
      expect(callback).toHaveBeenCalledTimes(1) // No new call after unsubscribe
    })
  })

  describe('setArrayValue', () => {
    it('remaps indexed metadata without scanning the index mapping per path', () => {
      type Values = { items: Array<{ value: string }> }
      const items = Array.from({ length: 200 }, (_, index) => ({
        value: `item-${index}`,
      }))
      const store = new FormStore<Values>({ items })
      store.setError('items.199.value', 'Last item error')
      store.setTouched('items.198.value', true)

      const newToOldIndices = Array.from(
        { length: items.length },
        (_, index) => items.length - index - 1
      )
      const indexOf = vi.spyOn(newToOldIndices, 'indexOf')

      store.setArrayValue('items', [...items].reverse(), newToOldIndices)

      expect(indexOf).not.toHaveBeenCalled()
      expect(store.getError('items.0.value')).toBe('Last item error')
      expect(store.getTouched('items.1.value')).toBe(true)
    })

    it('drops cached values for removed array entries', () => {
      type Values = { items: Array<{ payload: Uint8Array }> }
      const store = new FormStore<Values>({ items: [] })
      const payload = { payload: new Uint8Array(1024) }
      store.setArrayValue('items', [payload], [undefined])
      store.getFieldState('items.0')

      const snapshots = (
        store as unknown as {
          fieldSnapshots: Map<string, { value: unknown }>
        }
      ).fieldSnapshots
      expect(snapshots.get('items.0')?.value).toBe(
        store.getInternalValue('items.0')
      )
      expect(snapshots.get('items.0')?.value).not.toBe(payload)

      store.setArrayValue('items', [], [])

      expect(store.getValue('items')).toEqual([])
      expect(snapshots.has('items')).toBe(false)
      expect(snapshots.has('items.0')).toBe(false)
    })

    it('detaches new rows while preserving mapped store-owned row identity', () => {
      const store = new FormStore({ items: [{ name: 'first' }] })
      const existingRow = store.getInternalValue('items.0')
      const externalRow = { name: 'second' }

      store.setArrayValue('items', [existingRow, externalRow], [0, undefined])
      const storedItems = store.getInternalValue('items')
      externalRow.name = 'changed outside'

      expect(storedItems[0]).toBe(existingRow)
      expect(storedItems[1]).not.toBe(externalRow)
      expect(storedItems[1]).toEqual({ name: 'second' })
    })
  })

  it('retains field error revisions only while validation is active', () => {
    const store = new FormStore({ email: '' })
    const revisions = (
      store as unknown as { fieldErrorRevisions: Map<string, number> }
    ).fieldErrorRevisions

    for (let index = 0; index < 10_000; index++) {
      store.setError(`unused.${index}` as any, undefined)
    }
    expect(revisions.size).toBe(0)

    const controller = store.startValidation('email')
    store.setError('email', 'Manual')
    expect(revisions.size).toBe(1)
    store.endValidation('email', controller)
    expect(revisions.size).toBe(0)

    store.dispose()
    expect(revisions.size).toBe(0)
  })

  describe('reset', () => {
    it('should reset form to initial values', () => {
      const store = new FormStore({ email: '', password: '' })

      store.setValue('email', 'test@example.com')
      store.setValue('password', 'secret123')
      store.setError('email', 'Invalid')
      store.setTouched('password', true)

      store.reset()

      expect(store.getValues()).toEqual({ email: '', password: '' })
      expect(store.getError('email')).toBeUndefined()
      expect(store.getTouched('password')).toBe(false)
    })

    it('should reset to new initial values if provided', () => {
      const store = new FormStore({ email: '', password: '' })

      store.setValue('email', 'test@example.com')

      store.reset({ email: 'new@example.com' })

      expect(store.getValue('email')).toBe('new@example.com')
      expect(store.getValue('password')).toBe('')
    })

    it('should notify subscribers on reset', () => {
      const store = new FormStore({ email: 'test@example.com' })
      const callback = vi.fn()

      store.subscribe('email', callback)
      store.setValue('email', 'new@example.com')

      callback.mockClear()

      store.reset()

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 'test@example.com',
        })
      )
    })
  })

  describe('getErrors', () => {
    it('should return all errors', () => {
      const store = new FormStore({ email: '', password: '' })

      store.setError('email', 'Invalid email')
      store.setError('password', 'Too short')

      const errors = store.getErrors()

      expect(errors).toEqual({
        email: 'Invalid email',
        password: 'Too short',
      })
    })

    it('should return empty object when no errors', () => {
      const store = new FormStore({ email: '' })

      expect(store.getErrors()).toEqual({})
    })
  })

  describe('getTouchedFields', () => {
    it('should return all touched fields', () => {
      const store = new FormStore({ email: '', password: '' })

      store.setTouched('email', true)
      store.setTouched('password', true)

      const touched = store.getTouchedFields()

      expect(touched).toEqual({
        email: true,
        password: true,
      })
    })

    it('should return empty object when no fields touched', () => {
      const store = new FormStore({ email: '' })

      expect(store.getTouchedFields()).toEqual({})
    })
  })

  describe('isDirty', () => {
    it('should return true when form values changed', () => {
      const store = new FormStore({ email: '' })

      expect(store.isDirty()).toBe(false)

      store.setValue('email', 'test@example.com')

      expect(store.isDirty()).toBe(true)
    })

    it('should return false when values same as initial', () => {
      const store = new FormStore({ email: 'test@example.com' })

      store.setValue('email', 'new@example.com')
      expect(store.isDirty()).toBe(true)

      store.setValue('email', 'test@example.com')
      expect(store.isDirty()).toBe(false)
    })
  })

  describe('isValid', () => {
    it('should return true when no errors', () => {
      const store = new FormStore({ email: '' })

      expect(store.isValid()).toBe(true)
    })

    it('should return false when errors exist', () => {
      const store = new FormStore({ email: '' })

      store.setError('email', 'Required')

      expect(store.isValid()).toBe(false)
    })

    it('should return true after errors cleared', () => {
      const store = new FormStore({ email: '' })

      store.setError('email', 'Required')
      expect(store.isValid()).toBe(false)

      store.setError('email', undefined)
      expect(store.isValid()).toBe(true)
    })
  })
})
