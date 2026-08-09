// Stage 3 — apply. This is the ONLY module in the pipeline that mutates Linear. Order: create
// projects -> adopt projects (no-op, just logged) -> create labels -> create issues
// (parent-before-child) -> update issues. Every successful write is followed immediately by
// idmap.recordIssue (before the next issue is even attempted) and runlog.appendApply, so an
// interrupted run resumes cleanly and every operation is auditable after the fact.
//
// --- The two-client rule ---
// `client` (lib/client.mjs's LinearClient, default maxRetries: 3) is safe to retry blindly for
// reads — replaying a query is free, it just re-fetches the same state. It is NOT safe to
// replay blindly for a mutation: if the HTTP response to an issueCreate is lost after Linear
// already committed the write (a dropped connection, a proxy timeout, a 5xx generated after the
// write landed), retrying resends the *same create* and Linear ends up with two issues for one
// task. Transport genuinely cannot tell "the server never got this" from "the server got it, did
// the write, and only the response died" — that distinction belongs to the caller who knows
// which kind of request this is, which is why the retry policy is split at this layer instead of
// inside LinearClient. Reads always go through `client`. Mutations always go through
// `mutationClient`, which the caller (apply.mjs) constructs with `maxRetries: 0` — verified in
// client.test.mjs ("maxRetries = 0 makes exactly one attempt, no retries") — so a mutation either
// lands once or throws once; it is never silently resent. Nothing in this module currently
// issues a read (every fact it needs — team id, project ids, label ids, cycle ids — already rode
// in on `plan`, produced by the read-only plan stage), so `client` sees zero calls today; it is
// threaded through anyway so the separation is structural from day one, not something bolted on
// the first time a read becomes necessary here.
//
// If `mutationClient` is omitted this falls back to `client`, so a caller that forgets it doesn't
// hard-crash — but that fallback reintroduces the double-create risk this module exists to
// prevent. It is not the intended production path; `apply.mjs` always constructs and passes both.
//
// --- Sub-issues (18 of 172 manifest records carry a non-null `parent`) ---
// The manifest's `parent` is a task id; Linear's `parentId` on IssueCreateInput needs an ISSUE
// id, which does not exist until the parent issue is created. In the committed
// seed-manifest.yaml every parent happens to appear before its children, but nothing enforces
// that — a future edit to data/tasks.yaml could interleave them, or list a child first, or (in
// principle) nest more than one level deep. Rather than trust manifest order,
// `orderCreatesForParents` below topologically sorts `plan.issues.create` so a parent is always
// created (and recorded in `taskIssueId`, giving it a real issue id) before any child that
// depends on it is attempted, regardless of input order or nesting depth. A parent that already
// exists — created in a previous run, or present in this run's `update` list because it's
// already mapped — resolves through `taskIssueId`, which is seeded from every ACTIVE id-map
// entry before creation starts, so it never needs to appear in `create` at all. A parent that
// resolves nowhere (not in the create batch, not in the id-map) throws, naming the task id,
// rather than silently sending Linear a null parentId.
//
// --- blocked_by: explicitly NOT implemented here ---
// `blocked_by` rides along on the plan objects (planner.mjs strips only assignee_email/cycle
// from `update`; `create` keeps everything from the manifest), but Linear models "blocks/blocked
// by" as an issue *relation* — a separate `issueRelationCreate`-shaped mutation between two
// EXISTING issue ids — not a field IssueCreateInput/IssueUpdateInput accepts. Wiring that up
// needs both issues of a pair to already exist, which is the same ordering problem as `parent`
// but worse: a blocker can point forward or backward across the entire 172-issue graph, not just
// within one parent's children, so it can't simply ride the same topological pass. That is real,
// separate scope. It is not implemented in this task, and this module ignores `blocked_by`
// rather than silently misusing it as an issue field. Flagging plainly rather than dropping it
// quietly: a follow-up task should add an explicit relation-sync pass once
// `issueRelationCreate`'s input shape is confirmed against Linear's live schema.
//
// --- assignee: resolved on create, never touched on update ---
// `assignee_email` survives onto `plan.issues.create` (nothing Linear-owned exists yet at create
// time — see planner.mjs). plan.mjs's Stage 2 read now fetches active team members alongside
// issues/projects/labels/cycles and exposes `plan.userIdsByEmail`, a `{ lowercased email: user
// id }` map (Team.members returns `{ id name email active }`, confirmed by live introspection —
// only `active` users are included). On CREATE, `issue.assignee_email` is looked up in that map
// case-insensitively; a hit sets `assigneeId`, a miss (no email, or an email with no active
// workspace member) creates the issue unassigned rather than failing the run. That is the same
// safe degraded state the design already prescribes for an owner with no resolvable Linear
// account (`needs-assignee` label, owner named in the description footer — see manifest.mjs) —
// nothing is ever mis-assigned, just left unassigned for a human (or a later re-run once the
// person joins Linear) to pick up.
//
// On UPDATE, `assigneeId` is never sent, full stop — see the "update issues" step below. Linear
// owns the assignee once an issue is seeded (spec §2.1), and planner.mjs already strips
// `assignee_email` before an issue reaches `update`. Even if it hadn't been stripped, this
// executor must not turn it into `assigneeId` on an update input — that would let a routine
// resync silently revert a hand-done reassignment. This is the ownership split the whole design
// rests on.
//
// --- estimate: null is sent explicitly, never omitted ---
// A parent record's `estimate` is deliberately `null` (spec §4.1: "Linear rolls the estimate up
// [from children]. A parent record carries `estimate: null`."). On CREATE that doesn't matter —
// nothing to clear. On UPDATE it does: an IssueUpdateInput is presumed to follow Linear's usual
// partial-update contract, where an OMITTED field is left untouched and an explicit `null`
// clears it. If a task's estimate later changes from a number to null (it gets decomposed into
// sized sub-issues and the parent's own number becomes stale), a resync must actually clear the
// parent's Linear estimate so Linear starts rolling it up from the children — omitting the field
// on that update would leave the old number in place, silently wrong. Every mutation input built
// here therefore includes `estimate` explicitly, `null` and all, never conditionally dropped.
//
// --- initiative linkage: NOT a ProjectCreateInput field ---
// Live introspection (2026-08-08) confirmed `ProjectCreateInput` has no `initiativeIds` field
// (no field on it mentions "initiative" at all) — the earlier guess in this module was wrong.
// The actual linkage is a second, separate mutation: `initiativeToProjectCreate`, whose input
// type `InitiativeToProjectCreateInput` has exactly `{ id, projectId, initiativeId, sortOrder }`.
// So project creation here is two mutations, not one: `projectCreate` (team-only, no initiative),
// immediately followed by `initiativeToProjectCreate` linking the new project id to
// `plan.initiative.id`. Each is logged as its own `appendApply` operation (`project.create` then
// `project.link-initiative`) so the run log shows them as the two distinct writes they are.
//
// A failed link throws, aborting the run, same as every other create failure in this module —
// deliberately, not by default. Two reasons: (1) this module's existing convention is that every
// `success: false` response throws immediately (projectCreate, issueLabelCreate, issueCreate,
// issueUpdate all do), matching the design's "any create failure exits non-zero; there is no
// partial success that reads as success" rule — silently swallowing just this one write would be
// an inconsistent carve-out. (2) it is not safely retryable later the way the others are: the
// next `npm run linear:plan` matches this project by name and finds it already exists in Linear,
// so it is planned as `adopt`, not `create` — and the link mutation only runs from the `create`
// branch. A silently-continued failure here would leave the project permanently unlinked from
// the initiative with no future run ever noticing or retrying it. Throwing surfaces it while the
// project id is still on screen/in the log, so a human can link it by hand in Linear or fix and
// re-run immediately.
//
// GraphQL field-name confidence: `teamId`, `title`, `description`, `estimate`, `projectId`,
// `labelIds`, `parentId`, `cycleId`, `assigneeId` on IssueCreateInput, `title`, `description`,
// `estimate`, `projectId`, `labelIds` on IssueUpdateInput, `name`+`teamIds` on
// ProjectCreateInput, `name`+`teamId` on IssueLabelCreateInput, and `projectId`+`initiativeId` on
// InitiativeToProjectCreateInput are all confirmed against live introspection (2026-08-08).
import { recordIssue } from "./idmap.mjs";
import { appendApply, RUNS_DIR } from "./runlog.mjs";

const PROJECT_CREATE = `
  mutation($input: ProjectCreateInput!) {
    projectCreate(input: $input) { success project { id name } }
  }`;

const INITIATIVE_TO_PROJECT_CREATE = `
  mutation($input: InitiativeToProjectCreateInput!) {
    initiativeToProjectCreate(input: $input) { success }
  }`;

const LABEL_CREATE = `
  mutation($input: IssueLabelCreateInput!) {
    issueLabelCreate(input: $input) { success issueLabel { id name } }
  }`;

const ISSUE_CREATE = `
  mutation($input: IssueCreateInput!) {
    issueCreate(input: $input) { success issue { id identifier } }
  }`;

const ISSUE_UPDATE = `
  mutation($id: String!, $input: IssueUpdateInput!) {
    issueUpdate(id: $id, input: $input) { success issue { id identifier } }
  }`;

function resolveLabelIds(names, labelIdByName, taskId) {
  return (names ?? []).map((name) => {
    const id = labelIdByName.get(name);
    if (!id) {
      throw new Error(
        `executePlan: task "${taskId}" references label "${name}", which has no resolved Linear ` +
          `id (not in plan.labelIds and not created earlier this run). The plan is stale — ` +
          `re-run \`npm run linear:plan\`.`
      );
    }
    return id;
  });
}

// Case-insensitive email -> Linear user id lookup, matching plan.mjs's `userIdsByEmail` (already
// lowercased there) and the norm-then-lookup idiom members.mjs uses. Missing email, missing map
// (an older/partial plan), or no matching active workspace member all resolve to `null` — never
// throw — so a task always lands as an issue, assigned or not.
function resolveAssigneeId(email, userIdsByEmail) {
  if (!email) return null;
  return userIdsByEmail?.[String(email).toLowerCase()] ?? null;
}

function resolveProjectId(slug, projectIdBySlug, taskId) {
  if (!slug) return null;
  const id = projectIdBySlug.get(slug);
  if (!id) {
    throw new Error(
      `executePlan: task "${taskId}" targets project "${slug}", which has no resolved Linear id ` +
        `(not adopted, not created earlier this run). The plan is stale — re-run \`npm run linear:plan\`.`
    );
  }
  return id;
}

// Topological sort by `parent`, scoped to this create batch. A parent already resolvable via
// `taskIssueId` (exists in Linear from a previous run, or is in this run's update set) needs no
// special handling here — it's a plain lookup at creation time, not an ordering constraint. Only
// parent/child pairs that are BOTH being created in this same batch need reordering. See the
// "Sub-issues" note at the top of this file.
export function orderCreatesForParents(creates, taskIssueId) {
  const byId = new Map(creates.map((c) => [c.task_id, c]));
  const ordered = [];
  const placed = new Set();
  const visiting = new Set();

  function visit(issue) {
    if (placed.has(issue.task_id)) return;
    if (visiting.has(issue.task_id)) {
      throw new Error(`executePlan: parent cycle detected involving task "${issue.task_id}".`);
    }
    const parentTaskId = issue.parent;
    if (parentTaskId && byId.has(parentTaskId) && !taskIssueId.has(parentTaskId)) {
      visiting.add(issue.task_id);
      visit(byId.get(parentTaskId));
      visiting.delete(issue.task_id);
    }
    placed.add(issue.task_id);
    ordered.push(issue);
  }

  for (const issue of creates) visit(issue);
  return ordered;
}

export async function executePlan({ plan, client, mutationClient, idMapPath, idMap, stamp, runsDir = RUNS_DIR }) {
  // Fail fast and clearly rather than obliquely: everything below dereferences plan.team.id,
  // plan.initiative.id, plan.cycleIds, plan.projects, plan.labels, plan.issues without further
  // guarding, so a plan from before the team was resolved (or from an older/malformed schema)
  // must be caught here, naming the exact thing missing, instead of surfacing as a bare
  // "Cannot read properties of undefined" three calls deep into a mutation loop.
  if (!plan?.team?.id) {
    throw new Error(
      "executePlan: plan.team.id is missing. This plan file either predates team resolution or " +
        "comes from an older schema than this executor expects — re-run `npm run linear:plan` " +
        "against the current manifest and id-map, rather than applying a stale/partial plan file."
    );
  }
  if (!plan.projects || !plan.labels || !plan.issues) {
    throw new Error(
      "executePlan: plan is missing projects/labels/issues — this does not look like a plan " +
        "produced by buildPlan(). Re-run `npm run linear:plan` and pass the fresh artifact."
    );
  }

  // Not the intended production path — see the module comment above. apply.mjs always passes
  // both clients; this fallback only exists so a caller that forgets `mutationClient` fails by
  // reusing the retrying client (works, but reintroduces the double-create risk) rather than by
  // crashing on `undefined.query`.
  const mutate = mutationClient ?? client;

  const projectIdBySlug = new Map((plan.projects.adopt ?? []).map((p) => [p.slug, p.id]));
  const labelIdByName = new Map(Object.entries(plan.labelIds ?? {}));

  let created = 0;
  let updated = 0;

  // 1. create projects, then link each to the initiative — two mutations, see module comment
  // ("initiative linkage") for why this is `projectCreate` + `initiativeToProjectCreate` rather
  // than a single call, and why a failed link throws instead of being swallowed.
  for (const p of plan.projects.create ?? []) {
    const data = await mutate.query(PROJECT_CREATE, {
      input: {
        name: p.name,
        description: p.description,
        teamIds: [plan.team.id],
      },
    });
    if (!data.projectCreate.success) {
      throw new Error(`executePlan: projectCreate failed for project "${p.slug}" (${p.name}).`);
    }
    const projectId = data.projectCreate.project.id;
    projectIdBySlug.set(p.slug, projectId);
    appendApply(stamp, { op: "project.create", slug: p.slug, name: p.name, id: projectId }, runsDir);

    const linkData = await mutate.query(INITIATIVE_TO_PROJECT_CREATE, {
      input: { projectId, initiativeId: plan.initiative.id },
    });
    if (!linkData.initiativeToProjectCreate.success) {
      throw new Error(
        `executePlan: initiativeToProjectCreate failed linking project "${p.slug}" (${projectId}) to ` +
          `initiative "${plan.initiative.name}" (${plan.initiative.id}). The project now exists in ` +
          `Linear but is not attached to the initiative — a re-plan will adopt it by name rather than ` +
          `retry this link, so fix it by hand in Linear (or re-run this apply once the cause is clear).`
      );
    }
    appendApply(
      stamp,
      { op: "project.link-initiative", slug: p.slug, project_id: projectId, initiative_id: plan.initiative.id },
      runsDir
    );
  }

  // 2. adopt projects — nothing to mutate, id already known from the plan; logged anyway so the
  // apply log is a complete record of what this run touched, not just what it created.
  for (const p of plan.projects.adopt ?? []) {
    appendApply(stamp, { op: "project.adopt", slug: p.slug, name: p.name, id: p.id }, runsDir);
  }

  // 3. create labels
  for (const name of plan.labels.create ?? []) {
    const data = await mutate.query(LABEL_CREATE, { input: { name, teamId: plan.team.id } });
    if (!data.issueLabelCreate.success) {
      throw new Error(`executePlan: issueLabelCreate failed for label "${name}".`);
    }
    labelIdByName.set(name, data.issueLabelCreate.issueLabel.id);
    appendApply(stamp, { op: "label.create", name, id: data.issueLabelCreate.issueLabel.id }, runsDir);
  }

  // 4. create issues — parent before child (see orderCreatesForParents / the module comment).
  const taskIssueId = new Map();
  for (const [taskId, entry] of Object.entries(idMap.entries ?? {})) {
    if (entry.state === "active") taskIssueId.set(taskId, entry.issue_id);
  }

  const orderedCreates = orderCreatesForParents(plan.issues.create ?? [], taskIssueId);
  for (const issue of orderedCreates) {
    let parentId = null;
    if (issue.parent) {
      parentId = taskIssueId.get(issue.parent) ?? null;
      if (!parentId) {
        throw new Error(
          `executePlan: task "${issue.task_id}" declares parent "${issue.parent}", which has no ` +
            `resolved Linear issue id (not created earlier this run and not in the id-map). ` +
            `Check the parent task exists in the manifest and the plan is current.`
        );
      }
    }

    const input = {
      teamId: plan.team.id,
      title: issue.title,
      description: issue.description,
      estimate: issue.estimate, // explicit, even when null — see "estimate" note above.
      projectId: resolveProjectId(issue.project, projectIdBySlug, issue.task_id),
      labelIds: resolveLabelIds(issue.labels, labelIdByName, issue.task_id),
    };
    if (parentId) input.parentId = parentId;
    const assigneeId = resolveAssigneeId(issue.assignee_email, plan.userIdsByEmail);
    if (assigneeId) input.assigneeId = assigneeId;
    if (issue.cycle != null) {
      const cycleId = plan.cycleIds?.[issue.cycle];
      if (!cycleId) {
        throw new Error(
          `executePlan: task "${issue.task_id}" targets cycle ${issue.cycle}, which has no ` +
            `resolved id in plan.cycleIds. The plan is stale — re-run \`npm run linear:plan\`.`
        );
      }
      input.cycleId = cycleId;
    }

    const data = await mutate.query(ISSUE_CREATE, { input });
    if (!data.issueCreate.success) {
      throw new Error(`executePlan: issueCreate failed for task "${issue.task_id}".`);
    }
    const { id: issue_id, identifier } = data.issueCreate.issue;

    // Recorded BEFORE moving to the next issue — this is the whole resumability guarantee.
    // idmap.recordIssue persists to disk synchronously on every call (see idmap.mjs), so a crash
    // one line later still leaves this create durably reflected on disk.
    recordIssue(idMapPath, idMap, issue.task_id, { issue_id, identifier });
    appendApply(stamp, { op: "issue.create", task_id: issue.task_id, issue_id, identifier }, runsDir);

    taskIssueId.set(issue.task_id, issue_id);
    created += 1;
  }

  // 5. update issues — repo-owned fields only: title, description, estimate, project, labels.
  // Never status/assignee/cycle position — Linear owns those once an issue is seeded, and
  // planner.mjs already strips assignee_email/cycle before an issue reaches `update`. `parent`
  // and `blocked_by` are likewise not sent on update: `parent` is set once at creation time and
  // is not re-asserted on every resync; `blocked_by` is out of scope entirely (see module
  // comment above). Do not reintroduce any of those here.
  for (const issue of plan.issues.update ?? []) {
    const input = {
      title: issue.title,
      description: issue.description,
      estimate: issue.estimate,
      projectId: resolveProjectId(issue.project, projectIdBySlug, issue.task_id),
      labelIds: resolveLabelIds(issue.labels, labelIdByName, issue.task_id),
    };
    const data = await mutate.query(ISSUE_UPDATE, { id: issue.issue_id, input });
    if (!data.issueUpdate.success) {
      throw new Error(`executePlan: issueUpdate failed for task "${issue.task_id}" (${issue.identifier}).`);
    }
    appendApply(
      stamp,
      { op: "issue.update", task_id: issue.task_id, issue_id: issue.issue_id, identifier: issue.identifier },
      runsDir
    );
    updated += 1;
  }

  return { created, updated };
}
