# org-os-kms — AT Proto Publication Plane — Design Spec

**Date:** 2026-09-18
**Status:** approved design, awaiting implementation plan
**Packages:** `packages/org-os-kms` (drivers, ops), `packages/toolkit-framework` (contract, Lexicon generator), `packages/koi-bridge` (optional sensor)
**Supersedes:** the `atproto` stub in `2026-07-19-org-os-kms-connector-layer-design.md` (org-os repo). Builds on that spec's `connector.mjs` contract, which is still unbuilt.
**Layer:** 6 (Infrastructure & Substrate) primarily; touches 3 (Knowledge Commons) via schema fields.

## Summary

Make AT Protocol the **publication and federation plane** of org-os-kms. Git/yaml stays the editorial substrate (raw → reviewed → canonical, `csis-review` gate, Obsidian/PR workflow). Canonical knowledge objects are **published** to one AT Proto repo per org instance; peer instances **pull** each other's repos and re-enter review. Lexicons are generated from the framework's schemas, so schema governance does not move.

This gives every canonical Regen Knowledge Commons object a DID-rooted, Lexicon-typed, permanently citable identity (`at://did/collection/rkey`) and replaces today's peer-cards + draft-only contribute-back with real, incremental sync — without betting the KB on the protocol.

## Decisions made during brainstorming

| Question | Decision | Why |
|---|---|---|
| What is org-os-kms for? | Cross-org **public** knowledge commons | AT Proto repos are public by default; the private org tier (`data/*.yaml` registries, `memory/`, `HEARTBEAT.md`) never touches AT Proto |
| Who owns a record? | **One DID per org instance** | Maps 1:1 to today's model (instance = `data/kb/`). Contributors are a field, not a repo |
| Substrate or plane? | **Plane** (approach B) over substrate (A) or pull-only connector (C) | Keeps git as the review workflow; slots into two existing seams (`storage.mjs` adapter registry, `connector.mjs`); A becomes a later migration, not a bet |
| DID method | `did:web` | Domain the org already controls; avoids `did:plc` single-registry dependency |
| Schema authority | Lexicons **generated** from `toolkit-framework/schemas/*.yaml` | Framework yaml stays source of truth; Lexicon is a build artifact with a drift test |

## Research findings that constrain the design

- **KOI-net is not AT Proto-compatible at any layer** (wire, identity, schema). They are complementary: KOI does consent-based pairwise edges; AT Proto does public broadcast. Only overlap: any AT-URI is a valid RID. Cheapest bridge is an **atproto→KOI sensor node**, which fits KOI's existing sensor pattern. `regen-koi-mcp` is a search/RAG surface over GAIA's Postgres, not a spec-conformant koi-net node.
- **The claim "GRC-20 IDs are valid DIDs / Geo ontologies are valid AT Proto vocabularies" is unverified.** The GRC-20 spec references IPFS + Aragon spaces only. Treat as an open question for Rather; this design carries a `grc20Id` field so stigmergic ID agreement works regardless.
- **AT Proto constraints:** repos public-by-default (Spaces alpha is not for production); 1 MB per record, 200 ops per commit, no floats in records; Lexicon evolution additive-only; one domain per NSID authority; `did:plc` is Bluesky-operated.

## Architecture

### Three planes, one boundary

```
 EDITORIAL PLANE (git/yaml, per instance — unchanged)
   data/kb/<schema>.yaml  ·  maturity: raw → reviewed → canonical  ·  csis-review gate
                          │
                          │  publish  (only maturity: canonical)
                          ▼
 PUBLICATION PLANE (AT Proto, one repo per org instance)
   did:web:<instance-domain>  →  PDS  →  at://did/commons.regen.kb.<type>/<rkey>
                          │
                          │  listRecords (cursor = repo rev)
                          ▼
 FEDERATION PLANE (peers pull each other, land as raw, re-enter review)
   atproto connector   →  runConnector   →  review_queue
   atproto→KOI sensor  →  GAIA koi-processor  (AT-URI as RID, CID as hash)   [optional, last]
```

### Identity

- One `did:web` per org-os instance. The DID document lists the PDS endpoint and signing key.
- Contributor attribution is the existing `steward` / `contributors` fields on the record. No contributor DIDs this pass.
- `rkey` = the object's existing slug, sanitized to the rkey charset (`[a-zA-Z0-9.\-_:~]`, ≤512 chars). Stable across republishes, so an AT-URI is a permanent citation.

### Schema

- **Publishable set** = the 8 KB object types that have hubs in `kb-graph/`: `claim-evidence`, `concept-lineage`, `encyclopedia-entry`, `implementation-record`, `option-entry`, `public-use-boundary`, `resource`, `source-system`. Declared as a framework constant (`PUBLISHABLE_SCHEMAS`), not inferred.
- **NSID** = `commons.regen.kb.<camelCaseType>` (e.g. `commons.regen.kb.encyclopediaEntry`). The NSID authority domain is an open question (see below); the generator takes it as a parameter so it is a one-line change.
- Support schemas (`frontmatter`, `provenance`, `review-maturity`, `relationships`) become shared `defs` inside the generated Lexicons, not collections.
- Each publishable schema gains three optional string fields: `grc20Id` (shared UUID with Geo spaces), `sourceRid` (KOI RID if the object came from a KOI bundle), `sourceUri` (upstream AT-URI if pulled from a peer — the federation provenance chain).
- Lexicon evolution is additive-only, matching the framework's existing "never break a schema field" posture. The generator refuses float-typed fields (AT Proto records have no floats).

### What does not change

`repo-data` and `kb-folder` storage adapters; the review pipeline; `federate.mjs` draft-and-present for external comms; `kb-graph/` generation; every private registry.

## Components

Placement follows the July connector spec: **contract framework-side, concrete drivers in org-os-kms**.

```
toolkit-framework/                                  (portable)
  src/storage.mjs            existing — adapter registry gains 'atproto'
  src/connector.mjs          NEW (specced 2026-07-19, unbuilt) — contract + runConnector
  src/lexicon.mjs            NEW — schema.yaml → Lexicon JSON generator + validate(record, nsid)
  lexicons/                  NEW — generated commons.regen.kb.*.json (committed, diffable)
  schemas/*.yaml             existing — +grc20Id / sourceRid / sourceUri (optional) on publishable set

org-os-kms/
  src/atproto/
    client.mjs               NEW — thin XRPC wrapper: createSession, putRecord, listRecords, getRecord
    storage.mjs              NEW — 'atproto' storage adapter
    connector.mjs            NEW — 'atproto' connector (describe/pull/map); replaces the July stub
    rkey.mjs                 NEW — slug → rkey (pure)
  src/ops.mjs                +op  publish.atproto   +op  ingest.pull
  src/bind.mjs               +LIFECYCLE_BINDINGS.close =
                               [ingest.pull, csis-review, bridge, emit-contributions, federate.check,
                                index.rebuild, render.site, render.dashboard, publish.atproto, sync.push]
  data/atproto-published.json  NEW per instance — publish manifest {rkey → {cid, publishedAt}}

packages/koi-bridge/
  src/sensors/atproto.mjs    NEW — Jetstream consumer → KOI NEW/UPDATE/FORGET events  [optional, last]
```

### `kms.yaml` additions (per instance)

```yaml
atproto:
  did: did:web:kc.example.org
  pds: https://pds.example.org
  handle: kc.example.org
  nsid_authority: commons.regen        # parameter to the Lexicon generator
connectors:
  - name: atproto
    config:
      peers: [did:web:kc.refidao.example]
    cursor: null                        # {did: rev} map, opaque
```

Credentials (`ATPROTO_APP_PASSWORD` or OAuth token) live in `.env`, never in `kms.yaml`.

### Per-component contracts

**`lexicon.mjs`** — pure.
- `generate(schemaYaml, {nsidAuthority}) → LexiconDoc`
- `validate(object, nsid) → {ok, errors[]}`
- One mapping table yaml type → Lexicon type (string/integer/boolean/array/object/ref; dates → `string` with `format: datetime`). Float fields → generate-time error naming the field.

**`atproto/storage.mjs`** — implements the existing 5-method storage contract.
- `store` = `putRecord` (upsert by rkey)
- `list` = `listRecords`, paged
- `update` = `putRecord` with `swapRecord: <previous cid>` guard
- `index` / `writeIndex` = no-op with a documented note (the AppView/firehose is the index)
- The adapter is dumb: it does not check maturity. The `publish.atproto` op enforces canonical-only.

**`atproto/connector.mjs`** — implements the July `Connector` contract.
- `describe(config)` → source-system card `{type: 'knowledge-commons', endpoint: pds, did}`
- `pull(config, {cursor})` → `listRecords` per peer per publishable collection since `cursor[did]`; returns `{records, cursor}`
- `map(record)` → `[{schema, object}]` by NSID → framework schema; sets `sourceUri`, `maturity: raw`. Pure; returns `[]` for unknown NSIDs.
- `capabilities: {ingest: true, subscribe: false, publish: false}` — publish is a separate op, not a connector capability, because it is the instance's own repo.

**`publish.atproto` op** — `kind: 'exec'`, `write: true` (fail-hard).
1. Load all objects in `data/kb/` with `maturity: canonical` and schema in `PUBLISHABLE_SCHEMAS`.
2. Validate **every** object against its Lexicon before the first network call. Any failure aborts with per-field errors; nothing partially published.
3. For each: `rkey = rkey(slug)`; `cid = dagCbor(object)`; skip if `manifest[rkey].cid === cid`; else `putRecord` with `swapRecord: manifest[rkey]?.cid`.
4. Write `data/atproto-published.json` back. `sync.push` commits it.
5. `--dry` prints the diff (create / update / skip counts and rkeys) without writing.
6. If `kms.yaml.atproto` or credentials are absent → report `not configured`, skip. Instances without a PDS are not broken by the binding.

**`rkey.mjs`** — pure. Charset, length, idempotency, collision check against the manifest.

### Sequencing on `close`

`ingest.pull` first (peers' new objects land as raw and get reviewed in the same session); `publish.atproto` after `bridge` (only reviewed content ships) and before `sync.push` (the git commit records the updated manifest). `initialize` stays read-only.

## Data flow

### Publish cycle

```
data/kb/*.yaml ──filter maturity:canonical ∧ schema∈PUBLISHABLE──▶ validate ALL ──fail──▶ abort
   │ ok
   ▼ for each object:
   rkey = rkey(slug); cid = dagCbor(object)
   manifest[rkey].cid == cid  → skip
   else putRecord({repo: did, collection: nsid, rkey, record, swapRecord: manifest[rkey]?.cid})
   manifest[rkey] = {cid, publishedAt}
write data/atproto-published.json
```

`swapRecord` makes an out-of-band edit on the PDS a hard conflict, never a silent overwrite.

### Pull cycle (federation)

Unchanged from `runConnector`: `describe → pull → map → ingest(raw) → store → review_queue`; cursor advanced only after a successful store (at-least-once, idempotent via upsert-by-id).

Merge rules:
- A peer's deleted record → review-flagged retraction, never a local delete (same rule as KOI `FORGET`).
- Pulled object with a `sourceUri` already present locally → upsert-by-id.
- Pulled object colliding on slug with a *different* `sourceUri` → suffixed slug + review flag. Never merged automatically.

### KOI sensor (optional, last)

A koi-bridge sensor subscribes to Jetstream filtered to `commons.regen.kb.*` collections, maps `#commit` ops → `NEW`/`UPDATE`/`FORGET`, uses the AT-URI as RID, the record CID as `sha256_hash`, and the commit `rev` timestamp as manifest `timestamp`. This touches nothing in koi-net; it is a standard sensor node.

## Error handling

- `publish.atproto` and `ingest.pull` are `write: true` → fail-hard, per executor policy. Both return a structured report (per-object / per-peer).
- **PDS unreachable on publish** → op fails, manifest untouched, the rest of `close` already completed (publish is after bridge, so the KB is consistent). Next `close` retries the same diff.
- **PDS unreachable on pull** → that peer is reported and skipped; other peers continue. This is the same narrow exception the July spec grants `NOT_IMPLEMENTED`.
- **Validation failure** → abort before the first write, with per-field errors.
- **Record > 1 MB** → validate-time error naming the field. No blob handling this pass.
- **`swapRecord` conflict** → op fails for that record with the remote CID in the report; operator resolves by hand (re-pull or force). No automatic overwrite.
- **Missing config / credentials** → `not configured`, skip, not an error.

## Testing

All network-free except one opt-in e2e.

- **`lexicon.mjs`:** generate from each of the 8 publishable schemas → snapshot-compare to committed `lexicons/`. A drift test fails CI if a schema changes without regenerating. Round-trip: every canonical fixture object in `data/kb/` validates. Float field → error.
- **`rkey.mjs`:** charset, length, idempotency, collision.
- **`atproto/storage.mjs` + `publish.atproto`:** fake XRPC client in memory. Assert diff-only writes, `swapRecord` on update, manifest write-back, abort-before-first-write on validation failure, `not configured` skip, `--dry` writes nothing.
- **`atproto/connector.mjs`:** pure `map` against one fixture record per NSID; `runConnector` with a fake connector for cursor persistence, retraction flagging, slug-collision suffixing.
- **e2e (opt-in, `ATPROTO_E2E=1`):** publish to a local PDS (`@atproto/pds` dev container) from one instance config, pull from a second; assert the object is byte-equal after round-trip.
- **Baseline:** existing 65 org-os-kms tests stay green.

## Proving ground

- **Publisher:** regen-toolkit (this instance).
- **First peer / puller:** refi-dao-os (104 typed entries). Success = its `close` pulls regen-toolkit's canonical objects into its review queue without disturbing the 104 existing entries.
- **Cold start:** org-os canonical (empty scaffold) pulls from regen-toolkit and populates from zero.

## Non-goals this pass

Spaces / private repos; labelers; feed generators; our own AppView (we use `listRecords` per peer, not the firehose); contributor DIDs; Geo write-side; blobs; real `publish` capability on connectors (contribute-back to *other* orgs' repos stays draft-and-present); Notion / Synthefy / Radicle connectors.

## Open questions

1. **NSID authority domain.** `commons.regen.*` requires DNS control of `regen.commons`-equivalent. Is this a governance question for the KC group, or does one org hold it? The generator parameterizes it; the decision is needed before the first real publish.
2. **PDS hosting.** Self-hosted (`@atproto/pds`, one per org) vs a hosted provider. Affects `did:web` document contents only; no code impact.
3. **Verify the GRC-20 ↔ AT Proto claim with Rather** before it becomes load-bearing anywhere else. This design does not depend on it.
4. **`grc20Id` assignment.** Who mints the UUID — the KC space in Geo, or the instance at publish time? Field is present either way.
