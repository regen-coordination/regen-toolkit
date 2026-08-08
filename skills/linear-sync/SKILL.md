---
name: linear-sync
description: Use when creating, updating, or reconciling Linear issues for the Regen Web3 Toolkit — establishes which system owns which field and which commands are safe to run. Trigger on any request to seed Linear, sync tasks, add an issue, check whether Linear and the repo agree, or edit data/tasks.yaml.
---

# Linear sync

Linear is the team's execution surface, adopted at the 2026-08-06 engineering sync. This repo
owns what the tasks *are*; Linear owns how they are *going*. Violating that split is what makes
the two drift, and every safeguard below exists because of it.

## Ownership — nothing is owned twice

| Field | Owner |
|---|---|
| id, title, owner of record, project, layer, estimate, dependencies, provenance | `data/tasks.yaml` |
| status, assignee, cycle position, priority, comments, sub-issue breakdown | Linear |
| section headers, context paragraphs, Recently Completed | `HEARTBEAT.md` |

This is why `apply` sends only repo-owned fields on an update. If it sent assignee or cycle, the
next sync would silently revert a reassignment someone made in Linear.

## Never

- **Never hand-create a Linear issue for work that belongs in `data/tasks.yaml`.** Add the
  record and run the pipeline. A hand-made issue has no task id, so the next seed cannot see it
  and will create a duplicate.
- **Never record `estimate: 16`.** It is not representable — the type allows only 1, 2, 4, 8 or
  null. Oversized work becomes a parent record plus children carrying `parent:`. This encodes
  the team's "nothing at 16, break it into sub-issues" rule so it cannot be forgotten.
- **Never run `apply` without reading the plan output first.** It is the only command that
  writes.
- **There is no delete command.** Not behind a flag. If you think you need one, you want
  `state: orphaned` in the id-map — which `plan` sets automatically for an issue that has
  vanished from Linear.
- **Never edit `data/linear/id-map.yaml` by hand.** It is the exact-match key the whole design
  rests on; there is deliberately no fuzzy title matching to fall back on.

## Commands

| Command | Writes? | Use when |
|---|---|---|
| `npm run linear:audit` | no | Checking every open HEARTBEAT item has an id and a resolvable owner |
| `npm run linear:validate` | no | After editing `data/tasks.yaml` |
| `npm run linear:extract` | local file only | After a triage or registry edit — regenerates the manifest |
| `npm run linear:plan` | local id-map only | Always, before apply. Prints the diff and writes a plan artifact. |
| `npm run linear:apply -- --plan <file> --confirm` | **yes — Linear** | Only after a human has read the plan |
| `npm run linear:verify` | no | Any time. Safe. Answers "is this in sync?" |

`plan` marks vanished issues as orphaned in the local id-map, which is a local write, not a
Linear one. It never mutates the workspace.

## Adding a task

1. Add the item to `HEARTBEAT.md` with an owner prefix and a `` `task-YYMMDD-owner-slug` `` id.
2. Add the matching record to `data/tasks.yaml`.
3. `npm run linear:validate` then `npm run linear:extract`.
4. `npm run linear:plan`, read it, then apply.

## Ad-hoc work

For conversational changes — marking something done, asking what is in the current cycle,
adding a comment — use the Linear MCP server (see `.mcp.json`) rather than these scripts. The
scripts are for bulk and deterministic work.

**But know the boundary:** anything you change via MCP that belongs to a repo-owned field will be
overwritten by the next `apply`. Change status, assignee and cycle freely in Linear. Change
title, project, estimate and labels in `data/tasks.yaml`.

## Provenance

Every seeded issue carries a footer naming its source section, task id, and the repo and branch
it came from, plus the owner of record when no Linear account could be resolved. If you are
looking at an issue and wondering where it came from, the answer is in the description.
