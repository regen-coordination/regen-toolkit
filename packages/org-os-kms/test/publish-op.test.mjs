// packages/org-os-kms/test/publish-op.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { OPS } from '../src/ops.mjs';
import { LIFECYCLE_BINDINGS } from '../src/bind.mjs';

function instance({ atproto = true, gate = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'kms-pub-'));
  mkdirSync(join(dir, 'data', 'kb'), { recursive: true });
  writeFileSync(join(dir, 'data', 'kb', 'resource.yaml'), yaml.dump({ entries: {
    a: { title: 'A', type: 'resource', public_use: 'ok-with-caveat' },
    b: { title: 'B', type: 'resource', public_use: 'ok-with-caveat', maturity: 'reviewed' },
    i: { title: 'I', type: 'resource', public_use: 'internal-only' } } }));
  writeFileSync(join(dir, 'data', 'kb', 'source-system.yaml'), yaml.dump({ entries: { card: { title: 'Card', type: 'blog', public_use: 'ok-with-caveat', steward: 's', return_path: 'r' } } }));
  if (gate) writeFileSync(join(dir, 'gate.mjs'), 'export function isPublishable(o){ return o.maturity === "reviewed" ? { ok: true } : { ok: false, reason: "not reviewed" }; }');
  writeFileSync(join(dir, 'kms.yaml'), yaml.dump({ instance: 't', adapter: 'repo-data', target: '.',
    publish: { base_url: 'https://t.example', ...(gate ? { gate: 'gate.mjs' } : {}) },
    ...(atproto ? { atproto: { did: 'did:plc:me', handle: 'kc.test', pds: 'https://pds.test', nsid_authority: 'xyz.regencoordination.kb' } } : {}) }));
  return dir;
}
const fakeClientFactory = (log) => () => ({
  async login() { log.push('login'); return { did: 'did:plc:me' }; },
  async putRecord(op) { log.push(['put', op.rkey]); return { uri: `at://did:plc:me/${op.collection}/${op.rkey}`, cid: 'cid1' }; },
  async deleteRecord(op) { log.push(['del', op.rkey]); },
});
const env = { ATPROTO_APP_PASSWORD: 'pw' };

test('publish registered; bound after render.site, before sync.push', () => {
  assert.ok(OPS.publish && OPS.publish.write === true);
  const c = LIFECYCLE_BINDINGS.close;
  assert.ok(c.indexOf('publish') > c.indexOf('render.site')); assert.equal(c.indexOf('publish'), c.indexOf('sync.push') - 1);
});

test('publish: gates by schema (card not published by default), mints, writes PDS + manifest + static', async () => {
  const dir = instance(); const log = [];
  const res = await OPS.publish.run({ dir, flags: { apply: true }, deps: { createClient: fakeClientFactory(log), env } });
  assert.equal(res.ok, true, JSON.stringify(res.report));
  assert.equal(res.report.minted, 2);
  assert.equal(res.report.atproto.status, 'applied'); assert.equal(res.report.atproto.created, 2);
  assert.ok(existsSync(join(dir, 'data', 'kms-published.json')));
  assert.ok(existsSync(join(dir, 'public', 'api', 'resource.json')));
  assert.ok(!existsSync(join(dir, 'public', 'api', 'source-system.json')), 'opt-in type not published');
  const disk = yaml.load(readFileSync(join(dir, 'data', 'kb', 'resource.yaml'), 'utf8')).entries;
  assert.ok(disk.a.id && disk.b.id && !disk.i.id);
});

test('publish: instance gate narrows; ids minted only for gate-passing objects', async () => {
  const dir = instance({ gate: true }); const log = [];
  const res = await OPS.publish.run({ dir, flags: { apply: true }, deps: { createClient: fakeClientFactory(log), env } });
  assert.equal(res.report.gate.passed, 1); assert.equal(res.report.gate.rejected, 1);
  assert.deepEqual(res.report.gate.by_reason, { 'not reviewed': 1 });
  assert.equal(res.report.minted, 1); assert.equal(res.report.atproto.created, 1);
  const disk = yaml.load(readFileSync(join(dir, 'data', 'kb', 'resource.yaml'), 'utf8')).entries;
  assert.ok(disk.b.id && !disk.a.id);
});

test('second run is all skips', async () => {
  const dir = instance(); const log = []; const deps = { createClient: fakeClientFactory(log), env };
  await OPS.publish.run({ dir, flags: { apply: true }, deps });
  const res = await OPS.publish.run({ dir, flags: { apply: true }, deps });
  assert.equal(res.report.atproto.skipped, 2); assert.equal(res.report.atproto.created, 0);
});

test('not configured (no atproto / no credential) → static still written, ok', async () => {
  for (const dir of [instance({ atproto: false }), instance()]) {
    const res = await OPS.publish.run({ dir, deps: { createClient: () => { throw new Error('must not be called'); }, env: {} } });
    assert.equal(res.ok, true); assert.equal(res.report.atproto.status, 'not-configured');
    assert.ok(existsSync(join(dir, 'public', 'api', 'resource.json')));
  }
});

test('publish.static:false skips the surface', async () => {
  const dir = instance({ atproto: false });
  const cfg = yaml.load(readFileSync(join(dir, 'kms.yaml'), 'utf8')); cfg.publish = { static: false }; writeFileSync(join(dir, 'kms.yaml'), yaml.dump(cfg));
  const res = await OPS.publish.run({ dir, deps: { env: {} } });
  assert.equal(res.report.static, 'disabled'); assert.ok(!existsSync(join(dir, 'public')));
});

test('--dry: plans, mints nothing, writes nothing', async () => {
  const dir = instance(); const log = [];
  const res = await OPS.publish.run({ dir, flags: { dry: true }, deps: { createClient: fakeClientFactory(log), env } });
  assert.equal(res.report.dry, true); assert.equal(res.report.atproto.status, 'planned'); assert.equal(res.report.atproto.created, 2);
  assert.equal(log.length, 0);
  assert.ok(!existsSync(join(dir, 'data', 'kms-published.json'))); assert.ok(!existsSync(join(dir, 'public')));
  assert.equal(yaml.load(readFileSync(join(dir, 'data', 'kb', 'resource.yaml'), 'utf8')).entries.a.id, undefined);
});

test('validation failure fails hard before any PDS write', async () => {
  const dir = instance(); const log = [];
  writeFileSync(join(dir, 'data', 'kb', 'resource.yaml'), yaml.dump({ entries: { a: { title: 'A', type: 'resource', public_use: 'ok-with-caveat', provenance: { score: 0.5 } } } }));
  const res = await OPS.publish.run({ dir, deps: { createClient: fakeClientFactory(log), env } });
  assert.equal(res.ok, false); assert.equal(log.length, 0); assert.match(JSON.stringify(res.report.errors), /float/);
});

test('without --apply, close-mode publish plans only: nothing on PDS, no manifest, static still written', async () => {
  const dir = instance(); const log = [];
  const res = await OPS.publish.run({ dir, deps: { createClient: fakeClientFactory(log), env } });
  assert.equal(res.report.atproto.status, 'planned'); assert.equal(log.length, 0);
  assert.ok(!existsSync(join(dir, 'data', 'kms-published.json')));
  assert.ok(existsSync(join(dir, 'public', 'api', 'resource.json')));
});

test('grc20Id only when geo.space is set', async () => {
  const dir = instance(); const deps = { createClient: fakeClientFactory([]), env };
  await OPS.publish.run({ dir, flags: { apply: true }, deps });
  assert.equal(yaml.load(readFileSync(join(dir, 'data', 'kb', 'resource.yaml'), 'utf8')).entries.a.grc20Id, undefined);
});

test('apply: manifest persisted even when the static surface throws; failure reported, ok false', async () => {
  const dir = instance(); const log = [];
  const cfg = yaml.load(readFileSync(join(dir, 'kms.yaml'), 'utf8')); delete cfg.publish.base_url; writeFileSync(join(dir, 'kms.yaml'), yaml.dump(cfg));
  const res = await OPS.publish.run({ dir, flags: { apply: true }, deps: { createClient: fakeClientFactory(log), env } });
  assert.equal(res.report.atproto.status, 'applied');
  assert.equal(res.report.static.status, 'failed'); assert.match(res.report.static.error, /base_url/);
  assert.equal(res.ok, false);
  const manifest = JSON.parse(readFileSync(join(dir, 'data', 'kms-published.json'), 'utf8'));
  assert.equal(Object.keys(manifest.objects).length, 2);
});

test('--apply with atproto configured but no ATPROTO_APP_PASSWORD: not-configured, no manifest', async () => {
  const dir = instance();
  const res = await OPS.publish.run({ dir, flags: { apply: true }, deps: { createClient: () => { throw new Error('must not be called'); }, env: {} } });
  assert.equal(res.report.atproto.status, 'not-configured');
  assert.ok(!existsSync(join(dir, 'data', 'kms-published.json')));
});

test('--apply with no atproto config: not-configured, no manifest', async () => {
  const dir = instance({ atproto: false });
  const res = await OPS.publish.run({ dir, flags: { apply: true }, deps: { env } });
  assert.equal(res.report.atproto.status, 'not-configured');
  assert.ok(!existsSync(join(dir, 'data', 'kms-published.json')));
});

test('no publication target (static:false + no atproto): ids are NOT written to disk, minting is only previewed', async () => {
  const dir = instance({ atproto: false });
  const cfg = yaml.load(readFileSync(join(dir, 'kms.yaml'), 'utf8')); cfg.publish = { static: false }; writeFileSync(join(dir, 'kms.yaml'), yaml.dump(cfg));
  const before = readFileSync(join(dir, 'data', 'kb', 'resource.yaml'), 'utf8');
  const res = await OPS.publish.run({ dir, deps: { env: {} } });
  assert.equal(res.ok, true);
  assert.equal(res.report.minted, 2, 'preview count is still reported');
  const disk = yaml.load(readFileSync(join(dir, 'data', 'kb', 'resource.yaml'), 'utf8')).entries;
  assert.ok(!disk.a.id && !disk.b.id && !disk.i.id, 'no ids written');
  assert.equal(readFileSync(join(dir, 'data', 'kb', 'resource.yaml'), 'utf8'), before, 'tracked yaml untouched');
  assert.ok(!existsSync(join(dir, 'public')));
});

test('a publication target (atproto only, or static only) still mints ids to disk', async () => {
  // static:false but atproto configured (dry:false, plan mode) -> target exists
  const dir = instance();
  const cfg = yaml.load(readFileSync(join(dir, 'kms.yaml'), 'utf8')); cfg.publish = { static: false }; writeFileSync(join(dir, 'kms.yaml'), yaml.dump(cfg));
  await OPS.publish.run({ dir, deps: { env: {} } });
  const disk = yaml.load(readFileSync(join(dir, 'data', 'kb', 'resource.yaml'), 'utf8')).entries;
  assert.ok(disk.a.id && disk.b.id);
});

function emptySelectionInstance() {
  const dir = instance();
  writeFileSync(join(dir, 'data', 'kb', 'resource.yaml'), yaml.dump({ entries: { i: { title: 'I', type: 'resource', public_use: 'internal-only' } } }));
  mkdirSync(join(dir, 'data'), { recursive: true });
  const entry = (id) => ({ slug: id, type: 'resource', rkey: id, atUri: `at://did:plc:me/xyz.regencoordination.kb.resource/${id}`, cid: 'c', hash: 'h', publishedAt: '2026-01-01T00:00:00.000Z' });
  writeFileSync(join(dir, 'data', 'kms-published.json'), JSON.stringify({ version: 1, objects: { 'old-1': entry('old-1'), 'old-2': entry('old-2') } }, null, 2));
  return dir;
}

test('apply with an empty selection refuses to delete the whole published corpus', async () => {
  const dir = emptySelectionInstance(); const log = [];
  const manifestBefore = readFileSync(join(dir, 'data', 'kms-published.json'), 'utf8');
  const res = await OPS.publish.run({ dir, flags: { apply: true }, deps: { createClient: fakeClientFactory(log), env } });
  assert.equal(res.ok, false);
  assert.deepEqual(log, [], 'no login, no delete');
  assert.equal(res.report.atproto.status, 'failed');
  assert.equal(res.report.atproto.wouldDelete, 2);
  assert.equal(res.report.atproto.deleted, 0);
  assert.match(res.report.atproto.reason, /refusing to delete every published record/);
  assert.equal(readFileSync(join(dir, 'data', 'kms-published.json'), 'utf8'), manifestBefore, 'manifest untouched');
});

test('plan mode with an empty selection just reports the counts (no refusal)', async () => {
  const dir = emptySelectionInstance(); const log = [];
  const res = await OPS.publish.run({ dir, deps: { createClient: fakeClientFactory(log), env } });
  assert.equal(res.ok, true);
  assert.equal(res.report.atproto.status, 'planned');
  assert.equal(res.report.atproto.deleted, 2);
  assert.deepEqual(log, []);
});

test('a login failure is a reported failure (ok:false, status failed), not a thrown exception; no manifest written', async () => {
  const dir = instance();
  const createClient = () => ({ async login() { throw new Error('boom pw'); }, async putRecord() { throw new Error('must not be called'); }, async deleteRecord() {} });
  const res = await OPS.publish.run({ dir, flags: { apply: true }, deps: { createClient, env } });
  assert.equal(res.ok, false);
  assert.equal(res.report.atproto.status, 'failed');
  assert.match(res.report.atproto.error, /boom/);
  assert.ok(!res.report.atproto.error.includes('pw'), 'the app password is never echoed');
  assert.equal(res.report.atproto.created, 2, 'plan counts are kept');
  assert.ok(!existsSync(join(dir, 'data', 'kms-published.json')));
  assert.ok(existsSync(join(dir, 'public', 'api', 'resource.json')), 'static surface still runs');
});

test('a throw out of client creation or a non-record apply error is also reported, not thrown', async () => {
  const dir = instance();
  const res = await OPS.publish.run({ dir, flags: { apply: true }, deps: { createClient: () => { throw new Error('no pds'); }, env } });
  assert.equal(res.ok, false); assert.equal(res.report.atproto.status, 'failed'); assert.match(res.report.atproto.error, /no pds/);
});

test('an object that turns held after publishing is unpublished on the next apply; the rest are skipped', async () => {
  const dir = instance(); const log = []; const deps = { createClient: fakeClientFactory(log), env };
  await OPS.publish.run({ dir, flags: { apply: true }, deps });
  const p = join(dir, 'data', 'kb', 'resource.yaml');
  const doc = yaml.load(readFileSync(p, 'utf8'));
  const heldRkey = doc.entries.a.id;
  doc.entries.a.maturity = 'held';           // e.g. retracted at origin; public_use still clears the floor
  writeFileSync(p, yaml.dump(doc));
  log.length = 0;
  const res = await OPS.publish.run({ dir, flags: { apply: true }, deps });
  assert.equal(res.ok, true, JSON.stringify(res.report));
  assert.equal(res.report.atproto.deleted, 1);
  assert.equal(res.report.atproto.skipped, 1);
  assert.equal(res.report.atproto.created, 0);
  assert.ok(log.some((e) => Array.isArray(e) && e[0] === 'del' && String(e[1]).includes(heldRkey.split(':').pop())), `expected a delete for ${heldRkey}: ${JSON.stringify(log)}`);
  const api = JSON.parse(readFileSync(join(dir, 'public', 'api', 'resource.json'), 'utf8'));
  assert.ok(!JSON.stringify(api).includes('"title":"A"'), 'held object is gone from the static surface too');
});
