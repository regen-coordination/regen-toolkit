<!-- scripts/linear/__tests__/fixtures/HEARTBEAT.fixture.md
     Verbatim slice of the real HEARTBEAT.md (2026-08-06 engineering sync through Handoff
     Integration, inclusive) frozen at commit 733c87b5, followed by a few synthetic lines for
     shapes the real slice doesn't happen to contain (due date, a mid-line bold decoy with no
     leading hint, an asterisk-italic parked note). Frozen so this fixture cannot drift when
     the living HEARTBEAT.md changes — see heartbeat.test.mjs for what each shape is pinning. -->
# HEARTBEAT.md — fixture

## Active Tasks

### 2026-08-06 engineering sync — process infrastructure landed _(★ NEW 2026-08-06)_

Notes: [`260806 Regen Toolkit Engineering Sync.md`](packages/operations/meetings/260806%20Regen%20Toolkit%20Engineering%20Sync.md) · Integration report (shareable): [`docs/reports/2026-08-06-engineering-sync-integration.md`](docs/reports/2026-08-06-engineering-sync-integration.md). Attendees: Afo, Matty, Luiz, Rather, Regis (Durgadas).

**The call where the merge blocker got an answer.** Three adoptions in one hour — **Linear** (PM, Afo leads), **Cloudflare Workers** (hosting, Rather), and a **dedicated coordination group** (Afo). Repo merge sliced into **four ordered phases**. The new gate is **contribution-readiness**: stabilise dev + prod as mirrors so others can contribute, and hold the heavier org-os work on its own branch until then.

> ⚠️ **Supersedes two 07-16 items.** The **Netlify dev build** ask to Hina is replaced by **Cloudflare branch previews**; **GitHub Projects** is replaced by **Linear**. See the 07-16 block below for the struck items.

> **Identity resolution:** **Regis Chapman = Durgadas** ("Das"/"Dodos"; `deradosmack.com`). The 07-16 note listed them as two separate participants — they are one person. Merge in all future participant lists.

**The four merge slices** (Afo's analysis, adopted): 1 framework + schemas w/ existing tests → 2 deterministic generators + validation commands → 3 public-safe aggregate data + selected Astro surfaces → 4 reviewed knowledge objects *only after the promotion gate*. Keep internal org-os coordination material out of the production projection.

- [ ] **Luiz — grant Rather GitHub org access** — ★ **unblocks the Cloudflare setup**, which is now the whole dev-review surface. — `task-260806-luiz-rather-org-access`
- [ ] **Luiz — seed Linear from the `regen-toolkit-os` branch** — set up the Linear ↔ repo integration; populate issues from the processed session/meeting notes. Runs in parallel with Afo's seed from the call notes + GitHub import. — `task-260806-luiz-linear-seed-repo`
- [ ] **Luiz — execute the four-slice merge** — slices 1–3 land in dev **and** prod to open the contribution pathway; slice 4 waits on the promotion gate. — `task-260806-luiz-four-slice-merge`
- [ ] **Luiz — build the knowledge-source → commons → orgs flow visualisation** — Afo's explicit ask: how sources flow **into** the commons and back **out** to the orgs. Per-intake mappings exist; **the whole-system map does not.** Feeds `task-260716-luiz-canvas-viz-intro-doc`. — `task-260806-luiz-knowledge-flow-visual`
- [ ] **Luiz — put engine/reprocessing validation on Linear** — validate the framework package + the reprocessing system already built; identify needed adjustments. — `task-260806-luiz-engine-validation-linear`
- [ ] **Luiz — host the dedicated org-os session** — the **call after next** (next week is Afo's Linear/GitHub session). How org-os works + how instances federate reviewed content upstream into the commons. — `task-260806-luiz-orgos-session`
- [ ] **Luiz — confirm the Linear account email** (Gmail, per the call) so accounts don't fragment across workspaces. — `task-260806-luiz-linear-email`
- [ ] **Rather — set up Cloudflare Workers hosting** (after org access) — branch previews + built-in CI/CD + merge controls on `main`. **⚡ 2026-08-08: bootstrapped by Luiz** — Option B live under Luiz's personal Cloudflare account: **prod** `regen-toolkit.luizfernandolfsg.workers.dev` (main @ `4bf9cecf`, 124 pages) + **dev** `regen-toolkit-dev.luizfernandolfsg.workers.dev` (regen-toolkit-os, 3,931 pages); `wrangler.jsonc` on the dev branch. **Remaining for Rather:** dashboard git-connection (build-on-push), account handover/transfer, custom domain on prod. See `memory/2026-08-08.md`. — `task-260806-rather-cloudflare-setup`
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

### Synthetic edge cases (not in the real file — added for coverage; see heartbeat.test.mjs)

- [ ] **Luiz — file the Q3 infra report** (due: 2026-09-01) — `task-990101-luiz-q3-infra-report`
- [ ] Loop in **Rather — the Cloudflare lead** before scheduling the call.
- [ ] *(Parked — same gap as `task-260716-luiz-agent-onboarding-onepager`, kept off the active list.)*
