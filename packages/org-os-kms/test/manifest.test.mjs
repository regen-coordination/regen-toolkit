import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readManifest, writeManifest, slugIndex, slugFromRef, MANIFEST_PATH } from '../src/manifest.mjs';

test('readManifest empty when absent; write/read round-trips', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kms-manifest-'));
  assert.deepEqual(readManifest(dir), { version: 1, objects: {} });
  const m = { version: 1, objects: { 'id-1': { slug: 'a', type: 'resource', rkey: 'id-1', atUri: 'at://did/x/id-1', cid: 'c', hash: 'h', publishedAt: 't' } } };
  const p = writeManifest(dir, m);
  assert.equal(p, join(dir, MANIFEST_PATH));
  assert.ok(existsSync(p));
  assert.deepEqual(readManifest(dir), m);
});

test('slugIndex groups by slug; slugFromRef reads the adapter key', () => {
  const ix = slugIndex({ version: 1, objects: { a: { slug: 's' }, b: { slug: 's' }, c: { slug: 't' } } });
  assert.equal(ix.get('s').length, 2);
  assert.equal(slugFromRef('data/kb/resource.yaml#1hive'), '1hive');
  assert.equal(slugFromRef('/x/kb/resource/some-slug.yaml'), 'some-slug');
});
