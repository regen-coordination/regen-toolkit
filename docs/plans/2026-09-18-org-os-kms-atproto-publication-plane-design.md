# org-os-kms — AT Proto Publication Plane — Design Spec

**Date:** 2026-09-18 (revised after grilling, same day)
**Status:** approved design, awaiting implementation plan
**Decision record:** [`docs/adr/0001-atproto-as-publication-plane.md`](../adr/0001-atproto-as-publication-plane.md)
**Vocabulary:** [`CONTEXT.md`](../../CONTEXT.md) — terms below are used as defined there
**Packages:** `packages/org-os-kms` (drivers, ops), `packages/toolkit-framework` (contract, Lexicon generator)
**Supersedes:** the `atproto` stub in `2026-07-19-org-os-kms-connector-layer-design.md` (org-os repo). Builds on that spec's `connector.mjs` contract, which is still unbuilt.
**Layer:** 6 (Infrastructure & Substrate) primarily; touches 3 (Knowledge Commons) via schema fields.

## Summary

Make AT Protocol the **publication and federation plane** of org-os-kms. Git/yaml stays the editorial plane (authoring, review, the `public_use` gate). Publishable knowledge objects are published to one AT Proto repo per instance **and** to a static JSON-LD surface on the instance's site, from one manifest. Peer instances pull each other's repos; non-AT-Proto sources (Open Haven first) are pulled through a static-JSON connector. Lexicons are generated from the framework's schemas, so schema governance does not move.

Every published object gets a DID-rooted, Lexicon-typed, permanently citable identity (`at://did/collection/id`); today's peer-cards + draft-only contribute-back becomes real, incremental sync; and consumers who cannot speak AT Proto (Geo "query in place", Open Haven, agents/MCP) read the static surface.

## Decisions

| # | Question | Decision |
|---|---|---|
| — | Substrate, plane, or connector? | **Plane.** See ADR-0001. |
| — | What is org-os-kms for? | Cross-org **public** knowledge commons. The private org tier (`data/*.yaml` registries, `memory/`, `HEARTBEAT.md`) never touches AT Proto. |
| — | Who owns a record? | **One DID per instance.** Contributors are attributed in fields. |
| Q1 | Open Haven's role | **Both** peer (first `static-json` source) and pattern (our static surface). |
| Q2 | Publication surfaces | **One `publish` op, two targets, one manifest.** Static entries cite the `at://` URI + CID. |
| Q3/Q12/Q17 | NSID authority | **`xyz.regencoordination.kb.*`** (DNS `_lexicon.kb.regencoordination.xyz`). No `dev.` prefix in NSIDs. A neutral commons authority is a KC-group decision; migration cost is one regeneration + one republish. |
| Q4 | PDS hosting | **One self-hosted PDS for the federation**, hosting every instance's account. |
| Q5 | `sourceUri` | **Origin** (first publisher's AT-URI), immutable across republishes. Pull skips records whose origin DID is mine. Dedupe by origin URI only. |
| Q6 | Republishing | **Allowed.** Origin and `grc20Id` preserved. |
| Q7 | Retraction | **`deleteRecord`** when an object leaves the publishable set; peers flag, never auto-delete. |
| Q8 | `grc20Id` minting | **Origin mints UUIDv4 at first publish**, written back to yaml; operator pastes Geo's ID if the entity already exists there. |
| Q9 | Publication gate | `public_use ∈ {ok-with-caveat, source-linked-unreviewed, reviewed-for-explanation, reviewed-for-guidance}`. **Maturity is not a gate.** |
| Q10 | Stable identity | Optional `id` (UUIDv4) on the frontmatter schema; origin mints at first publish, writes back to yaml; required for publishable objects; **`rkey = id`**. |
| Q11 | Publishable types | **All hub types except `person`** (12): `claim-evidence, concept-lineage, encyclopedia-entry, implementation-record, option-entry, organization, public-use-boundary, relationship-record, resource, signal, source-system, track`. |
| Q13 | `.well-known/` | **Copied into `public/.well-known/` at build.** Root stays the source of truth. |
| Q14 | Static-json field mapping | **One pure mapper module per source** (`openhaven.mjs`), selected by config. |
| Q15 | Geo space ID | `kms.yaml.geo: { parent_space, space }`, surfaced in `knowledge.json`. Parent = Knowledge Commons topic space `bd727a6ad6ec4a058f681ea9002a1fbf`; `space` null until Rather bootstraps the Regen KC space. |
| Q16/Q21 | Identity | **`did:plc`** with handle `kc.regencoordination.xyz` (refi-dao-os: `knowledge.refidao.com`). Handle can change; DID cannot and need not. Dev identity is a separate disposable `did:plc`. |
| Q18 | Static surface | Open Haven layout, JSON with `@context` → valid JSON-LD; `.well-known/knowledge.json` is the discovery doc. |
| Q19 | Cross-references | **Origin AT-URI** when the target is published; slug left as is when it isn't; next diff repairs it. Not strong refs (they pin versions; the commons links concepts). |
| Q20 | KOI sensor | **Backlogged** (`candidate-integration`) — no koi-net coordinator exists to consume it. |

## Research findings that constrain the design

- **KOI-net is not AT Proto-compatible at any layer** (wire, identity, schema). Complementary: KOI does consent-based pairwise edges; AT Proto does public broadcast. Only overlap: any AT-URI is a valid RID. `regen-koi-mcp` is a search/RAG surface over GAIA's Postgres, not a spec-conformant koi-net node.
- **"GRC-20 IDs are valid DIDs / Geo ontologies are valid AT Proto vocabularies" is unverified.** The GRC-20 spec references IPFS + Aragon spaces only. Open question for Rather; nothing here depends on it.
- **Open Haven** exposes a static, read-only, unauthenticated JSON API (`/api/protocols.json`, `/api/affordances.json`, `/api/domains.json`, `/api/entity-types.json`, `/api/attribute-defs.json`, discovery at `/api/index.json`) — 15 entity types, 107 attributes, 43 affordances, 10 domains; "human-verified, transparently-sourced, contributor-attributed." Rather meets Brandon (Open Haven) next month.
- **AT Proto constraints:** repos public-by-default (Spaces alpha not for production); 1 MB per record, 200 ops per commit, no floats; Lexicon evolution additive-only; one domain per NSID authority; PLC directory Bluesky-operated.
- **Framework facts:** `maturity` top value is `pattern-generating`; `canonical` is a legacy crosswalk only. Objects have no `id`; identity is `slugify(title)` and `util.mjs` flags the collision surface. `.well-known/knowledge.json` exists as an empty DAOstar `KnowledgeManifest` with `exchange.published_domains / subscribed_domains`. `data/kb/context.jsonld` declares `@vocab: https://regen-commons.org/ns/`, a domain nobody controls (backlogged). `publish` is unused in the codebase; `sync.push` is a stub.

## Architecture

```
 EDITORIAL PLANE  (git/yaml, per instance — unchanged)
   data/kb/<type>.yaml · maturity axis · public_use axis · csis-review
                          │
                          │  publish  (public_use ∈ publishable set ∧ type ∈ PUBLISHABLE_TYPES)
                          ▼
 PUBLICATION PLANE  (two targets, one manifest)
   ┌ AT Proto repo:  did:plc:<instance> → PDS → at://did/xyz.regencoordination.kb.<type>/<id>
   └ Static surface: public/api/<type>.json · public/api/<type>/<id>.json · public/.well-known/knowledge.json
                          │
                          │  listRecords (cursor = repo rev)  |  static-json (cursor = content hash)
                          ▼
 FEDERATION PLANE  (everything lands raw, re-enters review)
   atproto connector (peers) · static-json connector (Open Haven, …) → runConnector → review_queue
```

### Identity

- One `did:plc` per instance; handle = the instance's commons hostname. DID document lists the PDS and signing key. Dev identity is a separate `did:plc` whose repo is wiped before first real publish.
- Contributor attribution stays in `steward` / `contributors` fields.
- `rkey = id` (UUIDv4, fits the rkey charset). Minted by the origin at first publish and written back into the yaml, so git holds it. `sameStoredObject` already prefers `id`.

### Schema

- `PUBLISHABLE_TYPES` (framework constant): the 12 types in Q11.
- `PUBLISHABLE_PUBLIC_USE` (framework constant): the 4 values in Q9.
- NSID = `xyz.regencoordination.kb.<camelCaseType>`; the authority is a generator parameter (`kms.yaml.atproto.nsid_authority`).
- Support schemas (`frontmatter`, `provenance`, `review-maturity`, `relationships`) become shared `defs` inside generated Lexicons, not collections.
- Frontmatter schema gains optional `id`; each publishable schema gains optional `grc20Id`, `sourceUri` (origin AT-URI), `viaUri` (immediate peer, optional). The generator refuses float fields.
- Cross-references: on publish, a slug that resolves to a published object (per manifest) is rewritten to that object's origin AT-URI; otherwise left as is.

### What does not change

`repo-data` / `kb-folder` adapters; the review pipeline; `federate.mjs` draft-and-present for external comms; `kb-graph/` generation; every private registry; `context.jsonld` (backlogged).

## Components

Contract framework-side, drivers in org-os-kms (July spec placement rule).

```
toolkit-framework/                                  (portable)
  src/storage.mjs            existing — adapter registry gains 'atproto'
  src/connector.mjs          NEW (specced 2026-07-19, unbuilt) — contract + runConnector
  src/lexicon.mjs            NEW — schema.yaml → Lexicon JSON + validate(record, nsid)
  src/publishable.mjs        NEW — PUBLISHABLE_TYPES, PUBLISHABLE_PUBLIC_USE, isPublishable(object)
  lexicons/                  NEW — generated xyz.regencoordination.kb.*.json (committed, drift-tested)
  schemas/frontmatter.yaml   +id (optional)
  schemas/<publishable>.yaml +grc20Id / sourceUri / viaUri (optional)

org-os-kms/
  src/atproto/
    client.mjs               NEW — XRPC: createSession, putRecord, deleteRecord, listRecords
    storage.mjs              NEW — 'atproto' storage adapter
    connector.mjs            NEW — 'atproto' connector (describe/pull/map); replaces the July stub
  src/static/
    surface.mjs              NEW — writes public/api/**, public/.well-known/knowledge.json from the manifest
  src/connectors/static-json/
    index.mjs                NEW — 'static-json' connector: fetch + discovery + content-hash cursor
    openhaven.mjs            NEW — pure mapper: entity→resource, affordance→signal, domain→track
  src/ops.mjs                +op publish  +op ingest.pull
  src/bind.mjs               +LIFECYCLE_BINDINGS.close =
                               [ingest.pull, csis-review, bridge, emit-contributions, federate.check,
                                index.rebuild, render.site, render.dashboard, publish, sync.push]
  data/kms-published.json    NEW per instance — manifest {id → {rkey, cid, atUri, publishedAt, slug}}
```

### `kms.yaml` additions

```yaml
atproto:
  did: did:plc:…                        # instance identity
  handle: kc.regencoordination.xyz
  pds: https://pds.regencoordination.xyz
  nsid_authority: xyz.regencoordination.kb
geo:
  parent_space: bd727a6ad6ec4a058f681ea9002a1fbf
  space: null
connectors:
  - name: atproto
    config: { peers: [did:plc:…] }      # refi-dao-os, handle knowledge.refidao.com
    cursor: null                        # {did: rev}, opaque
  - name: static-json
    config: { base_url: https://www.openhaven.net, index: /api/index.json, mapper: openhaven }
    cursor: null                        # content hash of index, opaque
```

Credentials (`ATPROTO_APP_PASSWORD` / OAuth token) live in `.env`, never in `kms.yaml`.

### Contracts

**`publishable.mjs`** — pure. `isPublishable(object) → boolean` = type ∈ `PUBLISHABLE_TYPES` ∧ `public_use` ∈ `PUBLISHABLE_PUBLIC_USE`. Single definition; the op, the static surface, and tests all use it.

**`lexicon.mjs`** — pure. `generate(schemaYaml, {nsidAuthority}) → LexiconDoc`; `validate(object, nsid) → {ok, errors[]}`. Yaml→Lexicon type table; dates → `string` + `format: datetime`; float → error.

**`atproto/storage.mjs`** — the existing 5-method contract. `store` = `putRecord`; `list` = `listRecords` paged; `update` = `putRecord` with `swapRecord`; `index`/`writeIndex` = no-op (documented). Dumb: no gate logic.

**`atproto/connector.mjs`** — July `Connector` contract. `describe()` → source-system card `{type: 'knowledge-garden', endpoint: pds, did}`; `pull` → `listRecords` per peer per publishable collection since `cursor[did]`; `map(record)` → `[{schema, object}]` by NSID, sets `sourceUri` (origin — copied from the record if present, else the record's own AT-URI), `viaUri` (peer), `maturity: raw`; returns `[]` when the origin DID is mine or the NSID is unknown. `capabilities: {ingest: true, subscribe: false, publish: false}`.

**`connectors/static-json/index.mjs`** — `describe()` → source-system card `{type: 'dataset', endpoint: base_url}`; `pull` → GET index, GET each listed collection, cursor = sha256 of the index body (skip if unchanged); `map` delegates to the configured mapper module. **`openhaven.mjs`** — pure; fixture-tested against a saved copy of Open Haven's index + one entry per collection.

**`static/surface.mjs`** — pure over (manifest, objects). Emits `public/api/<type>.json` (all), `public/api/<type>/<id>.json` (one), each with `"@context": "/kb/context.jsonld"`, `atUri`, `cid`; and `public/.well-known/knowledge.json` filled from the manifest (`exchange.published_domains` = collections; `subscribed_domains` = peer DIDs + static sources; `sources` = source-system cards; `geo` block). Also copies root `.well-known/*.json`.

**`publish` op** — `kind: 'exec'`, `write: true` (fail-hard), targets `[atproto, static]`.
1. Select objects with `isPublishable`. Mint `id` (and `grc20Id` if absent) for any that lack one; write back to yaml.
2. Rewrite resolvable cross-references to origin AT-URIs (per manifest).
3. Validate **every** selected object against its Lexicon before the first network call; any failure aborts with per-field errors.
4. AT Proto target: for each object, `cid = dagCbor(object)`; skip if unchanged; `putRecord` with `swapRecord: manifest[id]?.cid`. For each manifest entry no longer publishable: `deleteRecord`, drop from manifest.
5. Static target: regenerate `public/api/**` and `public/.well-known/` from the manifest. No network; cannot fail on the PDS.
6. Write `data/kms-published.json`; `sync.push` commits it and the yaml write-backs.
7. `--dry` prints create/update/delete/skip per target, writes nothing. Missing `kms.yaml.atproto` or credentials → AT Proto target reports `not configured` and is skipped; static target still runs.

### Sequencing on `close`

`ingest.pull` first; `publish` after `render.site` (the static surface is part of the site) and before `sync.push`. `initialize` stays read-only.

## Data flow

### Pull cycle

`runConnector`: `describe → pull → map → ingest(raw) → store → review_queue`; cursor advanced only after a successful store.

Merge rules:
- Peer `delete` op → review-flagged retraction, never a local delete.
- Incoming object whose origin URI matches a local object → upsert by origin.
- Incoming object with a *different* origin but a colliding slug → suffixed slug + review flag.
- Incoming object whose origin DID is mine → skipped in `map`.

### Republish

Reviewing a pulled object to a publishable `public_use` value makes it publish from this instance too: same `grc20Id`, same `sourceUri` (origin), new `id` (this record), new AT-URI. Peers dedupe by origin.

## Error handling

- `publish` and `ingest.pull` are `write: true` → fail-hard, per executor policy; structured per-target / per-peer reports.
- PDS unreachable on publish → AT Proto target fails, manifest untouched for that target; static target already ran; next `close` retries the same diff.
- PDS unreachable on pull → that peer reported and skipped; others continue.
- Validation failure → abort before the first write, per-field errors.
- Record > 1 MB → validate-time error naming the field. No blobs this pass.
- `swapRecord` conflict → that record fails with the remote CID in the report; operator resolves. No automatic overwrite.
- Static-json index unchanged (hash match) → `pull` returns `{records: [], cursor}`; not an error.

## Testing

Network-free except one opt-in e2e.

- **`publishable.mjs`:** table test over every (type, public_use) pair.
- **`lexicon.mjs`:** generate from the 12 publishable schemas → snapshot-compare to committed `lexicons/`; drift test; every publishable fixture object validates; float field → error.
- **`publish` op + `atproto/storage.mjs`:** fake XRPC client; assert id/grc20Id minting + yaml write-back, cross-ref rewriting, diff-only writes, `swapRecord` on update, `deleteRecord` on demotion, manifest write-back, abort-before-first-write on validation failure, `not configured` skip with static still running, `--dry` writes nothing.
- **`static/surface.mjs`:** golden files for `api/` layout + `knowledge.json`; `@context` present; copies root `.well-known/`.
- **`atproto/connector.mjs`:** pure `map` per NSID; own-origin skip; `runConnector` with fake connector for cursor, retraction, collision, republish-dedupe.
- **`static-json` + `openhaven.mjs`:** `map` against saved Open Haven fixtures; hash-cursor skip.
- **e2e (opt-in, `ATPROTO_E2E=1`):** publish to a local `@atproto/pds` dev container from one instance config, pull from a second; byte-equal after round-trip.
- **Baseline:** existing 65 org-os-kms tests stay green.

## Proving ground

- **Publisher:** regen-toolkit (this instance), dev identity first.
- **First peer / puller:** refi-dao-os (104 typed entries; handle `knowledge.refidao.com`). Success = its `close` pulls this instance's published objects into its review queue without disturbing its existing entries.
- **First static source:** Open Haven — its entities land as `resource` candidates in this instance's review queue.
- **Cold start:** org-os canonical (empty scaffold) pulls from regen-toolkit.

## Non-goals this pass

Spaces / private repos; labelers; feed generators; our own AppView (we use `listRecords` per peer); contributor DIDs; Geo write-side; blobs; real `publish` capability on connectors (contribute-back to *other* orgs' repos stays draft-and-present); KOI sensor (backlogged); Notion / Synthefy / Radicle connectors; `context.jsonld` authority fix (backlogged).

## Open questions (external, not blocking)

1. **Neutral NSID authority** — KC-group decision; migration path known.
2. **Council validation of `kc.regencoordination.xyz`** as the handle — gates first *real* publish, not development.
3. **GRC-20 ↔ AT Proto claim** — ask Rather.
4. **Regen KC Geo space ID** — fill `kms.yaml.geo.space` when Rather bootstraps it.
