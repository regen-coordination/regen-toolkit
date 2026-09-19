import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nsidFor, typeForNsid, flattenSchema, generateLexicon, generateAll, validateRecord, toRecord } from '../src/lexicon.mjs';
import { ALL_TYPES } from '../src/publishable.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const AUTH = 'xyz.regencoordination.kb';

test('nsidFor camel-cases the schema under the authority; typeForNsid inverts it over ALL_TYPES', () => {
  assert.equal(nsidFor('resource', AUTH), 'xyz.regencoordination.kb.resource');
  assert.equal(nsidFor('claim-evidence', AUTH), 'xyz.regencoordination.kb.claimEvidence');
  assert.equal(typeForNsid('xyz.regencoordination.kb.claimEvidence', AUTH), 'claim-evidence');
  assert.equal(typeForNsid('xyz.regencoordination.kb.sourceSystem', AUTH), 'source-system');
  assert.equal(typeForNsid('xyz.regencoordination.kb.person', AUTH), null);
  assert.equal(typeForNsid('com.example.other', AUTH), null);
});

test('flattenSchema resolves extends', () => {
  const f = flattenSchema('resource');
  assert.ok(f.fields.title && f.fields.url && f.fields.id);
  assert.deepEqual(f.required, ['title', 'type']);
  assert.ok(flattenSchema('public-use-boundary').fields.tier, 'boundary schema stands alone');
});

test('generateLexicon maps yaml defs to Lexicon properties', () => {
  const doc = generateLexicon('resource', { authority: AUTH });
  assert.equal(doc.lexicon, 1);
  assert.equal(doc.id, 'xyz.regencoordination.kb.resource');
  const main = doc.defs.main;
  assert.equal(main.type, 'record');
  assert.equal(main.key, 'any');
  const p = main.record.properties;
  assert.deepEqual(p.title, { type: 'string' });
  assert.deepEqual(p.is_source_system_candidate, { type: 'boolean' });
  assert.deepEqual(p.related_concepts, { type: 'array', items: { type: 'string' } });
  assert.ok(p.link_status.knownValues.includes('active'));
  assert.ok(p.maturity.knownValues.includes('pattern-generating'));
  assert.deepEqual(main.record.required, ['title', 'type']);
});

test('generateAll yields one doc per ALL_TYPES entry (12)', () => {
  assert.equal(Object.keys(generateAll({ authority: AUTH })).length, ALL_TYPES.length);
});

test('committed lexicons/ match a fresh generation (drift test)', () => {
  const dir = join(here, '..', 'lexicons');
  const all = generateAll({ authority: AUTH });
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  assert.deepEqual(files, Object.keys(all).sort().map((n) => `${n}.json`));
  for (const [nsid, doc] of Object.entries(all)) {
    assert.deepEqual(JSON.parse(readFileSync(join(dir, `${nsid}.json`), 'utf8')), doc, `lexicons/${nsid}.json is stale — npm run gen:lexicons`);
  }
});

test('validateRecord: required, types, no floats, size, $type; unknown fields allowed', () => {
  const doc = generateLexicon('resource', { authority: AUTH });
  const good = toRecord({ title: 'A', type: 'resource', related_concepts: ['x'], extra_unknown: 2020 }, doc.id);
  assert.equal(good.$type, doc.id);
  assert.deepEqual(validateRecord(good, doc), { ok: true, errors: [] });
  assert.match(validateRecord({ $type: doc.id, type: 'resource' }, doc).errors[0], /missing required field: title/);
  assert.match(validateRecord({ $type: doc.id, title: 'A', type: 'resource', related_concepts: 'nope' }, doc).errors[0], /related_concepts must be an array/);
  assert.match(validateRecord({ $type: doc.id, title: 'A', type: 'resource', provenance: { score: 0.5 } }, doc).errors[0], /float at provenance\.score/);
  assert.match(validateRecord({ $type: 'wrong', title: 'A', type: 'resource' }, doc).errors[0], /\$type/);
  assert.match(validateRecord({ $type: doc.id, title: 'A', type: 'resource', notes: 'x'.repeat(1_000_001) }, doc).errors[0], /exceeds 1 MB/);
});

test('toRecord strips undefined and null, keeps nested objects', () => {
  assert.deepEqual(toRecord({ title: 'A', type: 'resource', notes: undefined, url: null, provenance: { origin: 'o' } }, 'x.y.z'),
    { $type: 'x.y.z', title: 'A', type: 'resource', provenance: { origin: 'o' } });
});

test('toRecord applies publicView, strips undefined/null, keeps nested objects', () => {
  const r = toRecord({ title: 'A', type: 'resource', notes: 'x', work_order: 'w', url: null, provenance: { origin: 'o', surfaced_by: 's' } }, 'x.y.z');
  assert.deepEqual(r, { $type: 'x.y.z', title: 'A', type: 'resource', provenance: { origin: 'o' } });
});
