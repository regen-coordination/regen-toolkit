# @regen-commons/toolkit-framework

The **Regen Knowledge Commons Toolkit framework** — a portable, **org-os-agnostic** system for building a federated, interoperable knowledge commons. It is the *operational distillation* of the [master doc](../../docs/MASTER.md): **adopt the package, not the 30,000-line doc.**

> **Status: v0.1.0-beta.1 — try-able beta.** Semantic kernel + 25 schemas + compatibility engine + 7 agentic skills + lift ETL + **the machine** (`init`/`ingest`/`store`/`kb`/`review`/`federate` — replicate → ingest → store → review → federate, end to end) + full architecture/process docs, now with a knowledge base ([`docs/`](docs/README.md)), one validating [`examples/`](examples/) instance per object-schema, Appendix A–H instance [`templates/`](templates/instance/), and a gaps register ([`docs/meta/GAPS.md`](docs/meta/GAPS.md)). Tests green (167/167). Grows dialectically through adoption (first: ReFi DAO). Design: [`docs/meta/`](docs/meta/) · [build plan](../../docs/plans/framework-build/README.md).

## Why it exists

A federated network of knowledge commons that can be **forked and adapted** but stay **interoperable** (compatible ontologies, shared base guidelines) — "interoperability without forced uniformity." This package is the shared base every instance (ReFi Web3 Toolkit, ReFi DAO, ReFi BCN, …) adopts. org-os is *one* (replaceable) host via `org-os-kms`; the framework itself needs **no build step and no org-os** — schemas are YAML, skills are markdown, the validator is runnable `.mjs`.

## Install / use

Zero-build. Requires `js-yaml`.

```bash
node src/cli.mjs list-schemas
node src/cli.mjs check-state maturity reviewed         # validate against the canonical state model
node src/cli.mjs validate source-system my-card.yaml   # validate an object against a schema
npm test                                               # node --test
```

**New here? Start with the [knowledge base](docs/README.md)** → [`GETTING-STARTED`](docs/GETTING-STARTED.md) · [`WORKED-EXAMPLE`](docs/WORKED-EXAMPLE.md) · [`GLOSSARY`](docs/GLOSSARY.md).

Programmatic:

```js
import { loadSchema, isValid, validateObject } from '@regen-commons/toolkit-framework';

isValid('maturity', 'reviewed');           // true  (K1 canonical state model)
isValid('maturity', 'canonical');          // false (old vocab, deliberately rejected — see RECONCILIATIONS R1)
validateObject('source-system', card);     // { valid, errors }
```

## The machine (0.2)

The framework isn't just schemas + a validator anymore — it's a working
pipeline from a raw source to a federated, reviewed knowledge base:

```
source (file/dir)
   │  ingest prepare
   ▼
work orders (.workorders/*.yaml, open)
   │  ingest claim → agent fulfills (writes candidates/*.yaml)
   ▼
ingest accept  ──✗──► error_notes (fix candidates, retry)
   │ ✓
   ▼
accepted/*.yaml
   │  store --adapter <kb-folder|repo-data|geo>
   ▼
kb-folder / repo-data / geo  ──►  objects/** (or data/kb/**)
   │  kb index · review list
   ▼
review queue (raw · ai_assisted)  ──review promote --reviewer──►  reviewed
   │
   ▼
index.json + context.jsonld  (derived, rebuildable)
```

**CLI verbs** (`node src/cli.mjs <verb>`):

| verb | what it does |
|---|---|
| `init [dir] [--existing <path>] [--name] [--adapter]` | replicate: stamp `kms.yaml` + `.workorders/` + a storage target with the instance's own self source-system card; `--existing <path>` also scans it into work orders |
| `ingest prepare <path> [--dir]` | scan a source (file or dir) → idempotent work orders |
| `ingest list [--status] [--dir]` | list work orders, optionally filtered by status |
| `ingest claim \| fulfill <wo-id> [--by] [--dir]` | drive the work-order lifecycle (agent side) |
| `ingest accept <wo-id> [--dir]` | the accept gate — validates every candidate; atomic; rejects write `error_notes` |
| `store [--adapter] [--target]` | write every accepted-but-unproduced object via a storage adapter; rebuilds the index |
| `kb index [--adapter] [--target]` | print the derived KB index (`total`, `by_type`, `by_maturity`, `review_queue`) |
| `review list [--adapter] [--target]` | show the human-review queue (raw · ai_assisted) |
| `review promote <ref> --maturity <v> [--reviewer]` | promote/demote K1 maturity; reviewer required past `raw`; validated before write |
| `federate add <peer-card.yaml>` | register a peer KB (its source-system card) — cannot clobber the self card |
| `federate check <peer-extensions.yaml>` | K4 fork-compatibility check over a peer's ontology extensions → `N/M` compatible |
| `list-schemas` | list available schemas |
| `check-state <axis> <value>` | validate a value against the K1 canonical state model |
| `kernel-check` | verify the semantic kernel is internally consistent |
| `context` | emit the JSON-LD `@context` generated from the kernel |
| `validate <schema> <file>` | validate an object file against a schema |
| `lift <crosswalk.csv>` | crosswalk-driven CSV → resources YAML (raw leads never auto-promoted) |
| `version` | print the package version |

**Three seams keep the pieces swappable and honest:**
1. **skill ↔ CLI = work orders.** Agents (the skills in `skills/`) only ever
   produce candidate objects in `.workorders/<id>/candidates/`; only the CLI's
   accept gate validates and only the CLI writes. Agents never write storage.
2. **ingestion ↔ storage = adapters.** `store`/`kb`/`review` all go through
   one adapter interface (`kb-folder` · `repo-data` · `geo` stub) — ingestion
   logic never knows or cares which target it's writing to.
3. **data ↔ site = derived index.** `index.json` + `context.jsonld` are
   rebuilt from the objects on disk by every adapter — never hand-authored,
   always regenerable, the only thing a front end needs to read.

Full walkthrough with real output at every step: [`docs/GETTING-STARTED.md`](docs/GETTING-STARTED.md).

## What's here (the keystones)

**Shared schemas** (`schemas/`) — the keystones every entry type builds on:
- **`review-maturity`** (K1) — the canonical state model: three orthogonal axes (`maturity` · `public_use` · `lifecycle_state`) + `ai_assisted`/`high_risk` flags + crosswalks. *Resolves the master doc's ~7 conflicting maturity ladders.*
- **`frontmatter`** (K3) — the metadata base every entry `extends`.
- **`source-system`** (K2) — the **federation primitive** (the `return_path` field = the contribute-back / reciprocity hook). Source systems are peers, not extractable link pools.
- **`contribution-record`** (K5) — durable contribution attestation (the `source_system_reciprocity` hook for federated contribute-back).
- `signal` · `provenance` · `public-use-boundary` — the cross-cutting supporting schemas.

**Validator + CLI** (`src/`) — schema loading, object validation (with `extends` inheritance + K1-axis enforcement), and a zero-dep CLI.

## What's built (full)

- **Semantic kernel** — `core-entities` (15 frozen Layer-A) + `extension-entities` (31, each `maps_to_core`) + `relationships` (unified, CSIS separable) + `kernel-profile` (MOK-5) + JSON-LD `context` generator + fork-compatibility validator.
- **10 layer schemas** — resource · option-entry · track · deployment · implementation-record · claim-evidence · evolution-record · concept-lineage · encyclopedia-entry · update-proposal.
- **Compatibility engine** (`src/compatibility.mjs`) + **invariants** (`src/invariants.mjs`) + **lift ETL** (`src/lift.mjs`, CLI `lift`).
- **The machine** — `init`/`ingest`/`store`/`kb`/`review`/`federate` (`src/instance.mjs`, `src/ingest.mjs`, `src/workorder.mjs`, `src/storage.mjs` + `src/adapters/`, `src/review.mjs`) — see [The machine (0.2)](#the-machine-02) above.
- **7 agentic skills** — `register-source`, `map-ontology`, `capture-and-route`, `ingest`, `compose-journey`, `csis-review`, `review-promote`.
- **Docs** — `architecture/` (layers, operating-loop, kernel-objects, problems-ToC, invariants, ontology-posture, fork-compatibility, type-tag-discipline), `process/` (8: principles, review, contribution, csis-safeguards, federation, roles, evolution-loop, ontology-change-process), `site/journey-model.md`.

## Next — the dialectic (not framework-building)

First adoption: **ReFi DAO** (via `@org-os/kms` profile) — process podcasts/blog, contribute back → framework v0.1.x. Then ReFi BCN + network.

## Design note

This package deliberately uses **zero-build ESM + YAML + markdown** (not the repo's TypeScript convention) so it is adoptable in any context by cloning — no compile. See [`docs/meta/PLACEMENT.md`](docs/meta/PLACEMENT.md).
