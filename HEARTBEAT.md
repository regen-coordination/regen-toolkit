# HEARTBEAT.md — Regen Web3 Toolkit Active Tasks

_A living checklist of active coordination tasks. Agents consult this on every session. Update regularly — mark done, add new, remove stale._

> **HEARTBEAT vs BACKLOG.** HEARTBEAT = active work for THIS cycle (in-flight + this-week). [`docs/BACKLOG.md`](docs/BACKLOG.md) = the triaged TODO surface (mirrors master doc §16, with status labels: `raw-note` · `needs-routing` · `needs-owner` · `candidate-integration` · `high-risk` · etc.). When an item gets picked up for active work, lift it from BACKLOG → HEARTBEAT. When something gets parked, push it down.

> **2026-05-15 iteration checkpoint.** Master doc updated to 2026-05-15 stabilization draft (10 layers; Tracks restored, Infrastructure added). Per-layer docs at [`docs/layers/`](docs/layers/); per-layer canvases at [`docs/canvases/layers/`](docs/canvases/layers/); master overview canvas at [`docs/canvases/regen-knowledge-commons-toolkit-master.canvas`](docs/canvases/regen-knowledge-commons-toolkit-master.canvas). Phase 3 refactor plan: [`docs/plans/master-doc-iteration-may-15-2026.md`](docs/plans/master-doc-iteration-may-15-2026.md).

---

## Active Tasks

> **2026-06-16 checkpoint.** Gap-fill (260521 + 260604 biweeklies) processed; **new master doc 2026-06-15 working iteration** is canonical (30,847 lines — integration pass, 10-layer core stable; see [`docs/MASTER-DOC-CHANGES-2026-06-15.md`](docs/MASTER-DOC-CHANGES-2026-06-15.md)); **resource DB V3** staged at [`data/resources/`](data/resources/). **Convergence is parked behind an operator checkpoint** (site merge, branch cleanup, framework/instance split, full resource lift) — see ⏸ section below.

### 2026-08-27 Knowledge Commons Sync — V1 scope frozen, three Linear projects, org-os on a branch _(★ NEW 2026-08-28)_

Notes: [`260827 Regen Knowledge Commons Sync.md`](packages/operations/meetings/260827%20Regen%20Knowledge%20Commons%20Sync.md). Chair: Monty. Absent: Corey.

**The call where V1 got a frozen scope, a shipping date and named leads.** Source = **Regen Coordination Hub only** (two-layer link crawl; 5 categories, 31 topics). Crux = an **agentic API** (ingest → clean → apply ontology → structure → propose to Geo). **Geo Browser** adopted as the governed data layer (IPFS + The Graph, per-space subgraph under an embedded Aragon DAO); **forkable ontologies** explicitly to prevent *ontological violence*; the starter ontology lives in the **commons**, spaces fork from it. **Timeline: end-Sept API live + Geo set up · Oct run the pipeline in earnest · next cycle brings Regen OS / Coop / the KC corpus.**

> ✅ **Answers `task-260827-luiz-kc-repo-role`** (the A/B/C framing). Resolved close to **A-lite**: `knowledge-commons` holds **API code, schemas, ontology configs, validation logic, README docs — not data** (data → R2 buckets / DB; *"GitHub is a version control system, not a data store"*). **No one-to-one repo mirroring.** Regen OS and the heavier layers **wait until V1 is stable**.

> ⚠️ **`task-260827-luiz-clean-slate-main` was NOT discussed** and stays open. Monty's only toolkit-repo remark was that mirroring data creates complexity — a different question. The Heenal-content → branch → curated-projection move still needs its own conversation.

**Three Linear projects, leads named:** **Commons Pipeline** → Monty · **Repo Stabilization** → **Luiz** (org-os + knowledge-management layer; *currently the only member*) · **Integrity Suite** → Durgadas (created live in the call, needs scoping). **Two-week cycles matched to this call's cadence; Linear = source of truth, Telegram = async.** Next call ~**2026-09-10**.

- [ ] **Luiz — review + assign the Linear issues from the org-os ingestion** — review with agents, fill gaps, self-assign. **Monty's constraint: scope to what V1 needs *now*** ("not too overwhelming"); more later. — `task-260827-luiz-linear-review-assign`
- [ ] **Luiz — branch a lightweight org-os instance off `knowledge-commons` and test** — `main` stays clean; prove value before proposing a merge. Monty: *"Feel free to branch off and then take a look."* — `task-260827-luiz-orgos-branch`
- [ ] **Luiz — join the engineering sync with Monty and Brad** — repo structure, Cloudflare agents, technical architecture. Monty's explicit invite. — `task-260827-luiz-engineering-sync`
- [ ] **Luiz — schedule the org-os session** (~2 weeks, once back in Brazil); start proposing times. *(Advances `task-260806-luiz-orgos-session`.)* — `task-260827-luiz-orgos-session-scheduling`
- [ ] **Luiz — 1:1 with Durgadas on the org-os / Craft overlap** — *"I'm developing something that sounds very similar to it."* — `task-260827-luiz-durgadas-1to1`
- [ ] **Monty — scope + set up the Integrity Suite project in Linear**; add team members to the projects. — `task-260827-monty-scope-integrity-suite`
- [ ] **Monty — finish Matt's Claude + ChatGPT connectors**; update the Miro diagram for the Ore Instruct / Craft split; answer the open board comment (*"purpose of the dump vs the existing data source/cache"*). — `task-260827-monty-matt-connectors`
- [ ] **Durgadas — share all GitHub repo links in Telegram** (3 accounts, unsynced since ~April, 4 months of drift on an 8-month-old corpus) + the **DAIAA** invite; fix the **MCP servers on Railway**. — `task-260827-regis-share-github-links`
- [ ] **Durgadas — find a home for the existing Craft/Struck corpus work** — he asked directly; answer was partial (Linear docs / GitHub). **Open.** — `task-260827-regis-corpus-placement`
- [ ] **Matt — onboard to Claude/ChatGPT/GitHub/Linear; own the fundraising lane.** — `task-260827-matt-tooling-onboarding`
- [ ] **Drew — get Sugarbug.ai alpha invites for the group.** — `task-260827-drew-sugarbug-invites`
- [ ] **Heenal — review Geo proposals** as capacity allows (limited near-term, committed). — `task-260827-heenal-geo-review`
- [ ] **Team — join the Linear projects + self-assign within the two-week window**; **update the Artizen profile**; schedule the **AI primer call for Matt** (context windows, MCP, skills — Monty + Durgadas both offered). — `task-260827-team-linear-selfassign`

> **Integrity Suite posture (new).** Calibrate first, hard-gate later: let everything flow through to tune scoring, then reject defective/invalid entries automatically. **Two workflows** — **Ore Instruct alone** for messy bulk data needing general discipline; **full 6-layer Craft chain** (Ore Instruct either side) when quality must be absolute. Relevant to `docs/CSIS.md` posture.

> ⚠️ **Attribution caveat.** The Granola transcript has only two speaker labels (`Me` = Luiz, `Them` = everyone else). **"Brad"** appears both as a technical/engineering voice *and* as a SuperBenefit contact, while repo history records a *"Brad (Bread Co-op)"* — **one Brad or two is unresolved.** The "not ready to lead / can help with implementation" and multiparty-computation contributions are attributed to **Afo** by Granola but read as **Caue** in sequence. See the record's *Transcript quality* section before quoting anyone.

### 2026-08-27 catch-up — knowledge-commons repo surfaced + Matty reply _(★ NEW 2026-08-28)_

The Rather+Afo "idea" Matt referenced (TG, Aug 26) is **`regen-coordination/knowledge-commons`** — created by Afo 2026-08-23, **empty shell**, README: *"canonical source of truth for the Regen Knowledge Commons with the website, agents and APIs."* Direction proposed to Matty (reply drafted in-session; operator sends): embrace it as the fresh canonical surface; on the toolkit repo, **move Heenal's content to its own branch and rebuild `main` clean via the publish projection** (`scripts/publish-to-main.mjs`, Shape B) — live site stays up until a conscious switch. Matt gets an explicit yes to own front-facing wording/visuals. Full context: `memory/2026-08-28.md`.

- [ ] **Luiz — send the Matty reply** (final text agreed 2026-08-27; includes Cloudflare links prod `regen-toolkit.luizfernandolfsg.workers.dev` / dev `regen-toolkit-dev.luizfernandolfsg.workers.dev`) — `task-260827-luiz-matty-reply`
- [x] **Luiz — align on the `knowledge-commons` repo role at the call** — ✅ **RESOLVED at the 08-27 call.** Landed close to **A-lite**: the repo holds **API code, schemas, ontology configs, validation logic + README docs**; **data lives in R2 / a database, not Git**; no one-to-one mirroring; Regen OS and heavier layers wait until V1 is stable. org-os goes on a **branch**, `main` stays clean. — `task-260827-luiz-kc-repo-role`
- [ ] **Luiz — spec the clean-slate `main` move** — Heenal content → own branch (nothing lost) → curated projection rebuilds `main`; sequence so prod never goes blank (prod Worker deploys from `main`). — `task-260827-luiz-clean-slate-main`
- [ ] **Luiz — integrate `knowledge-commons` into `regen-coordination-os`** + find the workshop moment. — `task-260827-luiz-kc-orgos-integration`
- [ ] **Luiz — restore `LINEAR_API_KEY` to `.env` and re-sync the KCM board** — id-map shows mass `orphaned` at last sync 2026-08-09; everything Rather/Afo did since is invisible locally. — `task-260827-luiz-linear-resync`

### 2026-08-06 engineering sync — process infrastructure landed _(★ NEW 2026-08-06)_

Notes: [`260806 Regen Toolkit Engineering Sync.md`](packages/operations/meetings/260806%20Regen%20Toolkit%20Engineering%20Sync.md) · Integration report (shareable): [`docs/reports/2026-08-06-engineering-sync-integration.md`](docs/reports/2026-08-06-engineering-sync-integration.md). Attendees: Afo, Matty, Luiz, Rather, Regis (Durgadas).

**The call where the merge blocker got an answer.** Three adoptions in one hour — **Linear** (PM, Afo leads), **Cloudflare Workers** (hosting, Rather), and a **dedicated coordination group** (Afo). Repo merge sliced into **four ordered phases**. The new gate is **contribution-readiness**: stabilise dev + prod as mirrors so others can contribute, and hold the heavier org-os work on its own branch until then.

> ⚠️ **Supersedes two 07-16 items.** The **Netlify dev build** ask to Hina is replaced by **Cloudflare branch previews**; **GitHub Projects** is replaced by **Linear**. See the 07-16 block below for the struck items.

> **Identity resolution:** **Regis Chapman = Durgadas** ("Das"/"Dodos"; `deradosmack.com`). The 07-16 note listed them as two separate participants — they are one person. Merge in all future participant lists.

**The four merge slices** (Afo's analysis, adopted): 1 framework + schemas w/ existing tests → 2 deterministic generators + validation commands → 3 public-safe aggregate data + selected Astro surfaces → 4 reviewed knowledge objects *only after the promotion gate*. Keep internal org-os coordination material out of the production projection.

- [x] **Luiz — grant Rather GitHub org access** — ✅ **DONE 2026-08-27** (operator). Unblocks the Cloudflare handover (account ownership + custom domain) and Rather+Afo onboarding Durgadas. — `task-260806-luiz-rather-org-access`
- [ ] **Luiz — seed Linear from the `regen-toolkit-os` branch** — set up the Linear ↔ repo integration; populate issues from the processed session/meeting notes. Runs in parallel with Afo's seed from the call notes + GitHub import. — `task-260806-luiz-linear-seed-repo`
- [ ] **Luiz — execute the four-slice merge** — slices 1–3 land in dev **and** prod to open the contribution pathway; slice 4 waits on the promotion gate. — `task-260806-luiz-four-slice-merge`
- [ ] **Luiz — build the knowledge-source → commons → orgs flow visualisation** — Afo's explicit ask: how sources flow **into** the commons and back **out** to the orgs. Per-intake mappings exist; **the whole-system map does not.** Feeds `task-260716-luiz-canvas-viz-intro-doc`. — `task-260806-luiz-knowledge-flow-visual`
- [ ] **Luiz — put engine/reprocessing validation on Linear** — validate the framework package + the reprocessing system already built; identify needed adjustments. — `task-260806-luiz-engine-validation-linear`
- [ ] **Luiz — host the dedicated org-os session** — the **call after next** (next week is Afo's Linear/GitHub session). How org-os works + how instances federate reviewed content upstream into the commons. — `task-260806-luiz-orgos-session`
- [ ] **Luiz — confirm the Linear account email** (Gmail, per the call) so accounts don't fragment across workspaces. — `task-260806-luiz-linear-email`
- [ ] **Rather — set up Cloudflare Workers hosting** (after org access) — branch previews + built-in CI/CD + merge controls on `main`. **⚡ 2026-08-09: DONE except ownership** — Option B live under Luiz's personal Cloudflare account, **build-on-push working end-to-end**: **prod** `regen-toolkit.luizfernandolfsg.workers.dev` ← `main` · **dev** `regen-toolkit-dev.luizfernandolfsg.workers.dev` ← `regen-toolkit-os` (3,931 pages, 3,780 KB objects). Verified by pushing `b719a949..a38d5d41` → auto-build deployed `c4b209fc` in ~2 min, all routes 200. **Remaining for Rather:** account handover/transfer, custom domain on prod, and disabling non-production-branch builds on the prod Worker. Runbook: [`docs/onboarding/cloudflare-hosting.md`](docs/onboarding/cloudflare-hosting.md). — `task-260806-rather-cloudflare-setup`
- [ ] **Rather — collaborate with Luiz on org-os ↔ his app** — same job (DAO IP schema data), built for **programmatic agent loading** rather than file-tree walking; possible org-os deployment path across paradigms. — `task-260806-rather-orgos-app-collab`
- [ ] **Rather — standards→code reference implementation with Regis** — beats the **probabilistic-interpretation problem** (*"give the document to a thousand agents, get a thousand interpretations"*). — `task-260806-rather-standards-reference-impl`
- [ ] **Rather — draft + submit the Harmonica purchase proposal.** — `task-260806-rather-harmonica-purchase`
- [ ] **Rather — share the business-modelling bot** (alpha, w/ Rowan) when shareable; beta testers lined up. — `task-260806-rather-business-modeling-bot`
- [ ] **Afo — create the dedicated coordination group** (consolidates the top group + Regen Coordination council group). — `task-260806-afo-coordination-group`
- [ ] **Afo — seed Linear** from the call notes + **import the existing GitHub issues**; set up **templates + labels** (mirroring the knowledge-commons / toolkit structure + source types). — `task-260806-afo-linear-seed`
- [ ] **Afo — run the Claude Code + Linear + GitHub session** on the next call (whole team; Regis's onboarding as the concrete case) + a 1:1 with Regis early next week. — `task-260806-afo-linear-github-training`
- [ ] **Afo — review the integrity suite site** (Regis's link) — structure + knowledge-commons alignment. — `task-260806-afo-review-integrity-suite`
- [ ] **Regis (Durgadas) — write the standards→process document** — how each standard contributes to the overall project process. — `task-260806-regis-standards-process-doc`
- [ ] **Regis (Durgadas) — GitHub collaboration onboarding** — he stores everything in GitHub but can't act on PRs; session with Afo. *(Same gap as `task-260716-luiz-agent-onboarding-onepager` — now has a second owner + a scheduled slot.)* — `task-260806-regis-github-onboarding`
- [ ] **Matty — feed the four-stage engineering priority frame into Linear** — functionalise the engine → improve existing knowledge → feed the engine + human review → tracks/deployment layer. — `task-260806-matty-engineering-priorities-linear`
- [ ] **Team — join the Linear workspace** (invites sent). — `task-260806-team-join-linear`
- [ ] **Team — apply this week's boosts to the BREAD fund** (Luiz ~100k, Afo 50–100k); **evaluate the leaderboard late in the drive**, don't front-load. — `task-260806-team-boost-bread-fund`

> **Schema convergence — the resolved position.** Converge on **integration points** and **pin schema versions** (strict Zod/TypeScript, validated on send *and* receive), but write **a distinct schema per object class** — Regis's law-vs-oracle-vs-time-standard objection to flattening was accepted. Convergence is on the seams, not the shapes. This is now the standing constraint on `data/ontology/` work.
>
> **Artizen mechanics captured** (boosts = fund cash prizes + matching availability, not project funding; project boosts near-worthless; spend late against the leaderboard; ~20k/week showcase replenishment; balance discrepancy 600k vs 120k unresolved) are folded into the hub strategy note `260807 Artizen Season 7 - Consolidated Strategy.md` §4/§5.

### 2026-07-16 biweekly + Matty 1-on-1 — fresh commitments _(NEW 2026-07-16; partially superseded 2026-08-06)_

Two meetings the same day: the morning **Matty 1-on-1** (framework build done + **dev→prod pipeline live**: `regen-toolkit-os` = dev, `main` = prod auto-deploys) and the **biweekly**. Through-line: **the engine is built — now feed it.** Notes: [`260716 Toolkit meeting with Matty.md`](packages/operations/meetings/260716%20Toolkit%20meeting%20with%20Matty.md) · [`260716 Regen Web3 Toolkit Planning Call.md`](packages/operations/meetings/260716%20Regen%20Web3%20Toolkit%20Planning%20Call.md). Integration report (shareable): [`docs/reports/2026-07-16-planning-call-integration.md`](docs/reports/2026-07-16-planning-call-integration.md).

**Repo migration is the unblock** — Netlify dev build, GitHub Projects, Rather's Astro fix, and integration-report PRs are all gated on Hina transferring the repo to the Regen Coordination org.

- [ ] **Luiz — share repo-migration details with Hina** — migrate the repo to the **Regen Coordination GitHub org**. Hina accepts the org invite → transfers → reconnects the live-website repo. **★ unblocks most of the below.** *(2026-08-06: the **Netlify dev build** half of this ask is **superseded by Cloudflare branch previews** — `task-260806-rather-cloudflare-setup`. The org migration itself still stands.)* — `task-260716-luiz-repo-migration-hina`
- [ ] **Luiz — set up the staging/dev site** for reviewing framework-processed content **side-by-side vs Hina's current build** (watch the **graph view** for relationship shifts) before any push to prod. — `task-260716-luiz-staging-dev-site`
- [ ] **Luiz — drive the review→PR→merge checkpoint** — share how the dev build looks + the specific points to check (what changed vs before) → checklist + **named-reviewer sign-off** per page (~2–4 weeks) → PR to `main` → merge (kick-starts the content pipeline). — `task-260716-luiz-review-pr-merge`
- [ ] **Luiz — verify + test the name-flagging/removal feature** — **hard privacy gate** before the repo/website can go public (individual names must be handled). — `task-260716-luiz-name-flagging-privacy-gate`
- [ ] **Luiz — improve the Obsidian canvas visualizations + a one-page intro doc** — needed before any public/semi-public sharing. — `task-260716-luiz-canvas-viz-intro-doc`
- [ ] **Luiz — write the repo-access + agent-onboarding one-pager** (clone the repo · work with agents · basic GitHub collaboration + **tutorial links** for non-technical contributors). *(Several members: "no idea how to collaborate on GitHub.")* — `task-260716-luiz-agent-onboarding-onepager`
- [ ] **Luiz — open a Geo Protocol scoping doc** (can start blank) — loop in **Rather + Regis**; assess fit with everything. — `task-260716-luiz-geo-protocol-scoping`
- [~] ~~**Luiz — set up GitHub Projects** in the Regen Coordination repo post-migration~~ — **SUPERSEDED 2026-08-06 by Linear** (`task-260806-luiz-linear-seed-repo` / `task-260806-afo-linear-seed`). Afo imports the existing GitHub issues into Linear. *Still live from this item:* **check Hina's mapped issues survive the migration** before the import runs. — `task-260716-luiz-github-projects`
- [ ] **Luiz — confirm the ~69 source systems** are the right ones (core sources whose whole ecosystem gets branch-ingested); **integrate the ReFi DAO carbon-copy project DB** (not yet pulled cleanly). — `task-260716-luiz-confirm-source-systems`
- [ ] **Luiz — connect with Ron Teretsky** (built Bread's automated PM tool — likely overlapping) + **schedule the Brad / Bread Co-op call** (parallel initiatives, Block Science integration, a possible Bread knowledge commons). — `task-260716-luiz-ron-teretsky-bread-coop`
- [ ] **Rather — DM Luiz + fix the broken Astro content collections** (document the v4→v7 foot guns) without disrupting current work, after the transfer; **jam on Geo Protocol**; publish source-scoring sense-making as a possible sub-standard. — `task-260716-rather-astro-fix`
- [ ] **Durgadas — share the CRAFT evidence/claims layer + Temper** (modular evidentiary ingestion swap-in — the "prove it" counter-posture; ingestion ≠ storage makes the swap clean); **republish + share the four facilitation case studies** + the community-tailored-playbooks framework. — `task-260716-durgadas-craft-temper`
- [ ] **Trinity — create content to learn-and-teach** (bridge for less-technical contributors as focus shifts to feeding/populating the engine). — `task-260716-trinity-learn-teach-content`
- [ ] **Team — create Artizen profiles (artizen.fund) + hold boosts** — save for a coordinated **3–4× multiplier** push (~$2,400 pool; $3k → $20k+ potential); **DM Monty** for immediate funding needs. — `task-260716-team-artizen-profiles`
- [ ] **Monty — toolkit funding strategy at the next Regen Coordination sync** — update the existing project (lean) vs a toolkit-specific one; Artizen timing. — `task-260716-monty-toolkit-funding`
- [ ] **Luiz — apply to join Metagov** (personal; research direction — ties to the DAOstar/DAO-IP5 standards thread). — `task-260716-luiz-apply-metagov`
- [ ] **Joint — define what a "shareable initial version" means** (public-sharing definition-of-done) on the group; advance the **Regen Coordination positioning** (integrate into Regen Commons vs separate membership; contribution = structuring a knowledge commons for Bread). — `task-260716-joint-shareable-version-dod`

> **Standards direction confirmed (both meetings):** **DAOstar** (Metagov) baseline + **CSIS** (org analysis/operationalization) + **DAO IP5** (financial accounting; impact-per-dollar). Threads with the CIDS + DAO IP5 standards-stack item under _ReFi Commons + Standards + Funding_ below.

### Handoff Integration — Matty's Jul 2026 iteration _(ACTIVE 2026-07-15)_

> Master plan: [`docs/plans/handoff-integration.md`](docs/plans/handoff-integration.md) · Changes map: [`docs/HANDOFF-CHANGES-2026-07.md`](docs/HANDOFF-CHANGES-2026-07.md). **Core finding:** Matty's Database_Spec = the framework machine. Source: `docs/RKC_Handoff_July_2026_FINAL_VERIFIED/`.

- [x] **T1 — intake & orient** — changes map written; iteration registered. — `task-260715-handoff-t1-intake` ✅
- [x] **T2 — crosswalk + Definition-of-Done conformance** — §40 crosswalk + 15-item DoD (7✅/8🟡). [`crosswalk`](docs/reports/2026-07-15-framework-masterdoc-crosswalk.md) · [`DoD`](docs/reports/2026-07-15-definition-of-done-conformance.md). — `task-260715-handoff-t2-crosswalk-dod` ✅
- [x] **T3a — real ingestion slice** — 127 Canonical_DB rows → 146 objects (kb-handoff/) + [`/handoff`](https://luizfernandosg.github.io/regen-toolkit/handoff/); B5 caught Matty's 4 dup pairs. — `task-260715-handoff-t3a-ingestion-slice` ✅
- [x] **T5 — agent-setup for Matty + call brief** — [`onboarding`](docs/onboarding/operate-the-toolkit-agents.md) + [`brief`](docs/briefings/2026-07-16-toolkit-call-brief.md). — `task-260715-handoff-t5-agent-setup` ✅
- [x] **T4 core — framework evolution** — `relationship-record` · `person`/`organization` · currentness/confidence/maintenance axes · enum gaps. **125 tests green.** — `task-260715-handoff-t4-framework-evolution` ✅ (remainder logged in master plan)
- [x] **T3b — full Canonical_DB ingestion** — 2,689 rows → 2,957 objects (+101 Discovery promotion) = **3,058 in kb-handoff/**, all raw. Deterministic ETL (accept-gate validated), B5-vs-flags + DoD #15 reconciled. [`manifest`](docs/reports/2026-07-21-canonical-migration-manifest.md). Committed `6ff1406a`. — `task-260715-handoff-t3b-full-ingestion` ✅ (2026-07-22)
- [ ] **Master 6-Part refactor** — awaits Matty's final handoff. — `task-260715-handoff-master-refactor`
- [ ] **Share pack** ([`draft`](docs/comms/drafts/2026-07-15-share-pack.md)) — drafted, awaiting operator send. — `task-260715-handoff-share-pack`

### Dev instance build — the live review surface _(★ ACTIVE #1, 2026-07-19)_

> Plan: [`docs/plans/dev-instance-build.md`](docs/plans/dev-instance-build.md) (spec: [`SESSION-HANDOFF-2026-07-19.md`](docs/plans/SESSION-HANDOFF-2026-07-19.md) Prompt 1). The 07-19 decision: render the framework-reprocessed KB (722 + 146 objects) as **browsable content pages** deployed live from the personal fork — so the ~2–4-week review gate starts **now**, independent of the Heenal migration. Fulfills `task-260716-luiz-staging-dev-site`.

- [ ] **Build the KB content routes** — by type + by layer, provenance + raw badges, related-object links, old-article ↔ reprocessed cross-links. — `task-260719-luiz-dev-instance-build`
- [ ] **Deploy from `fork`** (`git push fork regen-toolkit-os` → Pages) + report the URL + rendered-vs-stubbed map. — `task-260719-luiz-dev-instance-deploy`

### Framework Validation Pass — DONE _(2026-07-19; plan complete)_

> Master plan: [`docs/plans/framework-validation-pass.md`](docs/plans/framework-validation-pass.md) — **✅ complete 2026-07-19.** V0–V4 all done: kernel fixes (100→110 tests) · full 119-article self-ingestion → **722 objects** (`data/kb/`, all `raw`; 65 B5 collisions preserved) · live page + canvas + diff report · capital `update-proposal` drafted. Post-demo items redistributed (feedback harvest → handoff T4 remainder · human review → dev-instance review gate · migration → publish-pipeline).

- [x] **V0–V4** — consolidate · kernel fixes · self-ingestion (722) · artifacts · capital proposal. ✅ — `task-260714-fvp-v0-consolidate`

### org-os KMS shipped + ontology comparison — DONE _(2026-07-05)_

**`@org-os/kms` built + installed** — the org-os binding for the 0.2 "machine." Advances P9 (deploy→ReFi DAO) + the framework-as-package direction.

- [x] **`@org-os/kms` module** — binds `@regen-commons/toolkit-framework` into org-os (module + profile). Full 6-piece module, **44 tests**, subagent-driven TDD + spec/quality review. `packages/org-os-kms/`. Design: [`docs/plans/2026-07-05-org-os-kms-design.md`](docs/plans/2026-07-05-org-os-kms-design.md); plan: [`...-implementation.md`](docs/plans/2026-07-05-org-os-kms-implementation.md).
- [x] **Installed** — activated in regen-toolkit (`init` → `data/kb/` + self card); promoted both packages to **canonical org-os** (`v0.5`, pushed; framework 100/100 + kms 44/44 in place); registered in `packages-matrix.yaml`.
- [x] **ReFi DAO pilot** — KMS `init` + Quartz-config-reconciled in refi-dao-os (left uncommitted — their repo). Runbook: [`docs/plans/2026-07-05-org-os-kms-per-instance-adoption.md`](docs/plans/2026-07-05-org-os-kms-per-instance-adoption.md).
- [x] **Ontology comparison** (Heenal ↔ framework) — snapshot + crosswalk + comparison + report ([`docs/reports/2026-07-05-ontology-comparison.md`](docs/reports/2026-07-05-ontology-comparison.md)). **HYBRID adopted:** adopt framework backbone, contribute the **8 Forms of Capital** back to the kernel. 119 articles reprocess **1:1**.
- [ ] **Process ReFi DAO's knowledge** through the framework (kickoff prompt ready) — blog first (207 articles): register-source → ingest → review → bridge → render → federate.
- [ ] **Send the share-pack** (group + Matty) — [`docs/reports/2026-07-05-share-pack.md`](docs/reports/2026-07-05-share-pack.md); **carries the current arc** (updates the older "Send the 3 messages" item below).
- [ ] **Capital → `update-proposal`** to `docs/MASTER.md` (with Matty); framework schema fixes (`track.outcome`→array, first-class `public_use_boundary`, held/review-queue state); curation calls (function collision, maturity/stage normalization, salvaged merge); run the 6 `b_candidates`.

### Convergence — IN PROGRESS _(2026-06-16)_

Branch consolidation + site merge **done**. Now driven by the [**convergence pipeline**](docs/plans/CONVERGENCE-PIPELINE.md) (D1 + P1–P10).

- [x] **Branch consolidation** — `feature/org-os-overlay` renamed → **`regen-toolkit-os`** (consolidated working branch). 7 stale/converged branches pruned (local + remote), all preserved as `archive/*` tags (pushed). Remote now: `main` + `regen-toolkit-os` only.
- [x] **Site convergence** — merged `main`'s live **3-journey v1** into `regen-toolkit-os` (119 curated articles + journeys + knowledge map) with all org-os work intact. `npm run build` passes (124 pages). Resolved a `docs/BACKLOG.md` case-collision → org-os backlog kept canonical; site content backlog → `docs/CONTENT-BACKLOG.md`. **Decision (2026-06-17): `regen-toolkit-os` stays a *parallel* branch — NOT promoted to `main`.** The live site keeps deploying from `main` (site team's lane); `regen-toolkit-os` is the consolidated org-os + framework lane. Pull from `main` periodically to keep the site current here.
- [ ] **Framework / instance split (P1)** — `framework/` scaffolded (`README.md` + `SEPARATION.md`). Active. **Gated on D1** (lifecycle vs 10-layers). → present prototype (P3) to the group.
- [ ] **Resource-DB V3 lift (P2)** — crosswalk-driven into the data model (`data/resources/csv/toolkit-layer-crosswalk.csv`). Ready.
- [ ] **Multi-instance deploy (P9/P10)** — framework → `../refi-dao-os` (podcasts/blog) → `../refi-bcn-os` → network.

> Full roadmap (waves, dependencies, skills-to-load per plan): [`docs/plans/CONVERGENCE-PIPELINE.md`](docs/plans/CONVERGENCE-PIPELINE.md).

### Share with Matty + group — the concrete startpoint _(NEW 2026-07-02)_

Framework built + content processed + site forked (2 pages) + GAPS + master-doc proposals all done (2026-06-23 sessions). Share pack ready: [`docs/reports/2026-07-02-toolkit-framework-share-pack.md`](docs/reports/2026-07-02-toolkit-framework-share-pack.md) — tailored to Matty's/Rather's 29 Jun asks (tooling, Resource-Graph-as-portable-DB, artifact interconnection, opinionated decisions).

- [x] **Preview site LIVE** at `https://luizfernandosg.github.io/regen-toolkit/` (`/framework/` + `/regen-toolkit-os/`) — GitHub Pages via Actions on the `luizfernandosg/regen-toolkit` fork (explorience repo isn't admin-accessible to enable Pages). Site made base-aware; live production stays on `main`/Vercel. **Redeploy: `git push fork regen-toolkit-os`.** All 4 pages verified 200 + live schema/counts rendering.
- [ ] **Send the 3 messages** (Matty DM · group · Rather) from the share pack — draft-and-present done; review + send
- [ ] **Sync with Rather** — hand him the schema/JSON-LD substrate for knowledge-graphing/retrieval (piece 1) so he builds on it, not parallel; his website-UI/pluggable-content (piece 2) slots into `data/`
- [ ] **Group — ratify the top-5 decisions** (R1, R7, R8, R3, D1) — async or on the call
- [ ] **Full iteration next week** — sync the framework's `problems-and-theory-of-change.md` to Matty's **v3 ToC update (26 Jun)**; deepen the 3 skills; run the **V3 resource review pass** (human review before publishing lifted resources); then the hub post
- [ ] **Schedule the call** end of next week (ratify structure + opinionated decisions)

### Biweekly 2026-07-02 — fresh commitments _(NEW 2026-07-02)_

The share pack above was effectively presented at this biweekly. Direction ratified: **framework-as-package** (portable module → agents ingest resources → ontology-structured KB). Two **first ingestion test cases** are now real. Full note: [`packages/operations/meetings/260702 Regen Web3 Toolkit Planning Call.md`](packages/operations/meetings/260702%20Regen%20Web3%20Toolkit%20Planning%20Call.md). **Next checkpoint ~2 weeks (~2026-07-16).**

- [x] **Luiz — initial testable framework-package version** ✅ _(2026-07-04)_ — **DONE + shipped early.** The 0.2.0 "machine": work-order ingestion pipeline → validated ontology-structured KB; **ingestion≠storage IS the architecture** (adapter seam: kb-folder/repo-data/geo-stub) per Durgadas. 100/100 tests; extracted to public repo [`luizfernandosg/toolkit-framework`](https://github.com/luizfernandosg/toolkit-framework); first real ingestion = the 07-02 call → 10 typed objects. Spec+plan: [`docs/plans/framework-build/2026-07-04-machine-*.md`](docs/plans/framework-build/).
- [ ] **Luiz — verify the 2 site pages** against the **master doc** — pages **updated to reflect 0.2 the machine** _(2026-07-04, live)_ + frame-language-clean, but the master-doc verification pass is still owed.
- [ ] **Luiz — request website publish permissions + a dev environment** from Afo (publish prototypes into detail pages; process resources → preview graph → publish)
- [ ] **Luiz — test the framework on Koi's Gen Brasil Commons artifacts** (first real external case)
- [ ] **Koi — send Luiz the Gen Brasil Commons artifacts** — 2 books + a 6-call **conflict-mediation protocol** (open-source publication); the first ingestion test
- [ ] **Durgadas — send Luiz the CSIS / Craft / Valcre links** — rigor sandwich, prompt library, implementation guide, conflict standard (already AI/ML-ready). *(Resolves the standing "find the CSIS repo" ask.)*
- [ ] **Durgadas — AI Precision Toolkit release (~1–2 wks)**; build an ingestion layer for the **Proof of Coordination protocol**; make the **Idea Processor** functional on Vercel
- [ ] **Matty — one more master-doc iteration** (handoff docs + new theory of change; **incorporate Frame Language Analyzer + Idea Processor**); seed resources DB (tools/links/orgs); **focus on Options** (governance/tooling — the core of a deployment). *(Threads with Master Doc + Resource DB V3 sections.)*
- [ ] **Afo — dev environment + Luiz publish permissions by next meeting**; back on website next week; content-creation workflows to fill gaps + interconnect once structure calcifies
- [ ] **Rather — share Geo Protocol integration details** (SDK / abstracted Aragon interface / read API; IPFS + The Graph) with Koi for app interop; build a **job board** (collect resumes)
- [ ] **Infra — get more opinionated:** evaluate **Geo Protocol** + **AT Protocol** as connective tissue across everyone's work (Matty; Durgadas to dig in). *(Extends Infra Stack & Federation below — pairs with the Geo Browser review.)*
- [ ] **Frame-language audit** — Durgadas's Frame 1 warning ("governance/accountability" terms → structurally non-regenerative; *structure beats intention 100%*); audit the master doc **and** the framework, which is being built with those very terms
- [ ] **Luiz — invite Andrea** (ReFi Barcelona) to reprocess the ReFi BCN knowledge commons + her bioregional work (she's been away). *(Advances the Andrea/RegenOS thread below.)*
- [ ] **Grants subgroup** — Durgadas + Afo both looking for work; **Super Benefit** methodology as reference (Durgadas to raise over the next couple weeks)

### Framework Build — `packages/toolkit-framework` _(0.2.0 — THE MACHINE, shipped 2026-07-04)_

> **0.2.0 machine iteration DONE + merged + extracted** _(2026-07-04)_. The 0.1 skeleton became a functional ingestion machine: work-order pipeline (agents draft candidates → CLI accept gate → review queue → store), storage adapters (kb-folder/repo-data/geo-stub — ingestion≠storage), `init`/`federate` replication, 7 skills, first real ingestion (07-02 call → 10 objects). **100/100 tests**, merged to `regen-toolkit-os` (`a885d7f`), tagged `toolkit-framework-v0.2.0`, public repo [`luizfernandosg/toolkit-framework`](https://github.com/luizfernandosg/toolkit-framework). Spec+plan+log: [`docs/plans/framework-build/2026-07-04-machine-*.md`](docs/plans/framework-build/) · [`memory/2026-07-04.md`](memory/2026-07-04.md). The SP0–SP10 (0.1) history below is retained for provenance.



Executing the [framework build plan](docs/plans/framework-build/README.md) (SP0–SP11). The framework = a standalone, org-os-agnostic package (zero-build ESM + YAML + markdown) seeding a federated network of forkable-but-interoperable commons. Gap analysis + reconciliations: [`COVERAGE.md`](packages/toolkit-framework/docs/meta/COVERAGE.md) · [`RECONCILIATIONS.md`](packages/toolkit-framework/docs/meta/RECONCILIATIONS.md) · [`FEEDBACK-LOOPS.md`](packages/toolkit-framework/docs/meta/FEEDBACK-LOOPS.md).

- [x] **SP-DEC** — R1 (3-axis canonical state model) / R3 (kernel = ontology subset) / R7 (Octo-candidate, CSIS-informed) resolved
- [x] **SP0** — package scaffolded; validator + CLI; **12/12 tests green**
- [x] **SP1** — shared-schema keystones K1 (review-maturity) · K2 (source-system / return-path) · K3 (frontmatter) · K5 (contribution-record) + signal/provenance/public-use-boundary
- [x] **SP2** — semantic kernel: 15 frozen core types + 31 extensions (all `maps_to_core`) + unified relationships (R9 ✅) + MOK-5 + JSON-LD generator + fork-compat
- [x] **SP3/SP4** — 10 layer entry schemas + the compatibility engine (option/track/deployment)
- [x] **SP5** — 8 process docs (R6/R8/R10 ✅) · **SP6** — 3 agentic skills (capture-and-route, compose-journey, csis-review) · **SP7** — resource lift ETL · **SP8** — invariants validators · **SP9** — architecture + site docs (R4/R5 ✅)
- [x] **SP10** — `packages/org-os-kms` (module + org-os profile, framework pre-loaded; replaceable)
- [x] **✅ FRAMEWORK FULLY BUILT (SP0–SP10):** toolkit-framework **34/34 tests**, 21 schemas, 3 skills; org-os-kms 2/2. All R1–R10 resolved.
- [~] **★ Process toolkit content through the framework + public site** — site half DONE (framework + regen-toolkit-os pages live, now reflecting 0.2 the machine). **Week 1 next:** run Heenal's live content through the **0.2 ingestion pipeline** (`init --existing` → `ingest` → review) → populate the instance KB — the real self-ingestion, now that the machine exists. → now driven by [`framework-validation-pass`](docs/plans/framework-validation-pass.md) (V2 slice first, full 119 post-demo).
- [ ] **SP11 — first ReFi DAO adoption** (the dialectic / pipeline P9): `init` the framework into `../refi-dao-os` **from the public repo** (proves portability), process podcasts/blog through the pipeline, contribute back → framework v0.2.x. **org-os-kms → real module** developed against this adoption. *Week 1, after the reference-instance self-ingestion above.*
- [ ] **Batch the R1–R10 master-doc proposals** for Matty (Loop 2 — draft-and-present) + confirm with Durgadas/Rather at the biweekly

### Master Doc 2026-06-15 Iteration _(NEW 2026-06-16)_

- [ ] **Revise CSIS posture** (`docs/CSIS.md`) → "CSIS-Informed, Not CSIS-Conformant" + the 3-level model (Principles / Review prompts / Enforceable standards) + minimum enforceable safeguards. The new master doc formalizes this — resolves the long-standing "posture revision pending" flag.
- [ ] **Track the Knowledge-Lifecycle-vs-10-layers decision** — the new doc offers a Capture→…→Interoperate lifecycle spine as a *candidate* (Structure Options recommends "Small Core, Large Appendices + Lifecycle spine"). Don't pre-empt; surface at biweekly. **Do not rebuild the 10 per-layer docs/canvases until decided.**
- [ ] **Derive a Theory-of-Change artifact** from the new master doc's Problem/ToC section (now first-class) — 10-problem + updated 14-problem versions.
- [ ] **Layer-by-layer review** of the new iteration (Matty's recommended method — review by layer, not whole-system rewrite).

### Theory of Change / Revised Problem Statement _(NEW 2026-05-21 — still open)_

From Durgadas's "theory of build vs theory of change" challenge (260521). The new master doc answers much of it; the team-authored piece remains.

- [ ] **Author a revised problem + mission statement** (group; Heenal proposed) — derive ToC from Green Pill + ReFi DAO rather than invent fresh (Afo)
- [ ] Durgadas — circulate the **Idea Processor** (MELT-strategy) + the theory-of-build article
- [ ] Consider a tradeoff-triangle prioritization exercise to find the highest-leverage thing

### V1 Public Site (Heenal) _(NEW 2026-06-04)_

Heenal's simplified 3-journey site — **landed + live** at regen-web3-toolkit.vercel.app (merged main / PR #311). The usable "front door" of the three-artifact model.

- [ ] **Heenal — design the feedback / contribution pathway** for V1 (currently "not easy") — operationalizes "public ≠ commons"
- [ ] Heenal — continue page-by-page human review; keep it usable/practical
- [ ] Consider an **operational-contributor journey** (Rather — teams forming, picking up tools, acting; beyond "newcomer")
- [ ] **Matty — draft the hub/forum post** (pairs with V1; invites use + co-stewardship, not just announces)
- [ ] Reconcile V1 with the master-doc layers (Heenal flagged layers ~2 + 7; vertical mapping later)

### Resource Database V3 _(NEW 2026-06-16)_

Matty's V3 resource DB (June 13) staged at [`data/resources/`](data/resources/) — 28 sheets / 12,456 rows. Supersedes the April `data/resources.yaml` lift.

- [ ] **Full structured lift** (in Convergence above) — crosswalk-driven routing into the data model
- [ ] Clean tweet-text noise in `toolkit-layer-crosswalk` `toolkit_route` cells
- [ ] Wire the DB's **review queues** → master-doc safeguards (Public-Use Boundary, Source System Cards, Builder/Media safeguards) — these match open `docs/BACKLOG.md` items
- [ ] **Brandon — curation pass** now operates on the lifted V3 result (not the old April lift)

### Greenpill Network + Andrea / RegenOS _(NEW 2026-06-04)_

- [ ] **Afo — translate toolkit into the Greenpill Network site** ("garden → house" flow); link Greenpill → Toolkit; consider agent-skills for AI to reference the toolkit
- [ ] **Schedule the Andrea + RegenOS conversation** (Luiz) — bioregional knowledge (bioregioning.org / Recover) → contribution-governance + compensation protocols
- [ ] Luiz — share bioregioning.org + the maturity-index/stewardship excerpt to Telegram

### Master Doc 2026-05-15 Iteration _(NEW)_

- [ ] **Surface master overview canvas + per-layer canvases to team** via Telegram (Luiz — pre-2026-05-21 biweekly)
- [ ] **Layer ownership resolution** at ~2026-05-21 biweekly's persona/skill-card session:
  - L4 Concept & Idea Ecology — Matt (likely)
  - L7 Tracks & Composition — Heenal (returning; was Heenal pre-2026-05-06 drop)
  - L8 Implementation & Learning Memory — Koi (candidate; Bonfires substrate)
  - L9 Evolution Layer — Koi (candidate)
  - L10 Infrastructure & Substrate — Luiz (operator default)
- [ ] **Phase E.1 (`data/ontology/*.yaml` refactor)** — coordinate with Matt + Rather (post-2026-05-21)
- [ ] **Phase E.2 (`data/option-library.yaml` cross-walk)** — verify 9 categories align with new §9
- [ ] **Phase E.3 (`data/feedback-process.yaml` split)** — co-author with Koi for Bonfires substrate reference
- [ ] **Phase E.4 (`data/resources.yaml` re-lift)** — refactor `scripts/lift-resources.mjs` to use section anchors (iteration-stable); then re-lift against new §7
- [ ] **Phase E.6 (IDENTITY.md ownership refresh)** — post-2026-05-21 biweekly
- [ ] **Phase E.7 (ORG-OS.md one-pager rewrite)** — against 10-layer model + new core movement
- [ ] **Phase E.8 (Root-MD rename pass, ~30 files)** — single coherent commit, post-team-review
- [ ] **Phase F.1–F.4 (New lift scripts)** — `lift-options.mjs`, `lift-tracks.mjs`, `lift-concepts.mjs` + refactor `lift-resources.mjs`
- [ ] **Phase F.5 (`data/tracks.yaml` registry)** — new file (Tracks layer restored)
- [ ] **Pulse 1 retro** — write to `memory/2026-05-10.md` (still owed)

### RegenOS Documentation + Public Website _(NEW 2026-06-15)_

From the Matty + Luiz work session: RegenOS (the coordination layer above OrgOS instances — essentially what `regen-coordination-os` is) is only vaguely referenced in the master doc and needs a concrete written description + an approachable public surface. Target: **July**. See plan [`docs/plans/regen-os-documentation.md`](docs/plans/regen-os-documentation.md).

- [ ] **Luiz — draft RegenOS documentation** (what it is; coordination layer above OrgOS instances; upstream/downstream repo mapping; knowledge-source vs organizational federation as two distinct mechanisms; self-qualifying adoption as the federation filter). Target July.
- [ ] **Luiz — build a simple public website for RegenOS/OrgOS** (clean, non-manipulative, human-readable; could share the Astro repo). Target July.
- [ ] **Luiz — draft RegenOS description for the master-doc meeting-notes tab** (handful of sentences) — *external edit to Matty's Google Doc; draft-and-present before sending.*
- [ ] **Luiz — add the OrgOS overlay GitHub link** next to the RegenOS reference in the master doc — *external edit; editor access requested on the call.*
- [ ] **Luiz — write up RegenOS ↔ COOP / Geo Browser / COI / infra stack** for the new "More Opinionated Infrastructure" sub-tab — *external edit; draft-and-present.*

### Framework / Instance Split _(NEW 2026-06-15 — strategic)_

Decision (in principle) to formally split the work into a domain-agnostic **framework** (layers system, flows, processes, IA) + the **ReFi Web3 Toolkit as the first concrete instance**. Reshapes how the master doc + repos are organized. **Surface with the wider team — not executed unilaterally.**

- [ ] **Surface the framework/instance split to the team** at the next biweekly (reshapes master-doc + repo organization; ties to the eventual ~3 structural variants)
- [ ] Scope what "framework" vs "instance" means concretely for `docs/MASTER.md` + this repo (conceptual separation first; own-repo question deferred)
- [ ] **ReFi DAO as immediate use case** — use the framework to process ReFi DAO podcast episodes + blog posts (pending for months); output feeds back into the toolkit (Luiz)

### Infra Stack & Federation _(NEW 2026-06-15)_

Stack as discussed: OrgOS (foundational file system + agent instructions) → Radicle (P2P Git; planned) → COOP (intake/tagging, needs review pipeline) → COI (heavier; OrgOS covers many use cases foundationally) → visualization (Obsidian canvases for operators; Kumu from GitHub; static public website). Agreed: **simplify first, layer complexity later — don't settle on-chain now.**

- [ ] **Luiz — review Geo Browser** (geobrowser.io) — flagged as not-yet-reviewed; assess fit + slot into the infra write-up
- [ ] Radicle integration (P2P decentralized Git) — planned, not yet done (exploratory; Luiz keen)
- [ ] Fix the **maturity/confidence rating system** for tasks — addresses the known bug where agents pick up passing meeting mentions as high-priority follow-ups (raised again 2026-06-15)
- [ ] Repair the regen-coordination **Notion sync** — broke on the Notion CLI release (API change); affects `/initialize` DB sync

### ReFi Commons + Standards + Funding _(NEW 2026-06-15 — strategic)_

Coordination model: small bites (fundable working groups), not a big merger. Standards stack drives funding flows. Scale to high-trust orgs, not open calls.

- [ ] **Open the ReFi Commons home conversation** (Luiz + Matty) — coordinate with Green Pill IP roll-in
- [ ] **Identify the first working group both orgs agree is worth funding** (the "small bite" entry point)
- [ ] **Advance the standards stack** — CIDS + DAO IP5 (needs more figuring-out) + impact accounting/measurement tied to funding flows (specific, academically rigorous)
- [ ] **Map a path to seed an Impact Vault** ("Oct and Vault") from funding the master-doc work earns — Matty's compensation preference; reciprocity/acknowledgement thread (details in Matty's handoff doc)
- [ ] Scale outreach — ~5–7 existing high-trust orgs / known people (not open chapter calls) — *slow-burn; pairs with Matty*

### Master Doc & Handoff
- [ ] Matty — final master-doc push before Swarm participation (Friday noon hard deadline; Philadelphia wedding travel) — *carryover from 2026-04-23, reaffirmed 2026-05-07*
- [ ] Coordinate handoff — announce to team when the download/reupload is happening (avoid concurrent edits)
- [ ] Apply frame-language critique to master doc sections (Durgadas — next iteration)
- [ ] Resources tab (weakest layer) — dedicated collaborative organization session, timing TBD
- [ ] Team — individual layer ownership declarations (open invitation; see `IDENTITY.md` for current state — Tracks layer dropped in 2026-05-06 iteration; Heenal's ownership needs reassignment, Concept & Idea Ecology needs an owner)

### OrgOS Rollout — shared task management _(NEW 2026-05-07)_

Team adopted OrgOS (the existing org-os overlay on `feature/org-os-overlay`) as the team's shared task / contribution-tracking layer. Process: compile to-dos → allocate among team → execute through Kanban pipeline.

- [ ] **Luiz — stand up the shared task management surface.** Write a short onboarding note pointing team to `HEARTBEAT.md` + `packages/webapps/task-manager/` (Task Manager visual board); send to Telegram group.
- [ ] Add per-task owner field to `HEARTBEAT.md` items where missing (so Task Manager surfaces ownership cleanly)
- [ ] Decide: Task Manager web app vs upgrading to KOI-bridge once refi-dao Wave 2 ships

### Visual Architecture — Obsidian Canvas _(NEW 2026-05-07)_

Team adopted Obsidian Canvas as visual architecture mapping tool (Barcelona bioregional garden as worked example). Sharing limitation acknowledged (requires local Obsidian); web-based canvas remains exploratory carryover from 260212.

- [ ] **Luiz — sketch the toolkit architecture canvas** (new 8-layer Knowledge Commons Toolkit model: Ontology → Encyclopedia → Resource Graph & Atlas → Concept & Idea Ecology → Option Library → Deployment & Structural Integrity → Implementation Memory → Evolution + Cross-Cutting Systems). Land at `docs/canvases/toolkit-architecture.canvas`. Sketch-level pre-Pulse-1; polished version post-Pulse-1 once iteration stabilizes.
- [ ] Update outdated canvases (architecture / content structure / development workflow / master overview) — historic carryover from 260212; align with new master doc structure as part of Phase 3
- [ ] Web-based canvas visualization (no Obsidian required) — exploratory (raised 260212; still open)

### Knowledge Commoning Swarm _(NEW 2026-05-07)_

Pulse 1: 2026-05-09–10. Two-month hackathon follows. Toolkit reframed as a *contribution artifact* in the new master doc.

- [ ] **Luiz — join OpenCivics planning call** (today, post-biweekly — 2026-05-07) for Pulse 1 logistics
- [ ] Team — attend Pulse 1 (partial attendance acceptable; Matty out for Philadelphia wedding)
- [ ] Pre-Pulse-1: draft `00-README.md` + `05-tool-option-pattern-protocol-deployment-case.md` + `07-six-affordances-translation.md` for the Swarm Contribution Pack v0.1 (pure synthesis from new master doc)
- [ ] Pulse 1: observe what Swarm participants gravitate toward; adjust Swarm Contribution Pack v0.1 scope
- [x] **Toolkit vs "Transformational Journeys" framing tension — largely resolved toward journeys** (Koi raised 2026-05-07; reinforced 2026-05-21). Heenal's v1 site IS journey-based (3 onboarding journeys live). The "Knowledge Commons Toolkit" name persists for the master doc; the *public* surface is journey-framed. See V1 Public Site section.

### Persona / Game-Based Format _(SUPERSEDED 2026-05-21)_

~~Next planning call (~2026-05-21) restructured around persona/role cards + granular skill mapping.~~ **The 2026-05-21 call diverged into Durgadas's theory-of-change strategic check-in; the persona/skill-card game did not happen.** Folded into the Theory of Change / Revised Problem Statement workstream above.

### Research Framework — Evolution Layer _(NEW 2026-05-07)_

- [ ] **Koi — develop research framework document** (umbrella hypothesis + secondary questions + methodology + AI-audit data collection — modeled on Brazil Bonfires AI audit project)
- [ ] Cross-reference Bonfires (KOI stack) federation hook with `swarm-contribution-pack.md` Layer 7+8 deliverables — entity mapping (user/project/general) + cross-platform knowledge graph (Discord/Telegram) suggests a tight integration opportunity

### Knowledge Site (Layer 2 — Encyclopedia)
- [ ] Apply Matt's feedback on 4 articles: scams, seed phrases, wallet comparison, key terms (Heenal)
- [ ] Phase 2 — expand 43 medium articles through the 5-stage editorial pipeline
- [ ] Human review of all 67 published drafts
- [ ] Add real-world examples from approved source maps (Restor, Hylo, P2P Foundation, ReFi Ecosystem, Weavers, Second Renaissance)

### CSIS Integration (Layer 5/6 — Deployment & Structural Integrity)
- [ ] Encode Dunbar-number scaling research into next CSIS standards review (Durgadas)
- [ ] Encode six-directional responsibility model into next CSIS standards review (Durgadas)
- [ ] Make compressive vs generative standards explicit in Deployment Layer
- [ ] Define conformance posture (partial adoption vs full conformance) assessment framework
- [ ] Confirm whether existing CSIS × org-os Alignment Report covers new master doc's structural-integrity questions ("Who is represented? Who is absent? Who maintains it? Who may be exposed by visibility?") or needs supplementing (Durgadas — Phase 2)

### Hackathon — May (cross-layer)
- [ ] Invite Ethereum Localism folks via Telegram (Rather)
- [ ] Join Open Civics Consortium chat via website; coordinate hackathon invite (Luiz)
- [ ] Confirm Geo Protocol participation and format
- [ ] Set the hackathon date and format (knowledge-swarming hack)

### Ontology (now Layer 1 in new master doc — promoted from Layer 3)
- [ ] Formalize Rather's ontology as toolkit standard (adopt and propagate through metadata)
- [ ] Resolve V1 vs V2a vs V2b — implement doc recommendation (V1 base + V2b overlay)
- [ ] Reconcile new master doc's 25 working ontology object types with existing `data/ontology/*.yaml` (Phase 2 reconciliation)
- [ ] Adopt or map new master doc's 9 maturity states (`raw`, `to-place`, `draft`, `candidate`, `reviewed`, `field-informed`, `pattern-generating`, `deprecated`, `open question`) against existing `status` fields (Phase 2)

### Resource Graph (now Layer 3 — Resource Graph & Ecosystem Atlas)
- [x] Lift the 11+ domain URL lists from master doc into structured `data/resources.yaml` (mechanical pass — 2026-04-26; 738 entries, 285 URL-bearing, 50 domains)
- [ ] **Brandon — curation pass on `data/resources.yaml`** (dedupe, drop tag-as-resource bullets, fill URLs, classify)
- [ ] Re-run `scripts/lift-resources.mjs` against new `docs/MASTER.md` (Phase 3 — post-Pulse-1; idempotent — verify line ranges first)
- [ ] Clarify taxonomy vs ontology distinction (master doc line 181 flag)

### Tool / Option / Pattern / Protocol / Deployment / Case _(NEW 2026-05-07 master-doc-derived)_
- [ ] Cross-walk new master doc's 6-tier vocabulary against existing `data/option-library.yaml` 9-category scaffold (Phase 2 reconciliation)

### Historic carryovers (from backfilled meetings — needs team triage)

These surfaced from the meeting bootstrap (2026-04-26). Status of each is unclear; team should triage on next planning call:

- [ ] Drew Simon — share knowledge commons starter links + details in group chat (raised 260212; status unclear)
- [ ] Hub post about knowledge commons / federation collaboration (Afo — raised 260225; never confirmed sent)
- [ ] Bright community collaboration — concrete ideas + connection to toolkit (Luiz to discuss with Rather; raised 260212)
- [ ] Onboarding guides refresh: Local Node Onboarding + Network Initiative Onboarding (raised 260312; unclear status)
- [ ] Integrate Safe (smart wallet) content into the toolkit (raised 260312; unclear status)
- [ ] Style guide derived from ReFi DAO 200+ blog posts (raised 260212; partial existence — see `docs/writing-system.md`; cross-reference w/ `content-updates/heen-ai/add-planning-docs` branch's `content-style-guide.md` per Phase 4 reconciliation)

---

## System Health

### Site
- [ ] `npm run build` passes
- [ ] Live site reachable at regen-toolkit-site.vercel.app

### Data Integrity
- [ ] `data/ontology/` YAMLs align with master doc (now flagged for Phase 3 refactor)
- [ ] `data/option-library.yaml` reflects current 9 categories (cross-walk against new 6-tier vocabulary in Phase 2)
- [ ] `.well-known/` schemas match current data (run `npm run generate:schemas` after changes)

### Federation
- [ ] Last sync with upstream (see `federation.yaml`)
- [ ] Peer sync with regen-coordination-os
- [ ] Bonfires / KOI federation hook (Caue's stack) — explore tight integration via `mcp__regen-koi__*` for Evolution layer (raised 2026-05-07)

---

## Recently Completed

- [x] 2026-08-27 — **Rather granted GitHub org access** (★ 260806 blocker cleared) + **`knowledge-commons` repo discovered** (Afo, 08-23, empty shell — the "idea" from Matt's Aug 26 TG) + **Matty reply drafted** (repo status, clean-slate `main` proposal, yes to Matt on front-facing wording) + both Cloudflare surfaces verified live. Session: `memory/2026-08-28.md`.
- [x] 2026-07-22 — **T3b full Canonical_DB ingestion** — Matty's full curated DB run through the machine on the T4 schemas: 6 families (2,689 rows) → 2,957 objects + Discovery_Pool Priority Working Set (114 → 98 promoted) = **3,058 in `kb-handoff/`**, all raw/review-gated. Deterministic crosswalk-driven ETL (reproducible = his DoD #1), validated by the accept gate. B5 guard re-derived his exact dup-flags (42 collision sets); DoD #15 row-accounting + B5-vs-87-flags reconciliation in [`docs/reports/2026-07-21-canonical-migration-manifest.md`](docs/reports/2026-07-21-canonical-migration-manifest.md). Plan surface consolidated to one active spine. Committed `6ff1406a` → pushed. Scripts: `scripts/validation/{export-handoff-full.py,map-handoff-full.mjs,map-discovery-priority.mjs}`.
- [x] 2026-07-16 — **2026-07-16 meetings processed** (Matty 1-on-1 + biweekly planning call): both source notes fixed (frontmatter + processed pointer) + synthesized notes at `packages/operations/meetings/260716 *.md`; `data/meetings.yaml` +2 (`mtg-20260716-regen-web3-toolkit-planning` + `mtg-20260716-toolkit-worksession-matty`); `memory/2026-07-16.md` written; MEMORY.md (Key Decisions +5, History +1); HEARTBEAT new "2026-07-16 biweekly + Matty 1-on-1" section; integration report `docs/reports/2026-07-16-planning-call-integration.md`; parked items routed to `docs/BACKLOG.md`. **Framework build done + dev→prod pipeline live** is the headline. Attribution correction logged (CRAFT/Temper demo = Durgadas, not Rathermercurial per the auto-summary).
- [x] 2026-06-16 — **Gap-fill + master-doc intake**: 2026-05-21 + 2026-06-04 biweeklies processed (notes + registry, now 10 meetings); **new master doc 2026-06-15 working iteration saved canonical** (30,847 lines; 2026-05-15 archived; raw preserved; `MASTER-DOC-CHANGES-2026-06-15.md` diff); **resource DB V3 staged** (`data/resources/` — xlsx + 28 CSVs / 12,456 rows + manifest). Stale threads resolved (persona-game superseded; journeys tension resolved; v1 site landed). Convergence (site merge, branch cleanup, framework/instance, full resource lift) parked behind operator checkpoint. Integration report: `docs/reports/2026-06-16-gap-fill-and-master-doc-intake-integration-report.md`.
- [x] 2026-06-16 — **2026-06-15 Matty + Luiz work session processed** (refi-bcn-os `meeting-processor` pipeline): source note frontmatter fixed + processed pointer; synthesized note at `packages/operations/meetings/260615 Toolkit Work Session with Matty.md`; `data/meetings.yaml` +1 (`mtg-20260615-toolkit-worksession-matty`); `memory/2026-06-16.md` written; MEMORY.md (Key Decisions +5, History +1, Active Context + Relationship Map refreshed); HEARTBEAT 4 new sections (RegenOS docs, framework/instance split, infra stack, ReFi Commons/standards); new plan `docs/plans/regen-os-documentation.md` + QUEUE updated; integration report at `docs/reports/2026-06-15-toolkit-worksession-matty-integration-report.md`. Notion phases N/A (sync broken + toolkit doesn't run Notion as primary); operator weekly/monthly distribution offered (not auto-written).
- [x] 2026-05-15 — **Master doc 2026-05-15 stabilization-draft iteration processed**: new MASTER.md saved canonical (24,776 lines); 2026-05-06 archived; `MASTER-DOC-CHANGES-2026-05-15.md` diff written; integration plan at `docs/plans/master-doc-iteration-may-15-2026.md`; 10 per-layer docs at `docs/layers/`; 10 per-layer Obsidian canvases at `docs/canvases/layers/`; master overview canvas at `docs/canvases/regen-knowledge-commons-toolkit-master.canvas`; LAYERS.md rewritten against 10-layer model; MEMORY.md + HEARTBEAT.md + QUEUE.md refreshed; `memory/2026-05-15.md` written.
- [x] 2026-05-07 — 2026-05-07 biweekly processed: source note fixed (frontmatter populated, Concluded → true), structured note at `packages/operations/meetings/260507 Regen Web3 Toolkit Planning Call.md`, `data/meetings.yaml` updated (260507 added + 260423 backfilled), `MEMORY.md` updated, plans + queue reflected.
- [x] 2026-05-06 — Master doc 2026-05-06 iteration intake: new MASTER.md (renamed Knowledge Commons Toolkit, ~13.7k lines) saved canonical; previous archived; `MASTER-DOC-CHANGES.md` written; iteration-checkpoint banners on `LAYERS.md` + `ORG-OS.md`; sharing pack sent to Telegram; two new plans queued (`master-doc-iteration-may-2026`, `swarm-contribution-pack`).
- [x] 2026-04-26 — Resources lift: 738 entries extracted from `MASTER.md` (lines 1089–2668) into `data/resources.yaml` via `scripts/lift-resources.mjs`. Layer 1 source-of-truth file now exists; Brandon-curation handoff queued.
- [x] 2026-04-26 — `docs/ORG-OS.md` (operator one-pager, <500 words) + `docs/LAYERS.md` (per-layer status for all 8 layers); README, MASTERPLAN, IDENTITY cross-linked.
- [x] 2026-04-26 — Meeting history backfilled from personal vault (5 meetings: 260115, 260129, 260212, 260225, 260312) into canonical `packages/operations/meetings/` layout; MEMORY.md "Organizational History" populated
- [x] 2026-04-25 — CSIS + KOI design specs mirrored into toolkit (`docs/from-regen-coord/`, `docs/from-refi-dao/`); toolkit-side plan queue established
- [x] 2026-04-24 — org-os overlay landed on `feature/org-os-overlay` (this instance now operates as its own org-os)
- [x] 2026-04-23 — Rather's ontology adopted as toolkit standard; biweekly processed.
- [x] 2026-03-26 — Astro site migrated into monorepo (PR #304)
- [x] Ontology extracted to `data/ontology/` (4 YAMLs)

---

_Last updated: 2026-08-28 (catch-up: Rather org access done; knowledge-commons shell repo surfaced; Matty reply drafted — repo-role alignment + clean-slate `main` spec are next)_
