import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FormState } from '../../types.js'
import {
  REDACTED_VALUE,
  createFormSnapshot,
  createPerformanceMonitor,
  diffFormState,
  exposeFormToWindow,
  isSensitiveField,
  logFormState,
  redactDevToolsValue,
} from '../devtools.js'

interface LoginValues {
  email: string
  password: string
  profile: {
    apiToken: string
    displayName: string
  }
}

const initialValues: LoginValues = {
  email: '',
  password: '',
  profile: {
    apiToken: '',
    displayName: '',
  },
}

function createState(): FormState<LoginValues> {
  return {
    values: {
      email: 'person@example.com',
      password: 'correct horse battery staple',
      profile: {
        apiToken: 'token-value',
        displayName: 'Neo',
      },
    },
    errors: {
      password: 'The leaked password is incorrect',
    },
    touched: {
      email: true,
      password: true,
    },
    isSubmitting: false,
    isSubmitted: false,
    isValid: false,
    isDirty: true,
    isValidating: false,
    submitCount: 0,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  delete (window as Window & { __NEO_FORMS__?: unknown }).__NEO_FORMS__
})

describe('DevTools privacy', () => {
  it('redacts sensitive values and errors in snapshots by default', () => {
    const snapshot = createFormSnapshot(createState(), initialValues)

    expect(snapshot.values).toEqual({
      email: 'person@example.com',
      password: REDACTED_VALUE,
      profile: {
        apiToken: REDACTED_VALUE,
        displayName: 'Neo',
      },
    })
    expect(snapshot.errors.password).toBe(REDACTED_VALUE)
    expect(snapshot.fields.find((field) => field.name === 'password')?.value).toBe(
      REDACTED_VALUE
    )
    expect(snapshot.fields.find((field) => field.name === 'password')?.error).toBe(
      REDACTED_VALUE
    )
  })

  it('derives field entries from ancestor-protected snapshot values', () => {
    const initial = { vault: { credential: '' } }
    const state: FormState<typeof initial> = {
      values: { vault: { credential: 'secret-value' } },
      errors: { 'vault.credential': 'error contains secret' },
      touched: {},
      isSubmitting: false,
      isSubmitted: false,
      isValid: true,
      isDirty: true,
      isValidating: false,
      submitCount: 0,
    }

    const sensitiveSnapshot = createFormSnapshot(state, initial, {
      sensitiveFields: ['vault'],
    })
    const customSnapshot = createFormSnapshot(state, initial, {
      redactor: (value, path) => path === 'vault' ? '[CUSTOM]' : value,
    })

    expect(sensitiveSnapshot.values.vault.credential).toBe(REDACTED_VALUE)
    expect(sensitiveSnapshot.errors['vault.credential']).toBe(REDACTED_VALUE)
    expect(sensitiveSnapshot.fields).toEqual([
      expect.objectContaining({
        error: REDACTED_VALUE,
        name: 'vault.credential',
        value: REDACTED_VALUE,
      }),
    ])
    expect(customSnapshot.values.vault).toBe('[CUSTOM]')
    expect(customSnapshot.errors['vault.credential']).toBe('[CUSTOM]')
    expect(customSnapshot.fields).toEqual([
      expect.objectContaining({
        name: 'vault',
        value: '[CUSTOM]',
      }),
    ])
  })

  it.each([
    ['string', ['vault']],
    ['regular expression', [/^vault$/]],
  ] as const)(
    'propagates a %s matcher through nested ancestor field names',
    (_kind, sensitiveFields) => {
      const initial = { profile: { vault: { credential: '' } } }
      const state: FormState<typeof initial> = {
        values: { profile: { vault: { credential: 'secret-value' } } },
        errors: {
          'profile.vault.credential': 'error contains secret',
        },
        touched: {},
        isSubmitting: false,
        isSubmitted: false,
        isValid: false,
        isDirty: true,
        isValidating: false,
        submitCount: 0,
      }

      const snapshot = createFormSnapshot(state, initial, { sensitiveFields })
      const field = snapshot.fields.find(
        (entry) => entry.name === 'profile.vault.credential'
      )

      expect(snapshot.values.profile.vault.credential).toBe(REDACTED_VALUE)
      expect(snapshot.errors['profile.vault.credential']).toBe(REDACTED_VALUE)
      expect(field?.value).toBe(REDACTED_VALUE)
      expect(field?.error).toBe(REDACTED_VALUE)
    }
  )

  it('supports application-specific sensitive fields and custom redaction', () => {
    const snapshot = createFormSnapshot(createState(), initialValues, {
      sensitiveFields: ['email'],
      redactor: (value, path) => (path.endsWith('displayName') ? 'hidden' : value),
    })

    expect(snapshot.values.email).toBe(REDACTED_VALUE)
    expect(snapshot.values.profile.displayName).toBe('hidden')
  })

  it('includes sensitive values only after an explicit opt-in', () => {
    const snapshot = createFormSnapshot(createState(), initialValues, {
      includeSensitiveValues: true,
    })

    expect(snapshot.values.password).toBe('correct horse battery staple')
    expect(snapshot.values.profile.apiToken).toBe('token-value')
  })

  it('does not mutate state values or stateful custom matchers', () => {
    const state = createState()
    const matcher = /displayName/g
    matcher.lastIndex = 4

    const snapshot = createFormSnapshot(state, initialValues, {
      sensitiveFields: [matcher],
    })

    expect(state.values.password).toBe('correct horse battery staple')
    expect(snapshot.values).not.toBe(state.values)
    expect(matcher.lastIndex).toBe(4)
  })

  it('recognizes common credentials but not ordinary fields', () => {
    expect(isSensitiveField('credentials.refreshToken')).toBe(true)
    expect(isSensitiveField('payment.card_number')).toBe(true)
    expect(isSensitiveField('vault.credential', ['vault'])).toBe(true)
    expect(isSensitiveField('profile.vault.credential', ['vault'])).toBe(true)
    expect(isSensitiveField('profile.vault.credential', [/^vault$/])).toBe(true)
    expect(isSensitiveField('profile.displayName')).toBe(false)
  })

  it('handles circular diagnostic objects without recursing forever', () => {
    const diagnostic: Record<string, unknown> = { email: 'person@example.com' }
    diagnostic.self = diagnostic

    expect(redactDevToolsValue(diagnostic, '')).toEqual({
      email: 'person@example.com',
      self: '[Circular]',
    })
  })

  it('redacts sensitive data nested in Error, Map, and Set values', () => {
    const symbolToken = Symbol('apiToken')
    const failure = new Error('diagnostic') as Error & {
      apiToken: string
      [symbolToken]: string
    }
    failure.apiToken = 'error-secret'
    failure[symbolToken] = 'symbol-secret'
    const value = {
      failure,
      metadata: new Map([['password', 'map-secret']]),
      flags: new Set([{ apiKey: 'set-secret' }]),
    }

    const redacted = redactDevToolsValue(value, '') as typeof value
    expect((redacted.failure as typeof failure).apiToken).toBe(REDACTED_VALUE)
    expect((redacted.failure as typeof failure)[symbolToken]).toBe(REDACTED_VALUE)
    expect(redacted.metadata.get('password')).toBe(REDACTED_VALUE)
    expect(Array.from(redacted.flags)[0]?.apiKey).toBe(REDACTED_VALUE)

    const state: FormState<typeof value> = {
      values: value,
      errors: {},
      touched: {},
      isSubmitting: false,
      isSubmitted: false,
      isValid: true,
      isDirty: false,
      isValidating: false,
      submitCount: 0,
    }
    const snapshot = createFormSnapshot(state, value)
    const snapshotValues = snapshot.values as typeof value
    expect((snapshotValues.failure as typeof failure).apiToken).toBe(REDACTED_VALUE)
    expect((snapshotValues.failure as typeof failure)[symbolToken]).toBe(
      REDACTED_VALUE
    )
    expect(snapshotValues.metadata.get('password')).toBe(REDACTED_VALUE)
    expect(Array.from(snapshotValues.flags)[0]?.apiKey).toBe(REDACTED_VALUE)

    const fields = new Map(snapshot.fields.map((field) => [field.name, field.value]))
    expect((fields.get('failure') as typeof failure).apiToken).toBe(REDACTED_VALUE)
    expect((fields.get('metadata') as Map<string, string>).get('password')).toBe(
      REDACTED_VALUE
    )
    expect(
      Array.from(fields.get('flags') as Set<{ apiKey: string }>)[0]?.apiKey
    ).toBe(REDACTED_VALUE)
  })

  it('redacts Map keys and values when the whole Map is sensitive', () => {
    const redacted = redactDevToolsValue(
      { vault: new Map([['key-secret', 'value-secret']]) },
      '',
      { sensitiveFields: ['vault'] }
    ) as { vault: Map<string, string> }

    expect(Array.from(redacted.vault)).toEqual([
      [REDACTED_VALUE, REDACTED_VALUE],
    ])
  })

  it('does not leak redacted Error properties through a non-sensitive alias', () => {
    const shared = new Error('diagnostic') as Error & { value: string }
    shared.value = 'alias-secret'

    const redacted = redactDevToolsValue(
      { a: shared, b: shared },
      '',
      { sensitiveFields: ['a.value'] }
    ) as { a: typeof shared; b: typeof shared }

    expect(redacted.a.value).toBe(REDACTED_VALUE)
    expect(redacted.b.value).toBe('alias-secret')
    expect(redacted.a).not.toBe(redacted.b)
  })

  it('redacts sensitive data nested in a non-enumerable Error cause', () => {
    const failure = new Error('outer', {
      cause: {
        apiToken: 'cause-secret',
        nested: new Map([['password', 'map-cause-secret']]),
      },
    })
    const value = { failure }

    const redacted = redactDevToolsValue(value, '') as typeof value
    const redactedCause = redacted.failure.cause as {
      apiToken: string
      nested: Map<string, string>
    }
    expect(redactedCause.apiToken).toBe(REDACTED_VALUE)
    expect(redactedCause.nested.get('password')).toBe(REDACTED_VALUE)

    const state: FormState<typeof value> = {
      values: value,
      errors: {},
      touched: {},
      isSubmitting: false,
      isSubmitted: false,
      isValid: true,
      isDirty: false,
      isValidating: false,
      submitCount: 0,
    }
    const snapshot = createFormSnapshot(state, value)
    const snapshotFailure = snapshot.values.failure as Error
    const snapshotCause = snapshotFailure.cause as typeof redactedCause
    expect(snapshotCause.apiToken).toBe(REDACTED_VALUE)
    expect(snapshotCause.nested.get('password')).toBe(REDACTED_VALUE)
    const fieldFailure = snapshot.fields.find((field) => field.name === 'failure')
      ?.value as Error
    expect((fieldFailure.cause as typeof redactedCause).apiToken).toBe(
      REDACTED_VALUE
    )
  })

  it('redacts explicitly sensitive non-enumerable Error fields', () => {
    const failure = new Error('message-secret')
    Object.defineProperty(failure, 'name', {
      configurable: true,
      value: 'name-secret',
      writable: true,
    })
    failure.stack = 'stack-secret'

    const redacted = redactDevToolsValue(
      { failure },
      '',
      {
        sensitiveFields: [
          'failure.name',
          'failure.message',
          'failure.stack',
        ],
      }
    ) as { failure: Error }

    expect(redacted.failure.name).toBe(REDACTED_VALUE)
    expect(redacted.failure.message).toBe(REDACTED_VALUE)
    expect(redacted.failure.stack).toBe(REDACTED_VALUE)

    const messageOnly = redactDevToolsValue(
      { failure: new Error('message-secret') },
      '',
      { sensitiveFields: ['failure.message'] }
    ) as { failure: Error }
    expect(messageOnly.failure.message).toBe(REDACTED_VALUE)
    expect(messageOnly.failure.stack).toBe(REDACTED_VALUE)
  })

  it('keeps path-specific redaction isolated across shared built-in aliases', () => {
    type SharedDiagnostic = Error & {
      map: Map<string, { value: string }>
      meta: { value: string }
      set: Set<{ value: string }>
      value: string
    }
    const shared = new Error('diagnostic') as SharedDiagnostic
    shared.value = 'direct-secret'
    shared.meta = { value: 'nested-secret' }
    shared.map = new Map([['entry', { value: 'map-secret' }]])
    shared.set = new Set([{ value: 'set-secret' }])

    const redacted = redactDevToolsValue(
      { sensitive: shared, safe: shared },
      '',
      {
        sensitiveFields: [
          'sensitive.value',
          'sensitive.meta.value',
          'sensitive.map.entry.value',
          'sensitive.set.0.value',
        ],
      }
    ) as { safe: SharedDiagnostic; sensitive: SharedDiagnostic }

    expect(redacted.sensitive).not.toBe(redacted.safe)
    expect(redacted.sensitive.value).toBe(REDACTED_VALUE)
    expect(redacted.sensitive.meta.value).toBe(REDACTED_VALUE)
    expect(redacted.sensitive.map.get('entry')?.value).toBe(REDACTED_VALUE)
    expect(Array.from(redacted.sensitive.set)[0]?.value).toBe(REDACTED_VALUE)
    expect(redacted.safe.value).toBe('direct-secret')
    expect(redacted.safe.meta.value).toBe('nested-secret')
    expect(redacted.safe.map.get('entry')?.value).toBe('map-secret')
    expect(Array.from(redacted.safe.set)[0]?.value).toBe('set-secret')
  })

  it('preserves a sensitive object shape while redacting every leaf', () => {
    expect(
      redactDevToolsValue(
        {
          secretBundle: {
            primary: 'first',
            backups: ['second', 'third'],
          },
        },
        ''
      )
    ).toEqual({
      secretBundle: {
        primary: REDACTED_VALUE,
        backups: [REDACTED_VALUE, REDACTED_VALUE],
      },
    })
  })

  it('redacts an unsafe snapshot again before logging it', () => {
    const snapshot = createFormSnapshot(createState(), initialValues, {
      includeSensitiveValues: true,
    })
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'group').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'table').mockImplementation(() => {})
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {})

    logFormState('login', snapshot)

    expect(log).toHaveBeenCalledWith(
      'Values:',
      expect.objectContaining({ password: REDACTED_VALUE })
    )
  })

  it('represents arrays and built-in leaves without false dirtiness or diffs', () => {
    interface DiagnosticError extends Error {
      code: string
      self: DiagnosticError
      __proto__: { safe: boolean }
    }

    interface DiagnosticValues {
      bytes: Uint8Array
      createdAt: Date
      failure: Error
      flags: Set<string>
      matcher: RegExp
      metadata: Map<string, number>
      tags: Array<{ name: string }>
    }

    const createFailure = (code = 'E_STABLE'): DiagnosticError => {
      const error = new Error('same failure') as DiagnosticError
      error.stack = 'stable stack'
      error.code = code
      error.self = error
      Object.defineProperty(error, '__proto__', {
        configurable: true,
        enumerable: true,
        value: { safe: true },
        writable: true,
      })
      return error
    }

    const createDiagnosticValues = (): DiagnosticValues => ({
      bytes: new Uint8Array([1, 2, 3]),
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
      failure: createFailure(),
      flags: new Set(['stable']),
      matcher: /stable/gi,
      metadata: new Map([['count', 1]]),
      tags: [{ name: 'stable' }],
    })
    const diagnosticInitial = createDiagnosticValues()
    const createDiagnosticState = (values: DiagnosticValues): FormState<DiagnosticValues> => ({
      values,
      errors: {},
      touched: {},
      isSubmitting: false,
      isSubmitted: false,
      isValid: true,
      isDirty: false,
      isValidating: false,
      submitCount: 0,
    })

    const before = createFormSnapshot(
      createDiagnosticState(createDiagnosticValues()),
      diagnosticInitial
    )
    const unchanged = createFormSnapshot(
      createDiagnosticState(createDiagnosticValues()),
      diagnosticInitial
    )

    expect(before.fields.map((field) => field.name)).toEqual([
      'bytes',
      'createdAt',
      'failure',
      'flags',
      'matcher',
      'metadata',
      'tags',
    ])
    expect(before.fields.every((field) => !field.dirty)).toBe(true)
    expect(before.values.bytes).toBeInstanceOf(Uint8Array)
    expect(before.values.createdAt).toBeInstanceOf(Date)
    expect(before.values.failure).toBeInstanceOf(Error)
    expect((before.values.failure as Error).message).toBe('same failure')
    const snapshotFailure = before.values.failure as DiagnosticError
    expect(snapshotFailure).not.toBe(diagnosticInitial.failure)
    expect(snapshotFailure.code).toBe('E_STABLE')
    expect(snapshotFailure.self).toBe(snapshotFailure)
    expect(Object.prototype.hasOwnProperty.call(snapshotFailure, '__proto__')).toBe(true)
    expect(snapshotFailure.__proto__).toEqual({ safe: true })
    expect(before.values.flags).toBeInstanceOf(Set)
    expect(before.values.matcher).toBeInstanceOf(RegExp)
    expect(before.values.metadata).toBeInstanceOf(Map)
    expect(before.values.tags).toEqual([{ name: 'stable' }])
    expect(diffFormState(before, unchanged).changedFields).toEqual([])

    const changedValues = createDiagnosticValues()
    changedValues.bytes[1] = 9
    changedValues.createdAt.setUTCDate(3)
    ;(changedValues.failure as DiagnosticError).code = 'E_CHANGED'
    changedValues.flags.add('changed')
    changedValues.matcher = /changed/g
    changedValues.metadata.set('count', 2)
    changedValues.tags.push({ name: 'changed' })
    const changed = createFormSnapshot(
      createDiagnosticState(changedValues),
      diagnosticInitial
    )

    expect(changed.fields.find((field) => field.name === 'bytes')?.dirty).toBe(true)
    expect(changed.fields.find((field) => field.name === 'tags')?.dirty).toBe(true)
    expect(diffFormState(before, changed).changedFields).toEqual([
      'bytes',
      'createdAt',
      'failure',
      'flags',
      'matcher',
      'metadata',
      'tags',
    ])
  })

  it('detects alias topology changes in fields and snapshot diffs', () => {
    const shared = { x: 1 }
    const initial = { data: { a: shared, b: shared } }
    const current = { data: { a: { x: 1 }, b: { x: 1 } } }
    const state = (values: typeof initial): FormState<typeof initial> => ({
      values,
      errors: {},
      touched: {},
      isSubmitting: false,
      isSubmitted: false,
      isValid: true,
      isDirty: values === current,
      isValidating: false,
      submitCount: 0,
    })

    const before = createFormSnapshot(state(initial), initial)
    const after = createFormSnapshot(state(current), initial)

    expect(after.fields.find((field) => field.name === 'data')?.dirty).toBe(true)
    expect(diffFormState(before, after).changedFields).toContain('data')
  })

  it('compares reordered structural Map and Set entries across value kinds', () => {
    const metadata = Symbol('metadata')
    const callable = (): number => 1
    const makeRecord = (id: number): Record<PropertyKey, unknown> => {
      const unalignedBuffer = new ArrayBuffer(9)
      new Uint8Array(unalignedBuffer, 1, 7).set([1, 2, 3, 4, 5, 6, id])
      const failure = new Error('stable', { cause: { id } })
      failure.stack = 'stable-stack'
      const record = Object.assign(Object.create(null) as Record<PropertyKey, unknown>, {
        array: [id],
        bigint: 1n,
        blob: new Blob(['x'], { type: 'text/plain' }),
        boolean: true,
        buffer: new Uint8Array([1, 2, 3, 4, id]).buffer,
        callable,
        date: new Date(id),
        error: failure,
        map: new Map([[{ id }, { value: id }]]),
        nan: Number.NaN,
        negativeZero: -0,
        regexp: new RegExp(String(id), 'g'),
        set: new Set([{ id }]),
        text: `value-${id}`,
        undefined,
        view: new Uint8Array(unalignedBuffer, 1, 7),
      })
      record[metadata] = `metadata-${id}`
      return record
    }
    const initialSet = new Set([makeRecord(1), makeRecord(2)])
    const currentSet = new Set([makeRecord(2), makeRecord(1)])
    const initialMap = new Map([
      [makeRecord(1), { id: 1 }],
      [makeRecord(2), { id: 2 }],
    ])
    const currentMap = new Map([
      [makeRecord(2), { id: 2 }],
      [makeRecord(1), { id: 1 }],
    ])
    const initial = { map: initialMap, set: initialSet }
    const state: FormState<typeof initial> = {
      values: { map: currentMap, set: currentSet },
      errors: {},
      touched: {},
      isSubmitting: false,
      isSubmitted: false,
      isValid: true,
      isDirty: false,
      isValidating: false,
      submitCount: 0,
    }

    const snapshot = createFormSnapshot(state, initial)

    expect(snapshot.fields.map((field) => field.dirty)).toEqual([false, false])
  })

  it('detects typed-view backing-buffer and relative-offset topology changes', () => {
    const initialBuffer = new ArrayBuffer(12)
    const currentBuffer = new ArrayBuffer(12)
    const initial = {
      data: {
        first: new Uint8Array(initialBuffer, 0, 4),
        second: new Uint8Array(initialBuffer, 4, 4),
      },
    }
    const current = {
      data: {
        first: new Uint8Array(currentBuffer, 4, 4),
        second: new Uint8Array(currentBuffer, 0, 4),
      },
    }
    const state = (values: typeof initial): FormState<typeof initial> => ({
      values,
      errors: {},
      touched: {},
      isSubmitting: false,
      isSubmitted: false,
      isValid: true,
      isDirty: false,
      isValidating: false,
      submitCount: 0,
    })

    const before = createFormSnapshot(state(initial), initial)
    const after = createFormSnapshot(state(current), initial)

    expect(after.fields.find((field) => field.name === 'data')?.dirty).toBe(true)
    expect(diffFormState(before, after).changedFields).toContain('data')
  })

  it.each(['shared-to-distinct', 'distinct-to-shared'] as const)(
    'preserves and reports top-level view-buffer topology: %s',
    (direction) => {
      const shared = new ArrayBuffer(8)
      const sharedValues = {
        first: new Uint8Array(shared, 0, 4),
        second: new Uint8Array(shared, 4, 4),
      }
      const distinctValues = {
        first: new Uint8Array([0, 0, 0, 0]),
        second: new Uint8Array([0, 0, 0, 0]),
      }
      const initial = direction === 'shared-to-distinct'
        ? sharedValues
        : distinctValues
      const current = direction === 'shared-to-distinct'
        ? distinctValues
        : sharedValues
      const state = (
        values: typeof initial,
        isDirty: boolean
      ): FormState<typeof initial> => ({
        values,
        errors: {},
        touched: {},
        isSubmitting: false,
        isSubmitted: false,
        isValid: true,
        isDirty,
        isValidating: false,
        submitCount: 0,
      })

      const before = createFormSnapshot(state(initial, false), initial)
      const after = createFormSnapshot(state(current, true), initial)
      const beforeValues = before.values as typeof initial
      const afterValues = after.values as typeof initial

      expect(beforeValues.first.buffer === beforeValues.second.buffer).toBe(
        direction === 'shared-to-distinct'
      )
      expect(afterValues.first.buffer === afterValues.second.buffer).toBe(
        direction === 'distinct-to-shared'
      )
      expect(after.fields.some((field) => field.dirty)).toBe(true)
      expect(diffFormState(before, after).changedFields.length).toBeGreaterThan(0)
    }
  )

  it('marks mismatched built-in shapes, bytes, metadata, and collections dirty', () => {
    const initialError = new Error('initial', { cause: { code: 1 } })
    initialError.stack = 'initial-stack'
    const currentError = new Error('current', { cause: { code: 2 } })
    currentError.stack = 'current-stack'
    const initialUnaligned = new Uint8Array([0, 1, 2, 3, 4, 5]).buffer
    const currentUnaligned = new Uint8Array([0, 1, 2, 9, 4, 5]).buffer
    const initial: Record<string, unknown> = {
      arrayLength: [1],
      arrayType: [1],
      blob: new Blob(['a'], { type: 'text/plain' }),
      bufferBytes: new Uint8Array([1, 2, 3, 4, 5]).buffer,
      bufferLength: new ArrayBuffer(4),
      bufferType: new ArrayBuffer(4),
      date: new Date(1),
      dateType: new Date(1),
      error: initialError,
      errorType: initialError,
      mapMissing: new Map([['key', 1]]),
      mapObjectKey: new Map([[{ id: 1 }, { value: 1 }]]),
      mapSize: new Map([['key', 1]]),
      mapType: new Map([['key', 1]]),
      mapValue: new Map([['key', { value: 1 }]]),
      properties: { left: true },
      prototype: Object.assign(Object.create(null), { value: 1 }),
      regexp: /initial/g,
      regexpType: /initial/g,
      setObject: new Set([{ id: 1 }]),
      setSize: new Set([1]),
      setType: new Set([1]),
      viewBytes: new Uint8Array(initialUnaligned, 1, 4),
      viewConstructor: new Uint8Array([1, 2, 3, 4]),
      viewLength: new Uint8Array([1, 2, 3, 4]),
      viewType: new Uint8Array([1, 2, 3, 4]),
    }
    const current: Record<string, unknown> = {
      arrayLength: [1, 2],
      arrayType: { 0: 1 },
      blob: new Blob(['longer'], { type: 'application/octet-stream' }),
      bufferBytes: new Uint8Array([1, 2, 3, 4, 9]).buffer,
      bufferLength: new ArrayBuffer(8),
      bufferType: {},
      date: new Date(2),
      dateType: {},
      error: currentError,
      errorType: {},
      mapMissing: new Map([['other', 1]]),
      mapObjectKey: new Map([[{ id: 2 }, { value: 2 }]]),
      mapSize: new Map([['key', 1], ['extra', 2]]),
      mapType: new Set([1]),
      mapValue: new Map([['key', { value: 2 }]]),
      properties: { right: true },
      prototype: { value: 1 },
      regexp: /current/i,
      regexpType: {},
      setObject: new Set([{ id: 2 }]),
      setSize: new Set([1, 2]),
      setType: new Map([[1, true]]),
      viewBytes: new Uint8Array(currentUnaligned, 1, 4),
      viewConstructor: new Uint16Array([513, 1027]),
      viewLength: new Uint8Array([1, 2]),
      viewType: {},
    }
    const state: FormState<any> = {
      values: current,
      errors: {},
      touched: {},
      isSubmitting: false,
      isSubmitted: false,
      isValid: true,
      isDirty: true,
      isValidating: false,
      submitCount: 0,
    }

    const snapshot = createFormSnapshot(state, initial)

    expect(
      snapshot.fields.filter((field) => !field.dirty).map((field) => field.name)
    ).toEqual(['arrayType.0', 'prototype.value'])
  })

  it('redacts collection metadata and preserves SharedArrayBuffer view aliases', () => {
    const metadata = Symbol('password')
    const map = new Map([['value', 'safe']]) as Map<string, string> & {
      [metadata]: string
    }
    const set = new Set(['safe']) as Set<string> & { [metadata]: string }
    map[metadata] = 'map-secret'
    set[metadata] = 'set-secret'
    const array = ['safe'] as string[] & { password?: string }
    array.password = 'array-secret'
    const buffer = new SharedArrayBuffer(8)
    new Uint8Array(buffer).set([1, 2, 3, 4, 5, 6, 7, 8])

    const redacted = redactDevToolsValue(
      {
        array,
        first: new DataView(buffer, 0, 4),
        map,
        second: new Uint8Array(buffer, 4, 4),
        set,
      },
      ''
    ) as {
      array: typeof array
      first: DataView
      map: typeof map
      second: Uint8Array
      set: typeof set
    }

    expect(redacted.array.password).toBe(REDACTED_VALUE)
    expect(redacted.map[metadata]).toBe(REDACTED_VALUE)
    expect(redacted.set[metadata]).toBe(REDACTED_VALUE)
    expect(redacted.first.buffer).toBe(redacted.second.buffer)
    expect(redacted.first.getUint8(0)).toBe(1)
    expect(Array.from(redacted.second)).toEqual([5, 6, 7, 8])
  })

  it.each(['safe-first', 'sensitive-first'] as const)(
    'scrubs sensitive bytes from shared backing buffers: %s',
    (order) => {
      const buffer = new ArrayBuffer(8)
      new Uint8Array(buffer).set([1, 2, 3, 4, 5, 6, 7, 8])
      const safeView = new Uint8Array(buffer, 0, 4)
      const passwordView = new Uint8Array(buffer, 4, 4)
      const values = order === 'safe-first'
        ? { safeView, passwordView }
        : { passwordView, safeView }

      const redacted = redactDevToolsValue(values, '') as {
        passwordView: typeof REDACTED_VALUE
        safeView: Uint8Array
      }

      expect(redacted.passwordView).toBe(REDACTED_VALUE)
      expect(Array.from(redacted.safeView)).toEqual([1, 2, 3, 4])
      expect(Array.from(new Uint8Array(redacted.safeView.buffer))).toEqual([
        1, 2, 3, 4, 0, 0, 0, 0,
      ])
    }
  )

  it.each(['safe-first', 'safe-last'] as const)(
    'keeps a safe middle view between disjoint sensitive ranges: %s',
    (order) => {
      const buffer = new ArrayBuffer(12)
      new Uint8Array(buffer).set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
      const passwordStart = new DataView(buffer, 0, 4)
      const safeView = new Uint8Array(buffer, 4, 4)
      const apiTokenEnd = new Uint8Array(buffer, 8, 4)
      const values = order === 'safe-first'
        ? { safeView, passwordStart, apiTokenEnd }
        : { passwordStart, apiTokenEnd, safeView }

      const redacted = redactDevToolsValue(values, '') as {
        apiTokenEnd: typeof REDACTED_VALUE
        passwordStart: typeof REDACTED_VALUE
        safeView: Uint8Array
      }

      expect(redacted.passwordStart).toBe(REDACTED_VALUE)
      expect(redacted.apiTokenEnd).toBe(REDACTED_VALUE)
      expect(Array.from(redacted.safeView)).toEqual([5, 6, 7, 8])
      expect(Array.from(new Uint8Array(redacted.safeView.buffer))).toEqual([
        0, 0, 0, 0, 5, 6, 7, 8, 0, 0, 0, 0,
      ])
    }
  )

  it.each(['public-first', 'hidden-first'] as const)(
    'scrubs binary ranges hidden by a custom redactor: %s',
    (order) => {
      const buffer = new ArrayBuffer(8)
      new Uint8Array(buffer).set([1, 2, 3, 4, 83, 69, 67, 82])
      const publicView = new Uint8Array(buffer, 0, 4)
      const hiddenView = new DataView(buffer, 4, 4)
      const values = order === 'public-first'
        ? { publicView, hiddenView }
        : { hiddenView, publicView }

      const redacted = redactDevToolsValue(values, '', {
        redactor: (value, path) =>
          path === 'hiddenView' ? REDACTED_VALUE : value,
      }) as {
        hiddenView: typeof REDACTED_VALUE
        publicView: Uint8Array
      }

      expect(redacted.hiddenView).toBe(REDACTED_VALUE)
      expect(Array.from(redacted.publicView)).toEqual([1, 2, 3, 4])
      expect(Array.from(new Uint8Array(redacted.publicView.buffer))).toEqual([
        1, 2, 3, 4, 0, 0, 0, 0,
      ])
    }
  )

  it.each([
    ['plain', 'public-first'],
    ['plain', 'hidden-first'],
    ['collections', 'public-first'],
    ['collections', 'hidden-first'],
  ] as const)(
    'scrubs binary descendants when a custom redactor replaces a %s ancestor: %s',
    (containerKind, order) => {
      const buffer = new ArrayBuffer(8)
      new Uint8Array(buffer).set([1, 2, 3, 4, 83, 69, 67, 82])
      const publicView = new Uint8Array(buffer, 0, 4)
      const hiddenView = new DataView(buffer, 4, 4)
      const metadata = Symbol('metadata')
      const failure = new Error('hidden', { cause: hiddenView })
      const collection = new Set<unknown>([
        new Map<unknown, unknown>([['failure', failure]]),
      ]) as Set<unknown> & { [metadata]: DataView }
      collection[metadata] = hiddenView
      const payload = containerKind === 'plain'
        ? { bytes: hiddenView }
        : collection
      const values = order === 'public-first'
        ? { publicView, payload }
        : { payload, publicView }

      const redacted = redactDevToolsValue(values, '', {
        redactor: (value, path) => path === 'payload' ? '[CUSTOM]' : value,
      }) as { payload: string; publicView: Uint8Array }

      expect(redacted.payload).toBe('[CUSTOM]')
      expect(Array.from(redacted.publicView)).toEqual([1, 2, 3, 4])
      expect(Array.from(new Uint8Array(redacted.publicView.buffer))).toEqual([
        1, 2, 3, 4, 0, 0, 0, 0,
      ])
    }
  )

  it.each(['public-first', 'sensitive-first'] as const)(
    'scrubs binary descendants of a sensitive built-in: %s',
    (order) => {
      const buffer = new ArrayBuffer(8)
      new Uint8Array(buffer).set([1, 2, 3, 4, 83, 69, 67, 82])
      const publicView = new Uint8Array(buffer, 0, 4)
      const apiSecret = new Error('hidden', {
        cause: new DataView(buffer, 4, 4),
      })
      const values = order === 'public-first'
        ? { publicView, apiSecret }
        : { apiSecret, publicView }

      const redacted = redactDevToolsValue(values, '') as {
        apiSecret: typeof REDACTED_VALUE
        publicView: Uint8Array
      }

      expect(redacted.apiSecret).toBe(REDACTED_VALUE)
      expect(Array.from(new Uint8Array(redacted.publicView.buffer))).toEqual([
        1, 2, 3, 4, 0, 0, 0, 0,
      ])
    }
  )

  it.each(['public-first', 'sensitive-first'] as const)(
    'shares binary redaction across snapshot values and field entries: %s',
    (order) => {
      const buffer = new ArrayBuffer(8)
      new Uint8Array(buffer).set([1, 2, 3, 4, 83, 69, 67, 82])
      const publicView = new Uint8Array(buffer, 0, 4)
      const passwordView = new Uint8Array(buffer, 4, 4)
      const values = order === 'public-first'
        ? { publicView, passwordView }
        : { passwordView, publicView }
      const state: FormState<typeof values> = {
        values,
        errors: {},
        touched: {},
        isSubmitting: false,
        isSubmitted: false,
        isValid: true,
        isDirty: false,
        isValidating: false,
        submitCount: 0,
      }

      const snapshot = createFormSnapshot(state, values)
      const fields = new Map(
        snapshot.fields.map((field) => [field.name, field.value])
      )
      const fieldPublicView = fields.get('publicView') as Uint8Array
      const snapshotPublicView = snapshot.values.publicView as Uint8Array

      expect(fields.get('passwordView')).toBe(REDACTED_VALUE)
      expect(snapshot.values.passwordView).toBe(REDACTED_VALUE)
      expect(fieldPublicView.buffer).toBe(snapshotPublicView.buffer)
      expect(Array.from(new Uint8Array(fieldPublicView.buffer))).toEqual([
        1, 2, 3, 4, 0, 0, 0, 0,
      ])
    }
  )

  it('compares equivalent cyclic collections but distinguishes their topology', () => {
    const initialSet = new Set<unknown>()
    initialSet.add(initialSet)
    const equalSet = new Set<unknown>()
    equalSet.add(equalSet)
    const innerSet = new Set<unknown>()
    innerSet.add(innerSet)
    const nestedSet = new Set<unknown>([innerSet])

    const initial = { data: initialSet }
    const createCollectionState = (data: Set<unknown>): FormState<typeof initial> => ({
      values: { data },
      errors: {},
      touched: {},
      isSubmitting: false,
      isSubmitted: false,
      isValid: true,
      isDirty: false,
      isValidating: false,
      submitCount: 0,
    })

    const before = createFormSnapshot(createCollectionState(initialSet), initial)
    const equal = createFormSnapshot(createCollectionState(equalSet), initial)
    const changed = createFormSnapshot(createCollectionState(nestedSet), initial)

    expect(equal.fields.find((field) => field.name === 'data')?.dirty).toBe(false)
    expect(diffFormState(before, equal).changedFields).toEqual([])
    expect(changed.fields.find((field) => field.name === 'data')?.dirty).toBe(true)
    expect(diffFormState(before, changed).changedFields).toEqual(['data'])
  })

  it('reports fields removed from the later snapshot as changed', () => {
    const before = createFormSnapshot(createState(), initialValues)
    const afterState = createState() as FormState<LoginValues>
    delete (afterState.values as Partial<LoginValues>).email
    const after = createFormSnapshot(afterState, initialValues)

    expect(diffFormState(before, after).changedFields).toContain('email')
  })

  it('preserves and compares RegExp lastIndex', () => {
    const initialMatcher = /neo/g
    const currentMatcher = /neo/g
    currentMatcher.lastIndex = 2
    const initial = { matcher: initialMatcher }
    const state: FormState<typeof initial> = {
      values: { matcher: currentMatcher },
      errors: {},
      touched: {},
      isSubmitting: false,
      isSubmitted: false,
      isValid: true,
      isDirty: true,
      isValidating: false,
      submitCount: 0,
    }

    const before = createFormSnapshot({ ...state, values: initial }, initial)
    const after = createFormSnapshot(state, initial)

    expect((after.values.matcher as RegExp).lastIndex).toBe(2)
    expect(after.fields[0]?.dirty).toBe(true)
    expect(diffFormState(before, after).changedFields).toEqual(['matcher'])
  })

  it('compares Error stack values', () => {
    const initialFailure = new Error('failure')
    initialFailure.stack = 'stack-a'
    const currentFailure = new Error('failure')
    currentFailure.stack = 'stack-b'
    const initial = { failure: initialFailure }
    const state: FormState<typeof initial> = {
      values: { failure: currentFailure },
      errors: {},
      touched: {},
      isSubmitting: false,
      isSubmitted: false,
      isValid: true,
      isDirty: true,
      isValidating: false,
      submitCount: 0,
    }

    const snapshot = createFormSnapshot(state, initial)

    expect(snapshot.fields[0]?.dirty).toBe(true)
  })

  it('compares self-referential Set and Map fields without overflowing', () => {
    const initialSet = new Set<unknown>()
    initialSet.add(initialSet)
    const currentSet = new Set<unknown>()
    currentSet.add(currentSet)
    const initialMap = new Map<unknown, unknown>()
    initialMap.set(initialMap, initialMap)
    const currentMap = new Map<unknown, unknown>()
    currentMap.set(currentMap, currentMap)
    const initial = { set: initialSet, map: initialMap }
    const state: FormState<typeof initial> = {
      values: { set: currentSet, map: currentMap },
      errors: {},
      touched: {},
      isSubmitting: false,
      isSubmitted: false,
      isValid: true,
      isDirty: false,
      isValidating: false,
      submitCount: 0,
    }

    const snapshot = createFormSnapshot(state, initial)

    expect(snapshot.fields.map((field) => field.dirty)).toEqual([false, false])
  })

  it('does not classify an owned empty-string error as cleared', () => {
    const beforeState = createState()
    const afterState = createState()
    const before = createFormSnapshot(
      { ...beforeState, errors: { email: 'First error' }, isValid: false },
      initialValues
    )
    const after = createFormSnapshot(
      { ...afterState, errors: { email: '' }, isValid: false },
      initialValues
    )

    expect(diffFormState(before, after).clearedErrors).toEqual([])
  })
})

describe('browser-global form exposure', () => {
  it('propagates ancestor redactors through unsafe duplicated field data', () => {
    const initial = { vault: { credential: '' } }
    const state: FormState<typeof initial> = {
      values: { vault: { credential: 'secret-value' } },
      errors: { 'vault.credential': 'error contains secret' },
      touched: {},
      isSubmitting: false,
      isSubmitted: false,
      isValid: false,
      isDirty: true,
      isValidating: false,
      submitCount: 0,
    }
    const unsafeSnapshot = createFormSnapshot(state, initial, {
      includeSensitiveValues: true,
    })
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const cleanup = exposeFormToWindow('ancestor-redactor', unsafeSnapshot, {
      enabled: true,
      redactor: (value, path) => path === 'vault' ? '[CUSTOM]' : value,
    })
    const protectedSnapshot = (window as Window & {
      __NEO_FORMS__?: Record<string, typeof unsafeSnapshot>
    }).__NEO_FORMS__?.['ancestor-redactor']
    const protectedField = protectedSnapshot?.fields.find(
      (field) => field.name === 'vault.credential'
    )

    expect(protectedSnapshot?.values.vault).toBe('[CUSTOM]')
    expect(protectedSnapshot?.errors['vault.credential']).toBe('[CUSTOM]')
    expect(protectedField?.value).toBe('[CUSTOM]')
    expect(protectedField?.error).toBe('[CUSTOM]')
    cleanup()
  })

  it('stores a protected snapshot and returns scoped cleanup', () => {
    const snapshot = createFormSnapshot(createState(), initialValues, {
      includeSensitiveValues: true,
    })
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const cleanup = exposeFormToWindow('login', snapshot, { enabled: true })
    const registry = (window as Window & {
      __NEO_FORMS__?: Record<string, typeof snapshot>
    }).__NEO_FORMS__

    expect(registry?.login?.values.password).toBe(REDACTED_VALUE)

    cleanup()

    expect(
      (window as Window & { __NEO_FORMS__?: unknown }).__NEO_FORMS__
    ).toBeUndefined()
  })

  it('does not expose forms in production without a second opt-in', () => {
    const snapshot = createFormSnapshot(createState(), initialValues)
    const previousEnvironment = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      exposeFormToWindow('login', snapshot, { enabled: true })
      expect(
        (window as Window & { __NEO_FORMS__?: unknown }).__NEO_FORMS__
      ).toBeUndefined()

      const cleanup = exposeFormToWindow('login', snapshot, {
        enabled: true,
        allowInProduction: true,
      })
      expect(
        (window as Window & { __NEO_FORMS__?: Record<string, unknown> })
          .__NEO_FORMS__?.login
      ).toBeDefined()
      cleanup()
    } finally {
      if (previousEnvironment === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = previousEnvironment
    }
  })

  it('fails closed when the runtime environment is unavailable', () => {
    const snapshot = createFormSnapshot(createState(), initialValues)
    const processDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'process')
    vi.spyOn(console, 'log').mockImplementation(() => {})

    Object.defineProperty(globalThis, 'process', {
      configurable: true,
      value: undefined,
    })
    try {
      exposeFormToWindow('login', snapshot, { enabled: true })
      expect(
        (window as Window & { __NEO_FORMS__?: unknown }).__NEO_FORMS__
      ).toBeUndefined()

      const cleanup = exposeFormToWindow('login', snapshot, {
        enabled: true,
        allowInProduction: true,
      })
      expect(
        (window as Window & { __NEO_FORMS__?: Record<string, unknown> })
          .__NEO_FORMS__?.login
      ).toBeDefined()
      cleanup()
    } finally {
      if (processDescriptor) {
        Object.defineProperty(globalThis, 'process', processDescriptor)
      }
    }
  })

  it('fails closed for non-development environment labels', () => {
    const snapshot = createFormSnapshot(createState(), initialValues)
    const previousEnvironment = process.env.NODE_ENV
    process.env.NODE_ENV = 'staging'
    vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      exposeFormToWindow('login', snapshot, { enabled: true })
      expect(
        (window as Window & { __NEO_FORMS__?: unknown }).__NEO_FORMS__
      ).toBeUndefined()

      const cleanup = exposeFormToWindow('login', snapshot, {
        enabled: true,
        allowInProduction: true,
      })
      expect(
        (window as Window & { __NEO_FORMS__?: Record<string, unknown> })
          .__NEO_FORMS__?.login
      ).toBeDefined()
      cleanup()
    } finally {
      if (previousEnvironment === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = previousEnvironment
    }
  })

  it('does not remove a newer exposure during stale cleanup', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const first = createFormSnapshot(createState(), initialValues)
    const currentState = createState()
    const secondState: FormState<LoginValues> = {
      ...currentState,
      values: { ...currentState.values, email: 'new@example.com' },
    }
    const second = createFormSnapshot(secondState, initialValues)

    const cleanupFirst = exposeFormToWindow('login', first, { enabled: true })
    const cleanupSecond = exposeFormToWindow('login', second, { enabled: true })
    cleanupFirst()

    const registry = (window as Window & {
      __NEO_FORMS__?: Record<string, typeof second>
    }).__NEO_FORMS__
    expect(registry?.login?.values.email).toBe('new@example.com')

    cleanupSecond()
  })
})

describe('performance monitor', () => {
  it('handles hostile operation names and bounds retained metrics', () => {
    const monitor = createPerformanceMonitor()
    vi.spyOn(performance, 'now').mockReturnValue(1)
    vi.spyOn(console, 'group').mockImplementation(() => {})
    vi.spyOn(console, 'table').mockImplementation(() => {})
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {})

    monitor.startTimer('__proto__')()
    monitor.startTimer('constructor')()
    for (let index = 0; index < 2_000; index++) {
      monitor.startTimer(`operation-${index}`)()
    }
    for (let index = 0; index < 150_000; index++) {
      monitor.startTimer('high-volume')()
    }

    const metrics = monitor.getMetrics()
    expect(Object.prototype.hasOwnProperty.call(metrics, '__proto__')).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(metrics, 'constructor')).toBe(true)
    expect(Object.keys(metrics).length).toBeLessThanOrEqual(1_000)
    expect(() => monitor.logMetrics()).not.toThrow()
  })
})
