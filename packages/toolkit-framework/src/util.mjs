// src/util.mjs — dependency-free helpers shared across the package.
import yaml from 'js-yaml';
import { hashContent } from './workorder.mjs';

/** Stable, file-safe slug from a title. */
export function slugify(s) {
  return String(s).toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics (combining marks)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The single definition of "awaiting review" — used by reviewQueue AND the derived index. */
export function isAwaitingReview(object) {
  return object.maturity === 'raw' || object.maturity === 'held' || object.ai_assisted === true;
}

// Two stored objects are "the same object" (idempotent update) when their ids match,
// or — lacking ids — when their content hashes match. Distinct objects that merely
// share a title-slug are NOT the same object (the B5 data-loss surface: two different
// contributions with the same title must never silently clobber one another).
export function sameStoredObject(a, b) {
  if (a && b && a.id != null && b.id != null) return a.id === b.id;
  return hashContent(yaml.dump(a)) === hashContent(yaml.dump(b));
}

// A stored key belongs to `slug` when it IS the slug or the hash-suffixed variant an adapter
// issues on a B5 collision (`<slug>-<8 hex>`). Gates `replaces` (see storage.mjs): a caller's
// ref may only supersede an object whose key derives from the entry's own title.
export function isOwnKey(key, slug) {
  return key === slug || (key.startsWith(`${slug}-`) && /^[0-9a-f]{8}$/.test(key.slice(slug.length + 1)));
}

/**
 * Shared derived-index computation over an adapter's list() output.
 * Lives here (a leaf module) rather than storage.mjs so adapters can import it
 * without pulling in the adapter registry (which would re-import every adapter,
 * including the one currently loading — a TDZ cycle when the adapter is the
 * entry module; see kb-folder/repo-data's slugify import for the same reason).
 */
export function deriveIndex(items, from) {
  const by_type = {}; const by_maturity = {};
  let review_queue = 0;
  for (const { schema, object } of items) {
    by_type[schema] = (by_type[schema] || 0) + 1;
    if (object.maturity) by_maturity[object.maturity] = (by_maturity[object.maturity] || 0) + 1;
    if (isAwaitingReview(object)) review_queue += 1;
  }
  return { total: items.length, by_type, by_maturity, review_queue, generated_from: `derived — rebuildable from ${from}` };
}
