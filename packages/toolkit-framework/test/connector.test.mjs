// test/connector.test.mjs — seam 3: runConnector (describe -> pull -> map -> validate -> upsert/store -> card -> retract).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { runConnector, NOT_IMPLEMENTED } from '../src/connector.mjs';
import { getAdapter } from '../src/storage.mjs';
import { checkInvariants } from '../src/index.mjs';

function instance() {
  const dir = mkdtempSync(join(tmpdir(), 'fw-conn-'));
  mkdirSync(join(dir, 'data', 'kb'), { recursive: true });
  writeFileSync(join(dir, 'data', 'kb', 'resource.yaml'), yaml.dump({ entries: {
    old: { title: 'Old', type: 'resource', sourceUri: 'at://peer/x/old', maturity: 'reviewed', public_use: 'ok-with-caveat', id: 'local-id', notes: 'v1' } } }));
  writeFileSync(join(dir, 'data', 'kb', 'source-system.yaml'), yaml.dump({ entries: {} }));
  return dir;
}
const fake = (over = {}) => ({
  name: 'fake', protocol: 'test', capabilities: { ingest: true, subscribe: false, publish: false },
  describe: (cfg) => ({ title: 'Fake', type: 'dataset', steward: 'test', return_path: cfg.endpoint }),
  pull: async (cfg, { cursor }) => ({ records: [{ id: 'r1', name: 'One' }], cursor: (cursor || 0) + 1 }),
  map: (r) => [{ schema: 'resource', object: { title: r.name, type: 'resource', maturity: 'reviewed', public_use: 'ok-with-caveat' } }],
  ...over,
});
const ctx = (dir) => ({ config: { endpoint: 'https://f' }, cursor: null, adapter: 'repo-data', target: dir });
const resources = (dir) => getAdapter('repo-data').list(dir).filter(({ schema }) => schema === 'resource');

test('describe → pull → map → store; forces raw + not-public-yet', async () => {
  const dir = instance();
  const out = await runConnector(fake(), ctx(dir));
  assert.equal(out.source.title, 'Fake'); assert.equal(out.pulled, 1); assert.equal(out.stored, 1); assert.equal(out.cursor, 1);
  const stored = resources(dir).find(({ object }) => object.title === 'One').object;
  assert.equal(stored.maturity, 'raw'); assert.equal(stored.public_use, 'not-public-yet'); assert.equal(stored.ai_assisted, true);
  assert.ok(stored.provenance?.origin);
  assert.match(stored.work_order, /^connector:fake:/);
  assert.equal(stored.source_lineage, 'https://f');
});

test('upsert by sourceUri keeps local id, maturity, public_use; flags review', async () => {
  const dir = instance();
  const c = fake({ map: () => [{ schema: 'resource', object: { title: 'Old', type: 'resource', sourceUri: 'at://peer/x/old', notes: 'v2', id: 'peer-id' } }] });
  const out = await runConnector(c, ctx(dir));
  assert.equal(out.updated, 1); assert.equal(out.stored, 0);
  const all = resources(dir);
  assert.equal(all.length, 1, 'no duplicate');
  const o = all[0].object;
  assert.equal(o.notes, 'v2'); assert.equal(o.id, 'local-id'); assert.equal(o.maturity, 'reviewed'); assert.equal(o.public_use, 'ok-with-caveat');
  assert.match(o.review_needs, /updated at origin/);
});

test('map [] fine; NOT_IMPLEMENTED propagates; pull errors surface', async () => {
  const dir = instance();
  assert.equal((await runConnector(fake({ map: () => [] }), ctx(dir))).stored, 0);
  await assert.rejects(runConnector(fake({ pull: async () => { throw new NOT_IMPLEMENTED('fake'); } }), ctx(dir)), (e) => e.code === 'NOT_IMPLEMENTED');
  const withErr = await runConnector(fake({ pull: async () => ({ records: [], cursor: 1, errors: [{ did: 'x', error: 'down' }] }) }), ctx(dir));
  assert.equal(withErr.errors.length, 1);
});

test('retracted sourceUris are held, never deleted', async () => {
  const dir = instance();
  const out = await runConnector(fake({ pull: async () => ({ records: [], cursor: 1, retracted: ['at://peer/x/old'] }) }), ctx(dir));
  assert.equal(out.retractions, 1);
  const old = resources(dir).find(({ object }) => object.title === 'Old').object;
  assert.equal(old.maturity, 'held'); assert.match(old.review_needs, /retracted at origin at:\/\/peer\/x\/old/);
});

test('invalid candidates are reported, not stored; ai_assisted preserved or defaulted true; work_order + source_lineage stamped', async () => {
  const dir = instance();
  const c = fake({ map: (r) => [
    { schema: 'resource', object: { title: 'Good', type: 'resource', ai_assisted: false, sourceUri: 'at://p/x/1' } },
    { schema: 'resource', object: { type: 'resource' } },   // missing title
  ] });
  const out = await runConnector(c, ctx(dir));
  assert.equal(out.stored, 1); assert.equal(out.invalid.length, 1); assert.match(out.invalid[0].errors[0], /title/);
  const g = getAdapter('repo-data').list(dir).find(({ object }) => object.title === 'Good').object;
  assert.equal(g.ai_assisted, false); assert.match(g.work_order, /^connector:fake:/); assert.equal(g.source_lineage, 'at://p/x/1');
  // the title-less invalid object is not stored: only the pre-existing 'Old' + 'Good' remain
  assert.deepEqual(resources(dir).map(({ object }) => object.title).sort(), ['Good', 'Old']);
  assert.equal(resources(dir).filter(({ object }) => !object.title).length, 0);
});

test('describe() card is upserted as a source-system', async () => {
  const dir = instance();
  await runConnector(fake(), ctx(dir));
  const card = getAdapter('repo-data').list(dir).find(({ schema, object }) => schema === 'source-system' && object.title === 'Fake');
  assert.ok(card); assert.equal(card.object.public_use, 'internal-only');
  await runConnector(fake(), ctx(dir));
  assert.equal(getAdapter('repo-data').list(dir).filter(({ schema }) => schema === 'source-system').length, 1, 'idempotent');
});

test('dry: nothing stored, cursor unchanged', async () => {
  const dir = instance();
  const before = getAdapter('repo-data').list(dir).length;
  const out = await runConnector(fake(), { ...ctx(dir), cursor: 7, dry: true });
  assert.equal(out.dry, true); assert.equal(out.stored, 0); assert.equal(out.cursor, 7); assert.equal(out.candidates, 1);
  assert.equal(getAdapter('repo-data').list(dir).length, before);
});

// --- fix round 1: pulled candidates never clobber local data; upserts stay within invariants ---

const seed = (dir, entries) => writeFileSync(join(dir, 'data', 'kb', 'resource.yaml'), yaml.dump({ entries }));
const localOld = { title: 'Old', type: 'resource', maturity: 'reviewed', public_use: 'ok-with-caveat', id: 'local-id', notes: 'local-notes', ai_assisted: false };
const one = (object) => fake({ map: () => [{ schema: 'resource', object }] });

test('a new candidate whose slug matches a local entry never clobbers it; reported as a collision', async () => {
  const dir = instance(); seed(dir, { old: localOld });
  const out = await runConnector(one({ title: 'Old', type: 'resource', notes: 'from-origin' }), ctx(dir));
  assert.equal(out.collisions, 1); assert.equal(out.stored, 0); assert.equal(out.candidates, 0);
  assert.deepEqual(out.collided, [{ schema: 'resource', title: 'Old' }]);
  const all = resources(dir); assert.equal(all.length, 1);
  assert.deepEqual(all[0].object, localOld);
});

test('two same-title candidates in one batch: first stored, second collides', async () => {
  const dir = instance();
  const c = fake({ map: () => [
    { schema: 'resource', object: { title: 'Twin', type: 'resource', notes: 'first' } },
    { schema: 'resource', object: { title: 'Twin', type: 'resource', notes: 'second' } },
  ] });
  const out = await runConnector(c, ctx(dir));
  assert.equal(out.stored, 1); assert.equal(out.collisions, 1); assert.deepEqual(out.collided, [{ schema: 'resource', title: 'Twin' }]);
  const twins = resources(dir).filter(({ object }) => object.title === 'Twin');
  assert.equal(twins.length, 1); assert.equal(twins[0].object.notes, 'first');
});

test('dry previews collisions and stores nothing', async () => {
  const dir = instance(); seed(dir, { old: localOld });
  const out = await runConnector(one({ title: 'Old', type: 'resource' }), { ...ctx(dir), dry: true });
  assert.equal(out.dry, true); assert.equal(out.collisions, 1); assert.equal(out.collided.length, 1); assert.equal(out.stored, 0);
  assert.deepEqual(resources(dir).map(({ object }) => object), [localOld]);
  assert.equal(getAdapter('repo-data').list(dir).filter(({ schema }) => schema === 'source-system').length, 0);
});

test('two mapped objects sharing a sourceUri in one pull: only the last is applied', async () => {
  // no local match -> one stored entry (the last)
  const dir = instance();
  const c = fake({ map: () => [
    { schema: 'resource', object: { title: 'Dup', type: 'resource', sourceUri: 'at://p/x/dup', notes: 'v1' } },
    { schema: 'resource', object: { title: 'Dup Renamed', type: 'resource', sourceUri: 'at://p/x/dup', notes: 'v2' } },
  ] });
  const out = await runConnector(c, ctx(dir));
  assert.equal(out.stored, 1); assert.equal(out.updated, 0); assert.equal(out.candidates, 1);
  const dups = resources(dir).filter(({ object }) => object.sourceUri === 'at://p/x/dup');
  assert.equal(dups.length, 1); assert.equal(dups[0].object.notes, 'v2'); assert.equal(dups[0].object.title, 'Dup Renamed');
  // local match -> one update (the last), not two
  const dir2 = instance();
  const c2 = fake({ map: () => [
    { schema: 'resource', object: { title: 'Old', type: 'resource', sourceUri: 'at://peer/x/old', notes: 'v2' } },
    { schema: 'resource', object: { title: 'Old', type: 'resource', sourceUri: 'at://peer/x/old', notes: 'v3' } },
  ] });
  const out2 = await runConnector(c2, ctx(dir2));
  assert.equal(out2.updated, 1); assert.equal(out2.stored, 0); assert.equal(out2.candidates, 1);
  const all = resources(dir2); assert.equal(all.length, 1); assert.equal(all[0].object.notes, 'v3');
});

test('upsert onto a locally reviewed object stays within invariants (keeps local ai_assisted)', async () => {
  const dir = instance();
  seed(dir, { old: { ...localOld, sourceUri: 'at://peer/x/old' } });
  const out = await runConnector(one({ title: 'Old', type: 'resource', sourceUri: 'at://peer/x/old', notes: 'v2' }), ctx(dir));
  assert.equal(out.updated, 1); assert.equal(out.invalid.length, 0);
  const o = resources(dir)[0].object;
  assert.equal(checkInvariants(o).ok, true, JSON.stringify(checkInvariants(o).violations));
  assert.equal(o.ai_assisted, false); assert.equal(o.maturity, 'reviewed'); assert.equal(o.id, 'local-id');
  assert.equal(o.notes, 'v2'); assert.match(o.review_needs, /updated at origin/);
});

// #5: an origin update that changes nothing is a no-op. work_order embeds a per-pull timestamp
// and review_needs is set BY an update, so neither may make an unchanged record look changed
// (otherwise one peer commit-rev bump re-flags the peer's whole corpus for review).
const theRecord = (over = {}) => ({ title: 'Peer Note', type: 'resource', sourceUri: 'at://p/x/1', notes: 'n1', ...over });
const pullOf = (object) => fake({ map: () => [{ schema: 'resource', object }] });
const peerNote = (dir) => resources(dir).find(({ object }) => object.sourceUri === 'at://p/x/1');

test('re-pulling an unchanged record is a no-op: not counted as updated, not re-flagged, stamps left alone', async () => {
  const dir = instance();
  await runConnector(pullOf(theRecord()), { ...ctx(dir), now: () => 't1' });
  const before = peerNote(dir).object;
  assert.equal(before.review_needs, undefined);
  // same content, later pull, keys in a different order
  const reordered = { notes: 'n1', sourceUri: 'at://p/x/1', type: 'resource', title: 'Peer Note' };
  const out = await runConnector(pullOf(reordered), { ...ctx(dir), now: () => 't2' });
  assert.equal(out.updated, 0); assert.equal(out.unchanged, 1); assert.equal(out.candidates, 0); assert.equal(out.stored, 0);
  const after = peerNote(dir).object;
  assert.equal(after.review_needs, undefined, 'not re-flagged');
  assert.equal(after.work_order, before.work_order, 'per-pull stamp not rewritten by a no-op');
  assert.deepEqual(after, before);
});

test('a real change at the origin is still applied and flagged after an unchanged pull', async () => {
  const dir = instance();
  await runConnector(pullOf(theRecord()), { ...ctx(dir), now: () => 't1' });
  await runConnector(pullOf(theRecord()), { ...ctx(dir), now: () => 't2' });
  const out = await runConnector(pullOf(theRecord({ notes: 'n2' })), { ...ctx(dir), now: () => 't3' });
  assert.equal(out.updated, 1); assert.equal(out.unchanged, 0);
  const o = peerNote(dir).object;
  assert.equal(o.notes, 'n2'); assert.equal(o.review_needs, 'updated at origin'); assert.equal(o.work_order, 'connector:fake:t3');
});

test('a no-op pull leaves a reviewer-written review_needs alone', async () => {
  const dir = instance();
  await runConnector(pullOf(theRecord()), { ...ctx(dir), now: () => 't1' });
  const { ref } = peerNote(dir);
  getAdapter('repo-data').update(dir, ref, { review_needs: 'check the licence' });
  await runConnector(pullOf(theRecord()), { ...ctx(dir), now: () => 't2' });
  assert.equal(peerNote(dir).object.review_needs, 'check the licence');
});
