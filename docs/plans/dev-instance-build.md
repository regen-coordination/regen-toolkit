# Dev Instance Build — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the framework-reprocessed KB (722 article objects + 146 handoff objects) as browsable content pages — by type and by layer, with provenance, raw-status badges, related-object links, and old-article cross-links — deployed live from Luiz's personal fork so the review gate starts now.

**Architecture:** A prebuild script (`scripts/gen-kb-content.mjs`) reuses the already-tested corpus loaders from `scripts/generate-kb-viz.mjs` to normalize both corpora into one JSON snapshot (`src/data/kb-content.json`) — Vite imports JSON natively, YAML it doesn't. Three Astro page surfaces read the snapshot via `getStaticPaths`: a KB home (`/kb/`), per-type listings (`/kb/[corpus]/[type]/`), and per-object detail pages (`/kb/[corpus]/[type]/[slug]/`). Nothing ships client-side JS; it's all static build-time rendering, same as the existing summary pages.

**Tech Stack:** Astro 6 + Starlight (existing site), `js-yaml` (already a dependency), `node:test` for the script tests (same convention as `scripts/generate-kb-viz.test.mjs`).

**Spec:** `docs/plans/SESSION-HANDOFF-2026-07-19.md` Prompt 1 (the 07-19 decision) + the 2026-07-16 staging-site meeting plan (`memory/2026-07-16.md`). Plan registered in `docs/plans/QUEUE.md` (#1 active); HEARTBEAT tasks `task-260719-luiz-dev-instance-build` / `-deploy`.

---

## Context an executor needs (read first, verify each)

- **Working dir:** `/Users/luizfernando/Desktop/Workspaces/Zettelkasten/03 Libraries/regen-coordination-os/repos/regen-toolkit`. Branch **`regen-toolkit-os`** (dev). **Never touch `main`/prod or push to `origin` in this plan.** Vault safety: no `git stash`/`clean`/`reset --hard`; scoped `git add` only.
- **Data shapes (verified 2026-07-19):**
  - `data/kb/<type>.yaml` (articles corpus, repo-data adapter): top-level `entries:` map of `slug → object`. 8 types, 722 objects. Skip files starting with `_` and non-YAML.
  - `kb-handoff/objects/<type>/<slug>.yaml` (handoff corpus, kb-folder adapter): one object per file. 7 types, 146 objects.
  - Objects carry `title`, `summary`, `maturity` (`raw`/`candidate`/`reviewed`/`deprecated`), `public_use`, `ai_assisted`, `provenance: {origin, transformation, authorship}`, `source_lineage`, `work_order`, plus type-specific fields (`related_concepts`, `related_resources`, `url`, `known_tensions`, …).
  - Articles-corpus `provenance.origin` looks like `src/content/docs/<slug>.md` → the live article renders at `/<slug>/`. Handoff origin looks like `Canonical_DB.xlsx#New Objects!row22` (no page — render as text).
- **Reusable code:** `scripts/generate-kb-viz.mjs` exports `loadArticlesCorpus(kbDir)` and `loadHandoffCorpus(objDir)`, both returning `[{ id, type, corpus, data }]`, already covered by `scripts/generate-kb-viz.test.mjs`. **Import these — do not rewrite loaders.**
- **Page conventions:** `src/layouts/Page.astro` layout; `const base = import.meta.env.BASE_URL; const withBase = (p) => base + String(p).replace(/^\//, "");` for links (`/` on Vercel, `/regen-toolkit/` on Pages); shared classes from `src/styles/theme.css` (`wrap`, `eyebrow`, `chip chip--clay`, `in-hero`, `in-stat-grid`, …) — see `src/pages/self-ingestion.astro` for the idiom.
- **Build:** `npm run prebuild` runs the three gen scripts; `npm run build` = `astro build`. Pages build: `GITHUB_PAGES=true npm run build` (sets `base: '/regen-toolkit/'`).
- **Deploy:** push `regen-toolkit-os` to remote `fork` (`luizfernandosg/regen-toolkit`) → `.github/workflows/deploy-pages.yml` deploys to `https://luizfernandosg.github.io/regen-toolkit/`. *(The workflow header comment says `explorience.github.io` — it was written for origin; on the fork it deploys to the fork's Pages URL. Don't “fix” the comment as part of this plan.)*
- **Honesty rule (non-negotiable):** every KB page must make the `raw` / under-review status unmistakable. Nothing here is promoted or published; this is a dev review surface.

## File structure

| File | Responsibility |
|---|---|
| Create `scripts/gen-kb-content.mjs` | Normalize both corpora → `src/data/kb-content.json`; stamp `layer` per object; derive `links` (exact-id references between objects) |
| Create `scripts/gen-kb-content.test.mjs` | `node:test` coverage for layer stamping, link derivation, snapshot shape |
| Create `src/data/kb-content.json` | Derived snapshot (committed, like `framework-manifest.json`; self-heals on prebuild) |
| Create `src/pages/kb/index.astro` | KB home: disclaimer hero, counts, browse by layer + by type |
| Create `src/pages/kb/[corpus]/[type]/index.astro` | Per-type listing (title + summary + maturity chip per object) |
| Create `src/pages/kb/[corpus]/[type]/[slug].astro` | Object detail: featured fields, provenance block, raw badge, related links, article cross-link, generic field dump |
| Modify `package.json` (scripts) | `gen:kb-content` + add to `prebuild` chain |
| Modify `astro.config.mjs` (sidebar) | New group “Reprocessed content (dev · raw, under review)” |
| Modify `src/layouts/Page.astro` (nav) | Add “Reprocessed KB” nav link |

---

### Task 1: The snapshot generator (`gen-kb-content.mjs`) — TDD

**Files:**
- Create: `scripts/gen-kb-content.test.mjs`
- Create: `scripts/gen-kb-content.mjs`

- [ ] **Step 1: Write the failing test**

```js
// scripts/gen-kb-content.test.mjs
// TDD for scripts/gen-kb-content.mjs — layer stamping, object-link derivation,
// and the snapshot shape the /kb/ pages consume.
// Run: node --test scripts/gen-kb-content.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LAYER_MAP, LAYERS, withLayer, deriveObjectLinks, buildSnapshot } from './gen-kb-content.mjs';

const obj = (corpus, type, id, data = {}) => ({ corpus, type, id, data });

test('LAYER_MAP covers every type present in both corpora today', () => {
  const present = [
    'claim-evidence', 'concept-lineage', 'encyclopedia-entry', 'public-use-boundary',
    'resource', 'signal', 'source-system', 'track',
    'implementation-record', 'option-entry',
  ];
  for (const t of present) {
    assert.ok(Number.isInteger(LAYER_MAP[t]), `missing layer for type: ${t}`);
    assert.ok(LAYERS[LAYER_MAP[t]], `layer ${LAYER_MAP[t]} has no name`);
  }
});

test('withLayer stamps the mapped layer, and null for unknown types', () => {
  assert.equal(withLayer(obj('articles', 'encyclopedia-entry', 'x')).layer, 2);
  assert.equal(withLayer(obj('handoff', 'option-entry', 'x')).layer, 5);
  assert.equal(withLayer(obj('articles', 'mystery-type', 'x')).layer, null);
});

test('deriveObjectLinks finds exact-id references, labels the field, skips self', () => {
  const a = obj('articles', 'concept-lineage', 'decentralization');
  const b = obj('articles', 'encyclopedia-entry', 'what-is-decentralization', {
    related_concepts: ['decentralization', 'not-a-known-id'],
    provenance: { origin: 'src/content/docs/what-is-decentralization.md' },
  });
  const linked = deriveObjectLinks([a, b]);
  const entry = linked.find((o) => o.id === 'what-is-decentralization');
  assert.deepEqual(entry.links, [
    { field: 'related_concepts', corpus: 'articles', type: 'concept-lineage', id: 'decentralization' },
  ]);
  // the concept has no outbound refs
  assert.deepEqual(linked.find((o) => o.id === 'decentralization').links, []);
});

test('deriveObjectLinks links one id across corpora (both targets), deduped per field', () => {
  const r1 = obj('articles', 'resource', 'giveconomy');
  const r2 = obj('handoff', 'resource', 'giveconomy');
  const s = obj('articles', 'signal', 'sig-1', { related: ['giveconomy', 'giveconomy'] });
  const linked = deriveObjectLinks([r1, r2, s]);
  const sig = linked.find((o) => o.id === 'sig-1');
  assert.equal(sig.links.length, 2); // one per target, duplicate value deduped
  assert.deepEqual(new Set(sig.links.map((l) => l.corpus)), new Set(['articles', 'handoff']));
});

test('buildSnapshot counts by corpus, type, layer, maturity — and keeps objects', () => {
  const objects = [
    withLayer(obj('articles', 'encyclopedia-entry', 'e1', { maturity: 'raw' })),
    withLayer(obj('articles', 'resource', 'r1', { maturity: 'reviewed' })),
    withLayer(obj('handoff', 'resource', 'r2', {})), // no maturity → counted as raw
  ].map((o) => ({ ...o, links: [] }));
  const snap = buildSnapshot(objects);
  assert.equal(snap.total, 3);
  assert.deepEqual(snap.by_corpus, { articles: 2, handoff: 1 });
  assert.deepEqual(snap.by_type, { 'encyclopedia-entry': 1, resource: 2 });
  assert.deepEqual(snap.by_layer, { 2: 1, 3: 2 });
  assert.deepEqual(snap.by_maturity, { raw: 2, reviewed: 1 });
  assert.equal(snap.objects.length, 3);
  assert.ok(snap.layers[3].includes('Resource Graph'));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/gen-kb-content.test.mjs`
Expected: FAIL — `Cannot find module ... gen-kb-content.mjs`

- [ ] **Step 3: Write the implementation**

```js
#!/usr/bin/env node
// scripts/gen-kb-content.mjs
// Normalizes both KB corpora (data/kb/ repo-data + kb-handoff/objects/ kb-folder)
// into one JSON snapshot at src/data/kb-content.json, so the /kb/ Astro pages can
// import it like any other build-time asset. Reuses the tested corpus loaders
// from generate-kb-viz.mjs. Derived output — rebuildable, runs in prebuild.

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadArticlesCorpus, loadHandoffCorpus } from './generate-kb-viz.mjs';

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
    walkStrings(o.data, (field, value) => {
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
    by_maturity: count((o) => o.data?.maturity ?? 'raw'),
    layers: LAYERS,
    objects,
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/gen-kb-content.test.mjs`
Expected: PASS (5 tests)

Also run the existing suite to prove nothing broke: `node --test scripts/generate-kb-viz.test.mjs` → PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-kb-content.mjs scripts/gen-kb-content.test.mjs
git commit -m "feat(kb-site): snapshot generator for browsable KB content (TDD; reuses kb-viz loaders)"
```

---

### Task 2: Wire into the build + generate the real snapshot

**Files:**
- Modify: `package.json` (the `scripts` block)
- Create (generated): `src/data/kb-content.json`

- [ ] **Step 1: Add the npm script + prebuild hook**

In `package.json` `scripts`, change:

```json
    "gen:instance-stats": "node scripts/gen-instance-stats.mjs",
```

to:

```json
    "gen:instance-stats": "node scripts/gen-instance-stats.mjs",
    "gen:kb-content": "node scripts/gen-kb-content.mjs",
```

and change the `prebuild` line to:

```json
    "prebuild": "node scripts/gen-framework-manifest.mjs && node scripts/gen-instance-stats.mjs && node scripts/generate-kb-viz.mjs && node scripts/gen-kb-content.mjs",
```

- [ ] **Step 2: Generate against the real corpora and sanity-check**

Run: `npm run gen:kb-content`
Expected output: `kb-content: 868 objects (722 articles + 146 handoff) → src/data/kb-content.json`

Then: `node -e "const s=require('./src/data/kb-content.json'); console.log(s.total, s.by_corpus, Object.keys(s.by_type).length, s.by_layer)"`
Expected: `868 { articles: 722, handoff: 146 }` with ~10 types and layer counts (no huge `null` bucket — if a type is unmapped the test in Task 1 should have caught it).

- [ ] **Step 3: Commit** (the snapshot is committed like `framework-manifest.json` — derived, self-heals on prebuild)

```bash
git add package.json src/data/kb-content.json
git commit -m "feat(kb-site): generate kb-content snapshot in prebuild (868 objects, both corpora)"
```

---

### Task 3: KB home page (`/kb/`)

**Files:**
- Create: `src/pages/kb/index.astro`

- [ ] **Step 1: Write the page**

```astro
---
// The browse home for the framework-reprocessed KB. Everything here is raw /
// under review — this is the dev review surface, not published content.
import Page from "../../layouts/Page.astro";
import kb from "../../data/kb-content.json";

const base = import.meta.env.BASE_URL;
const withBase = (p) => base + String(p).replace(/^\//, "");

const CORPUS_LABEL = { articles: "Toolkit articles", handoff: "Handoff (Canonical_DB slice)" };

// type → { corpus → count }, for the per-type browse grid
const typeCells = new Map();
for (const o of kb.objects) {
  if (!typeCells.has(o.type)) typeCells.set(o.type, { type: o.type, layer: o.layer, counts: {} });
  const cell = typeCells.get(o.type);
  cell.counts[o.corpus] = (cell.counts[o.corpus] ?? 0) + 1;
}
// group types under layers (null layer → "Unmapped", listed last, honest)
const layerGroups = new Map();
for (const cell of [...typeCells.values()].sort((a, b) => a.type.localeCompare(b.type))) {
  const key = cell.layer ?? "unmapped";
  if (!layerGroups.has(key)) layerGroups.set(key, []);
  layerGroups.get(key).push(cell);
}
const orderedLayers = [...layerGroups.keys()].sort((a, b) =>
  a === "unmapped" ? 1 : b === "unmapped" ? -1 : a - b
);
const layerName = (k) => (k === "unmapped" ? "Unmapped types" : `Layer ${k} — ${kb.layers[k]}`);
const label = (t) => t.replace(/-/g, " ");
const rawish = kb.total - (kb.by_maturity.reviewed ?? 0);
---

<Page
  title="Reprocessed KB · Regen Web3 Toolkit (dev)"
  description="Browse the framework-reprocessed knowledge base — raw, under review, dev preview only."
>
  <section class="in-hero">
    <div class="wrap in-hero__inner">
      <p class="eyebrow">Reprocessed content · dev preview</p>
      <h1 class="in-hero__title">The knowledge base,<br />as the framework typed it.</h1>
      <p class="in-hero__lede">
        <strong>{kb.total} typed objects</strong> — {kb.by_corpus.articles} reprocessed from this
        site's own articles, {kb.by_corpus.handoff} from the July handoff's Canonical_DB slice.
        <strong>Everything here is <code>raw</code> / under review</strong>: nothing has been
        promoted or published. This surface exists so reviewers can compare it side-by-side with
        the <a href={withBase("/")}>current article build</a> before anything moves to production.
      </p>
      <div class="in-hero__meta">
        <span class="chip chip--clay">{rawish} awaiting review</span>
        <span class="in-hero__metasep" aria-hidden="true"></span>
        <span>{kb.by_maturity.reviewed ?? 0} reviewed</span>
        <span class="in-hero__metasep" aria-hidden="true"></span>
        <span>2 corpora</span>
      </div>
    </div>
  </section>

  <section class="in-reg">
    <div class="wrap">
      <header class="in-sec-head">
        <p class="eyebrow">Browse by layer</p>
        <h2 class="in-h2">Ten layers, {Object.keys(kb.by_type).length} object types.</h2>
        <p class="in-sec-sub">
          Each type maps to a layer of the master architecture. Counts are read from the generated
          snapshot, not typed by hand. Corpus tags: <strong>A</strong> = toolkit articles,
          <strong>H</strong> = handoff slice.
        </p>
      </header>
      {orderedLayers.map((lk) => (
        <div class="kbx-layer">
          <h3 class="kbx-layer__h">{layerName(lk)}</h3>
          <ul class="kbx-typegrid">
            {layerGroups.get(lk).map((cell) => (
              <li class="kbx-type">
                <span class="kbx-type__name">{label(cell.type)}</span>
                <span class="kbx-type__links">
                  {Object.entries(cell.counts).map(([corpus, n]) => (
                    <a href={withBase(`/kb/${corpus}/${cell.type}/`)} title={CORPUS_LABEL[corpus]}>
                      {corpus === "articles" ? "A" : "H"}·{n}
                    </a>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p class="in-reg__caption">
        Generated at build from <code>src/data/kb-content.json</code> (prebuild snapshot of
        <code>data/kb/</code> + <code>kb-handoff/objects/</code>). See also the
        <a href={withBase("/self-ingestion/")}>self-ingestion diff</a> and the
        <a href={withBase("/handoff/")}>handoff slice</a> summaries.
      </p>
    </div>
  </section>
</Page>

<style>
  .kbx-layer { margin-top: 2rem; }
  .kbx-layer__h { font-size: 1.05rem; margin-bottom: 0.6rem; }
  .kbx-typegrid { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.5rem; }
  .kbx-type { display: flex; justify-content: space-between; gap: 0.75rem; padding: 0.55rem 0.8rem; border: 1px solid color-mix(in oklab, currentColor 18%, transparent); border-radius: 8px; }
  .kbx-type__name { text-transform: capitalize; }
  .kbx-type__links a { margin-left: 0.5rem; font-variant-numeric: tabular-nums; text-decoration: none; border-bottom: 1px dotted currentColor; }
</style>
```

- [ ] **Step 2: Verify it renders**

Run: `npm run build 2>&1 | tail -5` — build succeeds.
Run: `grep -o "868 typed objects\|typed objects" dist/kb/index.html | head -1` — Expected: a match (page rendered with real counts).

- [ ] **Step 3: Commit**

```bash
git add src/pages/kb/index.astro
git commit -m "feat(kb-site): /kb/ browse home — by layer + type, raw-status front and center"
```

---

### Task 4: Per-type listing pages (`/kb/[corpus]/[type]/`)

**Files:**
- Create: `src/pages/kb/[corpus]/[type]/index.astro`

- [ ] **Step 1: Write the page**

```astro
---
// One listing page per (corpus, type): every object of that type, title +
// summary + maturity chip, linking to the detail pages. All raw / under review.
import Page from "../../../../layouts/Page.astro";
import kb from "../../../../data/kb-content.json";

export function getStaticPaths() {
  const groups = new Map();
  for (const o of kb.objects) {
    const key = `${o.corpus}/${o.type}`;
    if (!groups.has(key)) groups.set(key, { corpus: o.corpus, type: o.type, items: [] });
    groups.get(key).items.push(o);
  }
  return [...groups.values()].map(({ corpus, type, items }) => ({
    params: { corpus, type },
    props: { items: items.sort((a, b) => (a.data.title ?? a.id).localeCompare(b.data.title ?? b.id)) },
  }));
}

const { corpus, type } = Astro.params;
const { items } = Astro.props;

const base = import.meta.env.BASE_URL;
const withBase = (p) => base + String(p).replace(/^\//, "");

const CORPUS_LABEL = { articles: "Toolkit articles", handoff: "Handoff (Canonical_DB slice)" };
const label = type.replace(/-/g, " ");
const layer = items[0]?.layer;
---

<Page
  title={`${label} (${corpus}) · Reprocessed KB (dev)`}
  description={`All ${items.length} ${label} objects from the ${CORPUS_LABEL[corpus]} corpus — raw, under review.`}
>
  <section class="in-reg">
    <div class="wrap">
      <header class="in-sec-head">
        <p class="eyebrow">
          <a href={withBase("/kb/")}>Reprocessed KB</a> · {CORPUS_LABEL[corpus]}
          {layer && <> · Layer {layer} — {kb.layers[layer]}</>}
        </p>
        <h1 class="in-h2" style="text-transform: capitalize;">{label} · {items.length}</h1>
        <p class="in-sec-sub">
          Every object below is <strong>{`raw / under review`}</strong> unless chipped otherwise —
          nothing is promoted or published.
        </p>
      </header>
      <ul class="kbx-list">
        {items.map((o) => (
          <li class="kbx-item">
            <a class="kbx-item__title" href={withBase(`/kb/${o.corpus}/${o.type}/${o.id}/`)}>
              {o.data.title ?? o.id}
            </a>
            <span class={`chip ${o.data.maturity === "reviewed" ? "" : "chip--clay"}`}>
              {o.data.maturity ?? "raw"}
            </span>
            {o.data.summary && <p class="kbx-item__summary">{o.data.summary}</p>}
          </li>
        ))}
      </ul>
    </div>
  </section>
</Page>

<style>
  .kbx-list { list-style: none; padding: 0; margin: 2rem 0 0; display: grid; gap: 1rem; }
  .kbx-item { padding: 1rem 1.2rem; border: 1px solid color-mix(in oklab, currentColor 18%, transparent); border-radius: 10px; }
  .kbx-item__title { font-weight: 600; margin-right: 0.6rem; }
  .kbx-item__summary { margin: 0.5rem 0 0; opacity: 0.85; font-size: 0.95rem; }
</style>
```

- [ ] **Step 2: Verify**

Run: `npm run build 2>&1 | tail -3` — succeeds.
Run: `ls dist/kb/articles/ dist/kb/handoff/` — Expected: one directory per type (8 under `articles`, 7 under `handoff`).
Run: `grep -c "kbx-item" dist/kb/articles/resource/index.html` — Expected: > 200 (226 resources).

- [ ] **Step 3: Commit**

```bash
git add "src/pages/kb/[corpus]/[type]/index.astro"
git commit -m "feat(kb-site): per-type listing pages for both corpora"
```

---

### Task 5: Object detail pages (`/kb/[corpus]/[type]/[slug]/`)

**Files:**
- Create: `src/pages/kb/[corpus]/[type]/[slug].astro`

- [ ] **Step 1: Write the page**

```astro
---
// One page per typed object: featured fields, provenance (first-class, per the
// 07-16 meeting), maturity badge, resolved related-object links, cross-link to
// the source article where provenance points at src/content/docs/, and a
// generic dump of the remaining fields so nothing is hidden from reviewers.
import Page from "../../../../layouts/Page.astro";
import kb from "../../../../data/kb-content.json";

export function getStaticPaths() {
  return kb.objects.map((o) => ({
    params: { corpus: o.corpus, type: o.type, slug: o.id },
    props: { object: o },
  }));
}

const { object } = Astro.props;
const { corpus, type, id, layer, data, links } = object;

const base = import.meta.env.BASE_URL;
const withBase = (p) => base + String(p).replace(/^\//, "");

const CORPUS_LABEL = { articles: "Toolkit articles", handoff: "Handoff (Canonical_DB slice)" };
const title = data.title ?? id;
const maturity = data.maturity ?? "raw";

// Article cross-link: articles-corpus provenance.origin = src/content/docs/<slug>.md
const origin = String(data.provenance?.origin ?? "");
const articleMatch = origin.match(/^src\/content\/docs\/(.+)\.md$/);
const articleHref = articleMatch ? withBase(`/${articleMatch[1]}/`) : null;

// Fields rendered specially above the generic dump
const FEATURED = new Set(["title", "summary", "maturity", "provenance", "type", "url"]);
const rest = Object.entries(data).filter(([k]) => !FEATURED.has(k));

const render = (v) =>
  typeof v === "object" ? JSON.stringify(v, null, 2) : String(v);
---

<Page title={`${title} · Reprocessed KB (dev)`} description={data.summary ?? title}>
  <section class="in-reg">
    <div class="wrap kbx-detail">
      <p class="eyebrow">
        <a href={withBase("/kb/")}>Reprocessed KB</a> ·
        <a href={withBase(`/kb/${corpus}/${type}/`)} style="text-transform: capitalize;">{type.replace(/-/g, " ")}</a>
        · {CORPUS_LABEL[corpus]}
        {layer && <> · Layer {layer} — {kb.layers[layer]}</>}
      </p>
      <h1 class="in-h2">{title}</h1>
      <p class="kbx-badges">
        <span class={`chip ${maturity === "reviewed" ? "" : "chip--clay"}`}>{maturity} · under review</span>
        {data.ai_assisted && <span class="chip">ai-assisted</span>}
        {data.public_use && <span class="chip">{data.public_use}</span>}
      </p>

      {data.summary && <p class="kbx-summary">{data.summary}</p>}
      {data.url && <p><a href={data.url} rel="nofollow noopener">{data.url}</a></p>}
      {articleHref && (
        <p class="kbx-crosslink">
          ↔ Compare with the current published article: <a href={articleHref}>{articleMatch[1]}</a>
        </p>
      )}

      <h2 class="kbx-h2">Provenance</h2>
      <dl class="kbx-dl">
        <dt>origin</dt><dd><code>{origin || "—"}</code></dd>
        <dt>transformation</dt><dd>{data.provenance?.transformation ?? "—"}</dd>
        <dt>authorship</dt><dd>{data.provenance?.authorship ?? "—"}</dd>
        {data.source_lineage && (<><dt>source_lineage</dt><dd>{render(data.source_lineage)}</dd></>)}
        {data.work_order && (<><dt>work_order</dt><dd><code>{data.work_order}</code></dd></>)}
      </dl>

      {links.length > 0 && (
        <>
          <h2 class="kbx-h2">Related objects</h2>
          <ul>
            {links.map((l) => (
              <li>
                <span class="kbx-linkfield">{l.field}</span> →
                <a href={withBase(`/kb/${l.corpus}/${l.type}/${l.id}/`)}>{l.id}</a>
                <small> ({l.type}, {l.corpus})</small>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 class="kbx-h2">All fields</h2>
      <dl class="kbx-dl">
        {rest.map(([k, v]) => (
          <>
            <dt>{k}</dt>
            <dd>{typeof v === "object" ? <pre class="kbx-pre">{render(v)}</pre> : render(v)}</dd>
          </>
        ))}
      </dl>
    </div>
  </section>
</Page>

<style>
  .kbx-detail { max-width: 46rem; }
  .kbx-badges { display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 0.75rem 0 1.25rem; }
  .kbx-summary { font-size: 1.05rem; }
  .kbx-crosslink { padding: 0.6rem 0.9rem; border-left: 3px solid currentColor; opacity: 0.9; }
  .kbx-h2 { font-size: 1.1rem; margin: 2rem 0 0.6rem; }
  .kbx-dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.35rem 1rem; }
  .kbx-dl dt { font-weight: 600; opacity: 0.75; }
  .kbx-dl dd { margin: 0; overflow-wrap: anywhere; }
  .kbx-pre { white-space: pre-wrap; font-size: 0.85rem; margin: 0; }
  .kbx-linkfield { font-family: monospace; font-size: 0.85rem; opacity: 0.8; }
</style>
```

- [ ] **Step 2: Verify**

Run: `npm run build 2>&1 | tail -3` — succeeds. (868 extra routes; expect a noticeably longer build — fine.)
Run: `grep -l "Compare with the current published article" dist/kb/articles/encyclopedia-entry/*/index.html | head -3` — Expected: matches (article cross-links resolved).
Run: `grep -o "raw · under review" dist/kb/handoff/resource/digital-justice-project/index.html` — Expected: a match.

- [ ] **Step 3: Commit**

```bash
git add "src/pages/kb/[corpus]/[type]/[slug].astro"
git commit -m "feat(kb-site): object detail pages — provenance, raw badge, related links, article cross-links"
```

---

### Task 6: Navigation — Starlight sidebar group + Page nav

**Files:**
- Modify: `astro.config.mjs` (the `sidebar` array)
- Modify: `src/layouts/Page.astro` (the `nav` array)

- [ ] **Step 1: Add the sidebar group** in `astro.config.mjs` — change:

```js
      sidebar: [
        { label: 'Start here', items: [{ label: 'All journeys', link: '/' }, { label: 'Knowledge map', link: '/explorer/' }] },
        { label: 'About the system', items: [{ label: 'The framework', link: '/framework/' }, { label: 'This instance', link: '/regen-toolkit-os/' }, { label: 'Self-ingestion diff', link: '/self-ingestion/' }, { label: 'Handoff slice', link: '/handoff/' }] },
        ...journeySidebar,
      ],
```

to:

```js
      sidebar: [
        { label: 'Start here', items: [{ label: 'All journeys', link: '/' }, { label: 'Knowledge map', link: '/explorer/' }] },
        { label: 'About the system', items: [{ label: 'The framework', link: '/framework/' }, { label: 'This instance', link: '/regen-toolkit-os/' }, { label: 'Self-ingestion diff', link: '/self-ingestion/' }, { label: 'Handoff slice', link: '/handoff/' }] },
        {
          label: 'Reprocessed content (dev · raw, under review)',
          collapsed: true,
          items: [{ label: 'Browse the reprocessed KB', link: '/kb/' }],
        },
        ...journeySidebar,
      ],
```

- [ ] **Step 2: Add the Page nav link** in `src/layouts/Page.astro` — change:

```js
const nav = [
  { label: "Journeys", href: withBase("/#journeys") },
  { label: "Knowledge map", href: withBase("/explorer/") },
  { label: "Toolkit Framework", href: withBase("/framework/") },
  { label: "Regen-Toolkit-OS", href: withBase("/regen-toolkit-os/") },
];
```

to:

```js
const nav = [
  { label: "Journeys", href: withBase("/#journeys") },
  { label: "Knowledge map", href: withBase("/explorer/") },
  { label: "Toolkit Framework", href: withBase("/framework/") },
  { label: "Reprocessed KB", href: withBase("/kb/") },
  { label: "Regen-Toolkit-OS", href: withBase("/regen-toolkit-os/") },
];
```

- [ ] **Step 3: Verify** — `npm run build 2>&1 | tail -3` succeeds; `grep -o "Reprocessed KB" dist/index.html | head -1` matches; `grep -o "Reprocessed content (dev" dist/what-is-decentralization/index.html | head -1` matches (sidebar on an article page).

- [ ] **Step 4: Commit**

```bash
git add astro.config.mjs src/layouts/Page.astro
git commit -m "feat(kb-site): nav entries for the reprocessed KB (dev, raw, under review)"
```

---

### Task 7: Full verification — both base modes

- [ ] **Step 1: Full test + build sweep**

```bash
node --test scripts/gen-kb-content.test.mjs scripts/generate-kb-viz.test.mjs   # all pass
(cd packages/toolkit-framework && npm test)                                    # 125 pass, untouched
npm run build                                                                  # Vercel-mode build green
GITHUB_PAGES=true npm run build                                                # Pages-mode build green
```

- [ ] **Step 2: Base-path spot-check on the Pages build** (the classic foot-gun):

```bash
grep -o 'href="/regen-toolkit/kb/[^"]*"' dist/kb/index.html | head -5
grep -c 'href="/kb/' dist/kb/index.html
```

Expected: base-prefixed links present; **0** un-prefixed `/kb/` hrefs. If any un-prefixed links appear, a page bypassed `withBase` — fix it there.

- [ ] **Step 3: Eyeball it** — `npm run preview`, open `/kb/`, click through: home → a type listing → an object detail → its “Compare with the current published article” link → back. Confirm the raw badge is visible on every KB page.

- [ ] **Step 4: Commit anything the sweep fixed**, message `fix(kb-site): <what>`.

---

### Task 8: Deploy from the fork + report

> **Operator gate:** the push to `fork` publishes the dev instance (and the ~7+ unpushed commits on the branch) to the live Pages URL. It was decided on 2026-07-19 (the whole point of this plan), but pushing remains the operator's call — confirm at the moment of push. **Never push `origin` or touch `main` in this plan.**

- [ ] **Step 1: Confirm remotes + branch**

```bash
git remote -v          # fork = luizfernandosg/regen-toolkit expected
git branch --show-current   # regen-toolkit-os
git log --oneline -3
```

- [ ] **Step 2: Push (operator-confirmed)**

```bash
git push fork regen-toolkit-os
```

- [ ] **Step 3: Watch the deploy + verify live**

```bash
gh run watch --repo luizfernandosg/regen-toolkit --exit-status $(gh run list --repo luizfernandosg/regen-toolkit --workflow "Deploy site preview to GitHub Pages" --limit 1 --json databaseId -q '.[0].databaseId')
curl -sf https://luizfernandosg.github.io/regen-toolkit/kb/ | grep -o "typed objects" | head -1
```

Expected: workflow succeeds; the live `/kb/` page renders with real counts.

- [ ] **Step 4: Report** (to the operator, for the team share): the live URL (`https://luizfernandosg.github.io/regen-toolkit/kb/`), what's rendered (all 868 objects: home + 15 type listings + 868 detail pages, provenance + raw badges + cross-links) vs. what's stubbed/deferred (graph-view overlay — the existing `/knowledge-commons` + canvases still carry that; per-layer landing pages beyond the home grouping; any unmapped types the build surfaced). The operator drafts the group message (draft-and-present — this plan does not post anything).

---

## Deferred (named, not built — YAGNI for the review gate)

- **Graph/atlas overlay for the KB routes** — the existing `/knowledge-commons` page + `generate:kb-viz` canvases already visualize the schema graph; a per-object interactive graph is a later pass.
- **Reverse cross-links on article pages** (article → its reprocessed objects) — needs a Starlight component override; the object → article direction covers the review workflow.
- **Netlify dev URL** — Pages-from-fork is wired and zero-setup; Netlify comes with the migration follow-on (`publish-pipeline` design §4).
- **Search over KB pages** — Starlight's Pagefind only indexes docs content; out of scope.

## Success criteria (from the spec)

A live URL where a reviewer can browse the reprocessed content **by type and by layer**; every object page shows **provenance + raw status**; the **119 articles are still there** with cross-links for side-by-side comparison; the build is deployed **from the fork** (not prod); prod (`main`, `origin`) untouched.
