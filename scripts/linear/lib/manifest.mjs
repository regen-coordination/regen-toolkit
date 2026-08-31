// Manifest builder for the Linear seeding pipeline. Pure, no I/O, never throws.
//
// Mirrors the directory idiom (tasks.mjs / members.mjs / heartbeat.mjs / labels.mjs): this
// module only shapes data it is handed — it does not load files and does not decide who is
// valid. That is the split of concerns the rest of the pipeline already committed to:
//
//   validateTaskRegistry — id format, duplicate ids, owner-resolves-to-a-member,
//   (lib/tasks.mjs)        parent/blocked_by referential integrity against the FULL registry;
//                          called by both validate-tasks.mjs (`npm run linear:validate`) and
//                          extract.mjs, so a registry that would fail validation can never still
//                          produce a manifest
//   buildManifest (here) — projection only: registry + heartbeat + members -> the manifest
//                          that gets committed and read by a human before anything talks to
//                          the Linear API
//
// buildManifest deliberately does NOT re-check duplicate ids or dangling parent/blocked_by
// references. `data/tasks.yaml` already has exactly one validator for that
// (validateTaskRegistry in lib/tasks.mjs), and every module in this directory draws its
// I/O/validation line in the same place: tasks.mjs's own comment says as much ("validateTask
// itself stays pure ... callers run it over whatever loadTasks returns"). Duplicating that
// check here would give the registry two sources of truth for the same question, which is
// exactly the kind of fork this whole seeding design exists to avoid.
// The contract this module relies on: `tasks` is the complete registry (whatever loadTasks
// returned), not a filtered slice — because parent/blocked_by ids are only guaranteed to
// resolve within the full set. If a future caller ever passes a subset, parent/blocked_by
// will point outside the manifest; that's a caller contract, not something worth guessing
// around here, since the plan stage (next task) is the one reading `parent`/`blocked_by` and
// can decide how to handle a miss with full context.
import { deriveLabels } from "./labels.mjs";
import { resolveOwner } from "./members.mjs";

export const REPO_SLUG = "regen-coordination/regen-toolkit";
export const BRANCH = "regen-toolkit-os";

export const PROJECT_DEFS = [
  {
    slug: "repo-contribution",
    name: "Stabilise the repo for contribution",
    description:
      "Four-slice merge, Cloudflare hosting, org access, publish pipeline, privacy gate, dev/prod mirroring.",
  },
  {
    slug: "knowledge-curation",
    name: "Gather and curate knowledge",
    description:
      "Ingestion layer, review-promote gate, reference normalization, Discovery_Pool, resource DB V3, encyclopedia content.",
  },
  {
    slug: "org-os-framework",
    name: "org-os and framework",
    description:
      "PROPOSED — fold or rename freely. Framework package, org-os KMS, instance deploys, RegenOS docs, engine validation, standards-to-code.",
  },
];

// The description footer is rendered by Linear as markdown. Two failure modes matter here:
//
// 1. A bare `---` line immediately after a text line (no blank line between) is CommonMark's
//    setext-heading underline, not a thematic break — it silently promotes whatever text
//    preceded it into an <h2>. We avoid that by always joining body and footer with a blank
//    line first, so `---` only ever appears with a blank line on both sides (a real
//    thematic-break divider, not a heading swallow).
// 2. Even with that fixed, the footer's own content (a `refs` path, a section heading with
//    " — " in it, an owner name) is free text pulled from HEARTBEAT.md / task records — not
//    something this module controls the shape of. Left as a plain paragraph, an underscore in
//    a path can trigger emphasis, a leading `#`-like token could be misread, and multiple
//    lines with no blank line between them get soft-wrapped into one line by most renderers
//    (Linear's included), which would smear "source:", "repo:", "refs:" onto a single line.
//    A fenced code block sidesteps all of that at once: it always opens a new block regardless
//    of what precedes it (unlike the setext case above), so it can't misparse the footer's own
//    text, and it preserves the one-field-per-line layout exactly as authored.
function renderFooter({ file, section, taskId, refs, ownerName, unassigned }) {
  const lines = [
    `source: ${file} § ${section} · \`${taskId}\``,
    `repo: ${REPO_SLUG} @ ${BRANCH}`,
    `refs: ${refs && refs.length > 0 ? refs.join(", ") : "none"}`,
  ];
  // Named ONLY when unassigned: ownership is otherwise implicit in assignee_email, and
  // repeating it on every issue would just be noise. When the assignee didn't resolve, this
  // line is the only place the owner of record survives on the Linear side.
  if (unassigned) {
    lines.push(`owner of record: ${ownerName} (no Linear account yet)`);
  }
  return "\n\n---\n\n```\n" + lines.join("\n") + "\n```";
}

// Looks up the HEARTBEAT item this task was extracted from, by task id. 18 of the 172 records
// in data/tasks.yaml are decomposition children invented while building the registry (e.g. the
// four-slice merge split into slice-1..slice-4) and carry an id that never appears in
// HEARTBEAT.md — heartbeat.find() correctly returns undefined for those, and task.title (which
// is itself a real, human-written description of the sub-task, not a placeholder) is a useful
// fallback rather than an empty body.
// source.text is the third case: an item ported from another instance's backlog (see the
// 2026-08-31 handoff routing toolkit work out of regen-coordination-os). It has no entry in
// this repo's HEARTBEAT.md and it is not a decomposition child, so both branches above would
// collapse the body to the bare title and lose the original prose — the only text that lets a
// reviewer judge what the item actually is. A matching HEARTBEAT item still wins, so this can
// never shadow live local text.
function describeBody(task, heartbeat) {
  const item = (heartbeat ?? []).find((h) => h.id === task.id);
  return item?.text || task.source?.text || task.title;
}

export function buildManifest({ tasks, members, heartbeat }) {
  const issues = tasks.map((task) => {
    const member = resolveOwner(members, task.owner);
    const assigneeResolved = Boolean(member && member.linear_email);
    const labels = deriveLabels(task, { assigneeResolved });

    const footer = renderFooter({
      // Defaults to this repo's HEARTBEAT.md, which is where all 172 original records came
      // from. Cross-instance items (e.g. toolkit work ported out of regen-coordination-os)
      // carry their own source.file, and the footer must name it — an issue that claims the
      // wrong origin is worse than one that claims none, because it sends a reviewer looking
      // for a section that does not exist here.
      file: task.source?.file ?? "HEARTBEAT.md",
      section: task.source?.section ?? "unknown",
      taskId: task.id,
      refs: task.source?.refs ?? [],
      ownerName: member?.name ?? task.owner,
      unassigned: !assigneeResolved,
    });

    return {
      task_id: task.id,
      title: task.title,
      description: describeBody(task, heartbeat) + footer,
      project: task.project,
      labels,
      estimate: task.estimate,
      assignee_email: assigneeResolved ? member.linear_email : null,
      cycle: task.cycle,
      parent: task.parent,
      blocked_by: task.blocked_by ?? [],
    };
  });

  const labelSet = new Set();
  for (const issue of issues) {
    for (const label of issue.labels) labelSet.add(label);
  }

  return {
    schema_version: "1.0",
    repo: REPO_SLUG,
    branch: BRANCH,
    initiative: "toolkit",
    projects: PROJECT_DEFS,
    labels: [...labelSet].sort(),
    issues,
  };
}
