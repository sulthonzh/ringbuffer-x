#!/usr/bin/env node
/**
 * ringbuffer-x CLI
 *
 * Usage:
 *   ringbuffer-x push <items...> [--cap N] [--overflow reject|overwrite]
 *   ringbuffer-x pop [--count N]
 *   ringbuffer-x peek [--back]
 *   ringbuffer-x info
 *   ringbuffer-x drain [--count N]
 *   ringbuffer-x demo [--cap N]
 *   ringbuffer-x from-json <file|-> [--cap N]
 *
 * State persists in ~/.ringbuffer-x-state.json between CLI invocations.
 */

'use strict';

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { RingBuffer } from './index.js';

const STATE_FILE = resolve(homedir(), '.ringbuffer-x-state.json');

function loadState() {
  if (!existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function saveState(rb) {
  writeFileSync(STATE_FILE, JSON.stringify(rb.toJSON(), null, 2));
}

function getRB(capacity, overflow) {
  const state = loadState();
  if (state && !capacity && !overflow) {
    return RingBuffer.fromJSON(state);
  }
  const cap = capacity || state?.capacity || 10;
  const ov = overflow || state?.overflow || 'reject';
  const rb = new RingBuffer(cap, { overflow: ov });
  if (state?.items) for (const item of state.items) rb.push(item);
  return rb;
}

function showJSON(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

function parseArgs(argv) {
  const args = { flags: {}, positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args.flags[key] = isNaN(Number(next)) ? next : Number(next);
        i++;
      } else {
        args.flags[key] = true;
      }
    } else {
      args.positional.push(a);
    }
  }
  return args;
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd) {
    console.log(`ringbuffer-x CLI

Commands:
  push <items...>     Push items (--cap N, --overflow reject|overwrite)
  pop [--count N]     Pop from front
  peek [--back]       Peek front or back
  info                Show buffer info
  drain [--count N]   Drain N items
  demo [--cap N]      Run a demo
  from-json <file|->  Load items from JSON file (- for stdin)
  clear               Clear the buffer
`);
    process.exit(0);
  }

  const { flags, positional } = parseArgs(rest);

  switch (cmd) {
    case 'push': {
      const rb = getRB(flags.cap, flags.overflow);
      const evicted = rb.pushAll(positional);
      if (evicted.length) console.log(`Evicted ${evicted.length} items:`, evicted);
      saveState(rb);
      console.log(`Pushed ${positional.length} items. ${rb.toString()}`);
      break;
    }
    case 'pop': {
      const rb = getRB();
      const count = flags.count || 1;
      const items = rb.drain(count);
      saveState(rb);
      if (flags.json) { showJSON(items); } else {
        if (items.length === 1) console.log(items[0]);
        else console.log(items);
      }
      break;
    }
    case 'peek': {
      const rb = getRB();
      const item = flags.back ? rb.peekBack() : rb.peek();
      if (flags.json) showJSON({ item }); else console.log(item);
      break;
    }
    case 'info': {
      const rb = getRB();
      if (flags.json) {
        showJSON({ size: rb.size, capacity: rb.capacity, free: rb.free, isEmpty: rb.isEmpty, isFull: rb.isFull, overflow: rb.overflow, evicted: rb.evictedCount });
      } else {
        console.log(rb.toString());
        console.log(`  items: [${rb.toArray().join(', ')}]`);
        console.log(`  free slots: ${rb.free}, evicted: ${rb.evictedCount}`);
      }
      break;
    }
    case 'drain': {
      const rb = getRB();
      const items = rb.drain(flags.count || rb.size);
      saveState(rb);
      if (flags.json) showJSON(items); else console.log(items);
      break;
    }
    case 'clear': {
      const rb = getRB();
      rb.clear();
      saveState(rb);
      console.log('Buffer cleared.');
      break;
    }
    case 'from-json': {
      const file = positional[0];
      const data = file === '-' || !file
        ? readFileSync(0, 'utf8')
        : readFileSync(file, 'utf8');
      const items = JSON.parse(data);
      const rb = new RingBuffer(flags.cap || 100, { overflow: 'overwrite' });
      for (const item of items) rb.push(item);
      saveState(rb);
      console.log(`Loaded ${items.length} items. ${rb.toString()}`);
      break;
    }
    case 'demo': {
      const cap = flags.cap || 5;
      const rb = new RingBuffer(cap, { overflow: 'overwrite' });
      console.log(`\n  ringbuffer-x demo (cap=${cap}, overwrite mode)\n`);
      for (let i = 1; i <= cap + 3; i++) {
        const evicted = rb.push(i);
        console.log(`  push ${i} → size=${rb.size}/${rb.capacity}` + (evicted !== undefined ? ` (evicted ${evicted})` : ''));
      }
      console.log(`\n  buffer: [${rb.toArray().join(', ')}]`);
      console.log(`  peek front: ${rb.peek()}, peek back: ${rb.peekBack()}`);
      console.log(`  pop: ${rb.pop()}`);
      console.log(`  buffer after pop: [${rb.toArray().join(', ')}]\n`);
      break;
    }
    default:
      console.error(`Unknown command: ${cmd}`);
      process.exit(1);
  }
}

main();
