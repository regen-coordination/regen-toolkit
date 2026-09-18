// scripts/gen-kb-content.test.mjs
// TDD for scripts/gen-kb-content.mjs — layer stamping, object-link derivation,
// and the snapshot shape the /kb/ pages consume.
// Run: node --test scripts/gen-kb-content.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LAYER_MAP, LAYERS, withLayer, deriveObjectLinks, buildSnapshot } from './gen-kb-content.mjs';

const obj = (corpus, type, id, data = {}) => ({ corpus, type, id, data });

test('LAYER_MAP covers every type present in both corpora today', () => {
  const present = [
    'claim-evidence', 'concept-lineage', 'encyclopedia-entry', 'public-use-boundary',
    'resource', 'signal', 'source-system', 'track',
    'implementation-record', 'option-entry',
  ];
  for (const t of present) {
    assert.ok(Number.isInteger(LAYER_MAP[t]), `missing layer for type: ${t}`);
    assert.ok(LAYERS[LAYER_MAP[t]], `layer ${LAYER_MAP[t]} has no name`);
  }
});

test('withLayer stamps the mapped layer, and null for unknown types', () => {
  assert.equal(withLayer(obj('articles', 'encyclopedia-entry', 'x')).layer, 2);
  assert.equal(withLayer(obj('handoff', 'option-entry', 'x')).layer, 5);
  assert.equal(withLayer(obj('articles', 'mystery-type', 'x')).layer, null);
});

test('deriveObjectLinks finds exact-id references, labels the field, skips self', () => {
  const a = obj('articles', 'concept-lineage', 'decentralization');
  const b = obj('articles', 'encyclopedia-entry', 'what-is-decentralization', {
    related_concepts: ['decentralization', 'not-a-known-id'],
    provenance: { origin: 'src/content/docs/what-is-decentralization.md' },
  });
  const linked = deriveObjectLinks([a, b]);
  const entry = linked.find((o) => o.id === 'what-is-decentralization');
  assert.deepEqual(entry.links, [
    { field: 'related_concepts', corpus: 'articles', type: 'concept-lineage', id: 'decentralization' },
  ]);
  // the concept has no outbound refs
  assert.deepEqual(linked.find((o) => o.id === 'decentralization').links, []);
});

test('deriveObjectLinks links one id across corpora (both targets), deduped per field', () => {
  const r1 = obj('articles', 'resource', 'giveconomy');
  const r2 = obj('handoff', 'resource', 'giveconomy');
  const s = obj('articles', 'signal', 'sig-1', { related: ['giveconomy', 'giveconomy'] });
  const linked = deriveObjectLinks([r1, r2, s]);
  const sig = linked.find((o) => o.id === 'sig-1');
  assert.equal(sig.links.length, 2); // one per target, duplicate value deduped
  assert.deepEqual(new Set(sig.links.map((l) => l.corpus)), new Set(['articles', 'handoff']));
});

test('buildSnapshot counts by corpus, type, layer, maturity — and keeps objects', () => {
  const objects = [
    withLayer(obj('articles', 'encyclopedia-entry', 'e1', { maturity: 'raw' })),
    withLayer(obj('articles', 'resource', 'r1', { maturity: 'reviewed' })),
    withLayer(obj('handoff', 'resource', 'r2', {})), // no maturity → counted as raw
  ].map((o) => ({ ...o, links: [] }));
  const snap = buildSnapshot(objects);
  assert.equal(snap.total, 3);
  assert.deepEqual(snap.by_corpus, { articles: 2, handoff: 1 });
  assert.deepEqual(snap.by_type, { 'encyclopedia-entry': 1, resource: 2 });
  assert.deepEqual(snap.by_layer, { 2: 1, 3: 2 });
  assert.deepEqual(snap.by_maturity, { raw: 2, reviewed: 1 });
  assert.equal(snap.objects.length, 3);
  assert.ok(snap.layers[3].includes('Resource Graph'));
});

// --- Identity/provenance fields (framework schema Task 2): never references, never rendered ---

const identityData = (extra = {}) => ({
  id: 'decentralization', grc20Id: 'decentralization',
  sourceUri: 'decentralization', viaUri: 'decentralization', ...extra,
});

test('deriveObjectLinks ignores identity fields but still links ordinary reference fields', () => {
  const target = obj('articles', 'concept-lineage', 'decentralization');
  const carrier = obj('articles', 'encyclopedia-entry', 'e1', identityData({ related_concepts: ['decentralization'] }));
  const entry = deriveObjectLinks([target, carrier]).find((o) => o.id === 'e1');
  assert.deepEqual(entry.links, [
    { field: 'related_concepts', corpus: 'articles', type: 'concept-lineage', id: 'decentralization' },
  ]);

  const onlyIdentity = obj('articles', 'encyclopedia-entry', 'e2', identityData());
  assert.deepEqual(deriveObjectLinks([target, onlyIdentity]).find((o) => o.id === 'e2').links, []);
});

test('buildSnapshot strips identity fields from serialized data, keeps the rest, does not mutate', () => {
  const carrier = { ...obj('articles', 'encyclopedia-entry', 'e1', identityData({ title: 'E1', maturity: 'raw' })), links: [] };
  const snap = buildSnapshot([carrier]);
  assert.deepEqual(snap.objects[0].data, { title: 'E1', maturity: 'raw' });
  assert.equal(carrier.data.id, 'decentralization'); // caller's object untouched
  assert.equal(snap.by_maturity.raw, 1);
});

test('snapshot with identity fields is identical to one without, except the removed keys', () => {
  const build = (withIds) => {
    const ids = withIds ? identityData() : {};
    const objects = [
      obj('articles', 'concept-lineage', 'decentralization', { title: 'D', ...ids }),
      obj('articles', 'encyclopedia-entry', 'e1', { title: 'E', maturity: 'raw', related_concepts: ['decentralization'], ...ids }),
    ].map(withLayer);
    return JSON.stringify(buildSnapshot(deriveObjectLinks(objects)));
  };
  assert.equal(build(true), build(false));
});
