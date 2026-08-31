import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadIdMap, recordIssue, markOrphaned } from "../lib/idmap.mjs";
import { runStamp, writePlan, appendApply } from "../lib/runlog.mjs";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "linear-idmap-"));
}
function tmpFile() {
  return path.join(tmpDir(), "id-map.yaml");
}

test("returns an empty map when the file is absent", () => {
  const map = loadIdMap(tmpFile());
  assert.deepEqual(map.entries, {});
  assert.equal(map.team_key, null);
});

test("records an issue and persists it immediately", () => {
  const file = tmpFile();
  const map = loadIdMap(file);
  recordIssue(file, map, "task-260806-luiz-a", { issue_id: "uuid-1", identifier: "TOOL-1" });
  assert.equal(loadIdMap(file).entries["task-260806-luiz-a"].identifier, "TOOL-1");
});

test("a recorded entry is active by default", () => {
  const file = tmpFile();
  const map = loadIdMap(file);
  recordIssue(file, map, "task-260806-luiz-a", { issue_id: "uuid-1", identifier: "TOOL-1" });
  assert.equal(map.entries["task-260806-luiz-a"].state, "active");
});

test("persists after EVERY record, so an interrupted run resumes", () => {
  // This is the property the whole apply stage leans on — pin it explicitly.
  const file = tmpFile();
  const map = loadIdMap(file);
  recordIssue(file, map, "task-a", { issue_id: "u1", identifier: "TOOL-1" });
  const afterFirst = loadIdMap(file);
  assert.equal(Object.keys(afterFirst.entries).length, 1);
  recordIssue(file, map, "task-b", { issue_id: "u2", identifier: "TOOL-2" });
  assert.equal(Object.keys(loadIdMap(file).entries).length, 2);
});

test("re-recording preserves created_at but advances last_synced", () => {
  const file = tmpFile();
  const map = loadIdMap(file);
  recordIssue(file, map, "task-a", { issue_id: "u1", identifier: "TOOL-1" }, new Date("2026-08-01T00:00:00Z"));
  recordIssue(file, map, "task-a", { issue_id: "u1", identifier: "TOOL-1" }, new Date("2026-08-09T00:00:00Z"));
  const e = loadIdMap(file).entries["task-a"];
  assert.equal(e.created_at, "2026-08-01T00:00:00.000Z");
  assert.equal(e.last_synced, "2026-08-09T00:00:00.000Z");
});

test("marks an entry orphaned without deleting it or losing the identifier", () => {
  const file = tmpFile();
  const map = loadIdMap(file);
  recordIssue(file, map, "task-a", { issue_id: "u1", identifier: "TOOL-1" });
  markOrphaned(file, map, "task-a");
  const e = loadIdMap(file).entries["task-a"];
  assert.equal(e.state, "orphaned");
  assert.equal(e.issue_id, "u1");
  assert.equal(e.identifier, "TOOL-1");
});

test("marking an unknown task orphaned is a no-op, not an error", () => {
  const file = tmpFile();
  const map = loadIdMap(file);
  assert.deepEqual(markOrphaned(file, map, "task-missing").entries, {});
});

test("round-trips team_key", () => {
  const file = tmpFile();
  const map = loadIdMap(file);
  map.team_key = "TOOL";
  recordIssue(file, map, "task-a", { issue_id: "u1", identifier: "TOOL-1" });
  assert.equal(loadIdMap(file).team_key, "TOOL");
});

test("writePlan emits readable JSON at a stamped path", () => {
  const dir = tmpDir();
  const file = writePlan("STAMP", { issues: { create: [1, 2] } }, dir);
  assert.ok(file.endsWith("STAMP-plan.json"));
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), { issues: { create: [1, 2] } });
});

test("appendApply is append-only, one JSON object per line", () => {
  const dir = tmpDir();
  appendApply("STAMP", { op: "issue.create", task_id: "a" }, dir);
  appendApply("STAMP", { op: "issue.create", task_id: "b" }, dir);
  const lines = fs.readFileSync(path.join(dir, "STAMP-apply.jsonl"), "utf8").trim().split("\n");
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).task_id, "a");
  assert.equal(JSON.parse(lines[1]).task_id, "b");
  assert.ok(JSON.parse(lines[0]).at, "every line carries a timestamp");
});

test("runStamp is filesystem-safe", () => {
  const s = runStamp(new Date("2026-08-09T12:34:56.789Z"));
  assert.equal(s, "2026-08-09T12-34-56-789Z");
  assert.ok(!/[:.]/.test(s));
});
