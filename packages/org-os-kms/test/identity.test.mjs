// packages/org-os-kms/test/identity.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { ensureIds, assertRkey } from '../src/identity.mjs';
import { getAdapter } from '../src/framework.mjs';

function instance() {
  const dir = mkdtempSync(join(tmpdir(), 'kms-id-'));
  mkdirSync(join(dir, 'data', 'kb'), { recursive: true });
  writeFileSync(join(dir, 'data', 'kb', 'resource.yaml'), yaml.dump({ entries: {
    pub: { title: 'Pub', type: 'resource', public_use: 'ok-with-caveat' },
    internal: { title: 'Internal', type: 'resource', public_use: 'internal-only' },
    haveid: { title: 'Have', type: 'resource', public_use: 'ok-with-caveat', id: 'existing-id', grc20Id: 'existing-geo' },
  } }));
  return dir;
}
const selected = (dir) => getAdapter('repo-data').list(dir).filter(({ object }) => object.public_use === 'ok-with-caveat');

test('mints id only for the given items lacking it (grc20Id not minted without mintGeo); writes back', () => {
  const dir = instance();
  let n = 0; const uuid = () => `uuid-${++n}`;
  const { minted, items } = ensureIds({ adapter: 'repo-data', target: dir, items: selected(dir), uuid });
  assert.equal(minted.length, 1);
  assert.equal(minted[0].id, 'uuid-1'); assert.equal(minted[0].grc20Id, undefined);
  const disk = yaml.load(readFileSync(join(dir, 'data', 'kb', 'resource.yaml'), 'utf8')).entries;
  assert.equal(disk.pub.id, 'uuid-1'); assert.equal(disk.pub.grc20Id, undefined);
  assert.equal(disk.internal.id, undefined, 'not selected → untouched');
  assert.equal(disk.haveid.id, 'existing-id');
  assert.equal(items.length, 2);
  for (const it of items) assert.ok(it.object.id);
});

test('write:false mints in memory only', () => {
  const dir = instance();
  const { minted, items } = ensureIds({ adapter: 'repo-data', target: dir, items: selected(dir), write: false });
  assert.equal(minted.length, 1);
  assert.ok(items.find((i) => i.object.title === 'Pub').object.id);
  const disk = yaml.load(readFileSync(join(dir, 'data', 'kb', 'resource.yaml'), 'utf8')).entries;
  assert.equal(disk.pub.id, undefined);
});

test('idempotent', () => {
  const dir = instance();
  ensureIds({ adapter: 'repo-data', target: dir, items: selected(dir) });
  assert.equal(ensureIds({ adapter: 'repo-data', target: dir, items: selected(dir) }).minted.length, 0);
});

test('assertRkey enforces the AT Proto rkey charset', () => {
  assertRkey('550e8400-e29b-41d4-a716-446655440000');
  assert.throws(() => assertRkey('has space'), /rkey/);
  assert.throws(() => assertRkey(''), /rkey/);
});

test('grc20Id only when mintGeo', () => {
  const dir = instance();
  const a = ensureIds({ adapter: 'repo-data', target: dir, items: selected(dir), uuid: () => 'u' });
  assert.equal(a.items.find((i) => i.object.title === 'Pub').object.grc20Id, undefined);
  const b = ensureIds({ adapter: 'repo-data', target: dir, items: selected(dir), uuid: () => 'g', mintGeo: true });
  assert.equal(b.items.find((i) => i.object.title === 'Pub').object.grc20Id, 'g');
});
