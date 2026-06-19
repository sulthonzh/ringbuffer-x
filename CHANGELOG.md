# Changelog

## v1.1.0 — 2026-06-19

### Fixed

- **`set(NaN)` silently corrupted data** — `NaN` passed bounds check (both `NaN < 0` and `NaN >= size` are `false`), writing to a phantom index. Now validates with `Number.isInteger()`.
- **`set(1.5)` silently corrupted data** — non-integer indices allowed writes to wrong slots. Now rejects with `RangeError`.
- **`get(NaN)` / `get(1.5)` returned slot 0** — non-integer index was used in modulo, silently returning wrong item. Now returns `undefined`.
- **`fromJSON()` threw when items > capacity** — used `push()` in reject mode, crashing on overflow. Now uses overwrite internally, keeping last N items, then restores original overflow strategy.

### Added

- `--version` / `-V` / `version` CLI flag
- `exports` field in package.json for clean ESM/CJS consumption
- `files` field (only publishes index.js, cli.js, README, CHANGELOG, LICENSE)
- `engines` field (Node >= 18)
- `prepublishOnly` script (runs tests before publish)
- `test:core` script for running core tests only
- CHANGELOG.md (this file)
- README comparison table vs `circular-buffer`, `ringbufferjs`, `denque`
- 31 new tests (44 → 75): NaN/Infinity/float index validation, fromJSON overflow handling, pushAll with iterables (string, Set, generator), overwrite pushAll eviction order, drain edge cases, multiple clear cycles, map/forEach with wrap-around, includes reference equality, toJSON after wrap, from() with Set/exact fill

### Changed

- README test count corrected: "55+ tests" → "75 tests"
- `fromJSON` internally uses overwrite mode for resilience, then restores original strategy

## v1.0.0 — 2026-06-15

Initial release.

- Fixed-capacity circular ring buffer with O(1) push/pop
- Two overflow modes: `reject` (throw) and `overwrite` (evict oldest)
- `popBack()`, `peek()`, `peekBack()`, `get(i)`, `set(i, value)`
- `drain(n)`, `clear()`, `toArray()`
- Search: `find()`, `findIndex()`, `includes()`
- Iteration: `[Symbol.iterator]`, `forEach()`, `map()`
- Serialization: `toJSON()`, `static fromJSON()`, `static from()`
- CLI with stateful persistence (`push`, `pop`, `peek`, `info`, `drain`, `demo`, `from-json`, `clear`)
- 44 tests
