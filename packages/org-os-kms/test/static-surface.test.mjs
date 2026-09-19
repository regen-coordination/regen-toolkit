// packages/org-os-kms/test/static-surface.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeStaticSurface } from '../src/static/surface.mjs';

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'kms-static-'));
  mkdirSync(join(dir, '.well-known'));
  writeFileSync(join(dir, '.well-known', 'dao.json'), '{"type":"DAO"}');
  writeFileSync(join(dir, '.well-known', 'meetings.json'), '{"meetings":[{"participants":["x"]}]}');
  writeFileSync(join(dir, '.well-known', 'knowledge.json'), JSON.stringify({ '@context': 'https://www.daostar.org/schemas', type: 'KnowledgeManifest', domains: [{ id: 'd1', name: 'D' }], sources: [{ title: 'Existing' }] }));
  return dir;
}
const items = [{ schema: 'resource', ref: 'r#a', object: { title: 'A', type: 'resource', public_use: 'ok-with-caveat', id: 'id-a', notes: 'internal', reviewed_by: 'L' } }];
const allItems = [...items,
  { schema: 'source-system', ref: 's#self', object: { title: 'S', type: 'knowledge-garden', public_use: 'ok-with-caveat', url: 'https://kc', steward: 'x' } },
  { schema: 'source-system', ref: 's#priv', object: { title: 'P', type: 'database', public_use: 'internal-only' } }];
const manifest = { version: 1, objects: { 'id-a': { slug: 'a', type: 'resource', rkey: 'id-a', atUri: 'at://d/c/id-a', cid: 'cid-a', hash: 'h', publishedAt: 't' } } };
const config = { instance: 't', publish: { base_url: 'https://kc.example', types_opt_in: ['source-system'] }, atproto: { did: 'did:plc:me', nsid_authority: 'xyz.regencoordination.kb' }, geo: { parent_space: 'p', space: null },
  connectors: [{ name: 'atproto', config: { peers: ['did:plc:peer'] } }] };

test('projected entries, absolute @context, merged knowledge.json, allowlisted .well-known', () => {
  const dir = setup();
  const { files } = writeStaticSurface({ dir, items, allItems, manifest, config });
  const pub = (p) => JSON.parse(readFileSync(join(dir, 'public', p), 'utf8'));
  const one = pub('api/resource/id-a.json');
  assert.equal(one['@context'], 'https://kc.example/api/context.jsonld');
  assert.equal(one.notes, undefined); assert.equal(one.reviewed_by, undefined); assert.equal(one.cid, 'cid-a');
  assert.ok(pub('api/index.json').endpoints.some((e) => e.path === 'https://kc.example/api/resource.json'));
  const km = pub('.well-known/knowledge.json');
  assert.deepEqual(km.domains, [{ id: 'd1', name: 'D' }], 'generate:schemas shape preserved');
  assert.deepEqual(km.sources.map((s) => s.title), ['Existing', 'S']);
  assert.equal(km.did, 'did:plc:me');
  assert.deepEqual(km.exchange, { published_domains: ['xyz.regencoordination.kb.resource'], subscribed_domains: [] }, 'who this instance reads is not disclosed by default');
  assert.ok(existsSync(join(dir, 'public', '.well-known', 'dao.json')));
  assert.ok(!existsSync(join(dir, 'public', '.well-known', 'meetings.json')), 'never copied');
  assert.ok(files.includes('api/context.jsonld'));
});

test('base_url is required', () => {
  const dir = setup();
  assert.throws(() => writeStaticSurface({ dir, items, allItems, manifest, config: { ...config, publish: {} } }), /base_url/);
});

test('source-system cards honor the opt-in type gate', () => {
  const dir = setup();
  writeStaticSurface({ dir, items, allItems, manifest, config: { ...config, publish: { base_url: 'https://kc.example' } } });
  const km = JSON.parse(readFileSync(join(dir, 'public', '.well-known', 'knowledge.json'), 'utf8'));
  assert.deepEqual(km.sources.map((s) => s.title), ['Existing']);
});

test('re-running removes api/ files for objects/schemas no longer published', () => {
  const dir = setup();
  const two = [...items, { schema: 'resource', ref: 'r#b', object: { title: 'B', type: 'resource', public_use: 'ok-with-caveat', id: 'id-b' } }];
  writeStaticSurface({ dir, items: two, allItems: two, manifest, config });
  assert.ok(existsSync(join(dir, 'public', 'api', 'resource', 'id-b.json')));
  writeStaticSurface({ dir, items, allItems: items, manifest, config });
  assert.ok(!existsSync(join(dir, 'public', 'api', 'resource', 'id-b.json')), 'dropped object removed');
  assert.ok(existsSync(join(dir, 'public', 'api', 'resource', 'id-a.json')), 'kept object present');
  writeStaticSurface({ dir, items: [], allItems: [], manifest, config });
  assert.ok(!existsSync(join(dir, 'public', 'api', 'resource.json')), 'emptied schema index removed');
  assert.ok(!existsSync(join(dir, 'public', 'api', 'resource', 'id-a.json')));
});

test('outDir must be a non-empty relative path inside dir', () => {
  for (const outDir of ['../escape', '/abs', '']) {
    const dir = setup();
    assert.throws(() => writeStaticSurface({ dir, outDir, items, allItems, manifest, config }), /outDir/, `outDir=${JSON.stringify(outDir)}`);
  }
});

test('an object carrying its own @context cannot override the entry @context', () => {
  const dir = setup();
  const evil = [{ schema: 'resource', ref: 'r#e', object: { title: 'E', type: 'resource', public_use: 'ok-with-caveat', id: 'id-e', '@context': 'https://evil.example/ctx' } }];
  writeStaticSurface({ dir, items: evil, allItems: evil, manifest: { version: 1, objects: {} }, config });
  const pub = (p) => JSON.parse(readFileSync(join(dir, 'public', p), 'utf8'));
  assert.equal(pub('api/resource/id-e.json')['@context'], 'https://kc.example/api/context.jsonld');
  assert.equal(pub('api/resource.json').items[0]['@context'], 'https://kc.example/api/context.jsonld');
});

test('a root-authored did/geo survives when the config sets neither; config still wins when set', () => {
  const dir = setup();
  writeFileSync(join(dir, '.well-known', 'knowledge.json'), JSON.stringify({ '@context': 'https://www.daostar.org/schemas', type: 'KnowledgeManifest', domains: [], sources: [], did: 'did:plc:root', geo: { space: 'root-space' } }));
  const bare = { instance: 't', publish: { base_url: 'https://kc.example' } };
  writeStaticSurface({ dir, items, allItems, manifest, config: bare });
  const pub = (p) => JSON.parse(readFileSync(join(dir, 'public', p), 'utf8'));
  assert.equal(pub('.well-known/knowledge.json').did, 'did:plc:root');
  assert.deepEqual(pub('.well-known/knowledge.json').geo, { space: 'root-space' });
  writeStaticSurface({ dir, items, allItems, manifest, config });
  assert.equal(pub('.well-known/knowledge.json').did, 'did:plc:me');
  assert.deepEqual(pub('.well-known/knowledge.json').geo, { parent_space: 'p', space: null });
});

test('publish.disclose_subscriptions: true lists the atproto peer DIDs and static-json base_urls under exchange.subscribed_domains', () => {
  const dir = setup();
  const cfg = { ...config, publish: { ...config.publish, disclose_subscriptions: true },
    connectors: [{ name: 'atproto', config: { peers: ['did:plc:peer'] } }, { name: 'static-json', config: { base_url: 'https://haven.example' } }] };
  writeStaticSurface({ dir, items, allItems, manifest, config: cfg });
  const km = JSON.parse(readFileSync(join(dir, 'public', '.well-known', 'knowledge.json'), 'utf8'));
  assert.deepEqual(km.exchange.subscribed_domains, ['did:plc:peer', 'https://haven.example']);
});

test('only an explicit true discloses: false, absent, or a truthy non-boolean does not', () => {
  for (const v of [false, undefined, 'yes', 1]) {
    const dir = setup();
    writeStaticSurface({ dir, items, allItems, manifest, config: { ...config, publish: { ...config.publish, disclose_subscriptions: v } } });
    const km = JSON.parse(readFileSync(join(dir, 'public', '.well-known', 'knowledge.json'), 'utf8'));
    assert.deepEqual(km.exchange.subscribed_domains, [], String(v));
  }
});
