import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlan, preflight } from "../lib/planner.mjs";

const manifest = {
  projects: [{ slug: "repo-contribution", name: "Stabilise the repo for contribution", description: "d" }],
  labels: ["seed/repo", "layer/10"],
  issues: [
    { task_id: "task-260806-luiz-a", title: "A", labels: ["seed/repo"], project: "repo-contribution", estimate: 1 },
    { task_id: "task-260806-luiz-b", title: "B", labels: ["seed/repo"], project: "repo-contribution", estimate: 2 },
  ],
};

// --- preflight: all four branches ---

test("preflight passes on an empty team", () => {
  assert.deepEqual(preflight({ existingIssueCount: 0, seededCount: 0, allowNonEmpty: false }), { ok: true });
});

test("preflight aborts on a non-empty unrecognised team", () => {
  const result = preflight({ existingIssueCount: 12, seededCount: 0, allowNonEmpty: false });
  assert.equal(result.ok, false);
  assert.match(result.reason, /--allow-nonempty/);
  assert.match(result.reason, /12/);
});

test("preflight passes when every existing issue is ours", () => {
  assert.deepEqual(preflight({ existingIssueCount: 12, seededCount: 12, allowNonEmpty: false }), { ok: true });
});

test("preflight passes on a non-empty team with the override", () => {
  assert.deepEqual(preflight({ existingIssueCount: 12, seededCount: 0, allowNonEmpty: true }), { ok: true });
});

test("preflight still fails when only some existing issues are ours", () => {
  const result = preflight({ existingIssueCount: 12, seededCount: 5, allowNonEmpty: false });
  assert.equal(result.ok, false);
});

// --- create vs update partitioning ---

test("plans creates for unmapped tasks", () => {
  const plan = buildPlan({ manifest, idMap: { entries: {} }, remote: { projects: [], labels: [] } });
  assert.equal(plan.issues.create.length, 2);
  assert.equal(plan.issues.update.length, 0);
});

test("plans updates for mapped tasks", () => {
  const idMap = { entries: { "task-260806-luiz-a": { issue_id: "u1", identifier: "TOOL-1", state: "active" } } };
  const plan = buildPlan({ manifest, idMap, remote: { projects: [], labels: [] } });
  assert.equal(plan.issues.create.length, 1);
  assert.equal(plan.issues.update.length, 1);
  assert.equal(plan.issues.update[0].issue_id, "u1");
  assert.equal(plan.issues.update[0].identifier, "TOOL-1");
});

test("skips orphaned entries by recreating them", () => {
  const idMap = { entries: { "task-260806-luiz-a": { issue_id: "u1", identifier: "TOOL-1", state: "orphaned" } } };
  const plan = buildPlan({ manifest, idMap, remote: { projects: [], labels: [] } });
  assert.equal(plan.issues.create.length, 2);
  assert.equal(plan.issues.update.length, 0);
});

// --- update omits Linear-owned fields (the ownership-model bug) ---

test("update omits assignee_email and cycle — Linear owns those once an issue is seeded", () => {
  const m = {
    projects: [],
    labels: [],
    issues: [
      {
        task_id: "task-260806-luiz-a",
        title: "A",
        description: "body",
        labels: ["seed/repo"],
        project: "repo-contribution",
        estimate: 1,
        assignee_email: "luiz@example.com",
        cycle: 1,
        parent: null,
        blocked_by: [],
      },
    ],
  };
  const idMap = { entries: { "task-260806-luiz-a": { issue_id: "u1", identifier: "TOOL-1", state: "active" } } };
  const plan = buildPlan({ manifest: m, idMap, remote: { projects: [], labels: [] } });
  assert.equal(plan.issues.update.length, 1);
  assert.ok(!("assignee_email" in plan.issues.update[0]), "assignee_email must not appear in an update");
  assert.ok(!("cycle" in plan.issues.update[0]), "cycle must not appear in an update");
  // Repo-owned fields still ride along.
  assert.equal(plan.issues.update[0].title, "A");
  assert.equal(plan.issues.update[0].estimate, 1);
});

test("create still carries assignee_email and cycle — nothing is Linear-owned before creation", () => {
  const m = {
    projects: [],
    labels: [],
    issues: [
      { task_id: "task-260806-luiz-a", title: "A", labels: [], project: null, estimate: 1, assignee_email: "luiz@example.com", cycle: 1 },
    ],
  };
  const plan = buildPlan({ manifest: m, idMap: { entries: {} }, remote: { projects: [], labels: [] } });
  assert.equal(plan.issues.create[0].assignee_email, "luiz@example.com");
  assert.equal(plan.issues.create[0].cycle, 1);
});

// --- projects: create vs adopt, and the id/slug the executor needs ---

test("adopts an existing project by name instead of recreating it", () => {
  const remote = { projects: [{ id: "p1", name: "Stabilise the repo for contribution" }], labels: [] };
  const plan = buildPlan({ manifest, idMap: { entries: {} }, remote });
  assert.equal(plan.projects.create.length, 0);
  assert.equal(plan.projects.adopt.length, 1);
});

test("an adopted project carries its remote id and slug so issues can attach to it", () => {
  const remote = { projects: [{ id: "p1", name: "Stabilise the repo for contribution" }], labels: [] };
  const plan = buildPlan({ manifest, idMap: { entries: {} }, remote });
  assert.equal(plan.projects.adopt[0].id, "p1");
  assert.equal(plan.projects.adopt[0].slug, "repo-contribution");
});

test("adopts a project whose remote name differs only by case or incidental whitespace", () => {
  const remote = { projects: [{ id: "p1", name: "  STABILISE THE   Repo for Contribution  " }], labels: [] };
  const plan = buildPlan({ manifest, idMap: { entries: {} }, remote });
  assert.equal(plan.projects.create.length, 0);
  assert.equal(plan.projects.adopt[0].id, "p1");
});

test("creates a project genuinely absent from Linear", () => {
  const plan = buildPlan({ manifest, idMap: { entries: {} }, remote: { projects: [], labels: [] } });
  assert.equal(plan.projects.create.length, 1);
  assert.equal(plan.projects.adopt.length, 0);
});

test("throws when the manifest itself declares two projects with the same normalized name", () => {
  const m = {
    projects: [
      { slug: "a", name: "Same Name" },
      { slug: "b", name: "same   name" },
    ],
    labels: [],
    issues: [],
  };
  assert.throws(
    () => buildPlan({ manifest: m, idMap: { entries: {} }, remote: { projects: [], labels: [] } }),
    /more than one project named/i
  );
});

test("throws when Linear itself has two projects with the same normalized name", () => {
  const remote = { projects: [{ id: "p1", name: "Dup" }, { id: "p2", name: "dup" }], labels: [] };
  const m = { projects: [{ slug: "x", name: "X" }], labels: [], issues: [] };
  assert.throws(
    () => buildPlan({ manifest: m, idMap: { entries: {} }, remote }),
    /Linear already has more than one project named/i
  );
});

// --- labels: create only when absent, expose ids for the rest ---

test("plans label creation only for absent labels", () => {
  const remote = { projects: [], labels: [{ id: "l1", name: "seed/repo" }] };
  const plan = buildPlan({ manifest, idMap: { entries: {} }, remote });
  assert.deepEqual(plan.labels.create, ["layer/10"]);
});

test("exposes existing label ids for the executor to reuse", () => {
  const remote = { projects: [], labels: [{ id: "l1", name: "seed/repo" }] };
  const plan = buildPlan({ manifest, idMap: { entries: {} }, remote });
  assert.deepEqual(plan.labelIds, { "seed/repo": "l1" });
});

test("matches an existing label by name case-insensitively, so it isn't recreated", () => {
  const m = { projects: [], labels: ["Seed/Repo", "layer/10"], issues: [] };
  const remote = { projects: [], labels: [{ id: "l1", name: "seed/repo" }] };
  const plan = buildPlan({ manifest: m, idMap: { entries: {} }, remote });
  assert.deepEqual(plan.labels.create, ["layer/10"]);
});

// --- normName reuses members.mjs's zero-width-stripping normKey (Task: share the normalizer) ---

test("matches an existing project whose remote name carries an invisible zero-width space", () => {
  // Regression test for normName's replacement — mirrors members.test.mjs's "resolveOwner
  // strips an invisible zero-width space". Before normName was switched to reuse members.mjs's
  // normKey, a project/label name pasted from Docs/Notion with a zero-width space would make
  // buildPlan think an existing project is absent and propose creating a duplicate.
  const ZWSP = String.fromCharCode(0x200b);
  const m = {
    projects: [{ slug: "repo-contribution", name: `Stabilise${ZWSP} the repo for contribution`, description: "d" }],
    labels: [],
    issues: [],
  };
  const remote = { projects: [{ id: "p1", name: "Stabilise the repo for contribution" }], labels: [] };
  const plan = buildPlan({ manifest: m, idMap: { entries: {} }, remote });
  assert.equal(plan.projects.create.length, 0);
  assert.equal(plan.projects.adopt.length, 1);
  assert.equal(plan.projects.adopt[0].id, "p1");
});

test("matches an existing label whose remote name carries an invisible zero-width space", () => {
  const ZWSP = String.fromCharCode(0x200b);
  const m = { projects: [], labels: [`seed/${ZWSP}repo`], issues: [] };
  const remote = { projects: [], labels: [{ id: "l1", name: "seed/repo" }] };
  const plan = buildPlan({ manifest: m, idMap: { entries: {} }, remote });
  assert.deepEqual(plan.labels.create, []);
  assert.deepEqual(plan.labelIds, { "seed/repo": "l1" });
});
