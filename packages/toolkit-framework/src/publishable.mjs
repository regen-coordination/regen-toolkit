// packages/toolkit-framework/src/publishable.mjs — the publication gate (floor) and the outbound projection. Keyed on the adapter's schema, never object.type.
export const PUBLISHABLE_TYPES = Object.freeze([
  'claim-evidence', 'concept-lineage', 'encyclopedia-entry', 'implementation-record',
  'option-entry', 'organization', 'relationship-record', 'resource', 'signal', 'track',
]);
export const OPT_IN_TYPES = Object.freeze(['source-system', 'public-use-boundary']);
export const ALL_TYPES = Object.freeze([...PUBLISHABLE_TYPES, ...OPT_IN_TYPES]);
export const PUBLISHABLE_PUBLIC_USE = Object.freeze([
  'ok-with-caveat', 'source-linked-unreviewed', 'reviewed-for-explanation', 'reviewed-for-guidance',
]);
// Editorial internals that never leave the instance (records, static entries, published stores).
export const PRIVATE_FIELDS = Object.freeze([
  'notes', 'work_order', 'reviewed_by', 'review_needs', 'interpretation', 'uncertainty', 'tensions',
  'risks_of_flattening', 'high_risk', 'consent_note', 'salvaged_from', 'legacy_status', 'additional_provenance',
]);

export function publishableTypes(config = {}) {
  const optIn = config.publish?.types_opt_in ?? [];
  const optOut = config.publish?.types_opt_out ?? [];
  for (const t of [...optIn, ...optOut]) {
    if (t === 'person') throw new Error('person is never publishable');
    if (!ALL_TYPES.includes(t)) throw new Error(`unknown publishable type: ${t}`);
  }
  return [...new Set([...PUBLISHABLE_TYPES, ...optIn])].filter((t) => !optOut.includes(t));
}

export function isPublishable(object, { schema = object?.type, types = PUBLISHABLE_TYPES } = {}) {
  if (!object || typeof object !== 'object') return false;
  // `held` (set on an origin retraction, or by an operator to withhold) is the one maturity the floor
  // refuses: it un-publishes on the next apply. Every other maturity is the instance gate's call.
  return types.includes(schema) && PUBLISHABLE_PUBLIC_USE.includes(object.public_use) && object.maturity !== 'held';
}

export function publicView(object) {
  const out = {};
  for (const [k, v] of Object.entries(object)) if (!PRIVATE_FIELDS.includes(k)) out[k] = v;
  if (out.provenance && typeof out.provenance === 'object') { const { surfaced_by, ...p } = out.provenance; out.provenance = p; }
  return out;
}
