import { test } from "node:test";
import assert from "node:assert/strict";
import { auditCoverage } from "../lib/triage.mjs";

// Stand-in for resolveOwner bound to data/members.yaml: only "Luiz" is a person here.
const isPerson = (hint) => hint === "Luiz";

const items = [
  { id: "task-260806-luiz-a", ownerHint: "Luiz", state: "open", section: "Sync", text: "A" },
  { id: null, ownerHint: "Luiz", state: "open", section: "Sync", text: "B" },
  { id: null, ownerHint: null, state: "superseded", section: "Old", text: "C" },
  { id: null, ownerHint: null, state: "done", section: "Old", text: "D" },
];

test("flags open items with no id", () => {
  const report = auditCoverage(items, isPerson);
  assert.equal(report.missingId.length, 1);
  assert.equal(report.missingId[0].text, "B");
});

test("ignores done and superseded items", () => {
  assert.equal(auditCoverage(items, isPerson).missingId.length, 1);
});

test("flags open items with no owner", () => {
  const report = auditCoverage(
    [{ id: "task-260806-x-y", ownerHint: null, state: "open", section: "S", text: "E" }],
    isPerson
  );
  assert.equal(report.missingOwner.length, 1);
});

test("flags a phase prefix as a missing owner rather than accepting it", () => {
  // The whole reason isPerson is injected: a non-null ownerHint is not an owner.
  const report = auditCoverage(
    [{ id: "task-260715-handoff-t1-intake", ownerHint: "T1", state: "open", section: "S", text: "F" }],
    isPerson
  );
  assert.equal(report.missingOwner.length, 1);
});

test("is clean when every open item has an id and a real owner", () => {
  assert.equal(auditCoverage([items[0]], isPerson).clean, true);
});

test("is not clean when an open item lacks an id", () => {
  assert.equal(auditCoverage(items, isPerson).clean, false);
});

test("groups counts by section", () => {
  const report = auditCoverage(items, isPerson);
  assert.equal(report.bySection["Sync"].open, 2);
  assert.equal(report.bySection["Old"].done, 1);
  assert.equal(report.bySection["Old"].superseded, 1);
});

test("reports totals over every state, not just open", () => {
  const report = auditCoverage(items, isPerson);
  assert.equal(report.total, 4);
  assert.equal(report.open, 2);
});

test("an empty list is clean", () => {
  const report = auditCoverage([], isPerson);
  assert.equal(report.clean, true);
  assert.equal(report.total, 0);
});
