// src/registry-bridge.mjs
// Bridges the framework's repo-data KB (<target>/data/kb/<schema>.yaml, entries keyed by
// slug) into the live org-os instance registries (data/<registry>.yaml, a top-level list
// keyed by id). Upsert-by-id: idempotent and NON-DESTRUCTIVE (never deletes instance-only
// rows, never clobbers unmapped top-level keys such as a schema_version header). Objects are
// grouped by target file so each registry is read+written once (linear, clean diffs).
// encyclopedia-entry is the markdown special case, written under a generated kb/ subdir so it
// can never overwrite a hand-authored article.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import * as fw from './framework.mjs';
import { REGISTRY_BINDINGS } from './bind.mjs';
import { atomicWrite } from './atomic-write.mjs';

// Upsert many objects into one registry file: read once, upsert each by id, write once.
function upsertRegistryMany(absPath, stem, objects) {
  let doc = {};
  if (existsSync(absPath)) doc = yaml.load(readFileSync(absPath, 'utf8')) || {};
  // Prefer the file's existing list key; for a new file fall back to the underscore form of
  // the filename stem (org-os registries key lists as e.g. `source_systems`, not `source-systems`).
  const key = Object.keys(doc).find((k) => Array.isArray(doc[k])) || stem.replace(/-/g, '_');
  if (!Array.isArray(doc[key])) doc[key] = [];
  const results = [];
  for (const obj of objects) {
    const slug = fw.slugify(obj.title || '');
    const id = obj.id || slug;
    const row = { id, ...obj };
    // Match by the current id OR the title slug: a row bridged before the object was minted an id is
    // keyed by the slug, and must migrate slug -> id in place rather than be duplicated.
    const i = doc[key].findIndex((e) => e.id === id || e.id === slug);
    if (i >= 0) doc[key][i] = { ...doc[key][i], ...row };
    else doc[key].push(row);
    results.push({ registry: absPath, key, id, action: i >= 0 ? 'update' : 'insert' });
  }
  atomicWrite(absPath, yaml.dump(doc, { lineWidth: -1 }));
  return results;
}

function writeMarkdownDoc(absPath, obj) {
  const { title = 'Untitled', body = '', ...rest } = obj;
  const fm = yaml.dump({ title, ...rest }, { lineWidth: -1 }).trim();
  atomicWrite(absPath, `---\n${fm}\n---\n\n${body}\n`);
  return { doc: absPath };
}

// Markdown pages are the public site (frontmatter carries the object's fields). Never write one for an
// object the publication floor would refuse for these reasons: still `not-public-yet` (e.g. freshly pulled
// from a peer), `internal-only`, or `held` (retracted at origin / withheld). No declared public_use keeps the
// old behavior. Registry rows are internal state and are not gated. Existing pages are never deleted.
function withholdReason(obj) {
  if (obj.public_use === 'not-public-yet' || obj.public_use === 'internal-only') return obj.public_use;
  if (obj.maturity === 'held') return 'held';
  return null;
}

export function bridge(ctx) {
  const { dir, config } = ctx;
  const items = fw.getAdapter(config.adapter).list(join(dir, config.target));
  const report = { bridged: [], docs: [], withheld: [], skipped: [], errors: [] };
  const byRegistry = new Map(); // registryPath -> [objects]

  for (const { schema, object } of items) {
    const registry = REGISTRY_BINDINGS[schema];
    if (!registry) { if (!report.skipped.includes(schema)) report.skipped.push(schema); continue; }
    if (registry.endsWith('/')) {
      const reason = withholdReason(object);
      if (reason) { report.withheld.push({ schema, title: object.title, reason }); continue; }
      try {
        const slug = fw.slugify(object.title || 'untitled');
        report.docs.push(writeMarkdownDoc(join(dir, registry, `${slug}.md`), object).doc);
      } catch (e) { report.errors.push(`${schema}: ${e.message}`); }
      continue;
    }
    if (!byRegistry.has(registry)) byRegistry.set(registry, []);
    byRegistry.get(registry).push(object);
  }

  for (const [registry, objects] of byRegistry) {
    try {
      const stem = registry.replace(/^data\//, '').replace(/\.yaml$/, '');
      report.bridged.push(...upsertRegistryMany(join(dir, registry), stem, objects));
    } catch (e) { report.errors.push(`${registry}: ${e.message}`); }
  }
  return { ok: report.errors.length === 0, report };
}
