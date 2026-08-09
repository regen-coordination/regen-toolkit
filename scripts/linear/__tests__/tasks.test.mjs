import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadTasks, validateTask, validateTaskRegistry } from "../lib/tasks.mjs";

// loadTasks fixtures are written to a scratch temp dir rather than committed files — this
// registry has no fixtures directory of its own yet, and Task 9 stages a fixed, minimal file
// list (data/tasks.yaml, lib/tasks.mjs, validate-tasks.mjs, this test file, package.json).
// Self-contained temp files keep the loadTasks tests real without growing that list.
function writeTemp(name, contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tasks-test-"));
  const file = path.join(dir, name);
  fs.writeFileSync(file, contents);
  return file;
}

const base = {
  id: "task-260806-luiz-linear-seed-repo",
  title: "Seed Linear from the regen-toolkit-os branch",
  owner: "luiz",
  project: "repo-contribution",
  layer: 10,
  estimate: 8,
  parent: null,
  cycle: 1,
  labels: [],
  blocked_by: [],
  source: { file: "HEARTBEAT.md", section: "2026-08-06 engineering sync", refs: [] },
};

test("accepts a well-formed task", () => {
  assert.deepEqual(validateTask(base), []);
});

test("rejects estimate 16 with a decomposition message", () => {
  const errors = validateTask({ ...base, estimate: 16 });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /estimate must be 1, 2, 4, or 8.*got 16.*sub-issues/i);
});

test("rejects a stringified estimate and names the offending value", () => {
  const errors = validateTask({ ...base, estimate: "8" });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /got "8"/);
});

test("rejects a malformed id", () => {
  const errors = validateTask({ ...base, id: "seed-linear" });
  assert.match(errors[0], /id must match task-YYMMDD-owner-slug/);
});

test("rejects an unknown project slug", () => {
  const errors = validateTask({ ...base, project: "misc" });
  assert.match(errors[0], /project must be one of/);
});

test("rejects a cycle on an unsized task", () => {
  const errors = validateTask({ ...base, estimate: null, cycle: 1 });
  assert.match(errors[0], /cycle .* requires an estimate/i);
});

test("allows an unsized task with no cycle", () => {
  assert.deepEqual(validateTask({ ...base, estimate: null, cycle: null }), []);
});

test("accepts a record that omits every optional key", () => {
  assert.deepEqual(validateTask({ id: base.id, title: base.title, owner: base.owner }), []);
});

test("rejects a missing title", () => {
  const { title, ...rest } = base;
  const errors = validateTask(rest);
  assert.match(errors[0], /title is required/);
});

test("rejects a missing owner", () => {
  const { owner, ...rest } = base;
  const errors = validateTask(rest);
  assert.match(errors[0], /owner is required/);
});

test("rejects layer 0", () => {
  const errors = validateTask({ ...base, layer: 0 });
  assert.match(errors[0], /layer must be 1-10 or null/);
});

test("rejects layer 11", () => {
  const errors = validateTask({ ...base, layer: 11 });
  assert.match(errors[0], /layer must be 1-10 or null/);
});

test("rejects a fractional layer", () => {
  const errors = validateTask({ ...base, layer: 2.5 });
  assert.match(errors[0], /layer must be 1-10 or null/);
});

test("does not throw on a null record", () => {
  assert.deepEqual(validateTask(null), ["not a task record: null"]);
});

// --- loadTasks: thin read-parse wrapper, mirrors loadMembers' idiom ---

test("loadTasks reads the tasks array from a well-formed file", () => {
  const file = writeTemp(
    "tasks.yaml",
    'schema_version: "1.0"\ntasks:\n  - id: task-260806-luiz-rather-org-access\n    title: Grant Rather GitHub org access\n    owner: luiz\n'
  );
  const tasks = loadTasks(file);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].id, "task-260806-luiz-rather-org-access");
});

test("loadTasks throws a clear error for a missing file, rather than degrading silently", () => {
  const missing = path.join(os.tmpdir(), "tasks-test-does-not-exist", "tasks.yaml");
  assert.throws(() => loadTasks(missing), /Task registry not found/);
});

test("loadTasks names the file in a YAML parse error", () => {
  const file = writeTemp("tasks-malformed.yaml", "schema_version: \"1.0\"\ntasks:\n  - id: a\n  bad indentation\n");
  assert.throws(() => loadTasks(file), (err) => {
    assert.match(err.message, /tasks-malformed\.yaml/);
    return true;
  });
});

test("loadTasks returns an empty array for a doc with no tasks key", () => {
  // yaml.load("") returns null/undefined depending on content; loadTasks must coalesce
  // both "empty doc" and "doc missing the tasks key" to [], matching loadMembers' `?? []`.
  const file = writeTemp("tasks-empty.yaml", 'schema_version: "1.0"\n');
  assert.deepEqual(loadTasks(file), []);
});

// --- validateTaskRegistry: full-registry checks beyond per-task shape (duplicate ids,
// parent/blocked_by referential integrity) — lifted here from validate-tasks.mjs so extract.mjs
// can run the same, full check instead of a weaker subset. Pure, never throws, mirrors
// validateTask's idiom. A minimal stub resolveOwner stands in for members.mjs's real one, since
// this module takes it as an injected dependency rather than importing members.mjs directly. ---

const resolveOwner = (members, owner) => members.find((m) => m.id === owner) ?? null;
const members = [{ id: "luiz" }, { id: "brandon" }];

function task(overrides = {}) {
  return {
    id: "task-260806-luiz-a",
    title: "A",
    owner: "luiz",
    parent: null,
    blocked_by: [],
    ...overrides,
  };
}

test("validateTaskRegistry accepts a well-formed registry", () => {
  assert.deepEqual(validateTaskRegistry([task()], members, resolveOwner), []);
});

test("validateTaskRegistry flags a duplicate id", () => {
  const tasks = [task({ id: "task-260806-luiz-a" }), task({ id: "task-260806-luiz-a", title: "B" })];
  const errors = validateTaskRegistry(tasks, members, resolveOwner);
  assert.ok(errors.some((e) => /task-260806-luiz-a: duplicate id/.test(e)));
});

test("validateTaskRegistry flags a dangling parent reference", () => {
  const tasks = [task({ id: "task-260806-luiz-a", parent: "task-260806-luiz-ghost" })];
  const errors = validateTaskRegistry(tasks, members, resolveOwner);
  assert.ok(errors.some((e) => /task-260806-luiz-a: parent "task-260806-luiz-ghost" not found/.test(e)));
});

test("validateTaskRegistry flags a dangling blocked_by reference", () => {
  const tasks = [task({ id: "task-260806-luiz-a", blocked_by: ["task-260806-luiz-ghost"] })];
  const errors = validateTaskRegistry(tasks, members, resolveOwner);
  assert.ok(errors.some((e) => /task-260806-luiz-a: blocked_by "task-260806-luiz-ghost" not found/.test(e)));
});

test("validateTaskRegistry does not flag a parent/blocked_by that resolves within the registry", () => {
  const tasks = [
    task({ id: "task-260806-luiz-a" }),
    task({ id: "task-260806-luiz-b", parent: "task-260806-luiz-a", blocked_by: ["task-260806-luiz-a"] }),
  ];
  assert.deepEqual(validateTaskRegistry(tasks, members, resolveOwner), []);
});

test("validateTaskRegistry flags an unresolvable owner, same message as the old inline check", () => {
  const tasks = [task({ owner: "nobody" })];
  const errors = validateTaskRegistry(tasks, members, resolveOwner);
  assert.ok(errors.some((e) => /owner "nobody" not in data\/members\.yaml/.test(e)));
});

test("validateTaskRegistry still runs per-task validateTask checks (e.g. malformed id)", () => {
  const tasks = [task({ id: "not-a-valid-id" })];
  const errors = validateTaskRegistry(tasks, members, resolveOwner);
  assert.ok(errors.some((e) => /id must match task-YYMMDD-owner-slug/.test(e)));
});
