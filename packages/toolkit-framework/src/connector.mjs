// src/connector.mjs — seam 3: a Connector is a source driver (2026-07-19 spec).
// runConnector sequences describe → pull → map → validate → upsert/store → card → retract.
// Dry-aware (dry writes nothing); each candidate is validated AS IT WILL BE STORED.
import { getAdapter, slugify } from './storage.mjs';
import { validateObject, checkInvariants } from './index.mjs';
import { slugFor } from './adapters/repo-data.mjs';   // the adapter's own slug rule (title → id → untitled-<hash>), so collision detection mirrors store()

export class NOT_IMPLEMENTED extends Error {
  constructor(name) { super(`connector ${name}: pull not implemented`); this.code = 'NOT_IMPLEMENTED'; }
}

// Local identity + review state that an origin update must never overwrite.
const LOCAL_ONLY = ['id', 'maturity', 'public_use', 'review_needs'];

// Not content: work_order is stamped with the pull time, and review_needs is SET by an update. Neither
// may make an unchanged record look changed, or one peer rev bump re-flags the whole peer for review.
const NOT_CONTENT = ['work_order', 'review_needs'];
const sortKeys = (v) => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, sortKeys(x)]))
  : Array.isArray(v) ? v.map(sortKeys) : v);
function sameContent(a, b) {
  const strip = (o) => { const c = { ...o }; for (const k of NOT_CONTENT) delete c[k]; return JSON.stringify(sortKeys(c)); };
  return strip(a) === strip(b);
}

export async function runConnector(connector, { config, cursor, adapter, target, dry = false, now = () => new Date().toISOString() }) {
  const source = connector.describe(config);
  const { records, cursor: nextCursor, retracted = [], errors = [] } = await connector.pull(config, { cursor });
  const a = getAdapter(adapter);
  const local = a.list(target);
  const byOrigin = new Map(local.filter((i) => i.object.sourceUri).map((i) => [i.object.sourceUri, i]));
  const stamp = now();

  // The slug a stored object lives under: the ref's part after the LAST '#' (repo-data refs are `<file>#<slug>`).
  const refSlug = (i) => (i.ref.includes('#') ? i.ref.slice(i.ref.lastIndexOf('#') + 1) : slugFor(i.object));
  const taken = new Set(local.map((i) => `${i.schema}:${refSlug(i)}`));

  // Flatten mapped objects; if several share a sourceUri within one pull, only the LAST is applied.
  const mapped = [];
  for (const r of records) for (const m of connector.map(r, config)) mapped.push(m);
  const lastByOrigin = new Map();
  mapped.forEach((m, idx) => { if (m.object.sourceUri) lastByOrigin.set(m.object.sourceUri, idx); });

  const toStore = []; const toUpdate = []; const invalid = []; const collided = []; let unchanged = 0;
  mapped.forEach(({ schema, object }, idx) => {
    if (object.sourceUri && lastByOrigin.get(object.sourceUri) !== idx) return;
    const base = { ...object, ai_assisted: object.ai_assisted ?? true,
      work_order: `connector:${connector.name}:${stamp}`,
      source_lineage: object.sourceUri ?? object.source_lineage ?? source.return_path,
      provenance: { origin: `${connector.name}:${source.return_path || source.title}`, ...(object.provenance || {}) } };
    // Whatever the origin claims, what we hold is raw + not-public-yet: validate THAT, not the origin's claim.
    const candidate = { ...base, maturity: 'raw', public_use: 'not-public-yet' };
    const v = validateObject(schema, candidate); const inv = checkInvariants(candidate);
    const errs = [...v.errors, ...(inv.violations || [])];
    if (errs.length) { invalid.push({ title: object.title, errors: errs }); return; }
    const existing = object.sourceUri && byOrigin.get(object.sourceUri);
    if (existing) {
      const patch = {}; for (const [k, x] of Object.entries(candidate)) if (!LOCAL_ONLY.includes(k)) patch[k] = x;
      patch.review_needs = 'updated at origin';
      // The kept local maturity/public_use must not clash with the incoming ai_assisted: keep the local value if so.
      let violations = checkInvariants({ ...existing.object, ...patch }).violations;
      if (violations.length) { delete patch.ai_assisted; violations = checkInvariants({ ...existing.object, ...patch }).violations; }
      if (violations.length) { invalid.push({ title: object.title, errors: violations }); return; }
      // What update() would write is what is already stored: nothing changed at the origin. Skip it entirely
      // (no rewrite, no re-flag) so a reviewer's own review_needs and the stored work_order are left alone.
      if (sameContent(existing.object, { ...existing.object, ...patch })) { unchanged++; return; }
      toUpdate.push({ ref: existing.ref, patch });
    } else {
      // Never clobber local data: a NEW candidate whose slug is already taken (locally or earlier in this batch) is skipped.
      const key = `${schema}:${slugFor(candidate)}`;
      if (taken.has(key)) { collided.push({ schema, title: object.title }); return; }
      taken.add(key);
      toStore.push({ schema, object: candidate });
    }
  });
  const report = { source, pulled: records.length, candidates: toStore.length + toUpdate.length, unchanged, invalid, stored: 0, updated: 0, collisions: collided.length, collided, cursor, retractions: 0, errors, dry };
  if (dry) return report;

  for (const u of toUpdate) a.update(target, u.ref, u.patch);
  const { stored } = toStore.length ? a.store(target, toStore) : { stored: [] };

  // The federation primitive is always written: the source's own card (never overwritten once it exists).
  const cardSlug = slugify(source.title);
  const existingCard = local.find((i) => i.schema === 'source-system' && slugify(i.object.title) === cardSlug);
  if (!existingCard) a.store(target, [{ schema: 'source-system', object: { ...source, maturity: 'raw', public_use: 'internal-only', ai_assisted: false } }]);

  let retractions = 0;
  if (retracted.length) {
    const set = new Set(retracted);
    for (const { object, ref } of a.list(target)) if (object.sourceUri && set.has(object.sourceUri)) { a.update(target, ref, { maturity: 'held', review_needs: `retracted at origin ${object.sourceUri}` }); retractions++; }
  }
  return { ...report, stored: stored.length, updated: toUpdate.length, retractions, cursor: nextCursor };
}
