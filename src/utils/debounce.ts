/**
 * Debounce utility for async validation
 *
 * Delays execution until after wait milliseconds have elapsed
 * since the last time the debounced function was invoked.
 */

/**
 * Debounce function
 *
 * @param fn - Function to debounce
 * @param wait - Milliseconds to wait
 * @returns Debounced function with cancel method
 *
 * @example
 * ```ts
 * const debouncedValidate = debounce(async (value) => {
 *   const exists = await checkUsernameExists(value)
 *   return exists ? 'Username taken' : null
 * }, 300)
 *
 * // Only the last call within 300ms will execute
 * debouncedValidate('user1')
 * debouncedValidate('user2')
 * debouncedValidate('user3') // Only this one runs
 *
 * // Cancel pending execution
 * debouncedValidate.cancel()
 * ```
 */
export function debounce<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  wait: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let pendingPromise: {
    resolve: (value: any) => void
    reject: (reason?: any) => void
  } | null = null

  const debounced = function (this: any, ...args: Parameters<T>): Promise<ReturnType<T>> {
    // Clear existing timeout
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }

    // Reject previous pending promise (cancellation)
    if (pendingPromise) {
      pendingPromise.reject(new Error('Debounced call cancelled'))
      pendingPromise = null
    }

    return new Promise<ReturnType<T>>((resolve, reject) => {
      pendingPromise = { resolve, reject }

      timeoutId = setTimeout(async () => {
        timeoutId = null
        const currentPromise = pendingPromise
        pendingPromise = null

        try {
          const result = await fn.apply(this, args)
          currentPromise?.resolve(result)
        } catch (error) {
          currentPromise?.reject(error)
        }
      }, wait)
    })
  }

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    if (pendingPromise) {
      pendingPromise.reject(new Error('Debounced call cancelled'))
      pendingPromise = null
    }
  }

  return debounced as T & { cancel: () => void }
}

/**
 * Create a debounced validator
 *
 * @param validator - Async validator function
 * @param wait - Debounce delay in milliseconds (default: 300ms)
 * @returns Debounced validator
 *
 * @example
 * ```ts
 * const checkUsername = debounceValidator(async (username) => {
 *   const response = await fetch(`/api/check-username?username=${username}`)
 *   const { exists } = await response.json()
 *   return exists ? 'Username already taken' : null
 * }, 500)
 * ```
 */
export function debounceValidator<T>(
  validator: (value: T) => Promise<string | null>,
  wait = 300
): (value: T) => Promise<string | null> {
  return debounce(validator, wait)
}
