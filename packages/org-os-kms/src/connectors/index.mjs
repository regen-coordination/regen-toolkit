// packages/org-os-kms/src/connectors/index.mjs — connector registry (composition root for source drivers).
// kms.yaml `connectors: [{ name, config, cursor? }]` names one of these; `ingest.pull` resolves it here (`cursor` only seeds data/kms-cursors.json).
import { atprotoConnector } from '../atproto/connector.mjs';
import { staticJsonConnector } from './static-json/index.mjs';

export const CONNECTORS = { atproto: atprotoConnector, 'static-json': staticJsonConnector };

export function getConnector(name, registry = CONNECTORS) {
  const c = registry[name];
  if (!c) throw new Error(`unknown connector: ${name} (available: ${Object.keys(registry).join(', ')})`);
  return c;
}
