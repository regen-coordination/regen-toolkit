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

## Open questions for the 2026-09-04 council

1. **Which direction is authoritative** — repo → Linear, or Linear → repo? Today it is ambiguous,
   and that ambiguity is what nearly caused a 174-issue duplication.
2. **Does the seeding pipeline continue?** If Linear is the source of truth it needs an `adopt`
   command mapping existing issues onto registry ids, or it should be retired. Leaving it as-is is
   the risky option, because it looks runnable and is not.
3. **All four initiatives have `owner: null`** — including *Knowledge Commons*, which houses every
   toolkit project. Directly relevant to the named-owner ask.
4. **Integrity Suite Integration has zero issues** and is the only project attached to **no
   initiative**. Durgadas is its lead. Ask him whether he wants it populated — five open CSIS
   records and two 08-27 commitments sit behind it — rather than filling it for him.
