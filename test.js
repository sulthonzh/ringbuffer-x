import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RingBuffer } from './index.js';

describe('RingBuffer — construction', () => {
  it('creates with valid capacity', () => {
    const rb = new RingBuffer(5);
    assert.equal(rb.capacity, 5);
    assert.equal(rb.size, 0);
    assert.equal(rb.free, 5);
    assert.ok(rb.isEmpty);
    assert.ok(!rb.isFull);
  });

  it('rejects non-positive capacity', () => {
    assert.throws(() => new RingBuffer(0), RangeError);
    assert.throws(() => new RingBuffer(-1), RangeError);
    assert.throws(() => new RingBuffer(3.5), RangeError);
    assert.throws(() => new RingBuffer('x'), RangeError);
  });

  it('accepts overflow strategy', () => {
    assert.equal(new RingBuffer(3, { overflow: 'reject' }).overflow, 'reject');
    assert.equal(new RingBuffer(3, { overflow: 'overwrite' }).overflow, 'overwrite');
  });

  it('rejects invalid overflow', () => {
    assert.throws(() => new RingBuffer(3, { overflow: 'lol' }), TypeError);
  });
});

describe('RingBuffer — push & pop', () => {
  it('pushes and pops in FIFO order', () => {
    const rb = new RingBuffer(3);
    rb.push('a'); rb.push('b'); rb.push('c');
    assert.equal(rb.size, 3);
    assert.equal(rb.pop(), 'a');
    assert.equal(rb.pop(), 'b');
    assert.equal(rb.pop(), 'c');
    assert.equal(rb.pop(), undefined);
    assert.equal(rb.size, 0);
  });

  it('wraps around correctly', () => {
    const rb = new RingBuffer(3);
    rb.push(1); rb.push(2); rb.push(3);
    rb.pop();       // remove 1
    rb.push(4);     // wraps
    assert.deepEqual(rb.toArray(), [2, 3, 4]);
  });

  it('supports multiple wrap-arounds', () => {
    const rb = new RingBuffer(2);
    for (let i = 0; i < 10; i++) {
      rb.push(i);
      if (rb.size > 1) rb.pop();
    }
    assert.equal(rb.size, 1);
  });

  it('throws when full in reject mode', () => {
    const rb = new RingBuffer(2);
    rb.push(1); rb.push(2);
    assert.throws(() => rb.push(3), /full/);
  });

  it('overwrites oldest in overwrite mode', () => {
    const rb = new RingBuffer(3, { overflow: 'overwrite' });
    rb.push(1); rb.push(2); rb.push(3);
    const evicted = rb.push(4);
    assert.equal(evicted, 1);
    assert.deepEqual(rb.toArray(), [2, 3, 4]);
    assert.equal(rb.evictedCount, 1);
  });

  it('returns undefined when not full in overwrite mode', () => {
    const rb = new RingBuffer(3, { overflow: 'overwrite' });
    assert.equal(rb.push(1), undefined);
  });

  it('pushAll returns evicted items', () => {
    const rb = new RingBuffer(3, { overflow: 'overwrite' });
    rb.push(1); rb.push(2);
    const evicted = rb.pushAll([3, 4, 5, 6]);
    assert.deepEqual(evicted, [1, 2, 3]);
    assert.deepEqual(rb.toArray(), [4, 5, 6]);
  });
});

describe('RingBuffer — popBack', () => {
  it('removes from back', () => {
    const rb = new RingBuffer(5);
    rb.push(1); rb.push(2); rb.push(3);
    assert.equal(rb.popBack(), 3);
    assert.equal(rb.popBack(), 2);
    assert.deepEqual(rb.toArray(), [1]);
  });

  it('returns undefined when empty', () => {
    const rb = new RingBuffer(3);
    assert.equal(rb.popBack(), undefined);
  });
});

describe('RingBuffer — peek', () => {
  it('peeks front and back without removing', () => {
    const rb = new RingBuffer(5);
    rb.push('x'); rb.push('y'); rb.push('z');
    assert.equal(rb.peek(), 'x');
    assert.equal(rb.peekBack(), 'z');
    assert.equal(rb.size, 3);
  });

  it('returns undefined on empty', () => {
    const rb = new RingBuffer(3);
    assert.equal(rb.peek(), undefined);
    assert.equal(rb.peekBack(), undefined);
  });
});

describe('RingBuffer — get & set', () => {
  it('gets by logical index', () => {
    const rb = new RingBuffer(5);
    rb.push(10); rb.push(20); rb.push(30);
    assert.equal(rb.get(0), 10);
    assert.equal(rb.get(1), 20);
    assert.equal(rb.get(2), 30);
    assert.equal(rb.get(-1), undefined);
    assert.equal(rb.get(3), undefined);
  });

  it('sets by logical index', () => {
    const rb = new RingBuffer(5);
    rb.push('a'); rb.push('b');
    rb.set(0, 'A');
    rb.set(1, 'B');
    assert.deepEqual(rb.toArray(), ['A', 'B']);
  });

  it('set throws on out-of-bounds', () => {
    const rb = new RingBuffer(3);
    rb.push(1);
    assert.throws(() => rb.set(1, 'x'), RangeError);
    assert.throws(() => rb.set(-1, 'x'), RangeError);
  });
});

describe('RingBuffer — drain', () => {
  it('drains up to n items', () => {
    const rb = new RingBuffer(5);
    rb.push(1); rb.push(2); rb.push(3); rb.push(4);
    assert.deepEqual(rb.drain(2), [1, 2]);
    assert.equal(rb.size, 2);
  });

  it('drains all when n > size', () => {
    const rb = new RingBuffer(3);
    rb.push('a'); rb.push('b');
    assert.deepEqual(rb.drain(10), ['a', 'b']);
    assert.equal(rb.size, 0);
  });

  it('drain(0) returns empty', () => {
    const rb = new RingBuffer(3);
    rb.push(1);
    assert.deepEqual(rb.drain(0), []);
  });
});

describe('RingBuffer — clear', () => {
  it('removes all items', () => {
    const rb = new RingBuffer(5);
    rb.push(1); rb.push(2); rb.push(3);
    rb.clear();
    assert.equal(rb.size, 0);
    assert.ok(rb.isEmpty);
    assert.equal(rb.pop(), undefined);
  });

  it('can push after clear', () => {
    const rb = new RingBuffer(3);
    rb.push(1); rb.push(2); rb.push(3);
    rb.clear();
    rb.push('x'); rb.push('y');
    assert.deepEqual(rb.toArray(), ['x', 'y']);
  });
});

describe('RingBuffer — search', () => {
  it('find returns first match', () => {
    const rb = new RingBuffer(5);
    rb.push(1); rb.push(2); rb.push(3);
    assert.equal(rb.find(x => x > 1), 2);
  });

  it('find returns undefined on no match', () => {
    const rb = new RingBuffer(3);
    rb.push(1); rb.push(2);
    assert.equal(rb.find(x => x > 10), undefined);
  });

  it('findIndex returns logical index', () => {
    const rb = new RingBuffer(5);
    rb.push('a'); rb.push('b'); rb.push('c');
    assert.equal(rb.findIndex(x => x === 'b'), 1);
    assert.equal(rb.findIndex(x => x === 'z'), -1);
  });

  it('includes works with strict equality', () => {
    const rb = new RingBuffer(5);
    rb.push(42); rb.push('hello');
    assert.ok(rb.includes(42));
    assert.ok(rb.includes('hello'));
    assert.ok(!rb.includes(43));
  });
});

describe('RingBuffer — iteration', () => {
  it('iterates front-to-back with for..of', () => {
    const rb = new RingBuffer(5);
    rb.push(10); rb.push(20); rb.push(30);
    const result = [];
    for (const item of rb) result.push(item);
    assert.deepEqual(result, [10, 20, 30]);
  });

  it('forEach iterates with index', () => {
    const rb = new RingBuffer(3);
    rb.push('a'); rb.push('b');
    const seen = [];
    rb.forEach((item, i) => seen.push([item, i]));
    assert.deepEqual(seen, [['a', 0], ['b', 1]]);
  });

  it('map transforms items', () => {
    const rb = new RingBuffer(4);
    rb.push(1); rb.push(2); rb.push(3);
    const doubled = rb.map(x => x * 2);
    assert.deepEqual(doubled, [2, 4, 6]);
    // buffer unchanged
    assert.equal(rb.size, 3);
  });

  it('works correctly after wrap-around', () => {
    const rb = new RingBuffer(3);
    rb.push(1); rb.push(2); rb.push(3);
    rb.pop(); rb.push(4); // now [2,3,4] with internal wrap
    assert.deepEqual(rb.toArray(), [2, 3, 4]);
    assert.deepEqual([...rb], [2, 3, 4]);
  });
});

describe('RingBuffer — serialization', () => {
  it('toJSON returns capacity, overflow, items', () => {
    const rb = new RingBuffer(5);
    rb.push(1); rb.push(2);
    const json = rb.toJSON();
    assert.equal(json.capacity, 5);
    assert.equal(json.overflow, 'reject');
    assert.deepEqual(json.items, [1, 2]);
  });

  it('fromJSON reconstructs the buffer', () => {
    const original = new RingBuffer(4);
    original.push('a'); original.push('b'); original.push('c');
    const json = original.toJSON();
    const restored = RingBuffer.fromJSON(json);
    assert.equal(restored.capacity, 4);
    assert.equal(restored.size, 3);
    assert.deepEqual(restored.toArray(), ['a', 'b', 'c']);
  });

  it('fromJSON round-trips after wrap', () => {
    const rb = new RingBuffer(3);
    rb.push(1); rb.push(2); rb.push(3);
    rb.pop(); rb.push(4); // [2,3,4]
    const restored = RingBuffer.fromJSON(rb.toJSON());
    assert.deepEqual(restored.toArray(), [2, 3, 4]);
  });
});

describe('RingBuffer — static from()', () => {
  it('creates from array within capacity', () => {
    const rb = RingBuffer.from([1, 2, 3], 5);
    assert.deepEqual(rb.toArray(), [1, 2, 3]);
    assert.equal(rb.capacity, 5);
  });

  it('keeps last N items when overflowing', () => {
    const rb = RingBuffer.from([1, 2, 3, 4, 5, 6, 7], 3);
    assert.deepEqual(rb.toArray(), [5, 6, 7]);
  });

  it('resets eviction counter', () => {
    const rb = RingBuffer.from([1, 2, 3, 4, 5], 3);
    assert.equal(rb.evictedCount, 0);
  });
});

describe('RingBuffer — toString', () => {
  it('shows useful info', () => {
    const rb = new RingBuffer(10);
    rb.push('x');
    const s = rb.toString();
    assert.ok(s.includes('1/10'));
    assert.ok(s.includes('reject'));
  });
});

describe('RingBuffer — version', () => {
  it('package.json version is 1.1.0', () => {
    const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
    assert.equal(pkg.version, '1.1.0');
  });
});

describe('RingBuffer — get/set validation', () => {
  it('set(NaN) throws RangeError', () => {
    const rb = new RingBuffer(3);
    rb.push(1);
    assert.throws(() => rb.set(NaN, 'x'), RangeError);
  });

  it('set(1.5) throws RangeError', () => {
    const rb = new RingBuffer(3);
    rb.push(1);
    assert.throws(() => rb.set(1.5, 'x'), RangeError);
  });

  it('set(Infinity) throws RangeError', () => {
    const rb = new RingBuffer(3);
    rb.push(1);
    assert.throws(() => rb.set(Infinity, 'x'), RangeError);
  });

  it('get(NaN) returns undefined', () => {
    const rb = new RingBuffer(3);
    rb.push(1); rb.push(2);
    assert.equal(rb.get(NaN), undefined);
  });

  it('get(1.5) returns undefined', () => {
    const rb = new RingBuffer(3);
    rb.push(1); rb.push(2);
    assert.equal(rb.get(1.5), undefined);
  });

  it('get(-0) returns first element', () => {
    const rb = new RingBuffer(3);
    rb.push(42);
    assert.equal(rb.get(-0), 42);
    assert.equal(rb.get(0), 42);
  });
});

describe('RingBuffer — fromJSON edge cases', () => {
  it('handles items > capacity (keeps last N)', () => {
    const rb = RingBuffer.fromJSON({ capacity: 3, items: [1, 2, 3, 4, 5] });
    assert.deepEqual(rb.toArray(), [3, 4, 5]);
  });

  it('handles items > capacity with overflow=overwrite', () => {
    const rb = RingBuffer.fromJSON({ capacity: 2, overflow: 'overwrite', items: [10, 20, 30, 40] });
    assert.deepEqual(rb.toArray(), [30, 40]);
    assert.equal(rb.overflow, 'overwrite');
  });

  it('preserves overflow=reject after truncation', () => {
    const rb = RingBuffer.fromJSON({ capacity: 3, overflow: 'reject', items: [1, 2, 3, 4, 5] });
    assert.equal(rb.overflow, 'reject');
    assert.deepEqual(rb.toArray(), [3, 4, 5]);
  });

  it('resets eviction count after truncation', () => {
    const rb = RingBuffer.fromJSON({ capacity: 3, items: [1, 2, 3, 4, 5] });
    assert.equal(rb.evictedCount, 0);
  });

  it('handles empty items array', () => {
    const rb = RingBuffer.fromJSON({ capacity: 3, items: [] });
    assert.equal(rb.size, 0);
    assert.ok(rb.isEmpty);
  });

  it('handles missing items (undefined)', () => {
    const rb = RingBuffer.fromJSON({ capacity: 3 });
    assert.equal(rb.size, 0);
  });

  it('throws on missing capacity', () => {
    assert.throws(() => RingBuffer.fromJSON({ items: [1, 2] }), TypeError);
  });

  it('throws on non-object', () => {
    assert.throws(() => RingBuffer.fromJSON(null), TypeError);
    assert.throws(() => RingBuffer.fromJSON('hello'), TypeError);
  });
});

describe('RingBuffer — drain edge cases', () => {
  it('drain(-1) returns empty array', () => {
    const rb = new RingBuffer(5);
    rb.push(1); rb.push(2);
    assert.deepEqual(rb.drain(-1), []);
    assert.equal(rb.size, 2);
  });

  it('drain(NaN) drains 0 items (NaN clamped to 0)', () => {
    const rb = new RingBuffer(3);
    rb.push(1); rb.push(2);
    // NaN < 0 is false, so n stays NaN; Math.min(NaN, size) = NaN; loop runs 0 times
    const result = rb.drain(NaN);
    assert.deepEqual(result, []);
    assert.equal(rb.size, 2);
  });
});

describe('RingBuffer — additional coverage', () => {
  it('pushAll with non-iterable throws', () => {
    const rb = new RingBuffer(3);
    assert.throws(() => rb.pushAll(42), TypeError);
  });

  it('pushAll with string iterable', () => {
    const rb = new RingBuffer(10);
    rb.pushAll('hello');
    assert.deepEqual(rb.toArray(), ['h', 'e', 'l', 'l', 'o']);
  });

  it('pushAll with Set', () => {
    const rb = new RingBuffer(10);
    rb.pushAll(new Set([3, 1, 4, 1, 5]));
    assert.deepEqual(rb.toArray(), [3, 1, 4, 5]);
  });

  it('pushAll with generator', () => {
    const rb = new RingBuffer(10);
    function* gen() { yield 'a'; yield 'b'; yield 'c'; }
    rb.pushAll(gen());
    assert.deepEqual(rb.toArray(), ['a', 'b', 'c']);
  });

  it('overwrite pushAll returns evicted in order', () => {
    const rb = new RingBuffer(3, { overflow: 'overwrite' });
    rb.push('x'); rb.push('y');
    // start: [x, y, _], head=0, tail=2, size=2
    const evicted = rb.pushAll(['a', 'b', 'c', 'd', 'e']);
    // push a: size=3, [x,y,a], tail=0
    // push b: full, evict x → [b,y,a], head=1, tail=1
    // push c: full, evict y → [b,c,a], head=2, tail=2
    // push d: full, evict a → [b,c,d], head=0, tail=0
    // push e: full, evict b → [e,c,d], head=1, tail=1
    // toArray reads from head=1: [c, d, e]
    assert.deepEqual(evicted, ['x', 'y', 'a', 'b']);
    assert.deepEqual(rb.toArray(), ['c', 'd', 'e']);
  });

  it('multiple clear/reuse cycles', () => {
    const rb = new RingBuffer(3);
    for (let cycle = 0; cycle < 5; cycle++) {
      rb.push(cycle * 3); rb.push(cycle * 3 + 1); rb.push(cycle * 3 + 2);
      assert.equal(rb.size, 3);
      assert.ok(rb.isFull);
      rb.clear();
      assert.equal(rb.size, 0);
    }
  });

  it('findIndex with predicate scanning all items', () => {
    const rb = new RingBuffer(5);
    rb.push(10); rb.push(20); rb.push(30); rb.push(40); rb.push(50);
    // wrap around
    rb.pop(); rb.pop();
    rb.push(60); rb.push(70);
    // buffer: [30, 40, 50, 60, 70]
    assert.equal(rb.findIndex(x => x === 60), 3);
  });

  it('map with wrap-around', () => {
    const rb = new RingBuffer(3);
    rb.push(1); rb.push(2); rb.push(3);
    rb.pop(); rb.push(4); // [2,3,4] with wrap
    assert.deepEqual(rb.map(x => x * 10), [20, 30, 40]);
  });

  it('forEach with wrap-around', () => {
    const rb = new RingBuffer(3);
    rb.push('a'); rb.push('b'); rb.push('c');
    rb.pop(); rb.push('d'); // [b,c,d]
    const seen = [];
    rb.forEach((item, i) => seen.push(`${i}:${item}`));
    assert.deepEqual(seen, ['0:b', '1:c', '2:d']);
  });

  it('includes with objects (reference equality)', () => {
    const obj = { id: 1 };
    const rb = new RingBuffer(3);
    rb.push(obj);
    assert.ok(rb.includes(obj));
    assert.ok(!rb.includes({ id: 1 })); // different reference
  });

  it('toJSON after wrap-around', () => {
    const rb = new RingBuffer(3, { overflow: 'overwrite' });
    rb.push(1); rb.push(2); rb.push(3);
    rb.push(4); rb.push(5); // evicted 1,2; buffer [3,4,5]
    const json = rb.toJSON();
    assert.equal(json.capacity, 3);
    assert.equal(json.overflow, 'overwrite');
    assert.deepEqual(json.items, [3, 4, 5]);
  });

  it('from() with Set', () => {
    const rb = RingBuffer.from(new Set([1, 2, 3]), 5);
    assert.deepEqual(rb.toArray(), [1, 2, 3]);
  });

  it('from() with exact capacity fill', () => {
    const rb = RingBuffer.from([1, 2, 3], 3);
    assert.deepEqual(rb.toArray(), [1, 2, 3]);
    assert.ok(rb.isFull);
  });

  it('toString after operations', () => {
    const rb = new RingBuffer(10, { overflow: 'overwrite' });
    rb.push(1); rb.push(2);
    const s = rb.toString();
    assert.ok(s.includes('2/10'));
    assert.ok(s.includes('overwrite'));
  });
});

describe('RingBuffer — stress / edge cases', () => {
  it('alternating push/pop many times', () => {
    const rb = new RingBuffer(3);
    for (let i = 0; i < 1000; i++) {
      rb.push(i);
      rb.pop();
    }
    assert.equal(rb.size, 0);
  });

  it('overwrite mode heavy usage', () => {
    const rb = new RingBuffer(5, { overflow: 'overwrite' });
    for (let i = 0; i < 1000; i++) rb.push(i);
    assert.equal(rb.size, 5);
    assert.deepEqual(rb.toArray(), [995, 996, 997, 998, 999]);
    assert.equal(rb.evictedCount, 995);
  });

  it('pushAll with empty iterable', () => {
    const rb = new RingBuffer(3);
    assert.deepEqual(rb.pushAll([]), []);
    assert.equal(rb.size, 0);
  });

  it('can store objects', () => {
    const rb = new RingBuffer(3);
    rb.push({ id: 1 }); rb.push({ id: 2 });
    assert.equal(rb.get(0).id, 1);
    assert.equal(rb.get(1).id, 2);
  });

  it('capacity of 1 works', () => {
    const rb = new RingBuffer(1);
    rb.push('only');
    assert.ok(rb.isFull);
    assert.throws(() => rb.push('more'));
    assert.equal(rb.pop(), 'only');
    assert.ok(rb.isEmpty);
  });

  it('capacity 1 with overwrite', () => {
    const rb = new RingBuffer(1, { overflow: 'overwrite' });
    rb.push('a');
    const evicted = rb.push('b');
    assert.equal(evicted, 'a');
    assert.deepEqual(rb.toArray(), ['b']);
  });
});
