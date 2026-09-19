// packages/org-os-kms/test/static-json.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticJsonConnector } from '../src/connectors/static-json/index.mjs';
import * as openhaven from '../src/connectors/static-json/openhaven.mjs';
import { validateObject, runConnector, getAdapter } from '../src/framework.mjs';

const fx = (f) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'openhaven', f), 'utf8');
const fetchImpl = async (url) => new Response(fx(new URL(url).pathname.split('/').pop()), { status: 200 });
const cfg = { base_url: 'https://www.openhaven.net', index: '/api/index.json', mapper: 'openhaven' };

test('openhaven mapper: protocol→resource, affordance→signal; both validate; other collections (incl. domains) map to nothing', () => {
  const p = JSON.parse(fx('protocols.json'))[0];
  const [r] = openhaven.map({ collection: '/api/protocols.json', item: p });
  assert.equal(r.schema, 'resource'); assert.equal(r.object.title, p.name); assert.equal(r.object.url, p.communityLink);
  assert.equal(r.object.resource_type, p.entityType); assert.deepEqual(r.object.related_concepts, p.domainIds);
  assert.equal(validateObject('resource', r.object).valid, true, validateObject('resource', r.object).errors.join());
  const [s] = openhaven.map({ collection: '/api/affordances.json', item: JSON.parse(fx('affordances.json'))[0] });
  assert.equal(s.schema, 'signal'); assert.equal(validateObject('signal', s.object).valid, true, validateObject('signal', s.object).errors.join());
  assert.deepEqual(openhaven.map({ collection: '/api/domains.json', item: { id: 'x', name: 'X' } }), []); // domain→track mapping removed on purpose
  assert.deepEqual(openhaven.map({ collection: '/api/entity-types.json', item: {} }), []);
});

test('connector: pull reads index + 2 collections (3 items each → 6); hash cursor; unchanged → empty', async () => {
  const c = createStaticJsonConnector({ fetchImpl });
  const first = await c.pull(cfg, { cursor: null });
  assert.equal(first.records.length, 6); assert.match(first.cursor, /^[a-f0-9]{64}$/);
  const second = await c.pull(cfg, { cursor: first.cursor });
  assert.equal(second.records.length, 0); assert.equal(second.cursor, first.cursor);
  assert.equal(c.describe(cfg).type, 'dataset'); assert.equal(c.map(first.records[0], cfg)[0].schema, 'resource');
});

// --- fix round 1: stable sourceUri (updates upsert) + cursor covers collection bodies ---
const servedFrom = (over = {}, spy = null) => async (url) => {
  const f = new URL(url).pathname.split('/').pop();
  if (spy) spy.push(new URL(url).pathname);
  return new Response(over[f] ?? fx(f), { status: 200 });
};
const withProtocolName = (name) => { const j = JSON.parse(fx('protocols.json')); j[0].name = name; return JSON.stringify(j); };

test('openhaven mapper: every mapped object carries a stable sourceUri equal to its source_lineage', () => {
  for (const p of JSON.parse(fx('protocols.json'))) {
    const [r] = openhaven.map({ collection: '/api/protocols.json', item: p });
    assert.equal(r.object.sourceUri, `https://www.openhaven.net/api/protocols/${p.id}.json`);
    assert.equal(r.object.sourceUri, r.object.source_lineage);
  }
  for (const a of JSON.parse(fx('affordances.json'))) {
    const [s] = openhaven.map({ collection: '/api/affordances.json', item: a });
    assert.equal(s.object.sourceUri, `https://www.openhaven.net/api/affordances.json#${a.id}`);
    assert.equal(s.object.sourceUri, s.object.source_lineage);
  }
});

test('runConnector end-to-end: pull #1 stores 6; an upstream edit upserts on pull #2 (no collision), local state kept', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kms-static-json-'));
  mkdirSync(join(dir, 'data', 'kb'), { recursive: true });
  for (const t of ['resource', 'signal', 'source-system']) writeFileSync(join(dir, 'data', 'kb', `${t}.yaml`), 'entries: {}\n');
  const run = (connector, cursor) => runConnector(connector, { config: cfg, cursor, adapter: 'repo-data', target: dir });
  const one = await run(createStaticJsonConnector({ fetchImpl: servedFrom() }), null);
  assert.equal(one.stored, 6); assert.equal(one.updated, 0); assert.equal(one.collisions, 0);
  const a = getAdapter('repo-data');
  const first = JSON.parse(fx('protocols.json'))[0];
  const local = () => a.list(dir).find(({ object }) => object.sourceUri === `https://www.openhaven.net/api/protocols/${first.id}.json`);
  // a human has reviewed this one locally (ai_assisted false), so the framework may keep maturity 'reviewed'
  a.update(dir, local().ref, { id: 'local-id-1', maturity: 'reviewed', public_use: 'ok-with-caveat', ai_assisted: false });
  const two = await run(createStaticJsonConnector({ fetchImpl: servedFrom({ 'protocols.json': withProtocolName('Nostr (renamed upstream)') }) }), one.cursor);
  // runConnector skips a re-pulled record whose content is unchanged: only the renamed one updates, the other 5 are unchanged; none collide or duplicate.
  assert.equal(two.updated, 1); assert.equal(two.unchanged, 5); assert.equal(two.collisions, 0); assert.equal(two.stored, 0); assert.deepEqual(two.invalid, []);
  const o = local().object;
  assert.equal(o.title, 'Nostr (renamed upstream)');
  assert.equal(o.id, 'local-id-1'); assert.equal(o.maturity, 'reviewed'); assert.equal(o.public_use, 'ok-with-caveat');
  assert.equal(a.list(dir).filter(({ schema }) => schema === 'resource').length, 3, 'no duplicate');
  assert.deepEqual(a.list(dir).filter(({ schema }) => schema === 'resource').map(({ object }) => object.title).sort(), ['Nostr (renamed upstream)', ...JSON.parse(fx('protocols.json')).slice(1).map((p) => p.name)].sort());
});

test('cursor covers collection bodies: changed collection + identical index → new cursor + records; identical → empty, same cursor', async () => {
  const base = await createStaticJsonConnector({ fetchImpl: servedFrom() }).pull(cfg, { cursor: null });
  const changed = await createStaticJsonConnector({ fetchImpl: servedFrom({ 'protocols.json': withProtocolName('Changed') }) }).pull(cfg, { cursor: base.cursor });
  assert.notEqual(changed.cursor, base.cursor); assert.equal(changed.records.length, 6);
  const same = await createStaticJsonConnector({ fetchImpl: servedFrom() }).pull(cfg, { cursor: base.cursor });
  assert.deepEqual(same.records, []); assert.equal(same.cursor, base.cursor);
});

test('an unchanged pull still fetches index + collections (combined hash); only protocols + affordances requested', async () => {
  const seed = await createStaticJsonConnector({ fetchImpl: servedFrom() }).pull(cfg, { cursor: null });
  const seen = [];
  const out = await createStaticJsonConnector({ fetchImpl: servedFrom({}, seen) }).pull(cfg, { cursor: seed.cursor });
  assert.deepEqual(out.records, []);
  assert.deepEqual(seen, ['/api/index.json', '/api/protocols.json', '/api/affordances.json']);
  assert.deepEqual(openhaven.collections, ['/api/protocols.json', '/api/affordances.json']);
});
