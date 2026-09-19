import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PUBLISHABLE_TYPES, OPT_IN_TYPES, ALL_TYPES, PUBLISHABLE_PUBLIC_USE, publishableTypes, isPublishable, PRIVATE_FIELDS, publicView } from '../src/publishable.mjs';
import { listSchemas, loadSchema, schemaFields, validateObject } from '../src/index.mjs';

test('default set is 10 schemas, never person; opt-in adds source-system + public-use-boundary', () => {
  assert.equal(PUBLISHABLE_TYPES.length, 10);
  assert.ok(!ALL_TYPES.includes('person'));
  assert.deepEqual(OPT_IN_TYPES, ['source-system', 'public-use-boundary']);
  for (const t of ALL_TYPES) assert.ok(listSchemas().includes(t), `schema missing: ${t}`);
});

test('every PUBLISHABLE_PUBLIC_USE value is a real axis value', () => {
  const axis = loadSchema('review-maturity').axes.public_use.values;
  for (const v of PUBLISHABLE_PUBLIC_USE) assert.ok(axis.includes(v), v);
});

test('publishableTypes composes opt-in/opt-out; refuses person and unknown', () => {
  assert.equal(publishableTypes({}).length, 10);
  const t = publishableTypes({ publish: { types_opt_in: ['source-system'], types_opt_out: ['signal'] } });
  assert.ok(t.includes('source-system') && !t.includes('signal'));
  assert.throws(() => publishableTypes({ publish: { types_opt_in: ['person'] } }), /person/);
  assert.throws(() => publishableTypes({ publish: { types_opt_in: ['nope'] } }), /unknown/);
});

test('isPublishable is keyed on schema, not object.type', () => {
  const ok = 'ok-with-caveat';
  assert.equal(isPublishable({ type: 'resource', public_use: ok }), true);
  assert.equal(isPublishable({ type: 'resource', public_use: 'internal-only' }), false);
  assert.equal(isPublishable({ type: 'resource' }), false);
  assert.equal(isPublishable(null), false);
  assert.equal(isPublishable({ type: 'resource', public_use: ok, maturity: 'raw' }), true, 'maturity is not part of the floor');
  const card = { type: 'blog', public_use: ok };
  assert.equal(isPublishable(card, { schema: 'source-system' }), false);
  assert.equal(isPublishable(card, { schema: 'source-system', types: publishableTypes({ publish: { types_opt_in: ['source-system'] } }) }), true);
  assert.equal(isPublishable({ tier: 'x', public_use: ok }, { schema: 'public-use-boundary' }), false);
  assert.equal(isPublishable({ title: 'x', public_use: ok }, { schema: 'person' }), false);
});

test('publicView strips editorial internals, keeps everything else, does not mutate', () => {
  const src = { title: 'A', notes: 'internal', work_order: 'wo-1', reviewed_by: 'Luiz', high_risk: false, provenance: { origin: 'o', surfaced_by: 'batch 2' }, url: 'u' };
  const out = publicView(src);
  assert.deepEqual(out, { title: 'A', provenance: { origin: 'o' }, url: 'u' });
  assert.equal(src.notes, 'internal');
  for (const f of ['notes', 'work_order', 'reviewed_by', 'review_needs', 'high_risk', 'consent_note', 'additional_provenance']) assert.ok(PRIVATE_FIELDS.includes(f), f);
});

test('identity + provenance fields exist on every default publishable schema', () => {
  for (const t of PUBLISHABLE_TYPES) { const f = schemaFields(t); for (const k of ['id', 'grc20Id', 'sourceUri', 'viaUri']) assert.ok(f[k], `${t} lacks ${k}`); }
  assert.equal(validateObject('resource', { title: 'x', type: 'resource', id: 'a-b', grc20Id: 'c', sourceUri: 'at://d/e/f' }).valid, true);
});

// D3: `held` is the one maturity the floor refuses. It is what an origin retraction sets
// (and what an operator sets to withhold), so an object that turns held must stop publishing
// even though its public_use still clears the floor. Every other maturity stays out of the floor.
test('isPublishable refuses a held object even when public_use clears the floor; other maturities still pass', () => {
  const ok = 'ok-with-caveat';
  assert.equal(isPublishable({ type: 'resource', public_use: ok, maturity: 'held' }), false);
  for (const maturity of ['raw', 'plausible', 'field-informed', 'reviewed']) {
    assert.equal(isPublishable({ type: 'resource', public_use: ok, maturity }), true, maturity);
  }
});
