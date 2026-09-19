// packages/org-os-kms/src/atproto/client.mjs — the XRPC calls the publication plane needs. No SDK.
export class XrpcError extends Error {
  constructor(status, error, message) { super(`${error}: ${message}`); this.status = status; this.error = error; }
}

export function createClient({ pds, fetchImpl = globalThis.fetch }) {
  if (!pds) throw new Error('atproto: pds not configured');
  const base = pds.replace(/\/$/, '');
  let accessJwt = null;

  async function call(nsid, { method = 'GET', query, body } = {}) {
    const url = new URL(`${base}/xrpc/${nsid}`);
    for (const [k, v] of Object.entries(query || {})) if (v !== undefined) url.searchParams.set(k, v);
    const headers = { 'content-type': 'application/json' };
    if (accessJwt) headers.Authorization = `Bearer ${accessJwt}`;
    const res = await fetchImpl(url.toString(), { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) throw new XrpcError(res.status, json.error || 'Unknown', json.message || text);
    return json;
  }

  return {
    async login({ identifier, password }) { const s = await call('com.atproto.server.createSession', { method: 'POST', body: { identifier, password } }); accessJwt = s.accessJwt; return { did: s.did }; },
    putRecord({ repo, collection, rkey, record, swapRecord }) {
      return call('com.atproto.repo.putRecord', { method: 'POST', body: { repo, collection, rkey, record, validate: false, ...(swapRecord ? { swapRecord } : {}) } });
    },
    async deleteRecord({ repo, collection, rkey }) { await call('com.atproto.repo.deleteRecord', { method: 'POST', body: { repo, collection, rkey } }); },
    listRecords({ repo, collection, cursor, limit = 100 }) { return call('com.atproto.repo.listRecords', { query: { repo, collection, cursor, limit } }); },
    async listAllRecords({ repo, collection }) {
      const out = []; let cursor;
      do { const page = await this.listRecords({ repo, collection, cursor }); out.push(...page.records); cursor = page.cursor; } while (cursor);
      return out;
    },
    getLatestCommit({ did }) { return call('com.atproto.sync.getLatestCommit', { query: { did } }); },
  };
}
