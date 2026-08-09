import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { executePlan, orderCreatesForParents } from "../lib/executor.mjs";
import { loadIdMap } from "../lib/idmap.mjs";
import { buildPlan } from "../lib/planner.mjs";

// --- fixtures: no network, ever. A stub "client" is just an object with a `query(document,
// variables)` async method, mirroring LinearClient's own public surface (see client.mjs), plus
// a `calls` array so tests can assert exactly what was sent and to which client. ---

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "linear-apply-"));
}
function tmpFile() {
  return path.join(tmpDir(), "id-map.yaml");
}

// Dispatches on the mutation name appearing in the document text (issueCreate, issueUpdate,
// projectCreate, issueLabelCreate). A handler is `(variables, callNumber) => data` or a plain
// object if the response never varies. Throws loudly, naming what it couldn't route, rather
// than hanging or returning undefined — the same design idiom client.test.mjs's sequenceFetch
// uses for the layer below this one.
function makeClient(handlers) {
  const calls = [];
  const query = async (document, variables) => {
    calls.push({ document, variables });
    const key = Object.keys(handlers).find((k) => document.includes(k));
    if (!key) {
      throw new Error(
        `stub client: no handler for a document containing any of [${Object.keys(handlers).join(", ")}]`
      );
    }
    const handler = handlers[key];
    return typeof handler === "function" ? handler(variables, calls.length) : handler;
  };
  return { calls, query };
}

function basePlan(overrides = {}) {
  return {
    team: { id: "team-1", key: "TOOL", name: "Toolkit" },
    initiative: { id: "init-1", name: "toolkit" },
    cycleIds: {},
    projects: { create: [], adopt: [] },
    labels: { create: [] },
    labelIds: {},
    issues: { create: [], update: [] },
    ...overrides,
  };
}

function issueFixture(taskId, overrides = {}) {
  return {
    task_id: taskId,
    title: overrides.title ?? taskId,
    description: overrides.description ?? "body",
    project: overrides.project ?? null,
    labels: overrides.labels ?? [],
    estimate: overrides.estimate === undefined ? null : overrides.estimate,
    parent: overrides.parent ?? null,
    cycle: overrides.cycle ?? null,
    assignee_email: overrides.assignee_email ?? null,
  };
}

// Shared setup for the common case: a fresh id-map, a plain (non-retrying-client-touching) read
// client, a scratch runs dir, stamp "STAMP". 25 of the ~28 tests below only ever varied `plan`
// and `mutationClient` — this collapses the "const idMapPath = tmpFile(); const idMap =
// loadIdMap(idMapPath); ... client: makeClient({}), runsDir: tmpDir()" ritual those tests all
// repeated verbatim. Pure de-duplication of setup — every overridable piece (idMapPath, idMap,
// client, stamp, runsDir) can still be supplied explicitly by a test that needs to reuse or
// inspect it (e.g. reloading the id-map, or reading back the run log), and executePlan's own
// return value is untouched, just joined with the id-map bits a caller might want. Nothing here
// changes what any test asserts.
async function apply(plan, mutationClient, overrides = {}) {
  const idMapPath = overrides.idMapPath ?? tmpFile();
  const idMap = overrides.idMap ?? loadIdMap(idMapPath);
  const runsDir = overrides.runsDir ?? tmpDir();
  const result = await executePlan({
    plan,
    client: overrides.client ?? makeClient({}),
    mutationClient,
    idMapPath,
    idMap,
    stamp: overrides.stamp ?? "STAMP",
    runsDir,
  });
  return { ...result, idMapPath, idMap, runsDir };
}

// --- each planned issue is created and recorded in the id-map ---

test("creates each planned issue and records it in the id-map", async () => {
  const plan = basePlan({
    issues: { create: [issueFixture("task-a", { title: "A" }), issueFixture("task-b", { title: "B" })], update: [] },
  });
  let n = 0;
  const mutationClient = makeClient({
    issueCreate: () => {
      n += 1;
      return { issueCreate: { success: true, issue: { id: `u${n}`, identifier: `TOOL-${n}` } } };
    },
  });
  const { created, updated, idMap, idMapPath } = await apply(plan, mutationClient);
  assert.equal(created, 2);
  assert.equal(updated, 0);
  assert.equal(idMap.entries["task-a"].issue_id, "u1");
  assert.equal(idMap.entries["task-b"].issue_id, "u2");
  const onDisk = loadIdMap(idMapPath);
  assert.equal(onDisk.entries["task-a"].identifier, "TOOL-1");
  assert.equal(onDisk.entries["task-b"].identifier, "TOOL-2");
});

// --- persistence is incremental: a mid-batch failure must not lose earlier work ---

test("persistence is incremental — a later failure does not erase or block recording of earlier successes", async () => {
  const plan = basePlan({ issues: { create: [issueFixture("task-a"), issueFixture("task-b")], update: [] } });
  let call = 0;
  const mutationClient = makeClient({
    issueCreate: () => {
      call += 1;
      if (call === 1) return { issueCreate: { success: true, issue: { id: "u1", identifier: "TOOL-1" } } };
      throw new Error("network exploded");
    },
  });
  const idMapPath = tmpFile();
  await assert.rejects(() => apply(plan, mutationClient, { idMapPath }), /network exploded/);
  const onDisk = loadIdMap(idMapPath);
  assert.ok(onDisk.entries["task-a"], "task-a must be recorded despite the later failure");
  assert.ok(!onDisk.entries["task-b"], "task-b must NOT be recorded — its create never succeeded");
});

// --- run-twice is a no-op: the property the whole design rests on ---

test("re-applying a plan rebuilt from the resulting id-map makes zero issueCreate calls", async () => {
  const idMapPath = tmpFile();
  let idMap = loadIdMap(idMapPath);
  const manifest = {
    projects: [],
    labels: [],
    issues: [
      { task_id: "task-a", title: "A", description: "d", project: null, labels: [], estimate: 1, parent: null, cycle: null, assignee_email: null, blocked_by: [] },
      { task_id: "task-b", title: "B", description: "d", project: null, labels: [], estimate: 1, parent: null, cycle: null, assignee_email: null, blocked_by: [] },
    ],
  };

  const plan1 = buildPlan({ manifest, idMap, remote: { projects: [], labels: [] } });
  plan1.team = { id: "team-1", key: "TOOL", name: "Toolkit" };
  plan1.initiative = { id: "init-1", name: "toolkit" };
  plan1.cycleIds = {};

  let n = 0;
  const mutationClient1 = makeClient({
    issueCreate: () => {
      n += 1;
      return { issueCreate: { success: true, issue: { id: `u${n}`, identifier: `TOOL-${n}` } } };
    },
  });
  await apply(plan1, mutationClient1, { idMapPath, idMap, stamp: "STAMP1" });

  // Simulate a fresh process: reload the id-map from disk, rebuild the plan against it.
  idMap = loadIdMap(idMapPath);
  const plan2 = buildPlan({ manifest, idMap, remote: { projects: [], labels: [] } });
  plan2.team = plan1.team;
  plan2.initiative = plan1.initiative;
  plan2.cycleIds = {};
  assert.equal(plan2.issues.create.length, 0, "both tasks are now mapped — nothing left to create");
  assert.equal(plan2.issues.update.length, 2);

  const mutationClient2 = makeClient({
    issueCreate: () => {
      throw new Error("issueCreate must not be called on the second pass");
    },
    issueUpdate: (vars) => ({ issueUpdate: { success: true, issue: { id: vars.id, identifier: "unused" } } }),
  });
  const { created, updated } = await apply(plan2, mutationClient2, { idMapPath, idMap, stamp: "STAMP2" });
  assert.equal(created, 0);
  assert.equal(updated, 2);
  assert.equal(mutationClient2.calls.filter((c) => c.document.includes("issueCreate")).length, 0);
});

// --- mutations vs reads go through the right client ---

test("mutations go through mutationClient; the read client sees no traffic during apply", async () => {
  const plan = basePlan({ issues: { create: [issueFixture("task-a")], update: [] } });
  const mutationClient = makeClient({
    issueCreate: () => ({ issueCreate: { success: true, issue: { id: "u1", identifier: "TOOL-1" } } }),
  });
  const client = makeClient({});
  await apply(plan, mutationClient, { client });
  assert.equal(client.calls.length, 0, "nothing this executor needs requires a fresh read — it all rode in on `plan`");
  assert.equal(mutationClient.calls.length, 1);
});

test("throws clearly (not obliquely) when mutationClient is omitted, rather than falling back to the retrying client", async () => {
  const idMapPath = tmpFile();
  const idMap = loadIdMap(idMapPath);
  const plan = basePlan({ issues: { create: [issueFixture("task-a")], update: [] } });
  const client = makeClient({
    issueCreate: () => ({ issueCreate: { success: true, issue: { id: "u1", identifier: "TOOL-1" } } }),
  });
  await assert.rejects(
    () => executePlan({ plan, client, idMapPath, idMap, stamp: "STAMP", runsDir: tmpDir() }),
    /mutationClient is required/
  );
  assert.equal(client.calls.length, 0, "must fail before ever touching the retrying client");
});

// --- adopted project id is used, not re-derived ---

test("an adopted project's remote id is used for issues targeting it", async () => {
  const plan = basePlan({
    projects: { create: [], adopt: [{ slug: "repo-contribution", name: "Stabilise", id: "p1" }] },
    issues: { create: [issueFixture("task-a", { project: "repo-contribution" })], update: [] },
  });
  const mutationClient = makeClient({
    issueCreate: (vars) => {
      assert.equal(vars.input.projectId, "p1");
      return { issueCreate: { success: true, issue: { id: "u1", identifier: "TOOL-1" } } };
    },
  });
  await apply(plan, mutationClient);
});

// --- existing label id is reused, never recreated ---

test("an existing label's id is reused rather than recreated", async () => {
  const plan = basePlan({
    labels: { create: [] },
    labelIds: { "seed/repo": "l1" },
    issues: { create: [issueFixture("task-a", { labels: ["seed/repo"] })], update: [] },
  });
  const mutationClient = makeClient({
    issueLabelCreate: () => {
      throw new Error("must not create a label that already exists");
    },
    issueCreate: (vars) => {
      assert.deepEqual(vars.input.labelIds, ["l1"]);
      return { issueCreate: { success: true, issue: { id: "u1", identifier: "TOOL-1" } } };
    },
  });
  await apply(plan, mutationClient);
});

// --- a genuinely new project/label is created and its id becomes usable within the same run ---

test("a newly created project's id is available to issues in the same run", async () => {
  const plan = basePlan({
    projects: { create: [{ slug: "repo-contribution", name: "Stabilise", description: "d" }], adopt: [] },
    issues: { create: [issueFixture("task-a", { project: "repo-contribution" })], update: [] },
  });
  const mutationClient = makeClient({
    projectCreate: (vars) => {
      assert.deepEqual(vars.input.teamIds, ["team-1"]);
      assert.ok(!("initiativeIds" in vars.input), "ProjectCreateInput has no initiativeIds field");
      return { projectCreate: { success: true, project: { id: "new-p1", name: "Stabilise" } } };
    },
    initiativeToProjectCreate: () => ({ initiativeToProjectCreate: { success: true } }),
    issueCreate: (vars) => {
      assert.equal(vars.input.projectId, "new-p1");
      return { issueCreate: { success: true, issue: { id: "u1", identifier: "TOOL-1" } } };
    },
  });
  await apply(plan, mutationClient);
});

// --- initiative linkage: a separate mutation, not a ProjectCreateInput field ---

test("a created project triggers initiativeToProjectCreate with the new project id and the plan's initiative id", async () => {
  const plan = basePlan({
    projects: { create: [{ slug: "repo-contribution", name: "Stabilise", description: "d" }], adopt: [] },
  });
  const mutationClient = makeClient({
    projectCreate: () => ({ projectCreate: { success: true, project: { id: "new-p1", name: "Stabilise" } } }),
    initiativeToProjectCreate: (vars) => {
      assert.equal(vars.input.projectId, "new-p1");
      assert.equal(vars.input.initiativeId, "init-1");
      return { initiativeToProjectCreate: { success: true } };
    },
  });
  await apply(plan, mutationClient);
  const linkCalls = mutationClient.calls.filter((c) => c.document.includes("initiativeToProjectCreate"));
  assert.equal(linkCalls.length, 1);
});

test("a failed initiativeToProjectCreate throws, aborting the run, and names the project", async () => {
  const plan = basePlan({
    projects: { create: [{ slug: "repo-contribution", name: "Stabilise", description: "d" }], adopt: [] },
  });
  const mutationClient = makeClient({
    projectCreate: () => ({ projectCreate: { success: true, project: { id: "new-p1", name: "Stabilise" } } }),
    initiativeToProjectCreate: () => ({ initiativeToProjectCreate: { success: false } }),
  });
  await assert.rejects(() => apply(plan, mutationClient), /repo-contribution/);
});

// --- success: false throws, naming the task id ---

test("a success: false issueCreate response throws, naming the task id", async () => {
  const plan = basePlan({ issues: { create: [issueFixture("task-a")], update: [] } });
  const mutationClient = makeClient({ issueCreate: () => ({ issueCreate: { success: false, issue: null } }) });
  await assert.rejects(() => apply(plan, mutationClient), /task-a/);
});

test("a success: false issueUpdate response throws, naming the task id", async () => {
  const plan = basePlan({
    issues: {
      create: [],
      update: [{ task_id: "task-a", issue_id: "u1", identifier: "TOOL-1", title: "A", description: "d", project: null, labels: [], estimate: 1 }],
    },
  });
  const mutationClient = makeClient({ issueUpdate: () => ({ issueUpdate: { success: false, issue: null } }) });
  await assert.rejects(() => apply(plan, mutationClient), /task-a/);
});

// --- updates never carry Linear-owned fields ---

test("updates never send assignee, cycle, or parent", async () => {
  const plan = basePlan({
    issues: {
      create: [],
      update: [{ task_id: "task-a", issue_id: "u1", identifier: "TOOL-1", title: "A", description: "d", project: null, labels: [], estimate: 2 }],
    },
  });
  const mutationClient = makeClient({
    issueUpdate: (vars) => {
      assert.ok(!("assigneeId" in vars.input), "assigneeId must not appear in an update input");
      assert.ok(!("cycleId" in vars.input), "cycleId must not appear in an update input");
      assert.ok(!("parentId" in vars.input), "parentId must not appear in an update input");
      return { issueUpdate: { success: true, issue: { id: "u1", identifier: "TOOL-1" } } };
    },
  });
  const { updated } = await apply(plan, mutationClient);
  assert.equal(updated, 1);
});

test("estimate: null is sent explicitly on update, not omitted — needed to clear a stale estimate", async () => {
  const plan = basePlan({
    issues: {
      create: [],
      update: [{ task_id: "task-a", issue_id: "u1", identifier: "TOOL-1", title: "A", description: "d", project: null, labels: [], estimate: null }],
    },
  });
  const mutationClient = makeClient({
    issueUpdate: (vars) => {
      assert.ok("estimate" in vars.input, "estimate must be present even when null");
      assert.equal(vars.input.estimate, null);
      return { issueUpdate: { success: true, issue: { id: "u1", identifier: "TOOL-1" } } };
    },
  });
  await apply(plan, mutationClient);
});

// --- cycle resolution on create ---

test("an issue with an explicit cycle number gets that cycle's Linear id on create", async () => {
  const plan = basePlan({
    cycleIds: { 3: "cycle-3" },
    issues: { create: [issueFixture("task-a", { cycle: 3 })], update: [] },
  });
  const mutationClient = makeClient({
    issueCreate: (vars) => {
      assert.equal(vars.input.cycleId, "cycle-3");
      return { issueCreate: { success: true, issue: { id: "u1", identifier: "TOOL-1" } } };
    },
  });
  await apply(plan, mutationClient);
});

// --- assignee resolution on create; never touched on update ---

test("assigneeId is sent on create when the email resolves against plan.userIdsByEmail", async () => {
  const plan = basePlan({
    userIdsByEmail: { "luiz@example.com": "user-1" },
    issues: { create: [issueFixture("task-a", { assignee_email: "luiz@example.com" })], update: [] },
  });
  const mutationClient = makeClient({
    issueCreate: (vars) => {
      assert.equal(vars.input.assigneeId, "user-1");
      return { issueCreate: { success: true, issue: { id: "u1", identifier: "TOOL-1" } } };
    },
  });
  await apply(plan, mutationClient);
});

test("userIdsByEmail matching is case-insensitive", async () => {
  const plan = basePlan({
    userIdsByEmail: { "luiz@example.com": "user-1" },
    issues: { create: [issueFixture("task-a", { assignee_email: "Luiz@Example.COM" })], update: [] },
  });
  const mutationClient = makeClient({
    issueCreate: (vars) => {
      assert.equal(vars.input.assigneeId, "user-1");
      return { issueCreate: { success: true, issue: { id: "u1", identifier: "TOOL-1" } } };
    },
  });
  await apply(plan, mutationClient);
});

test("create is unassigned (no assigneeId, no throw) when assignee_email is absent", async () => {
  const plan = basePlan({
    userIdsByEmail: { "luiz@example.com": "user-1" },
    issues: { create: [issueFixture("task-a", { assignee_email: null })], update: [] },
  });
  const mutationClient = makeClient({
    issueCreate: (vars) => {
      assert.ok(!("assigneeId" in vars.input), "assigneeId must be absent when assignee_email is null");
      return { issueCreate: { success: true, issue: { id: "u1", identifier: "TOOL-1" } } };
    },
  });
  const { created } = await apply(plan, mutationClient);
  assert.equal(created, 1);
});

test("create is unassigned (no assigneeId, no throw) when the email does not resolve to any active member", async () => {
  const plan = basePlan({
    userIdsByEmail: { "luiz@example.com": "user-1" },
    issues: { create: [issueFixture("task-a", { assignee_email: "ghost@example.com" })], update: [] },
  });
  const mutationClient = makeClient({
    issueCreate: (vars) => {
      assert.ok(!("assigneeId" in vars.input), "assigneeId must be absent for an unresolvable email");
      return { issueCreate: { success: true, issue: { id: "u1", identifier: "TOOL-1" } } };
    },
  });
  const { created } = await apply(plan, mutationClient);
  assert.equal(created, 1);
});

test("create is unassigned (no assigneeId, no throw) when plan.userIdsByEmail is entirely absent (older/partial plan)", async () => {
  const plan = basePlan({ issues: { create: [issueFixture("task-a", { assignee_email: "luiz@example.com" })], update: [] } });
  delete plan.userIdsByEmail;
  const mutationClient = makeClient({
    issueCreate: (vars) => {
      assert.ok(!("assigneeId" in vars.input));
      return { issueCreate: { success: true, issue: { id: "u1", identifier: "TOOL-1" } } };
    },
  });
  await apply(plan, mutationClient);
});

test("update never sends assigneeId, even when plan.userIdsByEmail could resolve the owner's email", async () => {
  const plan = basePlan({
    userIdsByEmail: { "luiz@example.com": "user-1" },
    issues: {
      create: [],
      update: [{ task_id: "task-a", issue_id: "u1", identifier: "TOOL-1", title: "A", description: "d", project: null, labels: [], estimate: 1 }],
    },
  });
  const mutationClient = makeClient({
    issueUpdate: (vars) => {
      assert.ok(!("assigneeId" in vars.input), "assigneeId must never appear in an update input");
      return { issueUpdate: { success: true, issue: { id: "u1", identifier: "TOOL-1" } } };
    },
  });
  const { updated } = await apply(plan, mutationClient);
  assert.equal(updated, 1);
});

// --- sub-issues: parent is always created before child, regardless of plan order ---

test("orderCreatesForParents places a parent before its child even when the input lists the child first", () => {
  const creates = [
    { task_id: "task-child", parent: "task-parent" },
    { task_id: "task-parent", parent: null },
  ];
  const ordered = orderCreatesForParents(creates, new Map());
  assert.deepEqual(ordered.map((i) => i.task_id), ["task-parent", "task-child"]);
});

test("orderCreatesForParents leaves order alone when a parent already exists (resolvable via taskIssueId)", () => {
  const creates = [{ task_id: "task-child", parent: "task-parent-already-live" }];
  const ordered = orderCreatesForParents(creates, new Map([["task-parent-already-live", "existing-issue-id"]]));
  assert.deepEqual(ordered.map((i) => i.task_id), ["task-child"]);
});

test("creates the parent before the child end-to-end, even when the plan lists the child first", async () => {
  const plan = basePlan({
    issues: {
      create: [issueFixture("task-child", { parent: "task-parent" }), issueFixture("task-parent")],
      update: [],
    },
  });
  const order = [];
  const mutationClient = makeClient({
    issueCreate: (vars) => {
      if (vars.input.parentId) {
        order.push("child");
        assert.equal(vars.input.parentId, "PARENT-ID");
        return { issueCreate: { success: true, issue: { id: "CHILD-ID", identifier: "TOOL-2" } } };
      }
      order.push("parent");
      return { issueCreate: { success: true, issue: { id: "PARENT-ID", identifier: "TOOL-1" } } };
    },
  });
  const { idMap } = await apply(plan, mutationClient);
  assert.deepEqual(order, ["parent", "child"]);
  assert.equal(idMap.entries["task-parent"].issue_id, "PARENT-ID");
  assert.equal(idMap.entries["task-child"].issue_id, "CHILD-ID");
});

test("throws clearly when a task's parent cannot be resolved to any Linear issue id", async () => {
  const plan = basePlan({ issues: { create: [issueFixture("task-a", { parent: "task-ghost" })], update: [] } });
  const mutationClient = makeClient({
    issueCreate: () => ({ issueCreate: { success: true, issue: { id: "u1", identifier: "T-1" } } }),
  });
  await assert.rejects(() => apply(plan, mutationClient), /task-a.*parent.*task-ghost/s);
});

// --- fail fast on a stale/malformed plan ---

test("throws clearly (not obliquely) when plan.team.id is missing", async () => {
  const plan = { projects: { create: [], adopt: [] }, labels: { create: [] }, labelIds: {}, issues: { create: [], update: [] } };
  await assert.rejects(() => apply(plan, makeClient({})), /plan\.team\.id is missing/);
});

// --- run log: every operation is logged, in order ---

test("logs every operation to the apply log, in the order they happened", async () => {
  const plan = basePlan({
    projects: { create: [{ slug: "new-proj", name: "New", description: "d" }], adopt: [{ slug: "old-proj", name: "Old", id: "p-old" }] },
    labels: { create: ["fresh-label"] },
    labelIds: {},
    issues: { create: [issueFixture("task-a")], update: [] },
  });
  const mutationClient = makeClient({
    projectCreate: () => ({ projectCreate: { success: true, project: { id: "p-new", name: "New" } } }),
    initiativeToProjectCreate: () => ({ initiativeToProjectCreate: { success: true } }),
    issueLabelCreate: () => ({ issueLabelCreate: { success: true, issueLabel: { id: "l-new", name: "fresh-label" } } }),
    issueCreate: () => ({ issueCreate: { success: true, issue: { id: "u1", identifier: "TOOL-1" } } }),
  });
  const { runsDir } = await apply(plan, mutationClient);
  const lines = fs
    .readFileSync(path.join(runsDir, "STAMP-apply.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  assert.deepEqual(
    lines.map((l) => l.op),
    ["project.create", "project.link-initiative", "project.adopt", "label.create", "issue.create"]
  );
});
