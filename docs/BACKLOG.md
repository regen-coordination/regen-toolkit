# Regen Knowledge Commons Toolkit — Backlog

> **2026-05-15 iteration.** This is the overlay-side backlog — items that don't yet belong cleanly in a single layer + carryover content work + master-doc-side gaps. Mirrors the **master doc §16** structure (`docs/MASTER.md` lines 22954–24776). For master-doc gaps in detail, read §16 directly.
>
> **A healthy backlog lets the Toolkit remain open to future intelligence without making the present document unreadable.** Preserve useful material. Label its status. Route it when ready. Compost it when old. **Do not let it silently become guidance.**

## How this file works

Items use the **master doc §16 backlog status labels**:

| Status | Meaning |
|---|---|
| `raw-note` | Preserved but not yet processed |
| `future-seed` | Potentially useful later |
| `needs-routing` | Should be assigned to a Toolkit layer |
| `needs-review` | Requires human, source, domain, community, or technical review |
| `needs-source` | Missing citation, link, or origin |
| `needs-examples` | Concept promising but too abstract |
| `needs-implementation-test` | Should be tested before integration |
| `needs-owner` | Requires a steward or maintainer |
| `candidate-integration` | Likely should move into the main architecture soon |
| `candidate-template` | Should be preserved as a possible reusable template |
| `high-risk` | Requires public-use / domain / governance / legal / ecological / AI / privacy / community review |
| `candidate-removal` | May not be useful enough to keep |
| `archive` | Preserve for historical memory |
| `compost` | Transform old, failed, or outdated material into learning |

For routing, see the **§16 routing table** (master doc lines 24604–24622).

---

## New items — 2026-07-16 biweekly + Matty 1-on-1

Parked/exploratory items from the 2026-07-16 meetings. Active commitments live in [`HEARTBEAT.md`](../HEARTBEAT.md); these are the not-yet-active or unowned threads. Notes: `packages/operations/meetings/260716 *.md`.

- **Local-node package concept** — `future-seed` → route to Deployment / Infra. A pre-configured system letting a local-node operator run their own knowledge base + a simple hostable website (documentation structure + embedded project system + dev-website workflow). Raised by Luiz; capacity-limited; demand unproven.
- **Hermes opt-in ingestion model** — `needs-implementation-test` → route to Infra / Federation. Telegram groups **opt in** to pipe shared links through the ingestion pipeline → review → process. **Privacy constraint (high-risk):** no scraping bots; manual curation is the acceptable line. Pairs with the Hermes agent already live on the BCN Telegram.
- **Bonfire as an alternative/complement to Hermes** — `needs-review` → route to Infra. Evaluate Bonfire for the opt-in-ingestion use case (vs the OpenCivics "Harmonica" demo, seen as less useful here). Threads with Koi's Bonfires substrate.
- **Ron Teretsky overlap** — `needs-owner` (Luiz to open) → route to Federation / Partnerships. Built an automated project manager (Bread's PM tool); likely overlapping work; intro/direct conversation suggested. *(Also in HEARTBEAT as an active reach-out.)*
- **GeoBrowser deep-dive** — `needs-review` → route to Infra Stack. One promising option identified; needs further review + fit assessment. Standing item from 2026-06-15; now paired with the Geo Protocol scoping doc.
- **`communityrule.info`** — `future-seed` → route to Resources / Deployment. Nathan Schneider's tool for organizational constitutions ("set up a garden" → constitution); candidate resource to ingest.
- **Exit-to-community playbook** (Blockchain Governance / Nathan Schneider — OpenCivics / BreadCoop) — `needs-source` → route to Resources. Flagged as a key upcoming resource being released ~this week; capture the link + ingest once out.
- **ReFi DAO carbon-copy project DB integration** — `needs-implementation-test` → route to Source Systems. Not yet pulled cleanly; important source; part of the iterative feed-the-engine process.

---

## New items — 2026-07-19 reprocessing-validation gate

Surfaced by the review-gate analysis ([`docs/reports/2026-07-19-reprocessing-validation.md`](reports/2026-07-19-reprocessing-validation.md)) comparing the framework-reprocessed KB (722 objects) vs the live 119-article build. Coverage is complete (0 dropped); faithfulness spot-check 11/12 faithful. These are the parked follow-ups.

- **Reprocessed-content review gate is READY to run** — `candidate-integration` → the ~2–4 wk named-reviewer pass. Instruments live: [`docs/reviews/named-reviewer-checklist.md`](reviews/named-reviewer-checklist.md) + [`reviewer-tracking-sheet.csv`](reviews/reviewer-tracking-sheet.csv) (119 pages, 3 priority tiers) + [`faithfulness-spot-check-protocol.md`](reviews/faithfulness-spot-check-protocol.md). Blocks the PR to `main`. **Reviewer lead + page assignments deferred to the next call** (decision 2026-07-21; `needs-owner`).
- **Reference-normalization / alias layer** — `needs-implementation-test`, `high-risk` (blocks the graph view) → route to `toolkit-framework`. Only **60.4%** of `related_*` references resolve exactly; ~85% resolve with an alias layer; **95 refs (14.6%) are truly dangling** (target never promoted, e.g. `koi-net`, `hypercerts`, `SKOS`). The graph view is not build-ready until refs are normalized and dangling targets promoted-or-dropped. Evidence: `data/validation/graph-diff.yaml → reference_integrity`.
- **`claim` + `uncertainty` must render together** — `needs-implementation-test` → framework + site. Figures live in `claim` with the citation caveat quarantined in a separate `uncertainty`/`evidence` field; any view rendering `claim` alone republishes uncited numbers as fact. Add a rendering/promotion rule that keeps them paired.
- **Controlled-vocab type-slot sanity** — `needs-review` → `toolkit-framework`. The source-system/resource typer misfits some entities (e.g. Greenpill Network → `blog`, actually a network/community). Add a check that sanity-tests each `type` slot against the object's own description.

---

## Items from master doc §16.2 "Current known gaps"

Master doc enumerates these explicitly. Treat as the team's known list, with overlay-side annotations.

### Highest priority — preserve before compressing
- [ ] **Full Resource Graph extraction** [`needs-implementation-test`] (master doc §16.2.2). Raw inventory of resources, links, books, papers, tools, source systems, organizations, maps, social feeds, implementation references, source candidates, failure cases, and loose leads must be extracted into a structured table before any cleaned narrative version is created. **Overlay status:** 738 entries lifted 2026-04-26 from the 2026-04-23 iteration. Re-lift against new §7 is queued in [`plans/master-doc-iteration-may-15-2026.md`](plans/master-doc-iteration-may-15-2026.md) Phase E.4.

### Source System Cards (target: 5–10)
- [ ] **Create 5–10 Source System Cards** [`candidate-template`, `needs-owner`] (master doc §16.15.6). Source Systems are *living knowledge environments* (wikis, repos, maps, forums, knowledge gardens, research DBs) with stewards + ongoing additions + return-paths. **Overlay status:** `data/sources.yaml` is empty. Schema needed. Candidates from existing approved source maps: Restor · Hylo · P2P Foundation · ReFi Ecosystem · Weavers Network · Second Renaissance.

### Option Library entries (target: 10)
- [ ] **Create 10 actual Option Library entries** [`candidate-integration`, `needs-owner`] (master doc §16.15.7 + §9.13 priority list). Master doc names 12 v0.1 priority examples: local node model · source-system card · claim-evidence record · consent-based decision-making · multisig treasury · quadratic funding · milestone-based grants · attestation-based evidence record · knowledge garden workflow · implementation retrospective · safe-to-fail probe · AI-assisted source classification.

### Implementation Case Stubs (target: 5–8)
- [ ] **Create 5–8 Implementation Case Stubs** [`candidate-template`, `needs-owner`] (master doc §16.15.8). Per master doc §12.2, existing implementation learning exists across ecosystem (GreenPill Brasil · Regen Rio · GreenGoods · Gitcoin Grants Garden · Gardens v2 · Karma GAP · CIDS · local chapters · public goods rounds · knowledge commons drafting · AI-assisted documentation pilots · ecological data pilots · workshops · governance experiments · bounties). Schema needed before stubs can be filled. **Coordinate with Koi (Bonfires substrate).**

### Evolution Log
- [ ] **Add an Evolution Log** [`needs-implementation-test`] (master doc §16.15.9). Per §13, ten signal types route to different layer updates. **Overlay status:** `data/feedback-process.yaml` (pre-iteration) needs split into Implementation Memory + Evolution; the Evolution side becomes the Evolution Log substrate.

### Public-Use Boundary labels
- [ ] **Add Public-Use Boundary labels** [`needs-review`] (master doc §16.15.10). Per Cross-Cutting Principle #4. High-risk areas: ecological claims, funding claims, governance recommendations. Should apply across L2 Encyclopedia, L3 Resource Graph, L8 Implementation Memory.

### Deployment Readiness Levels
- [ ] **Add Deployment Readiness Levels to deployment templates** [`candidate-template`] (master doc §16.5 + §16.15.11). Per L6, deployments classify by Type · Scale · Context · Maturity · Risk. Add to `data/deployment-requirements.yaml`.

### CSIS-informed checks
- [ ] **Add CSIS-informed checks where useful, without claiming conformance** [`needs-review`, `high-risk`] (master doc §16.15.12 + §10.12). CSIS reframed in new iteration from "conformance" to "semantic overlay." Existing `docs/CSIS.md` + alignment report need posture revision. **Coordinate with Durgadas.**

### How to Use This Master Doc
- [ ] **Write a short reader-orientation page** [`future-seed`] (master doc §16.2.1) — "where to start" pathways by contributor need. Master doc deferred this as not-priority-now. Overlay covers part of this via `docs/layers/README.md`, but a master-doc-side intro could complement.

## Items from §16.10 "Research backlog"
- [ ] Read master doc §16.10 in full (lines 24469–24560) — research questions tied to specific concepts. Route each to either L4 Concept & Idea Ecology (open question registry) or to Koi's pending research framework document.

## Items from §16.8 "Frame Language Audit"
- [ ] **Frame Language Audit** [`needs-owner`, `candidate-integration`] (master doc §16.8, lines 24384–24448 + adjacent to L4 Concept & Idea Ecology). Durgadas's framing critique — Frame 1 (extractive/hierarchical) vs Frame 2 (situational) vs Frame 3 (holistic) — now has dedicated master-doc home. **Coordinate with Durgadas** on the companion doc + AI prompts they committed to at 2026-04-23.

## Items from §16.9 "Decision Rules v0.1"
- [ ] Read master doc §16.9 (lines 24448–24469) — decision rules that should apply across the overlay's contribution workflow. Surface relevant ones into HEARTBEAT-time triage and PR-review.

## Carryover from prior overlay BACKLOG.md (2026-04-23 iteration)

### Content work (Heenal / Phase 2 + Phase 3 articles)
- [ ] **Apply Matt's feedback on 4 articles** [`needs-review`] — scams · seed phrases · wallet comparison · key terms. (Heenal — carryover.)
- [ ] **Add real-world examples from approved source maps** [`needs-source`] — Restor · Hylo · P2P Foundation · ReFi Ecosystem · Weavers Network · Second Renaissance.
- [ ] **Human review of all 67 published AI-assisted drafts** [`needs-review`, `high-risk`] — nuance, cultural context, lived-experience. (Anti-extractive synthesis principle #9 applies.)
- [ ] **Phase 2** — expand 43 medium-length (200–799 word) articles via editorial pipeline.
- [ ] **Phase 3** — write 139 stub articles from scratch.

### Resource Graph curation (Brandon)
- [ ] **Brandon's curation pass on `data/resources.yaml`** [`needs-owner`] — dedupe, drop tag-as-resource bullets, fill URLs, classify. Gated on Phase E.4 re-lift completion.
- [ ] **Resource audit** [`needs-source`] — confirm previous GPT lift didn't drop links. Items to verify: tokenengineeringlabs.com · block.science · Benjamin Barber FtC (computable law) · occresearch.org · taxes (r/cryptotaxes + tools).

### Conceptual clarity
- [ ] **Taxonomy vs Ontology distinction** [`candidate-integration`] — write a crisp distinction in the knowledge base. (Now belongs at L4 Concept & Idea Ecology + L1 Ontology adjacency.)
- [ ] **Rather's ontology review pass** [`needs-review`] — Octo · SuperBenefit alignment; Two-Layer Ontology Posture (master doc §5.5) gives new framework.

### Historic carryover from prior planning calls (triage at next biweekly)
- [ ] Drew Simon — share knowledge commons starter links + details in group chat (raised 260212; status unclear)
- [ ] Hub post about knowledge commons / federation collaboration (Afo — raised 260225; never confirmed sent)
- [ ] Bright community collaboration — concrete ideas + connection to toolkit (Luiz to discuss with Rather; raised 260212)
- [ ] Onboarding guides refresh — Local Node Onboarding + Network Initiative Onboarding (raised 260312)
- [ ] Integrate Safe (smart wallet) content into the toolkit (raised 260312)
- [ ] Style guide derived from ReFi DAO 200+ blog posts — partial existence at `docs/writing-system.md`; cross-reference with `content-updates/heen-ai/add-planning-docs` branch's `content-style-guide.md`

## Items from §16.14 "What to avoid in the next pass" (constraints, not tasks)

Read these as guard-rails for any refactor move. Surface at biweekly. They are NOT tasks — they're rules:

- Do not start over.
- Do not turn the doc into a public pitch.
- Do not delete useful raw material too aggressively.
- Do not over-polish uncertain material.
- Do not treat the resource registry as endorsed.
- Do not treat site articles as canonical without review.
- Do not collapse tracks into deployments.
- Do not collapse implementation cases into patterns.
- Do not treat AI synthesis as reviewed.
- Do not turn Octo / BKC into a final ontology decision.
- Do not claim CSIS conformance.
- Do not choose infrastructure before workflows are clear.
- Do not flatten source systems into link lists.
- Do not remove uncertainty just to make the document cleaner.
- Do not compress raw resource inventories before extracting links.
- Do not make the Toolkit sound more complete than it is.

## Items from §16.16 "Suggested AI instruction" (operator guard-rails for AI work)

If you're using an AI assistant to work on the Toolkit, follow these (verbatim from master doc):

1. Use the latest master doc as the backbone.
2. Do not start from scratch.
3. Preserve useful content from previous iterations.
4. Do not separate old and new content unless asked.
5. Re-home material into the correct layer.
6. Maintain distinctions between Resource, Concept, Option, Track, Deployment, Implementation, Signal, and Pattern.
7. Mark uncertainty and maturity state.
8. Preserve source lineage and attribution.
9. Flag high-risk public-use material.
10. Treat Octo / BKC as an ontology alignment candidate, not a final decision.
11. Treat CSIS as an informing framework, not a conformance claim.
12. Prefer stabilization, routing, and implementation scaffolding over conceptual expansion.
13. Move messy unresolved material to Backlog / Next Sprint rather than deleting it.
14. Keep the document dense, practical, source-aware, and implementation-oriented.
15. Preserve raw resource inventories before summarizing.
16. Do not treat AI-assisted synthesis as reviewed knowledge.
17. If cleanup drops concrete links, restore the raw source and extract before rewriting.

---

## Composted 2026-08-09 — pre-Linear triage

Items removed from `HEARTBEAT.md` during the pre-Linear-seeding triage pass (Task 8 of the linear-seeding plan — every remaining open HEARTBEAT item now carries a `task-YYMMDD-owner-slug` id + resolvable owner so `npm run linear:audit` passes). These items were time-expired or long-stale rather than actively wrong; preserved here rather than deleted. Full per-section rationale: `memory/2026-08-09.md`.

### From "Hackathon — May (cross-layer)" (entire section)
- **Invite Ethereum Localism folks via Telegram** (Rather) — `compost` — the May hackathon date never got set and the window has long passed.
- **Join Open Civics Consortium chat via website; coordinate hackathon invite** (Luiz) — `compost` — same, time-expired.
- **Confirm Geo Protocol participation and format** — `compost` — same, time-expired; Geo Protocol scoping continues elsewhere (`task-260716-luiz-geo-protocol-scoping`).
- **Set the hackathon date and format (knowledge-swarming hack)** — `compost` — never scheduled; overtaken by the Knowledge Commoning Swarm / Pulse cadence.

### From "Historic carryovers (from backfilled meetings — needs team triage)" (entire section)
Raised at the 2026-04-26 meeting-history backfill; the file itself flagged these "status unclear." No resolution has surfaced in the ~3.5 months since — archiving rather than continuing to carry them as active.
- **Drew Simon — share knowledge commons starter links + details in group chat** — `archive` — raised 260212; status unclear.
- **Hub post about knowledge commons / federation collaboration** (Afo — raised 260225) — `archive` — never confirmed sent.
- **Bright community collaboration — concrete ideas + connection to toolkit** (Luiz to discuss with Rather; raised 260212) — `archive` — status unclear.
- **Onboarding guides refresh: Local Node Onboarding + Network Initiative Onboarding** (raised 260312) — `archive` — status unclear.
- **Integrate Safe (smart wallet) content into the toolkit** (raised 260312) — `archive` — status unclear.
- **Style guide derived from ReFi DAO 200+ blog posts** (raised 260212) — `archive` — partial existence at `docs/writing-system.md`; cross-reference with `content-updates/heen-ai/add-planning-docs` branch's `content-style-guide.md` per Phase 4 reconciliation if revived.

### From "Knowledge Commoning Swarm" — Pulse-1 pre-work only
Pulse 1 ran 2026-05-09/10; these three items were logistics/prep for getting *to* Pulse 1 and are now moot. The forward-looking item in that section (observing Pulse-1 outcomes to adjust the Swarm Contribution Pack v0.1 scope) stays active in `HEARTBEAT.md` as `task-260507-luiz-adjust-swarm-contribution-pack`.
- **Luiz — join OpenCivics planning call** (2026-05-07, for Pulse 1 logistics) — `compost` — the call and Pulse 1 both already happened.
- **Team — attend Pulse 1** (partial attendance acceptable; Matty out for Philadelphia wedding) — `compost` — event already occurred.
- **Pre-Pulse-1: draft `00-README.md` + `05-tool-option-pattern-protocol-deployment-case.md` + `07-six-affordances-translation.md`** for the Swarm Contribution Pack v0.1 — `compost` — explicitly pre-Pulse-1 prep work; event has passed.

---

## Backlog maintenance process (from master doc §16.13)

1. Add raw note or future seed.
2. Label status.
3. Add suggested route if known.
4. Review periodically.
5. Move high-priority items into active work.
6. Archive or compost old items.
7. Remove only when clearly irrelevant, duplicate, harmful, or intentionally rejected.

**Suggested rhythm:** quick monthly triage · deeper quarterly review · review after major implementation cycles · review before public site releases · review before AI-assisted synthesis rewrites raw material.

---

_Last refreshed: 2026-05-15 against master doc §16 (lines 22954–24776). For the master-doc-side backlog detail, read MASTER.md §16 directly._
