/**
 * ringbuffer-x — Zero-dep circular ring buffer
 *
 * Fixed-capacity FIFO buffer with O(1) push/pop amortized.
 * Two overflow modes: 'reject' (throw) and 'overwrite' (evict oldest).
 *
 * @license MIT
 */

'use strict';

/**
 * @typedef {'reject' | 'overwrite'} OverflowStrategy
 */

/**
 * Circular ring buffer with fixed capacity.
 *
 * @template T
 */
class RingBuffer {
  /**
   * Create a ring buffer.
   *
   * @param {number} capacity - Max items the buffer can hold (must be ≥ 1).
   * @param {Object} [opts]
   * @param {OverflowStrategy} [opts.overflow='reject'] - What to do when full.
   *   `'reject'` throws an error; `'overwrite'` silently evicts the oldest item
   *   and returns it.
   */
  constructor(capacity, opts = {}) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError(`capacity must be a positive integer, got ${capacity}`);
    }
    const overflow = opts.overflow ?? 'reject';
    if (overflow !== 'reject' && overflow !== 'overwrite') {
      throw new TypeError(`overflow must be 'reject' or 'overwrite', got '${overflow}'`);
    }

    /** @private */ this._buf = new Array(capacity);
    /** @private */ this._cap = capacity;
    /** @private */ this._head = 0; // read index
    /** @private */ this._tail = 0; // write index
    /** @private */ this._size = 0;
    /** @private */ this._overflow = overflow;
    /** @private */ this._evicted = 0; // count of items evicted by overwrite
  }

  // ── Core properties ──────────────────────────────────────

  /** Maximum items the buffer can hold. */
  get capacity() { return this._cap; }

  /** Current number of items in the buffer. */
  get size() { return this._size; }

  /** Remaining slots before the buffer is full. */
  get free() { return this._cap - this._size; }

  /** True when no items are stored. */
  get isEmpty() { return this._size === 0; }

  /** True when at capacity. */
  get isFull() { return this._size === this._cap; }

  /** Overflow strategy in use. */
  get overflow() { return this._overflow; }

  /** Total items evicted by overwrite mode (for diagnostics). */
  get evictedCount() { return this._evicted; }

  // ── Core operations ──────────────────────────────────────

  /**
   * Push an item to the back of the buffer.
   *
   * In `'reject'` mode, throws when full.
   * In `'overwrite'` mode, silently evicts the oldest item and returns it
   * (or `undefined` if the buffer wasn't full).
   *
   * @param {T} item
   * @returns {T | undefined} The evicted item in overwrite mode, otherwise undefined.
   * @throws {Error} When full and overflow is 'reject'.
   */
  push(item) {
    let evicted;
    if (this._size === this._cap) {
      if (this._overflow === 'reject') {
        throw new Error(`RingBuffer is full (capacity=${this._cap})`);
      }
      evicted = this._buf[this._head];
      this._head = (this._head + 1) % this._cap;
      this._evicted++;
    } else {
      this._size++;
    }
    this._buf[this._tail] = item;
    this._tail = (this._tail + 1) % this._cap;
    return evicted;
  }

  /**
   * Push multiple items. Returns array of evicted items (overwrite mode only).
   * In 'reject' mode, stops at first failure.
   *
   * @param {Iterable<T>} items
   * @returns {T[]} Evicted items (empty in reject mode).
   */
  pushAll(items) {
    const evicted = [];
    for (const item of items) {
      const e = this.push(item);
      if (e !== undefined) evicted.push(e);
    }
    return evicted;
  }

  /**
   * Pop (remove and return) the front item.
   *
   * @returns {T | undefined} The front item, or undefined if empty.
   */
  pop() {
    if (this._size === 0) return undefined;
    const item = this._buf[this._head];
    this._buf[this._head] = undefined; // help GC
    this._head = (this._head + 1) % this._cap;
    this._size--;
    return item;
  }

  /**
   * Pop (remove and return) the back item (last pushed).
   *
   * @returns {T | undefined} The back item, or undefined if empty.
   */
  popBack() {
    if (this._size === 0) return undefined;
    this._tail = (this._tail - 1 + this._cap) % this._cap;
    const item = this._buf[this._tail];
    this._buf[this._tail] = undefined;
    this._size--;
    return item;
  }

  /**
   * Peek at the front item without removing it.
   *
   * @returns {T | undefined}
   */
  peek() {
    if (this._size === 0) return undefined;
    return this._buf[this._head];
  }

  /**
   * Peek at the back item (last pushed) without removing it.
   *
   * @returns {T | undefined}
   */
  peekBack() {
    if (this._size === 0) return undefined;
    return this._buf[(this._tail - 1 + this._cap) % this._cap];
  }

  /**
   * Peek at item at logical index `i` (0 = front).
   * Non-integer indices return undefined.
   *
   * @param {number} i
   * @returns {T | undefined}
   */
  get(i) {
    if (!Number.isInteger(i) || i < 0 || i >= this._size) return undefined;
    return this._buf[(this._head + i) % this._cap];
  }

  /**
   * Replace item at logical index `i`.
   *
   * @param {number} i
   * @param {T} value
   * @throws {RangeError} If index is out of bounds or not an integer.
   */
  set(i, value) {
    if (!Number.isInteger(i) || i < 0 || i >= this._size) {
      throw new RangeError(`Index ${i} out of bounds (size=${this._size})`);
    }
    this._buf[(this._head + i) % this._cap] = value;
  }

  // ── Bulk operations ──────────────────────────────────────

  /**
   * Remove up to `n` items from the front and return them as an array.
   *
   * @param {number} [n=this.size] - Max items to drain.
   * @returns {T[]}
   */
  drain(n = this._size) {
    if (n < 0) n = 0;
    const result = [];
    const count = Math.min(n, this._size);
    for (let i = 0; i < count; i++) {
      result.push(this.pop());
    }
    return result;
  }

  /**
   * Return a plain array of all items (front-to-back) without modifying the buffer.
   *
   * @returns {T[]}
   */
  toArray() {
    const result = new Array(this._size);
    for (let i = 0; i < this._size; i++) {
      result[i] = this._buf[(this._head + i) % this._cap];
    }
    return result;
  }

  /**
   * Remove all items.
   */
  clear() {
    this._buf.fill(undefined);
    this._head = 0;
    this._tail = 0;
    this._size = 0;
  }

  // ── Search helpers ───────────────────────────────────────

  /**
   * Find the first item matching a predicate (scans front-to-back).
   *
   * @param {(item: T, index: number) => boolean} fn
   * @returns {T | undefined}
   */
  find(fn) {
    for (let i = 0; i < this._size; i++) {
      const item = this._buf[(this._head + i) % this._cap];
      if (fn(item, i)) return item;
    }
    return undefined;
  }

  /**
   * Return indices of items matching a predicate.
   *
   * @param {(item: T, index: number) => boolean} fn
   * @returns {number[]}
   */
  findIndex(fn) {
    for (let i = 0; i < this._size; i++) {
      const item = this._buf[(this._head + i) % this._cap];
      if (fn(item, i)) return i;
    }
    return -1;
  }

  /**
   * Check if an item exists in the buffer (strict equality).
   *
   * @param {T} item
   * @returns {boolean}
   */
  includes(item) {
    return this.find(x => x === item) !== undefined;
  }

  // ── Iteration ────────────────────────────────────────────

  /**
   * Iterate front-to-back. Does not modify the buffer.
   */
  *[Symbol.iterator]() {
    for (let i = 0; i < this._size; i++) {
      yield this._buf[(this._head + i) % this._cap];
    }
  }

  /**
   * Call `fn(item, index)` for each item front-to-back.
   *
   * @param {(item: T, index: number) => void} fn
   */
  forEach(fn) {
    for (let i = 0; i < this._size; i++) {
      fn(this._buf[(this._head + i) % this._cap], i);
    }
  }

  /**
   * Map items to a new array (does not modify the buffer).
   *
   * @param {(item: T, index: number) => any} fn
   * @returns {any[]}
   */
  map(fn) {
    const result = new Array(this._size);
    for (let i = 0; i < this._size; i++) {
      result[i] = fn(this._buf[(this._head + i) % this._cap], i);
    }
    return result;
  }

  // ── Serialization ────────────────────────────────────────

  /**
   * Serialize to a plain object.
   *
   * @returns {{ capacity: number, overflow: string, items: T[] }}
   */
  toJSON() {
    return {
      capacity: this._cap,
      overflow: this._overflow,
      items: this.toArray(),
    };
  }

  /**
   * Reconstruct a RingBuffer from serialized data.
   * If `items` exceeds capacity, only the last `capacity` items are kept.
   *
   * @param {{ capacity: number, overflow?: string, items: any[] }} data
   * @returns {RingBuffer}
   */
  static fromJSON(data) {
    if (!data || typeof data.capacity !== 'number') {
      throw new TypeError('fromJSON requires { capacity, items }');
    }
    const overflow = data.overflow || 'reject';
    const items = data.items || [];
    // Use overwrite mode internally so items > capacity doesn't throw
    const rb = new RingBuffer(data.capacity, { overflow: 'overwrite' });
    for (const item of items) rb.push(item);
    rb._overflow = overflow;
    rb._evicted = 0;
    return rb;
  }

  /**
   * Create a RingBuffer pre-filled from an iterable.
   * If the iterable has more items than capacity, only the last `capacity` items are kept.
   *
   * @param {Iterable<any>} items
   * @param {number} capacity
   * @param {Object} [opts]
   * @returns {RingBuffer}
   */
  static from(items, capacity, opts) {
    const rb = new RingBuffer(capacity, { overflow: 'overwrite', ...opts });
    for (const item of items) rb.push(item);
    // Reset eviction counter so it only counts future evictions
    rb._evicted = 0;
    return rb;
  }

  /**
   * String representation.
   */
  toString() {
    return `RingBuffer(${this._size}/${this._cap}, ${this._overflow})`;
  }
}

export default RingBuffer;
export { RingBuffer };
