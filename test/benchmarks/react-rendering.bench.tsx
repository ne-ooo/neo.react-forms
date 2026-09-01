/**
 * React rendering performance benchmarks
 *
 * Compares rendering performance across libraries
 */

import { describe, expect } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useForm as useNeoForm } from '../../src/hooks/useForm.js'
import { useFormik as useFormikForm } from 'formik'
import { useForm as useRHF } from 'react-hook-form'
import { benchmark as bench, generateFormData } from './utils/benchmark-helpers.js'

describe('React Rendering: Form Initialization', () => {
  const sizes = [10, 30, 100]

  for (const size of sizes) {
    const data = generateFormData(size)

    bench(`neo.react-forms: Initialize ${size}-field form`, () => {
      const { unmount } = renderHook(() =>
        useNeoForm({
          initialValues: data,
        })
      )
      cleanup()
    })

    bench(`Formik: Initialize ${size}-field form`, () => {
      const { unmount } = renderHook(() =>
        useFormikForm({
          initialValues: data,
          onSubmit: () => {},
        })
      )
      cleanup()
    })

    bench(`React Hook Form: Initialize ${size}-field form`, () => {
      const { unmount } = renderHook(() =>
        useRHF({
          defaultValues: data,
        })
      )
      cleanup()
    })
  }
})

describe('React Rendering: Field Updates', () => {
  bench('neo.react-forms: Update single field (10 fields)', () => {
    const data = generateFormData(10)
    const { result, unmount } = renderHook(() =>
      useNeoForm({
        initialValues: data,
      })
    )

    try {
      act(() => {
        result.current.setFieldValue('field0', 'new value')
      })
    } finally {
      cleanup()
    }
  })

  bench('Formik: Update single field (10 fields)', () => {
    const data = generateFormData(10)
    const { result, unmount } = renderHook(() =>
      useFormikForm({
        initialValues: data,
        onSubmit: () => {},
      })
    )

    try {
      act(() => {
        void result.current.setFieldValue('field0', 'new value')
      })
    } finally {
      cleanup()
    }
  })

  bench('React Hook Form: Update single field (10 fields)', () => {
    const data = generateFormData(10)
    const { result, unmount } = renderHook(() =>
      useRHF({
        defaultValues: data,
      })
    )

    try {
      act(() => {
        result.current.setValue('field0', 'new value')
      })
    } finally {
      cleanup()
    }
  })
})

describe('React Rendering: Multiple Updates', () => {
  bench('neo.react-forms: Update 10 fields sequentially', () => {
    const data = generateFormData(10)
    const { result, unmount } = renderHook(() =>
      useNeoForm({
        initialValues: data,
      })
    )

    try {
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.setFieldValue(`field${i}`, `new value ${i}`)
        }
      })
    } finally {
      cleanup()
    }
  })

  bench('Formik: Update 10 fields sequentially', () => {
    const data = generateFormData(10)
    const { result, unmount } = renderHook(() =>
      useFormikForm({
        initialValues: data,
        onSubmit: () => {},
      })
    )

    try {
      act(() => {
        for (let i = 0; i < 10; i++) {
          void result.current.setFieldValue(`field${i}`, `new value ${i}`)
        }
      })
    } finally {
      cleanup()
    }
  })

  bench('React Hook Form: Update 10 fields sequentially', () => {
    const data = generateFormData(10)
    const { result, unmount } = renderHook(() =>
      useRHF({
        defaultValues: data,
      })
    )

    try {
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.setValue(`field${i}`, `new value ${i}`)
        }
      })
    } finally {
      cleanup()
    }
  })
})

describe('React Rendering: Validation Performance', () => {
  const data = generateFormData(10)
  let validateNeo: () => Promise<void> = async () => {}
  let unmountNeo = (): void => {}
  bench(
    'neo.react-forms: Validate one field on change (10 fields)',
    () => validateNeo(),
    {
      throws: true,
      setup: async () => {
        let invocations = 0
        const mounted = renderHook(() =>
          useNeoForm({
            initialValues: data,
            mode: 'onChange',
            validate: {
              field0: (value: string) => {
                invocations++
                return value ? undefined : 'Required'
              },
            },
          })
        )
        unmountNeo = mounted.unmount
        let usesEmptyValue = true
        validateNeo = async () => {
          const value = usesEmptyValue ? '' : 'value0'
          usesEmptyValue = !usesEmptyValue
          await act(async () => {
            mounted.result.current.setFieldValue('field0', value)
            while (mounted.result.current.isValidating) {
              await Promise.resolve()
            }
          })
        }

        // Prove equivalent validation work before Tinybench times samples.
        await validateNeo()
        expect(invocations).toBe(1)
      },
      teardown: () => {
        unmountNeo()
        cleanup()
      },
    }
  )

  let validateFormik: () => Promise<void> = async () => {}
  let unmountFormik = (): void => {}
  bench(
    'Formik: Validate one field on change (10 fields)',
    () => validateFormik(),
    {
      throws: true,
      setup: async () => {
        let invocations = 0
        const mounted = renderHook(() =>
          useFormikForm({
            initialValues: data,
            onSubmit: () => {},
            validateOnChange: true,
          })
        )
        mounted.result.current.registerField('field0', {
          validate: (value: string) => {
            invocations++
            return value ? undefined : 'Required'
          },
        })
        unmountFormik = () => {
          mounted.result.current.unregisterField('field0')
          mounted.unmount()
        }
        let usesEmptyValue = true
        validateFormik = async () => {
          const value = usesEmptyValue ? '' : 'value0'
          usesEmptyValue = !usesEmptyValue
          await act(async () => {
            await mounted.result.current.setFieldValue('field0', value)
          })
        }

        await validateFormik()
        expect(invocations).toBe(1)
      },
      teardown: () => {
        unmountFormik()
        cleanup()
      },
    }
  )

  let validateRHF: () => Promise<void> = async () => {}
  let unmountRHF = (): void => {}
  bench(
    'React Hook Form: Validate one field on change (10 fields)',
    () => validateRHF(),
    {
      throws: true,
      setup: async () => {
        let invocations = 0
        const mounted = renderHook(() =>
          useRHF({
            defaultValues: data,
            mode: 'onChange',
          })
        )
        mounted.result.current.register('field0', {
          validate: (value) => {
            invocations++
            return value ? true : 'Required'
          },
        })
        unmountRHF = mounted.unmount
        let usesEmptyValue = true
        validateRHF = async () => {
          const value = usesEmptyValue ? '' : 'value0'
          usesEmptyValue = !usesEmptyValue
          await act(async () => {
            mounted.result.current.setValue('field0', value, {
              shouldDirty: true,
            })
            await mounted.result.current.trigger('field0')
          })
        }

        await validateRHF()
        expect(invocations).toBe(1)
      },
      teardown: () => {
        unmountRHF()
        cleanup()
      },
    }
  )
})

describe('React Rendering: Nested Field Validation Scaling', () => {
  type NestedValues = {
    users: Array<{
      email: string
      profile: { name: string }
    }>
  }

  const sizes = [100, 1_000, 5_000, 10_000]

  for (const size of sizes) {
    let validateNestedField: () => Promise<void> = async () => {}
    let unmount = (): void => {}
    bench(
      `neo.react-forms: Validate users.0.email in ${size} rows`,
      () => validateNestedField(),
      {
        throws: true,
        setup: async () => {
          let invocations = 0
          const initialValues: NestedValues = {
            users: Array.from({ length: size }, (_, index) => ({
              email: `user-${index}@example.com`,
              profile: { name: `User ${index}` },
            })),
          }
          const mounted = renderHook(() =>
            useNeoForm({
              initialValues,
              validate: {
                users: {
                  email: (value: string) => {
                    invocations++
                    return value ? undefined : 'Required'
                  },
                },
              },
            })
          )
          unmount = mounted.unmount
          validateNestedField = async () => {
            await act(async () => {
              await mounted.result.current.validateField('users.0.email')
            })
          }

          // The validator intentionally reads only its scalar value. This
          // untimed preflight proves each scale case runs one validator.
          await validateNestedField()
          expect(invocations).toBe(1)
        },
        teardown: () => {
          unmount()
          cleanup()
        },
      }
    )
  }
})

describe('React Rendering: Form Reset', () => {
  bench('neo.react-forms: Reset 30-field form', () => {
    const data = generateFormData(30)
    const { result, unmount } = renderHook(() =>
      useNeoForm({
        initialValues: data,
      })
    )

    try {
      act(() => {
        for (let i = 0; i < 30; i++) {
          result.current.setFieldValue(`field${i}`, `changed ${i}`)
        }
        result.current.reset()
      })
    } finally {
      cleanup()
    }
  })

  bench('Formik: Reset 30-field form', () => {
    const data = generateFormData(30)
    const { result, unmount } = renderHook(() =>
      useFormikForm({
        initialValues: data,
        onSubmit: () => {},
      })
    )

    try {
      act(() => {
        for (let i = 0; i < 30; i++) {
          void result.current.setFieldValue(`field${i}`, `changed ${i}`)
        }
        result.current.resetForm()
      })
    } finally {
      cleanup()
    }
  })

  bench('React Hook Form: Reset 30-field form', () => {
    const data = generateFormData(30)
    const { result, unmount } = renderHook(() =>
      useRHF({
        defaultValues: data,
      })
    )

    try {
      act(() => {
        for (let i = 0; i < 30; i++) {
          result.current.setValue(`field${i}`, `changed ${i}`)
        }
        result.current.reset()
      })
    } finally {
      cleanup()
    }
  })
})
