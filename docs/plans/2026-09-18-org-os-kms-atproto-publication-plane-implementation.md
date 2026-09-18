# org-os-kms AT Proto Publication Plane — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revision:** 3 (2026-09-18) — after the fit review. regen-toolkit is **pull-only** in this plan; Open Haven is framework capability with no instance activating it; every outbound record and static entry goes through a field projection; `.well-known` copy is an allowlist; `ingest` is fail-soft, validating, `--dry`-aware, and a CLI verb; `publish` on `close` runs in plan mode unless `publish.apply: true`; `grc20Id` is minted only when a Geo space is configured; layer relabelled.

## Where to build (read first)

**Package tasks run in the canonical framework repo: `/Users/luizfernando/Desktop/Workspaces/Zettelkasten/03 Libraries/org-os`** (branch `luizfernando`), in `packages/toolkit-framework/` and `packages/org-os-kms/`. That copy is ahead of regen-toolkit's vendored one (65 tests vs 44; extra `frontier.mjs`, `map.mjs`, `render-map-html.mjs`; four framework files differ) and regen-toolkit's `kms.yaml` already names it as `upstream`. Do **not** build on regen-toolkit's `packages/` copy.

- **In org-os:** Tasks 1–5, 7–15 (package code, tests, `lexicons/`, `profile/profile.yaml`, `docs/CONNECTORS.md`), Task 17. Baseline there: `cd packages/org-os-kms && npm test` → **65 pass**; `cd packages/toolkit-framework && npm test` → record the count before Task 1. Every `file:line` reference in this plan was taken from regen-toolkit's copy — re-locate against org-os before editing (names are the same; line numbers may differ; `cli.mjs` differs in content).
- **In regen-toolkit** (this repo): Task 6 step 4 (site generators `scripts/gen-kb-content.mjs`, `scripts/generate-kb-viz.mjs`), the root `kms.yaml` / `.env.example` steps of Tasks 11 and 15, Task 16 (design/backlog — already done in rev 3), and the dry-run verification in Task 15 step 4 — **after** syncing the built packages from org-os (`npm run sync:upstream`, or `rsync -a --delete --exclude node_modules` of both packages, then `git diff --stat packages/`).
- **Tag** org-os when Task 17 passes (`kms-atproto-v0.1`); the pilot vendors from that tag.

**Where "unchanged from revision 2" appears** (Tasks 3, 5, 7, 8, 9, 13, 17): the full code and tests are in revision 2 of this file — `git show eec2541e:docs/plans/2026-09-18-org-os-kms-atproto-publication-plane-implementation.md` — apply only the deltas stated in the task.

**Layer:** 10 (Infrastructure & Substrate — Luiz). Touches 2 (Knowledge Commons / Encyclopedia — Heenal) through the identity fields on knowledge objects, and 3 (Resource Graph — Brandon) through the `resource` mapping in the static-json connector. Per `docs/layers/10-infrastructure-and-substrate.md` and `MASTER.md` §14: static JSON-LD export is a Phase-3 capability; AT Proto federation is Phase-4 ("only if workflows and governance are ready") — which is why this instance pulls and does not publish yet.

**Goal:** Give org-os-kms a publication plane (AT Proto repo + static JSON-LD surface, from one manifest) and a federation plane (`atproto` and `static-json` connectors through one `runConnector`), so that `refi-dao-commons` can publish and regen-toolkit can pull it into review.

**Architecture:** Git/yaml stays the editorial plane. A pure gate (`isPublishable`, keyed on the adapter's schema + `public_use`) plus an optional stricter instance gate selects objects; a field projection (`publicView`) strips editorial internals from anything that leaves the instance; Lexicons are generated from the framework's yaml schemas; a `publish` op diffs against a manifest and writes to the PDS (fetch-based XRPC client) and to a static `api/` surface. A framework-side `runConnector` orchestrates `describe → pull → map → validate → upsert/store` and upserts the source's federation card. Everything pulled lands at `maturity: raw`, `public_use: not-public-yet`, with the origin's `ai_assisted` preserved (default `true`).

**Tech Stack:** Node ≥ 18 (native `fetch`, `crypto.randomUUID`), `node:test` + `node:assert/strict`, `js-yaml`. **No new dependencies.**

**Spec:** `docs/plans/2026-09-18-org-os-kms-atproto-publication-plane-design.md` (revised alongside) · ADR: `docs/adr/0001-atproto-as-publication-plane.md` · Glossary: `CONTEXT.md`

**Companion plan:** `refi-dao-os/docs/kms/2026-09-18-refi-dao-commons-atproto-pilot.md` — the first real publisher. **Proving-ground order: refi-dao-commons publishes; regen-toolkit pulls.** regen-toolkit publishes nothing until (i) the pilot's Phase 2 exit criteria pass, (ii) `task-260716-luiz-name-flagging-privacy-gate` (HEARTBEAT l.179) closes, and (iii) someone reviews the objects a `--dry` publish would select — today 141 objects carry `public_use: source-linked-unreviewed` as a *script default* from `scripts/process-content.mjs:81`, not a decision; 693/722 are `ai_assisted: true`.

## Global Constraints

- **Schema, not `type`.** The adapter's `schema` identifies an object's kind everywhere. `object.type` is unreliable: `source-system.type` is a *kind* enum (`repo`, `blog`, …) and all 34 `public-use-boundary` objects here have no `type`.
- **Gate (floor):** `schema ∈ publishableTypes(config)` ∧ `public_use ∈ {ok-with-caveat, source-linked-unreviewed, reviewed-for-explanation, reviewed-for-guidance}`. 10 default types (never `person`); `source-system` / `public-use-boundary` opt-in. Maturity is not part of the floor. **The floor admits `source-linked-unreviewed` only because instances narrow it** — the pilot's canon gate requires reviewed maturity; this instance sets `publish.static: false` and `publish.apply: false`.
- **Projection (`publicView`) on everything outbound.** PDS records, static entries, and the pilot's published store strip `PRIVATE_FIELDS = [notes, work_order, reviewed_by, review_needs, interpretation, uncertainty, tensions, risks_of_flattening, high_risk, consent_note, salvaged_from, legacy_status, additional_provenance]` and `provenance.surfaced_by`. One list, framework-side.
- **`.well-known` copy is an allowlist:** `dao.json` and `knowledge.json` only. `meetings.json` (participants, recording URLs, transcript paths), `members.json`, `activities.json` never leave the repo root.
- **`publish` on `close` is plan mode** unless `kms.yaml.publish.apply: true`. Real writes happen via `org-os-kms publish --apply` (draft-and-present: `sync.push` is itself a draft stub). **Nothing wires `lifecycle close` into `/close` today**; ops are reached via the CLI, and wiring `/close` is a follow-on outside this plan.
- **`ingest` is fail-soft:** a source failure is reported per connector, never aborts the op; cursor advances only after a successful store. `ingest` is a CLI verb (`org-os-kms ingest [--connector X] [--dry]`), **not** bound to `close`.
- **Pulled candidates are validated** (`validateObject` + `checkInvariants`) before store; `work_order` = `connector:<name>:<ISO date>`, `source_lineage` = the record's URI; `maturity: raw`, `public_use: not-public-yet`, `ai_assisted` = origin's value or `true`.
- NSID authority from `kms.yaml.atproto.nsid_authority` (`xyz.regencoordination.kb`). Identity `did:plc`. Credential only from env `ATPROTO_APP_PASSWORD`.
- `rkey = object.id` (UUIDv4), minted only for objects that passed every gate, never on `--dry`. **`grc20Id` is minted only when `kms.yaml.geo.space` is set** (no Regen KC space in Geo yet ⇒ no local Geo ids to reconcile later).
- Records: no floats, ≤ 1 MB, `$type` = NSID. Never delete locally on a peer's delete (`held` + `review_needs`).
- `@context` and `index.json` paths are **absolute from `kms.yaml.publish.base_url`** (required when `publish.static` is on); never root-relative (GitHub Pages `base: /regen-toolkit/` would break them).
- One `KnowledgeManifest` shape: the static surface **merges** `did`/`geo`/`exchange`/`sources` into the root `.well-known/knowledge.json` that `generate:schemas` produces; it does not invent a second document.
- org-os-kms imports the framework only through `src/framework.mjs` (relative sibling path ⇒ adopters vendor **both** packages, unedited, pinned; `node_modules/@org-os/kms` does not work).
- Test runner `node --test` from the package dir. **Baseline (org-os canonical): org-os-kms 65; toolkit-framework — record before Task 1.** Green after every task.
- Deviation from spec, deliberate: no `atproto` storage adapter.

## File map

```
packages/toolkit-framework/
  src/publishable.mjs      NEW  gate constants, publishableTypes, isPublishable, PRIVATE_FIELDS, publicView
  src/lexicon.mjs          NEW  yaml schema → Lexicon; validateRecord; toRecord (applies publicView)
  src/connector.mjs        NEW  Connector contract + runConnector (validate, upsert by origin, card upsert, dry)
  schemas/frontmatter.yaml MOD  +id, grc20Id, sourceUri, viaUri
  lexicons/*.json          NEW  12 generated, committed
  scripts/gen-lexicons.mjs NEW
  test/{publishable,lexicon,connector}.test.mjs  NEW

packages/org-os-kms/
  src/executor.mjs, src/cli.mjs        MOD  async lifecycle; boolean flags; `publish` + `ingest` verbs
  src/framework.mjs                    MOD  re-exports
  src/manifest.mjs, identity.mjs, refs.mjs, gate.mjs  NEW
  src/atproto/{client,publish,connector}.mjs          NEW
  src/static/surface.mjs               NEW
  src/connectors/index.mjs, static-json/{index,openhaven}.mjs  NEW
  src/ops.mjs                          MOD  +publish, +ingest.pull (verb-only)
  src/bind.mjs + profile/profile.yaml  MOD  close += publish (plan mode)
  src/config.mjs                       MOD  defaults
  src/registry-bridge.mjs              MOD  filename = slugify(title), never object.id
  docs/CONNECTORS.md                   NEW
  test/*.test.mjs, test/fixtures/openhaven/*.json  NEW/MOD

repo root
  scripts/gen-kb-content.mjs, scripts/generate-kb-viz.mjs  MOD  ignore identity fields when deriving edges / rendering
  kms.yaml, .env.example               MOD  pull-only config
```

---

### Task 1: Publication gate + projection

**Files:**
- Create: `packages/toolkit-framework/src/publishable.mjs`
- Test: `packages/toolkit-framework/test/publishable.test.mjs`

**Interfaces:**
- `PUBLISHABLE_TYPES` (10), `OPT_IN_TYPES`, `ALL_TYPES`, `PUBLISHABLE_PUBLIC_USE` (4)
- `publishableTypes(config = {}) → string[]`
- `isPublishable(object, { schema = object?.type, types = PUBLISHABLE_TYPES } = {}) → boolean`
- `PRIVATE_FIELDS: string[]`, `publicView(object) → object` (new object; strips `PRIVATE_FIELDS` and `provenance.surfaced_by`; never mutates)

- [ ] **Step 1: Write the failing test**

```js
// packages/toolkit-framework/test/publishable.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PUBLISHABLE_TYPES, OPT_IN_TYPES, ALL_TYPES, PUBLISHABLE_PUBLIC_USE, publishableTypes, isPublishable, PRIVATE_FIELDS, publicView } from '../src/publishable.mjs';
import { listSchemas, loadSchema } from '../src/index.mjs';

test('default set is 10 schemas, never person; opt-in adds source-system + public-use-boundary', () => {
  assert.equal(PUBLISHABLE_TYPES.length, 10);
  assert.ok(!ALL_TYPES.includes('person'));
  assert.deepEqual(OPT_IN_TYPES, ['source-system', 'public-use-boundary']);
  for (const t of ALL_TYPES) assert.ok(listSchemas().includes(t), `schema missing: ${t}`);
});

test('every PUBLISHABLE_PUBLIC_USE value is a real axis value', () => {
  const axis = loadSchema('review-maturity').axes.public_use.values;
  for (const v of PUBLISHABLE_PUBLIC_USE) assert.ok(axis.includes(v), v);
});

test('publishableTypes composes opt-in/opt-out; refuses person and unknown', () => {
  assert.equal(publishableTypes({}).length, 10);
  const t = publishableTypes({ publish: { types_opt_in: ['source-system'], types_opt_out: ['signal'] } });
  assert.ok(t.includes('source-system') && !t.includes('signal'));
  assert.throws(() => publishableTypes({ publish: { types_opt_in: ['person'] } }), /person/);
  assert.throws(() => publishableTypes({ publish: { types_opt_in: ['nope'] } }), /unknown/);
});

test('isPublishable is keyed on schema, not object.type', () => {
  const ok = 'ok-with-caveat';
  assert.equal(isPublishable({ type: 'resource', public_use: ok }), true);
  assert.equal(isPublishable({ type: 'resource', public_use: 'internal-only' }), false);
  assert.equal(isPublishable({ type: 'resource' }), false);
  assert.equal(isPublishable(null), false);
  assert.equal(isPublishable({ type: 'resource', public_use: ok, maturity: 'raw' }), true, 'maturity is not part of the floor');
  const card = { type: 'blog', public_use: ok };
  assert.equal(isPublishable(card, { schema: 'source-system' }), false);
  assert.equal(isPublishable(card, { schema: 'source-system', types: publishableTypes({ publish: { types_opt_in: ['source-system'] } }) }), true);
  assert.equal(isPublishable({ tier: 'x', public_use: ok }, { schema: 'public-use-boundary' }), false);
  assert.equal(isPublishable({ title: 'x', public_use: ok }, { schema: 'person' }), false);
});

test('publicView strips editorial internals, keeps everything else, does not mutate', () => {
  const src = { title: 'A', notes: 'internal', work_order: 'wo-1', reviewed_by: 'Luiz', high_risk: false, provenance: { origin: 'o', surfaced_by: 'batch 2' }, url: 'u' };
  const out = publicView(src);
  assert.deepEqual(out, { title: 'A', provenance: { origin: 'o' }, url: 'u' });
  assert.equal(src.notes, 'internal');
  for (const f of ['notes', 'work_order', 'reviewed_by', 'review_needs', 'high_risk', 'consent_note', 'additional_provenance']) assert.ok(PRIVATE_FIELDS.includes(f), f);
});
```

- [ ] **Step 2: Run** `cd packages/toolkit-framework && node --test test/publishable.test.mjs` → FAIL

- [ ] **Step 3: Implement**

```js
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
  return types.includes(schema) && PUBLISHABLE_PUBLIC_USE.includes(object.public_use);
}

export function publicView(object) {
  const out = {};
  for (const [k, v] of Object.entries(object)) if (!PRIVATE_FIELDS.includes(k)) out[k] = v;
  if (out.provenance && typeof out.provenance === 'object') { const { surfaced_by, ...p } = out.provenance; out.provenance = p; }
  return out;
}
```

- [ ] **Step 4: Run** → PASS. **Commit:** `feat(framework): schema-keyed publication gate, opt-in types, outbound projection`

---

### Task 2: Schema fields for identity and provenance

Unchanged from revision 2: add `id`, `grc20Id`, `sourceUri`, `viaUri` (optional strings) to `schemas/frontmatter.yaml`; test loops `PUBLISHABLE_TYPES` (boundary schema does not extend frontmatter). **Commit:** `feat(framework): id / grc20Id / sourceUri / viaUri on frontmatter`

```js
// append to packages/toolkit-framework/test/publishable.test.mjs
import { schemaFields, validateObject } from '../src/index.mjs';
test('identity + provenance fields exist on every default publishable schema', () => {
  for (const t of PUBLISHABLE_TYPES) { const f = schemaFields(t); for (const k of ['id', 'grc20Id', 'sourceUri', 'viaUri']) assert.ok(f[k], `${t} lacks ${k}`); }
  assert.equal(validateObject('resource', { title: 'x', type: 'resource', id: 'a-b', grc20Id: 'c', sourceUri: 'at://d/e/f' }).valid, true);
});
```

```yaml
# schemas/frontmatter.yaml, under fields: after notes
  id: { type: string }                   # stable object id (UUIDv4); minted at first publish — CONTEXT.md "Object ID"
  grc20Id: { type: string }              # Geo entity id for the same concept; minted only when a Geo space is configured
  sourceUri: { type: string }            # origin AT-URI (first publisher); immutable across republishes
  viaUri: { type: string }               # immediate peer AT-URI this copy was pulled from
```

---

### Task 3: Lexicon generator + record validator

Unchanged from revision 2 **except** `toRecord` applies `publicView` before adding `$type`. Interfaces: `nsidFor`, `typeForNsid` (over `ALL_TYPES`), `flattenSchema`, `generateLexicon`, `generateAll` (12), `validateRecord`, `toRecord`. Add this assertion to the `toRecord` test:

```js
test('toRecord applies publicView, strips undefined/null, keeps nested objects', () => {
  const r = toRecord({ title: 'A', type: 'resource', notes: 'x', work_order: 'w', url: null, provenance: { origin: 'o', surfaced_by: 's' } }, 'x.y.z');
  assert.deepEqual(r, { $type: 'x.y.z', title: 'A', type: 'resource', provenance: { origin: 'o' } });
});
```

and in `lexicon.mjs`: `import { ALL_TYPES, publicView } from './publishable.mjs';` … `export function toRecord(object, nsid) { … return { $type: nsid, ...clean(publicView(object)) }; }`. Generator script + `npm run gen:lexicons` → 12 files; drift test. **Commit:** `feat(framework): generate AT Proto Lexicons from yaml schemas + record validator`

(The full code for `flattenSchema`, `toProperty`, `validateRecord`, `findFloat`, and `scripts/gen-lexicons.mjs` is exactly as in revision 2 — reproduce it verbatim from git history `eec2541e` if needed.)

---

### Task 4: Async lifecycle, boolean flags, `publish` + `ingest` CLI verbs

**Files:**
- Modify: `packages/org-os-kms/src/executor.mjs`, `src/cli.mjs`
- Modify: `test/executor.test.mjs`, `test/cli.test.mjs`, `test/e2e.test.mjs`

**Interfaces:**
- `runLifecycle(event, ctx, deps) → Promise<report>`; unknown-event check stays synchronous.
- `parseFlags`: `--k` followed by nothing or `--x` → `true`; else the next token.
- `VERBS` gains `publish` and `ingest`. `dispatch(['publish', '--dir', d, '--apply'|'--dry'])` → runs `OPS.publish.run({ dir, flags: { dry, apply } })`; `dispatch(['ingest', '--dir', d, '--connector', name, '--dry'])` → `OPS['ingest.pull'].run({ dir, flags: { dry, connector } })`. Both are `await`ed and printed as JSON by `main`.

- [ ] **Step 1: Write the failing tests**

```js
// cli.test.mjs (append)
test('trailing --dry is boolean; --dir takes a value; publish/ingest are verbs', () => {
  const r = dispatch(['publish', '--dir', '/tmp/x', '--dry'], { dry: true });
  assert.equal(r.verb, 'publish'); assert.equal(r.flags.dir, '/tmp/x'); assert.equal(r.flags.dry, true);
  const i = dispatch(['ingest', '--connector', 'atproto', '--dry'], { dry: true });
  assert.equal(i.verb, 'ingest'); assert.equal(i.flags.connector, 'atproto'); assert.equal(i.flags.dry, true);
});

// executor.test.mjs (append)
test('runLifecycle awaits async ops in order', async () => {
  const order = [];
  const ops = { a: { kind: 'exec', write: false, run: async () => { await new Promise((r) => setTimeout(r, 5)); order.push('a'); return { ok: true }; } },
                b: { kind: 'exec', write: false, run: () => { order.push('b'); return { ok: true }; } } };
  const r = await runLifecycle('initialize', {}, { ops, bindings: { initialize: ['a', 'b'] } });
  assert.deepEqual(order, ['a', 'b']); assert.equal(r.ran.length, 2);
});
```

Match the real `deps` shape from the existing `executor.test.mjs`.

- [ ] **Step 2: Run** → FAIL; note the existing tests that now need `await`.

- [ ] **Step 3: Implement** — `executor.mjs`: keep synchronous checks, wrap the loop in `return (async () => { … const res = (await op.run(ctx)) || {}; … })();`. `cli.mjs`:

```js
const VERBS = new Set(['lifecycle', 'bridge', 'render', 'federate', 'promote', 'init', 'publish', 'ingest']);

function parseFlags(argv) {
  const args = [], flags = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) { args.push(t); continue; }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) flags[t.slice(2)] = true; else { flags[t.slice(2)] = next; i++; }
  }
  return { args, flags };
}
```

In `dispatch`: `lifecycle` → `runLifecycle(args[0], { dir, flags })`; `publish` → `OPS.publish.run({ dir, flags: { dry: flags.dry === true, apply: flags.apply === true } })`; `ingest` → `OPS['ingest.pull'].run({ dir, flags: { dry: flags.dry === true, connector: flags.connector } })`. `main` awaits before `JSON.stringify`. Update existing tests to `await`.

- [ ] **Step 4: Run** → PASS. **Commit:** `refactor(kms): async lifecycle; boolean flags; publish + ingest verbs`

---

### Task 5: Framework seam re-exports + manifest module

Unchanged from revision 2 (`MANIFEST_PATH`, `readManifest`, `writeManifest`, `slugIndex`, `slugFromRef`); `framework.mjs` additionally re-exports `PRIVATE_FIELDS, publicView` and `checkInvariants, validateObject` (already there), `toJsonLdContext` (confirm). **Commit:** `feat(kms): publish manifest + framework seam re-exports`

---

### Task 6: Identity minting over pre-selected items (+ downstream generators)

**Files:**
- Create: `packages/org-os-kms/src/identity.mjs`
- Modify: `packages/org-os-kms/src/registry-bridge.mjs:61` (filename from `slugify(title)`, never `object.id`)
- Modify: `scripts/gen-kb-content.mjs`, `scripts/generate-kb-viz.mjs` (ignore `id`, `grc20Id`, `sourceUri`, `viaUri` when walking string values for edges; strip them from what is rendered on `/kb/*`)
- Test: `packages/org-os-kms/test/identity.test.mjs`

**Interfaces:** `ensureIds({ adapter, target, items, uuid = randomUUID, write = true, mintGeo = false }) → { minted, items }` — `grc20Id` minted only when `mintGeo` is true. Otherwise as revision 2.

- [ ] **Step 1: Tests** — revision 2's four tests, plus:

```js
test('grc20Id only when mintGeo', () => {
  const dir = instance();
  const a = ensureIds({ adapter: 'repo-data', target: dir, items: selected(dir), uuid: () => 'u' });
  assert.equal(a.items.find((i) => i.object.title === 'Pub').object.grc20Id, undefined);
  const b = ensureIds({ adapter: 'repo-data', target: dir, items: selected(dir), uuid: () => 'g', mintGeo: true });
  assert.equal(b.items.find((i) => i.object.title === 'Pub').object.grc20Id, 'g');
});
```

(Adjust revision 2's first test: `minted[0].grc20Id` is `undefined` unless `mintGeo`; `items` must have `id` but `grc20Id` only with `mintGeo`.)

- [ ] **Step 2: Run** → FAIL

- [ ] **Step 3: Implement** — revision 2's `ensureIds` with `if (mintGeo && !it.object.grc20Id) patch.grc20Id = uuid();` and `assertRkey` on `id` only.

- [ ] **Step 4: Downstream generators.** `registry-bridge.mjs:61`: replace `object.id || slugify(title)` with `slugify(object.title)`. In `scripts/gen-kb-content.mjs:57-89` and `scripts/generate-kb-viz.mjs:81-89`, skip keys `['id','grc20Id','sourceUri','viaUri']` when deriving edges, and delete them from the serialized object. Run `npm run build` before and after with a fixture object carrying `id` — `src/data/kb-content.json` and `kb-schema-graph.json` must be identical except for the removed keys. Note in `docs/CONNECTORS.md`: once `id` exists, `sameStoredObject` (`util.mjs:23`) compares by id, not content hash — intended.

- [ ] **Step 5: Run** `npm test` (both packages) + `npm run build` → PASS. **Commit:** `feat(kms): mint ids for gated objects; keep identity fields out of site generators`

---

### Task 7: Cross-reference rewriting — unchanged from revision 2. **Commit:** `feat(kms): rewrite cross-references to origin AT-URIs at publish`

### Task 8: XRPC client — unchanged from revision 2 (pds guard, `validate: false`). **Commit:** `feat(kms): fetch-based XRPC client`

### Task 9: Publish planner + applier — unchanged from revision 2 (`toRecord` now projects, so records never carry `PRIVATE_FIELDS`; add one assertion: `assert.equal(first.create[0].record.notes, undefined)` with `item('a', { notes: 'x' })`). **Commit:** `feat(kms): publish planner + per-record applier`

---

### Task 10: Static surface (projected, allowlisted, absolute URLs, merged manifest)

**Files:**
- Create: `packages/org-os-kms/src/static/surface.mjs`
- Test: `packages/org-os-kms/test/static-surface.test.mjs`

**Interfaces:** `writeStaticSurface({ dir, outDir = 'public', items, allItems = items, manifest, config }) → { files }`.
- `baseUrl = config.publish?.base_url` — **required**; throws `publish.base_url is required for the static surface` if absent.
- Entries = `publicView(object)` + `atUri`/`cid`; `@context` = `${baseUrl}/api/context.jsonld`; `index.json` endpoint paths absolute.
- `.well-known/knowledge.json` = **merge**: read `<dir>/.well-known/knowledge.json` if present (the `generate:schemas` output; keep its `domains`, `sources` shape), then set `did`, `geo`, `exchange.published_domains`, `exchange.subscribed_domains`, and append publishable-`public_use` source-system cards to `sources` (dedupe by `title`). If absent, start from `{ "@context": "https://www.daostar.org/schemas", "type": "KnowledgeManifest", "domains": [], "sources": [] }`.
- Copies **only** `<dir>/.well-known/dao.json` if present. Nothing else.

- [ ] **Step 1: Write the failing test**

```js
// packages/org-os-kms/test/static-surface.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeStaticSurface } from '../src/static/surface.mjs';

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'kms-static-'));
  mkdirSync(join(dir, '.well-known'));
  writeFileSync(join(dir, '.well-known', 'dao.json'), '{"type":"DAO"}');
  writeFileSync(join(dir, '.well-known', 'meetings.json'), '{"meetings":[{"participants":["x"]}]}');
  writeFileSync(join(dir, '.well-known', 'knowledge.json'), JSON.stringify({ '@context': 'https://www.daostar.org/schemas', type: 'KnowledgeManifest', domains: [{ id: 'd1', name: 'D' }], sources: [{ title: 'Existing' }] }));
  return dir;
}
const items = [{ schema: 'resource', ref: 'r#a', object: { title: 'A', type: 'resource', public_use: 'ok-with-caveat', id: 'id-a', notes: 'internal', reviewed_by: 'L' } }];
const allItems = [...items,
  { schema: 'source-system', ref: 's#self', object: { title: 'S', type: 'knowledge-garden', public_use: 'ok-with-caveat', url: 'https://kc', steward: 'x' } },
  { schema: 'source-system', ref: 's#priv', object: { title: 'P', type: 'database', public_use: 'internal-only' } }];
const manifest = { version: 1, objects: { 'id-a': { slug: 'a', type: 'resource', rkey: 'id-a', atUri: 'at://d/c/id-a', cid: 'cid-a', hash: 'h', publishedAt: 't' } } };
const config = { instance: 't', publish: { base_url: 'https://kc.example' }, atproto: { did: 'did:plc:me', nsid_authority: 'xyz.regencoordination.kb' }, geo: { parent_space: 'p', space: null },
  connectors: [{ name: 'atproto', config: { peers: ['did:plc:peer'] } }] };

test('projected entries, absolute @context, merged knowledge.json, allowlisted .well-known', () => {
  const dir = setup();
  const { files } = writeStaticSurface({ dir, items, allItems, manifest, config });
  const pub = (p) => JSON.parse(readFileSync(join(dir, 'public', p), 'utf8'));
  const one = pub('api/resource/id-a.json');
  assert.equal(one['@context'], 'https://kc.example/api/context.jsonld');
  assert.equal(one.notes, undefined); assert.equal(one.reviewed_by, undefined); assert.equal(one.cid, 'cid-a');
  assert.ok(pub('api/index.json').endpoints.some((e) => e.path === 'https://kc.example/api/resource.json'));
  const km = pub('.well-known/knowledge.json');
  assert.deepEqual(km.domains, [{ id: 'd1', name: 'D' }], 'generate:schemas shape preserved');
  assert.deepEqual(km.sources.map((s) => s.title), ['Existing', 'S']);
  assert.equal(km.did, 'did:plc:me');
  assert.deepEqual(km.exchange, { published_domains: ['xyz.regencoordination.kb.resource'], subscribed_domains: ['did:plc:peer'] });
  assert.ok(existsSync(join(dir, 'public', '.well-known', 'dao.json')));
  assert.ok(!existsSync(join(dir, 'public', '.well-known', 'meetings.json')), 'never copied');
  assert.ok(files.includes('api/context.jsonld'));
});

test('base_url is required', () => {
  const dir = setup();
  assert.throws(() => writeStaticSurface({ dir, items, allItems, manifest, config: { ...config, publish: {} } }), /base_url/);
});
```

- [ ] **Step 2: Run** → FAIL

- [ ] **Step 3: Implement**

```js
// packages/org-os-kms/src/static/surface.mjs — the non-AT-Proto publication target. Projected, allowlisted, absolute URLs, merged manifest.
import { mkdirSync, writeFileSync, copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as fw from '../framework.mjs';

const WELL_KNOWN_ALLOW = ['dao.json'];

export function writeStaticSurface({ dir, outDir = 'public', items, allItems = items, manifest, config }) {
  const baseUrl = config.publish?.base_url?.replace(/\/$/, '');
  if (!baseUrl) throw new Error('publish.base_url is required for the static surface');
  const CONTEXT = `${baseUrl}/api/context.jsonld`;
  const out = join(dir, outDir); const files = [];
  const write = (rel, data) => { const p = join(out, rel); mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, JSON.stringify(data, null, 2) + '\n'); files.push(rel); };

  write('api/context.jsonld', fw.toJsonLdContext());
  const bySchema = new Map();
  for (const { schema, object } of items) {
    const m = manifest.objects[object.id];
    const entry = { '@context': CONTEXT, ...fw.publicView(object), ...(m ? { atUri: m.atUri, cid: m.cid } : {}) };
    if (!bySchema.has(schema)) bySchema.set(schema, []);
    bySchema.get(schema).push(entry);
  }
  const schemas = [...bySchema.keys()].sort();
  for (const s of schemas) {
    const entries = bySchema.get(s);
    write(`api/${s}.json`, { '@context': CONTEXT, type: s, count: entries.length, items: entries });
    for (const e of entries) write(`api/${s}/${e.id}.json`, e);
  }
  write('api/index.json', {
    name: `${config.instance || 'org-os-kms'} knowledge API`,
    description: 'Static, read-only JSON-LD over the published knowledge objects of this instance. Entries carry atUri when published to AT Proto.',
    endpoints: schemas.flatMap((s) => [{ path: `${baseUrl}/api/${s}.json`, description: `All ${s} entries.` }, { path: `${baseUrl}/api/${s}/{id}.json`, description: `One ${s} by id.` }]),
    access: { readOnly: true, authentication: 'none' },
  });

  const rootKm = join(dir, '.well-known', 'knowledge.json');
  const km = existsSync(rootKm) ? JSON.parse(readFileSync(rootKm, 'utf8')) : { '@context': 'https://www.daostar.org/schemas', type: 'KnowledgeManifest', domains: [], sources: [] };
  const authority = config.atproto?.nsid_authority;
  const subscribed = (config.connectors || []).flatMap((c) => c.name === 'atproto' ? (c.config?.peers || []) : c.config?.base_url ? [c.config.base_url] : []);
  const cards = allItems.filter((i) => i.schema === 'source-system' && fw.PUBLISHABLE_PUBLIC_USE.includes(i.object.public_use)).map(({ object }) => ({ title: object.title, url: object.url, steward: object.steward }));
  const sources = [...(km.sources || [])];
  for (const c of cards) if (!sources.some((s) => s.title === c.title)) sources.push(c);
  write('.well-known/knowledge.json', { ...km, did: config.atproto?.did, geo: config.geo, exchange: { published_domains: authority ? schemas.map((s) => fw.nsidFor(s, authority)) : [], subscribed_domains: subscribed }, sources });

  for (const f of WELL_KNOWN_ALLOW) {
    const src = join(dir, '.well-known', f);
    if (existsSync(src)) { mkdirSync(join(out, '.well-known'), { recursive: true }); copyFileSync(src, join(out, '.well-known', f)); files.push(`.well-known/${f}`); }
  }
  return { files };
}
```

- [ ] **Step 4: Run** → PASS. **Commit:** `feat(kms): static JSON-LD surface — projected, allowlisted, merged manifest`

---

### Task 11: Instance gate hook + `publish` op (plan mode by default) + lifecycle binding

**Files:** as revision 2 (`src/gate.mjs`, `src/ops.mjs`, `src/bind.mjs`, `profile/profile.yaml`, `src/config.mjs`, `test/bind.test.mjs`, root `kms.yaml`, `.env.example`; tests `test/gate.test.mjs`, `test/publish-op.test.mjs`).

**Interfaces:** `gate.mjs` unchanged from revision 2. `OPS.publish` sequence: `all = list` → `types` → floor filter → instance gate → `ensureIds({ items, write: !dry, mintGeo: Boolean(config.geo?.space) })` → `planPublish` → **apply only if `apply`** (`ctx.flags.apply === true || config.publish?.apply === true`) and not dry and configured → static (unless `publish.static === false`, or dry) → manifest (unless dry). Report `atproto.status ∈ {not-configured, planned, applied, failed}` — `planned` is what `close` produces by default.

- [ ] **Step 1: Tests** — revision 2's `gate.test.mjs` verbatim; `publish-op.test.mjs` from revision 2 with these changes: every test that expects `applied` passes `flags: { apply: true }` (or sets `publish: { apply: true }` in the fixture `kms.yaml`); add:

```js
test('without --apply, close-mode publish plans only: nothing on PDS, no manifest, static still written', async () => {
  const dir = instance(); const log = [];
  const res = await OPS.publish.run({ dir, deps: { createClient: fakeClientFactory(log), env } });
  assert.equal(res.report.atproto.status, 'planned'); assert.equal(log.length, 0);
  assert.ok(!existsSync(join(dir, 'data', 'kms-published.json')));
  assert.ok(existsSync(join(dir, 'public', 'api', 'resource.json')));
});
test('grc20Id minted only when geo.space is set', async () => {
  const dir = instance(); const deps = { createClient: fakeClientFactory([]), env };
  await OPS.publish.run({ dir, flags: { apply: true }, deps });
  assert.equal(yaml.load(readFileSync(join(dir, 'data', 'kb', 'resource.yaml'), 'utf8')).entries.a.grc20Id, undefined);
});
```

and the fixture `kms.yaml` gains `publish: { base_url: 'https://t.example' }`.

- [ ] **Step 2: Run** → FAIL

- [ ] **Step 3: Implement** — revision 2's op with: `const apply = ctx.flags?.apply === true || config.publish?.apply === true;` … `else if (dry || !apply) report.atproto = { status: 'planned', ...counts };` … `ensureIds({ …, mintGeo: Boolean(config.geo?.space) })` … and **manifest written only when something was applied** (`if (!dry && apply) writeManifest(dir, next)`). `bind.mjs` close += `publish` before `sync.push`; mirror in `profile/profile.yaml`; update `test/bind.test.mjs:35`. `config.mjs` defaults `{ render: {}, peers: {}, connectors: [], publish: {}, ...cfg }`.

- [ ] **Step 4: Configure this instance (pull-only)** — append to root `kms.yaml`:

```yaml
publish:
  static: false
  apply: false
  base_url: https://regen-toolkit-site.vercel.app
atproto:
  did: null
  handle: kc.regencoordination.xyz
  pds: null
  nsid_authority: xyz.regencoordination.kb
geo:
  parent_space: bd727a6ad6ec4a058f681ea9002a1fbf
  space: null
```

(No `types_opt_in`. `pds` gets filled when there is a peer to pull — pilot Phase 2.3.) `.env.example`: `ATPROTO_APP_PASSWORD=`.

- [ ] **Step 5: Run** → PASS; `npm run build` green. **Commit:** `feat(kms): publish op — plan mode on close, --apply for real writes; instance gate hook`

---

### Task 12: Connector contract + `runConnector` (validating, dry-aware, card upsert)

**Files:**
- Create: `packages/toolkit-framework/src/connector.mjs`
- Modify: `packages/org-os-kms/src/framework.mjs`
- Test: `packages/toolkit-framework/test/connector.test.mjs`

**Interfaces:** `runConnector(connector, { config, cursor, adapter, target, dry = false, now = () => new Date().toISOString() }) → { source, pulled, candidates, invalid, stored, updated, collisions, cursor, retractions, errors, dry }`.
- Candidate normalization: `maturity: 'raw'`, `public_use: 'not-public-yet'`, `ai_assisted: object.ai_assisted ?? true`, `provenance.origin` defaulted, `work_order: \`connector:${name}:${now()}\``, `source_lineage: object.sourceUri ?? object.source_lineage ?? source.return_path`.
- Each candidate runs `validateObject(schema, object)` + `checkInvariants(object)`; failures are collected in `invalid: [{title, errors}]` and **not stored**.
- Upsert by `sourceUri` (as revision 2); else `store`.
- The `describe()` card is upserted into the `source-system` store (match by `slugify(title)`; `maturity: raw`, `public_use: 'internal-only'` unless it already exists) — the federation primitive is always written.
- `dry: true` → pull + map + validate + report; no store, no update, no card, and the returned `cursor` is the **input** cursor.

- [ ] **Step 1: Tests** — revision 2's four tests plus:

```js
test('invalid candidates are reported, not stored; ai_assisted preserved or defaulted true; work_order + source_lineage stamped', async () => {
  const dir = instance();
  const c = fake({ map: (r) => [
    { schema: 'resource', object: { title: 'Good', type: 'resource', ai_assisted: false, sourceUri: 'at://p/x/1' } },
    { schema: 'resource', object: { type: 'resource' } },   // missing title
  ] });
  const out = await runConnector(c, ctx(dir));
  assert.equal(out.stored, 1); assert.equal(out.invalid.length, 1); assert.match(out.invalid[0].errors[0], /title/);
  const g = getAdapter('repo-data').list(dir).find(({ object }) => object.title === 'Good').object;
  assert.equal(g.ai_assisted, false); assert.match(g.work_order, /^connector:fake:/); assert.equal(g.source_lineage, 'at://p/x/1');
  const d = getAdapter('repo-data').list(dir).find(({ object }) => object.title === 'One');
  assert.equal(d, undefined);
});

test('describe() card is upserted as a source-system', async () => {
  const dir = instance();
  await runConnector(fake(), ctx(dir));
  const card = getAdapter('repo-data').list(dir).find(({ schema, object }) => schema === 'source-system' && object.title === 'Fake');
  assert.ok(card); assert.equal(card.object.public_use, 'internal-only');
  await runConnector(fake(), ctx(dir));
  assert.equal(getAdapter('repo-data').list(dir).filter(({ schema }) => schema === 'source-system').length, 1, 'idempotent');
});

test('dry: nothing stored, cursor unchanged', async () => {
  const dir = instance();
  const out = await runConnector(fake(), { ...ctx(dir), cursor: 7, dry: true });
  assert.equal(out.dry, true); assert.equal(out.stored, 0); assert.equal(out.cursor, 7); assert.equal(out.candidates, 1);
  assert.equal(getAdapter('repo-data').list(dir).length, 1);
});
```

(`instance()` must also create an empty `data/kb/source-system.yaml`; the `fake` map's `'One'` object needs `title` + `type` — it has both.)

- [ ] **Step 2: Run** → FAIL

- [ ] **Step 3: Implement**

```js
// packages/toolkit-framework/src/connector.mjs — seam 3. runConnector: describe → pull → map → validate → upsert/store → card → retract. Dry-aware; fail-soft per source.
import { getAdapter, slugify } from './storage.mjs';
import { validateObject, checkInvariants } from './index.mjs';

export class NOT_IMPLEMENTED extends Error {
  constructor(name) { super(`connector ${name}: pull not implemented`); this.code = 'NOT_IMPLEMENTED'; }
}
const LOCAL_ONLY = ['id', 'maturity', 'public_use', 'review_needs'];

export async function runConnector(connector, { config, cursor, adapter, target, dry = false, now = () => new Date().toISOString() }) {
  const source = connector.describe(config);
  const { records, cursor: nextCursor, retracted = [], errors = [] } = await connector.pull(config, { cursor });
  const a = getAdapter(adapter);
  const local = a.list(target);
  const byOrigin = new Map(local.filter((i) => i.object.sourceUri).map((i) => [i.object.sourceUri, i]));
  const stamp = now();

  const toStore = []; const toUpdate = []; const invalid = [];
  for (const r of records) for (const { schema, object } of connector.map(r, config)) {
    const base = { ...object, ai_assisted: object.ai_assisted ?? true,
      work_order: `connector:${connector.name}:${stamp}`,
      source_lineage: object.sourceUri ?? object.source_lineage ?? source.return_path,
      provenance: { origin: `${connector.name}:${source.return_path || source.title}`, ...(object.provenance || {}) } };
    const v = validateObject(schema, base); const inv = checkInvariants(base);
    const errs = [...v.errors, ...(inv?.errors || [])];
    if (errs.length) { invalid.push({ title: object.title, errors: errs }); continue; }
    const existing = object.sourceUri && byOrigin.get(object.sourceUri);
    if (existing) { const patch = {}; for (const [k, x] of Object.entries(base)) if (!LOCAL_ONLY.includes(k)) patch[k] = x; toUpdate.push({ ref: existing.ref, patch: { ...patch, review_needs: 'updated at origin' } }); }
    else toStore.push({ schema, object: { ...base, maturity: 'raw', public_use: 'not-public-yet' } });
  }
  const report = { source, pulled: records.length, candidates: toStore.length + toUpdate.length, invalid, stored: 0, updated: 0, collisions: 0, cursor, retractions: 0, errors, dry };
  if (dry) return report;

  for (const u of toUpdate) a.update(target, u.ref, u.patch);
  const { stored, collisions = [] } = toStore.length ? a.store(target, toStore) : { stored: [], collisions: [] };
  const cardSlug = slugify(source.title);
  const existingCard = local.find((i) => i.schema === 'source-system' && slugify(i.object.title) === cardSlug);
  if (!existingCard) a.store(target, [{ schema: 'source-system', object: { ...source, maturity: 'raw', public_use: 'internal-only', ai_assisted: false } }]);

  if (retracted.length) {
    const set = new Set(retracted);
    for (const { object, ref } of a.list(target)) if (object.sourceUri && set.has(object.sourceUri)) { a.update(target, ref, { maturity: 'held', review_needs: `retracted at origin ${object.sourceUri}` }); report.retractions++; }
  }
  return { ...report, stored: stored.length, updated: toUpdate.length, collisions: collisions.length, cursor: nextCursor };
}
```

Check `checkInvariants`'s real return shape in `src/index.mjs` and adapt the `inv?.errors` line. `framework.mjs`: `export { runConnector, NOT_IMPLEMENTED } from '../../toolkit-framework/src/connector.mjs';`

- [ ] **Step 4: Run** → PASS. **Commit:** `feat(framework): Connector contract + runConnector (validate, origin upsert, card upsert, dry)`

---

### Task 13: `atproto` connector — unchanged from revision 2 (no-peers guard, `ALL_TYPES`, `type` untouched, `id` stripped). **Commit:** `feat(kms): atproto connector`

---

### Task 14: `static-json` connector + Open Haven mapper (capability only)

As revision 2, with **the domain → `track` mapping removed** (Open Haven's domains are not tracks; a synthetic `audience` was a smell). `collections = ['/api/protocols.json', '/api/affordances.json']`; protocol → `resource`, affordance → `signal` (`signal_type: 'resource'`, `suggested_action: 'route'`). Test expects `first.records.length === 6` (3 + 3). Fixtures: `index`, `protocols`, `affordances` only. **No instance declares this connector in this plan.** **Commit:** `feat(kms): static-json connector + Open Haven mapper (not activated)`

---

### Task 15: Connector registry, `ingest.pull` op (verb-only, fail-soft, dry), docs

**Files:** `src/connectors/index.mjs`, `src/ops.mjs`, `docs/CONNECTORS.md`, root `kms.yaml`; test `test/ingest-pull-op.test.mjs`. **`ingest.pull` is not added to `LIFECYCLE_BINDINGS`.**

**Interfaces:** `OPS['ingest.pull']` (`write: true`, async): for each declared connector (or only `flags.connector`), `runConnector(…, { dry: flags.dry === true })`; cursor written back **only** when not dry and the connector succeeded; any error → `status: 'failed'` in the report and **`ok: true`** (fail-soft; the report carries `failed: n`). `NOT_IMPLEMENTED` → `not-implemented`.

- [ ] **Step 1: Tests** — revision 2's three tests with these changes: the "first in close" assertion becomes `assert.ok(!LIFECYCLE_BINDINGS.close.includes('ingest.pull'))`; the failing-connector test asserts `res.ok === true` and `res.report.failed === 1`; add:

```js
test('--dry: no store, no cursor write-back', async () => {
  const dir = instance([{ name: 'good', config: {}, cursor: null }]);
  const res = await OPS['ingest.pull'].run({ dir, flags: { dry: true }, deps: { registry: { good } } });
  assert.equal(res.report.connectors[0].dry, true); assert.equal(res.report.connectors[0].stored, 0);
  assert.equal(yaml.load(readFileSync(join(dir, 'kms.yaml'), 'utf8')).connectors[0].cursor, null);
});
test('--connector limits the run', async () => {
  const dir = instance([{ name: 'good', config: {}, cursor: null }, { name: 'stub', config: {}, cursor: null }]);
  const res = await OPS['ingest.pull'].run({ dir, flags: { connector: 'good' }, deps: { registry: { good, stub } } });
  assert.equal(res.report.connectors.length, 1);
});
```

- [ ] **Step 2: Run** → FAIL

- [ ] **Step 3: Implement** — revision 2's op with: `const dry = ctx.flags?.dry === true; const only = ctx.flags?.connector;` skip `decl.name !== only` when `only` is set; pass `dry` to `runConnector`; `if (!dry) raw.connectors[i].cursor = r.cursor ?? null;`; `report.failed = 0` incremented on error; return `{ ok: true, report }` always; write `kms.yaml` back only when `!dry`.

Root `kms.yaml` — append:

```yaml
connectors:
  - name: atproto
    config:
      peers: []
    cursor: null
```

`docs/CONNECTORS.md`: verbs (`org-os-kms ingest [--connector] [--dry]`, `org-os-kms publish [--apply] [--dry]`), what `close` does (plan-mode publish only), the projection list, the `.well-known` allowlist, install = vendor both packages pinned, a puller needs `atproto.pds`, identity setup steps, dev identity wiped before first real publish, `grc20Id` only with a Geo space, the `sameStoredObject` id semantics, and that `public/api/**` is committed **in publishing instances** (regen-toolkit publishes nothing in this plan).

- [ ] **Step 4: Run** both suites + `npm run build`; then `node packages/org-os-kms/src/cli.mjs ingest --dir . --dry` → `connectors[0]: { name: 'atproto', pulled: 0, dry: true }` and `node packages/org-os-kms/src/cli.mjs publish --dir . --dry` → `atproto.status: 'not-configured'`, `static: 'disabled'`, `minted: 0`. Nothing written (`git status` clean except intended files). **Commit:** `feat(kms): ingest verb (fail-soft, dry) + connector registry; docs`

---

### Task 16: Design/ADR/backlog alignment

- [ ] Update `docs/plans/2026-09-18-org-os-kms-atproto-publication-plane-design.md`: layer line (10; touches 2, 3); proving-ground section (refi-dao-commons publishes, regen-toolkit pulls); Q8 (`grc20Id` only with a configured Geo space); add the projection, the `.well-known` allowlist, `@context` absolute from `publish.base_url`, publish plan-mode/`--apply`, ingest as a verb; Open Haven "capability, not activated". Add a `docs/BACKLOG.md` item (`needs-owner`, route Layer 3): *"Open Haven as a static source — needs a source-system card and a conversation with Brandon (Rather's call next month) before activation."* Add a second (`high-risk`, Layer 10): *"regen-toolkit first publish — blocked on the name-flagging privacy gate and a review of the 141 `source-linked-unreviewed` objects."* **Commit:** `docs: align design/backlog with implementation plan rev 3`

---

### Task 17: Opt-in end-to-end round trip

As revision 2, with the publisher fixture `kms.yaml` including `publish: { apply: true, base_url: 'https://e2e.example' }` and the pull assertions unchanged (`maturity: raw`, `public_use: not-public-yet`, `sourceUri` origin, retraction on delete). Skipped unless `ATPROTO_E2E=1` + PDS/HANDLE/PASSWORD/DID. **Commit:** `test(kms): opt-in e2e publish→pull→retract`

---

## Self-review (revision 3)

**Fit findings → tasks.** Unreviewed publish / privacy gate → header, constraints, T11 config (`static:false`, `apply:false`), T16 backlog item; `.well-known` leak → T10 allowlist; projection → T1 `publicView`, T3 `toRecord`, T10, pilot D; layer → header + T16; ingest bypasses accept gate → T12 validate + stamp + card; fail-hard first on close → T15 verb-only + fail-soft; no ingest dry → T12/T15; proving-ground inversion → header + T16; Open Haven scope → T14 not activated, T15 config, T16 backlog; generators pollution + bridge filename → T6; two `knowledge.json` writers → T10 merge; `base` URLs → T10 absolute; `grc20Id` before Geo space → T6/T11; sizing/"every close" claims → constraints; `types_opt_in: [source-system]` → removed.

**Type consistency.** `isPublishable(object,{schema,types})`; `publicView` used by `toRecord` and `surface`; `ensureIds({items, write, mintGeo})` in T6/T11; `runConnector({…, dry, now})` returns `{…, invalid, dry}` and T15 forwards `dry`; `publish` report `atproto.status ∈ {not-configured, planned, applied, failed}`; connector config keys `self`, `nsid_authority`, `pds`, `peers`.
