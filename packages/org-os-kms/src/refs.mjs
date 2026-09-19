// packages/org-os-kms/src/refs.mjs — slug → origin AT-URI at publish time (spec Q19). Pure.
import { slugIndex } from './manifest.mjs';

export const REF_ARRAY_FIELDS = ['related_concepts', 'related_options', 'related_resources', 'source_traditions'];
export const REF_STRING_FIELDS = ['subject', 'object'];
const isAtUri = (v) => typeof v === 'string' && v.startsWith('at://');

export function resolverFrom(manifest) {
  const ix = slugIndex(manifest);
  return (slug) => { const h = ix.get(slug); return h && h.length === 1 && h[0].atUri ? h[0].atUri : null; };
}

export function rewriteRefs(object, resolve, schema) {
  const out = { ...object };
  const one = (v) => (isAtUri(v) ? v : (resolve(v) ?? v));
  for (const f of REF_ARRAY_FIELDS) if (Array.isArray(out[f])) out[f] = out[f].map(one);
  if (schema === 'relationship-record') for (const f of REF_STRING_FIELDS) if (typeof out[f] === 'string') out[f] = one(out[f]);
  return out;
}
