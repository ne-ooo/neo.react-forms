import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FormState } from '../../types.js'
import {
  REDACTED_VALUE,
  createFormSnapshot,
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
  })

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
})

describe('browser-global form exposure', () => {
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

  it('does not remove a newer exposure during stale cleanup', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const first = createFormSnapshot(createState(), initialValues)
    const secondState = createState()
    secondState.values.email = 'new@example.com'
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
