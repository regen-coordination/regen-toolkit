import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAtprotoConnector } from '../src/atproto/connector.mjs';

const AUTH = 'xyz.regencoordination.kb'; const RES = `${AUTH}.resource`; const SS = `${AUTH}.sourceSystem`;
const fakeClient = (state) => () => ({
  async getLatestCommit({ did }) { if (state[did]?.down) throw new Error('ECONNREFUSED'); return { cid: 'c', rev: state[did].rev }; },
  async listAllRecords({ repo, collection }) { return (state[repo].records || []).filter((r) => r.uri.includes(`/${collection}/`)); },
});

test('map: origin sourceUri, viaUri, no id, type untouched; own-origin and unknown skipped', () => {
  const c = createAtprotoConnector({ createClient: () => ({}) });
  const cfg = { self: 'did:plc:me', nsid_authority: AUTH };
  const rec = { uri: `at://did:plc:peer/${RES}/rk1`, cid: 'cid', value: { $type: RES, title: 'T', type: 'resource', id: 'peer-id', grc20Id: 'g1', public_use: 'ok-with-caveat' } };
  const [cand] = c.map(rec, cfg);
  assert.equal(cand.schema, 'resource'); assert.equal(cand.object.sourceUri, rec.uri); assert.equal(cand.object.viaUri, rec.uri);
  assert.equal(cand.object.id, undefined); assert.equal(cand.object.grc20Id, 'g1'); assert.equal(cand.object.$type, undefined);
  const card = { uri: `at://did:plc:peer/${SS}/k`, cid: 'x', value: { $type: SS, title: 'Blog', type: 'blog', steward: 's', return_path: 'r' } };
  const [cc] = c.map(card, cfg);
  assert.equal(cc.schema, 'source-system'); assert.equal(cc.object.type, 'blog', 'kind preserved');
  const republished = { uri: `at://did:plc:peer/${RES}/rk2`, cid: 'x', value: { $type: RES, title: 'R', type: 'resource', sourceUri: `at://did:plc:origin/${RES}/o1` } };
  assert.equal(c.map(republished, cfg)[0].object.sourceUri, `at://did:plc:origin/${RES}/o1`);
  assert.deepEqual(c.map({ uri: `at://did:plc:peer/${RES}/rk3`, cid: 'x', value: { $type: RES, title: 'M', type: 'resource', sourceUri: `at://did:plc:me/${RES}/m1` } }, cfg), []);
  assert.deepEqual(c.map({ uri: 'at://did:plc:peer/com.other/x', cid: 'x', value: { $type: 'com.other' } }, cfg), []);
});

test('pull: no peers → no client, empty; unchanged rev skipped; retractions + unreachable reported', async () => {
  const c0 = createAtprotoConnector({ createClient: () => { throw new Error('must not be called'); } });
  assert.deepEqual(await c0.pull({ peers: [], pds: null, nsid_authority: AUTH }, { cursor: null }), { records: [], cursor: {}, retracted: [], errors: [] });

  const state = { 'did:plc:a': { rev: 'r2', records: [{ uri: `at://did:plc:a/${RES}/1`, cid: 'c', value: { $type: RES, title: '1', type: 'resource' } }] }, 'did:plc:b': { rev: 'r1' }, 'did:plc:c': { down: true } };
  const c = createAtprotoConnector({ createClient: fakeClient(state) });
  const cfg = { self: 'did:plc:me', nsid_authority: AUTH, pds: 'https://pds', peers: ['did:plc:a', 'did:plc:b', 'did:plc:c'] };
  const cursor = { 'did:plc:a': { rev: 'r1', seen: [`at://did:plc:a/${RES}/1`, `at://did:plc:a/${RES}/gone`] }, 'did:plc:b': { rev: 'r1', seen: [] } };
  const out = await c.pull(cfg, { cursor });
  assert.equal(out.records.length, 1); assert.deepEqual(out.retracted, [`at://did:plc:a/${RES}/gone`]);
  assert.equal(out.cursor['did:plc:a'].rev, 'r2'); assert.deepEqual(out.cursor['did:plc:b'], cursor['did:plc:b']);
  assert.equal(out.errors[0].did, 'did:plc:c');
});

test('describe is a valid card', () => {
  const card = createAtprotoConnector({ createClient: () => ({}) }).describe({ peers: ['did:plc:a'], pds: 'https://pds' });
  for (const k of ['title', 'type', 'steward', 'return_path']) assert.ok(card[k], k);
});

test('map: strips PRIVATE_FIELDS (reviewed_by, review_needs, notes, high_risk, consent_note, provenance.surfaced_by) via publicView', () => {
  const c = createAtprotoConnector({ createClient: () => ({}) });
  const cfg = { self: 'did:plc:me', nsid_authority: AUTH };
  const rec = { uri: `at://did:plc:peer/${RES}/rk1`, cid: 'cid', value: { $type: RES, title: 'T', type: 'resource', reviewed_by: 'x', review_needs: 'y', notes: 'z', high_risk: true, consent_note: 'cn', provenance: { surfaced_by: 'x', origin: 'o' } } };
  const [cand] = c.map(rec, cfg);
  assert.equal(cand.object.reviewed_by, undefined);
  assert.equal(cand.object.review_needs, undefined);
  assert.equal(cand.object.notes, undefined);
  assert.equal(cand.object.high_risk, undefined);
  assert.equal(cand.object.consent_note, undefined);
  assert.equal(cand.object.provenance.surfaced_by, undefined);
  assert.equal(cand.object.provenance.origin, 'o', 'provenance.origin kept');
  assert.equal(cand.object.title, 'T', 'ordinary fields kept');
});

test('map: ignores claimed sourceUri with origin DID in peers list; keeps claims about non-listed origins; keeps own-repo republished', () => {
  const c = createAtprotoConnector({ createClient: () => ({}) });
  const cfg = { self: 'did:plc:me', nsid_authority: AUTH, peers: ['did:plc:peer', 'did:plc:q'] };
  const fromPeer = { uri: `at://did:plc:peer/${RES}/rk1`, cid: 'x', value: { $type: RES, title: 'T', type: 'resource', sourceUri: `at://did:plc:q/${RES}/o1` } };
  assert.deepEqual(c.map(fromPeer, cfg), [], 'claimed origin in peers ignored');
  const outsideOrigin = { uri: `at://did:plc:peer/${RES}/rk2`, cid: 'x', value: { $type: RES, title: 'T2', type: 'resource', sourceUri: `at://did:plc:external/${RES}/o2` } };
  const [cand] = c.map(outsideOrigin, cfg);
  assert.equal(cand.object.sourceUri, `at://did:plc:external/${RES}/o2`, 'non-listed origin kept');
  const ownRepoRepublished = { uri: `at://did:plc:peer/${RES}/rk3`, cid: 'x', value: { $type: RES, title: 'T3', type: 'resource', sourceUri: `at://did:plc:peer/${RES}/o3` } };
  const [cr] = c.map(ownRepoRepublished, cfg);
  assert.equal(cr.object.sourceUri, `at://did:plc:peer/${RES}/o3`, 'same-repo origin kept (peer republishing own record)');
});

test('map: handles non-string sourceUri and missing value safely', () => {
  const c = createAtprotoConnector({ createClient: () => ({}) });
  const cfg = { self: 'did:plc:me', nsid_authority: AUTH };
  const nonStringSourceUri = { uri: `at://did:plc:peer/${RES}/rk1`, cid: 'x', value: { $type: RES, title: 'T', sourceUri: { not: 'string' } } };
  const [cand] = c.map(nonStringSourceUri, cfg);
  assert.equal(cand.object.sourceUri, `at://did:plc:peer/${RES}/rk1`, 'non-string sourceUri falls back to uri');
  const nullValue = { uri: `at://did:plc:peer/${RES}/rk2`, cid: 'x', value: null };
  assert.deepEqual(c.map(nullValue, cfg), [], 'null value returns empty');
  const missingValue = { uri: `at://did:plc:peer/${RES}/rk3`, cid: 'x' };
  assert.deepEqual(c.map(missingValue, cfg), [], 'missing value returns empty');
});
