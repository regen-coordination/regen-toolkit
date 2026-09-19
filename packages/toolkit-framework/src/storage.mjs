// src/storage.mjs — seam 2: ingestion ≠ storage. One interface, swappable targets.
//
// Adapter = {
//   name: string,
//   store(target, entries)      // entries: [{ schema, object, replaces? }] → { stored: [ref], collisions }; atomic per object; idempotent by id, else by content
//                               // replaces: a ref this adapter issued for the SAME object — the new version is written there (replace, not merge; same ref back).
//                               // Honored only for an existing key of the entry's own schema whose key derives from its title slug; otherwise ignored.
//   list(target)                // → [{ schema, object, ref }] — refs identical to what store() issued
//   update(target, ref, patch)  // shallow-merge patch into the stored object; atomic → { ref, object }
//   index(target)               // → { total, by_type, by_maturity, review_queue, generated_from } — DERIVED, rebuildable
//   writeIndex(target)          // persist index.json + context.jsonld next to the objects → { indexPath, contextPath }
// }
//
// Contract semantics (pinned by test/adapters.test.mjs):
// - Methods use `this` internally — call them ON the adapter object; never destructure them off it.
// - Refs are adapter-opaque tokens: only valid with the adapter that issued them. Do not parse
//   or construct them outside the adapter (e.g. kb-folder refs are file paths; repo-data refs
//   are `<file>#<slug>`).
import { kbFolderAdapter } from './adapters/kb-folder.mjs';
import { repoDataAdapter } from './adapters/repo-data.mjs';
import { geoAdapter } from './adapters/geo.mjs';

const ADAPTERS = { 'kb-folder': kbFolderAdapter, 'repo-data': repoDataAdapter, geo: geoAdapter };

export function listAdapters() { return Object.keys(ADAPTERS); }

export function getAdapter(name) {
  const a = ADAPTERS[name];
  if (!a) throw new Error(`unknown storage adapter: ${name} (available: ${listAdapters().join(', ')})`);
  return a;
}

// deriveIndex + isAwaitingReview live in util.mjs (a leaf module) — see its docstring for why.
export { slugify, deriveIndex, isAwaitingReview } from './util.mjs';
