# org-os-kms AT Proto Publication Plane — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revision:** 2 (2026-09-18) — after independent review. Folds in the refi-dao-commons pilot's gate composition; keys the gate on the adapter's `schema`, not `object.type`; makes the lifecycle async; fixes `--dry`; guards against empty peers; forces pulled objects to `not-public-yet`; upserts pulls by origin URI.

**Goal:** Publish every publishable knowledge object from `data/kb/` to the instance's AT Proto repo and to a static JSON-LD surface, and pull peers' repos and Open Haven back into the review queue — all from `close`.

**Architecture:** Git/yaml stays the editorial plane. A pure gate (`isPublishable`, keyed on schema + `public_use`) plus an optional stricter instance gate selects objects; Lexicons are generated from the framework's yaml schemas; a `publish` op diffs against a manifest and writes to the PDS (fetch-based XRPC client) and to `public/api/`. A framework-side `runConnector` orchestrates `describe → pull → map → store` for an `atproto` connector (peers) and a `static-json` connector (Open Haven). Everything pulled lands at `maturity: raw`, `public_use: not-public-yet`.

**Tech Stack:** Node ≥ 18 (native `fetch`, `crypto.randomUUID`), `node:test` + `node:assert/strict`, `js-yaml`. **No new dependencies.**

**Spec:** `docs/plans/2026-09-18-org-os-kms-atproto-publication-plane-design.md` · ADR: `docs/adr/0001-atproto-as-publication-plane.md` · Glossary: `CONTEXT.md`

**Companion plan:** `refi-dao-os/docs/kms/2026-09-18-refi-dao-commons-atproto-pilot.md` — the first real publisher. Its former Tasks A/B are now Tasks 1 and 11 here. Proving-ground order: refi-dao-commons publishes, regen-toolkit pulls.

## Global Constraints

- **Schema, not `type`.** The adapter's `schema` (the yaml file an object lives in) identifies an object's kind everywhere in this plan. `object.type` is *not* reliable: `source-system` objects carry their *kind* there (`repo`, `blog`, `docs-site`, …, an enum in `schemas/source-system.yaml`), and all 34 `public-use-boundary` objects in this repo have no `type` at all. Every `isPublishable`, `nsidFor`, grouping, and gate-context call takes `item.schema`.
- Publication gate (framework floor): `schema ∈ publishableTypes(config)` ∧ `public_use ∈ {ok-with-caveat, source-linked-unreviewed, reviewed-for-explanation, reviewed-for-guidance}`. Default types = 10 (never `person`); `source-system` and `public-use-boundary` are opt-in per instance. Maturity is not a gate. An instance gate (`kms.yaml.publish.gate`) may only narrow.
- NSID authority from `kms.yaml.atproto.nsid_authority` (`xyz.regencoordination.kb`); never hard-coded outside config/tests.
- Identity `did:plc`; DID from `kms.yaml.atproto.did`; credential only from env `ATPROTO_APP_PASSWORD`.
- `rkey = object.id` (UUIDv4), minted at first publish **only for objects that passed every gate**, written back to yaml. `--dry` mints nothing.
- Never delete locally on a peer's delete: `maturity: held` + `review_needs`.
- Records: no floats, ≤ 1 MB serialized, `$type` = NSID.
- `write: true` ops fail hard (executor policy). Per-item continue-on-error only for `NOT_IMPLEMENTED`, unreachable peer, and a per-record `swapRecord` conflict.
- org-os-kms imports the framework **only** through `src/framework.mjs` (relative sibling path — see Task 5 note on installs).
- `public/api/**` and `public/.well-known/` are **committed** (regenerated on `close`; `git diff` of them is the publication change feed, same pattern as refi-dao-os's `commons/content/`). Expect ~700 files at first publish.
- Test runner: `node --test` from the package dir. **Baseline: org-os-kms 44 pass, toolkit-framework 125 pass.** Both stay green after every task.
- Deviation from spec, deliberate: no `atproto` storage adapter (the 5-method contract cannot express diff + `swapRecord` + delete).

## File map

```
packages/toolkit-framework/
  src/publishable.mjs                 NEW  gate constants, publishableTypes, isPublishable(object,{schema,types})
  src/lexicon.mjs                     NEW  yaml schema → Lexicon; validateRecord; toRecord
  src/connector.mjs                   NEW  Connector contract + runConnector
  schemas/frontmatter.yaml            MOD  +id, grc20Id, sourceUri, viaUri
  lexicons/*.json                     NEW  12 generated (10 default + 2 opt-in), committed
  scripts/gen-lexicons.mjs            NEW
  test/{publishable,lexicon,connector}.test.mjs  NEW

packages/org-os-kms/
  src/executor.mjs, src/cli.mjs       MOD  async lifecycle; boolean flags
  src/framework.mjs                   MOD  re-exports
  src/manifest.mjs                    NEW
  src/identity.mjs                    NEW  ensureIds over pre-selected items
  src/refs.mjs                        NEW
  src/gate.mjs                        NEW  instance gate hook
  src/atproto/{client,publish,connector}.mjs  NEW
  src/static/surface.mjs              NEW
  src/connectors/index.mjs            NEW
  src/connectors/static-json/{index,openhaven}.mjs  NEW
  src/ops.mjs                         MOD  +publish, +ingest.pull
  src/bind.mjs + profile/profile.yaml MOD  close lifecycle (both, in the same commit)
  src/config.mjs                      MOD  defaults
  docs/CONNECTORS.md                  NEW
  test/*.test.mjs, test/fixtures/openhaven/*.json  NEW/MOD

repo root
  kms.yaml, .env.example              MOD
  public/api/**, public/.well-known/  NEW (generated, committed)
```

---

### Task 1: Publication gate (schema-keyed, opt-in types)

**Files:**
- Create: `packages/toolkit-framework/src/publishable.mjs`
- Test: `packages/toolkit-framework/test/publishable.test.mjs`

**Interfaces:**
- `PUBLISHABLE_TYPES` (10), `OPT_IN_TYPES = ['source-system','public-use-boundary']`, `ALL_TYPES = [...PUBLISHABLE_TYPES, ...OPT_IN_TYPES]`, `PUBLISHABLE_PUBLIC_USE` (4)
- `publishableTypes(config = {}) → string[]` — default ∪ `config.publish?.types_opt_in` ∖ `config.publish?.types_opt_out`; throws on `person` or unknown
- `isPublishable(object, { schema = object?.type, types = PUBLISHABLE_TYPES } = {}) → boolean`

- [ ] **Step 1: Write the failing test**

```js
// packages/toolkit-framework/test/publishable.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PUBLISHABLE_TYPES, OPT_IN_TYPES, ALL_TYPES, PUBLISHABLE_PUBLIC_USE, publishableTypes, isPublishable } from '../src/publishable.mjs';
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
  assert.equal(isPublishable({ type: 'resource', public_use: 'requires-community-consent' }), false);
  assert.equal(isPublishable({ type: 'resource' }), false);
  assert.equal(isPublishable(null), false);
  assert.equal(isPublishable({ type: 'resource', public_use: ok, maturity: 'raw' }), true, 'maturity is not a gate');
  // a source-system card: object.type is its KIND ('blog'); schema says what it is
  const card = { type: 'blog', public_use: ok };
  assert.equal(isPublishable(card, { schema: 'source-system' }), false, 'opt-in type off by default');
  assert.equal(isPublishable(card, { schema: 'source-system', types: publishableTypes({ publish: { types_opt_in: ['source-system'] } }) }), true);
  assert.equal(isPublishable({ tier: 'public-with-caveat', public_use: ok }, { schema: 'public-use-boundary' }), false);
  assert.equal(isPublishable({ title: 'x', public_use: ok }, { schema: 'person' }), false);
});
```

- [ ] **Step 2: Run** `cd packages/toolkit-framework && node --test test/publishable.test.mjs` → FAIL, module not found

- [ ] **Step 3: Implement**

```js
// packages/toolkit-framework/src/publishable.mjs — the publication gate (floor). Keyed on the adapter's schema, never object.type.
export const PUBLISHABLE_TYPES = Object.freeze([
  'claim-evidence', 'concept-lineage', 'encyclopedia-entry', 'implementation-record',
  'option-entry', 'organization', 'relationship-record', 'resource', 'signal', 'track',
]);
export const OPT_IN_TYPES = Object.freeze(['source-system', 'public-use-boundary']);
export const ALL_TYPES = Object.freeze([...PUBLISHABLE_TYPES, ...OPT_IN_TYPES]);
export const PUBLISHABLE_PUBLIC_USE = Object.freeze([
  'ok-with-caveat', 'source-linked-unreviewed', 'reviewed-for-explanation', 'reviewed-for-guidance',
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
```

- [ ] **Step 4: Run** → PASS (4 tests). If `loadSchema('review-maturity').axes.public_use.values` is not the real path, match `isValid()` in `src/index.mjs:37`.

- [ ] **Step 5: Commit**

```bash
git add packages/toolkit-framework/src/publishable.mjs packages/toolkit-framework/test/publishable.test.mjs
git commit -m "feat(framework): schema-keyed publication gate with opt-in types"
```

---

### Task 2: Schema fields for identity and provenance

**Files:**
- Modify: `packages/toolkit-framework/schemas/frontmatter.yaml`
- Test: `packages/toolkit-framework/test/publishable.test.mjs` (append)

**Interfaces:** every schema that `extends: frontmatter` accepts optional `id`, `grc20Id`, `sourceUri`, `viaUri`. **`public-use-boundary` does not extend frontmatter** (deliberate; `schemas.test.mjs:62`) — the test loops `PUBLISHABLE_TYPES` only; boundary records carry no identity fields and are never republished across instances.

- [ ] **Step 1: Write the failing test** (append)

```js
import { schemaFields, validateObject } from '../src/index.mjs';

test('identity + provenance fields exist on every default publishable schema', () => {
  for (const t of PUBLISHABLE_TYPES) {
    const f = schemaFields(t);
    for (const k of ['id', 'grc20Id', 'sourceUri', 'viaUri']) assert.ok(f[k], `${t} lacks ${k}`);
  }
  const r = validateObject('resource', { title: 'x', type: 'resource', id: 'a-b', grc20Id: 'c', sourceUri: 'at://d/e/f' });
  assert.equal(r.valid, true, r.errors.join('; '));
});
```

- [ ] **Step 2: Run** → FAIL — `resource lacks id`

- [ ] **Step 3:** In `schemas/frontmatter.yaml` under `fields:` after `notes: { type: string }` add:

```yaml
  id: { type: string }                   # stable object id (UUIDv4); minted by the origin at first publish — CONTEXT.md "Object ID"
  grc20Id: { type: string }              # Geo entity id shared for the same concept — never re-minted on republish
  sourceUri: { type: string }            # origin AT-URI (first publisher); immutable across republishes
  viaUri: { type: string }               # immediate peer AT-URI this copy was pulled from (optional)
```

- [ ] **Step 4:** `cd packages/toolkit-framework && npm test` → 125 + new PASS. If a test enumerates frontmatter fields as a snapshot, update it — the new fields are intended.

- [ ] **Step 5: Commit** — `feat(framework): id / grc20Id / sourceUri / viaUri on frontmatter`

---

### Task 3: Lexicon generator + record validator

**Files:**
- Create: `packages/toolkit-framework/src/lexicon.mjs`, `packages/toolkit-framework/scripts/gen-lexicons.mjs`, `packages/toolkit-framework/lexicons/` (12 files)
- Modify: `packages/toolkit-framework/package.json` (`"gen:lexicons": "node scripts/gen-lexicons.mjs"`)
- Test: `packages/toolkit-framework/test/lexicon.test.mjs`

**Interfaces:**
- `nsidFor(schema, authority)`, `typeForNsid(nsid, authority) → schema | null` (over `ALL_TYPES`)
- `flattenSchema(name) → { required, fields }` (resolves `extends`)
- `generateLexicon(schema, { authority })`, `generateAll({ authority }) → Record<nsid, doc>` over `ALL_TYPES` (12)
- `validateRecord(record, doc) → { ok, errors }`, `toRecord(object, nsid)` (adds `$type`, strips `undefined`/`null`)

- [ ] **Step 1: Write the failing tests**

```js
// packages/toolkit-framework/test/lexicon.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nsidFor, typeForNsid, flattenSchema, generateLexicon, generateAll, validateRecord, toRecord } from '../src/lexicon.mjs';
import { ALL_TYPES } from '../src/publishable.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const AUTH = 'xyz.regencoordination.kb';

test('nsidFor camel-cases the schema under the authority; typeForNsid inverts it over ALL_TYPES', () => {
  assert.equal(nsidFor('resource', AUTH), 'xyz.regencoordination.kb.resource');
  assert.equal(nsidFor('claim-evidence', AUTH), 'xyz.regencoordination.kb.claimEvidence');
  assert.equal(typeForNsid('xyz.regencoordination.kb.claimEvidence', AUTH), 'claim-evidence');
  assert.equal(typeForNsid('xyz.regencoordination.kb.sourceSystem', AUTH), 'source-system');
  assert.equal(typeForNsid('xyz.regencoordination.kb.person', AUTH), null);
  assert.equal(typeForNsid('com.example.other', AUTH), null);
});

test('flattenSchema resolves extends', () => {
  const f = flattenSchema('resource');
  assert.ok(f.fields.title && f.fields.url && f.fields.id);
  assert.deepEqual(f.required, ['title', 'type']);
  assert.ok(flattenSchema('public-use-boundary').fields.tier, 'boundary schema stands alone');
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
  assert.ok(p.link_status.knownValues.includes('active'));
  assert.ok(p.maturity.knownValues.includes('pattern-generating'));
  assert.deepEqual(main.record.required, ['title', 'type']);
});

test('generateAll yields one doc per ALL_TYPES entry (12)', () => {
  assert.equal(Object.keys(generateAll({ authority: AUTH })).length, ALL_TYPES.length);
});

test('committed lexicons/ match a fresh generation (drift test)', () => {
  const dir = join(here, '..', 'lexicons');
  const all = generateAll({ authority: AUTH });
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  assert.deepEqual(files, Object.keys(all).sort().map((n) => `${n}.json`));
  for (const [nsid, doc] of Object.entries(all)) {
    assert.deepEqual(JSON.parse(readFileSync(join(dir, `${nsid}.json`), 'utf8')), doc, `lexicons/${nsid}.json is stale — npm run gen:lexicons`);
  }
});

test('validateRecord: required, types, no floats, size, $type; unknown fields allowed', () => {
  const doc = generateLexicon('resource', { authority: AUTH });
  const good = toRecord({ title: 'A', type: 'resource', related_concepts: ['x'], extra_unknown: 2020 }, doc.id);
  assert.equal(good.$type, doc.id);
  assert.deepEqual(validateRecord(good, doc), { ok: true, errors: [] });
  assert.match(validateRecord({ $type: doc.id, type: 'resource' }, doc).errors[0], /missing required field: title/);
  assert.match(validateRecord({ $type: doc.id, title: 'A', type: 'resource', related_concepts: 'nope' }, doc).errors[0], /related_concepts must be an array/);
  assert.match(validateRecord({ $type: doc.id, title: 'A', type: 'resource', provenance: { score: 0.5 } }, doc).errors[0], /float at provenance\.score/);
  assert.match(validateRecord({ $type: 'wrong', title: 'A', type: 'resource' }, doc).errors[0], /\$type/);
  assert.match(validateRecord({ $type: doc.id, title: 'A', type: 'resource', notes: 'x'.repeat(1_000_001) }, doc).errors[0], /exceeds 1 MB/);
});

test('toRecord strips undefined and null, keeps nested objects', () => {
  assert.deepEqual(toRecord({ title: 'A', type: 'resource', notes: undefined, url: null, provenance: { origin: 'o' } }, 'x.y.z'),
    { $type: 'x.y.z', title: 'A', type: 'resource', provenance: { origin: 'o' } });
});
```

- [ ] **Step 2: Run** → FAIL, module not found

- [ ] **Step 3: Implement `src/lexicon.mjs`**

```js
// packages/toolkit-framework/src/lexicon.mjs — yaml schema → AT Proto Lexicon. Generated, never hand-edited. Lexicon objects are open (unknown fields allowed).
import { loadSchema } from './index.mjs';
import { ALL_TYPES } from './publishable.mjs';

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

const axisValues = (axis) => loadSchema('review-maturity').axes[axis].values;

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
```

- [ ] **Step 4: Generator + run it**

```js
// packages/toolkit-framework/scripts/gen-lexicons.mjs — regenerates lexicons/. Usage: node scripts/gen-lexicons.mjs [authority]
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

Run: `cd packages/toolkit-framework && npm run gen:lexicons` → `wrote 12 lexicons`

- [ ] **Step 5: Run** `npm test` → PASS. **Commit:** `feat(framework): generate AT Proto Lexicons from yaml schemas + record validator`

---

### Task 4: Async lifecycle + boolean flags

**Why:** `executor.runLifecycle` is synchronous (`const res = op.run(ctx) || {}` at `executor.mjs:20`) and `cli.parseFlags` consumes the next token as a flag value (`cli.mjs:19-22`), so `--dry` at the end of argv is `undefined`. `publish` and `ingest.pull` are async and `--dry` must work.

**Files:**
- Modify: `packages/org-os-kms/src/executor.mjs`, `packages/org-os-kms/src/cli.mjs`
- Modify: `packages/org-os-kms/test/executor.test.mjs`, `test/cli.test.mjs`, `test/e2e.test.mjs` (await)

**Interfaces:**
- `runLifecycle(event, ctx, deps) → Promise<report>` — the unknown-event check stays synchronous (throws before returning the promise, so `assert.throws` in existing tests keeps working); each `op.run(ctx)` is awaited.
- `parseFlags`: `--k` followed by nothing or another `--x` → `flags.k = true`; otherwise `flags.k = next`.
- `dispatch` passes `{ dir, flags }` as `ctx` to `runLifecycle`.

- [ ] **Step 1: Write the failing tests** (append to `test/cli.test.mjs` and `test/executor.test.mjs`)

```js
// cli.test.mjs
test('trailing --dry is a boolean flag; --dir takes a value', () => {
  const r = dispatch(['lifecycle', 'close', '--dir', '/tmp/x', '--dry'], { dry: true });
  assert.equal(r.flags.dir, '/tmp/x');
  assert.equal(r.flags.dry, true);
});

// executor.test.mjs
test('runLifecycle awaits async ops in order', async () => {
  const order = [];
  const ops = { a: { kind: 'exec', write: false, run: async () => { await new Promise((r) => setTimeout(r, 5)); order.push('a'); return { ok: true }; } },
                b: { kind: 'exec', write: false, run: () => { order.push('b'); return { ok: true }; } } };
  const r = await runLifecycle('initialize', {}, { ops, bindings: { initialize: ['a', 'b'] } });
  assert.deepEqual(order, ['a', 'b']);
  assert.equal(r.ran.length, 2);
});
```

Read `test/executor.test.mjs` first: match its actual `deps` injection shape (`ops`/`bindings` names may differ — use what the existing tests pass).

- [ ] **Step 2: Run** → the new tests FAIL; note which existing tests fail after the change (they will need `await`).

- [ ] **Step 3: Implement** — in `executor.mjs`, keep the synchronous validation, then:

```js
export function runLifecycle(event, ctx = {}, deps = {}) {
  // …existing synchronous checks (unknown event → throw; resolve ops/bindings) unchanged…
  return (async () => {
    // …existing loop body, with:  const res = (await op.run(ctx)) || {};
    // everything else (fail-hard on write, report shape) unchanged
  })();
}
```

In `cli.mjs`:

```js
function parseFlags(argv) {
  const args = [], flags = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) { args.push(t); continue; }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) flags[t.slice(2)] = true;
    else { flags[t.slice(2)] = next; i++; }
  }
  return { args, flags };
}
```

and where `dispatch` calls `runLifecycle(args[0], { dir })` → `runLifecycle(args[0], { dir, flags })`; the CLI `main` must `await` the result before `JSON.stringify`. Update every existing test that reads `runLifecycle(...)`'s report to `await` it (`executor.test.mjs`, `e2e.test.mjs:48`, `cli.test.mjs`).

- [ ] **Step 4: Run** `cd packages/org-os-kms && npm test` → 44 + 2 PASS. **Commit:** `refactor(kms): async lifecycle; boolean CLI flags`

---

### Task 5: Framework seam re-exports + manifest module

**Files:**
- Modify: `packages/org-os-kms/src/framework.mjs`
- Create: `packages/org-os-kms/src/manifest.mjs`
- Test: `packages/org-os-kms/test/manifest.test.mjs`

**Note on installs:** `framework.mjs` imports the framework by **relative sibling path** (`../../toolkit-framework/src/…`). An adopter therefore installs org-os-kms by vendoring **both** `packages/toolkit-framework` and `packages/org-os-kms` unedited, pinned to a tag (Mode 1 of the adoption runbook). `node node_modules/@org-os/kms/...` does not work. The pilot plan says so.

**Interfaces:**
- framework.mjs re-exports: `isPublishable, publishableTypes, PUBLISHABLE_TYPES, OPT_IN_TYPES, ALL_TYPES, PUBLISHABLE_PUBLIC_USE, nsidFor, typeForNsid, generateAll, validateRecord, toRecord, toJsonLdContext` (last one already exported from `index.mjs` — confirm it's in the list; add if missing).
- manifest.mjs: `MANIFEST_PATH = 'data/kms-published.json'`; `readManifest(dir)`; `writeManifest(dir, m) → path`; `slugIndex(m) → Map<slug, entry[]>`; `slugFromRef(ref) → string` (`ref.slice(ref.lastIndexOf('#') + 1)`; a ref without `#` returns the ref's basename without extension). Entry shape `{ slug, type, rkey, atUri, cid, hash, publishedAt }` where `type` is the **schema**.

- [ ] **Step 1: Write the failing test**

```js
// packages/org-os-kms/test/manifest.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readManifest, writeManifest, slugIndex, slugFromRef, MANIFEST_PATH } from '../src/manifest.mjs';

test('readManifest empty when absent; write/read round-trips', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kms-manifest-'));
  assert.deepEqual(readManifest(dir), { version: 1, objects: {} });
  const m = { version: 1, objects: { 'id-1': { slug: 'a', type: 'resource', rkey: 'id-1', atUri: 'at://did/x/id-1', cid: 'c', hash: 'h', publishedAt: 't' } } };
  const p = writeManifest(dir, m);
  assert.equal(p, join(dir, MANIFEST_PATH));
  assert.ok(existsSync(p));
  assert.deepEqual(readManifest(dir), m);
});

test('slugIndex groups by slug; slugFromRef reads the adapter key', () => {
  const ix = slugIndex({ version: 1, objects: { a: { slug: 's' }, b: { slug: 's' }, c: { slug: 't' } } });
  assert.equal(ix.get('s').length, 2);
  assert.equal(slugFromRef('data/kb/resource.yaml#1hive'), '1hive');
  assert.equal(slugFromRef('/x/kb/resource/some-slug.yaml'), 'some-slug');
});
```

- [ ] **Step 2: Run** → FAIL

- [ ] **Step 3: Implement**

```js
// packages/org-os-kms/src/manifest.mjs — the publish manifest: what this instance has on its publication plane.
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
```

Append to `framework.mjs`:

```js
export { isPublishable, publishableTypes, PUBLISHABLE_TYPES, OPT_IN_TYPES, ALL_TYPES, PUBLISHABLE_PUBLIC_USE } from '../../toolkit-framework/src/publishable.mjs';
export { nsidFor, typeForNsid, generateAll, validateRecord, toRecord } from '../../toolkit-framework/src/lexicon.mjs';
```

- [ ] **Step 4: Run** → PASS. **Commit:** `feat(kms): publish manifest + framework seam re-exports`

---

### Task 6: Identity minting over pre-selected items

**Files:**
- Create: `packages/org-os-kms/src/identity.mjs`
- Test: `packages/org-os-kms/test/identity.test.mjs`

**Interfaces:**
- `ensureIds({ adapter, target, items, uuid = randomUUID, write = true }) → { minted: [{ ref, id, grc20Id }], items }` — `items` is the caller's already-gated list `[{schema, object, ref}]`; only those are minted. With `write: true` the patch goes through `adapter.update(target, ref, patch)` and `items` is re-read from `adapter.list(target)` filtered to the same refs; with `write: false` the patch is applied in memory only (dry run). Every returned item has `id` and `grc20Id`; `assertRkey(id)` runs on each.

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
import { getAdapter } from '../src/framework.mjs';

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
const selected = (dir) => getAdapter('repo-data').list(dir).filter(({ object }) => object.public_use === 'ok-with-caveat');

test('mints id + grc20Id only for the given items lacking them; writes back', () => {
  const dir = instance();
  let n = 0; const uuid = () => `uuid-${++n}`;
  const { minted, items } = ensureIds({ adapter: 'repo-data', target: dir, items: selected(dir), uuid });
  assert.equal(minted.length, 1);
  assert.equal(minted[0].id, 'uuid-1'); assert.equal(minted[0].grc20Id, 'uuid-2');
  const disk = yaml.load(readFileSync(join(dir, 'data', 'kb', 'resource.yaml'), 'utf8')).entries;
  assert.equal(disk.pub.id, 'uuid-1'); assert.equal(disk.pub.grc20Id, 'uuid-2');
  assert.equal(disk.internal.id, undefined, 'not selected → untouched');
  assert.equal(disk.haveid.id, 'existing-id');
  assert.equal(items.length, 2);
  for (const it of items) assert.ok(it.object.id && it.object.grc20Id);
});

test('write:false mints in memory only', () => {
  const dir = instance();
  const { minted, items } = ensureIds({ adapter: 'repo-data', target: dir, items: selected(dir), write: false });
  assert.equal(minted.length, 1);
  assert.ok(items.find((i) => i.object.title === 'Pub').object.id);
  const disk = yaml.load(readFileSync(join(dir, 'data', 'kb', 'resource.yaml'), 'utf8')).entries;
  assert.equal(disk.pub.id, undefined);
});

test('idempotent', () => {
  const dir = instance();
  ensureIds({ adapter: 'repo-data', target: dir, items: selected(dir) });
  assert.equal(ensureIds({ adapter: 'repo-data', target: dir, items: selected(dir) }).minted.length, 0);
});

test('assertRkey enforces the AT Proto rkey charset', () => {
  assertRkey('550e8400-e29b-41d4-a716-446655440000');
  assert.throws(() => assertRkey('has space'), /rkey/);
  assert.throws(() => assertRkey(''), /rkey/);
});
```

- [ ] **Step 2: Run** → FAIL

- [ ] **Step 3: Implement**

```js
// packages/org-os-kms/src/identity.mjs — mint object ids at first publish, only for objects that passed every gate. git holds the ids.
import { randomUUID } from 'node:crypto';
import * as fw from './framework.mjs';

const RKEY = /^[a-zA-Z0-9.\-_:~]{1,512}$/;
export function assertRkey(id) {
  if (typeof id !== 'string' || !RKEY.test(id)) throw new Error(`invalid rkey: ${JSON.stringify(id)}`);
  return id;
}

export function ensureIds({ adapter, target, items, uuid = randomUUID, write = true }) {
  const a = fw.getAdapter(adapter);
  const minted = [];
  const out = [];
  for (const it of items) {
    const patch = {};
    if (!it.object.id) patch.id = uuid();
    if (!it.object.grc20Id) patch.grc20Id = uuid();
    if (Object.keys(patch).length) {
      minted.push({ ref: it.ref, id: patch.id ?? it.object.id, grc20Id: patch.grc20Id ?? it.object.grc20Id });
      if (write) a.update(target, it.ref, patch);
    }
    out.push({ ...it, object: { ...it.object, ...patch } });
  }
  const items2 = write ? (() => { const refs = new Set(items.map((i) => i.ref)); return a.list(target).filter((i) => refs.has(i.ref)); })() : out;
  for (const { object } of items2) assertRkey(object.id);
  return { minted, items: items2 };
}
```

- [ ] **Step 4: Run** → PASS. **Commit:** `feat(kms): mint id + grc20Id for gated objects, write back to yaml`

---

### Task 7: Cross-reference rewriting

**Files:**
- Create: `packages/org-os-kms/src/refs.mjs`
- Test: `packages/org-os-kms/test/refs.test.mjs`

**Interfaces:** `REF_ARRAY_FIELDS`, `REF_STRING_FIELDS`, `resolverFrom(manifest) → (slug) => atUri | null` (null on 0 or >1), `rewriteRefs(object, resolve, schema) → object` (new object; string fields only when `schema === 'relationship-record'`).

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

test('resolverFrom: unique → uri; ambiguous or unknown → null', () => {
  const r = resolverFrom(manifest);
  assert.equal(r('decentralization'), 'at://did:plc:me/x.kb.conceptLineage/i1');
  assert.equal(r('dup'), null); assert.equal(r('nope'), null);
});

test('array fields rewritten where resolvable; non-mutating', () => {
  const src = { title: 'A', related_concepts: ['decentralization', 'nope', 'dup'] };
  const out = rewriteRefs(src, resolverFrom(manifest), 'resource');
  assert.deepEqual(out.related_concepts, ['at://did:plc:me/x.kb.conceptLineage/i1', 'nope', 'dup']);
  assert.equal(src.related_concepts[0], 'decentralization');
});

test('relationship-record subject/object strings; already-at:// untouched', () => {
  const out = rewriteRefs({ subject: 'decentralization', predicate: 'related_to', object: 'nope' }, resolverFrom(manifest), 'relationship-record');
  assert.equal(out.subject, 'at://did:plc:me/x.kb.conceptLineage/i1'); assert.equal(out.object, 'nope');
  const keep = rewriteRefs({ related_concepts: ['at://did:plc:x/c/1'] }, () => 'at://never', 'resource');
  assert.deepEqual(keep.related_concepts, ['at://did:plc:x/c/1']);
});
```

- [ ] **Step 2: Run** → FAIL

- [ ] **Step 3: Implement**

```js
// packages/org-os-kms/src/refs.mjs — slug → origin AT-URI at publish time (spec Q19). Pure.
import { slugIndex } from './manifest.mjs';

export const REF_ARRAY_FIELDS = ['related_concepts', 'related_options', 'related_resources', 'source_traditions'];
export const REF_STRING_FIELDS = ['subject', 'object'];
const isAtUri = (v) => typeof v === 'string' && v.startsWith('at://');

export function resolverFrom(manifest) {
  const ix = slugIndex(manifest);
  return (slug) => { const h = ix.get(slug); return h && h.length === 1 && h[0].atUri ? h[0].atUri : null; };
}

export function rewriteRefs(object, resolve, schema) {
  const out = { ...object };
  const one = (v) => (isAtUri(v) ? v : (resolve(v) ?? v));
  for (const f of REF_ARRAY_FIELDS) if (Array.isArray(out[f])) out[f] = out[f].map(one);
  if (schema === 'relationship-record') for (const f of REF_STRING_FIELDS) if (typeof out[f] === 'string') out[f] = one(out[f]);
  return out;
}
```

- [ ] **Step 4: Run** → PASS. **Commit:** `feat(kms): rewrite cross-references to origin AT-URIs at publish`

---

### Task 8: XRPC client

**Files:**
- Create: `packages/org-os-kms/src/atproto/client.mjs`
- Test: `packages/org-os-kms/test/atproto-client.test.mjs`

**Interfaces:** `createClient({ pds, fetchImpl = globalThis.fetch })` — **throws `atproto: pds not configured` when `pds` is falsy**; `login`, `putRecord` (adds `validate: false` — the PDS does not know our Lexicons; we validated already), `deleteRecord`, `listRecords`, `listAllRecords`, `getLatestCommit`; `XrpcError { status, error }`.

- [ ] **Step 1: Write the failing test**

```js
// packages/org-os-kms/test/atproto-client.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, XrpcError } from '../src/atproto/client.mjs';

function fakeFetch(routes) {
  const calls = [];
  const f = async (url, init = {}) => {
    const u = new URL(url); const nsid = u.pathname.split('/xrpc/')[1];
    calls.push({ nsid, method: init.method || 'GET', headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : undefined, query: Object.fromEntries(u.searchParams) });
    const r = routes[nsid];
    if (!r) return new Response(JSON.stringify({ error: 'NotFound', message: 'no route' }), { status: 404 });
    const out = typeof r === 'function' ? r(calls.at(-1)) : r;
    return new Response(JSON.stringify(out.body ?? out), { status: out.status ?? 200, headers: { 'content-type': 'application/json' } });
  };
  f.calls = calls; return f;
}

test('pds is required', () => { assert.throws(() => createClient({ pds: null }), /pds not configured/); });

test('login stores the token; putRecord sends Bearer, swapRecord and validate:false', async () => {
  const fetchImpl = fakeFetch({ 'com.atproto.server.createSession': { accessJwt: 'JWT', did: 'did:plc:abc' }, 'com.atproto.repo.putRecord': { uri: 'at://did:plc:abc/x.y/k', cid: 'bafy1' } });
  const c = createClient({ pds: 'https://pds.test', fetchImpl });
  const { did } = await c.login({ identifier: 'kc.test', password: 'pw' });
  assert.equal(did, 'did:plc:abc');
  const res = await c.putRecord({ repo: did, collection: 'x.y', rkey: 'k', record: { $type: 'x.y', title: 'T' }, swapRecord: 'bafy0' });
  assert.deepEqual(res, { uri: 'at://did:plc:abc/x.y/k', cid: 'bafy1' });
  const put = fetchImpl.calls[1];
  assert.equal(put.headers.Authorization, 'Bearer JWT');
  assert.deepEqual(put.body, { repo: 'did:plc:abc', collection: 'x.y', rkey: 'k', record: { $type: 'x.y', title: 'T' }, validate: false, swapRecord: 'bafy0' });
});

test('listAllRecords follows cursor; getLatestCommit GETs did', async () => {
  let page = 0;
  const fetchImpl = fakeFetch({
    'com.atproto.repo.listRecords': () => (page++ === 0 ? { records: [{ uri: 'at://d/c/1', cid: 'c1', value: { a: 1 } }], cursor: 'next' } : { records: [{ uri: 'at://d/c/2', cid: 'c2', value: { a: 2 } }] }),
    'com.atproto.sync.getLatestCommit': { cid: 'ccid', rev: '3abc' },
  });
  const c = createClient({ pds: 'https://pds.test', fetchImpl });
  assert.equal((await c.listAllRecords({ repo: 'd', collection: 'c' })).length, 2);
  assert.equal(fetchImpl.calls[1].query.cursor, 'next');
  assert.deepEqual(await c.getLatestCommit({ did: 'd' }), { cid: 'ccid', rev: '3abc' });
});

test('non-2xx → XrpcError', async () => {
  const c = createClient({ pds: 'https://pds.test', fetchImpl: fakeFetch({ 'com.atproto.repo.deleteRecord': { status: 400, body: { error: 'InvalidSwap', message: 'modified' } } }) });
  await assert.rejects(c.deleteRecord({ repo: 'd', collection: 'c', rkey: 'k' }), (e) => e instanceof XrpcError && e.status === 400 && e.error === 'InvalidSwap');
});
```

- [ ] **Step 2: Run** → FAIL

- [ ] **Step 3: Implement**

```js
// packages/org-os-kms/src/atproto/client.mjs — the XRPC calls the publication plane needs. No SDK.
export class XrpcError extends Error {
  constructor(status, error, message) { super(`${error}: ${message}`); this.status = status; this.error = error; }
}

export function createClient({ pds, fetchImpl = globalThis.fetch }) {
  if (!pds) throw new Error('atproto: pds not configured');
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
    async login({ identifier, password }) { const s = await call('com.atproto.server.createSession', { method: 'POST', body: { identifier, password } }); accessJwt = s.accessJwt; return { did: s.did }; },
    putRecord({ repo, collection, rkey, record, swapRecord }) {
      return call('com.atproto.repo.putRecord', { method: 'POST', body: { repo, collection, rkey, record, validate: false, ...(swapRecord ? { swapRecord } : {}) } });
    },
    async deleteRecord({ repo, collection, rkey }) { await call('com.atproto.repo.deleteRecord', { method: 'POST', body: { repo, collection, rkey } }); },
    listRecords({ repo, collection, cursor, limit = 100 }) { return call('com.atproto.repo.listRecords', { query: { repo, collection, cursor, limit } }); },
    async listAllRecords({ repo, collection }) {
      const out = []; let cursor;
      do { const page = await this.listRecords({ repo, collection, cursor }); out.push(...page.records); cursor = page.cursor; } while (cursor);
      return out;
    },
    getLatestCommit({ did }) { return call('com.atproto.sync.getLatestCommit', { query: { did } }); },
  };
}
```

- [ ] **Step 4: Run** → PASS. **Commit:** `feat(kms): fetch-based XRPC client`

---

### Task 9: Publish planner (pure) + applier

**Files:**
- Create: `packages/org-os-kms/src/atproto/publish.mjs`
- Test: `packages/org-os-kms/test/atproto-publish.test.mjs`

**Interfaces:**
- `contentHash(record)`
- `planPublish({ items, manifest, did, authority }) → { ok, errors, create, update, delete, skip, previous }` — `items` are `[{schema, object, ref}]`; NSID from `item.schema`; slug from `slugFromRef(item.ref)`; `previous = manifest.objects` (attached for the applier). Validates all before returning ops; `ok:false` ⇒ no ops.
- `applyPublish(plan, { client, did, now }) → { manifest, applied: {created, updated, deleted}, failures }` — new manifest; skipped entries carried from `plan.previous`; a failed update/delete keeps its previous entry.

- [ ] **Step 1: Write the failing test**

```js
// packages/org-os-kms/test/atproto-publish.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planPublish, applyPublish, contentHash } from '../src/atproto/publish.mjs';
import { XrpcError } from '../src/atproto/client.mjs';

const AUTH = 'xyz.regencoordination.kb'; const DID = 'did:plc:me';
const item = (slug, extra = {}, schema = 'resource') => ({ schema, ref: `data/kb/${schema}.yaml#${slug}`, object: { title: slug, type: 'resource', public_use: 'ok-with-caveat', id: `id-${slug}`, grc20Id: `g-${slug}`, ...extra } });
const empty = { version: 1, objects: {} };
const RES = `${AUTH}.resource`;

test('create / skip / update(swapRecord) / delete', () => {
  const a = item('a'); const b = item('b');
  const first = planPublish({ items: [a, b], manifest: empty, did: DID, authority: AUTH });
  assert.equal(first.ok, true); assert.equal(first.create.length, 2);
  assert.equal(first.create[0].collection, RES); assert.equal(first.create[0].rkey, 'id-a'); assert.equal(first.create[0].slug, 'a');
  assert.equal(first.create[0].record.$type, RES);
  const manifest = { version: 1, objects: {
    'id-a': { slug: 'a', type: 'resource', rkey: 'id-a', atUri: `at://${DID}/${RES}/id-a`, cid: 'cid-a', hash: first.create[0].hash, publishedAt: 't' },
    'id-b': { slug: 'b', type: 'resource', rkey: 'id-b', atUri: `at://${DID}/${RES}/id-b`, cid: 'cid-b', hash: first.create[1].hash, publishedAt: 't' } } };
  const second = planPublish({ items: [a, item('b', { notes: 'changed' })], manifest, did: DID, authority: AUTH });
  assert.deepEqual(second.skip, ['id-a']); assert.equal(second.update.length, 1); assert.equal(second.update[0].swapRecord, 'cid-b');
  const third = planPublish({ items: [a], manifest, did: DID, authority: AUTH });
  assert.equal(third.delete.length, 1); assert.equal(third.delete[0].rkey, 'id-b');
});

test('source-system card: NSID from schema, not from object.type', () => {
  const card = item('blog', { type: 'blog', steward: 's', return_path: 'r' }, 'source-system');
  const p = planPublish({ items: [card], manifest: empty, did: DID, authority: AUTH });
  assert.equal(p.ok, true, JSON.stringify(p.errors));
  assert.equal(p.create[0].collection, `${AUTH}.sourceSystem`);
  assert.equal(p.create[0].record.type, 'blog');
});

test('refs rewritten against the manifest; validation is all-or-nothing', () => {
  const manifest = { version: 1, objects: { 'id-c': { slug: 'c', type: 'concept-lineage', atUri: `at://${DID}/x/id-c`, rkey: 'id-c', cid: 'x', hash: 'h', publishedAt: 't' } } };
  const p = planPublish({ items: [item('a', { related_concepts: ['c', 'zzz'] })], manifest, did: DID, authority: AUTH });
  assert.deepEqual(p.create[0].record.related_concepts, [`at://${DID}/x/id-c`, 'zzz']);
  const bad = planPublish({ items: [item('a', { provenance: { score: 0.1 } }), item('b')], manifest: empty, did: DID, authority: AUTH });
  assert.equal(bad.ok, false); assert.equal(bad.create.length, 0); assert.match(bad.errors[0].errors[0], /float/);
});

test('applyPublish: per-op calls, per-record failures, new manifest', async () => {
  const calls = [];
  const client = {
    async putRecord(op) { calls.push(['put', op.rkey]); if (op.rkey === 'id-b') throw new XrpcError(400, 'InvalidSwap', 'modified'); return { uri: `at://${DID}/${op.collection}/${op.rkey}`, cid: `cid-${op.rkey}` }; },
    async deleteRecord(op) { calls.push(['del', op.rkey]); },
  };
  const prev = { version: 1, objects: { 'id-z': { slug: 'z', type: 'resource', rkey: 'id-z', atUri: 'u', cid: 'c', hash: 'h', publishedAt: 't' } } };
  const plan = planPublish({ items: [item('a'), item('b')], manifest: prev, did: DID, authority: AUTH });
  const out = await applyPublish(plan, { client, did: DID, now: () => 'NOW' });
  assert.deepEqual(calls, [['put', 'id-a'], ['put', 'id-b'], ['del', 'id-z']]);
  assert.equal(out.applied.created, 1); assert.equal(out.applied.deleted, 1);
  assert.equal(out.failures[0].id, 'id-b');
  assert.equal(out.manifest.objects['id-a'].cid, 'cid-id-a'); assert.equal(out.manifest.objects['id-a'].publishedAt, 'NOW');
  assert.equal(out.manifest.objects['id-b'], undefined); assert.equal(out.manifest.objects['id-z'], undefined);
  assert.equal(prev.objects['id-z'].slug, 'z', 'input not mutated');
});

test('contentHash stable across key order', () => {
  assert.equal(contentHash({ a: 1, b: [1, { c: 2, d: 3 }] }), contentHash({ b: [1, { d: 3, c: 2 }], a: 1 }));
});
```

- [ ] **Step 2: Run** → FAIL

- [ ] **Step 3: Implement**

```js
// packages/org-os-kms/src/atproto/publish.mjs — plan (pure) then apply. Validation all-or-nothing; application per-record.
import { createHash } from 'node:crypto';
import * as fw from '../framework.mjs';
import { rewriteRefs, resolverFrom } from '../refs.mjs';
import { slugFromRef } from '../manifest.mjs';

function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
export function contentHash(record) { return createHash('sha256').update(stable(record)).digest('hex'); }

export function planPublish({ items, manifest, did, authority }) {
  const lexicons = fw.generateAll({ authority });
  const resolve = resolverFrom(manifest);
  const plan = { ok: true, errors: [], create: [], update: [], delete: [], skip: [], previous: manifest.objects };
  const seen = new Set();
  for (const { schema, object, ref } of items) {
    const collection = fw.nsidFor(schema, authority);
    const slug = slugFromRef(ref);
    const record = fw.toRecord(rewriteRefs(object, resolve, schema), collection);
    const v = fw.validateRecord(record, lexicons[collection]);
    if (!v.ok) { plan.errors.push({ slug, errors: v.errors }); continue; }
    const id = object.id; seen.add(id);
    const hash = contentHash(record);
    const prev = manifest.objects[id];
    const op = { id, slug, type: schema, collection, rkey: id, record, hash };
    if (!prev) plan.create.push(op); else if (prev.hash === hash) plan.skip.push(id); else plan.update.push({ ...op, swapRecord: prev.cid });
  }
  for (const [id, prev] of Object.entries(manifest.objects)) if (!seen.has(id)) plan.delete.push({ id, slug: prev.slug, type: prev.type, collection: fw.nsidFor(prev.type, authority), rkey: prev.rkey });
  return plan.errors.length ? { ...plan, ok: false, create: [], update: [], delete: [], skip: [] } : plan;
}

export async function applyPublish(plan, { client, did, now = () => new Date().toISOString() }) {
  if (!plan.ok) throw new Error('applyPublish called with a failed plan');
  const manifest = { version: 1, objects: {} };
  for (const id of plan.skip) manifest.objects[id] = plan.previous[id];
  const out = { applied: { created: 0, updated: 0, deleted: 0 }, failures: [], manifest };
  for (const [kind, ops] of [['created', plan.create], ['updated', plan.update]]) {
    for (const op of ops) {
      try {
        const { uri, cid } = await client.putRecord({ repo: did, collection: op.collection, rkey: op.rkey, record: op.record, swapRecord: op.swapRecord });
        manifest.objects[op.id] = { slug: op.slug, type: op.type, rkey: op.rkey, atUri: uri, cid, hash: op.hash, publishedAt: now() };
        out.applied[kind]++;
      } catch (e) { out.failures.push({ id: op.id, error: e.message }); if (kind === 'updated') manifest.objects[op.id] = plan.previous[op.id]; }
    }
  }
  for (const op of plan.delete) {
    try { await client.deleteRecord({ repo: did, collection: op.collection, rkey: op.rkey }); out.applied.deleted++; }
    catch (e) { out.failures.push({ id: op.id, error: e.message }); manifest.objects[op.id] = plan.previous[op.id]; }
  }
  return out;
}
```

- [ ] **Step 4: Run** → PASS. **Commit:** `feat(kms): publish planner + per-record applier`

---

### Task 10: Static surface

**Files:**
- Create: `packages/org-os-kms/src/static/surface.mjs`
- Test: `packages/org-os-kms/test/static-surface.test.mjs`

**Interfaces:** `writeStaticSurface({ dir, outDir = 'public', items, allItems, manifest, config }) → { files }`. Grouped by `item.schema`. Writes `api/context.jsonld` (from `fw.toJsonLdContext()`), `api/<schema>.json`, `api/<schema>/<id>.json`, `api/index.json`, `.well-known/knowledge.json`; copies root `.well-known/*.json` except `knowledge.json` (**this includes members/finances/meetings — they are already the instance's DAOstar public manifests; if an instance does not want them served, it must not keep them in root `.well-known/`**). `@context` is `/api/context.jsonld`. `sources` = source-system objects from `allItems` (the full listing) whose `public_use` is publishable — cards are metadata about the instance, not records, so opt-in doesn't apply.

- [ ] **Step 1: Write the failing test**

```js
// packages/org-os-kms/test/static-surface.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeStaticSurface } from '../src/static/surface.mjs';

test('api/, context.jsonld, index.json, knowledge.json, .well-known copy', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kms-static-'));
  mkdirSync(join(dir, '.well-known'));
  writeFileSync(join(dir, '.well-known', 'dao.json'), '{"type":"DAO"}');
  const self = { schema: 'source-system', ref: 's#self', object: { title: 'S', type: 'knowledge-garden', public_use: 'ok-with-caveat', url: 'https://kc', steward: 'x', return_path: 'y' } };
  const items = [{ schema: 'resource', ref: 'r#a', object: { title: 'A', type: 'resource', public_use: 'ok-with-caveat', id: 'id-a' } }];
  const allItems = [...items, self, { schema: 'source-system', ref: 's#priv', object: { title: 'P', type: 'database', public_use: 'internal-only' } }];
  const manifest = { version: 1, objects: { 'id-a': { slug: 'a', type: 'resource', rkey: 'id-a', atUri: 'at://d/c/id-a', cid: 'cid-a', hash: 'h', publishedAt: 't' } } };
  const config = { instance: 't', atproto: { did: 'did:plc:me', nsid_authority: 'xyz.regencoordination.kb' }, geo: { parent_space: 'p', space: null },
    connectors: [{ name: 'atproto', config: { peers: ['did:plc:peer'] } }, { name: 'static-json', config: { base_url: 'https://www.openhaven.net' } }] };
  const { files } = writeStaticSurface({ dir, items, allItems, manifest, config });
  const pub = (p) => JSON.parse(readFileSync(join(dir, 'public', p), 'utf8'));
  assert.ok(pub('api/context.jsonld')['@vocab']);
  const all = pub('api/resource.json');
  assert.equal(all['@context'], '/api/context.jsonld'); assert.equal(all.count, 1); assert.equal(all.items[0].atUri, 'at://d/c/id-a');
  assert.equal(pub('api/resource/id-a.json').cid, 'cid-a');
  assert.ok(pub('api/index.json').endpoints.some((e) => e.path === '/api/resource.json'));
  const km = pub('.well-known/knowledge.json');
  assert.equal(km.type, 'KnowledgeManifest');
  assert.deepEqual(km.exchange.published_domains, ['xyz.regencoordination.kb.resource']);
  assert.deepEqual(km.exchange.subscribed_domains, ['did:plc:peer', 'https://www.openhaven.net']);
  assert.deepEqual(km.sources.map((s) => s.title), ['S'], 'only publishable-public_use cards, from the full listing');
  assert.equal(km.did, 'did:plc:me'); assert.deepEqual(km.geo, { parent_space: 'p', space: null });
  assert.ok(existsSync(join(dir, 'public', '.well-known', 'dao.json')));
  assert.ok(files.includes('api/context.jsonld') && files.includes('.well-known/knowledge.json'));
});
```

- [ ] **Step 2: Run** → FAIL

- [ ] **Step 3: Implement**

```js
// packages/org-os-kms/src/static/surface.mjs — the non-AT-Proto publication target. Pure over (items, allItems, manifest, config).
import { mkdirSync, writeFileSync, readdirSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as fw from '../framework.mjs';

const CONTEXT = '/api/context.jsonld';

export function writeStaticSurface({ dir, outDir = 'public', items, allItems = items, manifest, config }) {
  const out = join(dir, outDir); const files = [];
  const write = (rel, data) => { const p = join(out, rel); mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, JSON.stringify(data, null, 2) + '\n'); files.push(rel); };

  write('api/context.jsonld', fw.toJsonLdContext());
  const bySchema = new Map();
  for (const { schema, object } of items) {
    const m = manifest.objects[object.id];
    const entry = { '@context': CONTEXT, ...object, ...(m ? { atUri: m.atUri, cid: m.cid } : {}) };
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
    endpoints: schemas.flatMap((s) => [{ path: `/api/${s}.json`, description: `All ${s} entries.` }, { path: `/api/${s}/{id}.json`, description: `One ${s} by id.` }]),
    access: { readOnly: true, authentication: 'none' },
  });
  const authority = config.atproto?.nsid_authority;
  const subscribed = (config.connectors || []).flatMap((c) => c.name === 'atproto' ? (c.config?.peers || []) : c.config?.base_url ? [c.config.base_url] : []);
  const cards = allItems.filter((i) => i.schema === 'source-system' && fw.PUBLISHABLE_PUBLIC_USE.includes(i.object.public_use)).map(({ object }) => ({ title: object.title, url: object.url, steward: object.steward }));
  write('.well-known/knowledge.json', {
    '@context': 'https://www.daostar.org/schemas', type: 'KnowledgeManifest', did: config.atproto?.did, geo: config.geo, domains: schemas,
    exchange: { published_domains: authority ? schemas.map((s) => fw.nsidFor(s, authority)) : [], subscribed_domains: subscribed }, sources: cards,
  });
  const wk = join(dir, '.well-known');
  if (existsSync(wk)) for (const f of readdirSync(wk)) if (f.endsWith('.json') && f !== 'knowledge.json') { mkdirSync(join(out, '.well-known'), { recursive: true }); copyFileSync(join(wk, f), join(out, '.well-known', f)); files.push(`.well-known/${f}`); }
  return { files };
}
```

If `toJsonLdContext` is not in `framework.mjs`'s re-export list, add it (it is exported by `toolkit-framework/src/index.mjs:119`).

- [ ] **Step 4: Run** → PASS. **Commit:** `feat(kms): static JSON-LD surface + .well-known/knowledge.json`

---

### Task 11: Instance gate hook + `publish` op + lifecycle binding

**Files:**
- Create: `packages/org-os-kms/src/gate.mjs`
- Modify: `src/ops.mjs`, `src/bind.mjs`, **`profile/profile.yaml`** (lifecycle twin — `test/bind.test.mjs:44` enforces sync), `src/config.mjs`
- Modify: `test/bind.test.mjs:35` (close list assertion)
- Modify: root `kms.yaml`, `.env.example`
- Test: `test/gate.test.mjs`, `test/publish-op.test.mjs`

**Interfaces:**
- `loadInstanceGate(dir, config) → Promise<fn | null>`; `buildGateContext(allItems) → { sourceSystems: Record<slug, object>, boundaries: object[] }` keyed by `slugFromRef(ref)` and `schema`; `applyGate(gate, items, ctx) → { passed, rejected: [{slug, reason}] }`.
- `OPS.publish` (`write: true`, async). Sequence: `all = adapter.list` → `types = publishableTypes(config)` → `candidates = all.filter(isPublishable(object, {schema, types}))` → instance gate → `ensureIds({ items: candidates, write: !dry })` → `planPublish` → (unless dry / not configured) `login` + `applyPublish` → static surface (unless `publish.static === false`) → manifest (unless dry). Report `{ minted, dry, gate?, atproto: {status, …}, static, errors? }`. `ctx.deps` = `{ createClient, env }` injectable; `ctx.flags.dry`.

- [ ] **Step 1: Write the failing tests**

```js
// packages/org-os-kms/test/gate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadInstanceGate, buildGateContext, applyGate } from '../src/gate.mjs';

test('buildGateContext: source-systems by ref slug (schema-keyed), boundaries structurally', () => {
  const ctx = buildGateContext([
    { schema: 'source-system', ref: 'data/kb/source-system.yaml#refi-dao-blog', object: { title: 'ReFi Blog', type: 'blog', url: 'https://blog.refidao.com' } },
    { schema: 'public-use-boundary', ref: 'b#x', object: { tier: 'never-publish-without-consent', source_lineage: 'https://x' } },
    { schema: 'resource', ref: 'r#r', object: { title: 'R', type: 'resource' } },
  ]);
  assert.ok(ctx.sourceSystems['refi-dao-blog']); assert.equal(ctx.boundaries.length, 1);
});

test('loadInstanceGate imports the module; missing export is fail-hard; absent config → null', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kms-gate-'));
  writeFileSync(join(dir, 'gate.mjs'), 'export function isPublishable(o){ return o.title === "yes" ? { ok: true } : { ok: false, reason: "no" }; }');
  const gate = await loadInstanceGate(dir, { publish: { gate: 'gate.mjs' } });
  const { passed, rejected } = applyGate(gate, [{ ref: 'x#yes', object: { title: 'yes' } }, { ref: 'x#no', object: { title: 'no' } }], {});
  assert.equal(passed.length, 1); assert.deepEqual(rejected, [{ slug: 'no', reason: 'no' }]);
  writeFileSync(join(dir, 'bad.mjs'), 'export const x = 1;');
  await assert.rejects(loadInstanceGate(dir, { publish: { gate: 'bad.mjs' } }), /isPublishable/);
  assert.equal(await loadInstanceGate(dir, {}), null);
});
```

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

function instance({ atproto = true, gate = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'kms-pub-'));
  mkdirSync(join(dir, 'data', 'kb'), { recursive: true });
  writeFileSync(join(dir, 'data', 'kb', 'resource.yaml'), yaml.dump({ entries: {
    a: { title: 'A', type: 'resource', public_use: 'ok-with-caveat' },
    b: { title: 'B', type: 'resource', public_use: 'ok-with-caveat', maturity: 'reviewed' },
    i: { title: 'I', type: 'resource', public_use: 'internal-only' } } }));
  writeFileSync(join(dir, 'data', 'kb', 'source-system.yaml'), yaml.dump({ entries: { card: { title: 'Card', type: 'blog', public_use: 'ok-with-caveat', steward: 's', return_path: 'r' } } }));
  if (gate) writeFileSync(join(dir, 'gate.mjs'), 'export function isPublishable(o){ return o.maturity === "reviewed" ? { ok: true } : { ok: false, reason: "not reviewed" }; }');
  writeFileSync(join(dir, 'kms.yaml'), yaml.dump({ instance: 't', adapter: 'repo-data', target: '.',
    ...(gate ? { publish: { gate: 'gate.mjs' } } : {}),
    ...(atproto ? { atproto: { did: 'did:plc:me', handle: 'kc.test', pds: 'https://pds.test', nsid_authority: 'xyz.regencoordination.kb' } } : {}) }));
  return dir;
}
const fakeClientFactory = (log) => () => ({
  async login() { log.push('login'); return { did: 'did:plc:me' }; },
  async putRecord(op) { log.push(['put', op.rkey]); return { uri: `at://did:plc:me/${op.collection}/${op.rkey}`, cid: 'cid1' }; },
  async deleteRecord(op) { log.push(['del', op.rkey]); },
});
const env = { ATPROTO_APP_PASSWORD: 'pw' };

test('publish registered; bound after render.site, before sync.push', () => {
  assert.ok(OPS.publish && OPS.publish.write === true);
  const c = LIFECYCLE_BINDINGS.close;
  assert.ok(c.indexOf('publish') > c.indexOf('render.site')); assert.equal(c.indexOf('publish'), c.indexOf('sync.push') - 1);
});

test('publish: gates by schema (card not published by default), mints, writes PDS + manifest + static', async () => {
  const dir = instance(); const log = [];
  const res = await OPS.publish.run({ dir, deps: { createClient: fakeClientFactory(log), env } });
  assert.equal(res.ok, true, JSON.stringify(res.report));
  assert.equal(res.report.minted, 2);
  assert.equal(res.report.atproto.status, 'applied'); assert.equal(res.report.atproto.created, 2);
  assert.ok(existsSync(join(dir, 'data', 'kms-published.json')));
  assert.ok(existsSync(join(dir, 'public', 'api', 'resource.json')));
  assert.ok(!existsSync(join(dir, 'public', 'api', 'source-system.json')), 'opt-in type not published');
  const disk = yaml.load(readFileSync(join(dir, 'data', 'kb', 'resource.yaml'), 'utf8')).entries;
  assert.ok(disk.a.id && disk.b.id && !disk.i.id);
});

test('publish: instance gate narrows; ids minted only for gate-passing objects', async () => {
  const dir = instance({ gate: true }); const log = [];
  const res = await OPS.publish.run({ dir, deps: { createClient: fakeClientFactory(log), env } });
  assert.equal(res.report.gate.passed, 1); assert.equal(res.report.gate.rejected, 1);
  assert.deepEqual(res.report.gate.by_reason, { 'not reviewed': 1 });
  assert.equal(res.report.minted, 1); assert.equal(res.report.atproto.created, 1);
  const disk = yaml.load(readFileSync(join(dir, 'data', 'kb', 'resource.yaml'), 'utf8')).entries;
  assert.ok(disk.b.id && !disk.a.id);
});

test('second run is all skips', async () => {
  const dir = instance(); const log = []; const deps = { createClient: fakeClientFactory(log), env };
  await OPS.publish.run({ dir, deps });
  const res = await OPS.publish.run({ dir, deps });
  assert.equal(res.report.atproto.skipped, 2); assert.equal(res.report.atproto.created, 0);
});

test('not configured (no atproto / no credential) → static still written, ok', async () => {
  for (const dir of [instance({ atproto: false }), instance()]) {
    const res = await OPS.publish.run({ dir, deps: { createClient: () => { throw new Error('must not be called'); }, env: {} } });
    assert.equal(res.ok, true); assert.equal(res.report.atproto.status, 'not-configured');
    assert.ok(existsSync(join(dir, 'public', 'api', 'resource.json')));
  }
});

test('publish.static:false skips the surface', async () => {
  const dir = instance({ atproto: false });
  const cfg = yaml.load(readFileSync(join(dir, 'kms.yaml'), 'utf8')); cfg.publish = { static: false }; writeFileSync(join(dir, 'kms.yaml'), yaml.dump(cfg));
  const res = await OPS.publish.run({ dir, deps: { env: {} } });
  assert.equal(res.report.static, 'disabled'); assert.ok(!existsSync(join(dir, 'public')));
});

test('--dry: plans, mints nothing, writes nothing', async () => {
  const dir = instance(); const log = [];
  const res = await OPS.publish.run({ dir, flags: { dry: true }, deps: { createClient: fakeClientFactory(log), env } });
  assert.equal(res.report.dry, true); assert.equal(res.report.atproto.status, 'planned'); assert.equal(res.report.atproto.created, 2);
  assert.equal(log.length, 0);
  assert.ok(!existsSync(join(dir, 'data', 'kms-published.json'))); assert.ok(!existsSync(join(dir, 'public')));
  assert.equal(yaml.load(readFileSync(join(dir, 'data', 'kb', 'resource.yaml'), 'utf8')).entries.a.id, undefined);
});

test('validation failure fails hard before any PDS write', async () => {
  const dir = instance(); const log = [];
  writeFileSync(join(dir, 'data', 'kb', 'resource.yaml'), yaml.dump({ entries: { a: { title: 'A', type: 'resource', public_use: 'ok-with-caveat', provenance: { score: 0.5 } } } }));
  const res = await OPS.publish.run({ dir, deps: { createClient: fakeClientFactory(log), env } });
  assert.equal(res.ok, false); assert.equal(log.length, 0); assert.match(JSON.stringify(res.report.errors), /float/);
});
```

- [ ] **Step 2: Run** → FAIL

- [ ] **Step 3: Implement `src/gate.mjs`**

```js
// packages/org-os-kms/src/gate.mjs — the instance gate hook. Framework gate is the floor; this can only narrow.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { slugFromRef } from './manifest.mjs';

export async function loadInstanceGate(dir, config) {
  const rel = config.publish?.gate;
  if (!rel) return null;
  const mod = await import(pathToFileURL(join(dir, rel)).href);
  if (typeof mod.isPublishable !== 'function') throw new Error(`publish.gate ${rel} does not export isPublishable(obj, ctx)`);
  return mod.isPublishable;
}

export function buildGateContext(allItems) {
  const sourceSystems = {}; const boundaries = [];
  for (const { schema, ref, object } of allItems) {
    if (schema === 'source-system') sourceSystems[slugFromRef(ref)] = { ...object, slug: slugFromRef(ref) };
    if (schema === 'public-use-boundary' || Object.prototype.hasOwnProperty.call(object, 'tier')) boundaries.push(object);
  }
  return { sourceSystems, boundaries };
}

export function applyGate(gate, items, ctx) {
  const passed = []; const rejected = [];
  for (const it of items) {
    const v = gate({ ...it.object, type: it.object.type ?? it.schema, slug: slugFromRef(it.ref) }, ctx);
    const ok = typeof v === 'boolean' ? v : Boolean(v?.ok);
    if (ok) passed.push(it); else rejected.push({ slug: slugFromRef(it.ref), reason: (typeof v === 'object' && v?.reason) || 'rejected by instance gate' });
  }
  return { passed, rejected };
}
```

**The `publish` op** — add imports to `ops.mjs`:

```js
import { loadKmsConfig } from './config.mjs';
import { ensureIds } from './identity.mjs';
import { readManifest, writeManifest } from './manifest.mjs';
import { planPublish, applyPublish } from './atproto/publish.mjs';
import { createClient as defaultCreateClient } from './atproto/client.mjs';
import { writeStaticSurface } from './static/surface.mjs';
import { loadInstanceGate, buildGateContext, applyGate } from './gate.mjs';
```

and the op:

```js
'publish': { kind: 'exec', write: true, run: async (ctx) => {
  const dir = ctx.dir || '.';
  const config = ctx.config || (ctx.config = loadKmsConfig(dir));
  const deps = { createClient: defaultCreateClient, env: process.env, ...(ctx.deps || {}) };
  const dry = ctx.flags?.dry === true;
  const target = join(dir, config.target);
  const adapter = fw.getAdapter(config.adapter);
  const report = { dry, atproto: { status: 'not-configured' }, static: null };

  const all = adapter.list(target);
  const types = fw.publishableTypes(config);
  let candidates = all.filter(({ schema, object }) => fw.isPublishable(object, { schema, types }));
  const gate = await loadInstanceGate(dir, config);
  if (gate) {
    const { passed, rejected } = applyGate(gate, candidates, buildGateContext(all));
    candidates = passed;
    const by_reason = {}; for (const r of rejected) by_reason[r.reason] = (by_reason[r.reason] || 0) + 1;
    report.gate = { passed: passed.length, rejected: rejected.length, by_reason };
  }
  const { minted, items } = ensureIds({ adapter: config.adapter, target, items: candidates, write: !dry });
  report.minted = minted.length;

  const manifest = readManifest(dir);
  let next = manifest;
  const at = config.atproto;
  if (at?.did && at?.pds && at?.nsid_authority) {
    const plan = planPublish({ items, manifest, did: at.did, authority: at.nsid_authority });
    if (!plan.ok) return { ok: false, report: { ...report, errors: plan.errors } };
    const counts = { created: plan.create.length, updated: plan.update.length, deleted: plan.delete.length, skipped: plan.skip.length };
    const password = deps.env.ATPROTO_APP_PASSWORD;
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
  if (config.publish?.static === false) report.static = 'disabled';
  else if (!dry) report.static = writeStaticSurface({ dir, outDir: config.publish?.static_dir || 'public', items, allItems: all, manifest: next, config });
  else report.static = 'skipped (dry)';
  if (!dry) writeManifest(dir, next);
  return { ok: report.atproto.status !== 'failed', report };
} },
```

`bind.mjs` close → `['csis-review','bridge','emit-contributions','federate.check','index.rebuild','render.site','render.dashboard','publish','sync.push']`; mirror it in `profile/profile.yaml` `lifecycle_bindings.close`; update `test/bind.test.mjs:35` to the same list. `config.mjs` defaults: `{ render: {}, peers: {}, connectors: [], publish: {}, ...cfg }`.

- [ ] **Step 4: Configure this instance** — append to root `kms.yaml`:

```yaml
publish:
  static_dir: public
  types_opt_in: [source-system]          # our cards are the federation primitive; refi-dao-commons keeps them off
atproto:
  did: null                              # regen-toolkit is a PULLER first; fill when this instance gets its own account
  handle: kc.regencoordination.xyz
  pds: null                              # REQUIRED for pulling peers even while did is null (Task 15)
  nsid_authority: xyz.regencoordination.kb
geo:
  parent_space: bd727a6ad6ec4a058f681ea9002a1fbf
  space: null
```

`.env.example`: `ATPROTO_APP_PASSWORD=`

- [ ] **Step 5: Run** `npm test` → PASS; `cd ../.. && npm run build` succeeds. **Commit** (include `profile/profile.yaml`, `test/bind.test.mjs`):

```bash
git add packages/org-os-kms/src/{gate,ops,bind,config}.mjs packages/org-os-kms/profile/profile.yaml packages/org-os-kms/test/{gate,publish-op,bind}.test.mjs kms.yaml .env.example
git commit -m "feat(kms): publish op with instance gate hook; bound on close"
```

---

### Task 12: Connector contract + `runConnector`

**Files:**
- Create: `packages/toolkit-framework/src/connector.mjs`
- Modify: `packages/org-os-kms/src/framework.mjs`
- Test: `packages/toolkit-framework/test/connector.test.mjs`

**Interfaces:**
- `NOT_IMPLEMENTED` error class (`.code`).
- `runConnector(connector, { config, cursor, adapter, target }) → { source, pulled, candidates, stored, updated, collisions, cursor, retractions, errors }`.
  - Every candidate is forced to `maturity: 'raw'`, `public_use: 'not-public-yet'`, `ai_assisted: false`, `provenance.origin` defaulted.
  - **Upsert by origin:** if a local object has the same `sourceUri`, `adapter.update(target, ref, patch)` where `patch` = candidate minus `id`, `maturity`, `public_use`, `review_needs` (local review state and identity are kept), plus `review_needs: 'updated at origin'`. Otherwise `adapter.store`.
  - `pull` may return `retracted: [sourceUri]` and `errors: [...]`; both surface.

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
    old: { title: 'Old', type: 'resource', sourceUri: 'at://peer/x/old', maturity: 'reviewed', public_use: 'ok-with-caveat', id: 'local-id', notes: 'v1' } } }));
  return dir;
}
const fake = (over = {}) => ({
  name: 'fake', protocol: 'test', capabilities: { ingest: true, subscribe: false, publish: false },
  describe: (cfg) => ({ title: 'Fake', type: 'dataset', steward: 'test', return_path: cfg.endpoint }),
  pull: async (cfg, { cursor }) => ({ records: [{ id: 'r1', name: 'One' }], cursor: (cursor || 0) + 1 }),
  map: (r) => [{ schema: 'resource', object: { title: r.name, type: 'resource', maturity: 'reviewed', public_use: 'ok-with-caveat' } }],
  ...over,
});
const ctx = (dir) => ({ config: { endpoint: 'https://f' }, cursor: null, adapter: 'repo-data', target: dir });

test('describe → pull → map → store; forces raw + not-public-yet', async () => {
  const dir = instance();
  const out = await runConnector(fake(), ctx(dir));
  assert.equal(out.source.title, 'Fake'); assert.equal(out.pulled, 1); assert.equal(out.stored, 1); assert.equal(out.cursor, 1);
  const stored = getAdapter('repo-data').list(dir).find(({ object }) => object.title === 'One').object;
  assert.equal(stored.maturity, 'raw'); assert.equal(stored.public_use, 'not-public-yet'); assert.equal(stored.ai_assisted, false);
  assert.ok(stored.provenance?.origin);
});

test('upsert by sourceUri keeps local id, maturity, public_use; flags review', async () => {
  const dir = instance();
  const c = fake({ map: () => [{ schema: 'resource', object: { title: 'Old', type: 'resource', sourceUri: 'at://peer/x/old', notes: 'v2', id: 'peer-id' } }] });
  const out = await runConnector(c, ctx(dir));
  assert.equal(out.updated, 1); assert.equal(out.stored, 0);
  const all = getAdapter('repo-data').list(dir);
  assert.equal(all.length, 1, 'no duplicate');
  const o = all[0].object;
  assert.equal(o.notes, 'v2'); assert.equal(o.id, 'local-id'); assert.equal(o.maturity, 'reviewed'); assert.equal(o.public_use, 'ok-with-caveat');
  assert.match(o.review_needs, /updated at origin/);
});

test('map [] fine; NOT_IMPLEMENTED propagates; pull errors surface', async () => {
  const dir = instance();
  assert.equal((await runConnector(fake({ map: () => [] }), ctx(dir))).stored, 0);
  await assert.rejects(runConnector(fake({ pull: async () => { throw new NOT_IMPLEMENTED('fake'); } }), ctx(dir)), (e) => e.code === 'NOT_IMPLEMENTED');
  const withErr = await runConnector(fake({ pull: async () => ({ records: [], cursor: 1, errors: [{ did: 'x', error: 'down' }] }) }), ctx(dir));
  assert.equal(withErr.errors.length, 1);
});

test('retracted sourceUris are held, never deleted', async () => {
  const dir = instance();
  const out = await runConnector(fake({ pull: async () => ({ records: [], cursor: 1, retracted: ['at://peer/x/old'] }) }), ctx(dir));
  assert.equal(out.retractions, 1);
  const old = getAdapter('repo-data').list(dir)[0].object;
  assert.equal(old.maturity, 'held'); assert.match(old.review_needs, /retracted at origin at:\/\/peer\/x\/old/);
});
```

- [ ] **Step 2: Run** → FAIL

- [ ] **Step 3: Implement**

```js
// packages/toolkit-framework/src/connector.mjs — seam 3: a Connector is a source driver (2026-07-19 spec). runConnector sequences describe → pull → map → upsert/store → retract.
import { getAdapter } from './storage.mjs';

export class NOT_IMPLEMENTED extends Error {
  constructor(name) { super(`connector ${name}: pull not implemented`); this.code = 'NOT_IMPLEMENTED'; }
}

const LOCAL_ONLY = ['id', 'maturity', 'public_use', 'review_needs'];

export async function runConnector(connector, { config, cursor, adapter, target }) {
  const source = connector.describe(config);
  const { records, cursor: nextCursor, retracted = [], errors = [] } = await connector.pull(config, { cursor });
  const a = getAdapter(adapter);
  const local = a.list(target);
  const byOrigin = new Map(local.filter((i) => i.object.sourceUri).map((i) => [i.object.sourceUri, i]));

  const toStore = []; let updated = 0;
  for (const r of records) for (const { schema, object } of connector.map(r, config)) {
    const base = { ...object, provenance: { origin: `${connector.name}:${source.return_path || source.title}`, ...(object.provenance || {}) } };
    const existing = object.sourceUri && byOrigin.get(object.sourceUri);
    if (existing) {
      const patch = {}; for (const [k, v] of Object.entries(base)) if (!LOCAL_ONLY.includes(k)) patch[k] = v;
      a.update(target, existing.ref, { ...patch, review_needs: 'updated at origin' }); updated++;
    } else toStore.push({ schema, object: { ...base, maturity: 'raw', public_use: 'not-public-yet', ai_assisted: false } });
  }
  const { stored, collisions = [] } = toStore.length ? a.store(target, toStore) : { stored: [], collisions: [] };

  let retractions = 0;
  if (retracted.length) {
    const set = new Set(retracted);
    for (const { object, ref } of a.list(target)) if (object.sourceUri && set.has(object.sourceUri)) { a.update(target, ref, { maturity: 'held', review_needs: `retracted at origin ${object.sourceUri}` }); retractions++; }
  }
  return { source, pulled: records.length, candidates: toStore.length + updated, stored: stored.length, updated, collisions: collisions.length, cursor: nextCursor, retractions, errors };
}
```

`framework.mjs`: `export { runConnector, NOT_IMPLEMENTED } from '../../toolkit-framework/src/connector.mjs';`

- [ ] **Step 4: Run** both suites → PASS. If `repo-data.update` re-slugs on `title` change, read `adapters/repo-data.mjs:88-97`; the upsert must patch in place by ref. **Commit:** `feat(framework): Connector contract + runConnector with origin upsert`

---

### Task 13: `atproto` connector

**Files:**
- Create: `packages/org-os-kms/src/atproto/connector.mjs`
- Test: `packages/org-os-kms/test/atproto-connector.test.mjs`

**Interfaces:** `createAtprotoConnector({ createClient })`, `atprotoConnector`. Config `{ peers, pds, self, nsid_authority }`. **No peers → `{ records: [], cursor: cursor ?? {}, retracted: [], errors: [] }` without creating a client.** Lists every `ALL_TYPES` collection (peers may publish opt-in types). `map` never touches `type`; strips `id`; sets `sourceUri` (origin) and `viaUri`.

- [ ] **Step 1: Write the failing test**

```js
// packages/org-os-kms/test/atproto-connector.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAtprotoConnector } from '../src/atproto/connector.mjs';

const AUTH = 'xyz.regencoordination.kb'; const RES = `${AUTH}.resource`; const SS = `${AUTH}.sourceSystem`;
const fakeClient = (state) => () => ({
  async getLatestCommit({ did }) { if (state[did]?.down) throw new Error('ECONNREFUSED'); return { cid: 'c', rev: state[did].rev }; },
  async listAllRecords({ repo, collection }) { return (state[repo].records || []).filter((r) => r.uri.includes(`/${collection}/`)); },
});

test('map: origin sourceUri, viaUri, no id, type untouched; own-origin and unknown skipped', () => {
  const c = createAtprotoConnector({ createClient: () => ({}) });
  const cfg = { self: 'did:plc:me', nsid_authority: AUTH };
  const rec = { uri: `at://did:plc:peer/${RES}/rk1`, cid: 'cid', value: { $type: RES, title: 'T', type: 'resource', id: 'peer-id', grc20Id: 'g1', public_use: 'ok-with-caveat' } };
  const [cand] = c.map(rec, cfg);
  assert.equal(cand.schema, 'resource'); assert.equal(cand.object.sourceUri, rec.uri); assert.equal(cand.object.viaUri, rec.uri);
  assert.equal(cand.object.id, undefined); assert.equal(cand.object.grc20Id, 'g1'); assert.equal(cand.object.$type, undefined);
  const card = { uri: `at://did:plc:peer/${SS}/k`, cid: 'x', value: { $type: SS, title: 'Blog', type: 'blog', steward: 's', return_path: 'r' } };
  const [cc] = c.map(card, cfg);
  assert.equal(cc.schema, 'source-system'); assert.equal(cc.object.type, 'blog', 'kind preserved');
  const republished = { uri: `at://did:plc:peer/${RES}/rk2`, cid: 'x', value: { $type: RES, title: 'R', type: 'resource', sourceUri: `at://did:plc:origin/${RES}/o1` } };
  assert.equal(c.map(republished, cfg)[0].object.sourceUri, `at://did:plc:origin/${RES}/o1`);
  assert.deepEqual(c.map({ uri: `at://did:plc:peer/${RES}/rk3`, cid: 'x', value: { $type: RES, title: 'M', type: 'resource', sourceUri: `at://did:plc:me/${RES}/m1` } }, cfg), []);
  assert.deepEqual(c.map({ uri: 'at://did:plc:peer/com.other/x', cid: 'x', value: { $type: 'com.other' } }, cfg), []);
});

test('pull: no peers → no client, empty; unchanged rev skipped; retractions + unreachable reported', async () => {
  const c0 = createAtprotoConnector({ createClient: () => { throw new Error('must not be called'); } });
  assert.deepEqual(await c0.pull({ peers: [], pds: null, nsid_authority: AUTH }, { cursor: null }), { records: [], cursor: {}, retracted: [], errors: [] });

  const state = { 'did:plc:a': { rev: 'r2', records: [{ uri: `at://did:plc:a/${RES}/1`, cid: 'c', value: { $type: RES, title: '1', type: 'resource' } }] }, 'did:plc:b': { rev: 'r1' }, 'did:plc:c': { down: true } };
  const c = createAtprotoConnector({ createClient: fakeClient(state) });
  const cfg = { self: 'did:plc:me', nsid_authority: AUTH, pds: 'https://pds', peers: ['did:plc:a', 'did:plc:b', 'did:plc:c'] };
  const cursor = { 'did:plc:a': { rev: 'r1', seen: [`at://did:plc:a/${RES}/1`, `at://did:plc:a/${RES}/gone`] }, 'did:plc:b': { rev: 'r1', seen: [] } };
  const out = await c.pull(cfg, { cursor });
  assert.equal(out.records.length, 1); assert.deepEqual(out.retracted, [`at://did:plc:a/${RES}/gone`]);
  assert.equal(out.cursor['did:plc:a'].rev, 'r2'); assert.deepEqual(out.cursor['did:plc:b'], cursor['did:plc:b']);
  assert.equal(out.errors[0].did, 'did:plc:c');
});

test('describe is a valid card', () => {
  const card = createAtprotoConnector({ createClient: () => ({}) }).describe({ peers: ['did:plc:a'], pds: 'https://pds' });
  for (const k of ['title', 'type', 'steward', 'return_path']) assert.ok(card[k], k);
});
```

- [ ] **Step 2: Run** → FAIL

- [ ] **Step 3: Implement**

```js
// packages/org-os-kms/src/atproto/connector.mjs — pull peers' repos. Cursor {did: {rev, seen}}: skip unchanged peers; full list + seen-diff for retractions.
import * as fw from '../framework.mjs';
import { createClient as defaultCreateClient } from './client.mjs';

const originDid = (uri) => uri.split('/')[2];

export function createAtprotoConnector({ createClient = defaultCreateClient } = {}) {
  return {
    name: 'atproto', protocol: 'AT Protocol (XRPC listRecords)', capabilities: { ingest: true, subscribe: false, publish: false },
    describe(config) { return { title: 'AT Proto peers', type: 'knowledge-garden', steward: 'federation', return_path: (config.peers || []).join(',') || 'none', endpoint: config.pds }; },
    async pull(config, { cursor }) {
      const next = { ...(cursor || {}) };
      const peers = config.peers || [];
      if (!peers.length) return { records: [], cursor: next, retracted: [], errors: [] };
      const client = createClient({ pds: config.pds });
      const records = []; const retracted = []; const errors = [];
      for (const did of peers) {
        try {
          const { rev } = await client.getLatestCommit({ did });
          const prev = next[did] || { rev: null, seen: [] };
          if (prev.rev === rev) continue;
          const listed = [];
          for (const schema of fw.ALL_TYPES) listed.push(...await client.listAllRecords({ repo: did, collection: fw.nsidFor(schema, config.nsid_authority) }));
          const seen = listed.map((r) => r.uri);
          for (const u of prev.seen) if (!seen.includes(u)) retracted.push(u);
          records.push(...listed); next[did] = { rev, seen };
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
      return [{ schema, object: { ...rest, sourceUri, viaUri: uri } }];
    },
  };
}
export const atprotoConnector = createAtprotoConnector();
```

- [ ] **Step 4: Run** → PASS. **Commit:** `feat(kms): atproto connector`

---

### Task 14: `static-json` connector + Open Haven mapper

**Files:**
- Create: `packages/org-os-kms/src/connectors/static-json/index.mjs`, `openhaven.mjs`
- Create: `packages/org-os-kms/test/fixtures/openhaven/{index,protocols,affordances,domains}.json` (collections trimmed to 3 items)
- Test: `packages/org-os-kms/test/static-json.test.mjs`

**Mapping (fields verified 2026-09-18):** protocol → `resource` (`title: name`, `url: communityLink`, `resource_type: entityType`, `notes: description`, `related_concepts: domainIds`, `original_source`, `steward: owner`, `last_reviewed: lastInvestigated`, `source_lineage`); affordance → `signal` (**`signal_type: 'resource'`** — enum has no "affordance"; `suggested_action: 'route'`); domain → `track` (**`audience: 'general'`** — required by `track.yaml`).

- [ ] **Step 1: Save fixtures**

```bash
mkdir -p packages/org-os-kms/test/fixtures/openhaven
for f in index protocols affordances domains; do curl -sL "https://www.openhaven.net/api/$f.json" > "packages/org-os-kms/test/fixtures/openhaven/$f.json"; done
node -e 'const p="packages/org-os-kms/test/fixtures/openhaven/";const fs=require("fs");for(const f of ["protocols","affordances","domains"]){const j=JSON.parse(fs.readFileSync(p+f+".json"));fs.writeFileSync(p+f+".json",JSON.stringify(j.slice(0,3),null,1))}'
```

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

test('openhaven mapper: protocol→resource, affordance→signal, domain→track; all validate', () => {
  const p = JSON.parse(fx('protocols.json'))[0];
  const [r] = openhaven.map({ collection: '/api/protocols.json', item: p });
  assert.equal(r.schema, 'resource'); assert.equal(r.object.title, p.name); assert.equal(r.object.url, p.communityLink);
  assert.equal(r.object.resource_type, p.entityType); assert.deepEqual(r.object.related_concepts, p.domainIds);
  assert.equal(validateObject('resource', r.object).valid, true);
  const [s] = openhaven.map({ collection: '/api/affordances.json', item: JSON.parse(fx('affordances.json'))[0] });
  assert.equal(s.schema, 'signal'); assert.equal(validateObject('signal', s.object).valid, true, validateObject('signal', s.object).errors.join());
  const [t] = openhaven.map({ collection: '/api/domains.json', item: JSON.parse(fx('domains.json'))[0] });
  assert.equal(t.schema, 'track'); assert.equal(validateObject('track', t.object).valid, true, validateObject('track', t.object).errors.join());
  assert.deepEqual(openhaven.map({ collection: '/api/entity-types.json', item: {} }), []);
});

test('connector: pull reads index + 3 collections (3 items each → 9); hash cursor; unchanged → empty', async () => {
  const c = createStaticJsonConnector({ fetchImpl });
  const first = await c.pull(cfg, { cursor: null });
  assert.equal(first.records.length, 9); assert.match(first.cursor, /^[a-f0-9]{64}$/);
  const second = await c.pull(cfg, { cursor: first.cursor });
  assert.equal(second.records.length, 0); assert.equal(second.cursor, first.cursor);
  assert.equal(c.describe(cfg).type, 'dataset'); assert.equal(c.map(first.records[0], cfg)[0].schema, 'resource');
});
```

- [ ] **Step 3: Run** → FAIL

- [ ] **Step 4: Implement**

```js
// packages/org-os-kms/src/connectors/static-json/openhaven.mjs — pure mapper for https://www.openhaven.net/api (fields verified 2026-09-18).
const BASE = 'https://www.openhaven.net';
export const collections = ['/api/protocols.json', '/api/affordances.json', '/api/domains.json'];

export function map({ collection, item }) {
  if (collection === '/api/protocols.json') return [{ schema: 'resource', object: {
    title: item.name, type: 'resource', url: item.communityLink, resource_type: item.entityType, notes: item.description,
    related_concepts: item.domainIds || [], original_source: `openhaven:${item.id}`, steward: item.owner, last_reviewed: item.lastInvestigated,
    source_lineage: `${BASE}/api/protocols/${item.id}.json` } }];
  if (collection === '/api/affordances.json') return [{ schema: 'signal', object: {
    title: item.name, type: 'signal', signal_type: 'resource', suggested_action: 'route',
    notes: [item.description, item.whatItEnables].filter(Boolean).join('\n\n'), related_concepts: item.domainIds || [],
    source_lineage: `${BASE}/api/affordances.json#${item.id}` } }];
  if (collection === '/api/domains.json') return [{ schema: 'track', object: {
    title: item.name, type: 'track', audience: 'general', notes: item.description, source_lineage: `${BASE}/api/domains.json#${item.id}` } }];
  return [];
}
```

```js
// packages/org-os-kms/src/connectors/static-json/index.mjs — a static source: read-only JSON + discovery doc, no protocol client.
import { createHash } from 'node:crypto';
import * as openhaven from './openhaven.mjs';

export const MAPPERS = { openhaven };

export function createStaticJsonConnector({ fetchImpl = globalThis.fetch, mappers = MAPPERS } = {}) {
  const get = async (url) => { const r = await fetchImpl(url); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.text(); };
  return {
    name: 'static-json', protocol: 'static JSON over HTTPS', capabilities: { ingest: true, subscribe: false, publish: false },
    describe(config) { return { title: `Static source ${new URL(config.base_url).hostname}`, type: 'dataset', steward: 'external', return_path: config.base_url, endpoint: config.base_url + (config.index || '/api/index.json') }; },
    async pull(config, { cursor }) {
      const indexBody = await get(config.base_url + (config.index || '/api/index.json'));
      const hash = createHash('sha256').update(indexBody).digest('hex');
      if (hash === cursor) return { records: [], cursor };
      const mapper = mappers[config.mapper];
      if (!mapper) throw new Error(`static-json: unknown mapper ${config.mapper}`);
      const records = [];
      for (const collection of config.collections || mapper.collections) for (const item of JSON.parse(await get(config.base_url + collection))) records.push({ collection, item });
      return { records, cursor: hash };
    },
    map(record, config) { return mappers[config.mapper].map(record); },
  };
}
export const staticJsonConnector = createStaticJsonConnector();
```

If `validateObject` still reports a missing required field for `signal`/`track`, the test names it — add it as a constant in the mapper.

- [ ] **Step 5: Run** → PASS. **Commit:** `feat(kms): static-json connector + Open Haven mapper`

---

### Task 15: Connector registry, `ingest.pull` op, lifecycle, docs

**Files:**
- Create: `packages/org-os-kms/src/connectors/index.mjs`, `packages/org-os-kms/docs/CONNECTORS.md`
- Modify: `src/ops.mjs`, `src/bind.mjs`, `profile/profile.yaml`, `test/bind.test.mjs`, root `kms.yaml`
- Test: `test/ingest-pull-op.test.mjs`

**Interfaces:** `CONNECTORS`, `getConnector(name, registry)`; `OPS['ingest.pull']` (`write: true`, async): per declared connector → `runConnector` with `{ ...shared, ...decl.config }` where `shared = { self: atproto.did, nsid_authority, pds }`; cursor written back to `kms.yaml` (**comments in the `connectors:` block are lost on write-back — keep comments elsewhere**); `NOT_IMPLEMENTED` → `not-implemented`, continue; other error → `failed`, continue, op returns `ok:false` at the end.

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

test('ingest.pull registered and first in close', () => {
  assert.ok(OPS['ingest.pull']?.write === true); assert.equal(LIFECYCLE_BINDINGS.close[0], 'ingest.pull');
});

test('runs each connector, writes cursors back, continues past NOT_IMPLEMENTED', async () => {
  const dir = instance([{ name: 'good', config: {}, cursor: null }, { name: 'stub', config: {}, cursor: null }]);
  const res = await OPS['ingest.pull'].run({ dir, deps: { registry: { good, stub } } });
  assert.equal(res.ok, true, JSON.stringify(res.report));
  assert.equal(res.report.connectors[0].stored, 1); assert.equal(res.report.connectors[1].status, 'not-implemented');
  const cfg = yaml.load(readFileSync(join(dir, 'kms.yaml'), 'utf8'));
  assert.equal(cfg.connectors[0].cursor, 1); assert.equal(cfg.connectors[1].cursor, null);
});

test('a failing connector does not stop the others; op reports ok:false', async () => {
  const dir = instance([{ name: 'broken', config: {}, cursor: null }, { name: 'good', config: {}, cursor: null }]);
  const res = await OPS['ingest.pull'].run({ dir, deps: { registry: { good, broken } } });
  assert.equal(res.ok, false); assert.equal(res.report.connectors[0].status, 'failed'); assert.equal(res.report.connectors[1].stored, 1);
});
```

- [ ] **Step 2: Run** → FAIL

- [ ] **Step 3: Implement**

```js
// packages/org-os-kms/src/connectors/index.mjs — connector registry (composition root for source drivers).
import { atprotoConnector } from '../atproto/connector.mjs';
import { staticJsonConnector } from './static-json/index.mjs';
export const CONNECTORS = { atproto: atprotoConnector, 'static-json': staticJsonConnector };
export function getConnector(name, registry = CONNECTORS) {
  const c = registry[name];
  if (!c) throw new Error(`unknown connector: ${name} (available: ${Object.keys(registry).join(', ')})`);
  return c;
}
```

`ops.mjs` imports: `import { readFileSync, writeFileSync } from 'node:fs'; import yaml from 'js-yaml'; import { getConnector, CONNECTORS } from './connectors/index.mjs';` and the op:

```js
'ingest.pull': { kind: 'exec', write: true, run: async (ctx) => {
  const dir = ctx.dir || '.';
  const config = ctx.config || (ctx.config = loadKmsConfig(dir));
  const registry = ctx.deps?.registry || CONNECTORS;
  const target = join(dir, config.target);
  const shared = { self: config.atproto?.did, nsid_authority: config.atproto?.nsid_authority, pds: config.atproto?.pds };
  const report = { connectors: [] }; let ok = true;
  const kmsPath = join(dir, 'kms.yaml');
  const raw = yaml.load(readFileSync(kmsPath, 'utf8')); raw.connectors = raw.connectors || [];
  for (let i = 0; i < (config.connectors || []).length; i++) {
    const decl = config.connectors[i];
    try {
      const r = await fw.runConnector(getConnector(decl.name, registry), { config: { ...shared, ...(decl.config || {}) }, cursor: decl.cursor ?? null, adapter: config.adapter, target });
      raw.connectors[i].cursor = r.cursor ?? null;
      report.connectors.push({ name: decl.name, status: 'ok', pulled: r.pulled, candidates: r.candidates, stored: r.stored, updated: r.updated, collisions: r.collisions, retractions: r.retractions, errors: r.errors });
    } catch (e) {
      if (e.code === 'NOT_IMPLEMENTED') report.connectors.push({ name: decl.name, status: 'not-implemented' });
      else { ok = false; report.connectors.push({ name: decl.name, status: 'failed', error: e.message }); }
    }
  }
  writeFileSync(kmsPath, yaml.dump(raw, { lineWidth: 120 }));
  return { ok, report };
} },
```

`bind.mjs` close → `['ingest.pull','csis-review','bridge','emit-contributions','federate.check','index.rebuild','render.site','render.dashboard','publish','sync.push']`; mirror in `profile/profile.yaml`; update `test/bind.test.mjs:35`.

Root `kms.yaml` — append (no comments inside this block):

```yaml
connectors:
  - name: atproto
    config:
      peers: []
    cursor: null
  - name: static-json
    config:
      base_url: https://www.openhaven.net
      index: /api/index.json
      mapper: openhaven
    cursor: null
```

Write `packages/org-os-kms/docs/CONNECTORS.md` (lifecycle order; the two connectors' cursor models; **install = vendor both packages unedited, pinned**; a *puller* needs `atproto.pds` even with `did: null`; identity setup steps: PDS → account → `did:plc` + app password → `kms.yaml.atproto` + `.env` → DNS `_lexicon.<nsid host>` TXT → dev identity wiped before first real publish; `--dry` semantics; `public/api/**` is committed).

- [ ] **Step 4: Run everything**

```bash
cd packages/org-os-kms && npm test && cd ../toolkit-framework && npm test && cd ../.. && npm run build
```

Then a real dry run: `node packages/org-os-kms/src/cli.mjs lifecycle close --dir . --dry` → `ingest.pull` report: atproto `pulled: 0` (no peers), static-json `pulled: 227+43+10`, `stored: …`; `publish`: `atproto.status: 'not-configured'`, `static: 'skipped (dry)'`, `minted: 0`.

**Note:** `--dry` is honoured by `publish` only; `ingest.pull` has no dry mode — the Open Haven pull above **stores** ~280 raw candidates into `data/kb/`. Run it on a scratch copy of the repo, or review and commit them as the first real pull (they are `raw` + `not-public-yet`; nothing publishes).

- [ ] **Step 5: Commit** (include `profile/profile.yaml`, `test/bind.test.mjs`): `feat(kms): ingest.pull op + connector registry; bind on close; document setup`

---

### Task 16: First publish artefacts committed

- [ ] Run `node packages/org-os-kms/src/cli.mjs lifecycle close --dir .` once (no `--dry`) with `atproto.did: null`: mints ids for gate-passing objects, writes `data/kms-published.json`, `public/api/**`, `public/.well-known/`. Review `git diff --stat`; expect id/grc20Id lines on publishable objects (this repo: ~141 with a publishable `public_use`), ~700 new files under `public/`. Commit: `chore(kms): first static publish — ids, manifest, public/api`.

---

### Task 17: Opt-in end-to-end round trip

**Files:** `packages/org-os-kms/test/e2e-atproto.test.mjs` — as in revision 1, with `kms.yaml` for the puller including `atproto: { did: 'did:plc:other', pds: E.ATPROTO_E2E_PDS, nsid_authority }` (a puller needs `pds`). Skipped unless `ATPROTO_E2E=1` + `ATPROTO_E2E_PDS/HANDLE/PASSWORD/DID`.

```js
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

test('e2e: publish → pull → retract', { skip: !enabled && 'set ATPROTO_E2E=1 + PDS/HANDLE/PASSWORD/DID' }, async () => {
  const mk = (x) => {
    const dir = mkdtempSync(join(tmpdir(), 'kms-e2e-'));
    mkdirSync(join(dir, 'data', 'kb'), { recursive: true });
    writeFileSync(join(dir, 'data', 'kb', 'resource.yaml'), yaml.dump({ entries: x.entries || {} }));
    writeFileSync(join(dir, 'kms.yaml'), yaml.dump({ instance: x.instance, adapter: 'repo-data', target: '.',
      atproto: { did: x.did, handle: E.ATPROTO_E2E_HANDLE, pds: E.ATPROTO_E2E_PDS, nsid_authority: 'xyz.regencoordination.kb' }, connectors: x.connectors || [] }));
    return dir;
  };
  const title = `E2E ${Date.now()}`;
  const publisher = mk({ instance: 'pub', did: E.ATPROTO_E2E_DID, entries: { e2e: { title, type: 'resource', public_use: 'ok-with-caveat', url: 'https://example.org' } } });
  const deps = { env: { ATPROTO_APP_PASSWORD: E.ATPROTO_E2E_PASSWORD } };
  const pub = await OPS.publish.run({ dir: publisher, deps });
  assert.equal(pub.ok, true, JSON.stringify(pub.report)); assert.equal(pub.report.atproto.created, 1);

  const puller = mk({ instance: 'pull', did: 'did:plc:other', connectors: [{ name: 'atproto', config: { peers: [E.ATPROTO_E2E_DID] }, cursor: null }] });
  const pull = await OPS['ingest.pull'].run({ dir: puller });
  assert.equal(pull.ok, true, JSON.stringify(pull.report));
  const got = getAdapter('repo-data').list(puller).find(({ object }) => object.title === title);
  assert.ok(got); assert.equal(got.object.maturity, 'raw'); assert.equal(got.object.public_use, 'not-public-yet'); assert.equal(got.object.url, 'https://example.org');
  assert.match(got.object.sourceUri, new RegExp(`^at://${E.ATPROTO_E2E_DID}/xyz\\.regencoordination\\.kb\\.resource/`));

  writeFileSync(join(publisher, 'data', 'kb', 'resource.yaml'), yaml.dump({ entries: {} }));
  assert.equal((await OPS.publish.run({ dir: publisher, deps })).report.atproto.deleted, 1);
  const pull2 = await OPS['ingest.pull'].run({ dir: puller });
  assert.equal(pull2.report.connectors[0].retractions, 1);
});
```

- [ ] Run without env → 1 skipped. Against a dev PDS → PASS. **Commit:** `test(kms): opt-in e2e publish→pull→retract`

---

## Self-review (revision 2)

**Spec coverage.** Gate (schema-keyed, opt-in) T1; fields T2; Lexicons over 12 T3; async + `--dry` T4; manifest + `slugFromRef` T5; minting only after every gate, dry mints nothing T6; refs T7; client with pds guard + `validate:false` T8; planner keyed on schema T9; static surface with served `context.jsonld` T10; instance gate hook + publish op + profile twin T11; `runConnector` with `not-public-yet`, origin upsert, errors T12; connector with no-peers guard, `ALL_TYPES`, type untouched T13; Open Haven with valid `signal_type`/`audience` T14; `ingest.pull` + registry + docs + puller needs `pds` T15; committed artefacts T16; e2e with retraction T17.

**Reviewer findings → tasks.** #1 → T1/T6/T9/T10/T11/T13. #2 → T4. #3 → T8/T13/T11 config. #6 → T11/T15. #7 → T12. #8 → T12 (+ pilot 3.3 reordered). #9 → T6/T11. #10 → T1/T2/T3/T5. #12 → constraints. #13 → T10. #14 → T12/T15. #15 → T14. #16 → T5/T9/T15 note. #17 → constraints/T10 note/T16.

**Type consistency.** `isPublishable(object, {schema, types})` everywhere; `planPublish` returns `previous`; `applyPublish` reads `plan.previous`/`plan.skip`; manifest entry `{slug, type(schema), rkey, atUri, cid, hash, publishedAt}` in T5/T9/T10; `runConnector` returns `{…, updated, errors}` and T15 reports both; `ensureIds({items, write})` in T6/T11; connector config keys `self`, `nsid_authority`, `pds`, `peers` in T13/T15.
