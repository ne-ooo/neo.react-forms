/**
 * Type utility tests for @lpm.dev/neo.react-forms
 *
 * Tests the Path<T> and ValueAtPath<T, P> type utilities
 * to ensure perfect TypeScript inference
 */

import { describe, it, expect, expectTypeOf } from 'vitest'
import type { Path, ValueAtPath } from '../types.js'

describe('Type Utilities', () => {
  describe('Path<T>', () => {
    it('should extract paths from flat object', () => {
      type FlatValues = {
        name: string
        age: number
        active: boolean
      }

      type FlatPaths = Path<FlatValues>

      // Type assertions (compile-time checks)
      expectTypeOf<FlatPaths>().toMatchTypeOf<'name' | 'age' | 'active'>()
    })

    it('should extract paths from nested object', () => {
      type NestedValues = {
        user: {
          name: string
          email: string
        }
        settings: {
          theme: string
        }
      }

      type NestedPaths = Path<NestedValues>

      // Type assertions
      expectTypeOf<NestedPaths>().toMatchTypeOf<
        | 'user'
        | 'user.name'
        | 'user.email'
        | 'settings'
        | 'settings.theme'
      >()
    })

    it('should extract paths from array fields', () => {
      type ArrayValues = {
        tags: string[]
        users: Array<{
          name: string
          age: number
        }>
      }

      type ArrayPaths = Path<ArrayValues>

      // Type assertions
      expectTypeOf<ArrayPaths>().toMatchTypeOf<
        | 'tags'
        | 'tags.0'
        | `tags.${number}`
        | 'users'
        | 'users.0'
        | `users.${number}`
        | `users.${number}.name`
        | `users.${number}.age`
      >()
    })

    it('should handle deeply nested objects', () => {
      type DeepValues = {
        company: {
          address: {
            street: string
            city: string
            country: {
              code: string
              name: string
            }
          }
        }
      }

      type DeepPaths = Path<DeepValues>

      // Type assertions
      expectTypeOf<DeepPaths>().toMatchTypeOf<
        | 'company'
        | 'company.address'
        | 'company.address.street'
        | 'company.address.city'
        | 'company.address.country'
        | 'company.address.country.code'
        | 'company.address.country.name'
      >()
    })
  })

  describe('ValueAtPath<T, P>', () => {
    it('should get type at top-level path', () => {
      type Values = {
        name: string
        age: number
        active: boolean
      }

      // Type assertions
      expectTypeOf<ValueAtPath<Values, 'name'>>().toEqualTypeOf<string>()
      expectTypeOf<ValueAtPath<Values, 'age'>>().toEqualTypeOf<number>()
      expectTypeOf<ValueAtPath<Values, 'active'>>().toEqualTypeOf<boolean>()
    })

    it('should get type at nested path', () => {
      type Values = {
        user: {
          name: string
          email: string
          profile: {
            age: number
            bio: string
          }
        }
      }

      // Type assertions
      expectTypeOf<ValueAtPath<Values, 'user'>>().toEqualTypeOf<{
        name: string
        email: string
        profile: { age: number; bio: string }
      }>()
      expectTypeOf<ValueAtPath<Values, 'user.name'>>().toEqualTypeOf<string>()
      expectTypeOf<ValueAtPath<Values, 'user.email'>>().toEqualTypeOf<string>()
      expectTypeOf<ValueAtPath<Values, 'user.profile'>>().toEqualTypeOf<{
        age: number
        bio: string
      }>()
      expectTypeOf<ValueAtPath<Values, 'user.profile.age'>>().toEqualTypeOf<number>()
      expectTypeOf<ValueAtPath<Values, 'user.profile.bio'>>().toEqualTypeOf<string>()
    })

    it('should get type at array path', () => {
      type Values = {
        tags: string[]
        users: Array<{
          name: string
          age: number
        }>
      }

      // Type assertions
      expectTypeOf<ValueAtPath<Values, 'tags'>>().toEqualTypeOf<string[]>()
      expectTypeOf<ValueAtPath<Values, 'users'>>().toEqualTypeOf<
        Array<{ name: string; age: number }>
      >()
    })
  })

  describe('Type Safety', () => {
    it('should enforce type-safe field access', () => {
      type FormValues = {
        username: string
        email: string
        age: number
        profile: {
          bio: string
          avatar: string
        }
      }

      // Valid paths (compile-time check)
      const validPaths: Path<FormValues>[] = [
        'username',
        'email',
        'age',
        'profile',
        'profile.bio',
        'profile.avatar',
      ]

      expect(validPaths.length).toBe(6)

      // The following would fail TypeScript:
      // const invalidPath: Path<FormValues> = 'invalid.path'
      // const invalidPath2: Path<FormValues> = 'profile.invalid'
    })

    it('should infer correct value types', () => {
      type FormValues = {
        name: string
        age: number
        settings: {
          theme: 'light' | 'dark'
          notifications: boolean
        }
      }

      // Compile-time type checks
      expectTypeOf<ValueAtPath<FormValues, 'name'>>().toEqualTypeOf<string>()
      expectTypeOf<ValueAtPath<FormValues, 'age'>>().toEqualTypeOf<number>()
      expectTypeOf<ValueAtPath<FormValues, 'settings.theme'>>().toEqualTypeOf<
        'light' | 'dark'
      >()
      expectTypeOf<ValueAtPath<FormValues, 'settings.notifications'>>().toEqualTypeOf<boolean>()
    })
  })

  describe('Real-world examples', () => {
    it('should handle typical registration form', () => {
      type RegistrationForm = {
        email: string
        password: string
        confirmPassword: string
        profile: {
          firstName: string
          lastName: string
          age: number
        }
        terms: boolean
      }

      type Paths = Path<RegistrationForm>

      // Verify all expected paths are valid
      const expectedPaths: Paths[] = [
        'email',
        'password',
        'confirmPassword',
        'profile',
        'profile.firstName',
        'profile.lastName',
        'profile.age',
        'terms',
      ]

      expect(expectedPaths.length).toBe(8)

      // Verify value types
      expectTypeOf<ValueAtPath<RegistrationForm, 'email'>>().toEqualTypeOf<string>()
      expectTypeOf<ValueAtPath<RegistrationForm, 'profile.age'>>().toEqualTypeOf<number>()
      expectTypeOf<ValueAtPath<RegistrationForm, 'terms'>>().toEqualTypeOf<boolean>()
    })

    it('should handle dynamic list form', () => {
      type TodoForm = {
        title: string
        todos: Array<{
          id: string
          text: string
          completed: boolean
        }>
      }

      type Paths = Path<TodoForm>

      // Verify array paths work
      const arrayPaths: Paths[] = [
        'title',
        'todos',
        'todos.0',
        'todos.0.id',
        'todos.0.text',
        'todos.0.completed',
      ]

      expect(arrayPaths.length).toBe(6)

      // Verify array value type
      expectTypeOf<ValueAtPath<TodoForm, 'todos'>>().toEqualTypeOf<
        Array<{ id: string; text: string; completed: boolean }>
      >()
    })
  })
})
