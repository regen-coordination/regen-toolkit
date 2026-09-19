// src/manifest.mjs — the publish manifest: what this instance has on its publication plane.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';

export const MANIFEST_PATH = 'data/kms-published.json';

export function readManifest(dir) {
  const p = join(dir, MANIFEST_PATH);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { version: 1, objects: {} };
}

export function writeManifest(dir, manifest) {
  const p = join(dir, MANIFEST_PATH);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(manifest, null, 2) + '\n');
  return p;
}

export function slugIndex(manifest) {
  const ix = new Map();
  for (const e of Object.values(manifest.objects)) { if (!ix.has(e.slug)) ix.set(e.slug, []); ix.get(e.slug).push(e); }
  return ix;
}

export function slugFromRef(ref) {
  const i = ref.lastIndexOf('#');
  return i >= 0 ? ref.slice(i + 1) : basename(ref, extname(ref));
}
