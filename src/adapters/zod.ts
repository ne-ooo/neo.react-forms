/**
 * Zod adapter for @lpm.dev/neo.react-forms
 *
 * Convert Zod schemas to our ValidationSchema format
 * with full type inference support
 *
 * @example
 * ```ts
 * import { z } from 'zod'
 * import { useForm, zodAdapter } from '@lpm.dev/neo.react-forms'
 *
 * const schema = z.object({
 *   email: z.string().email(),
 *   age: z.number().min(18)
 * })
 *
 * const form = useForm({
 *   initialValues: {
 *     email: '',
 *     age: 0
 *   },
 *   validate: zodAdapter(schema)
 * })
 * ```
 */

import type { Validator, ValidationSchema } from '../types.js'

/**
 * Zod types (imported as type-only to avoid runtime dependency)
 */
type ZodTypeAny = any
type ZodObject<T = any> = {
  shape: T
  safeParse: (value: any) => { success: boolean; error?: { issues: Array<{ path: string[]; message: string }> } }
  _def: { typeName: string }
}

/**
 * Extract Zod schema type
 */
export type ZodInfer<T> = T extends { _output: infer O } ? O : never

/**
 * Convert Zod schema to validator function
 *
 * @param schema - Zod schema (can be any Zod type)
 * @returns Validator function
 */
function createZodValidator<T>(schema: ZodTypeAny): Validator<T> {
  return async (value: T) => {
    const result = schema.safeParse(value)

    if (!result.success) {
      // Return first error message
      const firstError = result.error?.issues?.[0]
      return firstError?.message || 'Validation failed'
    }

    return null
  }
}

/**
 * Convert Zod object schema to ValidationSchema
 *
 * @param schema - Zod object schema
 * @returns ValidationSchema matching form structure
 *
 * @example
 * ```ts
 * const schema = z.object({
 *   email: z.string().email('Invalid email'),
 *   password: z.string().min(8, 'Too short'),
 *   profile: z.object({
 *     firstName: z.string().min(1, 'Required'),
 *     lastName: z.string().min(1, 'Required')
 *   })
 * })
 *
 * const form = useForm({
 *   initialValues: {
 *     email: '',
 *     password: '',
 *     profile: { firstName: '', lastName: '' }
 *   },
 *   validate: zodAdapter(schema)
 * })
 * ```
 */
export function zodAdapter<T extends ZodObject>(schema: T): ValidationSchema<ZodInfer<T>> {
  const validationSchema: Record<string, any> = {}

  // Get shape from Zod object schema
  const shape = schema.shape

  if (!shape) {
    // If not an object schema, return empty validation
    return validationSchema as ValidationSchema<ZodInfer<T>>
  }

  // Convert each field in shape to validator
  for (const [key, fieldSchema] of Object.entries(shape)) {
    // Check if field is a nested object
    const typeName = (fieldSchema as any)?._def?.typeName

    if (typeName === 'ZodObject') {
      // Recursively convert nested object
      validationSchema[key] = zodAdapter(fieldSchema as ZodObject)
    } else {
      // Create validator for this field
      validationSchema[key] = createZodValidator(fieldSchema as ZodTypeAny)
    }
  }

  return validationSchema as ValidationSchema<ZodInfer<T>>
}

/**
 * Helper to create form with Zod schema and automatic type inference
 *
 * @param schema - Zod schema
 * @param initialValues - Initial form values (must match schema type)
 * @returns Object with validation schema and typed initial values
 *
 * @example
 * ```ts
 * const schema = z.object({
 *   email: z.string().email(),
 *   age: z.number().min(18)
 * })
 *
 * const form = useForm({
 *   ...zodForm(schema, {
 *     email: '',
 *     age: 0
 *   })
 * })
 * ```
 */
export function zodForm<T extends ZodObject>(
  schema: T,
  initialValues: ZodInfer<T>
): {
  initialValues: ZodInfer<T>
  validate: ValidationSchema<ZodInfer<T>>
} {
  return {
    initialValues,
    validate: zodAdapter(schema),
  }
}
