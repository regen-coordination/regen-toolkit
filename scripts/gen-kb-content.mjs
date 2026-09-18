#!/usr/bin/env node
// scripts/gen-kb-content.mjs
// Normalizes both KB corpora (data/kb/ repo-data + kb-handoff/objects/ kb-folder)
// into one JSON snapshot at src/data/kb-content.json, so the /kb/ Astro pages can
// import it like any other build-time asset. Reuses the tested corpus loaders
// from generate-kb-viz.mjs. Derived output — rebuildable, runs in prebuild.

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadArticlesCorpus, loadHandoffCorpus, stripIdentityFields } from './generate-kb-viz.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// The 10-layer model (docs/layers/README.md, 2026-05-15 iteration).
export const LAYERS = {
  1: 'Ontology & Semantic Kernel',
  2: 'Knowledge Commons / Encyclopedia',
  3: 'Resource Graph & Ecosystem Atlas',
  4: 'Concept & Idea Ecology',
  5: 'Option Library',
  6: 'Deployment & Structural Integrity',
  7: 'Tracks & Composition',
  8: 'Implementation & Learning Memory',
  9: 'Evolution Layer',
  10: 'Infrastructure & Substrate',
};

// Type → layer. Covers every type in both corpora today plus the T4 additions
// (person/organization/relationship-record land with T3b). Unknown types → null,
// grouped as "Unmapped" on the pages — honest, not hidden.
export const LAYER_MAP = {
  'relationship-record': 1,
  'encyclopedia-entry': 2,
  'claim-evidence': 2,
  resource: 3,
  'source-system': 3,
  organization: 3,
  person: 3,
  'concept-lineage': 4,
  'option-entry': 5,
  'public-use-boundary': 6,
  track: 7,
  'implementation-record': 8,
  signal: 9,
  'update-proposal': 9,
};

export function withLayer(o) {
  return { ...o, layer: LAYER_MAP[o.type] ?? null };
}

// Depth-first over string values, remembering the nearest field name
// (arrays inherit the array's field name). Local copy of the generate-kb-viz
// idiom — that module doesn't export its walker.
function walkStrings(node, visit, field = null) {
  if (node == null) return;
  if (typeof node === 'string') { if (field) visit(field, node); return; }
  if (Array.isArray(node)) { for (const v of node) walkStrings(v, visit, field); return; }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) walkStrings(v, visit, k);
  }
}

// Object→object links from observed references: any string value that exactly
// equals another object's id, labeled by the field it sat in. One id can exist
// in both corpora → link to every match except the object itself. Sparse is honest.
export function deriveObjectLinks(objects) {
  const byId = new Map();
  for (const o of objects) {
    if (!byId.has(o.id)) byId.set(o.id, []);
    byId.get(o.id).push({ corpus: o.corpus, type: o.type, id: o.id });
  }
  return objects.map((o) => {
    const seen = new Set();
    const links = [];
    walkStrings(stripIdentityFields(o.data), (field, value) => {
      for (const hit of byId.get(value) ?? []) {
        if (hit.corpus === o.corpus && hit.type === o.type && hit.id === o.id) continue;
        const key = `${field}|${hit.corpus}/${hit.type}/${hit.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        links.push({ field, ...hit });
      }
    });
    return { ...o, links };
  });
}

export function buildSnapshot(objects) {
  const count = (keyFn) => {
    const out = {};
    for (const o of objects) {
      const k = keyFn(o);
      if (k == null) continue;
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  };
  return {
    generated_from: 'derived — rebuildable via scripts/gen-kb-content.mjs (prebuild)',
    total: objects.length,
    by_corpus: count((o) => o.corpus),
    by_type: count((o) => o.type),
    by_layer: count((o) => o.layer),
    // Absent maturity → 'raw' (deliberately unlike generate-kb-viz's 'unspecified'):
    // an unstamped object is certainly not reviewed, so it belongs in "awaiting review".
    by_maturity: count((o) => o.data?.maturity ?? 'raw'),
    layers: LAYERS,
    // Identity/provenance fields (id, grc20Id, sourceUri, viaUri) are not page content.
    objects: objects.map((o) => ({ ...o, data: stripIdentityFields(o.data) })),
  };
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const articles = loadArticlesCorpus(join(ROOT, 'data', 'kb'));
  const handoff = loadHandoffCorpus(join(ROOT, 'kb-handoff', 'objects'));
  const objects = deriveObjectLinks([...articles, ...handoff].map(withLayer));
  const snapshot = buildSnapshot(objects);
  const outPath = join(ROOT, 'src', 'data', 'kb-content.json');
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(
    `kb-content: ${snapshot.total} objects (${articles.length} articles + ${handoff.length} handoff) → src/data/kb-content.json`
  );
}
