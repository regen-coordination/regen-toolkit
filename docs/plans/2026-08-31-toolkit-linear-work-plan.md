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
| Created | KC-34, KC-35, KC-36 |
| Reassigned to Afo | KC-8 (repo records it as `task-260806-afo-linear-seed`) |
| Closed | GROW-16 — Discourse migration, done 2026-07-29, evidence in the comment |
| Reopened as started | KC-6 — Backlog → In Progress, with a comment splitting done from not-done |

**Deliberately not done:** no cycle assignments (Linear owns cycle position — propose, don't
impose), no issues filed into other people's lanes, no bulk seed.

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
