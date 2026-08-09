import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDrift } from "../lib/drift.mjs";

const manifest = { issues: [{ task_id: "a", title: "A" }, { task_id: "b", title: "B" }] };

test("reports tasks that were never seeded", () => {
  const drift = computeDrift({ manifest, idMap: { entries: {} }, remoteById: new Map() });
  assert.deepEqual(drift.unseeded, ["a", "b"]);
  assert.equal(drift.clean, false);
});

test("reports mapped issues missing from Linear as orphaned", () => {
  const idMap = { entries: { a: { issue_id: "u1", state: "active" } } };
  const drift = computeDrift({ manifest, idMap, remoteById: new Map() });
  assert.deepEqual(drift.orphaned, ["a"]);
  assert.deepEqual(drift.unseeded, ["b"]);
});

test("an entry already marked orphaned counts as unseeded, not orphaned again", () => {
  // It will be recreated by the next apply, so 'not yet seeded' is the honest description.
  const idMap = { entries: { a: { issue_id: "u1", state: "orphaned" } } };
  const drift = computeDrift({ manifest, idMap, remoteById: new Map() });
  assert.ok(drift.unseeded.includes("a"));
  assert.equal(drift.orphaned.length, 0);
});

test("reports a title mismatch", () => {
  const idMap = { entries: { a: { issue_id: "u1", state: "active" } } };
  const remoteById = new Map([["u1", { id: "u1", title: "Different" }]]);
  assert.deepEqual(computeDrift({ manifest, idMap, remoteById }).titleMismatch, ["a"]);
});

test("a title mismatch ALONE makes the report unclean", () => {
  // Without this, `clean` could ignore titleMismatch entirely and every test still passed.
  const oneIssue = { issues: [{ task_id: "a", title: "A" }] };
  const idMap = { entries: { a: { issue_id: "u1", state: "active" } } };
  const remoteById = new Map([["u1", { id: "u1", title: "Different" }]]);
  assert.equal(computeDrift({ manifest: oneIssue, idMap, remoteById }).clean, false);
});

test("a title match is not reported", () => {
  const idMap = { entries: { a: { issue_id: "u1", state: "active" } } };
  const remoteById = new Map([["u1", { id: "u1", title: "A" }]]);
  assert.deepEqual(computeDrift({ manifest, idMap, remoteById }).titleMismatch, []);
});

test("is clean when everything matches", () => {
  const idMap = {
    entries: { a: { issue_id: "u1", state: "active" }, b: { issue_id: "u2", state: "active" } },
  };
  const remoteById = new Map([
    ["u1", { id: "u1", title: "A" }],
    ["u2", { id: "u2", title: "B" }],
  ]);
  assert.equal(computeDrift({ manifest, idMap, remoteById }).clean, true);
});

test("an empty manifest is clean", () => {
  const drift = computeDrift({ manifest: { issues: [] }, idMap: { entries: {} }, remoteById: new Map() });
  assert.equal(drift.clean, true);
});

test("id-map entries with no manifest counterpart are ignored, not reported", () => {
  // A task removed from the registry is a registry decision, not drift for this tool to police.
  const idMap = {
    entries: {
      a: { issue_id: "u1", state: "active" },
      b: { issue_id: "u2", state: "active" },
      gone: { issue_id: "u9", state: "active" },
    },
  };
  const remoteById = new Map([
    ["u1", { id: "u1", title: "A" }],
    ["u2", { id: "u2", title: "B" }],
  ]);
  assert.equal(computeDrift({ manifest, idMap, remoteById }).clean, true);
});

test("the three drift kinds are reported separately, not merged", () => {
  const m = { issues: [{ task_id: "a", title: "A" }, { task_id: "b", title: "B" }, { task_id: "c", title: "C" }] };
  const idMap = {
    entries: { a: { issue_id: "u1", state: "active" }, b: { issue_id: "u2", state: "active" } },
  };
  const remoteById = new Map([["u1", { id: "u1", title: "CHANGED" }]]);
  const d = computeDrift({ manifest: m, idMap, remoteById });
  assert.deepEqual(d.titleMismatch, ["a"]);
  assert.deepEqual(d.orphaned, ["b"]);
  assert.deepEqual(d.unseeded, ["c"]);
});

// --- widened drift: description, estimate, labels are repo-owned too (spec §2.1) ---

test("reports a description mismatch", () => {
  const m = { issues: [{ task_id: "a", title: "A", description: "new body" }] };
  const idMap = { entries: { a: { issue_id: "u1", state: "active" } } };
  const remoteById = new Map([["u1", { id: "u1", title: "A", description: "old body" }]]);
  const d = computeDrift({ manifest: m, idMap, remoteById });
  assert.deepEqual(d.descriptionMismatch, ["a"]);
  assert.equal(d.clean, false);
});

test("reports an estimate mismatch", () => {
  const m = { issues: [{ task_id: "a", title: "A", estimate: 4 }] };
  const idMap = { entries: { a: { issue_id: "u1", state: "active" } } };
  const remoteById = new Map([["u1", { id: "u1", title: "A", estimate: 2 }]]);
  const d = computeDrift({ manifest: m, idMap, remoteById });
  assert.deepEqual(d.estimateMismatch, ["a"]);
  assert.equal(d.clean, false);
});

test("estimate: null in the manifest matches a remote null estimate — not reported as drift", () => {
  const m = { issues: [{ task_id: "a", title: "A", estimate: null }] };
  const idMap = { entries: { a: { issue_id: "u1", state: "active" } } };
  const remoteById = new Map([["u1", { id: "u1", title: "A", estimate: null }]]);
  const d = computeDrift({ manifest: m, idMap, remoteById });
  assert.deepEqual(d.estimateMismatch, []);
});

test("reports a labels mismatch when the sets genuinely differ", () => {
  const m = { issues: [{ task_id: "a", title: "A", labels: ["seed/repo", "layer/03"] }] };
  const idMap = { entries: { a: { issue_id: "u1", state: "active" } } };
  const remoteById = new Map([["u1", { id: "u1", title: "A", labels: ["seed/repo"] }]]);
  const d = computeDrift({ manifest: m, idMap, remoteById });
  assert.deepEqual(d.labelsMismatch, ["a"]);
  assert.equal(d.clean, false);
});

test("does NOT report a labels mismatch when the same labels appear in a different order", () => {
  const m = { issues: [{ task_id: "a", title: "A", labels: ["seed/repo", "layer/03", "needs-assignee"] }] };
  const idMap = { entries: { a: { issue_id: "u1", state: "active" } } };
  const remoteById = new Map([["u1", { id: "u1", title: "A", labels: ["needs-assignee", "seed/repo", "layer/03"] }]]);
  const d = computeDrift({ manifest: m, idMap, remoteById });
  assert.deepEqual(d.labelsMismatch, []);
  assert.equal(d.clean, true);
});

test("the six drift kinds are all reported separately when they co-occur", () => {
  const m = {
    issues: [
      { task_id: "a", title: "A", description: "new", estimate: 4, labels: ["x", "y"] },
    ],
  };
  const idMap = { entries: { a: { issue_id: "u1", state: "active" } } };
  const remoteById = new Map([
    ["u1", { id: "u1", title: "DIFFERENT", description: "old", estimate: 2, labels: ["x"] }],
  ]);
  const d = computeDrift({ manifest: m, idMap, remoteById });
  assert.deepEqual(d.titleMismatch, ["a"]);
  assert.deepEqual(d.descriptionMismatch, ["a"]);
  assert.deepEqual(d.estimateMismatch, ["a"]);
  assert.deepEqual(d.labelsMismatch, ["a"]);
  assert.equal(d.clean, false);
});
