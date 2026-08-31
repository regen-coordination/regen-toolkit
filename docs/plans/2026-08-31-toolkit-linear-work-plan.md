# Toolkit work plan — facilitated by Linear

> **Status:** active · **Created:** 2026-08-31
> **Board:** [Regen Coordination](https://linear.app/regen-coordination) · teams `KC` + `GROW`
> **Companion:** [`docs/reports/2026-08-31-linear-board-reconciliation.md`](../reports/2026-08-31-linear-board-reconciliation.md)

Linear carries the **issues, status and sequencing**. This repo carries the **reasoning**. Where
this plan and the board disagree about *state*, the board wins; where they disagree about *why*,
this file wins.

---

## Position on the board after 2026-08-31

Before today: **1 issue assigned to Luiz** across the whole workspace, and it had been finished a
month earlier. After: **12**, across the two projects he leads plus two claimed from the V1 lane.

| Action | Issues |
|---|---|
| Self-assigned | KC-1, KC-2, KC-3, KC-4, KC-6, KC-11, KC-14, KC-31 |
| Created | KC-34, KC-35, KC-36, KC-37 |
| Reassigned to Afo | KC-8 (repo records it as `task-260806-afo-linear-seed`) |
| Closed | GROW-16 — Discourse migration, done 2026-07-29, evidence in the comment |
| Reopened as started | KC-6 — Backlog → In Progress, with a comment splitting done from not-done |

**Deliberately not done:** no cycle assignments (Linear owns cycle position — propose, don't
impose), no bulk seed.

### Retracted the same day — a boundary this plan now holds

A comment was posted on **KC-5** — Rather's issue, which *he* had closed — and he was @-mentioned
on KC-37. He objected: *"productivity theater from your agent"*, *"Do not EVER plan under an issue
without the assignee's permission"*, *"stop planning on my issues FOREVER."*

**He was right on process.** Operator approval is not the issue owner's consent. The comment was
deleted, the mention stripped from KC-37, and short replies posted owning it.

**The rule from here:** check `assignee` and `createdBy` before any Linear write. If either is
someone else, surface it rather than writing. Leading a project is not authorship of its issues.

Two things survived the retraction, and both matter for the review below:

- **His technical objection is a live disagreement, not an error** — see KC-6. He designed one
  Worker with branch previews; the two-Worker split was a 2026-08-08 operator call. His model may
  well be the better one.
- **The KC-37 finding was re-verified before responding** and holds: `regen-toolkit.superbenefit.dev`
  is live production and serves `explorience/regen-toolkit` links. Being right did not license how
  it was raised — but the defect is real and is now a branch instead of a board argument.

---

## Two lanes

### Lane A — Contribution pathway · *Repo Stabilization & Contribution Pathway*, target 2026-09-30

The commitment with a date on it. Opens the pathway that lets anyone other than us contribute.

```
KC-34  spec the clean-slate `main` move        ← blocks KC-6
  │
  ├── KC-11  validate the consolidated engine   (feeds the slice work)
  │
  ├── KC-1   slice 1 · framework + schemas      ─┐
  ├── KC-2   slice 2 · generators + validation   ├─ slices 1–3 land in dev AND prod
  ├── KC-3   slice 3 · public-safe aggregate    ─┘
  │
  ├── KC-6   dev/prod are genuine mirrors        ← closes when KC-34 is executed
  └── KC-4   slice 4 · content layer → R2        ← gated on KC-25 (Afo's publish mode)
```

**The one thing to get right:** KC-34 is a *spec*, not an execution. The failure mode on the
clean-slate move is ordering, not difficulty — rebuild `main` in the wrong order and the public
site goes blank or publishes unreviewed content, in the same weeks partners are being invited to
consume it in V1.

**KC-4 has moved and the repo registry is stale on it.** It is no longer "merge reviewed knowledge
objects." It is now *wire the Astro content layer to the R2 published state* — knowledge objects
never land in the repo; they live in Geo, sync to R2, the site reads them. Two decisions moved it:
ratification went onchain (the DAO vote is the promotion gate, so merging stopped being review),
and R2 became the state layer. It depends on Afo's KC-25.

### Lane B — Org OS · *Org OS Implementation*, no hard date

Runs in parallel. Respects Monty's constraint from 08-27: `main` stays clean, prove value before
proposing a merge.

```
KC-35  branch a lightweight org-os instance off `knowledge-commons`, test it
  │
  ├── KC-36  integrate `knowledge-commons` into `regen-coordination-os` + workshop moment
  │
  └── KC-14  host the Org OS demo session      ← blocked by KC-35; needs something to demo
```

Before today this project held **one** issue. It now holds three, with the dependency chain
explicit on the board.

### Also claimed, in Afo's V1 lane

- **KC-11** · validate the consolidated engine package — `task-260806-luiz-engine-validation-linear`
- **KC-31** · decide with ReFi DAO which toolkit is upstream — Luiz owns that relationship. High
  priority, cycle 3. Two toolkits covering the same ground for the same audience is how a commons
  loses credibility; the cost of merging rises with every page added on either side.

---

## Proposed cycle placement (not applied — needs a call)

Cycle 2 `08-28 → 09-11` · cycle 3 `09-11 → 09-25` · cycle 4 `09-25 → 10-09`.
Repo Stabilization targets **09-30**, mid-cycle-4.

| Cycle | Lane A | Lane B |
|---|---|---|
| 2 (11 days left) | KC-34 spec | — |
| 3 | KC-1, KC-2, KC-11 *(already scheduled)*, KC-31 *(already scheduled)* | KC-35 |
| 4 | KC-3, then KC-6 closes | KC-36 |
| 5+ | KC-4 — gated on KC-25 | KC-14 |

KC-4 slipping past 09-30 is legitimate, not a miss: it depends on Afo's publish mode. Worth saying
out loud at the council rather than letting the target quietly fail.

---

## Issue-by-issue — the review surface

Thirteen issues assigned. Each entry decodes what the issue actually is, what doing it means, and
what could go wrong — so this can be reviewed once, thoroughly, before anything executes.

**Read the four flags first.** They are the difference between this being a work queue and a
sequencing trap:

| Flag | Issues affected |
|---|---|
| 🔴 **Architecture unsettled** — Rather disputes the two-Worker design | KC-6, KC-34, KC-37 |
| 🔴 **Blocked on a decision nobody has made** — framework vs v0 ontology | KC-1, KC-11 |
| 🟡 **Third party required, not yet asked** | KC-4 (Afo), KC-31 (ReFi DAO), KC-34 (Heenal) |
| 🟡 **No estimate** — cycle placement is guesswork until set | KC-1, KC-2, KC-3, KC-4, KC-6, KC-14 |

---

### KC-37 · Prod site points at the wrong GitHub org
`Urgent · est 2 · Backlog · blocks KC-34` — **branch ready, unpushed**

**What it is.** The live site links "Contribute on GitHub" to `explorience/regen-toolkit`. Five
occurrences across `astro.config.mjs`, `src/layouts/Page.astro`, `src/pages/index.astro`. The
rename commit `a38d5d41` landed only on `regen-toolkit-os`.

**Ready to go.** Branch `fix/prod-github-org-links`, one commit off `origin/main`, 5 lines / 3
files. Built in a disposable worktree; nothing else touched.

```
git push -u origin fix/prod-github-org-links
gh pr create --base main --title "fix(site): point prod GitHub links at regen-coordination, not explorience"
```

**🛑 ON HOLD — do not merge yet (D6/D9, 2026-08-31).** The assumption behind this issue was that
merging to `main` triggers a prod deploy via build-on-push. **That is now in doubt.**

`regen-toolkit.luizfernandolfsg.workers.dev` **no longer responds** — two 40-second curl timeouts
plus a WebFetch failure, after serving content earlier the same session. The sibling Worker
`regen-toolkit-dev` on the same account returns 200 in under a second, so this is not a network or
account problem. DNS still resolves, but on a different Cloudflare IP range from the working hosts
— the pattern you get when a hostname matches the `workers.dev` wildcard with no Worker bound to it.

**The live production site is `regen-toolkit.superbenefit.dev`** (200, serving the stale
`explorience` build). That is not the Worker in question, and it is not on infrastructure this repo
demonstrably controls.

**Consequence:** merging this PR might fix nothing at all. Before merging, establish (operator, in
the Cloudflare dashboard — I cannot see it):

1. Does the `regen-toolkit` Worker still exist under the personal account? Deleted, disabled, or
   workers.dev subdomain turned off?
2. **What actually builds and serves `regen-toolkit.superbenefit.dev`** — whose account, which
   project, which branch?
3. If it deploys from `main`, this PR fixes it. If not, the fix has to go wherever that build lives.

The branch is ready and costs nothing sitting there. Merging blind is the only bad option.

**Deliberately excluded.** Four non-rendered `explorience` refs remain on `main` — `CONTRIBUTING.md`,
`scripts/sync-issues-to-frontmatter.ts`, `skills/SKILL.md`, `skills/regen-toolkit/SKILL.md` (that
last one is a `git clone` URL that resolves to nothing). Each is a one-line fix; decide whether they
ride along as a second commit. Historical records left alone on purpose.

**Done when** the live site's GitHub links resolve to `regen-coordination/regen-toolkit`, verified
against the deployed site rather than a local build.

---

### KC-6 · Mirrored dev & prod instances
`High · no estimate · In Progress · blocked by KC-34` — 🔴 **scope contested**

**What it is.** *"Production tracks main; development tracks the OS branch. Stabilize both to be
mirrors."* The hosting half has been live since 08-09. The mirror half is not: prod is ~124 pages
of Heenal's build, dev is 3,931 framework-processed pages.

**🔴 Do not execute yet.** Rather's position: *"We do NOT need a staging environment. It's already
built-in to the site. Do not EVER suggest split staging/production instances."* He designed this as
one Worker with branch previews; the two-Worker Option B was a 2026-08-08 operator call, on the
grounds that dev renders `/validation`, `/kb` and handoff pages that shouldn't reach prod. **His
counter has merit — preview URLs are not prod.** He owns the hosting.

**Resolve the architecture first, then this issue is one of two different jobs:**
- *If Rather's model wins:* tear down `regen-toolkit-dev`, configure branch previews, and this
  becomes "make `main` deployable and previews visible." Smaller.
- *If Option B stands:* keep both Workers and this stays as written.

**Watch for.** The issue text assumes the two-instance model. If the architecture changes, the
issue needs rewriting, not just closing.

**Done when** dev and prod are mirrors under whichever architecture is agreed — and the agreement
is written down somewhere other than a Linear comment.

---

### KC-34 · Spec the clean-slate `main` move
`High · est 4 · Backlog · blocked by KC-37 · blocks KC-6`

**What it is.** A written sequence for `main` becoming a curated projection of the
framework-processed corpus, ordered so prod never goes blank. **A spec, not an execution.**

**What doing it means.** Decide: which subset of 3,931 pages is the curated projection; where
Heenal's content lives afterwards; the step order; who signs off before the merge.

**🟡 Heenal is not on this issue and should be.** It is her content being branched. The issue says
"Heenal content → own branch (nothing lost)" as if it were a mechanical move; it is a decision
about someone else's work. **Ask her before writing the spec, not after.** This is the same mistake
pattern as the Rather episode — deciding the disposition of another person's work without them.

**Watch for.** Scope creep into execution. The value is in the ordering being reviewable *before*
anything runs.

**Done when** a named reviewer has signed off on a sequence that can answer "what does the public
site show right now" at every step.

---

### KC-1 · Merge slice 1 — framework & schemas
`High · no estimate · Backlog` — 🔴 **blocked in substance, not on the board**

**What it is.** Merge `toolkit-framework` and its schemas into develop with passing tests. On the
board this is the *only* issue that represents the framework build as a thing that exists.

**🔴 The unmarked blocker.** KC-18 is pinning a v0 ontology (11 classes / 12 predicates) while this
merges the framework's 15 core types + 31 extensions. If v0 supersedes the framework kernel, this
merges something about to be replaced. **The question is posted on KC-18 and unanswered.** Merging
before it resolves risks either wasted work or two type systems over one corpus.

**Watch for.** KC-1's own description says "version pinning follows in KC-10" — so the board already
sequences this into the Zod convergence. That sequencing assumes the framework's schemas are an
input to v0, which is exactly the assumption nobody has confirmed.

**Done when** the framework and schemas are in develop, tests green — *and* their relationship to
v0 is written down.

---

### KC-2 · Merge slice 2 — deterministic generators & validation
`High · no estimate · Backlog · depends on KC-1`

**What it is.** Generators and validation commands run reliably from develop, so content processing
is reproducible for any contributor. Lower risk than KC-1 — mechanics, not semantics.

**✅ Confirmed safe to ship (2026-08-31).** Checked: 4 of 5 generators have no framework or ontology
import at all; `gen-framework-manifest.mjs` reads the framework only to snapshot its API to JSON for
the site to display — a rendering bridge, not a type dependency. All four validators
(`validate-identity`, `validate-structure`, `compile-knowledge`, `lint-knowledge`) are clean. **This
does not inherit KC-1's ontology exposure and can land while D1 is open.** It is the safest thing to
start with.

**Watch for.** One real coupling: if the framework package is ever removed rather than revised,
`gen-framework-manifest.mjs` breaks. That is a supersession risk, not a schema risk.

**Done when** validation commands run clean against existing repo content.

---

### KC-3 · Merge slice 3 — public-safe aggregate data & Astro surfaces
`Medium · no estimate · Backlog · depends on KC-2`

**What it is.** Public-safe aggregate data and selected Astro surfaces render from develop, giving
contributors a visible site to build against.

**Watch for.** "Public-safe" is doing real work in that sentence — this is the privacy gate.
Internal org-os coordination material must stay out. Interacts with KC-34: what renders here is
close to what the curated projection becomes.

**Done when** a preview build renders the selected surfaces without errors and nothing internal
leaks.

---

### KC-4 · Merge slice 4 — content layer → R2
`Medium · no estimate · Backlog · depends on Afo's KC-25` — 🟡 **third party**

**What it is. Reframed twice; the repo registry is stale on it.** No longer "merge reviewed
knowledge objects." Now: wire the Astro content layer to the R2 published state. Knowledge objects
never land in the repo — they live in Geo, sync to R2, the site reads them. Ratification went
onchain (the DAO vote became the promotion gate, so merging stopped being review) and R2 became the
state layer.

**🟡 Not startable.** Depends on KC-25 (Afo) writing state to R2, and on the Astro rebuild. Likely
slips past the 09-30 target — **legitimately**, but say so at the council rather than letting the
target quietly fail.

**Done when** the site renders published knowledge objects sourced from R2, schema-conformant, with
provenance intact, and no knowledge objects committed to the repo.

---

### KC-11 · Validate the consolidated engine package
`Medium · no estimate · Todo · cycle 3` — 🔴 **the framework↔v0 mapping lands here**

**What it is.** Validate the framework + skills against real workflows and log needed adjustments.

**Why it matters more than its title.** This is the natural home for the framework-to-v0 mapping —
which of the 15 core types collapse into the 11 classes, via `maps_to_core`. That work is only
worth doing once KC-18 answers whether v0 is a reduction of the kernel, an independent derivation,
or a supersession.

**Watch for.** Doing the mapping speculatively before the decision. Offer the type-by-type
comparison as input to the decision instead.

**Done when** the engine has run against a representative content set, output compared to schema
and to human expectation, adjustments logged as sub-issues.

---

### KC-31 · DECIDE with ReFi DAO — which toolkit is upstream
`High · no estimate · Todo · cycle 3` — 🟡 **needs a counterpart**

**What it is.** `docs.refidao.com` hosts a Local Node Toolkit covering substantially the same ground
as the Regen Toolkit. Two toolkits, same audience, maintained separately. Three viable answers:
Regen Toolkit upstream and ReFi renders a slice; ReFi upstream for node-specific material and the
commons ingests it; or genuinely different audiences and both continue.

**Why it is yours.** You hold the ReFi DAO relationship and run `refi-dao-os`. You are also the
person who would notice this is the same question as framework-vs-v0, one layer out: *who is
upstream of whom.*

**🟡 Needs a named counterpart at ReFi DAO** — not just an owner here. That ask has not been made.

**Watch for.** Cost rises with every page added on either side. And ReFi is one of only two partner
integrations in V1 (KC-29) — starting that relationship on an unacknowledged duplication is a bad
footing.

**Done when** the decision is recorded and both sides have named it.

---

### KC-35 · Branch a lightweight org-os instance off `knowledge-commons`
`Medium · est 4 · Backlog · blocks KC-36 and KC-14`

**What it is.** A running org-os instance on a branch, demonstrated against real work. Deliberately
not a merge and not a proposal — Monty's constraint: `main` stays clean, prove value first.

**What doing it means.** Branch off `knowledge-commons` (A-lite role: API code, schemas, ontology
configs, validation logic), pull in `packages/org-os-kms` (SP10, already tested), run it against
real content.

**Watch for.** Scope. "Lightweight" and "what V1 needs" are the constraint — the full org-os surface
is not the goal. Also: if this surfaces a conflict with v0, raise it on KC-18, don't resolve it here.

**Done when** the instance runs and someone other than you can open it and see what it does.

---

### KC-36 · Integrate `knowledge-commons` into `regen-coordination-os`
`Medium · est 4 · Backlog · blocked by KC-35`

**What it is.** Two halves — wire the commons into the coordination OS, *and* find the workshop
moment where the group actually uses it.

**The second half is the hard one.** Integration nobody is present for produces a working system
nobody adopts. The moment is as much the deliverable as the wiring.

**Watch for.** This touches knowledge-source federation vs organizational federation — two different
mechanisms. Where it forces a choice, record it rather than deciding unilaterally.

**Done when** the instance resolves against `knowledge-commons`, a date exists, and someone else
has used it in that session.

---

### KC-14 · Host the Org OS demo session
`Medium · no estimate · Backlog · blocked by KC-35`

**What it is.** Attendees leave able to reason about running an instance — per-community, personal,
local review browsers, upstream federation.

**Watch for.** Blocked for a reason: there is currently no instance to demo. The repo notes
scheduling this ~2 weeks out, once you are back in Brazil. Artifact goes into the commons as ore;
learnings seed this project's next issues.

**Done when** the session has happened and its notes are in the commons.

---

### GROW-16 · Discourse migration — ✅ Done
`Closed 2026-08-31 with evidence`

Completed 2026-07-29. Hetzner self-host, ~$1,100/yr saved, 7-day stability check passed 08-05.

**Four things it surfaced that nothing tracks:**
- Hub ops handoff to Afo and Matty (account access, runbook, monthly rebuild rotation)
- Offsite backups to Cloudflare R2 — backups currently sit on the same server
- Uptime monitoring and alerting
- **`regencoordination.xyz` expires 2026-10-10** — Namecheap, Monty is registrar owner. If it
  lapses the hub goes down regardless of hosting. **Six weeks out and on no board.**

---

## Suggested execution order

Given the flags, the sequence that unblocks the most while waiting on other people:

1. **KC-37** — push the branch, confirm the wrangler question, merge. Independent of everyone.
2. **Ask three questions in parallel** — Rather on the Worker architecture (unblocks KC-6/KC-34),
   Afo on KC-18 (unblocks KC-1/KC-11), Heenal on her content (unblocks KC-34).
3. **KC-2** — if the generators are not schema-coupled, the safest thing to ship while waiting.
4. **KC-35** — the entire Org OS lane depends on nobody else. Fully parallel.
5. Everything else follows from the answers.

**The honest read:** of 12 open issues, **five are blocked on questions that have not been asked**,
and only KC-37 and KC-35 can move today without someone else's input. Asking the three questions is
worth more this week than any amount of merging.

---

## Decision log

Most of the critical path is **questions**, not work. This is where answers land — without it, a
reply from Afo lives in a Linear comment and never reaches the plan.

| # | Question | Asked of | Asked | Status | Unblocks |
|---|---|---|---|---|---|
| D1 | Framework 0.2.0 vs the v0 ontology — kernel, superseded, or parallel? | Afo | ✅ 2026-08-31, comment on KC-18 | **awaiting reply** | KC-1, KC-11 |
| D2 | One Worker with branch previews, or two Workers? | Rather | ⚠️ partially — conceded on KC-5, no answer yet | **awaiting reply** | KC-6, shapes KC-34 |
| D3 | How should Heenal's content be handled in the `main` cutover? | Heenal | ❌ not asked — draft ready | **blocked on sending** | KC-34 |
| D4 | Named counterpart at ReFi DAO for the upstream decision | ReFi DAO | ❌ not asked | — | KC-31 |
| D5 | Does Durgadas want Integrity Suite Integration populated? | Durgadas | ❌ not asked | — | that project (0 issues) |
| D6 | Which `wrangler.jsonc` drives prod? | verify directly | ⚠️ **checked 2026-08-31 — answer is neither, see R4** | **KC-37 merge is on hold** | KC-37 merge |
| D9 | Is the prod Worker `regen-toolkit` deleted, disabled, or down? Who/what serves `regen-toolkit.superbenefit.dev`? | Cloudflare dashboard — operator only | ❌ not checked | **blocks KC-37** | KC-37, KC-6 |
| D7 | Repo → Linear or Linear → repo: which is authoritative? | 09-04 council | ❌ not raised | — | the seeding pipeline's future |
| D8 | Do the four non-rendered `explorience` refs ride along on the KC-37 PR? | operator | ❌ open | — | KC-37 scope |

**Resolved**

| # | Question | Answer | Date |
|---|---|---|---|
| R1 | Are slice-2 generators/validators ontology-coupled? | **No.** 4 of 5 generators have no framework import; `gen-framework-manifest.mjs` only snapshots the framework API to JSON for the site to display (a rendering bridge, not a type dependency); all four validators are clean. **KC-2 is safe to ship while D1 is open.** | 2026-08-31 |
| R2 | Are the empty initiative owners a gap? | **No** — deliberate. Afo's structure doc: *"no owner until the council assigns stewardship."* | 2026-08-31 |
| R3 | Is the prod `explorience` defect real, or agent error? | **Real**, re-verified on `regen-toolkit.superbenefit.dev` after the pushback. Live prod, wrong org links. | 2026-08-31 |
| R4 | Does merging `main` deploy to the live prod site? | **Unknown — and probably not.** `regen-toolkit.luizfernandolfsg.workers.dev` **stopped responding** on 2026-08-31 (2× 40s curl timeouts + WebFetch failure, after succeeding earlier the same session). Its sibling `regen-toolkit-dev` on the same account returns 200, so this is not an account or network problem. DNS resolves on a different Cloudflare IP range (188.114.96/97) from the two working hosts (172.67/104.21) — consistent with a hostname resolving via the workers.dev wildcard with no Worker bound. **The live production site is `regen-toolkit.superbenefit.dev`, and it is not that Worker.** So neither committed `wrangler.jsonc` is demonstrably what serves prod. | 2026-08-31 |

---

## Estimates — set 2026-08-31

Afo's convention: exponential, 1 small → 8 big, never 16.

| Issue | Est | Reasoning |
|---|---|---|
| KC-1 | 4 | Framework is built; this is the merge into develop with tests |
| KC-2 | 2 | Mechanics only — confirmed not ontology-coupled (R1) |
| KC-3 | 4 | The privacy gate is real work; "public-safe" carries weight |
| KC-4 | 8 | New R2 integration, depends on Afo's KC-25 |
| KC-11 | 4 | Engine run + the framework→v0 mapping, once D1 lands |
| KC-14 | 2 | Session prep and delivery |
| KC-31 | 2 | A decision and a conversation, not a build |
| **KC-6** | **held** | **Scope contested (D2).** An estimate here would be a guess dressed as a plan — it is 2 under Rather's model and 4 under Option B |

---

## Cloudflare hosting — under-tracked, and misattributed

The hosting work is split across two people and two branches, and Linear records only half of it.

| When | Who | What |
|---|---|---|
| 2026-08-08/09 | **Luiz** | Option B — two Workers under his **personal** account; build-on-push git-connected and verified end to end (`b719a949..a38d5d41` → auto-build `c4b209fc`, ~2 min, all routes 200). `scripts/deploy-cloudflare.mjs`, `npm run deploy:cf` / `deploy:cf:prod`, runbook `docs/onboarding/cloudflare-hosting.md`. Dev config in `wrangler.jsonc` on `regen-toolkit-os`; **prod deployed via CLI flags, no config on `main`**. |
| 2026-08-12/13 | **Rather** | PRs [#314](https://github.com/regen-coordination/regen-toolkit/pull/314) + [#315](https://github.com/regen-coordination/regen-toolkit/pull/315) merged to `main` — a second, overlapping setup: adds `wrangler.jsonc` to `main`, wrangler devDependency, repoints the Astro site URL, swaps Vercel refs for Workers. |

**KC-5 is marked Done, assigned to Rather, with his two PRs attached.** It records the main-branch
config. Luiz's two-Worker deployment — the thing actually serving both instances — is on Linear
nowhere except the comment added to KC-6 on 2026-08-31.

### ⚠️ Live defect — the org rename never reached `main` (KC-37)

Verified against the live prod Worker on 2026-08-31. Prod misrepresents who owns the project, three ways at once:

| Element | Currently | Should be |
|---|---|---|
| "Contribute on GitHub" links | `github.com/explorience/regen-toolkit` | `github.com/regen-coordination/regen-toolkit` |
| Canonical URL / sitemap / OG | `regen-toolkit.superbenefit.dev` | a Regen Coordination domain |
| Content | 52 articles | 67 documented; 3,931 pages on dev |

`a38d5d41` ("point every repo reference at regen-coordination/regen-toolkit") landed **only on
`regen-toolkit-os`**. `origin/main` still carries `explorience` in `astro.config.mjs`,
`src/layouts/Page.astro` and `src/pages/index.astro`, and PR #315 set the `superbenefit.dev`
canonical on 08-12 — four days after the repo moved orgs. `main` is **275 commits behind**.

This reframes KC-34 and KC-6. The dev/prod gap is not a page-count difference: **the two branches
disagree about who owns the project**, and prod is the surface KC-28 (Greenpill) and KC-29 (ReFi
DAO) are being invited to consume in V1. Filed as **KC-37**, priority 1, blocking KC-34.

### Two divergences that need a decision

1. **Two wrangler configs, two Worker names.** `main` → `name: "regen-toolkit"` (compat 2026-08-12).
   `regen-toolkit-os` → `name: "regen-toolkit-dev"` (compat 2026-08-01). Prod originally deployed
   by CLI flag with no committed config; Rather then committed one. Which config drives prod now
   depends on which deploy path ran last — worth confirming before the next prod deploy.
2. **`main` declares `site: 'https://regen-toolkit.superbenefit.dev'`** — a SuperBenefit domain,
   set four days after the repo was renamed to `regen-coordination/regen-toolkit`. This is the
   canonical URL Astro bakes into sitemap, canonical tags and OG metadata on the prod build. It
   does not change where the site is *served*, but prod is publishing canonical links to a domain
   that is not Regen Coordination's. Verify against the live site, then decide.

### Untracked on Linear

None of these has an issue on either board:

- Cloudflare account handover / transfer off Luiz's personal account
- Custom domain on prod — and the `superbenefit.dev` question above
- Disabling non-production-branch builds on the prod Worker
- The deploy scripts and operator runbook (built, working, undocumented on the board)

Filing these means filing into Rather's lane as much as Luiz's, so it needs a word with him first
rather than unilateral creation.

---

## Dependencies outside our control

- **KC-4** waits on **KC-25** (Afo) — agentic API publish mode writing state to R2.
- **KC-31** needs a named counterpart at ReFi DAO, not just an owner here.
- **Rather** still holds the Cloudflare handover: account transfer off Luiz's personal account,
  custom domain on prod, disabling non-production-branch builds.
- **`regencoordination.xyz` expires 2026-10-10** (Namecheap, Monty is the registrar owner). If it
  lapses the hub goes down regardless of hosting. Not on either board.

---

## The boundary this plan holds

From [`skills/linear-sync/SKILL.md`](../../skills/linear-sync/SKILL.md):

- **The repo owns:** task id, title, owner of record, project, layer, estimate, dependencies,
  provenance.
- **Linear owns:** status, assignee, cycle position, priority, comments, sub-issues.

Every write made on 2026-08-31 sat on Linear's side of that line — assignee, status, comments —
except the three new issues, which are new records rather than edits across the boundary.

**The unresolved problem:** the issues created today carry **no `task-YYMMDD-owner-slug` footer**,
so `data/linear/id-map.yaml` cannot see them and a future `linear:apply` would duplicate them.
That is the same divergence the reconciliation report documents, just smaller. It is contained
only while nobody runs the seed.

---

## The framework build is barely legible on the board

`@regen-commons/toolkit-framework` **0.2.0** is fully built (SP0–SP10): 34/34 tests, 21 schemas,
15 frozen core types + 31 extensions, 10 layer entry schemas, the compatibility engine, 3 agentic
skills, `packages/org-os-kms`, a JSON-LD generator, and all R1–R10 master-doc proposals resolved.
Its own package description calls it *"the operational distillation of the master doc; adopt the
package, not the 30k-line doc."*

**On Linear it appears as two issues, both mine, both unstarted:**

- **KC-1** — "Merge slice 1: framework & schemas with existing tests"
- **KC-11** — "Validate the consolidated engine package; log needed adjustments"

Nothing on the board conveys that it exists as a built, tested system rather than a thing to be
merged and checked.

### And the V1 lane is independently deriving the same ground

| Concern | Repo framework 0.2.0 | V1 lane on the board |
|---|---|---|
| Type system | 15 frozen core types + 31 extensions | **KC-18** — v0 ontology, 11 classes / 12 predicates |
| Schema format | YAML + JSON-LD generator | **KC-10** — Zod, object-specific variants on a shared base |
| Ingestion | work-order pipeline, agents draft → CLI accept gate | **KC-13** — ingestion filter, validate & summarize before human review |
| State axes | 3-axis canonical state model (R1), review-maturity (K1) | `flowState` ore→craft→struck · `workflowState` proposed→reviewed→published |
| Promotion gate | CLI accept gate + named-reviewer review | Onchain **Geo DAO vote**, quorum 2, agent proposes and abstains |
| State layer | repo + generated artifacts | **Geo canonical → R2 → three surfaces** |

These are not the same system. The V1 design is coherent and in progress, with a clear end-to-end
milestone. But **the framework is not visible to it as an input**, and KC-18 says the v0 baseline
"already exists" without referencing where the framework's kernel sits relative to it.

The risk is not that V1 is wrong — it is that a built, tested distillation of Matty's master doc
gets re-derived instead of adopted, or silently superseded without anyone deciding to supersede it.
**That decision should be made explicitly.** It is the framework-side twin of the repo/Linear
authority question.

---

## How to plug in properly — Afo's conventions

From [Structure & templates — Knowledge Commons](https://linear.app/regen-coordination/document/structure-and-templates-knowledge-commons-52267bb03b7b) (Afo, 2026-08-13). Follow these:

- **Initiatives** are year-scoped workstreams, not tasks. **No owner until the council assigns
  stewardship.** Milestones live at *project* level, never initiative level.
- **Four project types**, each with a required description shape: **Build** (Outcome → Approach →
  Milestones → Definition of done), **Campaign**, **Synthesis**, **Process**. Outcome states what
  changes for contributors and users — not what gets built.
- **Issue templates:** *Knowledge object* (Source / Commons Layer / Flow stage / Schema /
  Promotion criteria / Where it lands) · *Engineering task* (**Outcome / Slice-branch /
  Integration points / Validation**) · *Session-demo* (Purpose / Audience / Prep / Artifact).
- **Labels — one per group:** one **Capital** (Intellectual / Social / Material — "the singular tag
  is deliberate discipline"), one **Work Type**, optionally one **Commons Layer**.
- **Estimates:** exponential, 1 = small, 8 = big, **never 16** — break into sub-issues. *This is
  the same rule as `skills/linear-sync/SKILL.md`.* The two systems already agree here.
- **Cycles:** 2 weeks, starting Friday after Thursday calls.
- **Log time in issue comments** for retro-compensated work.
- **Linear documents are internal.** Anything external-facing lives on the hub or a Google Doc,
  linked from the issue.
- **"The promotion gate is sacred: no knowledge object reaches production without review."**
- Partner needs get logged as **customer requests** on the partner record, with a source link.

**Compliance of the four issues filed on 2026-08-31:** labels conformed from the start (one per
group). Descriptions initially omitted the *Slice/branch* and *Integration points* headers —
**reshaped 2026-08-31** so KC-34, KC-35, KC-36 and KC-37 all now carry the full Engineering-task
shape (Outcome / Slice-branch / Integration points / Validation).

**Framework question raised on KC-18** (2026-08-31) rather than as a new issue — it is Afo's call
as much as ours, and KC-18 is where v0 gets pinned. Three named options: v0 is a deliberate
reduction of the framework kernel (then `maps_to_core` is the bridge and someone writes the
collapse mapping); v0 was derived independently (then reconcile before pinning, or maintain two
type systems over one corpus); or the framework is superseded (defensible, but say it out loud).
KC-11 is the natural place to do the mapping work, once there is a decision to do it against.

---

## Open questions for the 2026-09-04 council

1. **Which direction is authoritative** — repo → Linear, or Linear → repo? Today it is ambiguous,
   and that ambiguity is what nearly caused a 174-issue duplication.
2. **Does the seeding pipeline continue?** If Linear is the source of truth it needs an `adopt`
   command mapping existing issues onto registry ids, or it should be retired. Leaving it as-is is
   the risky option, because it looks runnable and is not.
3. ~~All four initiatives have `owner: null`~~ — **corrected 2026-08-31.** This is *by design*.
   Afo's structure doc states: *"initiatives are year-scoped workstreams, not tasks. No owner
   until the council assigns stewardship."* The council still needs to assign it, but the empty
   field is the convention working, not neglect.
4. **Where does `toolkit-framework` 0.2.0 stand relative to the v0 ontology?** Adopted as the
   kernel, superseded by the V1 design, or running in parallel? All three are defensible; drifting
   is not. This is the same authority question as (1), on the semantic layer.
5. **Integrity Suite Integration has zero issues** and is the only project attached to **no
   initiative**. Durgadas is its lead. Ask him whether he wants it populated — five open CSIS
   records and two 08-27 commitments sit behind it — rather than filling it for him.
