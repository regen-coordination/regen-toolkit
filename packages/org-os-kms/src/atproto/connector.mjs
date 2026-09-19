// packages/org-os-kms/src/atproto/connector.mjs — pull peers' repos. Cursor {did: {rev, seen}}: skip unchanged peers; full list + seen-diff for retractions.
import * as fw from '../framework.mjs';
import { createClient as defaultCreateClient } from './client.mjs';

const originDid = (uri) => uri.split('/')[2];

export function createAtprotoConnector({ createClient = defaultCreateClient } = {}) {
  return {
    name: 'atproto', protocol: 'AT Protocol (XRPC listRecords)', capabilities: { ingest: true, subscribe: false, publish: false },
    describe(config) { return { title: 'AT Proto peers', type: 'knowledge-garden', steward: 'federation', return_path: (config.peers || []).join(',') || 'none', endpoint: config.pds }; },
    async pull(config, { cursor }) {
      const next = { ...(cursor || {}) };
      const peers = config.peers || [];
      if (!peers.length) return { records: [], cursor: next, retracted: [], errors: [] };
      const client = createClient({ pds: config.pds });
      const records = []; const retracted = []; const errors = [];
      for (const did of peers) {
        try {
          const { rev } = await client.getLatestCommit({ did });
          const prev = next[did] || { rev: null, seen: [] };
          if (prev.rev === rev) continue;
          const listed = [];
          for (const schema of fw.ALL_TYPES) listed.push(...await client.listAllRecords({ repo: did, collection: fw.nsidFor(schema, config.nsid_authority) }));
          const seen = listed.map((r) => r.uri);
          for (const u of prev.seen) if (!seen.includes(u)) retracted.push(u);
          records.push(...listed); next[did] = { rev, seen };
        } catch (e) { errors.push({ did, error: e.message }); }
      }
      return { records, cursor: next, retracted, errors };
    },
    map(record, config) {
      if (!record.value || typeof record.value !== 'object') return [];
      const { uri, value } = record;
      const schema = fw.typeForNsid(value.$type, config.nsid_authority);
      if (!schema) return [];
      const claimedSourceUri = typeof value.sourceUri === 'string' ? value.sourceUri : null;
      const sourceUri = claimedSourceUri || uri;
      if (originDid(sourceUri) === config.self) return [];
      if (claimedSourceUri) {
        const claimedOriginDid = originDid(claimedSourceUri);
        if (claimedOriginDid !== originDid(uri) && (config.peers || []).includes(claimedOriginDid)) return [];
      }
      const { $type, id, ...rest } = value;
      return [{ schema, object: { ...fw.publicView(rest), sourceUri, viaUri: uri } }];
    },
  };
}
export const atprotoConnector = createAtprotoConnector();
