/**
 * Large form benchmarks
 *
 * Tests performance with 30, 100, and 500 field forms
 */

import { describe } from 'vitest'
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

  bench('neo.react-forms: Validate 100 fields', async () => {
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
      await act(async () => {
        await result.current.validate()
      })
    } finally {
      cleanup()
    }
  })

  bench('Formik: Validate 100 fields', async () => {
    const { result, unmount } = renderHook(() =>
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

    try {
      await act(async () => {
        await result.current.validateForm()
      })
    } finally {
      cleanup()
    }
  })

  bench('React Hook Form: Validate 100 fields', async () => {
    const { result, unmount } = renderHook(() =>
      useRHF({
        defaultValues: data,
        mode: 'onChange',
      })
    )

    try {
      await act(async () => {
        await result.current.trigger()
      })
    } finally {
      cleanup()
    }
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
