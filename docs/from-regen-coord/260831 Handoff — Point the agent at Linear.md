# Handoff — Point the agent at Linear

**Date:** 2026-08-31
**From:** `regen-coordination-os` (parent instance) — session of 2026-08-29
**To:** a session working in `repos/regen-toolkit` on branch `regen-toolkit-os`
**Origin:** action item from the **2026-08-28 Regen Coordination Council Sync**
**Council record:** `03 Libraries/regen-coordination-os/packages/operations/meetings/260828 Regen Coordination Council Sync.md`

---

## 0. ⛔ Read this before you touch anything

Four facts change what this job is. An agent that starts by running `npm run linear:plan` will fail on all four.

| Fact | Consequence |
|---|---|
| **The Linear pipeline is not on this branch.** It lives on `feature/linear-seeding`, **36 commits ahead** of `regen-toolkit-os` and unmerged. `scripts/linear/` is not in the working tree. | Nothing runs until that branch is merged or checked out. |
| **`LINEAR_API_KEY` does not exist locally.** There is no `.env` at all — only `.env.example`. The 2026-08-09 runs used a shell-exported key that is gone. | **Hard blocker.** Every command except the read-only repo-side ones fails. Already tracked as `task-260827-luiz-linear-resync`. |
| **Team `KCM` was deleted on 2026-08-09.** Archived as "Knowledge Commons Old" and its contents deleted at 05:15:19Z — **172 issues, 3 projects, 30 labels, unrecoverable.** The branch was repointed at team **KC**. | The board you are reconciling against is *empty or near-empty*, not populated. Do not assume 172 issues are sitting there. |
| **The working tree is dirty** on `regen-toolkit-os` (`HEARTBEAT.md`, `data/meetings.yaml`, `.well-known/*`, several `docs/plans/*` modified). | **Do not switch branches casually.** Commit or stash-by-snapshot first — and note the vault-safety rules in the parent `CLAUDE.md` before reaching for `git stash`. |

Also carried on the seeding branch: *"Blocked on `cyclesEnabled` being false on the new team."* Cycles must be enabled on team KC before a seed that assigns cycle positions will apply cleanly.

**The deletion was not a tooling failure.** The full apply log is creates/links/adopts/updates only; no delete or archive mutation exists anywhere in `scripts/linear/`. Cause was a team reorganisation by whoever owns Linear structure, unaware of the seed. The orphan sweep did its job — it detected the disappearance rather than assuming the issues existed.

---

## 1. What was actually asked

From the 260828 council, Luiz describing his own plan:

> Point my agent at Linear, surface tasks from past Regen Coordination OS meeting notes, identify backlog items not yet in Linear, and use it as the source of truth for personal task and project management.

So: **reconcile the `regen-coordination-os` backlog against Linear and file the gaps.**

---

## 2. The scope constraint — this is the part to get right

The council did **not** adopt Linear for all of Regen Coordination. What emerged was narrower, and it is **not ratified**:

- **Pilot on two workstreams only** — the **Artizen Fund** and the **Web3 Toolkit** (Antonio's proposal, supported by Magenta, Coi and Luiz).
- **Bound by success criteria and a ~3-month decision point** (Coi's condition).
- **Explicitly undecided.** Matt, on the record: *"no decisions have been made. It's just been open for feedback and discussion."* **Afo — who authored the proposal and owns the Linear workspace — was absent from the call.**
- Luiz's own framing: Linear's primary job is coordinating **toolkit** work, because the toolkit is the main initiative RC actually has. Everything else is optional surface.

**Therefore: do not seed the ~122 open items from the `regen-coordination-os` HEARTBEAT into Linear.** Most of them are governance, treasury, hub-ops and funding items that are outside the piloted scope, and bulk-loading them would (a) exceed what the council agreed and (b) hand Coi's "we move too fast with tech" objection a concrete example.

Filter to **toolkit-workstream items only**. Defer the Artizen Fund workstream until someone owns it.

---

## 3. The real gap

The pipeline reads **this repo's** `HEARTBEAT.md` + `data/tasks.yaml`. The reconciliation target is a **different instance**. That crossing is not built, and it is not trivial:

- **`regen-coordination-os` has no `data/tasks.yaml`.** Its registries are `channels, deployment-requirements, events, feedback-process, finances, funding-opportunities, funds, ideas, initiatives, knowledge-manifest, meetings, members, nodes, option-library, programs, projects, sources` — no task registry. Its ~122 tasks exist **only as prose bullets in `HEARTBEAT.md`**, parsed at render time by `scripts/initialize.mjs`.
- **Those bullets have no task ids.** The toolkit convention is `task-YYMMDD-owner-slug` (e.g. `task-260827-luiz-linear-resync`). RC OS bullets have none.
- **The pipeline cannot bridge that on its own.** Per `skills/linear-sync/SKILL.md`, the id-map is *"the exact-match key the whole design rests on; there is deliberately no fuzzy title matching to fall back on."* No ids means no matching means duplicates on the next seed.

---

## 4. Options, with a recommendation

### ✅ Recommended — Option C: narrow to the scoped workstream, port by hand

1. Unblock the toolkit board first (key → merge → cycles → re-seed → verify). This closes `task-260827-luiz-linear-resync`, which is already open and blocking Rather/Afo visibility.
2. Read the RC OS HEARTBEAT and extract **only toolkit-workstream items**. There are roughly a dozen, mostly in the 260710 / 260724 / 260423 sections: repo migration to the RC GitHub org, OS-overlay-into-`main`, reprocessing Heenal's content for a visual diff, the eight-forms-of-capital framework gap, Discourse migration, the Rather/GeoBrowser three-way call, the KOI integrate-now-vs-defer decision.
3. Add each as a proper record in **this repo's** `data/tasks.yaml` with a `task-YYMMDD-owner-slug` id and a `source:` block pointing at the RC OS HEARTBEAT section it came from, then run the normal pipeline.
4. Leave the RC-wide backlog and the Artizen Fund workstream alone until Afo ratifies the pilot and accepts ownership.

**Why:** it respects the agreed scope, needs no new machinery, and produces something reviewable at the 09-04 council. The provenance footer the pipeline already writes will make the cross-instance origin visible on every issue.

### Option A — extend the pipeline to ingest RC OS cross-instance
Teach `scripts/linear/lib/heartbeat.mjs` a second source root. **Rejected for now:** couples two repos with independent remotes and histories, and pulls RC governance/treasury items onto a toolkit board — outside the pilot scope.

### Option B — give `regen-coordination-os` its own `data/tasks.yaml`
The right long-term move, and valuable on its own (its dashboard is parsing prose today). **But it is a project, not a step** — ~122 items need ids, owners, projects and provenance. Worth queuing as a plan; do not let it block this handoff.

---

## 5. Execution sequence

```bash
cd "03 Libraries/regen-coordination-os/repos/regen-toolkit"
```

**Step 0 — operator, not agent.** Restore `LINEAR_API_KEY` to `.env` from Linear → Settings → Security & access → Personal API keys. Set `LINEAR_TEAM_KEY` to the **new** team key (KC, not KCM — verify against the live workspace). Note the security caveat in `.env.example`: on Linear's free plan every member is an admin and a personal key carries that person's full permissions. Prefer a bot identity if the plan allows.

**Step 1 — deal with the dirty tree.** Commit or snapshot the modified files on `regen-toolkit-os` before any branch operation. Do **not** `git stash` without reading the vault-safety rules in the parent `CLAUDE.md`.

**Step 2 — get the pipeline onto the working branch.** Merge `feature/linear-seeding` into `regen-toolkit-os`, or check it out deliberately. 36 commits, 135 files; review the diff rather than fast-forwarding blind.

**Step 3 — enable cycles on team KC** in the Linear UI, or the seed will fail on cycle assignment.

**Step 4 — read-only reconnaissance first.**
```bash
npm run linear:audit      # every open HEARTBEAT item has an id + resolvable owner
npm run linear:verify     # is the repo in sync with the board?
```
Expect `verify` to report the 172 as orphaned. That is the recorded state, not a new fault.

**Step 5 — port the scoped RC OS items** into `data/tasks.yaml` (Option C step 3). Then:
```bash
npm run linear:validate
npm run linear:extract
npm run linear:plan       # READ THE OUTPUT
npm run linear:apply -- --plan <file> --confirm
```

**Step 6 — verify and record.** `npm run linear:verify`, then write the outcome to `memory/2026-08-31.md` and update `HEARTBEAT.md`.

---

## 6. Rules not to violate

From `skills/linear-sync/SKILL.md` — read it in full before writing anything:

- **This repo owns** id, title, owner of record, project, layer, estimate, dependencies, provenance. **Linear owns** status, assignee, cycle position, priority, comments, sub-issues. Never write across that line.
- **Never hand-create a Linear issue** for work that belongs in `data/tasks.yaml` — it has no task id, so the next seed cannot see it and will duplicate it.
- **Never `estimate: 16`.** Only 1, 2, 4, 8 or null. Oversized work becomes a parent plus children carrying `parent:`.
- **Never run `apply` without reading the plan.** It is the only command that writes.
- **There is no delete command**, by design.
- **Never hand-edit `data/linear/id-map.yaml`.**
- For conversational work (marking done, asking what's in the cycle) use the Linear **MCP server** in `.mcp.json` — but note it authenticates via interactive OAuth, so **it will not work headless or in cron**.

---

## 7. Governance note — raise this, don't just work around it

The KCM deletion is a live instance of the objection Coi put to the council on 08-28:

> *"We still have someone who has managing permissions and can accept what is work and what is not, change the parameters… but we are a collective. We're not like a startup led by a founder."*

172 issues were destroyed by a team reorganisation performed by someone unaware the seed existed. That is precisely the centralized-permissions failure mode, and it has already cost real work once.

**Worth carrying into the Fri 2026-09-04 council** as evidence for two of the open asks: a **named owner** for the Linear experiment, and the **tool-activation policy** Coi proposed. It argues for the pilot, not against it — but it argues for the pilot *with an owner*.

---

## 8. Definition of done

- [ ] `LINEAR_API_KEY` restored; `LINEAR_TEAM_KEY` points at the live team
- [ ] Pipeline available on the working branch; dirty tree resolved safely
- [ ] Cycles enabled on team KC
- [ ] `linear:verify` runs clean and its output is understood
- [ ] Toolkit-workstream items from the RC OS backlog carry ids in `data/tasks.yaml` with `source:` provenance
- [ ] `linear:plan` reviewed by a human, then applied
- [ ] Result written to `memory/` and `HEARTBEAT.md` in **both** instances
- [ ] `task-260827-luiz-linear-resync` closed
- [ ] Deletion incident + ownership question queued for the 09-04 council

---

## 9. Sources

| What | Where |
|---|---|
| Council record | `regen-coordination-os/packages/operations/meetings/260828 Regen Coordination Council Sync.md` |
| Integration report | `regen-coordination-os/docs/reports/2026-08-28-regen-coordination-council-sync-integration-report.md` |
| RC OS backlog | `regen-coordination-os/HEARTBEAT.md` (~122 items, prose, no ids) |
| Pipeline + skill | `feature/linear-seeding`: `scripts/linear/*`, `skills/linear-sync/SKILL.md`, `.mcp.json`, `.env.example` |
| Deletion incident | commit `f3ffd9d3` — *"docs(linear): record the team-deletion incident; point at team KC"* |
| Prior state | `memory/2026-08-28.md` (this repo) — the "Linear: dead end from here" section |
| Seed artifacts | `data/linear/id-map.yaml`, `data/linear/seed-manifest.yaml`, `data/linear/runs/2026-08-09T*` |

**⚠️ Attribution caveat:** the 260828 council record is synthesized from a **Granola** transcript that diarises only `Me`/`Them`. Every non-Luiz attribution in it — including the quotes above — is *inferred*, not speaker-labelled. Treat the positions as accurate and the exact speaker as probable.
