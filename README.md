# ringbuffer-x

Zero-dep circular ring buffer with O(1) push/pop, bounded & overwriting modes, iterator support, and serialization.

## Why?

Ring buffers are the backbone of streaming pipelines — audio frames, network packets, log tailing, producer/consumer queues. When you need a fixed-size FIFO that doesn't grow unbounded, this is the primitive.

**~300 lines. Zero dependencies. 75 tests.**

## Install

```bash
npm install ringbuffer-x
```

## Quick start

```js
import { RingBuffer } from 'ringbuffer-x';

const rb = new RingBuffer(5);
rb.push('a');
rb.push('b');
rb.push('c');

rb.pop();     // 'a' (front)
rb.peek();    // 'b'
rb.size;      // 2
```

## Overflow modes

### Reject (default)

Throws when the buffer is full:

```js
const rb = new RingBuffer(2);
rb.push(1);
rb.push(2);
rb.push(3);  // ❌ Error: RingBuffer is full
```

### Overwrite

Silently evicts the oldest item and returns it:

```js
const rb = new RingBuffer(3, { overflow: 'overwrite' });
rb.push(1);
rb.push(2);
rb.push(3);
rb.push(4);  // → returns 1 (evicted)

rb.toArray();  // [2, 3, 4]
rb.evictedCount;  // 1
```

Great for keeping "the last N events" (recent logs, latest sensor readings, rolling window).

## API

### Constructor

```js
new RingBuffer(capacity, { overflow })
```

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `capacity` | `number` | — | Max items (≥ 1) |
| `overflow` | `'reject' \| 'overwrite'` | `'reject'` | Behavior when full |

### Properties

| Property | Description |
|----------|-------------|
| `capacity` | Max items |
| `size` | Current item count |
| `free` | Remaining slots |
| `isEmpty` / `isFull` | State checks |
| `overflow` | Strategy in use |
| `evictedCount` | Items evicted (overwrite mode) |

### Core operations

| Method | Returns | Description |
|--------|---------|-------------|
| `push(item)` | `evicted?` | Add to back. Throws (reject) or evicts (overwrite) when full |
| `pushAll(items)` | `T[]` | Push multiple, return evicted items |
| `pop()` | `T \| undefined` | Remove & return front |
| `popBack()` | `T \| undefined` | Remove & return back |
| `peek()` | `T \| undefined` | Look at front without removing |
| `peekBack()` | `T \| undefined` | Look at back |
| `get(i)` | `T \| undefined` | Read by logical index (0 = front) |
| `set(i, value)` | — | Write by logical index |
| `drain(n)` | `T[]` | Remove up to `n` items from front |
| `clear()` | — | Remove everything |

### Search

| Method | Description |
|--------|-------------|
| `find(fn)` | First matching item |
| `findIndex(fn)` | Index of first match (`-1` if none) |
| `includes(item)` | Strict equality check |

### Iteration

```js
// for...of
for (const item of rb) { ... }

// forEach
rb.forEach((item, index) => { ... });

// map (returns new array)
const arr = rb.map(item => item * 2);

// spread
[...rb]
```

### Serialization

```js
const json = rb.toJSON();
// { capacity: 5, overflow: 'reject', items: [...] }

const restored = RingBuffer.fromJSON(json);
```

### Static factory

```js
// From any iterable — keeps last `capacity` items if overflowing
const rb = RingBuffer.from(stream, 1000);
```

## Real-world examples

### Rolling log buffer

Keep the last 100 log entries for diagnostics:

```js
const recent = new RingBuffer(100, { overflow: 'overwrite' });

function log(msg) {
  recent.push({ time: Date.now(), msg });
}

// On crash handler — dump last 100 logs
function dumpLogs() {
  for (const entry of recent) {
    console.log(entry.time, entry.msg);
  }
}
```

### Producer/consumer throttle

Buffer incoming requests, drain in batches:

```js
const inbox = new RingBuffer(500, { overflow: 'overwrite' });

// Producer (fast)
server.on('request', req => inbox.push(req));

// Consumer (batched, every 100ms)
setInterval(() => {
  const batch = inbox.drain(50);
  if (batch.length) processBatch(batch);
}, 100);
```

### Sliding window median

Keep a rolling window of sensor values:

```js
const window = RingBuffer.from([], 30, { overflow: 'overwrite' });

sensor.on('reading', value => {
  window.push(value);
  if (window.size === 30) {
    const sorted = [...window].sort((a, b) => a - b);
    const median = sorted[15];
    console.log(`median: ${median}`);
  }
});
```

### Audio frame buffer

Fixed-capacity buffer for real-time audio (no allocation in hot path):

```js
const frames = new RingBuffer(64);  // 64 frames max

function onAudioFrame(frame) {
  if (frames.isFull) {
    // We're behind — skip or handle
    frames.pop();  // drop oldest
  }
  frames.push(frame);
}
```

## CLI

Stateful CLI for quick testing (state persists in `~/.ringbuffer-x-state.json`):

```bash
# Push items
ringbuffer-x push a b c --cap 5

# Pop
ringbuffer-x pop

# See buffer state
ringbuffer-x info

# Drain multiple
ringbuffer-x drain --count 3

# Run demo
ringbuffer-x demo --cap 5

# Load from JSON file
ringbuffer-x from-json data.json --cap 100
```

## How does it compare?

| Feature | ringbuffer-x | circular-buffer | ringbufferjs | denque |
|---------|:---:|:---:|:---:|:---:|
| Zero deps | ✅ | ✅ | ✅ | ✅ |
| Overwrite mode | ✅ | ❌ | ❌ | ❌ |
| `popBack()` | ✅ | ❌ | ✅ | ✅ |
| Random access (`get`/`set`) | ✅ | ❌ | ❌ | ✅ |
| Iterator protocol | ✅ | ✅ | ❌ | ✅ |
| `forEach` / `map` | ✅ | ❌ | ❌ | ❌ |
| Search (`find`/`includes`) | ✅ | ❌ | ❌ | ❌ |
| Serialization (`toJSON`/`fromJSON`) | ✅ | ❌ | ❌ | ❌ |
| `drain(n)` batch pop | ✅ | ❌ | ❌ | ❌ |
| Static `from(iterable)` | ✅ | ❌ | ❌ | ❌ |
| Eviction counter | ✅ | ❌ | ❌ | ❌ |
| CLI included | ✅ | ❌ | ❌ | ❌ |

---

## License

MIT
