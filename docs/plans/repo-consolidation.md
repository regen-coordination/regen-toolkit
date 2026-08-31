---
id: repo-consolidation
title: "Repo consolidation — regen-toolkit-os (dev) → main (prod) + org migration"
status: partially-superseded
created: 2026-07-15
updated: 2026-07-19
scope: regen-toolkit
decision_owner: Luiz (propose to the group 2026-07-16)
---

> **2026-07-19 status.** **Part 2 is superseded** by
> [`publish-pipeline/2026-07-16-design.md`](publish-pipeline/2026-07-16-design.md) (operator-approved
> 2026-07-16): **Shape B decided**, and the mechanism upgraded from a one-off integration branch to a
> **scripted curated projection** (`scripts/publish-to-main.mjs`, repeatable). The org migration
> sequence stands — asks **sent to Heenal 2026-07-19**
> ([`docs/comms/drafts/2026-07-16-heenal-asks.md`](../comms/drafts/2026-07-16-heenal-asks.md)); awaiting his action.
> **Part 1 (push the dev branch) is still pending operator** — local `regen-toolkit-os` is ahead of
> both remotes (~7 vs `fork`, ~11 vs `origin`); note [`dev-instance-build.md`](dev-instance-build.md)
> **requires the `fork` push** to deploy.

# Repo consolidation plan

**Purpose:** two moves, in order. **(1) Now:** make `regen-toolkit-os` the one consolidated,
clone-ready branch so Matty (and any contributor) clones a single branch and gets everything.
**(2) Propose tomorrow:** the full `regen-toolkit-os → main` consolidation + the branching model +
the migration to the Regen Coordination GitHub org.

Everything external here is **draft-and-present** — nothing is pushed, merged, or migrated without an
explicit operator go.

## State as of 2026-07-15 (verified)

| Fact | Value |
|---|---|
| `regen-toolkit-os` holds | **both** live sessions' work — this session's viz pack + the parallel session's T4 core schemas (`person`/`organization`/`relationship-record`) and T3b sub-plan |
| Framework tests | 125 / 0 · kb-viz 15 / 0 · site build green |
| `regen-toolkit-os` vs `origin/main` | **190 commits ahead, 0 behind** — dev is a strict superset; `main` could fast-forward |
| `origin/main` | the live public site (last: PR #311 onboarding-journeys-v1) — real prod, just older |
| `origin/regen-toolkit-os` | **~20 commits behind local** (unpushed) |
| `fork/regen-toolkit-os` (GitHub Pages source) | **22 behind local** |
| Handoff source folder | already gitignored (`docs/RKC_Handoff_.../`, commit `0832258`) |
| Transient tooling | now gitignored (`.superpowers/`, `.tmp/`, `docs/temp/`) |
| Raw handoff corpus tracked on dev | `kb-handoff/objects/` = 146 files · 146 handoff-derived `kb-graph/` stubs — **dev-only by decision** |

Remotes: `origin` = `explorience/regen-toolkit` (public, the real repo) · `fork` =
`luizfernandosg/regen-toolkit` (GitHub Pages).

---

## Part 1 — Consolidate on `regen-toolkit-os` (now; the clone-ready branch)

The branch content is already consolidated locally. What remains is pushing it and settling three
loose files. **None of the three block Matty's clone** — they're flagged for a decision.

### 1a · Operator action — push the dev branch (REQUIRED before the call)
A fresh clone only sees the remote. Matty's onboarding says `git checkout regen-toolkit-os`, so:
```bash
git push origin regen-toolkit-os     # ~20 commits: this session's viz + parallel T4
git push fork   regen-toolkit-os     # 22 commits: refresh the GitHub Pages deploy
```
Without the first, Matty clones a **stale machine** (no viz pack, no T4 schemas). *(This is the single
most important pre-call action.)*

### 1b · Three loose files — decide (recommendations)
| File | State | Recommendation |
|---|---|---|
| `src/data/framework-manifest.json` | derived, stale (pre-T4, 22 schemas) vs the committed T4 schemas (25) | **Commit the refresh** — it's derived from already-committed inputs and makes `/framework` accurate; it self-heals on `npm run build` anyway. (Belongs to whoever closes T4 — coordinate with the parallel session so it isn't committed twice.) |
| `packages/toolkit-framework/package-lock.json` | untracked | **Commit** — the framework is a shareable/degit-able package; a lockfile gives reproducible installs. (Dry-run confirmed `npm install` works without it, so not blocking.) |
| `docs/reports/2026-07-10-share-pack.md` | untracked draft (predates this session) | **Leave** — draft-and-present; commit only if you want it on the branch. |

---

## Part 2 — `regen-toolkit-os → main` + org migration (propose 2026-07-16)

### The central decision: what does `main` (public prod) contain?
Because dev is a strict superset, a plain merge/FF would put **everything** on the public `main` —
including the org-os coordination overlay that is arguably internal:

- `memory/` (10 daily logs) · `MEMORY.md` · `HEARTBEAT.md` · `docs/plans/` (41 internal plans)
- `kb-handoff/objects/` (146 **raw, unreviewed** objects from Matty's Canonical_DB) + their 146
  `kb-graph/` stubs — **explicitly a dev-only, hold-until-reviewed decision**

**Two shapes to choose between:**

- **A — Full superset (simplest).** `main` = everything. One repo, one history, no path surgery.
  *Cost:* internal coordination + raw handoff content becomes public history. Contradicts the
  "kb-handoff dev-only" decision.
- **B — Curated prod (recommended).** `main` carries the **public product**: the site
  (`src/`, `astro.config.mjs`), the framework (`packages/toolkit-framework/`), public docs
  (`docs/MASTER.md`, `docs/layers/`, `CONVERGENCE.md`, `docs/canvases/`), and the **articles** KB
  (`data/kb/` + its `kb-graph/` stubs, regenerated single-corpus). It **excludes** `kb-handoff/`
  (raw handoff), the handoff-derived `kb-graph/` stubs, and — if desired — the internal org-os overlay
  (`memory/`, `HEARTBEAT.md`, internal `docs/plans/`). The kb-viz generator **already** produces
  single-corpus output when `kb-handoff/` is absent, so this is mechanically clean, not hand-editing.

Recommendation: **B.** `main` is the public/prod face; `regen-toolkit-os` stays the working instance.

### Mechanics (for shape B)
1. Snapshot first (vault safety): `npm run vault:snapshot -- "before main consolidation"` if applicable.
2. On a throwaway integration branch off `regen-toolkit-os`:
   - Remove the dev-only paths from the tree (`git rm -r --cached kb-handoff kb-graph/<handoff-stubs>` + regenerate `npm run generate:kb-viz` with `kb-handoff/` absent → single-corpus `data/kb` only), and (if excluding the overlay) `git rm -r --cached memory HEARTBEAT.md …`.
   - Add `kb-handoff/` (and overlay paths, if excluded) to a **main-branch `.gitignore`** so they can't reappear.
3. Open the PR `integration → main` on `origin` (`explorience/regen-toolkit`). Title: *"Consolidate toolkit: site + framework + convergence + articles KB."* Body: the convergence story (link `docs/CONVERGENCE.md`), the framework (110→125 tests), the crosswalk/DoD, and an explicit "what's intentionally excluded and why" section.
4. **Do not FF `main` to `regen-toolkit-os` directly** — that's shape A by accident and carries the raw handoff corpus. Always go through the curated integration branch.

### Branching model (confirm)
- `regen-toolkit-os` = **dev / integration** (the working instance; where contributors branch from).
- `main` = **prod** (public site + framework; what deploys, what outsiders read).
- Deploy: Vercel from `main` (public site); GitHub Pages from `fork/regen-toolkit-os` (preview) — revisit Pages source after migration.

### Org migration (`explorience` → Regen Coordination org)
Sequence **after** the PR lands, so `main` is consolidated before the transfer:
1. Land the curated PR to `explorience/regen-toolkit` `main`.
2. GitHub → repo **Transfer** to the Regen Coordination org (preserves history, issues, PRs; redirects the old URL).
3. Update remotes everywhere (`origin` → new org URL), the onboarding doc's clone URL, and re-point Pages/Vercel if needed.
4. Re-invite collaborators (Matty, Heenal, …) on the new org.

*(Order rationale: consolidating first means the transfer moves a clean, single-source prod `main`; migrating first would just add a rename step mid-consolidation.)*

## Open decisions to record tomorrow
- **Shape A vs B** for `main` (recommend B) — and if B, does the org-os overlay (`memory/`, internal `docs/plans/`) stay dev-only or go public?
- Commit the `framework-manifest.json` refresh + `package-lock.json`? (recommend yes to both)
- Who owns the transfer button + the collaborator re-invites on the RC org?
- Pages/Vercel deploy sources post-migration.

## Guard rails
Nothing pushed/merged/migrated without operator go. `docs/MASTER.md` untouched. Raw handoff content
does not reach a public view without the review-promote gate (this plan enforces that at the `main`
boundary). Vault-safety rules apply to every merge/reset/large checkout.
