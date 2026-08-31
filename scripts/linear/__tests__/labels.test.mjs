import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveLabels } from "../lib/labels.mjs";

const task = {
  id: "task-260806-luiz-a",
  layer: 10,
  project: "repo-contribution",
  labels: ["origin/meeting-260806", "gate/promotion"],
};

test("always applies seed/repo", () => {
  // This is what keeps this seed distinguishable from Afo's parallel one.
  assert.ok(deriveLabels(task, { assigneeResolved: true }).includes("seed/repo"));
});

test("derives the layer label zero-padded", () => {
  assert.ok(deriveLabels(task, { assigneeResolved: true }).includes("layer/10"));
  assert.ok(deriveLabels({ ...task, layer: 3 }, { assigneeResolved: true }).includes("layer/03"));
});

test("passes explicit labels through", () => {
  const labels = deriveLabels(task, { assigneeResolved: true });
  assert.ok(labels.includes("origin/meeting-260806"));
  assert.ok(labels.includes("gate/promotion"));
});

test("carries a needs-triage label through from the record", () => {
  const labels = deriveLabels({ ...task, labels: ["needs-triage"] }, { assigneeResolved: true });
  assert.ok(labels.includes("needs-triage"));
});

test("adds needs-assignee when the assignee did not resolve", () => {
  assert.ok(deriveLabels(task, { assigneeResolved: false }).includes("needs-assignee"));
});

test("omits needs-assignee when the assignee did resolve", () => {
  assert.ok(!deriveLabels(task, { assigneeResolved: true }).includes("needs-assignee"));
});

test("adds strategic when there is no project", () => {
  const labels = deriveLabels({ ...task, project: null }, { assigneeResolved: true });
  assert.ok(labels.includes("strategic"));
});

test("omits strategic when a project is set", () => {
  assert.ok(!deriveLabels(task, { assigneeResolved: true }).includes("strategic"));
});

test("omits the layer label when layer is null", () => {
  const labels = deriveLabels({ ...task, layer: null }, { assigneeResolved: true });
  assert.ok(!labels.some((l) => l.startsWith("layer/")));
});

test("treats an omitted layer the same as null", () => {
  const { layer, ...noLayer } = task;
  assert.ok(!deriveLabels(noLayer, { assigneeResolved: true }).some((l) => l.startsWith("layer/")));
});

test("tolerates a record with no labels array", () => {
  const { labels, ...noLabels } = task;
  assert.ok(deriveLabels(noLabels, { assigneeResolved: true }).includes("seed/repo"));
});

test("returns a sorted deduplicated list", () => {
  const labels = deriveLabels({ ...task, labels: ["seed/repo", "seed/repo"] }, { assigneeResolved: true });
  assert.deepEqual(labels, [...new Set(labels)].sort());
  assert.equal(labels.filter((l) => l === "seed/repo").length, 1);
});
