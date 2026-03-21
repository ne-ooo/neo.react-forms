/**
 * React rendering performance benchmarks
 *
 * Compares rendering performance across libraries
 */

import { bench, describe } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useForm as useNeoForm } from '../src/hooks/useForm.js'
import { useForm as useFormikForm, Formik } from 'formik'
import { useForm as useRHF } from 'react-hook-form'
import { generateFormData } from './utils/benchmark-helpers.js'

describe('React Rendering: Form Initialization', () => {
  const sizes = [10, 30, 100]

  for (const size of sizes) {
    const data = generateFormData(size)

    bench(`neo.react-forms: Initialize ${size}-field form`, () => {
      const { result } = renderHook(() =>
        useNeoForm({
          initialValues: data,
        })
      )
    })

    bench(`Formik: Initialize ${size}-field form`, () => {
      const { result } = renderHook(() =>
        useFormikForm({
          initialValues: data,
          onSubmit: () => {},
        })
      )
    })

    bench(`React Hook Form: Initialize ${size}-field form`, () => {
      const { result } = renderHook(() =>
        useRHF({
          defaultValues: data,
        })
      )
    })
  }
})

describe('React Rendering: Field Updates', () => {
  bench('neo.react-forms: Update single field (10 fields)', () => {
    const data = generateFormData(10)
    const { result } = renderHook(() =>
      useNeoForm({
        initialValues: data,
      })
    )

    act(() => {
      result.current.setValue('field0', 'new value')
    })
  })

  bench('Formik: Update single field (10 fields)', () => {
    const data = generateFormData(10)
    const { result } = renderHook(() =>
      useFormikForm({
        initialValues: data,
        onSubmit: () => {},
      })
    )

    act(() => {
      result.current.setFieldValue('field0', 'new value')
    })
  })

  bench('React Hook Form: Update single field (10 fields)', () => {
    const data = generateFormData(10)
    const { result } = renderHook(() =>
      useRHF({
        defaultValues: data,
      })
    )

    act(() => {
      result.current.setValue('field0', 'new value')
    })
  })
})

describe('React Rendering: Multiple Updates', () => {
  bench('neo.react-forms: Update 10 fields sequentially', () => {
    const data = generateFormData(10)
    const { result } = renderHook(() =>
      useNeoForm({
        initialValues: data,
      })
    )

    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.setValue(`field${i}` as any, `new value ${i}`)
      }
    })
  })

  bench('Formik: Update 10 fields sequentially', () => {
    const data = generateFormData(10)
    const { result } = renderHook(() =>
      useFormikForm({
        initialValues: data,
        onSubmit: () => {},
      })
    )

    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.setFieldValue(`field${i}`, `new value ${i}`)
      }
    })
  })

  bench('React Hook Form: Update 10 fields sequentially', () => {
    const data = generateFormData(10)
    const { result } = renderHook(() =>
      useRHF({
        defaultValues: data,
      })
    )

    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.setValue(`field${i}` as any, `new value ${i}`)
      }
    })
  })
})

describe('React Rendering: Validation Performance', () => {
  const validate = (values: Record<string, string>) => {
    const errors: Record<string, string> = {}
    Object.keys(values).forEach((key) => {
      if (!values[key]) {
        errors[key] = 'Required'
      }
    })
    return errors
  }

  bench('neo.react-forms: Validate 10 fields on change', () => {
    const data = generateFormData(10)
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
      result.current.setValue('field0', '')
    })
  })

  bench('Formik: Validate 10 fields on change', () => {
    const data = generateFormData(10)
    const { result } = renderHook(() =>
      useFormikForm({
        initialValues: data,
        onSubmit: () => {},
        validate,
        validateOnChange: true,
      })
    )

    act(() => {
      result.current.setFieldValue('field0', '')
    })
  })

  bench('React Hook Form: Validate 10 fields on change', () => {
    const data = generateFormData(10)
    const { result } = renderHook(() =>
      useRHF({
        defaultValues: data,
        mode: 'onChange',
      })
    )

    act(() => {
      result.current.setValue('field0', '', { shouldValidate: true })
    })
  })
})

describe('React Rendering: Form Reset', () => {
  bench('neo.react-forms: Reset 30-field form', () => {
    const data = generateFormData(30)
    const { result } = renderHook(() =>
      useNeoForm({
        initialValues: data,
      })
    )

    // Make changes
    act(() => {
      for (let i = 0; i < 30; i++) {
        result.current.setValue(`field${i}` as any, `changed ${i}`)
      }
    })

    // Reset
    act(() => {
      result.current.reset()
    })
  })

  bench('Formik: Reset 30-field form', () => {
    const data = generateFormData(30)
    const { result } = renderHook(() =>
      useFormikForm({
        initialValues: data,
        onSubmit: () => {},
      })
    )

    // Make changes
    act(() => {
      for (let i = 0; i < 30; i++) {
        result.current.setFieldValue(`field${i}`, `changed ${i}`)
      }
    })

    // Reset
    act(() => {
      result.current.resetForm()
    })
  })

  bench('React Hook Form: Reset 30-field form', () => {
    const data = generateFormData(30)
    const { result } = renderHook(() =>
      useRHF({
        defaultValues: data,
      })
    )

    // Make changes
    act(() => {
      for (let i = 0; i < 30; i++) {
        result.current.setValue(`field${i}` as any, `changed ${i}`)
      }
    })

    // Reset
    act(() => {
      result.current.reset()
    })
  })
})
