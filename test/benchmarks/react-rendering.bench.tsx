/**
 * React rendering performance benchmarks
 *
 * Compares rendering performance across libraries
 */

import { describe } from 'vitest'
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
    const { result, unmount } = renderHook(() =>
      useNeoForm({
        initialValues: data,
        validate: Object.keys(data).reduce((acc, key) => ({
          ...acc,
          [key]: (value: string) => (value ? undefined : 'Required'),
        }), {}),
      })
    )

    try {
      act(() => {
        result.current.setFieldValue('field0', '')
      })
    } finally {
      cleanup()
    }
  })

  bench('Formik: Validate 10 fields on change', () => {
    const data = generateFormData(10)
    const { result, unmount } = renderHook(() =>
      useFormikForm({
        initialValues: data,
        onSubmit: () => {},
        validate,
        validateOnChange: true,
      })
    )

    try {
      act(() => {
        void result.current.setFieldValue('field0', '')
      })
    } finally {
      cleanup()
    }
  })

  bench('React Hook Form: Validate 10 fields on change', () => {
    const data = generateFormData(10)
    const { result, unmount } = renderHook(() =>
      useRHF({
        defaultValues: data,
        mode: 'onChange',
      })
    )

    try {
      act(() => {
        result.current.setValue('field0', '', { shouldValidate: true })
      })
    } finally {
      cleanup()
    }
  })
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
