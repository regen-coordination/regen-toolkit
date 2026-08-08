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

// --- each planned issue is created and recorded in the id-map ---

test("creates each planned issue and records it in the id-map", async () => {
  const idMapPath = tmpFile();
  const idMap = loadIdMap(idMapPath);
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
  const { created, updated } = await executePlan({
    plan,
    client: makeClient({}),
    mutationClient,
    idMapPath,
    idMap,
    stamp: "STAMP",
    runsDir: tmpDir(),
  });
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
  const idMapPath = tmpFile();
  const idMap = loadIdMap(idMapPath);
  const plan = basePlan({ issues: { create: [issueFixture("task-a"), issueFixture("task-b")], update: [] } });
  let call = 0;
  const mutationClient = makeClient({
    issueCreate: () => {
      call += 1;
      if (call === 1) return { issueCreate: { success: true, issue: { id: "u1", identifier: "TOOL-1" } } };
      throw new Error("network exploded");
    },
  });
  await assert.rejects(
    () =>
      executePlan({ plan, client: makeClient({}), mutationClient, idMapPath, idMap, stamp: "STAMP", runsDir: tmpDir() }),
    /network exploded/
  );
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
  await executePlan({
    plan: plan1,
    client: makeClient({}),
    mutationClient: mutationClient1,
    idMapPath,
    idMap,
    stamp: "STAMP1",
    runsDir: tmpDir(),
  });

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
  const { created, updated } = await executePlan({
    plan: plan2,
    client: makeClient({}),
    mutationClient: mutationClient2,
    idMapPath,
    idMap,
    stamp: "STAMP2",
    runsDir: tmpDir(),
  });
  assert.equal(created, 0);
  assert.equal(updated, 2);
  assert.equal(mutationClient2.calls.filter((c) => c.document.includes("issueCreate")).length, 0);
});

// --- mutations vs reads go through the right client ---

test("mutations go through mutationClient; the read client sees no traffic during apply", async () => {
  const idMapPath = tmpFile();
  const idMap = loadIdMap(idMapPath);
  const plan = basePlan({ issues: { create: [issueFixture("task-a")], update: [] } });
  const mutationClient = makeClient({
    issueCreate: () => ({ issueCreate: { success: true, issue: { id: "u1", identifier: "TOOL-1" } } }),
  });
  const client = makeClient({});
  await executePlan({ plan, client, mutationClient, idMapPath, idMap, stamp: "STAMP", runsDir: tmpDir() });
  assert.equal(client.calls.length, 0, "nothing this executor needs requires a fresh read — it all rode in on `plan`");
  assert.equal(mutationClient.calls.length, 1);
});

test("falling back to a single client when mutationClient is omitted still works (documented non-production path)", async () => {
  const idMapPath = tmpFile();
  const idMap = loadIdMap(idMapPath);
  const plan = basePlan({ issues: { create: [issueFixture("task-a")], update: [] } });
  const client = makeClient({
    issueCreate: () => ({ issueCreate: { success: true, issue: { id: "u1", identifier: "TOOL-1" } } }),
  });
  const { created } = await executePlan({ plan, client, idMapPath, idMap, stamp: "STAMP", runsDir: tmpDir() });
  assert.equal(created, 1);
  assert.equal(client.calls.length, 1);
});

// --- adopted project id is used, not re-derived ---

test("an adopted project's remote id is used for issues targeting it", async () => {
  const idMapPath = tmpFile();
  const idMap = loadIdMap(idMapPath);
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
  await executePlan({ plan, client: makeClient({}), mutationClient, idMapPath, idMap, stamp: "STAMP", runsDir: tmpDir() });
});

// --- existing label id is reused, never recreated ---

test("an existing label's id is reused rather than recreated", async () => {
  const idMapPath = tmpFile();
  const idMap = loadIdMap(idMapPath);
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
  await executePlan({ plan, client: makeClient({}), mutationClient, idMapPath, idMap, stamp: "STAMP", runsDir: tmpDir() });
});

// --- a genuinely new project/label is created and its id becomes usable within the same run ---

test("a newly created project's id is available to issues in the same run", async () => {
  const idMapPath = tmpFile();
  const idMap = loadIdMap(idMapPath);
  const plan = basePlan({
    projects: { create: [{ slug: "repo-contribution", name: "Stabilise", description: "d" }], adopt: [] },
    issues: { create: [issueFixture("task-a", { project: "repo-contribution" })], update: [] },
  });
  const mutationClient = makeClient({
    projectCreate: (vars) => {
      assert.deepEqual(vars.input.teamIds, ["team-1"]);
      assert.deepEqual(vars.input.initiativeIds, ["init-1"]);
      return { projectCreate: { success: true, project: { id: "new-p1", name: "Stabilise" } } };
    },
    issueCreate: (vars) => {
      assert.equal(vars.input.projectId, "new-p1");
      return { issueCreate: { success: true, issue: { id: "u1", identifier: "TOOL-1" } } };
    },
  });
  await executePlan({ plan, client: makeClient({}), mutationClient, idMapPath, idMap, stamp: "STAMP", runsDir: tmpDir() });
});

// --- success: false throws, naming the task id ---

test("a success: false issueCreate response throws, naming the task id", async () => {
  const idMapPath = tmpFile();
  const idMap = loadIdMap(idMapPath);
  const plan = basePlan({ issues: { create: [issueFixture("task-a")], update: [] } });
  const mutationClient = makeClient({ issueCreate: () => ({ issueCreate: { success: false, issue: null } }) });
  await assert.rejects(
    () =>
      executePlan({ plan, client: makeClient({}), mutationClient, idMapPath, idMap, stamp: "STAMP", runsDir: tmpDir() }),
    /task-a/
  );
});

test("a success: false issueUpdate response throws, naming the task id", async () => {
  const idMapPath = tmpFile();
  const idMap = loadIdMap(idMapPath);
  const plan = basePlan({
    issues: {
      create: [],
      update: [{ task_id: "task-a", issue_id: "u1", identifier: "TOOL-1", title: "A", description: "d", project: null, labels: [], estimate: 1 }],
    },
  });
  const mutationClient = makeClient({ issueUpdate: () => ({ issueUpdate: { success: false, issue: null } }) });
  await assert.rejects(
    () =>
      executePlan({ plan, client: makeClient({}), mutationClient, idMapPath, idMap, stamp: "STAMP", runsDir: tmpDir() }),
    /task-a/
  );
});

// --- updates never carry Linear-owned fields ---

test("updates never send assignee, cycle, or parent", async () => {
  const idMapPath = tmpFile();
  const idMap = loadIdMap(idMapPath);
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
  const { updated } = await executePlan({
    plan,
    client: makeClient({}),
    mutationClient,
    idMapPath,
    idMap,
    stamp: "STAMP",
    runsDir: tmpDir(),
  });
  assert.equal(updated, 1);
});

test("estimate: null is sent explicitly on update, not omitted — needed to clear a stale estimate", async () => {
  const idMapPath = tmpFile();
  const idMap = loadIdMap(idMapPath);
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
  await executePlan({ plan, client: makeClient({}), mutationClient, idMapPath, idMap, stamp: "STAMP", runsDir: tmpDir() });
});

// --- cycle resolution on create ---

test("an issue with an explicit cycle number gets that cycle's Linear id on create", async () => {
  const idMapPath = tmpFile();
  const idMap = loadIdMap(idMapPath);
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
  await executePlan({ plan, client: makeClient({}), mutationClient, idMapPath, idMap, stamp: "STAMP", runsDir: tmpDir() });
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
  const idMapPath = tmpFile();
  const idMap = loadIdMap(idMapPath);
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
  await executePlan({ plan, client: makeClient({}), mutationClient, idMapPath, idMap, stamp: "STAMP", runsDir: tmpDir() });
  assert.deepEqual(order, ["parent", "child"]);
  assert.equal(idMap.entries["task-parent"].issue_id, "PARENT-ID");
  assert.equal(idMap.entries["task-child"].issue_id, "CHILD-ID");
});

test("throws clearly when a task's parent cannot be resolved to any Linear issue id", async () => {
  const idMapPath = tmpFile();
  const idMap = loadIdMap(idMapPath);
  const plan = basePlan({ issues: { create: [issueFixture("task-a", { parent: "task-ghost" })], update: [] } });
  await assert.rejects(
    () =>
      executePlan({
        plan,
        client: makeClient({}),
        mutationClient: makeClient({ issueCreate: () => ({ issueCreate: { success: true, issue: { id: "u1", identifier: "T-1" } } }) }),
        idMapPath,
        idMap,
        stamp: "STAMP",
        runsDir: tmpDir(),
      }),
    /task-a.*parent.*task-ghost/s
  );
});

// --- fail fast on a stale/malformed plan ---

test("throws clearly (not obliquely) when plan.team.id is missing", async () => {
  const idMapPath = tmpFile();
  const idMap = loadIdMap(idMapPath);
  const plan = { projects: { create: [], adopt: [] }, labels: { create: [] }, labelIds: {}, issues: { create: [], update: [] } };
  await assert.rejects(
    () =>
      executePlan({
        plan,
        client: makeClient({}),
        mutationClient: makeClient({}),
        idMapPath,
        idMap,
        stamp: "STAMP",
        runsDir: tmpDir(),
      }),
    /plan\.team\.id is missing/
  );
});

// --- run log: every operation is logged, in order ---

test("logs every operation to the apply log, in the order they happened", async () => {
  const idMapPath = tmpFile();
  const idMap = loadIdMap(idMapPath);
  const runsDir = tmpDir();
  const plan = basePlan({
    projects: { create: [{ slug: "new-proj", name: "New", description: "d" }], adopt: [{ slug: "old-proj", name: "Old", id: "p-old" }] },
    labels: { create: ["fresh-label"] },
    labelIds: {},
    issues: { create: [issueFixture("task-a")], update: [] },
  });
  const mutationClient = makeClient({
    projectCreate: () => ({ projectCreate: { success: true, project: { id: "p-new", name: "New" } } }),
    issueLabelCreate: () => ({ issueLabelCreate: { success: true, issueLabel: { id: "l-new", name: "fresh-label" } } }),
    issueCreate: () => ({ issueCreate: { success: true, issue: { id: "u1", identifier: "TOOL-1" } } }),
  });
  await executePlan({ plan, client: makeClient({}), mutationClient, idMapPath, idMap, stamp: "STAMP", runsDir });
  const lines = fs
    .readFileSync(path.join(runsDir, "STAMP-apply.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  assert.deepEqual(
    lines.map((l) => l.op),
    ["project.create", "project.adopt", "label.create", "issue.create"]
  );
});
