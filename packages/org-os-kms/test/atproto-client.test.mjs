import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, XrpcError } from '../src/atproto/client.mjs';

function fakeFetch(routes) {
  const calls = [];
  const f = async (url, init = {}) => {
    const u = new URL(url); const nsid = u.pathname.split('/xrpc/')[1];
    calls.push({ nsid, method: init.method || 'GET', headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : undefined, query: Object.fromEntries(u.searchParams) });
    const r = routes[nsid];
    if (!r) return new Response(JSON.stringify({ error: 'NotFound', message: 'no route' }), { status: 404 });
    const out = typeof r === 'function' ? r(calls.at(-1)) : r;
    return new Response(JSON.stringify(out.body ?? out), { status: out.status ?? 200, headers: { 'content-type': 'application/json' } });
  };
  f.calls = calls; return f;
}

test('pds is required', () => { assert.throws(() => createClient({ pds: null }), /pds not configured/); });

test('login stores the token; putRecord sends Bearer, swapRecord and validate:false', async () => {
  const fetchImpl = fakeFetch({ 'com.atproto.server.createSession': { accessJwt: 'JWT', did: 'did:plc:abc' }, 'com.atproto.repo.putRecord': { uri: 'at://did:plc:abc/x.y/k', cid: 'bafy1' } });
  const c = createClient({ pds: 'https://pds.test', fetchImpl });
  const { did } = await c.login({ identifier: 'kc.test', password: 'pw' });
  assert.equal(did, 'did:plc:abc');
  const res = await c.putRecord({ repo: did, collection: 'x.y', rkey: 'k', record: { $type: 'x.y', title: 'T' }, swapRecord: 'bafy0' });
  assert.deepEqual(res, { uri: 'at://did:plc:abc/x.y/k', cid: 'bafy1' });
  const put = fetchImpl.calls[1];
  assert.equal(put.headers.Authorization, 'Bearer JWT');
  assert.deepEqual(put.body, { repo: 'did:plc:abc', collection: 'x.y', rkey: 'k', record: { $type: 'x.y', title: 'T' }, validate: false, swapRecord: 'bafy0' });
});

test('listAllRecords follows cursor; getLatestCommit GETs did', async () => {
  let page = 0;
  const fetchImpl = fakeFetch({
    'com.atproto.repo.listRecords': () => (page++ === 0 ? { records: [{ uri: 'at://d/c/1', cid: 'c1', value: { a: 1 } }], cursor: 'next' } : { records: [{ uri: 'at://d/c/2', cid: 'c2', value: { a: 2 } }] }),
    'com.atproto.sync.getLatestCommit': { cid: 'ccid', rev: '3abc' },
  });
  const c = createClient({ pds: 'https://pds.test', fetchImpl });
  assert.equal((await c.listAllRecords({ repo: 'd', collection: 'c' })).length, 2);
  assert.equal(fetchImpl.calls[1].query.cursor, 'next');
  assert.deepEqual(await c.getLatestCommit({ did: 'd' }), { cid: 'ccid', rev: '3abc' });
});

test('non-2xx → XrpcError', async () => {
  const c = createClient({ pds: 'https://pds.test', fetchImpl: fakeFetch({ 'com.atproto.repo.deleteRecord': { status: 400, body: { error: 'InvalidSwap', message: 'modified' } } }) });
  await assert.rejects(c.deleteRecord({ repo: 'd', collection: 'c', rkey: 'k' }), (e) => e instanceof XrpcError && e.status === 400 && e.error === 'InvalidSwap');
});
