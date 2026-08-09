import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup-dom.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.bench.{ts,tsx}',
        'src/types.ts',
      ],
      thresholds: {
        lines: 92,
        functions: 86,
        branches: 89,
        statements: 92,
      },
    },
  },
})
