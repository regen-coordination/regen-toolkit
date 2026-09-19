// packages/org-os-kms/test/ingest-pull-op.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { OPS } from '../src/ops.mjs';
import { LIFECYCLE_BINDINGS } from '../src/bind.mjs';
import { NOT_IMPLEMENTED } from '../src/framework.mjs';
import { CONNECTORS, getConnector } from '../src/connectors/index.mjs';

// kms.yaml is written as TEXT (with a comment) so tests can prove when it is / is not rewritten.
function instance(connectors, { extra = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'kms-pull-'));
  mkdirSync(join(dir, 'data', 'kb'), { recursive: true });
  writeFileSync(join(dir, 'data', 'kb', 'resource.yaml'), yaml.dump({ entries: {} }));
  writeFileSync(join(dir, 'kms.yaml'),
    `# keep me\n${yaml.dump({ instance: 't', adapter: 'repo-data', target: '.', ...extra, connectors })}`);
  return dir;
}
const kmsText = (dir) => readFileSync(join(dir, 'kms.yaml'), 'utf8');
// Cursors live in a sidecar (data/kms-cursors.json), never in kms.yaml: rewriting kms.yaml drops its comments.
const CURSORS = (dir) => join(dir, 'data', 'kms-cursors.json');
const cursors = (dir) => JSON.parse(readFileSync(CURSORS(dir), 'utf8')).cursors;
const good = { name: 'good', protocol: 't', capabilities: { ingest: true }, describe: () => ({ title: 'G', type: 'dataset', steward: 's', return_path: 'g' }),
  pull: async (_c, { cursor }) => ({ records: [{ n: 'X' }], cursor: (cursor || 0) + 1 }), map: (r) => [{ schema: 'resource', object: { title: r.n, type: 'resource' } }] };
const stub = { ...good, name: 'stub', pull: async () => { throw new NOT_IMPLEMENTED('stub'); } };
const broken = { ...good, name: 'broken', pull: async () => { throw new Error('boom'); } };

test('registry: atproto + static-json; getConnector throws on unknown', () => {
  assert.deepEqual(Object.keys(CONNECTORS).sort(), ['atproto', 'static-json']);
  assert.equal(getConnector('atproto').name, 'atproto');
  assert.throws(() => getConnector('nope'), /unknown connector: nope \(available: atproto, static-json\)/);
});

test('ingest.pull registered as a write op and NOT bound to close (CLI verb only)', () => {
  assert.ok(OPS['ingest.pull']?.write === true);
  assert.ok(!LIFECYCLE_BINDINGS.close.includes('ingest.pull'));
  assert.ok(!LIFECYCLE_BINDINGS.initialize.includes('ingest.pull'));
});

test('runs each connector, writes cursors to the sidecar, continues past NOT_IMPLEMENTED; kms.yaml untouched', async () => {
  const dir = instance([{ name: 'good', config: {}, cursor: null }, { name: 'stub', config: {}, cursor: null }]);
  const before = kmsText(dir);
  const res = await OPS['ingest.pull'].run({ dir, deps: { registry: { good, stub } } });
  assert.equal(res.ok, true, JSON.stringify(res.report));
  assert.equal(res.report.connectors[0].stored, 1); assert.equal(res.report.connectors[1].status, 'not-implemented');
  assert.equal(res.report.failed, 0);
  assert.deepEqual(cursors(dir), { good: 1 });
  assert.equal(kmsText(dir), before, 'kms.yaml is never rewritten (comments survive)');
});

test('a failing connector does not stop the others; fail-soft: ok:true, failed counted', async () => {
  const dir = instance([{ name: 'broken', config: {}, cursor: null }, { name: 'good', config: {}, cursor: null }]);
  const res = await OPS['ingest.pull'].run({ dir, deps: { registry: { good, broken } } });
  assert.equal(res.ok, true);
  assert.equal(res.report.failed, 1);
  assert.equal(res.report.connectors[0].status, 'failed'); assert.match(res.report.connectors[0].error, /boom/);
  assert.equal(res.report.connectors[1].stored, 1);
  assert.deepEqual(cursors(dir), { good: 1 }, 'the failed connector gets no cursor');
});

test('an undeclared-in-registry connector name fails soft', async () => {
  const dir = instance([{ name: 'ghost', config: {}, cursor: null }]);
  const res = await OPS['ingest.pull'].run({ dir, deps: { registry: { good } } });
  assert.equal(res.ok, true); assert.equal(res.report.failed, 1);
  assert.match(res.report.connectors[0].error, /unknown connector: ghost/);
});

test('--dry: no store, no cursor write-back, kms.yaml byte-identical, no sidecar', async () => {
  const dir = instance([{ name: 'good', config: {}, cursor: null }]);
  const before = kmsText(dir);
  const res = await OPS['ingest.pull'].run({ dir, flags: { dry: true }, deps: { registry: { good } } });
  assert.equal(res.report.connectors[0].dry, true); assert.equal(res.report.connectors[0].stored, 0);
  assert.equal(res.report.connectors[0].candidates, 1);
  assert.equal(kmsText(dir), before);
  assert.equal(existsSync(CURSORS(dir)), false);
  assert.equal(yaml.load(readFileSync(join(dir, 'data', 'kb', 'resource.yaml'), 'utf8')).entries.x, undefined);
});

test('--connector limits the run', async () => {
  const dir = instance([{ name: 'good', config: {}, cursor: null }, { name: 'stub', config: {}, cursor: null }]);
  const res = await OPS['ingest.pull'].run({ dir, flags: { connector: 'good' }, deps: { registry: { good, stub } } });
  assert.equal(res.report.connectors.length, 1);
  assert.equal(res.report.connectors[0].name, 'good');
});

test('--connector: only the named connector\'s cursor is written; the legacy kms.yaml cursor seeds it', async () => {
  const dir = instance([{ name: 'stub', config: {}, cursor: null }, { name: 'good', config: {}, cursor: 5 }]);
  const before = kmsText(dir);
  const res = await OPS['ingest.pull'].run({ dir, flags: { connector: 'good' }, deps: { registry: { good, stub } } });
  assert.equal(res.report.connectors.length, 1);
  assert.deepEqual(cursors(dir), { good: 6 });
  assert.equal(kmsText(dir), before);
});

test('--connector naming an undeclared connector warns instead of silently succeeding', async () => {
  const dir = instance([{ name: 'good', config: {}, cursor: null }]);
  const before = kmsText(dir);
  const res = await OPS['ingest.pull'].run({ dir, flags: { connector: 'nope' }, deps: { registry: { good } } });
  assert.deepEqual(res, { ok: true, report: { connectors: [], failed: 0, warning: 'no declared connector named nope' } });
  assert.equal(kmsText(dir), before);
});

test('invalid candidates are reported under invalid and not stored', async () => {
  const bad = { ...good, name: 'bad', map: () => [{ schema: 'resource', object: { type: 'resource' } }] }; // missing title
  const dir = instance([{ name: 'bad', config: {}, cursor: null }]);
  const res = await OPS['ingest.pull'].run({ dir, deps: { registry: { bad } } });
  const c = res.report.connectors[0];
  assert.equal(res.ok, true); assert.equal(c.status, 'ok'); assert.equal(c.stored, 0);
  assert.equal(c.invalid.length, 1); assert.ok(c.invalid[0].errors.length > 0);
  assert.deepEqual(c.collided, []);
});

test('slug collisions are reported under collided and not overwritten', async () => {
  const dir = instance([{ name: 'good', config: {}, cursor: null }]);
  writeFileSync(join(dir, 'data', 'kb', 'resource.yaml'), yaml.dump({ entries: { x: { title: 'X', type: 'resource', notes: 'mine' } } }));
  const res = await OPS['ingest.pull'].run({ dir, deps: { registry: { good } } });
  const c = res.report.connectors[0];
  assert.equal(c.stored, 0); assert.equal(c.collisions, 1); assert.deepEqual(c.collided, [{ schema: 'resource', title: 'X' }]);
  assert.equal(yaml.load(readFileSync(join(dir, 'data', 'kb', 'resource.yaml'), 'utf8')).entries.x.notes, 'mine');
});

test('kms.yaml is left byte-identical (comments survive) and no sidecar is written when no cursor changes', async () => {
  const same = { ...good, name: 'same', pull: async (_c, { cursor }) => ({ records: [], cursor }) };
  const peerless = { ...good, name: 'peerless', pull: async () => ({ records: [], cursor: {} }) }; // atproto with no peers: {} for null
  const dir = instance([{ name: 'same', config: {}, cursor: null }, { name: 'peerless', config: {}, cursor: null }]);
  const before = kmsText(dir);
  const res = await OPS['ingest.pull'].run({ dir, deps: { registry: { same, peerless } } });
  assert.equal(res.ok, true);
  assert.equal(kmsText(dir), before);
  assert.match(kmsText(dir), /# keep me/);
  assert.equal(existsSync(CURSORS(dir)), false);
});

test('a real cursor change writes the sidecar and leaves kms.yaml (and its comments) byte-identical', async () => {
  const dir = instance([{ name: 'good', config: {}, cursor: null }]);
  const before = kmsText(dir);
  await OPS['ingest.pull'].run({ dir, deps: { registry: { good } } });
  assert.equal(kmsText(dir), before);
  assert.match(kmsText(dir), /# keep me/);
  assert.deepEqual(cursors(dir), { good: 1 });
});

test('shared atproto identity is merged under each connector config (own config wins)', async () => {
  const seen = [];
  const spy = { ...good, name: 'spy', pull: async (c) => { seen.push(c); return { records: [], cursor: null }; } };
  const dir = instance([{ name: 'spy', config: { nsid_authority: 'own.auth', peers: ['did:plc:p'] }, cursor: null }],
    { extra: { atproto: { did: 'did:plc:me', pds: 'https://pds.test', nsid_authority: 'xyz.kb' } } });
  await OPS['ingest.pull'].run({ dir, deps: { registry: { spy } } });
  assert.deepEqual(seen[0], { self: 'did:plc:me', pds: 'https://pds.test', nsid_authority: 'own.auth', peers: ['did:plc:p'] });
});

test('no connectors declared: ok, empty report, kms.yaml untouched', async () => {
  const dir = instance([]);
  const before = kmsText(dir);
  const res = await OPS['ingest.pull'].run({ dir, deps: { registry: { good } } });
  assert.deepEqual(res, { ok: true, report: { connectors: [], failed: 0 } });
  assert.equal(kmsText(dir), before);
});

test('a --connector flag that is not a non-empty name is an operator error: nothing runs, kms.yaml untouched', async () => {
  for (const bad of [true, '', '   ', false]) {
    let pulls = 0;
    const spy = { ...good, name: 'good', pull: async () => { pulls++; return { records: [], cursor: 9 }; } };
    const dir = instance([{ name: 'good', config: {}, cursor: null }]);
    const before = kmsText(dir);
    const res = await OPS['ingest.pull'].run({ dir, flags: { connector: bad }, deps: { registry: { good: spy } } });
    assert.deepEqual(res, { ok: false, report: { connectors: [], failed: 0, error: '--connector needs a name (usage: --connector <name>)' } }, JSON.stringify(bad));
    assert.equal(pulls, 0, `pull invoked for ${JSON.stringify(bad)}`);
    assert.equal(kmsText(dir), before);
  }
});

test('flags.connector undefined still means all connectors; a named one still works', async () => {
  const dir = instance([{ name: 'good', config: {}, cursor: null }, { name: 'stub', config: {}, cursor: null }]);
  const all = await OPS['ingest.pull'].run({ dir, flags: { connector: undefined }, deps: { registry: { good, stub } } });
  assert.equal(all.ok, true); assert.equal(all.report.connectors.length, 2);
  const one = await OPS['ingest.pull'].run({ dir, flags: { connector: 'good' }, deps: { registry: { good, stub } } });
  assert.equal(one.report.connectors.length, 1);
});

test('cursor write-back re-reads the sidecar: a cursor another run wrote meanwhile survives, ours lands, no tmp file is left', async () => {
  const dir = instance([{ name: 'good', config: {}, cursor: null }]);
  const racing = { ...good, pull: async (_c, { cursor }) => {
    mkdirSync(join(dir, 'data'), { recursive: true });
    writeFileSync(CURSORS(dir), JSON.stringify({ version: 1, cursors: { other: 9 } }));   // another process lands mid-run
    return { records: [{ n: 'X' }], cursor: (cursor || 0) + 1 };
  } };
  const res = await OPS['ingest.pull'].run({ dir, deps: { registry: { good: racing } } });
  assert.equal(res.ok, true, JSON.stringify(res.report));
  assert.deepEqual(cursors(dir), { other: 9, good: 1 });
  assert.ok(!existsSync(`${CURSORS(dir)}.tmp`), 'no tmp file left behind');
});

test('connectors that share a name keep separate cursors (the second is keyed name#2)', async () => {
  const dir = instance([{ name: 'good', config: {}, cursor: 10 }, { name: 'good', config: {}, cursor: 20 }]);
  const res = await OPS['ingest.pull'].run({ dir, deps: { registry: { good } } });
  assert.equal(res.ok, true);
  assert.deepEqual(cursors(dir), { good: 11, 'good#2': 21 });
});

test('a kms.yaml cursor is only the seed: with no sidecar entry the connector gets it; a sidecar entry wins', async () => {
  const seen = [];
  const spy = { ...good, name: 'spy', pull: async (_c, { cursor }) => { seen.push(cursor); return { records: [], cursor: (cursor || 0) + 1 }; } };
  const dir = instance([{ name: 'spy', config: {}, cursor: 5 }]);
  await OPS['ingest.pull'].run({ dir, deps: { registry: { spy } } });
  assert.deepEqual(seen, [5], 'legacy kms.yaml cursor seeds the first pull');
  assert.deepEqual(cursors(dir), { spy: 6 });
  await OPS['ingest.pull'].run({ dir, deps: { registry: { spy } } });
  assert.deepEqual(seen, [5, 6], 'sidecar wins over the stale kms.yaml value');
});

test('an unreadable sidecar is an operator error: nothing runs, nothing is overwritten', async () => {
  const dir = instance([{ name: 'good', config: {}, cursor: null }]);
  mkdirSync(join(dir, 'data'), { recursive: true });
  writeFileSync(CURSORS(dir), '{ not json');
  let pulled = false;
  const watch = { ...good, pull: async () => { pulled = true; return { records: [], cursor: 1 }; } };
  const res = await OPS['ingest.pull'].run({ dir, deps: { registry: { good: watch } } });
  assert.equal(res.ok, false);
  assert.match(res.report.error, /kms-cursors\.json/);
  assert.equal(pulled, false);
  assert.equal(readFileSync(CURSORS(dir), 'utf8'), '{ not json');
});

test('a second pull of unchanged records reports them under unchanged, not updated', async () => {
  const withOrigin = { ...good, name: 'orig', map: (r) => [{ schema: 'resource', object: { title: r.n, type: 'resource', sourceUri: 'at://p/x/1' } }] };
  const dir = instance([{ name: 'orig', config: {}, cursor: null }]);
  const first = await OPS['ingest.pull'].run({ dir, deps: { registry: { orig: withOrigin } } });
  assert.equal(first.report.connectors[0].stored, 1);
  const second = await OPS['ingest.pull'].run({ dir, deps: { registry: { orig: withOrigin } } });
  const c = second.report.connectors[0];
  assert.equal(c.pulled, 1); assert.equal(c.updated, 0); assert.equal(c.unchanged, 1);
});
