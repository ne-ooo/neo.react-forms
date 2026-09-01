import { describe, expect, it } from 'vitest'

describe('test DOM security', () => {
  it('does not evaluate injected scripts', () => {
    const script = document.createElement('script')
    script.textContent = `
      document.body.setAttribute(
        'data-host-process',
        this.constructor.constructor('return process')().version
      )
    `

    document.body.appendChild(script)
    try {
      expect(document.body.hasAttribute('data-host-process')).toBe(false)
    } finally {
      script.remove()
      document.body.removeAttribute('data-host-process')
    }
  })
})
