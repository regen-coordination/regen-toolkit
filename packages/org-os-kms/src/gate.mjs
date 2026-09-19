// packages/org-os-kms/src/gate.mjs — the instance gate hook. Framework gate is the floor; this can only narrow.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { slugFromRef } from './manifest.mjs';

export async function loadInstanceGate(dir, config) {
  const rel = config.publish?.gate;
  if (!rel) return null;
  const mod = await import(pathToFileURL(join(dir, rel)).href);
  if (typeof mod.isPublishable !== 'function') throw new Error(`publish.gate ${rel} does not export isPublishable(obj, ctx)`);
  return mod.isPublishable;
}

export function buildGateContext(allItems) {
  const sourceSystems = {}; const boundaries = [];
  for (const { schema, ref, object } of allItems) {
    if (schema === 'source-system') sourceSystems[slugFromRef(ref)] = { ...object, slug: slugFromRef(ref) };
    if (schema === 'public-use-boundary' || Object.prototype.hasOwnProperty.call(object, 'tier')) boundaries.push(object);
  }
  return { sourceSystems, boundaries };
}

export function applyGate(gate, items, ctx) {
  const passed = []; const rejected = [];
  for (const it of items) {
    const v = gate({ ...it.object, type: it.object.type ?? it.schema, slug: slugFromRef(it.ref) }, ctx);
    const ok = typeof v === 'boolean' ? v : Boolean(v?.ok);
    if (ok) passed.push(it); else rejected.push({ slug: slugFromRef(it.ref), reason: (typeof v === 'object' && v?.reason) || 'rejected by instance gate' });
  }
  return { passed, rejected };
}
