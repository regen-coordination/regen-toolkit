// src/adapters/repo-data.mjs — the org-os instance target: per-schema registry
// files under data/kb/. Deliberately does NOT touch an instance's existing
// data/*.yaml (different shapes); @org-os/kms bridges the two.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import yaml from 'js-yaml';
import { slugify, deriveIndex, sameStoredObject, isOwnKey } from '../util.mjs';
import { hashContent } from '../workorder.mjs';
import { toJsonLdContext } from '../index.mjs';

function atomicWrite(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = join(dirname(path), `.${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}

function safeSchema(schema) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(String(schema))) throw new Error(`invalid schema name for storage: ${JSON.stringify(schema)}`);
  return schema;
}

export function slugFor(object) {
  return slugify(object.title || object.id || '') || `untitled-${hashContent(yaml.dump(object)).slice(0, 8)}`;
}

const fileFor = (target, schema) => join(target, 'data', 'kb', `${safeSchema(schema)}.yaml`);

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Normalize: a hand-edited/legacy file without an `entries:` key must not crash
// store/update. But a doc that IS present and NOT a mapping (scalar, list) can't
// be round-tripped through the mapping model — refuse loudly rather than coerce,
// because coercion would silently drop the existing content on the next write.
const loadFile = (p) => {
  if (!existsSync(p)) return { entries: {} };
  const doc = yaml.load(readFileSync(p, 'utf8'));
  if (doc !== null && doc !== undefined && !isPlainObject(doc)) {
    throw new Error(`not a registry file (expected a YAML mapping): ${p}`);
  }
  const d = doc || {};
  if ('entries' in d && !isPlainObject(d.entries)) {
    throw new Error(`registry file has a non-mapping "entries" key (hand-edited?) — refusing to touch it: ${p}`);
  }
  return { ...d, entries: d.entries || {} };
};

export const repoDataAdapter = {
  name: 'repo-data',

  store(target, entries) {
    const stored = [];
    const collisions = [];
    const byFile = new Map();
    for (const { schema, object, replaces } of entries) {
      const p = fileFor(target, schema);
      if (!byFile.has(p)) byFile.set(p, loadFile(p));
      const reg = byFile.get(p).entries;
      const slug = slugFor(object);
      let key = slug;
      // `replaces`: see kb-folder — honored only for an existing key in THIS schema's registry
      // file that derives from the entry's slug; anything else falls through to the normal path.
      const at = replaces ? replaces.lastIndexOf('#') : -1;
      const rKey = at > 0 ? replaces.slice(at + 1) : null;
      if (rKey !== null && resolve(replaces.slice(0, at)) === resolve(p) && reg[rKey] !== undefined && isOwnKey(rKey, slug)) {
        reg[rKey] = object;
        stored.push(replaces);
        continue;
      }
      if (reg[key] !== undefined && !sameStoredObject(reg[key], object)) {
        // Same title-slug, different object (B5): never clobber — give the
        // newcomer a hash-suffixed key and report the collision.
        key = `${slug}-${hashContent(yaml.dump(object)).slice(0, 8)}`;
        collisions.push({ schema, slug, key });
      }
      reg[key] = object;                                // idempotent: same identity overwrites in place
      stored.push(`${p}#${key}`);
    }
    for (const [p, doc] of byFile) atomicWrite(p, yaml.dump(doc));
    return { stored, collisions };
  },

  list(target) {
    const dir = join(target, 'data', 'kb');
    if (!existsSync(dir)) return [];
    const out = [];
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.yaml'))) {
      const schema = f.replace(/\.yaml$/, '');
      const doc = loadFile(join(dir, f));
      for (const [slug, object] of Object.entries(doc.entries || {})) {
        out.push({ schema, object, ref: `${join(dir, f)}#${slug}` });
      }
    }
    return out;
  },

  update(target, ref, patch) {
    // slugs are [a-z0-9-] and never contain '#', but the target path may — split at the LAST '#'
    const i = ref.lastIndexOf('#');
    const file = ref.slice(0, i);
    const slug = ref.slice(i + 1);
    const doc = loadFile(file);
    if (!doc.entries[slug]) throw new Error(`no entry "${slug}" in ${file}`);
    doc.entries[slug] = { ...doc.entries[slug], ...patch };
    atomicWrite(file, yaml.dump(doc));
    return { ref, object: doc.entries[slug] };
  },

  index(target) {
    return deriveIndex(this.list(target), 'data/kb/');
  },

  writeIndex(target) {
    const indexPath = join(target, 'data', 'kb', 'index.json');
    const contextPath = join(target, 'data', 'kb', 'context.jsonld');
    atomicWrite(indexPath, JSON.stringify(this.index(target), null, 2));
    atomicWrite(contextPath, JSON.stringify(toJsonLdContext(), null, 2));
    return { indexPath, contextPath };
  },
};
