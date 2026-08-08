import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseHeartbeat } from "../lib/heartbeat.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const md = fs.readFileSync(path.join(here, "fixtures", "HEARTBEAT.fixture.md"), "utf8");

test("parses every checkbox including superseded", () => {
  assert.equal(parseHeartbeat(md).length, 6);
});

test("captures the trailing task id", () => {
  const item = parseHeartbeat(md)[0];
  assert.equal(item.id, "task-260806-luiz-rather-org-access");
});

test("captures the owner hint", () => {
  const items = parseHeartbeat(md);
  assert.equal(items[0].ownerHint, "Luiz");
  assert.equal(items[1].ownerHint, "Regis (Durgadas)");
});

test("a phase prefix is captured as a hint, not treated as a person", () => {
  const phase = parseHeartbeat(md).find((i) => i.id === "task-260715-handoff-t1-intake");
  assert.equal(phase.ownerHint, "T1");
});

test("records the section heading", () => {
  assert.equal(parseHeartbeat(md)[0].section, "2026-08-06 engineering sync");
});

test("distinguishes open, done and superseded", () => {
  const items = parseHeartbeat(md);
  assert.equal(items[0].state, "open");
  assert.equal(items[2].state, "superseded");
  assert.equal(items[3].state, "done");
});

test("an item with no owner prefix yields a null hint", () => {
  const last = parseHeartbeat(md).at(-1);
  assert.equal(last.ownerHint, null);
  assert.equal(last.id, null);
});
