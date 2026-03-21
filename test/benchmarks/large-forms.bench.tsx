/**
 * Large form benchmarks
 *
 * Tests performance with 30, 100, and 500 field forms
 */

import { bench, describe } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useForm as useNeoForm } from '../src/hooks/useForm.js'
import { useForm as useFormikForm } from 'formik'
import { useForm as useRHF } from 'react-hook-form'
import { generateFormData } from './utils/benchmark-helpers.js'

describe('Large Forms: 30 Fields', () => {
  const data = generateFormData(30)

  bench('neo.react-forms: Create 30-field form', () => {
    const { result, unmount } = renderHook(() =>
      useNeoForm({
        initialValues: data,
      })
    )
    unmount()
  })

  bench('Formik: Create 30-field form', () => {
    const { result, unmount } = renderHook(() =>
      useFormikForm({
        initialValues: data,
        onSubmit: () => {},
      })
    )
    unmount()
  })

  bench('React Hook Form: Create 30-field form', () => {
    const { result, unmount } = renderHook(() =>
      useRHF({
        defaultValues: data,
      })
    )
    unmount()
  })

  bench('neo.react-forms: Update field in 30-field form', () => {
    const { result } = renderHook(() =>
      useNeoForm({
        initialValues: data,
      })
    )

    act(() => {
      result.current.setValue('field15', 'new value')
    })
  })

  bench('Formik: Update field in 30-field form', () => {
    const { result } = renderHook(() =>
      useFormikForm({
        initialValues: data,
        onSubmit: () => {},
      })
    )

    act(() => {
      result.current.setFieldValue('field15', 'new value')
    })
  })

  bench('React Hook Form: Update field in 30-field form', () => {
    const { result } = renderHook(() =>
      useRHF({
        defaultValues: data,
      })
    )

    act(() => {
      result.current.setValue('field15', 'new value')
    })
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
    unmount()
  })

  bench('Formik: Create 100-field form', () => {
    const { result, unmount } = renderHook(() =>
      useFormikForm({
        initialValues: data,
        onSubmit: () => {},
      })
    )
    unmount()
  })

  bench('React Hook Form: Create 100-field form', () => {
    const { result, unmount } = renderHook(() =>
      useRHF({
        defaultValues: data,
      })
    )
    unmount()
  })

  bench('neo.react-forms: Update field in 100-field form', () => {
    const { result } = renderHook(() =>
      useNeoForm({
        initialValues: data,
      })
    )

    act(() => {
      result.current.setValue('field50', 'new value')
    })
  })

  bench('Formik: Update field in 100-field form', () => {
    const { result } = renderHook(() =>
      useFormikForm({
        initialValues: data,
        onSubmit: () => {},
      })
    )

    act(() => {
      result.current.setFieldValue('field50', 'new value')
    })
  })

  bench('React Hook Form: Update field in 100-field form', () => {
    const { result } = renderHook(() =>
      useRHF({
        defaultValues: data,
      })
    )

    act(() => {
      result.current.setValue('field50', 'new value')
    })
  })

  bench('neo.react-forms: Validate 100 fields', () => {
    const { result } = renderHook(() =>
      useNeoForm({
        initialValues: data,
        validate: Object.keys(data).reduce((acc, key) => ({
          ...acc,
          [key]: (value: string) => (value ? undefined : 'Required'),
        }), {}),
      })
    )

    act(() => {
      result.current.validateForm()
    })
  })

  bench('Formik: Validate 100 fields', () => {
    const { result } = renderHook(() =>
      useFormikForm({
        initialValues: data,
        onSubmit: () => {},
        validate: (values: Record<string, string>) => {
          const errors: Record<string, string> = {}
          Object.keys(values).forEach((key) => {
            if (!values[key]) {
              errors[key] = 'Required'
            }
          })
          return errors
        },
      })
    )

    act(() => {
      result.current.validateForm()
    })
  })

  bench('React Hook Form: Validate 100 fields', () => {
    const { result } = renderHook(() =>
      useRHF({
        defaultValues: data,
        mode: 'onChange',
      })
    )

    act(() => {
      result.current.trigger()
    })
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
    unmount()
  })

  bench('Formik: Create 500-field form', () => {
    const { result, unmount } = renderHook(() =>
      useFormikForm({
        initialValues: data,
        onSubmit: () => {},
      })
    )
    unmount()
  })

  bench('React Hook Form: Create 500-field form', () => {
    const { result, unmount } = renderHook(() =>
      useRHF({
        defaultValues: data,
      })
    )
    unmount()
  })

  bench('neo.react-forms: Update field in 500-field form', () => {
    const { result } = renderHook(() =>
      useNeoForm({
        initialValues: data,
      })
    )

    act(() => {
      result.current.setValue('field250', 'new value')
    })
  })

  bench('Formik: Update field in 500-field form', () => {
    const { result } = renderHook(() =>
      useFormikForm({
        initialValues: data,
        onSubmit: () => {},
      })
    )

    act(() => {
      result.current.setFieldValue('field250', 'new value')
    })
  })

  bench('React Hook Form: Update field in 500-field form', () => {
    const { result } = renderHook(() =>
      useRHF({
        defaultValues: data,
      })
    )

    act(() => {
      result.current.setValue('field250', 'new value')
    })
  })
})

describe('Large Forms: Sequential Updates', () => {
  bench('neo.react-forms: 30 sequential updates', () => {
    const data = generateFormData(30)
    const { result } = renderHook(() =>
      useNeoForm({
        initialValues: data,
      })
    )

    act(() => {
      for (let i = 0; i < 30; i++) {
        result.current.setValue(`field${i}` as any, `value-${i}`)
      }
    })
  })

  bench('Formik: 30 sequential updates', () => {
    const data = generateFormData(30)
    const { result } = renderHook(() =>
      useFormikForm({
        initialValues: data,
        onSubmit: () => {},
      })
    )

    act(() => {
      for (let i = 0; i < 30; i++) {
        result.current.setFieldValue(`field${i}`, `value-${i}`)
      }
    })
  })

  bench('React Hook Form: 30 sequential updates', () => {
    const data = generateFormData(30)
    const { result } = renderHook(() =>
      useRHF({
        defaultValues: data,
      })
    )

    act(() => {
      for (let i = 0; i < 30; i++) {
        result.current.setValue(`field${i}` as any, `value-${i}`)
      }
    })
  })
})
