/**
 * FieldArray Example - Dynamic Form Arrays
 *
 * Demonstrates:
 * - Dynamic array fields with add/remove
 * - Stable keys for React reconciliation
 * - Nested field access within arrays
 * - Array operations: append, prepend, insert, remove, move, swap
 * - Perfect TypeScript inference for array items
 */

import { useForm } from '@lpm.dev/neo.react-forms'

interface TodoItem {
  id: string
  title: string
  completed: boolean
}

interface FormValues {
  todos: TodoItem[]
  newTodoTitle: string
}

export function TodoListForm() {
  const form = useForm<FormValues>({
    initialValues: {
      todos: [
        { id: '1', title: 'Learn React', completed: false },
        { id: '2', title: 'Build a form library', completed: true },
      ],
      newTodoTitle: '',
    },
    validate: {
      'todos.*.title': (title) => {
        if (!title || title.trim() === '') {
          return 'Title is required'
        }
        return null
      },
    },
    onSubmit: (values) => {
      console.log('Form submitted:', values)
      alert(`Submitted ${values.todos.length} todos!`)
    },
  })

  const { Field, FieldArray } = form

  const handleAddTodo = () => {
    if (!form.values.newTodoTitle.trim()) {
      return
    }

    const newTodo: TodoItem = {
      id: Date.now().toString(),
      title: form.values.newTodoTitle,
      completed: false,
    }

    // Get current todos and append
    const currentTodos = form.values.todos
    form.setFieldValue('todos', [...currentTodos, newTodo])
    form.setFieldValue('newTodoTitle', '')
  }

  return (
    <form onSubmit={form.handleSubmit}>
      <h1>Todo List (FieldArray Example)</h1>

      {/* Add New Todo Input */}
      <div style={{ marginBottom: '20px' }}>
        <Field name="newTodoTitle">
          {(field) => (
            <div>
              <input
                {...field.props}
                placeholder="New todo title..."
                style={{ marginRight: '10px' }}
              />
              <button type="button" onClick={handleAddTodo}>
                Add Todo
              </button>
            </div>
          )}
        </Field>
      </div>

      {/* Todo Items with FieldArray */}
      <FieldArray name="todos">
        {({ fields, helpers }) => (
          <div>
            <h3>Todos ({fields.length})</h3>

            {fields.length === 0 && (
              <p style={{ color: '#666' }}>No todos yet. Add one above!</p>
            )}

            {fields.map((field, idx) => (
              <div
                key={field.key}
                style={{
                  border: '1px solid #ddd',
                  padding: '10px',
                  marginBottom: '10px',
                  borderRadius: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Title Field */}
                  <Field name={`todos.${field.index}.title` as any}>
                    {(titleField) => (
                      <div style={{ flex: 1 }}>
                        <input
                          {...titleField.props}
                          style={{
                            width: '100%',
                            textDecoration: field.value.completed ? 'line-through' : 'none',
                          }}
                        />
                        {titleField.touched && titleField.error && (
                          <div style={{ color: 'red', fontSize: '12px' }}>
                            {titleField.error}
                          </div>
                        )}
                      </div>
                    )}
                  </Field>

                  {/* Completed Checkbox */}
                  <Field name={`todos.${field.index}.completed` as any}>
                    {(completedField) => (
                      <label>
                        <input
                          type="checkbox"
                          checked={completedField.value as boolean}
                          onChange={(e) => completedField.setValue(e.target.checked as any)}
                        />
                        Done
                      </label>
                    )}
                  </Field>

                  {/* Array Operations */}
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {/* Move Up */}
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => helpers.move(field.index, field.index - 1)}
                        title="Move Up"
                      >
                        ↑
                      </button>
                    )}

                    {/* Move Down */}
                    {idx < fields.length - 1 && (
                      <button
                        type="button"
                        onClick={() => helpers.move(field.index, field.index + 1)}
                        title="Move Down"
                      >
                        ↓
                      </button>
                    )}

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => helpers.remove(field.index)}
                      style={{ color: 'red' }}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Array Helper Buttons */}
            {fields.length > 0 && (
              <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() =>
                    helpers.prepend({
                      id: Date.now().toString(),
                      title: 'Prepended todo',
                      completed: false,
                    })
                  }
                >
                  Prepend Todo
                </button>

                {fields.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => helpers.swap(0, fields.length - 1)}
                  >
                    Swap First & Last
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => helpers.clear()}
                  style={{ color: 'red' }}
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        )}
      </FieldArray>

      {/* Submit */}
      <div style={{ marginTop: '20px' }}>
        <button
          type="submit"
          disabled={form.isSubmitting || !form.isValid}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: form.isValid ? '#0070f3' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: form.isValid ? 'pointer' : 'not-allowed',
          }}
        >
          {form.isSubmitting ? 'Submitting...' : 'Submit Form'}
        </button>
      </div>

      {/* Debug Info */}
      <details style={{ marginTop: '20px' }}>
        <summary>Debug: Form State</summary>
        <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
          {JSON.stringify(
            {
              values: form.values,
              errors: form.errors,
              touched: form.touched,
              isDirty: form.isDirty,
              isValid: form.isValid,
            },
            null,
            2
          )}
        </pre>
      </details>
    </form>
  )
}
