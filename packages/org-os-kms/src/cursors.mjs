// src/cursors.mjs — ingest cursors live in a sidecar, not in kms.yaml.
// Rewriting kms.yaml re-serializes it and drops its comments (which explain why an instance is configured
// the way it is), so the cursor write-back targets data/kms-cursors.json instead: { version, cursors: { <key>: <cursor> } }.
// A `cursor:` in kms.yaml is only the SEED for a connector that has no sidecar entry yet (older configs keep working).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWrite } from './atomic-write.mjs';

export const CURSORS_PATH = 'data/kms-cursors.json';

export function readCursors(dir) {
  const p = join(dir, CURSORS_PATH);
  if (!existsSync(p)) return {};
  let doc;
  try { doc = JSON.parse(readFileSync(p, 'utf8')); }
  catch (e) { throw new Error(`${CURSORS_PATH} is not valid JSON (${e.message}); fix or remove it. Refusing to guess cursors.`); }
  if (!doc || typeof doc.cursors !== 'object' || doc.cursors === null || Array.isArray(doc.cursors)) {
    throw new Error(`${CURSORS_PATH} must look like { "version": 1, "cursors": { "<connector>": <cursor> } }`);
  }
  return doc.cursors;
}

// Merge `changes` into a FRESH read of the sidecar (the pulls are slow; another run may have written meanwhile).
export function writeCursors(dir, changes) {
  const next = { ...readCursors(dir), ...changes };
  atomicWrite(join(dir, CURSORS_PATH), `${JSON.stringify({ version: 1, cursors: next }, null, 2)}\n`);
}

// A connector's sidecar key is its name; a repeated name gets `#2`, `#3`, ... in declaration order.
export function cursorKeys(declared) {
  const seen = {};
  return declared.map(({ name }) => { seen[name] = (seen[name] || 0) + 1; return seen[name] === 1 ? name : `${name}#${seen[name]}`; });
}
