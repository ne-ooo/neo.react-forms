/**
 * Benchmark helper utilities
 */

import { performance } from 'node:perf_hooks'

/**
 * Generate form data with N fields
 */
export function generateFormData(fieldCount: number): Record<string, string> {
  const data: Record<string, string> = {}
  for (let i = 0; i < fieldCount; i++) {
    data[`field${i}`] = `value${i}`
  }
  return data
}

/**
 * Generate nested form data
 */
export function generateNestedFormData(depth: number, fieldsPerLevel: number): any {
  if (depth === 0) {
    return ''
  }

  const data: Record<string, any> = {}
  for (let i = 0; i < fieldsPerLevel; i++) {
    data[`field${i}`] = depth === 1 ? '' : generateNestedFormData(depth - 1, fieldsPerLevel)
  }
  return data
}

/**
 * Measure execution time
 */
export function measureTime(fn: () => void): number {
  const start = performance.now()
  fn()
  const end = performance.now()
  return end - start
}

/**
 * Measure async execution time
 */
export async function measureTimeAsync(fn: () => Promise<void>): Promise<number> {
  const start = performance.now()
  await fn()
  const end = performance.now()
  return end - start
}

/**
 * Run benchmark multiple times and get stats
 */
export function runBenchmark(
  fn: () => void,
  iterations = 100
): {
  mean: number
  median: number
  min: number
  max: number
  p95: number
  p99: number
} {
  const times: number[] = []

  for (let i = 0; i < iterations; i++) {
    times.push(measureTime(fn))
  }

  times.sort((a, b) => a - b)

  const mean = times.reduce((sum, t) => sum + t, 0) / times.length
  const median = times[Math.floor(times.length / 2)]
  const min = times[0]
  const max = times[times.length - 1]
  const p95 = times[Math.floor(times.length * 0.95)]
  const p99 = times[Math.floor(times.length * 0.99)]

  return { mean, median, min, max, p95, p99 }
}

/**
 * Format benchmark results
 */
export function formatBenchmarkResult(result: {
  mean: number
  median: number
  min: number
  max: number
  p95: number
  p99: number
}): string {
  return `
Mean:   ${result.mean.toFixed(2)}ms
Median: ${result.median.toFixed(2)}ms
Min:    ${result.min.toFixed(2)}ms
Max:    ${result.max.toFixed(2)}ms
P95:    ${result.p95.toFixed(2)}ms
P99:    ${result.p99.toFixed(2)}ms
  `.trim()
}

/**
 * Compare two benchmark results
 */
export function compareBenchmarks(
  baseline: { mean: number },
  comparison: { mean: number },
  baselineName: string,
  comparisonName: string
): string {
  const diff = baseline.mean - comparison.mean
  const percentFaster = ((diff / baseline.mean) * 100).toFixed(1)

  if (diff > 0) {
    return `${comparisonName} is ${percentFaster}% faster than ${baselineName} (${Math.abs(diff).toFixed(2)}ms faster)`
  } else {
    return `${comparisonName} is ${Math.abs(Number(percentFaster))}% slower than ${baselineName} (${Math.abs(diff).toFixed(2)}ms slower)`
  }
}

/**
 * Memory usage tracker
 */
export class MemoryTracker {
  private baseline: number = 0
  private samples: number[] = []

  start(): void {
    // Force GC if available (run node with --expose-gc)
    if (global.gc) {
      global.gc()
    }
    this.baseline = process.memoryUsage().heapUsed
    this.samples = []
  }

  sample(): void {
    const current = process.memoryUsage().heapUsed
    this.samples.push(current - this.baseline)
  }

  getStats(): {
    current: number
    peak: number
    average: number
  } {
    const current = this.samples[this.samples.length - 1] || 0
    const peak = Math.max(...this.samples, 0)
    const average = this.samples.length > 0
      ? this.samples.reduce((sum, s) => sum + s, 0) / this.samples.length
      : 0

    return {
      current: current / 1024 / 1024, // MB
      peak: peak / 1024 / 1024, // MB
      average: average / 1024 / 1024, // MB
    }
  }

  formatStats(): string {
    const stats = this.getStats()
    return `
Current: ${stats.current.toFixed(2)} MB
Peak:    ${stats.peak.toFixed(2)} MB
Average: ${stats.average.toFixed(2)} MB
    `.trim()
  }
}
