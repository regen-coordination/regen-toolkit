# Linear board reconciliation — repo backlog vs the live workspace

**Date:** 2026-08-31
**Author:** Luiz (with Claude Code)
**Origin:** 260828 Regen Coordination Council action item — *"Point my agent at Linear, surface
tasks from past Regen Coordination OS meeting notes, identify backlog items not yet in Linear, and
use it as the source of truth."*
**Method:** read-only, over the Linear MCP plugin (OAuth). **Nothing was written to Linear.**
**Status:** draft for review. Recommends filing 3 issues, and raising 2 structural questions.

---

## Summary

The reconciliation the council asked for has largely **already been done — by Afo, by hand, on
2026-08-13.** The live workspace holds **51 curated issues across two teams**, five projects with
named leads and dates, and an active cycle. The repo's seeding pipeline, meanwhile, is still
pointing at a team that was deleted on 2026-08-09.

The gap is therefore much smaller than the handoff assumed, and the real finding is not a list of
missing tasks. It is that **two systems are describing the same work through mechanisms that
cannot see each other**, and nobody owns the seam.

**Recommendation: do not run the seed.** File the three genuine gaps below by hand, and take the
ownership question to the 09-04 council.

---

## 1. What is actually on the board

| Team | Issues | Created | By |
|---|---|---|---|
| Knowledge Commons (`KC`) | 33 (KC-1 … KC-33) | 2026-08-13, 2026-08-27 | Afo (one by Rather) |
| Growth (`GROW`) | 18 (GROW-1 … GROW-18) | 2026-07-30, 2026-08-13 | Afo |

**Five projects on Knowledge Commons:**

| Project | Lead | Status | Issues |
|---|---|---|---|
| V1 · Commons Pipeline — Hub to Surfaces | Afo | In Progress → 2026-10-31 | 16 |
| Repo Stabilization & Contribution Pathway | **Luiz** | In Progress → 2026-09-30 | 9 |
| Ecosystem Federation & Deployment | — | Planned → 2026-12-31 | 3 |
| Org OS Implementation | **Luiz** | Planned | **1** |
| Integrity Suite Integration | Durgadas | Backlog | **0** |

Cycles are enabled; cycle 2 is current (2026-08-28 → 09-11) with 12 issues / 29 points.

The RC OS governance, treasury and Artizen backlog is on the **Growth** team — including the
Discourse migration (GROW-16, assigned to Luiz, In Review). So the cross-instance concern that
motivated the handoff was already resolved.

---

## 2. Why the seed must not run

The repo holds a 174-record registry (`data/tasks.yaml`) and a compiled seed manifest. Running
`linear:apply` today would **create 174 new issues and 3 duplicate projects** on top of Afo's
curation. This is not a judgment call — it is what the code does:

- `scripts/linear/lib/planner.mjs`: *"Everything else — never mapped, or mapped but `orphaned` —
  recreates."* All **172** id-map entries are `state: orphaned` (they point at deleted `KCM-*`
  issues); the 2 newly added records are unmapped. **All 174 route to `create`.**
- Adopt-by-name exists for **projects and labels only, never issues** — and the manifest's project
  names don't match Afo's, so it would create three more:

| Manifest would create | Afo already has |
|---|---|
| Stabilise the repo for contribution | Repo Stabilization & Contribution Pathway |
| org-os and framework | Org OS Implementation |
| Gather and curate knowledge | *(no equivalent)* |

**No live issue carries a `task-YYMMDD-owner-slug` footer.** The board is entirely hand-authored
and therefore invisible to the id-map — which is why the pipeline cannot tell that this work
already exists.

### Duplicates it would create (partial)

| Live issue | Registry record it duplicates |
|---|---|
| KC-1 Merge slice 1: framework & schemas with existing tests | `task-260806-luiz-slice-1-framework-schemas` |
| KC-2 / KC-3 / KC-4 — slices 2, 3, 4 | `…-slice-2/3/4-…` |
| KC-5 Set up Cloudflare Workers hosting + CI/CD | `task-260806-rather-cloudflare-setup` |
| KC-6 Stand up mirrored dev & prod instances | `task-260716-luiz-staging-dev-site` |
| KC-9 Claude Code + Linear + GitHub training | `task-260806-afo-linear-github-training` |
| KC-14 Host Orgs OS demo session | `task-260806-luiz-orgos-session` |
| KC-15 Draft & submit Harmonica purchase proposal | `task-260806-rather-harmonica-purchase` |
| KC-20 Geo Protocol evaluation | `task-260716-luiz-geo-protocol-scoping` |
| KC-22 Astro 7 migration | `task-260716-rather-astro-fix` |

The slice titles are near-verbatim. Afo rebuilt from the same source material — independently, and
at a tighter, better scope.

---

## 3. The genuine gaps

Of 170 open HEARTBEAT items, **16 have no registry record at all** — the whole 2026-08-27
Knowledge Commons Sync and the 08-27 catch-up, because the registry froze on 08-09. Cross-checked
against the 51 live issues, these are the ones that are material, in scope, and missing everywhere.

### Tier 1 — file these (projects Luiz already leads)

| Work | Project | Note |
|---|---|---|
| **Spec the clean-slate `main` move** — Heenal content → own branch → curated projection rebuilds `main`, sequenced so prod never goes blank | Repo Stabilization & Contribution Pathway | Adjacent to KC-6 but distinct; KC-6 is dev/prod mirroring, this is the content cutover |
| **Branch a lightweight org-os instance off `knowledge-commons` and test** — `main` stays clean; prove value before proposing a merge | Org OS Implementation | Monty's explicit framing; the project has 1 issue |
| **Integrate `knowledge-commons` into `regen-coordination-os`** + find the workshop moment | Org OS Implementation | — |

### Tier 2 — an empty project with a named lead

**Integrity Suite Integration has zero issues.** Durgadas is lead. Behind it sit five open CSIS
records in the repo registry plus two commitments from 08-27 (find a home for the Craft/Struck
corpus work; share the GitHub repo links — 3 accounts, ~4 months of drift). Worth asking Durgadas
whether he wants it populated, rather than populating it for him.

### Tier 3 — other people's lanes (raise, don't file)

Monty (Integrity Suite setup, Claude/ChatGPT connectors, Miro diagram), Matt (onboarding +
fundraising lane), Heenal (Geo proposal review), Drew (Sugarbug.ai invites), Team (join projects +
self-assign, Artizen profile, AI primer call for Matt).

**Excluded as meta or personal:** restoring `LINEAR_API_KEY`, reviewing/assigning the ingestion
issues (this exercise), sending the Matty reply, joining the Monty/Brad engineering sync.

---

## 4. For the 2026-09-04 council

The 08-09 deletion is usually told as "172 issues lost." The fuller version is more useful:

1. A seed created 172 issues in team `KCM`.
2. ~4.5 hours later the team was reorganised and deleted — **35 seconds** after which the
   replacement team was created.
3. The repo's sweep correctly detected the disappearance and marked everything `orphaned`.
4. Afo then rebuilt the board by hand at a tighter scope — good work, done in good faith.
5. Three weeks later the repo pipeline still pointed at the deleted world, and would have
   duplicated his board wholesale had anyone run it.

**Nobody did anything wrong at any step.** There was no shared owner and no activation ritual.
That is precisely the case for the two asks already on the table — a **named owner** for the Linear
experiment, and Coi's **tool-activation policy**. It argues *for* the pilot, with an owner.

Two questions worth putting to the council:

- **Which direction is authoritative?** Repo → Linear (seeded, id-tracked, reproducible) or
  Linear → repo (hand-curated, human-scoped)? Today it is ambiguous, and ambiguity is what caused
  the duplication risk. A board that is authoritative is fine; a board that is authoritative on
  Tuesdays is not.
- **Does the seeding pipeline continue at all?** If Linear is the source of truth, the pipeline
  needs an `adopt` command (map existing issues to registry ids) or it should be retired. Keeping
  it in its current state is the risky option, because it looks runnable and is not.

---

## 5. What was changed in the repo (no Linear writes)

- `feature/linear-seeding` merged into `regen-toolkit-os`; 3 conflicts resolved, no task ids lost.
- Two pipeline defects fixed with tests (206 pass): the provenance footer ignored
  `task.source.file`, and cross-instance items lost their body text.
- Two ported records added for the only real gaps in the 260710 RC OS toolkit list.
- **`linear:apply` was not run and must not be** until the questions above are settled.
