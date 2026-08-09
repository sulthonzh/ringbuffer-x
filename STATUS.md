# ringbuffer-x — Status

**Audit date:** 2026-07-07 15:50 UTC (re-verified 2026-08-09 09:47 UTC)
**Version:** 1.1.0
**Status:** ✅ EXCEPTIONAL — all 13 checklist criteria met

## Exceptional Checklist

- [x] **README hooks reader in first 3 lines** — "Zero-dep circular ring buffer with O(1) push/pop, bounded & overwriting modes, iterator support, and serialization."
- [x] **Quick start works in <2 minutes** — `npm install ringbuffer-x` → import → push/pop. Verified.
- [x] **All tests GREEN (100% pass rate)** — 106/106 tests pass ✅
- [x] **Test coverage >= 80% on core logic** — 100% statements, 100% branches, 100% functions, 100% lines
- [x] **Zero TypeScript errors** — N/A (pure JS ESM project, no TS)
- [x] **Zero ESLint warnings** — `eslint index.js cli.js test.js` clean ✅
- [x] **No TODO/FIXME comments** — verified via grep ✅
- [x] **At least 3 real-world examples in docs** — 4 examples: rolling log buffer, producer/consumer throttle, sliding window median, audio frame buffer
- [x] **CHANGELOG up to date** — v1.0.0 → v1.1.0, Keep a Changelog format
- [x] **Modern stack** — Node >=18, native ESM, zero runtime dependencies, native test runner, c8 coverage
- [x] **Unique value prop clearly stated** — Comparison table vs circular-buffer, ringbufferjs, denque. Only lib with overwrite mode + drain + search + serialization + CLI, all at 0 deps
- [x] **Performance** — O(1) push/pop amortized, no O(n²) loops. Stress tested with 10k capacity / 15k pushes.
- [x] **Security** — No hardcoded secrets, no eval/dynamic code, input validation on all public methods (capacity, overflow, indices). No SQL injection surface.

## Issues Fixed This Audit

1. **`clear()` didn't reset `evictedCount`** — after clearing, `evictedCount` retained stale value. Fixed: `clear()` now resets `_evicted = 0`.
2. **`from()` ignored `overflow` option** — `{ overflow: 'overwrite', ...opts }` spread let user's `overflow: 'reject'` override internal overwrite, causing throw when items > capacity. Fixed: always use overwrite internally, apply user's overflow after filling (same pattern as `fromJSON()`).
3. **JSDoc on `findIndex()`** — `@returns {number[]}` was wrong (returns single `number`, not array). Description said "indices" (plural). Fixed to `@returns {number}` with singular description.

## Tests Added (75 → 106)

- `pushAll` in reject mode: partial push verification, stops at first failure
- `from()` with `overflow: 'reject'` and items > capacity
- `set()` with non-number types (string, null, undefined, boolean, Symbol)
- `get()` with non-number types (string, null, undefined, boolean)
- `drain()` with no argument (defaults to full drain)
- Empty buffer edge cases: find, findIndex, includes, iterator, forEach, map, toArray, toJSON
- `popBack` on single element and after wrap-around
- `peekBack` on single element
- Constructor with NaN, Infinity, -Infinity capacity
- `clear()` resets evictedCount
- `fromJSON` with items less than capacity
- `from()` with empty array, with overflow option preservation
- `toString()` on empty buffer
- Overwrite push then pop then push (no false eviction)
- `find()` with index in predicate callback
- `set()` at last valid index, at index 0 after wrap
- Large capacity stress test (10k capacity, 15k pushes)

## Coverage Report

```
File      | % Stmts | % Branch | % Funcs | % Lines
index.js  |     100 |      100 |     100 |     100
```

## Dependencies

- **Runtime:** Zero
- **Dev:** c8 (coverage), eslint, globals
