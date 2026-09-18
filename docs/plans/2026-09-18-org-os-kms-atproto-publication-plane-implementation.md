# org-os-kms AT Proto Publication Plane — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish every publishable knowledge object from `data/kb/` to the instance's AT Proto repo and to a static JSON-LD surface, and pull peers' repos and Open Haven back into the review queue — all from `close`.

**Architecture:** Git/yaml stays the editorial plane. A pure gate (`isPublishable`) selects objects; Lexicons are generated from the framework's yaml schemas; a `publish` op diffs against a manifest and writes to the PDS (via a fetch-based XRPC client) and to `public/api/`. A framework-side `runConnector` orchestrates `describe → pull → map → store` for an `atproto` connector (peers) and a `static-json` connector (Open Haven). Everything pulled lands at `maturity: raw`.

**Tech Stack:** Node ≥ 18 (native `fetch`, `crypto.randomUUID`), `node:test` + `node:assert/strict`, `js-yaml`. **No new dependencies** — both packages have zero devDependencies today and the XRPC surface needed is four endpoints.

**Spec:** `docs/plans/2026-09-18-org-os-kms-atproto-publication-plane-design.md` · ADR: `docs/adr/0001-atproto-as-publication-plane.md` · Glossary: `CONTEXT.md`

## Global Constraints

- Publication gate: `type ∈ PUBLISHABLE_TYPES` (12 types, **never `person`**) ∧ `public_use ∈ {ok-with-caveat, source-linked-unreviewed, reviewed-for-explanation, reviewed-for-guidance}`. Maturity is not a gate.
- NSID authority: `xyz.regencoordination.kb` (from `kms.yaml.atproto.nsid_authority`; never hard-coded outside config/tests).
- Identity: `did:plc`; the DID comes from `kms.yaml.atproto.did`; credentials only from env `ATPROTO_APP_PASSWORD`.
- `rkey = object.id` (UUIDv4). Objects without `id` get one minted at first publish, written back to yaml.
- Never delete locally on a peer's delete: flag with `maturity: held` + `review_needs`.
- Records: no floats (yaml integers only), ≤ 1 MB serialized, `$type` = NSID.
- `write: true` ops fail hard (executor policy). `NOT_IMPLEMENTED` and unreachable-peer are the only per-item continue-on-error cases.
- org-os-kms imports the framework **only** through `src/framework.mjs`.
- Test runner: `node --test` from the package dir. Baseline before starting: `cd packages/org-os-kms && npm test` → 65 pass; `cd packages/toolkit-framework && npm test` → all pass. Both must stay green after every task.
- Plan deviation from spec, deliberate: no `atproto` **storage adapter** is built. The publish op needs diff + `swapRecord` + delete, which the 5-method adapter contract (idempotent-by-slug `store`) cannot express; wrapping the client in an adapter would add a layer nothing calls. Revisit only if a caller appears.

## File map

```
packages/toolkit-framework/
  src/publishable.mjs                 NEW  gate constants + isPublishable
  src/lexicon.mjs                     NEW  yaml schema → Lexicon doc; validateRecord
  src/connector.mjs                   NEW  Connector contract + runConnector
  schemas/frontmatter.yaml            MOD  +id, grc20Id, sourceUri, viaUri
  lexicons/xyz.regencoordination.kb.*.json  NEW (generated, committed)
  scripts/gen-lexicons.mjs            NEW  regenerates lexicons/
  test/publishable.test.mjs, lexicon.test.mjs, connector.test.mjs  NEW

packages/org-os-kms/
  src/framework.mjs                   MOD  re-export new framework seams
  src/identity.mjs                    NEW  ensureIds (mint id + grc20Id, write back)
  src/refs.mjs                        NEW  rewriteRefs (slug → origin AT-URI)
  src/manifest.mjs                    NEW  read/write data/kms-published.json
  src/atproto/client.mjs              NEW  fetch-based XRPC client
  src/atproto/publish.mjs             NEW  planPublish (pure) + applyPublish
  src/atproto/connector.mjs           NEW  'atproto' connector
  src/static/surface.mjs              NEW  public/api/** + public/.well-known/
  src/connectors/index.mjs            NEW  connector registry
  src/connectors/static-json/index.mjs     NEW  'static-json' connector
  src/connectors/static-json/openhaven.mjs NEW  pure mapper
  src/ops.mjs                         MOD  +publish, +ingest.pull
  src/bind.mjs                        MOD  close lifecycle
  docs/CONNECTORS.md                  NEW
  test/*.test.mjs                     NEW one per module; test/fixtures/openhaven/*.json

repo root
  kms.yaml                            MOD  +atproto, +geo, +connectors, +publish
  .env.example                        MOD  +ATPROTO_APP_PASSWORD
```

---

### Task 1: Publication gate

**Files:**
- Create: `packages/toolkit-framework/src/publishable.mjs`
- Test: `packages/toolkit-framework/test/publishable.test.mjs`

**Interfaces:**
- Produces: `PUBLISHABLE_TYPES: string[]`, `PUBLISHABLE_PUBLIC_USE: string[]`, `isPublishable(object) → boolean`

- [ ] **Step 1: Write the failing test**

```js
// packages/toolkit-framework/test/publishable.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PUBLISHABLE_TYPES, PUBLISHABLE_PUBLIC_USE, isPublishable } from '../src/publishable.mjs';
import { listSchemas, loadSchema } from '../src/index.mjs';

test('publishable set is the 12 hub types minus person', () => {
  assert.equal(PUBLISHABLE_TYPES.length, 12);
  assert.ok(!PUBLISHABLE_TYPES.includes('person'));
  for (const t of PUBLISHABLE_TYPES) assert.ok(listSchemas().includes(t), `schema missing: ${t}`);
});

test('every PUBLISHABLE_PUBLIC_USE value is a real axis value', () => {
  const axis = loadSchema('review-maturity').axes.public_use.values;
  for (const v of PUBLISHABLE_PUBLIC_USE) assert.ok(axis.includes(v), v);
});

test('isPublishable: type × public_use table', () => {
  assert.equal(isPublishable({ type: 'resource', public_use: 'ok-with-caveat' }), true);
  assert.equal(isPublishable({ type: 'resource', public_use: 'internal-only' }), false);
  assert.equal(isPublishable({ type: 'resource', public_use: 'requires-community-consent' }), false);
  assert.equal(isPublishable({ type: 'person', public_use: 'reviewed-for-guidance' }), false);
  assert.equal(isPublishable({ type: 'resource' }), false);
  assert.equal(isPublishable(null), false);
  assert.equal(isPublishable({ type: 'resource', public_use: 'ok-with-caveat', maturity: 'raw' }), true, 'maturity is not a gate');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/toolkit-framework && node --test test/publishable.test.mjs`
Expected: FAIL — `Cannot find module '../src/publishable.mjs'`

- [ ] **Step 3: Write minimal implementation**

```js
// packages/toolkit-framework/src/publishable.mjs — the publication gate (spec Q9/Q11).
// One definition; the publish op, the static surface and every test use it.
export const PUBLISHABLE_TYPES = Object.freeze([
  'claim-evidence', 'concept-lineage', 'encyclopedia-entry', 'implementation-record',
  'option-entry', 'organization', 'public-use-boundary', 'relationship-record',
  'resource', 'signal', 'source-system', 'track',
]);

export const PUBLISHABLE_PUBLIC_USE = Object.freeze([
  'ok-with-caveat', 'source-linked-unreviewed', 'reviewed-for-explanation', 'reviewed-for-guidance',
]);

export function isPublishable(object) {
  if (!object || typeof object !== 'object') return false;
  return PUBLISHABLE_TYPES.includes(object.type) && PUBLISHABLE_PUBLIC_USE.includes(object.public_use);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/toolkit-framework && node --test test/publishable.test.mjs`
Expected: PASS (3 tests). If the axis test fails on `loadSchema('review-maturity').axes.public_use.values`, open `schemas/review-maturity.yaml` and fix the path in the test to the real key — `isValid()` in `src/index.mjs:37` shows the exact access path.

- [ ] **Step 5: Commit**

```bash
git add packages/toolkit-framework/src/publishable.mjs packages/toolkit-framework/test/publishable.test.mjs
git commit -m "feat(framework): publication gate — PUBLISHABLE_TYPES × PUBLISHABLE_PUBLIC_USE"
```

---

### Task 2: Schema fields for identity and provenance

**Files:**
- Modify: `packages/toolkit-framework/schemas/frontmatter.yaml`
- Test: `packages/toolkit-framework/test/publishable.test.mjs` (append)

**Interfaces:**
- Produces: every schema that `extends: frontmatter` now accepts `id`, `grc20Id`, `sourceUri`, `viaUri` (all optional strings). Spec said "each publishable schema gains …"; adding them to `frontmatter` is equivalent (all 12 extend it) and avoids 12 edits.

- [ ] **Step 1: Write the failing test**

Append to `packages/toolkit-framework/test/publishable.test.mjs`:

```js
import { schemaFields, validateObject } from '../src/index.mjs';

test('identity + provenance fields exist on every publishable schema', () => {
  for (const t of PUBLISHABLE_TYPES) {
    const f = schemaFields(t);
    for (const k of ['id', 'grc20Id', 'sourceUri', 'viaUri']) assert.ok(f[k], `${t} lacks ${k}`);
  }
  const r = validateObject('resource', { title: 'x', type: 'resource', id: 'a-b', grc20Id: 'c', sourceUri: 'at://d/e/f' });
  assert.equal(r.valid, true, r.errors.join('; '));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/toolkit-framework && node --test test/publishable.test.mjs`
Expected: FAIL — `resource lacks id`

- [ ] **Step 3: Add the fields**

In `packages/toolkit-framework/schemas/frontmatter.yaml`, under `fields:`, after `notes: { type: string }` add:

```yaml
  id: { type: string }                   # stable object id (UUIDv4); minted by the origin at first publish — CONTEXT.md "Object ID"
  grc20Id: { type: string }              # Geo entity id shared for the same concept — never re-minted on republish
  sourceUri: { type: string }            # origin AT-URI (first publisher); immutable across republishes
  viaUri: { type: string }               # immediate peer AT-URI this copy was pulled from (optional)
```

- [ ] **Step 4: Run the whole framework suite**

Run: `cd packages/toolkit-framework && npm test`
Expected: all PASS. If a snapshot-style test of `schemaFields('frontmatter')` or of `toJsonLdContext()` fails because it enumerates fields, update that snapshot — the new fields are intended.

- [ ] **Step 5: Commit**

```bash
git add packages/toolkit-framework/schemas/frontmatter.yaml packages/toolkit-framework/test/publishable.test.mjs
git commit -m "feat(framework): id / grc20Id / sourceUri / viaUri on frontmatter"
```

---

### Task 3: Lexicon generator + record validator

**Files:**
- Create: `packages/toolkit-framework/src/lexicon.mjs`
- Create: `packages/toolkit-framework/scripts/gen-lexicons.mjs`
- Create: `packages/toolkit-framework/lexicons/` (12 generated files)
- Modify: `packages/toolkit-framework/package.json` (add script)
- Test: `packages/toolkit-framework/test/lexicon.test.mjs`

**Interfaces:**
- Consumes: `loadSchema(name)`, `listSchemas()` from `src/index.mjs`; `PUBLISHABLE_TYPES`.
- Produces:
  - `nsidFor(type, authority) → string` (`'resource'` → `'xyz.regencoordination.kb.resource'`, `'claim-evidence'` → `'…kb.claimEvidence'`)
  - `typeForNsid(nsid, authority) → string | null`
  - `flattenSchema(name) → { required: string[], fields: Record<string, def> }` (resolves `extends`)
  - `generateLexicon(type, { authority }) → LexiconDoc`
  - `generateAll({ authority }) → Record<nsid, LexiconDoc>`
  - `validateRecord(record, lexiconDoc) → { ok: boolean, errors: string[] }`
  - `toRecord(object, nsid) → record` (adds `$type`, strips `undefined`/`null`)

- [ ] **Step 1: Write the failing tests**

```js
// packages/toolkit-framework/test/lexicon.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nsidFor, typeForNsid, flattenSchema, generateLexicon, generateAll, validateRecord, toRecord } from '../src/lexicon.mjs';
import { PUBLISHABLE_TYPES } from '../src/publishable.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const AUTH = 'xyz.regencoordination.kb';

test('nsidFor camel-cases the type under the authority; typeForNsid inverts it', () => {
  assert.equal(nsidFor('resource', AUTH), 'xyz.regencoordination.kb.resource');
  assert.equal(nsidFor('claim-evidence', AUTH), 'xyz.regencoordination.kb.claimEvidence');
  assert.equal(typeForNsid('xyz.regencoordination.kb.claimEvidence', AUTH), 'claim-evidence');
  assert.equal(typeForNsid('com.example.other', AUTH), null);
});

test('flattenSchema resolves extends: resource has title (from frontmatter) and url (own)', () => {
  const f = flattenSchema('resource');
  assert.ok(f.fields.title && f.fields.url && f.fields.id);
  assert.deepEqual(f.required, ['title', 'type']);
});

test('generateLexicon maps yaml defs to Lexicon properties', () => {
  const doc = generateLexicon('resource', { authority: AUTH });
  assert.equal(doc.lexicon, 1);
  assert.equal(doc.id, 'xyz.regencoordination.kb.resource');
  const main = doc.defs.main;
  assert.equal(main.type, 'record');
  assert.equal(main.key, 'any');
  const p = main.record.properties;
  assert.deepEqual(p.title, { type: 'string' });
  assert.deepEqual(p.is_source_system_candidate, { type: 'boolean' });
  assert.deepEqual(p.related_concepts, { type: 'array', items: { type: 'string' } });
  assert.equal(p.link_status.type, 'string');
  assert.ok(p.link_status.knownValues.includes('active'));
  assert.equal(p.maturity.type, 'string');
  assert.ok(p.maturity.knownValues.includes('pattern-generating'));
  assert.deepEqual(main.record.required, ['title', 'type']);
});

test('generateAll yields exactly one doc per publishable type', () => {
  const all = generateAll({ authority: AUTH });
  assert.equal(Object.keys(all).length, PUBLISHABLE_TYPES.length);
});

test('committed lexicons/ match a fresh generation (drift test)', () => {
  const dir = join(here, '..', 'lexicons');
  const all = generateAll({ authority: AUTH });
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  assert.deepEqual(files, Object.keys(all).sort().map((n) => `${n}.json`));
  for (const [nsid, doc] of Object.entries(all)) {
    const onDisk = JSON.parse(readFileSync(join(dir, `${nsid}.json`), 'utf8'));
    assert.deepEqual(onDisk, doc, `lexicons/${nsid}.json is stale — run: npm run gen:lexicons`);
  }
});

test('validateRecord: required, types, no floats, size, $type', () => {
  const doc = generateLexicon('resource', { authority: AUTH });
  const good = toRecord({ title: 'A', type: 'resource', related_concepts: ['x'], startYear: 2020 }, doc.id);
  assert.equal(good.$type, doc.id);
  assert.deepEqual(validateRecord(good, doc), { ok: true, errors: [] });

  assert.match(validateRecord({ $type: doc.id, type: 'resource' }, doc).errors[0], /missing required field: title/);
  assert.match(validateRecord({ $type: doc.id, title: 'A', type: 'resource', related_concepts: 'nope' }, doc).errors[0], /related_concepts must be an array/);
  assert.match(validateRecord({ $type: doc.id, title: 'A', type: 'resource', provenance: { score: 0.5 } }, doc).errors[0], /float at provenance\.score/);
  assert.match(validateRecord({ $type: 'wrong', title: 'A', type: 'resource' }, doc).errors[0], /\$type/);
  const big = { $type: doc.id, title: 'A', type: 'resource', notes: 'x'.repeat(1_000_001) };
  assert.match(validateRecord(big, doc).errors[0], /exceeds 1 MB/);
});

test('toRecord strips undefined and null, keeps nested objects', () => {
  const r = toRecord({ title: 'A', type: 'resource', notes: undefined, url: null, provenance: { origin: 'o' } }, 'x.y.z');
  assert.deepEqual(r, { $type: 'x.y.z', title: 'A', type: 'resource', provenance: { origin: 'o' } });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/toolkit-framework && node --test test/lexicon.test.mjs`
Expected: FAIL — `Cannot find module '../src/lexicon.mjs'`

- [ ] **Step 3: Implement `src/lexicon.mjs`**

```js
// packages/toolkit-framework/src/lexicon.mjs — yaml schema → AT Proto Lexicon. Generated, never hand-edited.
// Lexicon objects are open (unknown fields allowed) — same as validateObject's open model.
import { loadSchema } from './index.mjs';
import { PUBLISHABLE_TYPES } from './publishable.mjs';

const MAX_RECORD_BYTES = 1_000_000;

const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export function nsidFor(type, authority) { return `${authority}.${camel(type)}`; }

export function typeForNsid(nsid, authority) {
  if (!nsid.startsWith(`${authority}.`)) return null;
  const type = kebab(nsid.slice(authority.length + 1));
  return PUBLISHABLE_TYPES.includes(type) ? type : null;
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

function axisValues(axis) {
  return loadSchema('review-maturity').axes[axis].values;
}

function toProperty(def) {
  if (def.enum) return { type: 'string', knownValues: [...def.enum] };
  if (def.axis) return { type: 'string', knownValues: [...axisValues(def.axis)] };
  if (def.type === 'boolean') return { type: 'boolean' };
  if (def.type === 'array') return { type: 'array', items: { type: 'string' } };
  if (def.type === 'integer') return { type: 'integer' };
  return { type: 'string' };
}

export function generateLexicon(type, { authority }) {
  const { required, fields } = flattenSchema(type);
  const properties = {};
  for (const [k, def] of Object.entries(fields)) properties[k] = toProperty(def);
  return {
    lexicon: 1,
    id: nsidFor(type, authority),
    defs: { main: { type: 'record', key: 'any', record: { type: 'object', required: [...required], properties } } },
  };
}

export function generateAll({ authority }) {
  const out = {};
  for (const t of PUBLISHABLE_TYPES) { const d = generateLexicon(t, { authority }); out[d.id] = d; }
  return out;
}

export function toRecord(object, nsid) {
  const clean = (v) => {
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === 'object') {
      const o = {};
      for (const [k, x] of Object.entries(v)) if (x !== undefined && x !== null) o[k] = clean(x);
      return o;
    }
    return v;
  };
  return { $type: nsid, ...clean(object) };
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
  for (const r of main.required) {
    if (record[r] === undefined || record[r] === null || record[r] === '') errors.push(`missing required field: ${r}`);
  }
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
```

- [ ] **Step 4: Write the generator script and run it**

```js
// packages/toolkit-framework/scripts/gen-lexicons.mjs — regenerates lexicons/ from schemas/. Usage: node scripts/gen-lexicons.mjs [authority]
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateAll } from '../src/lexicon.mjs';

const authority = process.argv[2] || 'xyz.regencoordination.kb';
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'lexicons');
mkdirSync(dir, { recursive: true });
for (const f of readdirSync(dir)) if (f.endsWith('.json')) unlinkSync(join(dir, f));
const all = generateAll({ authority });
for (const [nsid, doc] of Object.entries(all)) writeFileSync(join(dir, `${nsid}.json`), JSON.stringify(doc, null, 2) + '\n');
console.log(`wrote ${Object.keys(all).length} lexicons to ${dir} (authority ${authority})`);
```

Add to `packages/toolkit-framework/package.json` `scripts`: `"gen:lexicons": "node scripts/gen-lexicons.mjs"`.

Run: `cd packages/toolkit-framework && npm run gen:lexicons`
Expected: `wrote 12 lexicons to …/lexicons`

- [ ] **Step 5: Run tests**

Run: `cd packages/toolkit-framework && npm test`
Expected: all PASS, including the drift test. If `loadSchema('review-maturity').axes[axis].values` is not the real shape, fix `axisValues()` to match how `isValid()` reads it in `src/index.mjs:37`.

- [ ] **Step 6: Commit**

```bash
git add packages/toolkit-framework/src/lexicon.mjs packages/toolkit-framework/scripts/gen-lexicons.mjs packages/toolkit-framework/lexicons packages/toolkit-framework/package.json packages/toolkit-framework/test/lexicon.test.mjs
git commit -m "feat(framework): generate AT Proto Lexicons from yaml schemas + record validator"
```

---

### Task 4: Framework seam re-exports + manifest module

**Files:**
- Modify: `packages/org-os-kms/src/framework.mjs`
- Create: `packages/org-os-kms/src/manifest.mjs`
- Test: `packages/org-os-kms/test/manifest.test.mjs`

**Interfaces:**
- Produces (framework.mjs): re-exports `isPublishable, PUBLISHABLE_TYPES, nsidFor, typeForNsid, generateAll, validateRecord, toRecord`.
- Produces (manifest.mjs):
  - `MANIFEST_PATH = 'data/kms-published.json'`
  - `readManifest(dir) → Manifest` where `Manifest = { version: 1, objects: Record<id, { slug, type, rkey, atUri, cid, hash, publishedAt }> }` (empty when file absent)
  - `writeManifest(dir, manifest) → path`
  - `slugIndex(manifest) → Map<slug, entry[]>`

- [ ] **Step 1: Write the failing test**

```js
// packages/org-os-kms/test/manifest.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readManifest, writeManifest, slugIndex, MANIFEST_PATH } from '../src/manifest.mjs';

test('readManifest returns an empty manifest when absent; write/read round-trips', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kms-manifest-'));
  assert.deepEqual(readManifest(dir), { version: 1, objects: {} });
  const m = { version: 1, objects: { 'id-1': { slug: 'a', type: 'resource', rkey: 'id-1', atUri: 'at://did/x/id-1', cid: 'c', hash: 'h', publishedAt: '2026-09-18T00:00:00.000Z' } } };
  const p = writeManifest(dir, m);
  assert.equal(p, join(dir, MANIFEST_PATH));
  assert.ok(existsSync(p));
  assert.deepEqual(readManifest(dir), m);
});

test('slugIndex groups entries by slug', () => {
  const m = { version: 1, objects: { a: { slug: 's', type: 'resource' }, b: { slug: 's', type: 'concept-lineage' }, c: { slug: 't', type: 'resource' } } };
  const ix = slugIndex(m);
  assert.equal(ix.get('s').length, 2);
  assert.equal(ix.get('t').length, 1);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/org-os-kms && node --test test/manifest.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Append to `packages/org-os-kms/src/framework.mjs`:

```js
export { isPublishable, PUBLISHABLE_TYPES, PUBLISHABLE_PUBLIC_USE } from '../../toolkit-framework/src/publishable.mjs';
export { nsidFor, typeForNsid, generateAll, validateRecord, toRecord } from '../../toolkit-framework/src/lexicon.mjs';
```

```js
// packages/org-os-kms/src/manifest.mjs — the publish manifest: what this instance has on its publication plane.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

export const MANIFEST_PATH = 'data/kms-published.json';

export function readManifest(dir) {
  const p = join(dir, MANIFEST_PATH);
  if (!existsSync(p)) return { version: 1, objects: {} };
  return JSON.parse(readFileSync(p, 'utf8'));
}

export function writeManifest(dir, manifest) {
  const p = join(dir, MANIFEST_PATH);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(manifest, null, 2) + '\n');
  return p;
}

export function slugIndex(manifest) {
  const ix = new Map();
  for (const e of Object.values(manifest.objects)) {
    if (!ix.has(e.slug)) ix.set(e.slug, []);
    ix.get(e.slug).push(e);
  }
  return ix;
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/org-os-kms && npm test`
Expected: 65 + 2 PASS

- [ ] **Step 5: Commit**

```bash
git add packages/org-os-kms/src/framework.mjs packages/org-os-kms/src/manifest.mjs packages/org-os-kms/test/manifest.test.mjs
git commit -m "feat(kms): publish manifest + framework seam re-exports"
```

---

### Task 5: Identity minting (`id`, `grc20Id`) with yaml write-back

**Files:**
- Create: `packages/org-os-kms/src/identity.mjs`
- Test: `packages/org-os-kms/test/identity.test.mjs`

**Interfaces:**
- Consumes: `getAdapter(name).list(target) → [{schema, object, ref}]`, `.update(target, ref, patch)` via `framework.mjs`; `isPublishable`.
- Produces: `ensureIds({ adapter, target, uuid = crypto.randomUUID }) → { minted: [{ ref, id, grc20Id }], items: [{ schema, object, ref }] }` — `items` is the post-mint listing of **publishable** objects, each guaranteed to have `id` and `grc20Id`. `assertRkey(id)` throws if `id` is not `[a-zA-Z0-9.\-_:~]{1,512}`.

- [ ] **Step 1: Write the failing test**

```js
// packages/org-os-kms/test/identity.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { ensureIds, assertRkey } from '../src/identity.mjs';

function instance() {
  const dir = mkdtempSync(join(tmpdir(), 'kms-id-'));
  mkdirSync(join(dir, 'data', 'kb'), { recursive: true });
  writeFileSync(join(dir, 'data', 'kb', 'resource.yaml'), yaml.dump({ entries: {
    pub: { title: 'Pub', type: 'resource', public_use: 'ok-with-caveat' },
    internal: { title: 'Internal', type: 'resource', public_use: 'internal-only' },
    haveid: { title: 'Have', type: 'resource', public_use: 'ok-with-caveat', id: 'existing-id', grc20Id: 'existing-geo' },
  } }));
  return dir;
}

test('ensureIds mints id + grc20Id only for publishable objects lacking them and writes back', () => {
  const dir = instance();
  let n = 0; const uuid = () => `uuid-${++n}`;
  const { minted, items } = ensureIds({ adapter: 'repo-data', target: dir, uuid });
  assert.equal(minted.length, 1);
  assert.deepEqual(minted[0], { ref: minted[0].ref, id: 'uuid-1', grc20Id: 'uuid-2' });
  const disk = yaml.load(readFileSync(join(dir, 'data', 'kb', 'resource.yaml'), 'utf8')).entries;
  assert.equal(disk.pub.id, 'uuid-1');
  assert.equal(disk.pub.grc20Id, 'uuid-2');
  assert.equal(disk.internal.id, undefined, 'non-publishable untouched');
  assert.equal(disk.haveid.id, 'existing-id');
  assert.equal(items.length, 2);
  for (const it of items) assert.ok(it.object.id && it.object.grc20Id);
});

test('ensureIds is idempotent', () => {
  const dir = instance();
  ensureIds({ adapter: 'repo-data', target: dir });
  const { minted } = ensureIds({ adapter: 'repo-data', target: dir });
  assert.equal(minted.length, 0);
});

test('assertRkey enforces the AT Proto rkey charset', () => {
  assertRkey('550e8400-e29b-41d4-a716-446655440000');
  assert.throws(() => assertRkey('has space'), /rkey/);
  assert.throws(() => assertRkey(''), /rkey/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/org-os-kms && node --test test/identity.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```js
// packages/org-os-kms/src/identity.mjs — mint object ids at first publish (spec Q8/Q10). git holds the ids.
import { randomUUID } from 'node:crypto';
import * as fw from './framework.mjs';

const RKEY = /^[a-zA-Z0-9.\-_:~]{1,512}$/;

export function assertRkey(id) {
  if (typeof id !== 'string' || !RKEY.test(id)) throw new Error(`invalid rkey: ${JSON.stringify(id)}`);
  return id;
}

export function ensureIds({ adapter, target, uuid = randomUUID }) {
  const a = fw.getAdapter(adapter);
  const minted = [];
  for (const { object, ref } of a.list(target)) {
    if (!fw.isPublishable(object)) continue;
    const patch = {};
    if (!object.id) patch.id = uuid();
    if (!object.grc20Id) patch.grc20Id = uuid();
    if (Object.keys(patch).length) {
      a.update(target, ref, patch);
      minted.push({ ref, id: patch.id ?? object.id, grc20Id: patch.grc20Id ?? object.grc20Id });
    }
  }
  const items = a.list(target).filter(({ object }) => fw.isPublishable(object));
  for (const { object } of items) assertRkey(object.id);
  return { minted, items };
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/org-os-kms && npm test`
Expected: PASS. If `repo-data.update` rejects the patch because the ref shape differs, print `a.list(target)[0].ref` in the test and match it — refs are adapter-issued; the code above only ever replays refs from `list()`.

- [ ] **Step 5: Commit**

```bash
git add packages/org-os-kms/src/identity.mjs packages/org-os-kms/test/identity.test.mjs
git commit -m "feat(kms): mint id + grc20Id for publishable objects, write back to yaml"
```

---

### Task 6: Cross-reference rewriting

**Files:**
- Create: `packages/org-os-kms/src/refs.mjs`
- Test: `packages/org-os-kms/test/refs.test.mjs`

**Interfaces:**
- Produces: `REF_ARRAY_FIELDS = ['related_concepts','related_options','related_resources','source_traditions']`, `REF_STRING_FIELDS = ['subject','object']` (relationship-record), `rewriteRefs(object, resolve) → object` (new object; `resolve(slug) → atUri | null`), `resolverFrom(manifest) → (slug) => atUri | null` (null when 0 or >1 manifest entries share the slug).

- [ ] **Step 1: Write the failing test**

```js
// packages/org-os-kms/test/refs.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteRefs, resolverFrom } from '../src/refs.mjs';

const manifest = { version: 1, objects: {
  i1: { slug: 'decentralization', type: 'concept-lineage', atUri: 'at://did:plc:me/x.kb.conceptLineage/i1' },
  i2: { slug: 'dup', type: 'resource', atUri: 'at://did:plc:me/x.kb.resource/i2' },
  i3: { slug: 'dup', type: 'concept-lineage', atUri: 'at://did:plc:me/x.kb.conceptLineage/i3' },
} };

test('resolverFrom resolves unique slugs, null for unknown or ambiguous', () => {
  const r = resolverFrom(manifest);
  assert.equal(r('decentralization'), 'at://did:plc:me/x.kb.conceptLineage/i1');
  assert.equal(r('dup'), null);
  assert.equal(r('nope'), null);
});

test('rewriteRefs rewrites resolvable slugs in array fields and leaves the rest', () => {
  const r = resolverFrom(manifest);
  const out = rewriteRefs({ title: 'A', type: 'resource', related_concepts: ['decentralization', 'nope', 'dup'] }, r);
  assert.deepEqual(out.related_concepts, ['at://did:plc:me/x.kb.conceptLineage/i1', 'nope', 'dup']);
});

test('rewriteRefs handles relationship-record subject/object strings and is non-mutating', () => {
  const r = resolverFrom(manifest);
  const src = { type: 'relationship-record', subject: 'decentralization', predicate: 'related_to', object: 'nope' };
  const out = rewriteRefs(src, r);
  assert.equal(out.subject, 'at://did:plc:me/x.kb.conceptLineage/i1');
  assert.equal(out.object, 'nope');
  assert.equal(src.subject, 'decentralization');
});

test('rewriteRefs never rewrites a value that is already an at:// URI', () => {
  const r = () => 'at://should-not-be-called';
  const out = rewriteRefs({ type: 'resource', related_concepts: ['at://did:plc:x/c/1'] }, r);
  assert.deepEqual(out.related_concepts, ['at://did:plc:x/c/1']);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/org-os-kms && node --test test/refs.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```js
// packages/org-os-kms/src/refs.mjs — slug → origin AT-URI at publish time (spec Q19). Pure.
import { slugIndex } from './manifest.mjs';

export const REF_ARRAY_FIELDS = ['related_concepts', 'related_options', 'related_resources', 'source_traditions'];
export const REF_STRING_FIELDS = ['subject', 'object'];

const isAtUri = (v) => typeof v === 'string' && v.startsWith('at://');

export function resolverFrom(manifest) {
  const ix = slugIndex(manifest);
  return (slug) => {
    const hits = ix.get(slug);
    return hits && hits.length === 1 && hits[0].atUri ? hits[0].atUri : null;
  };
}

export function rewriteRefs(object, resolve) {
  const out = { ...object };
  const one = (v) => (isAtUri(v) ? v : (resolve(v) ?? v));
  for (const f of REF_ARRAY_FIELDS) if (Array.isArray(out[f])) out[f] = out[f].map(one);
  if (out.type === 'relationship-record') for (const f of REF_STRING_FIELDS) if (typeof out[f] === 'string') out[f] = one(out[f]);
  return out;
}
```

- [ ] **Step 4: Run tests** — `cd packages/org-os-kms && npm test` → PASS

- [ ] **Step 5: Commit**

```bash
git add packages/org-os-kms/src/refs.mjs packages/org-os-kms/test/refs.test.mjs
git commit -m "feat(kms): rewrite cross-references to origin AT-URIs at publish"
```

---

### Task 7: XRPC client

**Files:**
- Create: `packages/org-os-kms/src/atproto/client.mjs`
- Test: `packages/org-os-kms/test/atproto-client.test.mjs`

**Interfaces:**
- Produces: `createClient({ pds, fetchImpl = globalThis.fetch }) → client` with:
  - `client.login({ identifier, password }) → { did }` (stores `accessJwt`)
  - `client.putRecord({ repo, collection, rkey, record, swapRecord? }) → { uri, cid }`
  - `client.deleteRecord({ repo, collection, rkey }) → void`
  - `client.listRecords({ repo, collection, cursor?, limit = 100 }) → { records: [{ uri, cid, value }], cursor? }`
  - `client.listAllRecords({ repo, collection }) → [{ uri, cid, value }]` (follows cursor)
  - `client.getLatestCommit({ did }) → { cid, rev }`
  - Errors: non-2xx → `XrpcError` with `.status`, `.error` (the XRPC `error` field), `.message`.

- [ ] **Step 1: Write the failing test**

```js
// packages/org-os-kms/test/atproto-client.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, XrpcError } from '../src/atproto/client.mjs';

function fakeFetch(routes) {
  const calls = [];
  const f = async (url, init = {}) => {
    const u = new URL(url);
    const nsid = u.pathname.split('/xrpc/')[1];
    calls.push({ nsid, method: init.method || 'GET', headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : undefined, query: Object.fromEntries(u.searchParams) });
    const r = routes[nsid];
    if (!r) return new Response(JSON.stringify({ error: 'NotFound', message: 'no route' }), { status: 404 });
    const out = typeof r === 'function' ? r(calls.at(-1)) : r;
    return new Response(JSON.stringify(out.body ?? out), { status: out.status ?? 200, headers: { 'content-type': 'application/json' } });
  };
  f.calls = calls;
  return f;
}

test('login stores the token and sends it as Bearer on writes', async () => {
  const fetchImpl = fakeFetch({
    'com.atproto.server.createSession': { accessJwt: 'JWT', did: 'did:plc:abc' },
    'com.atproto.repo.putRecord': { uri: 'at://did:plc:abc/x.y/k', cid: 'bafy1' },
  });
  const c = createClient({ pds: 'https://pds.test', fetchImpl });
  const { did } = await c.login({ identifier: 'kc.test', password: 'pw' });
  assert.equal(did, 'did:plc:abc');
  const res = await c.putRecord({ repo: did, collection: 'x.y', rkey: 'k', record: { $type: 'x.y', title: 'T' }, swapRecord: 'bafy0' });
  assert.deepEqual(res, { uri: 'at://did:plc:abc/x.y/k', cid: 'bafy1' });
  const put = fetchImpl.calls[1];
  assert.equal(put.method, 'POST');
  assert.equal(put.headers.Authorization, 'Bearer JWT');
  assert.deepEqual(put.body, { repo: 'did:plc:abc', collection: 'x.y', rkey: 'k', record: { $type: 'x.y', title: 'T' }, swapRecord: 'bafy0' });
});

test('listAllRecords follows the cursor; getLatestCommit is a GET with did', async () => {
  let page = 0;
  const fetchImpl = fakeFetch({
    'com.atproto.repo.listRecords': () => (page++ === 0
      ? { records: [{ uri: 'at://d/c/1', cid: 'c1', value: { a: 1 } }], cursor: 'next' }
      : { records: [{ uri: 'at://d/c/2', cid: 'c2', value: { a: 2 } }] }),
    'com.atproto.sync.getLatestCommit': { cid: 'ccid', rev: '3abc' },
  });
  const c = createClient({ pds: 'https://pds.test', fetchImpl });
  const all = await c.listAllRecords({ repo: 'd', collection: 'c' });
  assert.equal(all.length, 2);
  assert.equal(fetchImpl.calls[1].query.cursor, 'next');
  assert.deepEqual(await c.getLatestCommit({ did: 'd' }), { cid: 'ccid', rev: '3abc' });
  assert.equal(fetchImpl.calls[2].query.did, 'd');
});

test('non-2xx becomes XrpcError with status and error code', async () => {
  const fetchImpl = fakeFetch({ 'com.atproto.repo.deleteRecord': { status: 400, body: { error: 'InvalidSwap', message: 'record was modified' } } });
  const c = createClient({ pds: 'https://pds.test', fetchImpl });
  await assert.rejects(c.deleteRecord({ repo: 'd', collection: 'c', rkey: 'k' }), (e) => e instanceof XrpcError && e.status === 400 && e.error === 'InvalidSwap');
});
```

- [ ] **Step 2: Run to verify it fails** — `cd packages/org-os-kms && node --test test/atproto-client.test.mjs` → FAIL, module not found

- [ ] **Step 3: Implement**

```js
// packages/org-os-kms/src/atproto/client.mjs — the four XRPC calls the publication plane needs. No SDK.
export class XrpcError extends Error {
  constructor(status, error, message) { super(`${error}: ${message}`); this.status = status; this.error = error; }
}

export function createClient({ pds, fetchImpl = globalThis.fetch }) {
  const base = pds.replace(/\/$/, '');
  let accessJwt = null;

  async function call(nsid, { method = 'GET', query, body } = {}) {
    const url = new URL(`${base}/xrpc/${nsid}`);
    for (const [k, v] of Object.entries(query || {})) if (v !== undefined) url.searchParams.set(k, v);
    const headers = { 'content-type': 'application/json' };
    if (accessJwt) headers.Authorization = `Bearer ${accessJwt}`;
    const res = await fetchImpl(url.toString(), { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) throw new XrpcError(res.status, json.error || 'Unknown', json.message || text);
    return json;
  }

  return {
    async login({ identifier, password }) {
      const s = await call('com.atproto.server.createSession', { method: 'POST', body: { identifier, password } });
      accessJwt = s.accessJwt;
      return { did: s.did };
    },
    putRecord({ repo, collection, rkey, record, swapRecord }) {
      return call('com.atproto.repo.putRecord', { method: 'POST', body: { repo, collection, rkey, record, ...(swapRecord ? { swapRecord } : {}) } });
    },
    async deleteRecord({ repo, collection, rkey }) {
      await call('com.atproto.repo.deleteRecord', { method: 'POST', body: { repo, collection, rkey } });
    },
    listRecords({ repo, collection, cursor, limit = 100 }) {
      return call('com.atproto.repo.listRecords', { query: { repo, collection, cursor, limit } });
    },
    async listAllRecords({ repo, collection }) {
      const out = []; let cursor;
      do {
        const page = await this.listRecords({ repo, collection, cursor });
        out.push(...page.records);
        cursor = page.cursor;
      } while (cursor);
      return out;
    },
    getLatestCommit({ did }) { return call('com.atproto.sync.getLatestCommit', { query: { did } }); },
  };
}
```

- [ ] **Step 4: Run tests** — `cd packages/org-os-kms && npm test` → PASS

- [ ] **Step 5: Commit**

```bash
git add packages/org-os-kms/src/atproto/client.mjs packages/org-os-kms/test/atproto-client.test.mjs
git commit -m "feat(kms): fetch-based XRPC client for putRecord/deleteRecord/listRecords/getLatestCommit"
```

---

### Task 8: Publish planner (pure) + applier

**Files:**
- Create: `packages/org-os-kms/src/atproto/publish.mjs`
- Test: `packages/org-os-kms/test/atproto-publish.test.mjs`

**Interfaces:**
- Consumes: `nsidFor, generateAll, validateRecord, toRecord` (framework), `rewriteRefs, resolverFrom`, manifest shape.
- Produces:
  - `contentHash(record) → sha256 hex of stable-key JSON`
  - `planPublish({ items, manifest, did, authority }) → { ok, errors: [{ slug, errors[] }], create: Op[], update: Op[], delete: Op[], skip: string[] }` where `Op = { id, slug, type, collection, rkey, record, hash, swapRecord? }`. **Validates every item before returning; `ok:false` means nothing may be applied.**
  - `applyPublish(plan, { client, did, now = () => new Date().toISOString() }) → { manifest, applied: { created, updated, deleted }, failures: [{ id, error }] }` — returns the **new** manifest (input not mutated); a `swapRecord` failure is recorded per record and does not stop the others.

- [ ] **Step 1: Write the failing test**

```js
// packages/org-os-kms/test/atproto-publish.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planPublish, applyPublish, contentHash } from '../src/atproto/publish.mjs';
import { XrpcError } from '../src/atproto/client.mjs';

const AUTH = 'xyz.regencoordination.kb';
const DID = 'did:plc:me';
const item = (slug, extra = {}) => ({ schema: 'resource', ref: `data/kb/resource.yaml#${slug}`, object: { title: slug, type: 'resource', public_use: 'ok-with-caveat', id: `id-${slug}`, grc20Id: `g-${slug}`, ...extra } });
const empty = { version: 1, objects: {} };

test('planPublish: new objects → create; unchanged → skip; changed → update with swapRecord; gone → delete', () => {
  const a = item('a'); const b = item('b');
  const first = planPublish({ items: [a, b], manifest: empty, did: DID, authority: AUTH });
  assert.equal(first.ok, true);
  assert.equal(first.create.length, 2);
  assert.equal(first.create[0].collection, 'xyz.regencoordination.kb.resource');
  assert.equal(first.create[0].rkey, 'id-a');
  assert.equal(first.create[0].record.$type, 'xyz.regencoordination.kb.resource');

  const manifest = { version: 1, objects: {
    'id-a': { slug: 'a', type: 'resource', rkey: 'id-a', atUri: `at://${DID}/xyz.regencoordination.kb.resource/id-a`, cid: 'cid-a', hash: first.create[0].hash, publishedAt: 't' },
    'id-b': { slug: 'b', type: 'resource', rkey: 'id-b', atUri: `at://${DID}/xyz.regencoordination.kb.resource/id-b`, cid: 'cid-b', hash: first.create[1].hash, publishedAt: 't' },
  } };
  const second = planPublish({ items: [a, item('b', { notes: 'changed' })], manifest, did: DID, authority: AUTH });
  assert.deepEqual(second.skip, ['id-a']);
  assert.equal(second.update.length, 1);
  assert.equal(second.update[0].swapRecord, 'cid-b');

  const third = planPublish({ items: [a], manifest, did: DID, authority: AUTH });
  assert.equal(third.delete.length, 1);
  assert.equal(third.delete[0].rkey, 'id-b');
});

test('planPublish rewrites refs against the manifest and validates everything up front', () => {
  const manifest = { version: 1, objects: { 'id-c': { slug: 'c', type: 'concept-lineage', atUri: `at://${DID}/x/id-c`, rkey: 'id-c', cid: 'x', hash: 'h', publishedAt: 't' } } };
  const p = planPublish({ items: [item('a', { related_concepts: ['c', 'zzz'] })], manifest, did: DID, authority: AUTH });
  assert.deepEqual(p.create[0].record.related_concepts, [`at://${DID}/x/id-c`, 'zzz']);

  const bad = planPublish({ items: [item('a', { provenance: { score: 0.1 } })], manifest: empty, did: DID, authority: AUTH });
  assert.equal(bad.ok, false);
  assert.equal(bad.create.length, 0, 'no ops when validation fails');
  assert.match(bad.errors[0].errors[0], /float/);
});

test('applyPublish calls the client per op, records per-record failures, returns a new manifest', async () => {
  const calls = [];
  const client = {
    async putRecord(op) { calls.push(['put', op.rkey]); if (op.rkey === 'id-b') throw new XrpcError(400, 'InvalidSwap', 'modified'); return { uri: `at://${DID}/${op.collection}/${op.rkey}`, cid: `cid-${op.rkey}` }; },
    async deleteRecord(op) { calls.push(['del', op.rkey]); },
  };
  const plan = planPublish({ items: [item('a'), item('b')], manifest: { version: 1, objects: { 'id-z': { slug: 'z', type: 'resource', rkey: 'id-z', atUri: 'u', cid: 'c', hash: 'h', publishedAt: 't' } } }, did: DID, authority: AUTH });
  const out = await applyPublish(plan, { client, did: DID, now: () => 'NOW' });
  assert.deepEqual(calls, [['put', 'id-a'], ['put', 'id-b'], ['del', 'id-z']]);
  assert.equal(out.applied.created, 1);
  assert.equal(out.applied.deleted, 1);
  assert.equal(out.failures.length, 1);
  assert.equal(out.failures[0].id, 'id-b');
  assert.ok(out.manifest.objects['id-a']);
  assert.equal(out.manifest.objects['id-a'].cid, 'cid-id-a');
  assert.equal(out.manifest.objects['id-a'].publishedAt, 'NOW');
  assert.equal(out.manifest.objects['id-b'], undefined, 'failed record not recorded as published');
  assert.equal(out.manifest.objects['id-z'], undefined, 'deleted removed');
});

test('contentHash is stable across key order', () => {
  assert.equal(contentHash({ a: 1, b: [1, { c: 2, d: 3 }] }), contentHash({ b: [1, { d: 3, c: 2 }], a: 1 }));
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/atproto-publish.test.mjs` → FAIL, module not found

- [ ] **Step 3: Implement**

```js
// packages/org-os-kms/src/atproto/publish.mjs — plan (pure) then apply. Validation is all-or-nothing; application is per-record.
import { createHash } from 'node:crypto';
import * as fw from '../framework.mjs';
import { rewriteRefs, resolverFrom } from '../refs.mjs';

function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

export function contentHash(record) { return createHash('sha256').update(stable(record)).digest('hex'); }

export function planPublish({ items, manifest, did, authority }) {
  const lexicons = fw.generateAll({ authority });
  const resolve = resolverFrom(manifest);
  const plan = { ok: true, errors: [], create: [], update: [], delete: [], skip: [] };
  const seen = new Set();

  for (const { object } of items) {
    const collection = fw.nsidFor(object.type, authority);
    const record = fw.toRecord(rewriteRefs(object, resolve), collection);
    const v = fw.validateRecord(record, lexicons[collection]);
    if (!v.ok) { plan.errors.push({ slug: fw.slugify(object.title), errors: v.errors }); continue; }
    const id = object.id; seen.add(id);
    const hash = contentHash(record);
    const prev = manifest.objects[id];
    const op = { id, slug: fw.slugify(object.title), type: object.type, collection, rkey: id, record, hash };
    if (!prev) plan.create.push(op);
    else if (prev.hash === hash) plan.skip.push(id);
    else plan.update.push({ ...op, swapRecord: prev.cid });
  }
  for (const [id, prev] of Object.entries(manifest.objects)) {
    if (!seen.has(id)) plan.delete.push({ id, slug: prev.slug, type: prev.type, collection: fw.nsidFor(prev.type, authority), rkey: prev.rkey });
  }
  if (plan.errors.length) return { ...plan, ok: false, create: [], update: [], delete: [], skip: [] };
  return plan;
}

export async function applyPublish(plan, { client, did, now = () => new Date().toISOString() }) {
  if (!plan.ok) throw new Error('applyPublish called with a failed plan');
  const manifest = { version: 1, objects: { ...plan.manifestObjects } };
  const out = { applied: { created: 0, updated: 0, deleted: 0 }, failures: [], manifest };
  // carry forward skipped entries untouched
  for (const id of plan.skip) manifest.objects[id] = plan.previous[id];

  for (const [kind, ops] of [['create', plan.create], ['update', plan.update]]) {
    for (const op of ops) {
      try {
        const { uri, cid } = await client.putRecord({ repo: did, collection: op.collection, rkey: op.rkey, record: op.record, swapRecord: op.swapRecord });
        manifest.objects[op.id] = { slug: op.slug, type: op.type, rkey: op.rkey, atUri: uri, cid, hash: op.hash, publishedAt: now() };
        out.applied[kind === 'create' ? 'created' : 'updated']++;
      } catch (e) {
        out.failures.push({ id: op.id, error: e.message });
        if (kind === 'update') manifest.objects[op.id] = plan.previous[op.id]; // keep last-known-good
      }
    }
  }
  for (const op of plan.delete) {
    try { await client.deleteRecord({ repo: did, collection: op.collection, rkey: op.rkey }); out.applied.deleted++; }
    catch (e) { out.failures.push({ id: op.id, error: e.message }); manifest.objects[op.id] = plan.previous[op.id]; }
  }
  return out;
}
```

`applyPublish` needs the previous manifest entries; make `planPublish` attach them: at the end of `planPublish`, before returning, set `plan.previous = manifest.objects; plan.manifestObjects = {};`. (Both are plain data; the test's `assert.deepEqual` on `plan.skip` etc. is unaffected.)

- [ ] **Step 4: Run tests** — `cd packages/org-os-kms && npm test` → PASS. If `fw.slugify` is not re-exported, it is — `framework.mjs` already exports it from `storage.mjs`.

- [ ] **Step 5: Commit**

```bash
git add packages/org-os-kms/src/atproto/publish.mjs packages/org-os-kms/test/atproto-publish.test.mjs
git commit -m "feat(kms): publish planner (validate-all, diff by content hash) + per-record applier"
```

---

### Task 9: Static surface

**Files:**
- Create: `packages/org-os-kms/src/static/surface.mjs`
- Test: `packages/org-os-kms/test/static-surface.test.mjs`

**Interfaces:**
- Produces: `writeStaticSurface({ dir, outDir = 'public', items, manifest, config }) → { files: string[] }`. Writes, relative to `join(dir, outDir)`:
  - `api/<type>.json` → `{ "@context": "/kb/context.jsonld", type, count, items: [entry] }`
  - `api/<type>/<id>.json` → `entry`
  - `api/index.json` → `{ name, description, endpoints: [{path, description}], access: {readOnly:true, authentication:'none'} }` (Open Haven's shape — cheap, and their consumers expect it; `.well-known/knowledge.json` remains the DAOstar discovery doc)
  - `.well-known/knowledge.json` → DAOstar `KnowledgeManifest` with `exchange.published_domains` = the NSIDs published, `subscribed_domains` = peer DIDs + static-source base URLs from `config.connectors`, `sources` = published `source-system` entries' `{title, url?, steward}`, plus `geo: config.geo`, `did: config.atproto?.did`.
  - copies every `<dir>/.well-known/*.json` that is not `knowledge.json` into `<outDir>/.well-known/`.
  - `entry` = `{ "@context": "/kb/context.jsonld", ...object, atUri, cid }` where `atUri`/`cid` come from the manifest (absent if not yet on AT Proto).
  - Only `items` that are publishable are written (caller passes the filtered list from `ensureIds`).

- [ ] **Step 1: Write the failing test**

```js
// packages/org-os-kms/test/static-surface.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeStaticSurface } from '../src/static/surface.mjs';

test('writes api/, index.json, .well-known/knowledge.json and copies other .well-known files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kms-static-'));
  mkdirSync(join(dir, '.well-known'));
  writeFileSync(join(dir, '.well-known', 'dao.json'), '{"type":"DAO"}');
  const items = [
    { schema: 'resource', ref: 'r#a', object: { title: 'A', type: 'resource', public_use: 'ok-with-caveat', id: 'id-a' } },
    { schema: 'source-system', ref: 's#s', object: { title: 'S', type: 'source-system', public_use: 'ok-with-caveat', id: 'id-s', steward: 'x', return_path: 'y' } },
  ];
  const manifest = { version: 1, objects: { 'id-a': { slug: 'a', type: 'resource', rkey: 'id-a', atUri: 'at://d/c/id-a', cid: 'cid-a', hash: 'h', publishedAt: 't' } } };
  const config = { atproto: { did: 'did:plc:me', nsid_authority: 'xyz.regencoordination.kb' }, geo: { parent_space: 'p', space: null },
    connectors: [{ name: 'atproto', config: { peers: ['did:plc:peer'] } }, { name: 'static-json', config: { base_url: 'https://www.openhaven.net' } }] };

  const { files } = writeStaticSurface({ dir, items, manifest, config });
  const pub = (p) => JSON.parse(readFileSync(join(dir, 'public', p), 'utf8'));

  const all = pub('api/resource.json');
  assert.equal(all['@context'], '/kb/context.jsonld');
  assert.equal(all.count, 1);
  assert.equal(all.items[0].atUri, 'at://d/c/id-a');
  const one = pub('api/resource/id-a.json');
  assert.equal(one.cid, 'cid-a');
  const s = pub('api/source-system/id-s.json');
  assert.equal(s.atUri, undefined, 'not yet on AT Proto');

  const idx = pub('api/index.json');
  assert.ok(idx.endpoints.some((e) => e.path === '/api/resource.json'));

  const km = pub('.well-known/knowledge.json');
  assert.equal(km.type, 'KnowledgeManifest');
  assert.deepEqual(km.exchange.published_domains, ['xyz.regencoordination.kb.resource', 'xyz.regencoordination.kb.sourceSystem']);
  assert.deepEqual(km.exchange.subscribed_domains, ['did:plc:peer', 'https://www.openhaven.net']);
  assert.equal(km.sources[0].title, 'S');
  assert.equal(km.did, 'did:plc:me');
  assert.deepEqual(km.geo, { parent_space: 'p', space: null });

  assert.ok(existsSync(join(dir, 'public', '.well-known', 'dao.json')));
  assert.ok(files.length >= 6);
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL, module not found

- [ ] **Step 3: Implement**

```js
// packages/org-os-kms/src/static/surface.mjs — the non-AT-Proto publication target (spec Q1/Q2/Q13/Q18). Pure over (items, manifest, config).
import { mkdirSync, writeFileSync, readdirSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as fw from '../framework.mjs';

const CONTEXT = '/kb/context.jsonld';

export function writeStaticSurface({ dir, outDir = 'public', items, manifest, config }) {
  const out = join(dir, outDir);
  const files = [];
  const write = (rel, data) => { const p = join(out, rel); mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, JSON.stringify(data, null, 2) + '\n'); files.push(rel); };

  const byType = new Map();
  for (const { object } of items) {
    const m = manifest.objects[object.id];
    const entry = { '@context': CONTEXT, ...object, ...(m ? { atUri: m.atUri, cid: m.cid } : {}) };
    if (!byType.has(object.type)) byType.set(object.type, []);
    byType.get(object.type).push(entry);
  }
  const types = [...byType.keys()].sort();
  for (const t of types) {
    const entries = byType.get(t);
    write(`api/${t}.json`, { '@context': CONTEXT, type: t, count: entries.length, items: entries });
    for (const e of entries) write(`api/${t}/${e.id}.json`, e);
  }

  write('api/index.json', {
    name: `${config.instance || 'org-os-kms'} knowledge API`,
    description: 'Static, read-only JSON-LD over the published knowledge objects of this instance. Each entry carries its AT Proto atUri when published there.',
    endpoints: types.flatMap((t) => [{ path: `/api/${t}.json`, description: `All ${t} entries.` }, { path: `/api/${t}/{id}.json`, description: `One ${t} by id.` }]),
    access: { readOnly: true, authentication: 'none' },
  });

  const authority = config.atproto?.nsid_authority;
  const subscribed = (config.connectors || []).flatMap((c) => c.name === 'atproto' ? (c.config?.peers || []) : c.config?.base_url ? [c.config.base_url] : []);
  write('.well-known/knowledge.json', {
    '@context': 'https://www.daostar.org/schemas',
    type: 'KnowledgeManifest',
    did: config.atproto?.did,
    geo: config.geo,
    domains: types,
    exchange: { published_domains: authority ? types.map((t) => fw.nsidFor(t, authority)) : [], subscribed_domains: subscribed },
    sources: (byType.get('source-system') || []).map((s) => ({ title: s.title, url: s.url, steward: s.steward, atUri: s.atUri })),
  });

  const wk = join(dir, '.well-known');
  if (existsSync(wk)) for (const f of readdirSync(wk)) {
    if (f.endsWith('.json') && f !== 'knowledge.json') { mkdirSync(join(out, '.well-known'), { recursive: true }); copyFileSync(join(wk, f), join(out, '.well-known', f)); files.push(`.well-known/${f}`); }
  }
  return { files };
}
```

- [ ] **Step 4: Run tests** — PASS

- [ ] **Step 5: Commit**

```bash
git add packages/org-os-kms/src/static/surface.mjs packages/org-os-kms/test/static-surface.test.mjs
git commit -m "feat(kms): static JSON-LD surface + .well-known/knowledge.json from the publish manifest"
```

---

### Task 10: `publish` op, lifecycle binding, config

**Files:**
- Modify: `packages/org-os-kms/src/ops.mjs`
- Modify: `packages/org-os-kms/src/bind.mjs:27` (close list)
- Modify: `packages/org-os-kms/src/config.mjs` (defaults)
- Modify: repo root `kms.yaml`, `.env.example`
- Test: `packages/org-os-kms/test/publish-op.test.mjs`

**Interfaces:**
- Consumes: `ensureIds`, `readManifest/writeManifest`, `planPublish/applyPublish`, `createClient`, `writeStaticSurface`.
- Produces: `OPS.publish = { kind:'exec', write:true, run(ctx) }`; `ctx.deps` may inject `{ createClient, env }` for tests. Report shape: `{ ok, report: { minted, atproto: {status:'applied'|'not-configured'|'failed', created, updated, deleted, skipped, failures} , static: { files } , dry } }`. `ctx.flags?.dry === true` → plan + static preview, no PDS writes, no manifest write.

- [ ] **Step 1: Write the failing test**

```js
// packages/org-os-kms/test/publish-op.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { OPS } from '../src/ops.mjs';
import { LIFECYCLE_BINDINGS } from '../src/bind.mjs';

function instance({ atproto = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'kms-pub-'));
  mkdirSync(join(dir, 'data', 'kb'), { recursive: true });
  writeFileSync(join(dir, 'data', 'kb', 'resource.yaml'), yaml.dump({ entries: {
    a: { title: 'A', type: 'resource', public_use: 'ok-with-caveat' },
    i: { title: 'I', type: 'resource', public_use: 'internal-only' },
  } }));
  writeFileSync(join(dir, 'kms.yaml'), yaml.dump({ instance: 't', adapter: 'repo-data', target: '.',
    ...(atproto ? { atproto: { did: 'did:plc:me', handle: 'kc.test', pds: 'https://pds.test', nsid_authority: 'xyz.regencoordination.kb' } } : {}) }));
  return dir;
}

function fakeClientFactory(log) {
  return () => ({
    async login() { log.push('login'); return { did: 'did:plc:me' }; },
    async putRecord(op) { log.push(['put', op.rkey]); return { uri: `at://did:plc:me/${op.collection}/${op.rkey}`, cid: 'cid1' }; },
    async deleteRecord(op) { log.push(['del', op.rkey]); },
  });
}

test('publish is registered and bound after render.site, before sync.push', () => {
  assert.ok(OPS.publish && OPS.publish.write === true);
  const c = LIFECYCLE_BINDINGS.close;
  assert.ok(c.indexOf('publish') > c.indexOf('render.site'));
  assert.equal(c.indexOf('publish'), c.indexOf('sync.push') - 1);
});

test('publish: mints ids, writes to PDS, writes manifest + static surface', async () => {
  const dir = instance(); const log = [];
  const res = await OPS.publish.run({ dir, deps: { createClient: fakeClientFactory(log), env: { ATPROTO_APP_PASSWORD: 'pw' } } });
  assert.equal(res.ok, true, JSON.stringify(res.report));
  assert.equal(res.report.minted, 1);
  assert.equal(res.report.atproto.status, 'applied');
  assert.equal(res.report.atproto.created, 1);
  assert.deepEqual(log[0], 'login');
  assert.ok(existsSync(join(dir, 'data', 'kms-published.json')));
  assert.ok(existsSync(join(dir, 'public', 'api', 'resource.json')));
  const m = JSON.parse(readFileSync(join(dir, 'data', 'kms-published.json'), 'utf8'));
  assert.equal(Object.keys(m.objects).length, 1);
});

test('publish: second run is all skips', async () => {
  const dir = instance(); const log = [];
  const deps = { createClient: fakeClientFactory(log), env: { ATPROTO_APP_PASSWORD: 'pw' } };
  await OPS.publish.run({ dir, deps });
  const res = await OPS.publish.run({ dir, deps });
  assert.equal(res.report.atproto.skipped, 1);
  assert.equal(res.report.atproto.created, 0);
});

test('publish: not configured → static still written, atproto reported not-configured, ok', async () => {
  const dir = instance({ atproto: false });
  const res = await OPS.publish.run({ dir, deps: { createClient: () => { throw new Error('must not be called'); }, env: {} } });
  assert.equal(res.ok, true);
  assert.equal(res.report.atproto.status, 'not-configured');
  assert.ok(existsSync(join(dir, 'public', 'api', 'resource.json')));
});

test('publish: missing credential → not-configured (not a failure)', async () => {
  const dir = instance();
  const res = await OPS.publish.run({ dir, deps: { createClient: () => { throw new Error('must not be called'); }, env: {} } });
  assert.equal(res.ok, true);
  assert.equal(res.report.atproto.status, 'not-configured');
});

test('publish --dry: plans and previews, writes nothing to PDS or manifest', async () => {
  const dir = instance(); const log = [];
  const res = await OPS.publish.run({ dir, flags: { dry: true }, deps: { createClient: fakeClientFactory(log), env: { ATPROTO_APP_PASSWORD: 'pw' } } });
  assert.equal(res.report.dry, true);
  assert.equal(res.report.atproto.created, 1);
  assert.equal(log.length, 0);
  assert.ok(!existsSync(join(dir, 'data', 'kms-published.json')));
});

test('publish: validation failure fails hard before any PDS write', async () => {
  const dir = instance(); const log = [];
  writeFileSync(join(dir, 'data', 'kb', 'resource.yaml'), yaml.dump({ entries: { a: { title: 'A', type: 'resource', public_use: 'ok-with-caveat', provenance: { score: 0.5 } } } }));
  const res = await OPS.publish.run({ dir, deps: { createClient: fakeClientFactory(log), env: { ATPROTO_APP_PASSWORD: 'pw' } } });
  assert.equal(res.ok, false);
  assert.equal(log.length, 0);
  assert.match(JSON.stringify(res.report.errors), /float/);
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/publish-op.test.mjs` → FAIL (`OPS.publish` undefined)

- [ ] **Step 3: Implement the op**

In `packages/org-os-kms/src/ops.mjs` add imports at the top:

```js
import { loadKmsConfig } from './config.mjs';
import { ensureIds } from './identity.mjs';
import { readManifest, writeManifest } from './manifest.mjs';
import { planPublish, applyPublish } from './atproto/publish.mjs';
import { createClient as defaultCreateClient } from './atproto/client.mjs';
import { writeStaticSurface } from './static/surface.mjs';
```

and add to `OPS` (before the `'csis-review'` skill entries):

```js
'publish': { kind: 'exec', write: true, run: async (ctx) => {
  const dir = ctx.dir || '.';
  const config = ctx.config || (ctx.config = loadKmsConfig(dir));
  const deps = { createClient: defaultCreateClient, env: process.env, ...(ctx.deps || {}) };
  const dry = ctx.flags?.dry === true;
  const target = join(dir, config.target);

  const { minted, items } = ensureIds({ adapter: config.adapter, target });
  const manifest = readManifest(dir);
  const report = { minted: minted.length, dry, atproto: { status: 'not-configured' }, static: null };

  const at = config.atproto;
  const password = deps.env.ATPROTO_APP_PASSWORD;
  let next = manifest;
  if (at?.did && at?.pds && at?.nsid_authority) {
    const plan = planPublish({ items, manifest, did: at.did, authority: at.nsid_authority });
    if (!plan.ok) return { ok: false, report: { ...report, errors: plan.errors } };
    const counts = { created: plan.create.length, updated: plan.update.length, deleted: plan.delete.length, skipped: plan.skip.length };
    if (!password) report.atproto = { status: 'not-configured', reason: 'ATPROTO_APP_PASSWORD not set', ...counts };
    else if (dry) report.atproto = { status: 'planned', ...counts };
    else {
      const client = deps.createClient({ pds: at.pds });
      await client.login({ identifier: at.handle || at.did, password });
      const applied = await applyPublish(plan, { client, did: at.did });
      next = applied.manifest;
      report.atproto = { status: applied.failures.length ? 'failed' : 'applied', ...applied.applied, skipped: plan.skip.length, failures: applied.failures };
    }
  }

  report.static = writeStaticSurface({ dir, outDir: config.publish?.static_dir || 'public', items, manifest: next, config });
  if (!dry) writeManifest(dir, next);
  return { ok: report.atproto.status !== 'failed', report };
} },
```

Make sure `join` is imported in `ops.mjs` (it already is — used by `index.rebuild`).

In `packages/org-os-kms/src/bind.mjs`, change the `close` list to:

```js
close: ['csis-review', 'bridge', 'emit-contributions', 'federate.check', 'index.rebuild', 'render.site', 'render.dashboard', 'publish', 'sync.push'],
```

`executor.mjs` — confirm it `await`s `op.run(ctx)`. Open `src/executor.mjs`; if the call is `const r = op.run(ctx)` without `await`, change `runLifecycle` to `async` and the call to `const r = await op.run(ctx)`, then run the existing executor tests (they must still pass — synchronous ops are unaffected by `await`).

`packages/org-os-kms/src/config.mjs` — in `loadKmsConfig`, extend the returned defaults: `return { render: {}, peers: {}, connectors: [], publish: {}, ...cfg };`.

- [ ] **Step 4: Configure this instance**

Append to repo-root `kms.yaml`:

```yaml
atproto:
  did: null                              # filled after the dev account is created on the PDS (see docs/CONNECTORS.md)
  handle: dev.kc.regencoordination.xyz   # dev identity — disposable; real handle kc.regencoordination.xyz awaits council validation
  pds: null
  nsid_authority: xyz.regencoordination.kb
geo:
  parent_space: bd727a6ad6ec4a058f681ea9002a1fbf   # Knowledge Commons topic space (Rather)
  space: null                                       # Regen Knowledge Commons space — fill when bootstrapped
publish:
  static_dir: public
```

`did: null` keeps `publish` in `not-configured` for AT Proto until the account exists; the static surface publishes regardless.

Append to `.env.example`: `ATPROTO_APP_PASSWORD=   # app password for the instance's AT Proto account; never commit`.

- [ ] **Step 5: Run tests** — `cd packages/org-os-kms && npm test` → PASS. Also `cd ../.. && npm run build` must still succeed (the static surface writes into `public/`, which Astro copies; nothing else changed).

- [ ] **Step 6: Commit**

```bash
git add packages/org-os-kms/src/ops.mjs packages/org-os-kms/src/bind.mjs packages/org-os-kms/src/config.mjs packages/org-os-kms/src/executor.mjs packages/org-os-kms/test/publish-op.test.mjs kms.yaml .env.example
git commit -m "feat(kms): publish op — mint ids, diff-publish to PDS, static surface, manifest; bound on close"
```

---

### Task 11: Connector contract + `runConnector` (framework)

**Files:**
- Create: `packages/toolkit-framework/src/connector.mjs`
- Modify: `packages/org-os-kms/src/framework.mjs` (re-export)
- Test: `packages/toolkit-framework/test/connector.test.mjs`

**Interfaces:**
- Produces:
  - `Connector = { name, protocol, capabilities: {ingest, subscribe, publish}, describe(config) → sourceSystemObject, pull(config, {cursor}) → Promise<{records, cursor}>, map(record, config) → [{schema, object}] }`
  - `NOT_IMPLEMENTED` — an `Error` subclass with `.code = 'NOT_IMPLEMENTED'`
  - `runConnector(connector, { config, cursor, adapter, target }) → Promise<{ source, pulled, candidates, stored, collisions, cursor, retractions }>` — `source` = the `describe()` card; `map()` results are stored via `getAdapter(adapter).store(target, candidates)`; every candidate is forced to `maturity: 'raw'`, `ai_assisted: false`, and `provenance.origin` = connector name + endpoint if absent; `cursor` is returned **only** if store succeeded.
  - `retractions`: if `pull` returns `{ records, cursor, retracted: [sourceUri] }`, `runConnector` finds local objects with a matching `sourceUri` and updates them with `{ maturity: 'held', review_needs: 'retracted at origin <uri>' }`.

- [ ] **Step 1: Write the failing test**

```js
// packages/toolkit-framework/test/connector.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { runConnector, NOT_IMPLEMENTED } from '../src/connector.mjs';
import { getAdapter } from '../src/storage.mjs';

function instance() {
  const dir = mkdtempSync(join(tmpdir(), 'fw-conn-'));
  mkdirSync(join(dir, 'data', 'kb'), { recursive: true });
  writeFileSync(join(dir, 'data', 'kb', 'resource.yaml'), yaml.dump({ entries: {
    old: { title: 'Old', type: 'resource', sourceUri: 'at://peer/x/old', maturity: 'reviewed' } } }));
  return dir;
}

const fake = (over = {}) => ({
  name: 'fake', protocol: 'test', capabilities: { ingest: true, subscribe: false, publish: false },
  describe: (cfg) => ({ title: 'Fake', type: 'dataset', steward: 'test', return_path: cfg.endpoint }),
  pull: async (cfg, { cursor }) => ({ records: [{ id: 'r1', name: 'One' }], cursor: (cursor || 0) + 1 }),
  map: (r) => [{ schema: 'resource', object: { title: r.name, type: 'resource', maturity: 'reviewed' } }],
  ...over,
});

test('runConnector: describe → pull → map → store; forces raw; returns cursor', async () => {
  const dir = instance();
  const out = await runConnector(fake(), { config: { endpoint: 'https://f' }, cursor: null, adapter: 'repo-data', target: dir });
  assert.equal(out.source.title, 'Fake');
  assert.equal(out.pulled, 1);
  assert.equal(out.candidates, 1);
  assert.equal(out.stored, 1);
  assert.equal(out.cursor, 1);
  const stored = getAdapter('repo-data').list(dir).find(({ object }) => object.title === 'One').object;
  assert.equal(stored.maturity, 'raw', 'connector output is never trusted above raw');
  assert.equal(stored.ai_assisted, false);
  assert.ok(stored.provenance?.origin);
});

test('runConnector: map returning [] is fine; NOT_IMPLEMENTED propagates with code', async () => {
  const dir = instance();
  const out = await runConnector(fake({ map: () => [] }), { config: {}, cursor: null, adapter: 'repo-data', target: dir });
  assert.equal(out.stored, 0);
  const stub = fake({ pull: async () => { throw new NOT_IMPLEMENTED('fake'); } });
  await assert.rejects(runConnector(stub, { config: {}, cursor: null, adapter: 'repo-data', target: dir }), (e) => e.code === 'NOT_IMPLEMENTED');
});

test('runConnector: retracted sourceUris are held for review, never deleted', async () => {
  const dir = instance();
  const c = fake({ pull: async () => ({ records: [], cursor: 1, retracted: ['at://peer/x/old'] }) });
  const out = await runConnector(c, { config: {}, cursor: null, adapter: 'repo-data', target: dir });
  assert.equal(out.retractions, 1);
  const old = getAdapter('repo-data').list(dir).find(({ object }) => object.title === 'Old').object;
  assert.equal(old.maturity, 'held');
  assert.match(old.review_needs, /retracted at origin at:\/\/peer\/x\/old/);
});
```

- [ ] **Step 2: Run to verify it fails** — `cd packages/toolkit-framework && node --test test/connector.test.mjs` → FAIL

- [ ] **Step 3: Implement**

```js
// packages/toolkit-framework/src/connector.mjs — seam 3: a Connector is a source driver (2026-07-19 spec).
// describe() → source-system card · pull() → foreign records + opaque cursor · map() → KB candidates (pure).
// runConnector is the only place that sequences describe → pull → map → store → retract.
import { getAdapter } from './storage.mjs';

export class NOT_IMPLEMENTED extends Error {
  constructor(name) { super(`connector ${name}: pull not implemented`); this.code = 'NOT_IMPLEMENTED'; }
}

export async function runConnector(connector, { config, cursor, adapter, target }) {
  const source = connector.describe(config);
  const { records, cursor: nextCursor, retracted = [] } = await connector.pull(config, { cursor });
  const candidates = records.flatMap((r) => connector.map(r, config)).map(({ schema, object }) => ({
    schema,
    object: {
      ...object,
      maturity: 'raw',
      ai_assisted: false,
      provenance: { origin: `${connector.name}:${source.return_path || source.title}`, ...(object.provenance || {}) },
    },
  }));
  const a = getAdapter(adapter);
  const { stored, collisions = [] } = candidates.length ? a.store(target, candidates) : { stored: [], collisions: [] };

  let retractions = 0;
  if (retracted.length) {
    const set = new Set(retracted);
    for (const { object, ref } of a.list(target)) {
      if (object.sourceUri && set.has(object.sourceUri)) {
        a.update(target, ref, { maturity: 'held', review_needs: `retracted at origin ${object.sourceUri}` });
        retractions++;
      }
    }
  }
  return { source, pulled: records.length, candidates: candidates.length, stored: stored.length, collisions: collisions.length, cursor: nextCursor, retractions };
}
```

Add to `packages/org-os-kms/src/framework.mjs`:

```js
export { runConnector, NOT_IMPLEMENTED } from '../../toolkit-framework/src/connector.mjs';
```

- [ ] **Step 4: Run tests** — both packages `npm test` → PASS. If `repo-data.store` returns a different shape for `collisions`, read `adapters/repo-data.mjs:51-71` and match it.

- [ ] **Step 5: Commit**

```bash
git add packages/toolkit-framework/src/connector.mjs packages/toolkit-framework/test/connector.test.mjs packages/org-os-kms/src/framework.mjs
git commit -m "feat(framework): Connector contract + runConnector (describe→pull→map→store→retract)"
```

---

### Task 12: `atproto` connector

**Files:**
- Create: `packages/org-os-kms/src/atproto/connector.mjs`
- Test: `packages/org-os-kms/test/atproto-connector.test.mjs`

**Interfaces:**
- Consumes: `createClient`, `typeForNsid`, `PUBLISHABLE_TYPES`, `nsidFor`.
- Produces: `atprotoConnector` (a `Connector`) + `createAtprotoConnector({ createClient })` for injection. Config: `{ peers: [did], pds_resolver?: (did) => pdsUrl }`; `self` (this instance's DID) is passed in `config.self` by the op. Cursor: `{ [did]: { rev, seen: [atUri] } }`.
  - `pull`: for each peer: `getLatestCommit` → if `rev === cursor[did].rev`, skip the peer entirely; else `listAllRecords` for each publishable collection; `retracted` = previously `seen` URIs no longer listed.
  - `map(record, config)`: `record = { uri, cid, value }` → `[]` if `typeForNsid(value.$type)` is null or the record's **origin** DID equals `config.self`; else one candidate `{ schema, object }` with `sourceUri` = `value.sourceUri || uri` (origin), `viaUri = uri`, `$type` removed, `id`/`grc20Id` carried as-is (`id` will be re-minted at the puller's own first publish because `ensureIds` only mints when absent — so **strip `id`** in map and keep `grc20Id`).
  - `describe`: `{ title: 'AT Proto peers', type: 'knowledge-garden', steward: 'federation', return_path: peers.join(','), endpoint: config.pds }`.
  - Unreachable peer → recorded in `pull`'s returned `errors: [{did, error}]`, other peers continue.

- [ ] **Step 1: Write the failing test**

```js
// packages/org-os-kms/test/atproto-connector.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAtprotoConnector } from '../src/atproto/connector.mjs';

const AUTH = 'xyz.regencoordination.kb';
const RES = `${AUTH}.resource`;

function fakeClient(state) {
  return () => ({
    async getLatestCommit({ did }) { if (state[did]?.down) throw new Error('ECONNREFUSED'); return { cid: 'c', rev: state[did].rev }; },
    async listAllRecords({ repo, collection }) { return (state[repo].records || []).filter((r) => r.uri.includes(`/${collection}/`)); },
  });
}

test('map: foreign record → raw candidate with origin sourceUri, viaUri, no id, grc20Id kept; own-origin and unknown NSIDs skipped', () => {
  const c = createAtprotoConnector({ createClient: () => ({}) });
  const cfg = { self: 'did:plc:me', nsid_authority: AUTH };
  const rec = { uri: `at://did:plc:peer/${RES}/rk1`, cid: 'cid', value: { $type: RES, title: 'T', type: 'resource', id: 'peer-id', grc20Id: 'g1', public_use: 'ok-with-caveat' } };
  const [cand] = c.map(rec, cfg);
  assert.equal(cand.schema, 'resource');
  assert.equal(cand.object.sourceUri, rec.uri);
  assert.equal(cand.object.viaUri, rec.uri);
  assert.equal(cand.object.id, undefined);
  assert.equal(cand.object.grc20Id, 'g1');
  assert.equal(cand.object.$type, undefined);

  const republished = { uri: `at://did:plc:peer/${RES}/rk2`, cid: 'x', value: { $type: RES, title: 'R', type: 'resource', sourceUri: `at://did:plc:origin/${RES}/o1` } };
  assert.equal(c.map(republished, cfg)[0].object.sourceUri, `at://did:plc:origin/${RES}/o1`, 'origin preserved through republish');
  assert.equal(c.map(republished, cfg)[0].object.viaUri, republished.uri);

  const mine = { uri: `at://did:plc:peer/${RES}/rk3`, cid: 'x', value: { $type: RES, title: 'M', type: 'resource', sourceUri: `at://did:plc:me/${RES}/m1` } };
  assert.deepEqual(c.map(mine, cfg), [], 'my own origin is skipped');
  assert.deepEqual(c.map({ uri: 'at://did:plc:peer/com.other/x', cid: 'x', value: { $type: 'com.other' } }, cfg), []);
});

test('pull: skips unchanged peers by rev, lists changed ones, reports retractions and unreachable peers', async () => {
  const state = {
    'did:plc:a': { rev: 'r2', records: [{ uri: `at://did:plc:a/${RES}/1`, cid: 'c', value: { $type: RES, title: '1', type: 'resource' } }] },
    'did:plc:b': { rev: 'r1' },
    'did:plc:c': { down: true },
  };
  const c = createAtprotoConnector({ createClient: fakeClient(state) });
  const cfg = { self: 'did:plc:me', nsid_authority: AUTH, pds: 'https://pds', peers: ['did:plc:a', 'did:plc:b', 'did:plc:c'] };
  const cursor = { 'did:plc:a': { rev: 'r1', seen: [`at://did:plc:a/${RES}/1`, `at://did:plc:a/${RES}/gone`] }, 'did:plc:b': { rev: 'r1', seen: [] } };
  const out = await c.pull(cfg, { cursor });
  assert.equal(out.records.length, 1);
  assert.deepEqual(out.retracted, [`at://did:plc:a/${RES}/gone`]);
  assert.equal(out.cursor['did:plc:a'].rev, 'r2');
  assert.deepEqual(out.cursor['did:plc:a'].seen, [`at://did:plc:a/${RES}/1`]);
  assert.deepEqual(out.cursor['did:plc:b'], cursor['did:plc:b'], 'unchanged peer cursor carried');
  assert.equal(out.errors.length, 1);
  assert.equal(out.errors[0].did, 'did:plc:c');
});

test('describe returns a valid source-system card', () => {
  const c = createAtprotoConnector({ createClient: () => ({}) });
  const card = c.describe({ peers: ['did:plc:a'], pds: 'https://pds' });
  for (const k of ['title', 'type', 'steward', 'return_path']) assert.ok(card[k], k);
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL, module not found

- [ ] **Step 3: Implement**

```js
// packages/org-os-kms/src/atproto/connector.mjs — pull peers' repos (spec: federation plane). listRecords has no "since",
// so the cursor is {did: {rev, seen}}: skip a peer whose latest commit rev is unchanged; otherwise list fully and diff `seen` for retractions.
import * as fw from '../framework.mjs';
import { createClient as defaultCreateClient } from './client.mjs';

const originDid = (uri) => uri.split('/')[2];

export function createAtprotoConnector({ createClient = defaultCreateClient } = {}) {
  return {
    name: 'atproto',
    protocol: 'AT Protocol (XRPC listRecords)',
    capabilities: { ingest: true, subscribe: false, publish: false },

    describe(config) {
      return { title: 'AT Proto peers', type: 'knowledge-garden', steward: 'federation', return_path: (config.peers || []).join(','), endpoint: config.pds };
    },

    async pull(config, { cursor }) {
      const client = createClient({ pds: config.pds });
      const next = { ...(cursor || {}) };
      const records = []; const retracted = []; const errors = [];
      for (const did of config.peers || []) {
        try {
          const { rev } = await client.getLatestCommit({ did });
          const prev = next[did] || { rev: null, seen: [] };
          if (prev.rev === rev) continue;
          const listed = [];
          for (const type of fw.PUBLISHABLE_TYPES) {
            listed.push(...await client.listAllRecords({ repo: did, collection: fw.nsidFor(type, config.nsid_authority) }));
          }
          const seen = listed.map((r) => r.uri);
          for (const u of prev.seen) if (!seen.includes(u)) retracted.push(u);
          records.push(...listed);
          next[did] = { rev, seen };
        } catch (e) { errors.push({ did, error: e.message }); }
      }
      return { records, cursor: next, retracted, errors };
    },

    map(record, config) {
      const { uri, value } = record;
      const schema = fw.typeForNsid(value.$type, config.nsid_authority);
      if (!schema) return [];
      const sourceUri = value.sourceUri || uri;
      if (originDid(sourceUri) === config.self) return [];
      const { $type, id, ...rest } = value;
      return [{ schema, object: { ...rest, type: schema, sourceUri, viaUri: uri } }];
    },
  };
}

export const atprotoConnector = createAtprotoConnector();
```

- [ ] **Step 4: Run tests** — PASS

- [ ] **Step 5: Commit**

```bash
git add packages/org-os-kms/src/atproto/connector.mjs packages/org-os-kms/test/atproto-connector.test.mjs
git commit -m "feat(kms): atproto connector — pull peers by rev, origin-preserving map, retraction diff"
```

---

### Task 13: `static-json` connector + Open Haven mapper

**Files:**
- Create: `packages/org-os-kms/src/connectors/static-json/index.mjs`
- Create: `packages/org-os-kms/src/connectors/static-json/openhaven.mjs`
- Create: `packages/org-os-kms/test/fixtures/openhaven/{index,protocols,affordances,domains}.json`
- Test: `packages/org-os-kms/test/static-json.test.mjs`

**Interfaces:**
- Config: `{ base_url, index: '/api/index.json', mapper: 'openhaven', collections?: ['/api/protocols.json', '/api/affordances.json', '/api/domains.json'] }`. Cursor: `sha256(indexBody)`.
- Mapper module exports `{ collections: string[], map(record) → [{schema, object}] }` where `record = { collection, item }`.
- `createStaticJsonConnector({ fetchImpl, mappers })`; `MAPPERS = { openhaven }`.
- Open Haven mapping (fields verified 2026-09-18 against the live API):
  - `/api/protocols.json` item → `resource`: `title: name`, `url: communityLink`, `resource_type: entityType`, `notes: description`, `related_concepts: domainIds`, `original_source: 'openhaven:' + id`, `source_lineage: 'https://www.openhaven.net/api/protocols/' + id + '.json'`, `steward: owner`, `last_reviewed: lastInvestigated`.
  - `/api/affordances.json` item → `signal`: `title: name`, `notes: description + '\n\n' + whatItEnables`, `related_concepts: domainIds`, `source_lineage: 'https://www.openhaven.net/api/affordances.json#' + id`.
  - `/api/domains.json` item → `track`: `title: name`, `notes: description`, `source_lineage: 'https://www.openhaven.net/api/domains.json#' + id`.
  - Only the non-localized fields are read (`name`, not `name_es`).

- [ ] **Step 1: Save fixtures**

```bash
mkdir -p packages/org-os-kms/test/fixtures/openhaven
for f in index protocols affordances domains; do curl -sL "https://www.openhaven.net/api/$f.json" > "packages/org-os-kms/test/fixtures/openhaven/$f.json"; done
node -e 'const p="packages/org-os-kms/test/fixtures/openhaven/";const fs=require("fs");for(const f of ["protocols","affordances","domains"]){const j=JSON.parse(fs.readFileSync(p+f+".json"));fs.writeFileSync(p+f+".json",JSON.stringify(j.slice(0,3),null,1))}'
```

(Trim each collection to 3 items so fixtures stay small. Keep `index.json` whole.)

- [ ] **Step 2: Write the failing test**

```js
// packages/org-os-kms/test/static-json.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticJsonConnector } from '../src/connectors/static-json/index.mjs';
import * as openhaven from '../src/connectors/static-json/openhaven.mjs';
import { validateObject } from '../src/framework.mjs';

const fx = (f) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'openhaven', f), 'utf8');
const fetchImpl = async (url) => new Response(fx(new URL(url).pathname.split('/').pop()), { status: 200 });
const cfg = { base_url: 'https://www.openhaven.net', index: '/api/index.json', mapper: 'openhaven' };

test('openhaven mapper: protocol → resource, affordance → signal, domain → track; all validate', () => {
  const p = JSON.parse(fx('protocols.json'))[0];
  const [r] = openhaven.map({ collection: '/api/protocols.json', item: p });
  assert.equal(r.schema, 'resource');
  assert.equal(r.object.title, p.name);
  assert.equal(r.object.url, p.communityLink);
  assert.equal(r.object.resource_type, p.entityType);
  assert.deepEqual(r.object.related_concepts, p.domainIds);
  assert.equal(validateObject('resource', r.object).valid, true);

  const a = JSON.parse(fx('affordances.json'))[0];
  const [s] = openhaven.map({ collection: '/api/affordances.json', item: a });
  assert.equal(s.schema, 'signal');
  assert.equal(validateObject('signal', s.object).valid, true, validateObject('signal', s.object).errors.join());

  const d = JSON.parse(fx('domains.json'))[0];
  const [t] = openhaven.map({ collection: '/api/domains.json', item: d });
  assert.equal(t.schema, 'track');
  assert.equal(validateObject('track', t.object).valid, true, validateObject('track', t.object).errors.join());

  assert.deepEqual(openhaven.map({ collection: '/api/entity-types.json', item: {} }), []);
});

test('static-json connector: pull reads index + collections, cursor is content hash, unchanged → empty', async () => {
  const c = createStaticJsonConnector({ fetchImpl });
  const first = await c.pull(cfg, { cursor: null });
  assert.equal(first.records.length, 9);
  assert.match(first.cursor, /^[a-f0-9]{64}$/);
  const second = await c.pull(cfg, { cursor: first.cursor });
  assert.equal(second.records.length, 0);
  assert.equal(second.cursor, first.cursor);
  const card = c.describe(cfg);
  assert.equal(card.type, 'dataset');
  assert.equal(card.return_path, 'https://www.openhaven.net');
  assert.equal(c.map(first.records[0], cfg)[0].schema, 'resource');
});
```

- [ ] **Step 3: Run to verify it fails** — FAIL, module not found

- [ ] **Step 4: Implement**

```js
// packages/org-os-kms/src/connectors/static-json/openhaven.mjs — pure mapper for https://www.openhaven.net/api (fields verified 2026-09-18).
const BASE = 'https://www.openhaven.net';
export const collections = ['/api/protocols.json', '/api/affordances.json', '/api/domains.json'];

export function map({ collection, item }) {
  if (collection === '/api/protocols.json') return [{ schema: 'resource', object: {
    title: item.name, type: 'resource', url: item.communityLink, resource_type: item.entityType, notes: item.description,
    related_concepts: item.domainIds || [], original_source: `openhaven:${item.id}`, steward: item.owner, last_reviewed: item.lastInvestigated,
    source_lineage: `${BASE}/api/protocols/${item.id}.json`,
  } }];
  if (collection === '/api/affordances.json') return [{ schema: 'signal', object: {
    title: item.name, type: 'signal', notes: [item.description, item.whatItEnables].filter(Boolean).join('\n\n'),
    related_concepts: item.domainIds || [], source_lineage: `${BASE}/api/affordances.json#${item.id}`,
  } }];
  if (collection === '/api/domains.json') return [{ schema: 'track', object: {
    title: item.name, type: 'track', notes: item.description, source_lineage: `${BASE}/api/domains.json#${item.id}`,
  } }];
  return [];
}
```

If `validateObject('signal'|'track', …)` reports a missing required field, open that schema's `required:` list and add the field with a sensible constant (e.g. `signal_type: 'affordance'`) — the test will name it.

```js
// packages/org-os-kms/src/connectors/static-json/index.mjs — a static source: read-only JSON + discovery doc, no protocol client (CONTEXT.md "Static source").
import { createHash } from 'node:crypto';
import * as openhaven from './openhaven.mjs';

export const MAPPERS = { openhaven };

export function createStaticJsonConnector({ fetchImpl = globalThis.fetch, mappers = MAPPERS } = {}) {
  const get = async (url) => { const r = await fetchImpl(url); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.text(); };
  return {
    name: 'static-json',
    protocol: 'static JSON over HTTPS',
    capabilities: { ingest: true, subscribe: false, publish: false },
    describe(config) {
      return { title: `Static source ${new URL(config.base_url).hostname}`, type: 'dataset', steward: 'external', return_path: config.base_url, endpoint: config.base_url + (config.index || '/api/index.json') };
    },
    async pull(config, { cursor }) {
      const indexBody = await get(config.base_url + (config.index || '/api/index.json'));
      const hash = createHash('sha256').update(indexBody).digest('hex');
      if (hash === cursor) return { records: [], cursor };
      const mapper = mappers[config.mapper];
      if (!mapper) throw new Error(`static-json: unknown mapper ${config.mapper}`);
      const records = [];
      for (const collection of config.collections || mapper.collections) {
        const items = JSON.parse(await get(config.base_url + collection));
        for (const item of items) records.push({ collection, item });
      }
      return { records, cursor: hash };
    },
    map(record, config) { return mappers[config.mapper].map(record); },
  };
}

export const staticJsonConnector = createStaticJsonConnector();
```

- [ ] **Step 5: Run tests** — PASS

- [ ] **Step 6: Commit**

```bash
git add packages/org-os-kms/src/connectors/static-json packages/org-os-kms/test/static-json.test.mjs packages/org-os-kms/test/fixtures/openhaven
git commit -m "feat(kms): static-json connector + Open Haven mapper (protocol→resource, affordance→signal, domain→track)"
```

---

### Task 14: Connector registry, `ingest.pull` op, lifecycle, docs

**Files:**
- Create: `packages/org-os-kms/src/connectors/index.mjs`
- Modify: `packages/org-os-kms/src/ops.mjs`, `src/bind.mjs`, `src/config.mjs`
- Create: `packages/org-os-kms/docs/CONNECTORS.md`
- Modify: repo-root `kms.yaml`
- Test: `packages/org-os-kms/test/ingest-pull-op.test.mjs`

**Interfaces:**
- `connectors/index.mjs`: `CONNECTORS = { atproto: atprotoConnector, 'static-json': staticJsonConnector }`, `getConnector(name)` throws on unknown.
- `OPS['ingest.pull']` — `write: true`. For each `config.connectors[i]`: resolve, `runConnector` with `{ config: { ...c.config, self: config.atproto?.did, nsid_authority: config.atproto?.nsid_authority, pds: config.atproto?.pds }, cursor: c.cursor, adapter, target }`, write cursor back into `kms.yaml` (`connectors[i].cursor`), report per connector. `NOT_IMPLEMENTED` → report `not-implemented`, continue. Any other throw → report `failed`, continue to next connector, and the op returns `ok:false` at the end (fail-hard, but with every connector attempted so partial progress is visible). `ctx.deps.registry` injectable.

- [ ] **Step 1: Write the failing test**

```js
// packages/org-os-kms/test/ingest-pull-op.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { OPS } from '../src/ops.mjs';
import { LIFECYCLE_BINDINGS } from '../src/bind.mjs';
import { NOT_IMPLEMENTED } from '../src/framework.mjs';

function instance(connectors) {
  const dir = mkdtempSync(join(tmpdir(), 'kms-pull-'));
  mkdirSync(join(dir, 'data', 'kb'), { recursive: true });
  writeFileSync(join(dir, 'data', 'kb', 'resource.yaml'), yaml.dump({ entries: {} }));
  writeFileSync(join(dir, 'kms.yaml'), yaml.dump({ instance: 't', adapter: 'repo-data', target: '.', connectors }));
  return dir;
}
const good = { name: 'good', protocol: 't', capabilities: { ingest: true }, describe: () => ({ title: 'G', type: 'dataset', steward: 's', return_path: 'g' }),
  pull: async (_c, { cursor }) => ({ records: [{ n: 'X' }], cursor: (cursor || 0) + 1 }), map: (r) => [{ schema: 'resource', object: { title: r.n, type: 'resource' } }] };
const stub = { ...good, name: 'stub', pull: async () => { throw new NOT_IMPLEMENTED('stub'); } };
const broken = { ...good, name: 'broken', pull: async () => { throw new Error('boom'); } };

test('ingest.pull is registered and first in close', () => {
  assert.ok(OPS['ingest.pull']?.write === true);
  assert.equal(LIFECYCLE_BINDINGS.close[0], 'ingest.pull');
});

test('ingest.pull runs each connector, writes cursors back, continues past NOT_IMPLEMENTED', async () => {
  const dir = instance([{ name: 'good', config: {}, cursor: null }, { name: 'stub', config: {}, cursor: null }]);
  const res = await OPS['ingest.pull'].run({ dir, deps: { registry: { good, stub } } });
  assert.equal(res.ok, true, JSON.stringify(res.report));
  assert.equal(res.report.connectors[0].stored, 1);
  assert.equal(res.report.connectors[1].status, 'not-implemented');
  const cfg = yaml.load(readFileSync(join(dir, 'kms.yaml'), 'utf8'));
  assert.equal(cfg.connectors[0].cursor, 1);
  assert.equal(cfg.connectors[1].cursor, null);
});

test('ingest.pull: a failing connector does not stop the others; op reports ok:false', async () => {
  const dir = instance([{ name: 'broken', config: {}, cursor: null }, { name: 'good', config: {}, cursor: null }]);
  const res = await OPS['ingest.pull'].run({ dir, deps: { registry: { good, broken } } });
  assert.equal(res.ok, false);
  assert.equal(res.report.connectors[0].status, 'failed');
  assert.equal(res.report.connectors[1].stored, 1);
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL

- [ ] **Step 3: Implement**

```js
// packages/org-os-kms/src/connectors/index.mjs — the connector registry (composition root for source drivers).
import { atprotoConnector } from '../atproto/connector.mjs';
import { staticJsonConnector } from './static-json/index.mjs';

export const CONNECTORS = { atproto: atprotoConnector, 'static-json': staticJsonConnector };

export function getConnector(name, registry = CONNECTORS) {
  const c = registry[name];
  if (!c) throw new Error(`unknown connector: ${name} (available: ${Object.keys(registry).join(', ')})`);
  return c;
}
```

In `ops.mjs` add imports:

```js
import { readFileSync, writeFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { getConnector, CONNECTORS } from './connectors/index.mjs';
```

and the op:

```js
'ingest.pull': { kind: 'exec', write: true, run: async (ctx) => {
  const dir = ctx.dir || '.';
  const config = ctx.config || (ctx.config = loadKmsConfig(dir));
  const registry = ctx.deps?.registry || CONNECTORS;
  const target = join(dir, config.target);
  const shared = { self: config.atproto?.did, nsid_authority: config.atproto?.nsid_authority, pds: config.atproto?.pds };
  const report = { connectors: [] };
  let ok = true;
  const kmsPath = join(dir, 'kms.yaml');
  const raw = yaml.load(readFileSync(kmsPath, 'utf8'));
  raw.connectors = raw.connectors || [];

  for (let i = 0; i < (config.connectors || []).length; i++) {
    const decl = config.connectors[i];
    try {
      const connector = getConnector(decl.name, registry);
      const r = await fw.runConnector(connector, { config: { ...shared, ...(decl.config || {}) }, cursor: decl.cursor ?? null, adapter: config.adapter, target });
      raw.connectors[i].cursor = r.cursor ?? null;
      report.connectors.push({ name: decl.name, status: 'ok', pulled: r.pulled, candidates: r.candidates, stored: r.stored, collisions: r.collisions, retractions: r.retractions });
    } catch (e) {
      if (e.code === 'NOT_IMPLEMENTED') report.connectors.push({ name: decl.name, status: 'not-implemented' });
      else { ok = false; report.connectors.push({ name: decl.name, status: 'failed', error: e.message }); }
    }
  }
  writeFileSync(kmsPath, yaml.dump(raw, { lineWidth: 120 }));
  return { ok, report };
} },
```

`bind.mjs` close list becomes:

```js
close: ['ingest.pull', 'csis-review', 'bridge', 'emit-contributions', 'federate.check', 'index.rebuild', 'render.site', 'render.dashboard', 'publish', 'sync.push'],
```

Repo-root `kms.yaml` — append:

```yaml
connectors:
  - name: atproto
    config:
      peers: []                          # refi-dao-os DID once it has an account (handle knowledge.refidao.com)
    cursor: null
  - name: static-json
    config:
      base_url: https://www.openhaven.net
      index: /api/index.json
      mapper: openhaven
    cursor: null
```

Write `packages/org-os-kms/docs/CONNECTORS.md`:

```markdown
# Connectors and the publication plane

**Vocabulary:** see the repo-root `CONTEXT.md`. **Design:** `docs/plans/2026-09-18-org-os-kms-atproto-publication-plane-design.md`, ADR-0001.

## Lifecycle
`close` = `ingest.pull` → review → bridge → … → `render.site` → `publish` → `sync.push`.
- `ingest.pull` runs every `kms.yaml.connectors[]` entry through `runConnector`; pulled objects land at `maturity: raw`; cursors are written back into `kms.yaml`.
- `publish` selects `isPublishable` objects, mints `id`/`grc20Id` if absent, diff-publishes to the AT Proto repo (`data/kms-published.json` is the manifest) and regenerates `public/api/**` + `public/.well-known/`.
- `org-os-kms lifecycle close --dry` previews the publish diff without writing to the PDS or manifest.

## Connectors
| name | source-system type | cursor | map |
|---|---|---|---|
| `atproto` | knowledge-garden | `{did: {rev, seen[]}}` | Lexicon record → framework schema; origin `sourceUri` preserved; own-origin skipped; missing URIs → retraction (held) |
| `static-json` | dataset | sha256 of the index body | per-source mapper module (`static-json/openhaven.mjs`) |

## Setting up the AT Proto identity (one-time, manual)
1. Run a PDS (`@atproto/pds`, one for the federation) or use an existing one.
2. Create the instance's account there → note the `did:plc:…` and set an app password.
3. `kms.yaml.atproto`: `did`, `handle`, `pds`, `nsid_authority`. `.env`: `ATPROTO_APP_PASSWORD`.
4. Publish the Lexicon DNS record: `_lexicon.kb.regencoordination.xyz TXT "did=<did>"` (AT Proto Lexicon resolution).
5. Development uses a disposable dev identity; wipe its repo before the first real publish.
```

- [ ] **Step 4: Run everything**

```bash
cd packages/org-os-kms && npm test && cd ../toolkit-framework && npm test && cd ../.. && npm run build
```
Expected: all PASS; site builds. Then `cd packages/org-os-kms && node src/cli.mjs lifecycle close --dir ../.. --dry` (if the CLI already parses `--dry` into `ctx.flags`; if not, add `flags: { dry: flags.dry === true || flags.dry === 'true' }` to the `runLifecycle` call in `cli.mjs:35`) → the report shows `ingest.pull` pulling Open Haven (227 protocols + affordances + domains as raw `resource`/`signal`/`track` candidates) and `publish` with `atproto.status: 'not-configured'` and the static file count.

**Do not commit the Open Haven pull result into `data/kb/` from this dry run** — run it against a scratch copy or `git checkout -- data/kb` afterwards. The real first pull belongs to a `close` the operator reviews.

- [ ] **Step 5: Commit**

```bash
git add packages/org-os-kms/src/connectors/index.mjs packages/org-os-kms/src/ops.mjs packages/org-os-kms/src/bind.mjs packages/org-os-kms/src/cli.mjs packages/org-os-kms/docs/CONNECTORS.md packages/org-os-kms/test/ingest-pull-op.test.mjs kms.yaml
git commit -m "feat(kms): ingest.pull op + connector registry; bind pull/publish on close; document setup"
```

---

### Task 15: Opt-in end-to-end round trip

**Files:**
- Create: `packages/org-os-kms/test/e2e-atproto.test.mjs`

**Interfaces:** env `ATPROTO_E2E=1`, `ATPROTO_E2E_PDS`, `ATPROTO_E2E_HANDLE`, `ATPROTO_E2E_PASSWORD`, `ATPROTO_E2E_DID`. Skipped (not failed) when unset.

- [ ] **Step 1: Write the test**

```js
// packages/org-os-kms/test/e2e-atproto.test.mjs — opt-in: publishes one object to a real PDS and pulls it back as a peer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { OPS } from '../src/ops.mjs';
import { getAdapter } from '../src/framework.mjs';

const E = process.env;
const enabled = E.ATPROTO_E2E === '1' && E.ATPROTO_E2E_PDS && E.ATPROTO_E2E_HANDLE && E.ATPROTO_E2E_PASSWORD && E.ATPROTO_E2E_DID;

test('e2e: publish → pull round trip', { skip: !enabled && 'set ATPROTO_E2E=1 + PDS/HANDLE/PASSWORD/DID' }, async () => {
  const mk = (extra) => {
    const dir = mkdtempSync(join(tmpdir(), 'kms-e2e-'));
    mkdirSync(join(dir, 'data', 'kb'), { recursive: true });
    writeFileSync(join(dir, 'data', 'kb', 'resource.yaml'), yaml.dump({ entries: extra.entries || {} }));
    writeFileSync(join(dir, 'kms.yaml'), yaml.dump({ instance: extra.instance, adapter: 'repo-data', target: '.',
      atproto: { did: extra.did, handle: E.ATPROTO_E2E_HANDLE, pds: E.ATPROTO_E2E_PDS, nsid_authority: 'xyz.regencoordination.kb' }, connectors: extra.connectors || [] }));
    return dir;
  };
  const title = `E2E ${Date.now()}`;
  const publisher = mk({ instance: 'pub', did: E.ATPROTO_E2E_DID, entries: { e2e: { title, type: 'resource', public_use: 'ok-with-caveat', url: 'https://example.org' } } });
  const pub = await OPS.publish.run({ dir: publisher, deps: { env: { ATPROTO_APP_PASSWORD: E.ATPROTO_E2E_PASSWORD } } });
  assert.equal(pub.ok, true, JSON.stringify(pub.report));
  assert.equal(pub.report.atproto.created, 1);

  const puller = mk({ instance: 'pull', did: 'did:plc:other', connectors: [{ name: 'atproto', config: { peers: [E.ATPROTO_E2E_DID] }, cursor: null }] });
  const pull = await OPS['ingest.pull'].run({ dir: puller });
  assert.equal(pull.ok, true, JSON.stringify(pull.report));
  const got = getAdapter('repo-data').list(puller).find(({ object }) => object.title === title);
  assert.ok(got, 'pulled object present');
  assert.equal(got.object.maturity, 'raw');
  assert.equal(got.object.url, 'https://example.org');
  assert.match(got.object.sourceUri, new RegExp(`^at://${E.ATPROTO_E2E_DID}/xyz\\.regencoordination\\.kb\\.resource/`));

  // cleanup: demote locally → publish deletes the record
  writeFileSync(join(publisher, 'data', 'kb', 'resource.yaml'), yaml.dump({ entries: {} }));
  const del = await OPS.publish.run({ dir: publisher, deps: { env: { ATPROTO_APP_PASSWORD: E.ATPROTO_E2E_PASSWORD } } });
  assert.equal(del.report.atproto.deleted, 1);
});
```

- [ ] **Step 2: Run without env** — `node --test test/e2e-atproto.test.mjs` → 1 skipped, 0 failed.

- [ ] **Step 3: Run against a dev PDS** (operator step; document the result in the task's commit message)

```bash
ATPROTO_E2E=1 ATPROTO_E2E_PDS=https://<dev-pds> ATPROTO_E2E_HANDLE=dev.kc.regencoordination.xyz ATPROTO_E2E_PASSWORD=… ATPROTO_E2E_DID=did:plc:… node --test test/e2e-atproto.test.mjs
```
Expected: PASS. If `putRecord` returns `InvalidRecord` because the PDS validates unknown `$type` strictly, add `validate: false` to the `putRecord` body in `client.mjs` (the PDS then stores the record without Lexicon validation; ours already validated it).

- [ ] **Step 4: Commit**

```bash
git add packages/org-os-kms/test/e2e-atproto.test.mjs
git commit -m "test(kms): opt-in e2e publish→pull round trip against a real PDS"
```

---

## Self-review

**Spec coverage.** Gate (Q9/Q11) → T1. Fields (Q10 + grc20Id/sourceUri/viaUri) → T2. Lexicons generated + drift test + no floats + 1 MB → T3. Manifest → T4. Minting + write-back (Q8/Q10) → T5. Cross-refs (Q19) → T6. XRPC client → T7. Diff-publish, swapRecord, delete on demotion (Q7), validate-all-first → T8. Static surface + `.well-known/knowledge.json` + copy (Q1/Q2/Q13/Q18, geo block Q15) → T9. `publish` op, not-configured skip, `--dry`, lifecycle order → T10. `runConnector`, raw forcing, retraction-as-held → T11. Peer pull by rev, origin/own-origin rules (Q5/Q6), unreachable-peer continue → T12. Open Haven (Q1/Q14) → T13. `ingest.pull`, cursor write-back, NOT_IMPLEMENTED continue, first in close → T14. e2e → T15. Identity `did:plc`/handle/dev identity (Q16/Q17/Q21) → config + CONNECTORS.md in T10/T14 (no code depends on the DID method). Slug-collision suffixing on pull is delegated to `repo-data.store`'s existing B5 hash-suffix behaviour (`repo-data.mjs:59-68`) — not re-implemented. KOI sensor: backlogged, no task, per spec.

**Placeholder scan.** None. The one conditional instruction (add `validate: false` if the PDS rejects) names the exact file and field.

**Type consistency.** `planPublish` returns `{ok, errors, create, update, delete, skip, previous, manifestObjects}`; `applyPublish(plan, {client, did, now})` reads `plan.previous`/`plan.skip` — T8 test asserts on `applied`, `failures`, `manifest`. `runConnector` returns `{source, pulled, candidates, stored, collisions, cursor, retractions}` — T14 op reads exactly those. `ensureIds` returns `{minted, items}` — T10 op uses both. Manifest entry shape `{slug, type, rkey, atUri, cid, hash, publishedAt}` is identical in T4, T8, T9. Connector config keys `self`, `nsid_authority`, `pds`, `peers` match between T12 and T14.
