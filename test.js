import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
