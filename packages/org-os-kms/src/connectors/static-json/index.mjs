// packages/org-os-kms/src/connectors/static-json/index.mjs — a static source: read-only JSON + discovery doc, no protocol client.
import { createHash } from 'node:crypto';
import * as openhaven from './openhaven.mjs';

export const MAPPERS = { openhaven };

export function createStaticJsonConnector({ fetchImpl = globalThis.fetch, mappers = MAPPERS } = {}) {
  const get = async (url) => { const r = await fetchImpl(url); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.text(); };
  return {
    name: 'static-json', protocol: 'static JSON over HTTPS', capabilities: { ingest: true, subscribe: false, publish: false },
    describe(config) { return { title: `Static source ${new URL(config.base_url).hostname}`, type: 'dataset', steward: 'external', return_path: config.base_url, endpoint: config.base_url + (config.index || '/api/index.json') }; },
    async pull(config, { cursor }) {
      // The index is a static discovery doc (no counts/versions), so the cursor hashes the index PLUS every collection body, in fixed order.
      const indexBody = await get(config.base_url + (config.index || '/api/index.json'));
      const mapper = mappers[config.mapper];
      if (!mapper) throw new Error(`static-json: unknown mapper ${config.mapper}`);
      const bodies = [];
      for (const collection of config.collections || mapper.collections) bodies.push({ collection, body: await get(config.base_url + collection) });
      const hash = createHash('sha256').update(indexBody + bodies.map((b) => b.body).join('')).digest('hex');
      if (hash === cursor) return { records: [], cursor };
      const records = [];
      for (const { collection, body } of bodies) for (const item of JSON.parse(body)) records.push({ collection, item });
      return { records, cursor: hash };
    },
    map(record, config) { return mappers[config.mapper].map(record); },
  };
}
export const staticJsonConnector = createStaticJsonConnector();
