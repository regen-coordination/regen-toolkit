# Plan — Master Doc Iteration (May 15, 2026)

**Status:** closed — absorbed (2026-07-19)
**Created:** 2026-05-15

> **CLOSED 2026-07-19 — remaining phases absorbed.** Phases A–D shipped long since. The open
> remainder is now delivered or superseded by the July arc:
> **Phase E (structured refactor)** → superseded — the framework machine reprocessed the whole corpus
> (`framework-validation-pass`, 722 objects; ontology/option-library/resources now live as typed KB +
> the T4 schemas), and the master doc itself has iterated twice since (2026-06-15, July handoff).
> **Phase F (repo dev infrastructure)** → delivered — dev→prod pipeline live (`regen-toolkit-os` dev /
> `main` prod), publish pipeline designed, migration asks with Heenal.
> **Phase G (site IA)** → carried by [`dev-instance-build.md`](dev-instance-build.md) (the framework-rendered
> site IS the new IA). Master-doc integration work continues in [`handoff-integration.md`](handoff-integration.md).
**Supersedes:** [`master-doc-iteration-may-2026.md`](master-doc-iteration-may-2026.md) Phase 3 (Phase 1 + Phase 2 reconciliation work carries forward — see §6 below)
**Trigger:** Matty's 2026-05-15 Telegram message + new master-doc revision: ["OK ALL YOU LUIZ"](https://docs.google.com/document/d/1LPLqR51zUvvUDRFm8OqYNBj1LuWkrV-lCFH0YZCvBqg/edit?usp=sharing) ("done with this last pass. work your magic. blegh realized a lot was lost from the previous iteration. Still reworking it but feel free to run with what's in there and maybe cross reference the last doc too.")

## Context

A second master-doc iteration in 9 days. The 2026-05-06 iteration ("Regen Knowledge Commons Toolkit", ~13,737 lines) recently displaced the 2026-04-23 iteration ("Regen Web3 Toolkit", ~7,500 lines). Now a 2026-05-15 **stabilization draft** lands at **~24,776 lines** (1.8× the 2026-05-06 doc). The new iteration explicitly recovers content lost in the 2026-05-06 pass — most notably the **Tracks layer**, which was dropped on 2026-05-06 and is back as Layer 7 ("Tracks & Composition") with 10 fully-defined track candidates.

Full diff: [`docs/MASTER-DOC-CHANGES-2026-05-15.md`](../MASTER-DOC-CHANGES-2026-05-15.md).

**Operator brief (from Matty + the operator's instruction):**
1. Run with what's in the doc; cross-reference the prior iteration where the new one is thin.
2. **The different layers should be a/the key aspect** — each one documented properly from the doc.
3. **Prepare an Obsidian canvas for each layer.**
4. Repo prepared for development against the new iteration.

This plan operationalizes (2)–(4) and re-sequences the rest of the May refactor work against the new structure.

## Goal

Make the overlay repo coherent with the 2026-05-15 master doc as a working development substrate, with:

- A per-layer doc per layer (10 files, `docs/layers/`)
- A per-layer Obsidian canvas per layer (10 files, `docs/canvases/layers/`)
- A master-overview canvas connecting all 10 layers + cross-cutting principles + Minimum Operating Kernel + Core Movement
- The Phase 3 structured refactor unblocked and partially executed (Phase 2 reconciliation items carried forward as `data/` work)
- Backlog routing for §16 of the master doc (gaps, open questions, design seeds, frame language audit)

## Architecture summary (new iteration)

| Layer | Name | Core question |
|---|---|---|
| 1 | Ontology & Semantic Kernel | What kinds of things exist, and how do they relate? |
| 2 | Knowledge Commons / Encyclopedia | What does this mean? |
| 3 | Resource Graph & Ecosystem Atlas | What exists in the world? |
| 4 | Concept & Idea Ecology | Where did these ideas come from, and how do they relate? |
| 5 | Option Library | What reusable choices are available? |
| 6 | Deployment & Structural Integrity | What must be explicit before something is used in practice? |
| 7 | Tracks & Composition | What pathway should someone follow for a specific context? |
| 8 | Implementation & Learning Memory | What actually happened? |
| 9 | Evolution Layer | How does the commons update itself? |
| 10 | Infrastructure & Substrate | What tools and technical foundations can support this? |

**Core sequence:** Ontology → Knowledge → Resources → Options → Deployment → Tracks → Implementation → Evolution + Infrastructure as ground.
**Core movement:** Discover → Understand → Connect → Compose → Specify → Implement → Learn → Evolve.
**Minimum Operating Kernel (v0.1):** Resource, Concept, Option, Deployment, Signal — 5 objects, enough for one useful contribution without grasping the whole architecture.
**18 cross-cutting principles** (new §4) — provenance, attribution, maturity, public-use boundaries, claim-evidence discipline, regenerative obligation, pattern humility, anti-extractive synthesis, living-systems health, compost/archive/memory, etc.

## Tasks

### Phase A — Save + archive (DONE 2026-05-15)

- [x] Save 2026-05-06 iteration to `docs/archive/MASTER-2026-05-06-knowledge-commons-toolkit.md`
- [x] Save 2026-05-15 iteration to canonical `docs/MASTER.md` (+ keep raw fetched copy at `docs/MASTER-2026-05-15-stabilization-draft.txt`)
- [x] Write `docs/MASTER-DOC-CHANGES-2026-05-15.md` iteration diff
- [x] Write this plan (`docs/plans/master-doc-iteration-may-15-2026.md`)

### Phase B — Per-layer documentation (`docs/layers/`)

One doc per layer; consistent structure across all 10. Each doc is the operator-and-team-facing read of the layer — terse, structured, links into the master doc and the layer canvas. Target: 200–500 lines per layer doc.

Per-layer template (each doc has these sections):

1. **Frontmatter** — `layer:`, `name:`, `master_doc_section:`, `lines:`, `canvas:`, `status: stabilization-draft`
2. **Purpose** — 2-3 sentences, lifted verbatim from master doc's layer intro
3. **Core question(s)** — bulleted list from the master doc's layer subsection
4. **Function** — what this layer is for; what it explicitly is NOT (boundary rules from master doc)
5. **Relations to adjacent layers** — table or list, drawn from master doc's "Layer relations" subsection where present
6. **Subsections** — list of master-doc subsections under this layer, with one-line summaries + line ranges
7. **Templates / Entry types** — lifted verbatim from master doc where they exist (e.g., concept page template, option entry template, deployment entry template)
8. **v0.1 recommendation** — lifted verbatim from master doc's "Practical v0.1 recommendation" subsection
9. **Minimum rule for this layer** — lifted verbatim
10. **Layer ownership** — current overlay owner (from `IDENTITY.md`), with reconciliation flag if Phase 2 ownership is unresolved
11. **Open questions** — extracted from master doc's "Open questions" / "Frontier" subsections
12. **Cross-references** — links to the layer canvas, related layer docs, related data files (`data/ontology/`, `data/option-library.yaml`, etc.), related skills, related plans
13. **Status & next** — current overlay state, what needs to happen next

- [ ] **Layer 1 — Ontology & Semantic Kernel** → `docs/layers/01-ontology-and-semantic-kernel.md`
- [ ] **Layer 2 — Knowledge Commons / Encyclopedia** → `docs/layers/02-knowledge-commons-encyclopedia.md`
- [ ] **Layer 3 — Resource Graph & Ecosystem Atlas** → `docs/layers/03-resource-graph-and-ecosystem-atlas.md`
- [ ] **Layer 4 — Concept & Idea Ecology** → `docs/layers/04-concept-and-idea-ecology.md`
- [ ] **Layer 5 — Option Library** → `docs/layers/05-option-library.md`
- [ ] **Layer 6 — Deployment & Structural Integrity** → `docs/layers/06-deployment-and-structural-integrity.md`
- [ ] **Layer 7 — Tracks & Composition** → `docs/layers/07-tracks-and-composition.md`
- [ ] **Layer 8 — Implementation & Learning Memory** → `docs/layers/08-implementation-and-learning-memory.md`
- [ ] **Layer 9 — Evolution Layer** → `docs/layers/09-evolution-layer.md`
- [ ] **Layer 10 — Infrastructure & Substrate** → `docs/layers/10-infrastructure-and-substrate.md`
- [ ] **`docs/layers/README.md`** — index page, restates the layer set + core movement + minimum kernel + boundary rules; entry point for the team

### Phase C — Per-layer Obsidian canvases (`docs/canvases/layers/`)

One canvas per layer. The canvas is the **visual architecture map** the operator committed to at the 2026-05-07 biweekly (Barcelona bioregional garden pattern). Sharing limitation acknowledged (requires local Obsidian); web-based canvas remains exploratory carryover from 260212.

Per-layer canvas structure (each `.canvas` JSON file has roughly these nodes):

- **Center node** — Layer N name + core question + one-sentence purpose (text node)
- **Function node** — what the layer is FOR (text)
- **NOT this layer** — boundary rules (text, contrasting color)
- **Layer doc** — file link to `docs/layers/NN-name.md` (file node)
- **Master doc anchor** — text node referencing `docs/MASTER.md` line range
- **Subsection nodes** — 4–8 nodes, one per major subsection (e.g., for Layer 5 Option Library: Governance Options, Coordination Options, Org Structure Options, Funding Options, Token/Incentive Options, Knowledge Options, Impact Options, Implementation Options, Experimentation Options)
- **Template nodes** — file links to relevant entry templates where they exist
- **Adjacent layer references** — text or file links pointing into other layer canvases
- **Cross-cutting principle attachments** — small text nodes naming which of the 18 cross-cutting principles apply most directly
- **Data file references** — file links to relevant `data/*.yaml` (e.g., Layer 1 ↔ `data/ontology/`; Layer 5 ↔ `data/option-library.yaml`; Layer 3 ↔ `data/resources.yaml`; Layer 8 ↔ `data/feedback-process.yaml`)

Color palette (Obsidian's 6-color system):
- **1 (red)** — Layer name / center
- **2 (orange)** — Boundary rules / what this layer is NOT
- **3 (yellow)** — Adjacent layer references
- **4 (green)** — Templates + v0.1 recommendation
- **5 (blue)** — Subsections / categories
- **6 (purple)** — Cross-cutting principle attachments

Files:

- [ ] `docs/canvases/layers/01-ontology.canvas`
- [ ] `docs/canvases/layers/02-encyclopedia.canvas`
- [ ] `docs/canvases/layers/03-resource-graph.canvas`
- [ ] `docs/canvases/layers/04-concept-ecology.canvas`
- [ ] `docs/canvases/layers/05-option-library.canvas`
- [ ] `docs/canvases/layers/06-deployment.canvas`
- [ ] `docs/canvases/layers/07-tracks.canvas`
- [ ] `docs/canvases/layers/08-implementation-memory.canvas`
- [ ] `docs/canvases/layers/09-evolution.canvas`
- [ ] `docs/canvases/layers/10-infrastructure.canvas`

### Phase D — Master-overview canvas

A single canvas at `docs/canvases/regen-knowledge-commons-toolkit-master.canvas` (replacing or sitting alongside the existing 260212 `regen-toolkit-master.canvas` which is now outdated). Shows:

- The 10 layers in their canonical order (column on left or radial around a center)
- The **Core movement** (Discover → Understand → Connect → Compose → Specify → Implement → Learn → Evolve) as a band/edge sequence
- The **Minimum Operating Kernel** (5 objects) at one side
- The **18 Cross-Cutting Principles** as floating attachments
- File links to each layer canvas + each layer doc
- A reference link to `docs/MASTER.md`

- [ ] `docs/canvases/regen-knowledge-commons-toolkit-master.canvas`

The existing four `docs/canvases/*.canvas` files (architecture, content-structure, dev-workflow, master) from the 260212 era are **left in place** — they were already flagged for update in HEARTBEAT. They remain as historic reference; the new master canvas is the live one. Consider archiving them to `docs/canvases/archive/` after the new canvas is reviewed.

### Phase E — Structured refactor (Phase 3 from May 6 plan, against the new iteration)

This is the work that was deferred post-Pulse-1. Pulse 1 just happened (2026-05-09–10) and a new iteration just landed. So the refactor target is the 2026-05-15 doc, not 2026-05-06.

#### E.1 — `data/ontology/*.yaml`

The new master doc enumerates ontology with a different posture than 2026-05-06:
- **5-object Minimum Operating Kernel** as v0.1 (Resource, Concept, Option, Deployment, Signal) — `data/ontology/kernel.yaml` (new)
- **Core entity type candidates** (§5.7, lines 3249–4179) — the longer list of ~25 types, but now framed as candidates, not commitments. Map to existing `data/ontology/*.yaml`.
- **Relationship grammar** (§5.8, lines 4179–4326) — subject/predicate/object pattern. Map to a `data/ontology/relationships.yaml` (already exists; reconcile).
- **Classification layers** (§5.10, lines 4356–4607) — distinguish entity types from tags from metadata. Reconcile against the existing 4 ontology yamls.
- **Two-layer ontology posture** (§5.5, lines 2994–3091) — interoperable Octo/BKC core + Toolkit-specific extensions. **Decision needed:** which fields go in which layer? Coordinate with Matt + Rather.

- [ ] Read existing `data/ontology/*.yaml` against new §5 structure
- [ ] Draft `data/ontology/kernel.yaml` (5 objects)
- [ ] Reconcile `data/ontology/relationships.yaml` against new §5.8 relationship grammar
- [ ] Decide on two-layer posture for each entity type (sync with Matt + Rather async — possibly at ~2026-05-21 biweekly)

#### E.2 — `data/option-library.yaml`

New master doc enumerates **9 option categories** (§9.4, lines 12410–13712):
1. Governance Options
2. Coordination Options
3. Organizational Structure Options
4. Funding and Capital Options
5. Token and Incentive Options
6. Knowledge and Documentation Options
7. Impact and Measurement Options
8. Implementation and Operations Options
9. Experimentation Options

Existing `data/option-library.yaml` also has 9 categories (the 2026-05-06 iteration kept the 9-category scaffold). **The Tool / Option / Pattern / Protocol / Deployment / Case 6-tier vocabulary** from 2026-05-06 is reframed as Option vs Deployment vs Implementation vs Pattern in §3.21 (Boundary Matrix) and §4.11 (Type/tag discipline). **The 6-tier was a slip; the new doc is back to a simpler tier set.** This is good news: less refactor.

- [ ] Cross-walk `data/option-library.yaml` 9 categories ↔ new §9.4 9 categories (likely 1:1; verify naming)
- [ ] Add `option entry template` (§9.5, lines 12277–12319) as schema reference
- [ ] Add `option maturity` states (§9.6, lines 12319–12350) to existing entries

#### E.3 — `data/feedback-process.yaml` (Implementation Memory + Evolution split)

The 2026-05-06 iteration split these layers. The 2026-05-15 iteration **keeps the split** (Layer 8 Implementation & Learning Memory; Layer 9 Evolution Layer). Existing `data/feedback-process.yaml` covers Evolution-style state machine but pre-dates the split.

- [ ] Read existing `data/feedback-process.yaml`
- [ ] Decide whether to split into two yamls (`data/implementation-memory.yaml` + `data/evolution.yaml`) or keep one yaml with two sections
- [ ] Add **Bonfires substrate reference** to Implementation Memory (per 2026-05-07 biweekly decision — co-author with Koi)
- [ ] Map new master doc's signal-type taxonomy (§13.4, lines 19274–19577) — 10 signal types — to the schema

#### E.4 — `data/resources.yaml` re-lift

The 2026-04-26 mechanical lift extracted 738 entries from the 2026-04-23 master doc lines 1089–2668. The 2026-05-06 iteration scrambled line numbers; the 2026-05-15 iteration scrambles them again. Resource Graph in the new doc is at §7, lines 6734–10348 (~3,615 lines) — different line range, possibly different sub-structure.

- [ ] Inspect `scripts/lift-resources.mjs` — currently hard-coded to line ranges in the 2026-04-23 doc. Refactor to take section headings as anchors instead of line numbers.
- [ ] Re-lift against new MASTER.md §7
- [ ] Diff against existing `data/resources.yaml` (738 entries); decide on overwrite vs merge
- [ ] **Brandon's curation pass** is still pending — gate on completion before publishing

#### E.5 — `docs/LAYERS.md` rewrite

Existing `docs/LAYERS.md` documents the 2026-05-06 8-layer structure. New iteration is 10 layers. Rewrite against new structure, **point each layer to its new layer doc and canvas**, refresh ownership table.

- [ ] Rewrite with new 10-layer structure
- [ ] Cross-link to `docs/layers/` + `docs/canvases/layers/`
- [ ] Refresh ownership table (carry forward Phase 2 reconciliation items)

#### E.6 — `IDENTITY.md` ownership refresh

Layer ownership has been pending since 2026-05-07 biweekly. New iteration confirms 10 layers; ownership table needs an explicit row per layer. Open questions:

- **Layer 2 (Encyclopedia) — Heenal** (no change; this was always Heenal's lead).
- **Layer 4 (Concept & Idea Ecology) — owner?** Likely Matt (lineage/paradigm/framework adjacency to ontology). Confirm at ~2026-05-21.
- **Layer 7 (Tracks & Composition) — Heenal** (returned; previously owned by Heenal pre-2026-05-06 drop).
- **Layer 8 (Implementation & Learning Memory) — Koi?** Per 2026-05-07 biweekly — Koi committed to Evolution research framework; Bonfires substrate is at L8.
- **Layer 9 (Evolution) — Koi?** Same as above.
- **Layer 10 (Infrastructure & Substrate) — Luiz** (default — operator role; coordination layer).

- [ ] Rewrite ownership table in `IDENTITY.md`
- [ ] Surface to team at ~2026-05-21 biweekly via the persona/skill-card format

#### E.7 — `docs/ORG-OS.md` one-pager

The 2026-04-26 one-pager describes the 8-layer 2026-04-23 model. Already stale after 2026-05-06. Now needs a fresh rewrite against the 2026-05-15 iteration — but keep it tight (operator one-pager, body <500 words).

- [ ] Rewrite one-pager body against 10-layer model
- [ ] Update banners (remove 2026-05-06 iteration-checkpoint banner, add 2026-05-15)

#### E.8 — Root-MD rename pass (deferred again?)

The 2026-05-06 plan committed to a single coherent commit renaming "Regen Web3 Toolkit" → "Regen Knowledge Commons Toolkit" across ~30 files. The new iteration **confirms** the rename. **Now is the time.**

- [ ] `MASTERPLAN.md`, `IDENTITY.md`, `MEMORY.md`, `SOUL.md`, `CLAUDE.md`, `AGENTS.md`, `TOOLS.md`, `USER.md`, `HEARTBEAT.md`, `dashboard.yaml`, `federation.yaml`, `package.json`, `README.md` (root + docs/) — single coherent commit
- [ ] Validate schemas + structure after rename
- [ ] Site config (`astro.config.mjs`) + visible site copy — separate consideration; site says "Regen Toolkit" / "Regen Web3 Toolkit" prominently. **Don't rename the live site without team confirmation.**

#### E.9 — Backlog routing (§16)

The new master doc's §16 (Backlog, Notes, Appendices & Future Design Seeds, lines 22954–24776) is ~1,820 lines of structured backlog. Includes:
- Backlog status labels (§16.1)
- Current known gaps (§16.2)
- Core template candidates (§16.3)
- Named Response Vocabulary (§16.4)
- Deployment Readiness Levels (§16.5)
- CSIS-informed design seeds (§16.6)
- Regenerative design seeds (§16.7)
- **Frame Language Audit (§16.8)** — Durgadas's framing critique now has explicit master-doc real estate
- Decision Rules v0.1 (§16.9)
- Research backlog (§16.10)
- Appendices to preserve (§16.11)
- Backlog routing table (§16.12)
- Backlog maintenance process (§16.13)
- **What to avoid in the next pass (§16.14)**
- Recommended next stabilization pass (§16.15)
- Suggested AI instruction (§16.16)

- [ ] Read §16 in full
- [ ] Cross-walk Frame Language Audit (§16.8) against existing `docs/CSIS.md` + Durgadas's pending companion doc — surface to Durgadas
- [ ] Read §16.14 "What to avoid" + §16.15 "Recommended next stabilization pass" + §16.16 "Suggested AI instruction" — these directly constrain our refactor moves; lift into the layer docs where applicable
- [ ] Extract `docs/BACKLOG.md` updates from §16.2 (Current known gaps) — existing BACKLOG.md is from the 2026-04-23 iteration

### Phase F — Repo development infrastructure

The operator's brief: "prepare the full plan for making the new iteration/integrating then the repo for development." This phase prepares the repo to be **developable against the new iteration**.

- [ ] **Update `scripts/lift-resources.mjs`** — anchor by section heading rather than line numbers (so future iterations don't break the lift). Add an `--archive-diff` flag that compares against the previous lift.
- [ ] **Add `scripts/lift-options.mjs`** — analogous lift for the Option Library §9 categories into `data/option-library.yaml`.
- [ ] **Add `scripts/lift-tracks.mjs`** — analogous lift for §11 Tracks into a new `data/tracks.yaml` (this didn't exist before because the layer was dropped on 2026-05-06).
- [ ] **Add `scripts/lift-concepts.mjs`** — analogous lift for §6.6 Core knowledge domains / §8 Concept & Idea Ecology clusters into `data/concepts.yaml` (new — replaces the implicit concept index that previously lived in `data/ontology/`).
- [ ] **Update `data/knowledge-manifest.yaml`** — currently empty / pre-iteration; should index the §6 14 knowledge domains.
- [ ] **Add `data/tracks.yaml`** — new registry. Schema mirrors §11.5 Track template (status, audience, prerequisites, concepts pulled, options pulled, deployment checks, suggested tools, common failures, maturity).
- [ ] **Update `package.json`** scripts — add `npm run lift:resources`, `lift:options`, `lift:tracks`, `lift:concepts`, `lift:all`.
- [ ] **Update `npm run knowledge`** — currently compiles KB + index + lint; refactor to also surface the new `data/tracks.yaml` + the `docs/layers/` index.

### Phase G — Site implications (deferred unless team confirms)

The live site at regen-toolkit-site.vercel.app is on the 67-article inventory + 5 learning paths from earlier iterations. The new doc's §6 (Encyclopedia, ~5,490 lines) has 14 core knowledge domains and ~254 article inventory hits the same general shape. The site's structure is roughly compatible, but the new layer-explicit framing should percolate into site IA over time.

**Out of scope for this plan** (separate follow-up):
- Site IA refactor against the 10-layer model
- Article ↔ layer mapping for the existing 67 published drafts
- Track-page templates on the site (now that Tracks is a layer)

Flagged here to be picked up at a later biweekly when site work is on the agenda again.

## Sequencing

### This week (2026-05-15 → 2026-05-21)

- **2026-05-15 (today):** Phases A + B + C + D execute (initial drafts of all per-layer docs + canvases + master canvas + overlay-doc updates).
- **2026-05-18 → 2026-05-21:** Phase E.5 (LAYERS.md rewrite) + E.7 (ORG-OS.md rewrite) + E.9 (backlog routing extracts).
- **2026-05-21 biweekly:** Persona/skill-card session. Surface the per-layer docs + canvases to the team. **Resolve layer ownership** against the new 10-layer model + new candidates (Koi for Implementation Memory + Evolution; Matt for Concept & Idea Ecology). Use the canvases as visual entry point.

### Following two weeks (2026-05-22 → 2026-06-05)

- **Phase E.1 — `data/ontology/`** refactor (sync with Matt + Rather)
- **Phase E.2 — `data/option-library.yaml`** cross-walk
- **Phase E.3 — `data/feedback-process.yaml`** split, with Bonfires substrate (sync with Koi)
- **Phase E.4 — `data/resources.yaml`** re-lift (gate on `scripts/lift-resources.mjs` refactor)
- **Phase E.6 — IDENTITY.md** ownership refresh (post-2026-05-21)
- **Phase E.8 — Root-MD rename pass** (single coherent commit)

### Hackathon mid-point (~week 4 of post-Pulse-1)

- Swarm Contribution Pack v0.1 packaged + shared (per [`swarm-contribution-pack.md`](swarm-contribution-pack.md))
- Phase F dev-infrastructure work landed
- Site IA refactor surface to team (Phase G)

## Cross-cutting context

### Carry-forward from May 6 plan

The May 6 plan's **Phase 2 reconciliation discussion** is partially absorbed here. Items that need to surface at ~2026-05-21:

- **Layer ownership** (resolved here via Phase E.6 + persona-card session at biweekly)
- **Concept & Idea Ecology owner** (Matt, likely; confirm)
- **Implementation Memory + Evolution owner** (Koi candidate; confirm + co-authoring arrangement for Bonfires substrate)
- **CSIS posture** (new doc reframes from "conformance" to "semantic overlay"; Durgadas to react — §5.6 of master doc)
- **Tool / Option / Pattern / Protocol / Deployment / Case 6-tier** — *resolved by the new iteration's simpler boundary matrix; the 6-tier was a slip*
- **Ontology object types — 25 candidates** — *resolved by 5-object kernel as v0.1 + 25 candidates retained at §5.7*
- **Maturity language — 9 states** — *retained in new iteration with the same 9 states*
- **Toolkit vs "Transformational Journeys" framing tension (Koi)** — *not addressed by the new iteration; remains unresolved; surface to Matt + Koi async after Pulse 1 retro*

### Pulse 1 retro (still owed)

Pulse 1 happened 2026-05-09–10. No retro entry yet in `memory/`. The retro feeds:
- Swarm Contribution Pack v0.1 scope adjustment (`swarm-contribution-pack.md`)
- "Toolkit vs Journeys" framing decision (informed by what Swarm participants actually said)
- Federation hooks (Bonfires, OpenCivics)

- [ ] Write Pulse 1 retro to `memory/2026-05-10.md` (or a Pulse-1-dedicated note)

### Master doc edit rights

Per CLAUDE.md, `docs/MASTER.md` is Matt's working document — derive from it, don't modify without authorization. The 2026-05-15 share via Telegram **is** the authorization for this revision. **Phase 3 changes do NOT modify `docs/MASTER.md` itself.** They derive structured data (`data/`), layer docs (`docs/layers/`), canvases (`docs/canvases/layers/`), and overlay docs (`LAYERS.md`, `ORG-OS.md`, etc.).

### What the new iteration says we should avoid (§16.14)

The new iteration enumerates explicit "do not" rules for the next pass. These should constrain our refactor moves:

- Do not collapse layers prematurely.
- Do not finalize ontology before resources, concepts, and options are populated.
- Do not present polished writing as reviewed knowledge.
- Do not strip frame language without preserving Frame 1 / Frame 2 / Frame 3 distinction.
- Do not declare a pattern from a single case.
- Do not over-engineer infrastructure before workflows are clear.
- Do not let AI synthesis bypass review.

**The fifth and sixth are direct echoes of Cross-Cutting Principle #12 (Pattern Humility) and #15 (Infrastructure should serve workflows).** Surface them when the temptation comes up.

## Related

- [`docs/MASTER.md`](../MASTER.md) — canonical 2026-05-15 stabilization draft
- [`docs/MASTER-DOC-CHANGES-2026-05-15.md`](../MASTER-DOC-CHANGES-2026-05-15.md) — iteration diff
- [`docs/archive/MASTER-2026-05-06-knowledge-commons-toolkit.md`](../archive/MASTER-2026-05-06-knowledge-commons-toolkit.md) — previous iteration
- [`docs/archive/MASTER-2026-04-23-regen-web3-toolkit.md`](../archive/MASTER-2026-04-23-regen-web3-toolkit.md) — pre-rename iteration
- [`docs/plans/master-doc-iteration-may-2026.md`](master-doc-iteration-may-2026.md) — superseded May 6 plan (Phase 1 + Phase 2 reconciliation work folds in here)
- [`docs/plans/swarm-contribution-pack.md`](swarm-contribution-pack.md) — Swarm Pack v0.1; coordinates with this plan
- [`docs/layers/README.md`](../layers/README.md) — per-layer doc index (to be created in Phase B)
- [`docs/canvases/regen-knowledge-commons-toolkit-master.canvas`](../canvases/regen-knowledge-commons-toolkit-master.canvas) — master canvas (to be created in Phase D)
