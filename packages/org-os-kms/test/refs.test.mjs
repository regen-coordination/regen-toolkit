import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteRefs, resolverFrom } from '../src/refs.mjs';

const manifest = { version: 1, objects: {
  i1: { slug: 'decentralization', type: 'concept-lineage', atUri: 'at://did:plc:me/x.kb.conceptLineage/i1' },
  i2: { slug: 'dup', type: 'resource', atUri: 'at://did:plc:me/x.kb.resource/i2' },
  i3: { slug: 'dup', type: 'concept-lineage', atUri: 'at://did:plc:me/x.kb.conceptLineage/i3' },
} };

test('resolverFrom: unique → uri; ambiguous or unknown → null', () => {
  const r = resolverFrom(manifest);
  assert.equal(r('decentralization'), 'at://did:plc:me/x.kb.conceptLineage/i1');
  assert.equal(r('dup'), null); assert.equal(r('nope'), null);
});

test('array fields rewritten where resolvable; non-mutating', () => {
  const src = { title: 'A', related_concepts: ['decentralization', 'nope', 'dup'] };
  const out = rewriteRefs(src, resolverFrom(manifest), 'resource');
  assert.deepEqual(out.related_concepts, ['at://did:plc:me/x.kb.conceptLineage/i1', 'nope', 'dup']);
  assert.equal(src.related_concepts[0], 'decentralization');
});

test('relationship-record subject/object strings; already-at:// untouched', () => {
  const out = rewriteRefs({ subject: 'decentralization', predicate: 'related_to', object: 'nope' }, resolverFrom(manifest), 'relationship-record');
  assert.equal(out.subject, 'at://did:plc:me/x.kb.conceptLineage/i1'); assert.equal(out.object, 'nope');
  const keep = rewriteRefs({ related_concepts: ['at://did:plc:x/c/1'] }, () => 'at://never', 'resource');
  assert.deepEqual(keep.related_concepts, ['at://did:plc:x/c/1']);
});
