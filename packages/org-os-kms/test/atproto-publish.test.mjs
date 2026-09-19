// packages/org-os-kms/test/atproto-publish.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planPublish, applyPublish, contentHash } from '../src/atproto/publish.mjs';
import { XrpcError } from '../src/atproto/client.mjs';

const AUTH = 'xyz.regencoordination.kb'; const DID = 'did:plc:me';
const item = (slug, extra = {}, schema = 'resource') => ({ schema, ref: `data/kb/${schema}.yaml#${slug}`, object: { title: slug, type: 'resource', public_use: 'ok-with-caveat', id: `id-${slug}`, grc20Id: `g-${slug}`, ...extra } });
const empty = { version: 1, objects: {} };
const RES = `${AUTH}.resource`;

test('create / skip / update(swapRecord) / delete', () => {
  const a = item('a', { notes: 'x' }); const b = item('b');
  const first = planPublish({ items: [a, b], manifest: empty, did: DID, authority: AUTH });
  assert.equal(first.ok, true); assert.equal(first.create.length, 2);
  assert.equal(first.create[0].collection, RES); assert.equal(first.create[0].rkey, 'id-a'); assert.equal(first.create[0].slug, 'a');
  assert.equal(first.create[0].record.$type, RES);
  assert.equal(first.create[0].record.notes, undefined);
  const manifest = { version: 1, objects: {
    'id-a': { slug: 'a', type: 'resource', rkey: 'id-a', atUri: `at://${DID}/${RES}/id-a`, cid: 'cid-a', hash: first.create[0].hash, publishedAt: 't' },
    'id-b': { slug: 'b', type: 'resource', rkey: 'id-b', atUri: `at://${DID}/${RES}/id-b`, cid: 'cid-b', hash: first.create[1].hash, publishedAt: 't' } } };
  const second = planPublish({ items: [a, item('b', { url: 'https://changed.example/b' })], manifest, did: DID, authority: AUTH });
  assert.deepEqual(second.skip, ['id-a']); assert.equal(second.update.length, 1); assert.equal(second.update[0].swapRecord, 'cid-b');
  const third = planPublish({ items: [a], manifest, did: DID, authority: AUTH });
  assert.equal(third.delete.length, 1); assert.equal(third.delete[0].rkey, 'id-b');
});

test('source-system card: NSID from schema, not from object.type', () => {
  const card = item('blog', { type: 'blog', steward: 's', return_path: 'r' }, 'source-system');
  const p = planPublish({ items: [card], manifest: empty, did: DID, authority: AUTH });
  assert.equal(p.ok, true, JSON.stringify(p.errors));
  assert.equal(p.create[0].collection, `${AUTH}.sourceSystem`);
  assert.equal(p.create[0].record.type, 'blog');
});

test('refs rewritten against the manifest; validation is all-or-nothing', () => {
  const manifest = { version: 1, objects: { 'id-c': { slug: 'c', type: 'concept-lineage', atUri: `at://${DID}/x/id-c`, rkey: 'id-c', cid: 'x', hash: 'h', publishedAt: 't' } } };
  const p = planPublish({ items: [item('a', { related_concepts: ['c', 'zzz'] })], manifest, did: DID, authority: AUTH });
  assert.deepEqual(p.create[0].record.related_concepts, [`at://${DID}/x/id-c`, 'zzz']);
  const bad = planPublish({ items: [item('a', { provenance: { score: 0.1 } }), item('b')], manifest: empty, did: DID, authority: AUTH });
  assert.equal(bad.ok, false); assert.equal(bad.create.length, 0); assert.match(bad.errors[0].errors[0], /float/);
});

test('applyPublish: per-op calls, per-record failures, new manifest', async () => {
  const calls = [];
  const client = {
    async putRecord(op) { calls.push(['put', op.rkey]); if (op.rkey === 'id-b') throw new XrpcError(400, 'InvalidSwap', 'modified'); return { uri: `at://${DID}/${op.collection}/${op.rkey}`, cid: `cid-${op.rkey}` }; },
    async deleteRecord(op) { calls.push(['del', op.rkey]); },
  };
  const prev = { version: 1, objects: { 'id-z': { slug: 'z', type: 'resource', rkey: 'id-z', atUri: 'u', cid: 'c', hash: 'h', publishedAt: 't' } } };
  const plan = planPublish({ items: [item('a'), item('b')], manifest: prev, did: DID, authority: AUTH });
  const out = await applyPublish(plan, { client, did: DID, now: () => 'NOW' });
  assert.deepEqual(calls, [['put', 'id-a'], ['put', 'id-b'], ['del', 'id-z']]);
  assert.equal(out.applied.created, 1); assert.equal(out.applied.deleted, 1);
  assert.equal(out.failures[0].id, 'id-b');
  assert.equal(out.manifest.objects['id-a'].cid, 'cid-id-a'); assert.equal(out.manifest.objects['id-a'].publishedAt, 'NOW');
  assert.equal(out.manifest.objects['id-b'], undefined); assert.equal(out.manifest.objects['id-z'], undefined);
  assert.equal(prev.objects['id-z'].slug, 'z', 'input not mutated');
});

test('contentHash stable across key order', () => {
  assert.equal(contentHash({ a: 1, b: [1, { c: 2, d: 3 }] }), contentHash({ b: [1, { d: 3, c: 2 }], a: 1 }));
});
