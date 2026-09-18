// scripts/generate-kb-viz.test.mjs
// TDD for scripts/generate-kb-viz.mjs — corpus loaders, schema-graph builder,
// edge derivation, and Obsidian stub rendering.
// Run: node --test scripts/generate-kb-viz.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  TYPE_ORDER,
  loadArticlesCorpus,
  loadHandoffCorpus,
  buildSchemaGraph,
  deriveEdges,
  pickDescription,
  buildStub,
  findAmbiguousIds,
  hubMemberLine,
  IDENTITY_FIELDS,
  stripIdentityFields,
} from './generate-kb-viz.mjs';

function fixtureArticlesDir() {
  const dir = mkdtempSync(join(tmpdir(), 'kbviz-articles-'));
  writeFileSync(join(dir, 'resource.yaml'), [
    'entries:',
    '  res-one:',
    '    title: Resource One',
    '    maturity: raw',
    '    ai_assisted: true',
    '    sourced_from: sys-a',
    '  res-two:',
    '    title: Resource Two',
    '    maturity: reviewed',
    '    related:',
    '      - res-one',
    '      - not-a-known-id',
  ].join('\n'));
  writeFileSync(join(dir, 'source-system.yaml'), [
    'entries:',
    '  sys-a:',
    '    title: System A',
    '    maturity: reviewed',
  ].join('\n'));
  // Manifest files must be skipped.
  writeFileSync(join(dir, '_slice-manifest.yaml'), 'anything: true');
  return dir;
}

function fixtureHandoffDir() {
  const dir = mkdtempSync(join(tmpdir(), 'kbviz-handoff-'));
  mkdirSync(join(dir, 'concept-lineage'), { recursive: true });
  writeFileSync(join(dir, 'concept-lineage', 'care-web.yaml'), [
    'title: Care web',
    'type: concept-lineage',
    'maturity: raw',
    'ai_assisted: true',
    'short_description: A short description.',
    'related_to: res-one',
  ].join('\n'));
  return dir;
}

test('loadArticlesCorpus reads entries keyed by id, skips _manifests', () => {
  const objs = loadArticlesCorpus(fixtureArticlesDir());
  assert.equal(objs.length, 3);
  const one = objs.find((o) => o.id === 'res-one');
  assert.equal(one.type, 'resource');
  assert.equal(one.corpus, 'articles');
  assert.equal(one.data.title, 'Resource One');
  assert.ok(!objs.some((o) => o.id === 'anything'));
});

test('loadHandoffCorpus reads one object per file, type from dir name', () => {
  const objs = loadHandoffCorpus(fixtureHandoffDir());
  assert.equal(objs.length, 1);
  assert.deepEqual(
    [objs[0].id, objs[0].type, objs[0].corpus],
    ['care-web', 'concept-lineage', 'handoff']
  );
});

test('loaders return [] when the directory is missing (main-branch case)', () => {
  assert.deepEqual(loadArticlesCorpus('/nonexistent/kbviz'), []);
  assert.deepEqual(loadHandoffCorpus('/nonexistent/kbviz'), []);
});

test('buildSchemaGraph counts totals/raw/reviewed/byCorpus, ordered by TYPE_ORDER', () => {
  const objs = [
    ...loadArticlesCorpus(fixtureArticlesDir()),
    ...loadHandoffCorpus(fixtureHandoffDir()),
  ];
  const { nodes } = buildSchemaGraph(objs);
  assert.deepEqual(nodes.map((n) => n.type), ['resource', 'source-system', 'concept-lineage']);
  const res = nodes[0];
  assert.equal(res.total, 2);
  assert.equal(res.raw, 1);
  assert.equal(res.reviewed, 1);
  assert.deepEqual(res.byCorpus, { articles: 2, handoff: 0 });
});

test('buildSchemaGraph does not count maturity-unset objects as raw (they are unspecified)', () => {
  const objs = [
    { id: 'a', type: 'resource', corpus: 'articles', data: { maturity: 'raw' } },
    { id: 'b', type: 'resource', corpus: 'articles', data: {} },            // no maturity field
    { id: 'c', type: 'resource', corpus: 'articles', data: { maturity: 'candidate' } },
  ];
  const { nodes } = buildSchemaGraph(objs);
  const res = nodes[0];
  assert.equal(res.total, 3);
  assert.equal(res.raw, 1);          // only the explicit-raw one
  assert.equal(res.reviewed, 0);
  assert.equal(res.unspecified, 1);  // the field-less one is unspecified, NOT raw
});

test('deriveEdges finds exact-ID references in strings and arrays, aggregated to type level', () => {
  const objs = [
    ...loadArticlesCorpus(fixtureArticlesDir()),
    ...loadHandoffCorpus(fixtureHandoffDir()),
  ];
  const edges = deriveEdges(objs);
  // res-one --sourced_from--> sys-a
  assert.ok(edges.some((e) =>
    e.from === 'resource' && e.to === 'source-system' && e.label === 'sourced_from' && e.count === 1));
  // res-two --related--> res-one (same-type edge is kept in data; page filters it)
  assert.ok(edges.some((e) =>
    e.from === 'resource' && e.to === 'resource' && e.label === 'related' && e.count === 1));
  // care-web --related_to--> res-one
  assert.ok(edges.some((e) =>
    e.from === 'concept-lineage' && e.to === 'resource' && e.label === 'related_to'));
  // Unknown strings never become edges.
  assert.ok(!edges.some((e) => e.label === 'title'));
});

test('deriveEdges ignores self-references (an object citing its own id)', () => {
  const objs = [
    { id: 'a', type: 'resource', corpus: 'articles', data: { self: 'a' } },
    { id: 'b', type: 'resource', corpus: 'articles', data: {} },
  ];
  assert.deepEqual(deriveEdges(objs), []);
});

test('buildSchemaGraph output is deterministic regardless of input order', () => {
  const objs = [
    ...loadArticlesCorpus(fixtureArticlesDir()),
    ...loadHandoffCorpus(fixtureHandoffDir()),
  ];
  const a = JSON.stringify(buildSchemaGraph(objs));
  const b = JSON.stringify(buildSchemaGraph([...objs].reverse()));
  assert.equal(a, b);
});

test('pickDescription prefers short_description, falls back through the chain', () => {
  assert.equal(pickDescription({ short_description: 'S', notes: 'N' }), 'S');
  assert.equal(pickDescription({ what_it_curates: 'W' }), 'W');
  assert.equal(pickDescription({}), '');
});

test('buildStub renders frontmatter, hub wikilink, related links, source path', () => {
  const objs = [
    ...loadArticlesCorpus(fixtureArticlesDir()),
    ...loadHandoffCorpus(fixtureHandoffDir()),
  ];
  const idToType = new Map(objs.map((o) => [o.id, o.type]));
  const careWeb = objs.find((o) => o.id === 'care-web');
  const stub = buildStub(careWeb, idToType);
  assert.match(stub, /^---\n/);
  assert.match(stub, /kb_type: concept-lineage/);
  assert.match(stub, /corpus: handoff/);
  assert.match(stub, /# Care web/);
  assert.match(stub, /A short description\./);
  assert.match(stub, /\[\[kb-hub-concept-lineage\]\]/);
  assert.match(stub, /\[\[res-one\]\]/);
  assert.match(stub, /kb-handoff\/objects\/concept-lineage\/care-web\.yaml/);

  const resOne = objs.find((o) => o.id === 'res-one');
  const stub2 = buildStub(resOne, idToType);
  assert.match(stub2, /data\/kb\/resource\.yaml#res-one/);
});

test('findAmbiguousIds finds an id present under two different types', () => {
  const objs = [
    { id: 'dup', type: 'resource', corpus: 'articles', data: {} },
    { id: 'dup', type: 'concept-lineage', corpus: 'handoff', data: {} },
    { id: 'unique', type: 'resource', corpus: 'articles', data: {} },
  ];
  const ambiguous = findAmbiguousIds(objs);
  assert.ok(ambiguous instanceof Set);
  assert.ok(ambiguous.has('dup'));
  assert.ok(!ambiguous.has('unique'));
});

test('findAmbiguousIds does not flag an id repeated within the same type', () => {
  // Same id + same type is not ambiguous (e.g. duplicate load isn't the concern here).
  const objs = [
    { id: 'same-type-dup', type: 'resource', corpus: 'articles', data: {} },
    { id: 'same-type-dup', type: 'resource', corpus: 'handoff', data: {} },
  ];
  assert.ok(!findAmbiguousIds(objs).has('same-type-dup'));
});

test('deriveEdges emits no edge for a reference to an ambiguous id', () => {
  const objs = [
    { id: 'dup', type: 'resource', corpus: 'articles', data: {} },
    { id: 'dup', type: 'concept-lineage', corpus: 'handoff', data: {} },
    { id: 'referrer', type: 'source-system', corpus: 'articles', data: { related: 'dup' } },
  ];
  const ambiguous = findAmbiguousIds(objs);
  const edges = deriveEdges(objs, ambiguous);
  assert.ok(!edges.some((e) => e.label === 'related'));
});

test('buildStub omits ambiguous ids from Related', () => {
  const objs = [
    { id: 'dup', type: 'resource', corpus: 'articles', data: {} },
    { id: 'dup', type: 'concept-lineage', corpus: 'handoff', data: {} },
    { id: 'referrer', type: 'source-system', corpus: 'articles', data: { title: 'Referrer', related: 'dup' } },
  ];
  const idToType = new Map(objs.map((o) => [o.id, o.type]));
  const ambiguous = findAmbiguousIds(objs);
  const referrer = objs.find((o) => o.id === 'referrer');
  const stub = buildStub(referrer, idToType, ambiguous);
  assert.ok(!stub.includes('Related:'));
  assert.ok(!/\[\[dup\]\]/.test(stub));
});

test('hubMemberLine path-qualifies the wikilink so ambiguous ids resolve per type', () => {
  // Bare [[giveth|…]] in two hubs would resolve to ONE file in Obsidian;
  // the link target must be <type>/<id> — always, not just for ambiguous ids.
  const plain = { id: 'res-one', type: 'resource', corpus: 'articles', data: { title: 'Resource One' } };
  assert.equal(hubMemberLine('resource', plain), '- [[resource/res-one|Resource One]]');

  // Ambiguous id: same id under two types → two distinct, correctly-typed targets.
  const asResource = { id: 'giveth', type: 'resource', corpus: 'articles', data: { title: 'Giveth' } };
  const asSource = { id: 'giveth', type: 'source-system', corpus: 'handoff', data: { title: 'Giveth' } };
  assert.equal(hubMemberLine('resource', asResource), '- [[resource/giveth|Giveth]]');
  assert.equal(hubMemberLine('source-system', asSource), '- [[source-system/giveth|Giveth]]');

  // No title → id as the display text; pipe/bracket chars stripped from titles.
  assert.equal(hubMemberLine('resource', { id: 'x', data: {} }), '- [[resource/x|x]]');
  assert.equal(
    hubMemberLine('resource', { id: 'y', data: { title: 'A|B [C]' } }),
    '- [[resource/y|A B  C]]'
  );
});

// --- Identity/provenance fields (framework schema Task 2): never references ---

// Values deliberately equal another object's id, so a walker that read them
// as references would emit an edge/link.
const identityData = (extra = {}) => ({
  id: 'res-one', grc20Id: 'res-one', sourceUri: 'res-one', viaUri: 'res-one', ...extra,
});

test('IDENTITY_FIELDS is the four framework identity/provenance keys', () => {
  assert.deepEqual([...IDENTITY_FIELDS].sort(), ['grc20Id', 'id', 'sourceUri', 'viaUri']);
});

test('stripIdentityFields drops only the four top-level keys and does not mutate', () => {
  const data = identityData({ title: 'T', nested: { id: 'keep-me' } });
  const stripped = stripIdentityFields(data);
  assert.deepEqual(stripped, { title: 'T', nested: { id: 'keep-me' } });
  assert.equal(data.id, 'res-one'); // input untouched
  assert.deepEqual(stripIdentityFields(undefined), undefined);
});

test('deriveEdges ignores identity fields but still derives edges from ordinary reference fields', () => {
  const objs = [
    { id: 'res-one', type: 'resource', corpus: 'articles', data: {} },
    { id: 'src', type: 'source-system', corpus: 'articles', data: identityData({ related: 'res-one' }) },
  ];
  assert.deepEqual(deriveEdges(objs), [
    { from: 'source-system', to: 'resource', label: 'related', count: 1 },
  ]);
});

test('buildSchemaGraph output is identical with or without identity fields', () => {
  const plain = [
    { id: 'res-one', type: 'resource', corpus: 'articles', data: { maturity: 'raw' } },
    { id: 'src', type: 'source-system', corpus: 'articles', data: { maturity: 'reviewed', related: 'res-one' } },
  ];
  const withIds = plain.map((o) => ({ ...o, data: { ...o.data, ...identityData() } }));
  assert.equal(JSON.stringify(buildSchemaGraph(withIds)), JSON.stringify(buildSchemaGraph(plain)));
});

test('buildStub does not list identity-field values as Related', () => {
  const objs = [
    { id: 'res-one', type: 'resource', corpus: 'articles', data: {} },
    { id: 'src', type: 'source-system', corpus: 'articles', data: identityData({ title: 'Src' }) },
  ];
  const idToType = new Map(objs.map((o) => [o.id, o.type]));
  assert.ok(!buildStub(objs[1], idToType).includes('Related:'));
});
