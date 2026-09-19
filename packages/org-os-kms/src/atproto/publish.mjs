// packages/org-os-kms/src/atproto/publish.mjs — plan (pure) then apply. Validation all-or-nothing; application per-record.
import { createHash } from 'node:crypto';
import * as fw from '../framework.mjs';
import { rewriteRefs, resolverFrom } from '../refs.mjs';
import { slugFromRef } from '../manifest.mjs';

function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
export function contentHash(record) { return createHash('sha256').update(stable(record)).digest('hex'); }

export function planPublish({ items, manifest, did, authority }) {
  const lexicons = fw.generateAll({ authority });
  const resolve = resolverFrom(manifest);
  const plan = { ok: true, errors: [], create: [], update: [], delete: [], skip: [], previous: manifest.objects };
  const seen = new Set();
  for (const { schema, object, ref } of items) {
    const collection = fw.nsidFor(schema, authority);
    const slug = slugFromRef(ref);
    const record = fw.toRecord(rewriteRefs(object, resolve, schema), collection);
    const v = fw.validateRecord(record, lexicons[collection]);
    if (!v.ok) { plan.errors.push({ slug, errors: v.errors }); continue; }
    const id = object.id; seen.add(id);
    const hash = contentHash(record);
    const prev = manifest.objects[id];
    const op = { id, slug, type: schema, collection, rkey: id, record, hash };
    if (!prev) plan.create.push(op); else if (prev.hash === hash) plan.skip.push(id); else plan.update.push({ ...op, swapRecord: prev.cid });
  }
  for (const [id, prev] of Object.entries(manifest.objects)) if (!seen.has(id)) plan.delete.push({ id, slug: prev.slug, type: prev.type, collection: fw.nsidFor(prev.type, authority), rkey: prev.rkey });
  return plan.errors.length ? { ...plan, ok: false, create: [], update: [], delete: [], skip: [] } : plan;
}

export async function applyPublish(plan, { client, did, now = () => new Date().toISOString() }) {
  if (!plan.ok) throw new Error('applyPublish called with a failed plan');
  const manifest = { version: 1, objects: {} };
  for (const id of plan.skip) manifest.objects[id] = plan.previous[id];
  const out = { applied: { created: 0, updated: 0, deleted: 0 }, failures: [], manifest };
  for (const [kind, ops] of [['created', plan.create], ['updated', plan.update]]) {
    for (const op of ops) {
      try {
        const { uri, cid } = await client.putRecord({ repo: did, collection: op.collection, rkey: op.rkey, record: op.record, swapRecord: op.swapRecord });
        manifest.objects[op.id] = { slug: op.slug, type: op.type, rkey: op.rkey, atUri: uri, cid, hash: op.hash, publishedAt: now() };
        out.applied[kind]++;
      } catch (e) { out.failures.push({ id: op.id, error: e.message }); if (kind === 'updated') manifest.objects[op.id] = plan.previous[op.id]; }
    }
  }
  for (const op of plan.delete) {
    try { await client.deleteRecord({ repo: did, collection: op.collection, rkey: op.rkey }); out.applied.deleted++; }
    catch (e) { out.failures.push({ id: op.id, error: e.message }); manifest.objects[op.id] = plan.previous[op.id]; }
  }
  return out;
}
