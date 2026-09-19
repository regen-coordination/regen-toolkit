// packages/toolkit-framework/src/lexicon.mjs — yaml schema → AT Proto Lexicon. Generated, never hand-edited. Lexicon objects are open (unknown fields allowed).
import { loadSchema } from './index.mjs';
import { ALL_TYPES, publicView } from './publishable.mjs';

const MAX_RECORD_BYTES = 1_000_000;
const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export function nsidFor(schema, authority) { return `${authority}.${camel(schema)}`; }

export function typeForNsid(nsid, authority) {
  if (!nsid || !nsid.startsWith(`${authority}.`)) return null;
  const schema = kebab(nsid.slice(authority.length + 1));
  return ALL_TYPES.includes(schema) ? schema : null;
}

export function flattenSchema(name) {
  const chain = [];
  for (let s = loadSchema(name); s; s = s.extends ? loadSchema(s.extends) : null) chain.unshift(s);
  const fields = {}; const required = [];
  for (const s of chain) {
    Object.assign(fields, s.fields || {});
    for (const r of s.required || []) if (!required.includes(r)) required.push(r);
  }
  return { required, fields };
}

const axisValues = (axis) => {
  const axes = loadSchema('review-maturity').axes;
  if (!axes[axis]) return [];
  return axes[axis].values;
};

function toProperty(def) {
  if (def.enum) return { type: 'string', knownValues: [...def.enum] };
  if (def.axis) return { type: 'string', knownValues: [...axisValues(def.axis)] };
  if (def.type === 'boolean') return { type: 'boolean' };
  if (def.type === 'array') return { type: 'array', items: { type: 'string' } };
  if (def.type === 'integer') return { type: 'integer' };
  return { type: 'string' };
}

export function generateLexicon(schema, { authority }) {
  const { required, fields } = flattenSchema(schema);
  const properties = {};
  for (const [k, def] of Object.entries(fields)) properties[k] = toProperty(def);
  return { lexicon: 1, id: nsidFor(schema, authority), defs: { main: { type: 'record', key: 'any', record: { type: 'object', required: [...required], properties } } } };
}

export function generateAll({ authority }) {
  const out = {};
  for (const t of ALL_TYPES) { const d = generateLexicon(t, { authority }); out[d.id] = d; }
  return out;
}

export function toRecord(object, nsid) {
  const clean = (v) => {
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) if (x !== undefined && x !== null) o[k] = clean(x); return o; }
    return v;
  };
  return { $type: nsid, ...clean(publicView(object)) };
}

function findFloat(v, path = '') {
  if (typeof v === 'number' && !Number.isInteger(v)) return path || '(root)';
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) { const p = findFloat(v[i], `${path}[${i}]`); if (p) return p; } }
  else if (v && typeof v === 'object') { for (const [k, x] of Object.entries(v)) { const p = findFloat(x, path ? `${path}.${k}` : k); if (p) return p; } }
  return null;
}

export function validateRecord(record, doc) {
  const errors = [];
  const main = doc.defs.main.record;
  if (record.$type !== doc.id) errors.push(`$type must be ${doc.id}, got ${record.$type}`);
  for (const r of main.required) if (record[r] === undefined || record[r] === null || record[r] === '') errors.push(`missing required field: ${r}`);
  for (const [k, p] of Object.entries(main.properties)) {
    const v = record[k];
    if (v === undefined) continue;
    if (p.type === 'array' && !Array.isArray(v)) errors.push(`${k} must be an array`);
    if (p.type === 'boolean' && typeof v !== 'boolean') errors.push(`${k} must be a boolean`);
    if (p.type === 'string' && typeof v !== 'string') errors.push(`${k} must be a string`);
    if (p.type === 'integer' && !Number.isInteger(v)) errors.push(`${k} must be an integer`);
  }
  const fp = findFloat(record);
  if (fp) errors.push(`float at ${fp} — AT Proto records have no floats`);
  const bytes = Buffer.byteLength(JSON.stringify(record), 'utf8');
  if (bytes > MAX_RECORD_BYTES) errors.push(`record exceeds 1 MB (${bytes} bytes)`);
  return { ok: errors.length === 0, errors };
}
