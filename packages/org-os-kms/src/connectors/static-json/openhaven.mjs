// packages/org-os-kms/src/connectors/static-json/openhaven.mjs — pure mapper for https://www.openhaven.net/api (fields verified 2026-09-18).
// Open Haven "domains" are not KMS tracks, so /api/domains.json is deliberately unmapped (returns []).
const BASE = 'https://www.openhaven.net';
export const collections = ['/api/protocols.json', '/api/affordances.json'];

export function map({ collection, item }) {
  if (collection === '/api/protocols.json') return [{ schema: 'resource', object: {
    title: item.name, type: 'resource', url: item.communityLink, resource_type: item.entityType, notes: item.description,
    related_concepts: item.domainIds || [], original_source: `openhaven:${item.id}`, steward: item.owner, last_reviewed: item.lastInvestigated,
    sourceUri: `${BASE}/api/protocols/${item.id}.json`, // stable origin identity: runConnector upserts on it, so upstream edits apply
    source_lineage: `${BASE}/api/protocols/${item.id}.json` } }];
  if (collection === '/api/affordances.json') return [{ schema: 'signal', object: {
    title: item.name, type: 'signal', signal_type: 'resource', suggested_action: 'route',
    notes: [item.description, item.whatItEnables].filter(Boolean).join('\n\n'), related_concepts: item.domainIds || [],
    sourceUri: `${BASE}/api/affordances.json#${item.id}`,
    source_lineage: `${BASE}/api/affordances.json#${item.id}` } }];
  return [];
}
