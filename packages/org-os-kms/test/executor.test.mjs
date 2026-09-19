import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runLifecycle } from '../src/executor.mjs';
import { OPS } from '../src/ops.mjs';

// Build an isolated OPS-like map by monkeypatching run() to record order without touching disk.
function stubOps(order) {
  return {
    'a.read':  { kind: 'exec', write: false, run: () => { order.push('a.read'); return { ok: true }; } },
    'a.write': { kind: 'exec', write: true,  run: () => { order.push('a.write'); return { ok: true }; } },
    'a.render': { kind: 'exec', write: false, run: () => { order.push('a.render'); throw new Error('render boom'); } },
    'a.crash': { kind: 'exec', write: true,  run: () => { order.push('a.crash'); throw new Error('write boom'); } },
    'a.skill': { kind: 'skill', skill: 'demo-skill' },
  };
}

test('runs exec ops in order, collects skill directives', async () => {
  const order = [];
  const r = await runLifecycle('initialize', { dir: '.' },
    { events: { initialize: ['a.read', 'a.skill', 'a.write'] }, ops: stubOps(order) });
  assert.deepEqual(order, ['a.read', 'a.write']);
  assert.deepEqual(r.skills, ['demo-skill']);
  assert.equal(r.errors.length, 0);
});

test('fail-soft: a render/read op error is logged but the run continues', async () => {
  const order = [];
  const r = await runLifecycle('initialize', { dir: '.' },
    { events: { initialize: ['a.render', 'a.read'] }, ops: stubOps(order) });
  assert.deepEqual(order, ['a.render', 'a.read']);
  assert.match(r.errors[0], /render boom/);
});

test('fail-hard: a write op error stops the run', async () => {
  const order = [];
  const r = await runLifecycle('initialize', { dir: '.' },
    { events: { initialize: ['a.crash', 'a.read'] }, ops: stubOps(order) });
  assert.deepEqual(order, ['a.crash']); // a.read never runs
  assert.match(r.errors[0], /write boom/);
});

test('fail-hard: a write op that returns {ok:false} (no throw) stops the run', async () => {
  const order = [];
  const ops = {
    'a.softfail': { kind: 'exec', write: true, run: () => { order.push('a.softfail'); return { ok: false }; } },
    'a.read': { kind: 'exec', write: false, run: () => { order.push('a.read'); return { ok: true }; } },
  };
  const r = await runLifecycle('initialize', { dir: '.' },
    { events: { initialize: ['a.softfail', 'a.read'] }, ops });
  assert.deepEqual(order, ['a.softfail']); // a.read never runs
  assert.match(r.errors[0], /a.softfail: reported failure/);
});

test('op registry is importable and wired (import sanity)', () => {
  assert.ok(OPS['config.load']); // sanity: real registry wired
});

test('fail-hard: an unregistered op-name halts the run', async () => {
  const order = [];
  const r = await runLifecycle('initialize', { dir: '.' },
    { events: { initialize: ['a.read', 'a.ghost', 'a.read'] },
      ops: { 'a.read': { kind: 'exec', write: false, run: () => { order.push('a.read'); return { ok: true }; } } } });
  assert.deepEqual(order, ['a.read']); // stops at the unregistered op; the second a.read never runs
  assert.match(r.errors[0], /unregistered op: a.ghost/);
});

test('throws on an unknown lifecycle event', () => {
  assert.throws(() => runLifecycle('nope', {}, { events: {} }), /unknown lifecycle event/);
});

test('runLifecycle awaits async ops in order', async () => {
  const order = [];
  const ops = { a: { kind: 'exec', write: false, run: async () => { await new Promise((r) => setTimeout(r, 5)); order.push('a'); return { ok: true }; } },
                b: { kind: 'exec', write: false, run: () => { order.push('b'); return { ok: true }; } } };
  const r = await runLifecycle('initialize', {}, { ops, events: { initialize: ['a', 'b'] } });
  assert.deepEqual(order, ['a', 'b']); assert.equal(r.ran.length, 2);
});
