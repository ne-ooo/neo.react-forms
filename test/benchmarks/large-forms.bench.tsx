/**
 * Large form benchmarks
 *
 * Tests performance with 30, 100, and 500 field forms
 */

import { describe, expect } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useForm as useNeoForm } from '../../src/hooks/useForm.js'
import { useFormik as useFormikForm } from 'formik'
import { useForm as useRHF } from 'react-hook-form'
import { benchmark as bench, generateFormData } from './utils/benchmark-helpers.js'

describe('Large Forms: 30 Fields', () => {
  const data = generateFormData(30)

  bench('neo.react-forms: Create 30-field form', () => {
    const { result, unmount } = renderHook(() =>
      useNeoForm({
        initialValues: data,
      })
    )
    cleanup()
  })

  bench('Formik: Create 30-field form', () => {
    const { result, unmount } = renderHook(() =>
      useFormikForm({
        initialValues: data,
        onSubmit: () => {},
      })
    )
    cleanup()
  })

  bench('React Hook Form: Create 30-field form', () => {
    const { result, unmount } = renderHook(() =>
      useRHF({
        defaultValues: data,
      })
    )
    cleanup()
  })

  bench('neo.react-forms: Update field in 30-field form', () => {
    const { result, unmount } = renderHook(() =>
      useNeoForm({
        initialValues: data,
      })
    )

    try {
      act(() => {
        result.current.setFieldValue('field15', 'new value')
      })
    } finally {
      cleanup()
    }
  })

  bench('Formik: Update field in 30-field form', () => {
    const { result, unmount } = renderHook(() =>
      useFormikForm({
        initialValues: data,
        onSubmit: () => {},
      })
    )

    try {
      act(() => {
        void result.current.setFieldValue('field15', 'new value')
      })
    } finally {
      cleanup()
    }
  })

  bench('React Hook Form: Update field in 30-field form', () => {
    const { result, unmount } = renderHook(() =>
      useRHF({
        defaultValues: data,
      })
    )

    try {
      act(() => {
        result.current.setValue('field15', 'new value')
      })
    } finally {
      cleanup()
    }
  })
})

describe('Large Forms: 100 Fields', () => {
  const data = generateFormData(100)

  bench('neo.react-forms: Create 100-field form', () => {
    const { result, unmount } = renderHook(() =>
      useNeoForm({
        initialValues: data,
      })
    )
    cleanup()
  })

  bench('Formik: Create 100-field form', () => {
    const { result, unmount } = renderHook(() =>
      useFormikForm({
        initialValues: data,
        onSubmit: () => {},
      })
    )
    cleanup()
  })

  bench('React Hook Form: Create 100-field form', () => {
    const { result, unmount } = renderHook(() =>
      useRHF({
        defaultValues: data,
      })
    )
    cleanup()
  })

  bench('neo.react-forms: Update field in 100-field form', () => {
    const { result, unmount } = renderHook(() =>
      useNeoForm({
        initialValues: data,
      })
    )

    try {
      act(() => {
        result.current.setFieldValue('field50', 'new value')
      })
    } finally {
      cleanup()
    }
  })

  bench('Formik: Update field in 100-field form', () => {
    const { result, unmount } = renderHook(() =>
      useFormikForm({
        initialValues: data,
        onSubmit: () => {},
      })
    )

    try {
      act(() => {
        void result.current.setFieldValue('field50', 'new value')
      })
    } finally {
      cleanup()
    }
  })

  bench('React Hook Form: Update field in 100-field form', () => {
    const { result, unmount } = renderHook(() =>
      useRHF({
        defaultValues: data,
      })
    )

    try {
      act(() => {
        result.current.setValue('field50', 'new value')
      })
    } finally {
      cleanup()
    }
  })

  describe('Equivalent full-form validation', () => {
    let validateNeo: () => Promise<void> = async () => {}
    let unmountNeo = (): void => {}
    bench(
      'neo.react-forms: Validate 100 required fields',
      () => validateNeo(),
      {
        throws: true,
        setup: async () => {
          let invocations = 0
          const validation = Object.fromEntries(
            Object.keys(data).map((key) => [
              key,
              (value: string) => {
                invocations++
                return value ? undefined : 'Required'
              },
            ])
          )
          const mounted = renderHook(() =>
            useNeoForm({
              initialValues: data,
              validate: validation,
            })
          )
          unmountNeo = mounted.unmount
          validateNeo = async () => {
            await act(async () => {
              await mounted.result.current.validate()
            })
          }

          // Prove one required check per field before timing samples.
          await validateNeo()
          expect(invocations).toBe(100)
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
      'Formik: Validate 100 required fields',
      () => validateFormik(),
      {
        throws: true,
        setup: async () => {
          let invocations = 0
          const mounted = renderHook(() =>
            useFormikForm({
              initialValues: data,
              onSubmit: () => {},
            })
          )
          for (const key of Object.keys(data)) {
            mounted.result.current.registerField(key, {
              validate: (value: string) => {
                invocations++
                return value ? undefined : 'Required'
              },
            })
          }
          unmountFormik = () => {
            for (const key of Object.keys(data)) {
              mounted.result.current.unregisterField(key)
            }
            mounted.unmount()
          }
          validateFormik = async () => {
            await act(async () => {
              await mounted.result.current.validateForm()
            })
          }

          await validateFormik()
          expect(invocations).toBe(100)
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
      'React Hook Form: Validate 100 required fields',
      () => validateRHF(),
      {
        throws: true,
        setup: async () => {
          let invocations = 0
          const mounted = renderHook(() =>
            useRHF({
              defaultValues: data,
            })
          )
          for (const key of Object.keys(data)) {
            mounted.result.current.register(key, {
              validate: (value) => {
                invocations++
                return value ? true : 'Required'
              },
            })
          }
          unmountRHF = mounted.unmount
          validateRHF = async () => {
            await act(async () => {
              await mounted.result.current.trigger()
            })
          }

          await validateRHF()
          expect(invocations).toBe(100)
        },
        teardown: () => {
          unmountRHF()
          cleanup()
        },
      }
    )
  })
})

describe('Large Forms: 500 Fields', () => {
  const data = generateFormData(500)

  bench('neo.react-forms: Create 500-field form', () => {
    const { result, unmount } = renderHook(() =>
      useNeoForm({
        initialValues: data,
      })
    )
    cleanup()
  })

  bench('Formik: Create 500-field form', () => {
    const { result, unmount } = renderHook(() =>
      useFormikForm({
        initialValues: data,
        onSubmit: () => {},
      })
    )
    cleanup()
  })

  bench('React Hook Form: Create 500-field form', () => {
    const { result, unmount } = renderHook(() =>
      useRHF({
        defaultValues: data,
      })
    )
    cleanup()
  })

  bench('neo.react-forms: Update field in 500-field form', () => {
    const { result, unmount } = renderHook(() =>
      useNeoForm({
        initialValues: data,
      })
    )

    try {
      act(() => {
        result.current.setFieldValue('field250', 'new value')
      })
    } finally {
      cleanup()
    }
  })

  bench('Formik: Update field in 500-field form', () => {
    const { result, unmount } = renderHook(() =>
      useFormikForm({
        initialValues: data,
        onSubmit: () => {},
      })
    )

    try {
      act(() => {
        void result.current.setFieldValue('field250', 'new value')
      })
    } finally {
      cleanup()
    }
  })

  bench('React Hook Form: Update field in 500-field form', () => {
    const { result, unmount } = renderHook(() =>
      useRHF({
        defaultValues: data,
      })
    )

    try {
      act(() => {
        result.current.setValue('field250', 'new value')
      })
    } finally {
      cleanup()
    }
  })
})

describe('Large Forms: Sequential Updates', () => {
  bench('neo.react-forms: 30 sequential updates', () => {
    const data = generateFormData(30)
    const { result, unmount } = renderHook(() =>
      useNeoForm({
        initialValues: data,
      })
    )

    try {
      act(() => {
        for (let i = 0; i < 30; i++) {
          result.current.setFieldValue(`field${i}`, `value-${i}`)
        }
      })
    } finally {
      cleanup()
    }
  })

  bench('Formik: 30 sequential updates', () => {
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
          void result.current.setFieldValue(`field${i}`, `value-${i}`)
        }
      })
    } finally {
      cleanup()
    }
  })

  bench('React Hook Form: 30 sequential updates', () => {
    const data = generateFormData(30)
    const { result, unmount } = renderHook(() =>
      useRHF({
        defaultValues: data,
      })
    )

    try {
      act(() => {
        for (let i = 0; i < 30; i++) {
          result.current.setValue(`field${i}`, `value-${i}`)
        }
      })
    } finally {
      cleanup()
    }
  })
})
