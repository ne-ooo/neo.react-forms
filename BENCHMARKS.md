# Benchmark Guide

Benchmark results depend on the CPU, operating system, Node.js version, and system load. Do not treat one local result as a universal package claim.

## Release benchmark gate

Run the short benchmark smoke gate before a release:

```bash
lpm run bench:release
```

This gate covers three representative operations:

- Create a store with 100 fields.
- Update one field with 100 isolated subscriptions.
- Batch 100 field updates into one transaction.

The smoke gate detects crashes and major integration failures. It does not compare this package with another form library.

## Full benchmark suite

Run all benchmarks when you change a hot path:

```bash
lpm run bench
```

The suite covers core store operations, React rendering, large forms, validation, and memory behavior.

## Memory tests

Run memory regression tests with explicit garbage collection:

```bash
lpm run test:memory
```

These tests fail if the runtime does not provide `global.gc`. The package script starts Node.js with `--expose-gc`.

## Measurement rules

Use these rules when you publish benchmark data:

1. Record the package commit and version.
2. Record the Node.js version and operating system.
3. Record the CPU model and available memory.
4. Close unrelated applications where practical.
5. Run a warm-up before you record results.
6. Run the suite more than once.
7. Publish the command and raw output.
8. Compare libraries with equivalent work and configuration.

Do not use a failed competitor benchmark as proof of a performance advantage. Fix the benchmark or omit the comparison.
