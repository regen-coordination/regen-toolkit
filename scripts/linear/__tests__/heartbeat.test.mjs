import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseHeartbeat } from "../lib/heartbeat.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const md = fs.readFileSync(path.join(here, "fixtures", "HEARTBEAT.fixture.md"), "utf8");

// The fixture is a verbatim slice of the real HEARTBEAT.md (2026-08-06 engineering sync
// through Handoff Integration, frozen at commit 733c87b5) plus three synthetic lines for
// shapes the slice doesn't happen to contain. Tests look items up by id/raw rather than by
// array position so they don't depend on exactly how many items precede the one under test.
const byId = (items, id) => items.find((i) => i.id === id);

test("parses every real checkbox and skips the italic-only parked note", () => {
  // 49 checkbox lines in the fixture (46 verbatim + 3 synthetic); one synthetic line is a
  // pure "*(...)*" aside and must be dropped, not counted as an item.
  assert.equal(parseHeartbeat(md).length, 48);
});

test("captures the trailing task id", () => {
  const item = byId(parseHeartbeat(md), "task-260806-luiz-rather-org-access");
  assert.ok(item, "expected the item to be found by id");
  assert.equal(item.state, "open");
});

test("captures the owner hint", () => {
  const items = parseHeartbeat(md);
  assert.equal(byId(items, "task-260806-luiz-rather-org-access").ownerHint, "Luiz");
  assert.equal(byId(items, "task-260806-regis-standards-process-doc").ownerHint, "Regis (Durgadas)");
});

test("a phase prefix is captured as a hint, not treated as a person", () => {
  const phase = byId(parseHeartbeat(md), "task-260715-handoff-t1-intake");
  assert.equal(phase.ownerHint, "T1");
});

test("records the section heading, cleaned of its _(...)_ annotation", () => {
  const item = byId(parseHeartbeat(md), "task-260806-luiz-rather-org-access");
  assert.equal(item.section, "2026-08-06 engineering sync — process infrastructure landed");
});

test("distinguishes open, done and superseded", () => {
  const items = parseHeartbeat(md);
  assert.equal(byId(items, "task-260806-luiz-rather-org-access").state, "open");
  assert.equal(byId(items, "task-260715-handoff-t1-intake").state, "done");
  assert.equal(byId(items, "task-260716-luiz-github-projects").state, "superseded");
});

// --- mutation-killers: each of these pins a fact that only holds under this file's actual
// design, not under a "tidied" reading of the plan's literal given code. ---

test("an id followed by trailing content (✅, a parenthetical) is still captured — not anchored to end-of-line", () => {
  const items = parseHeartbeat(md);
  // Six live [x] items put "✅" (and sometimes a parenthetical) after the id backtick span.
  // An end-anchored `` `(task-...)`\s*$ `` silently returns null id on all of these.
  for (const id of [
    "task-260715-handoff-t1-intake",
    "task-260715-handoff-t2-crosswalk-dod",
    "task-260715-handoff-t3a-ingestion-slice",
    "task-260715-handoff-t5-agent-setup",
    "task-260715-handoff-t4-framework-evolution",
    "task-260715-handoff-t3b-full-ingestion",
  ]) {
    const item = byId(items, id);
    assert.ok(item, `expected to find ${id}`);
    assert.equal(item.id, id);
  }
  // Pin the exact text on one of them: markdown, not a title — bold survives, the removed id
  // leaves a bare trailing "— ✅" rather than being guessed away.
  const t1 = byId(items, "task-260715-handoff-t1-intake");
  assert.equal(
    t1.text,
    "**T1 — intake & orient** — changes map written; iteration registered. — ✅"
  );
  // And the one with a parenthetical survives past the emoji too.
  const t4 = byId(items, "task-260715-handoff-t4-framework-evolution");
  assert.match(t4.text, /— ✅ \(remainder logged in master plan\)$/);
});

test("a line naming three task ids resolves to the last one, and the earlier two stay in text", () => {
  const item = byId(parseHeartbeat(md), "task-260716-luiz-github-projects");
  assert.ok(item, "expected to find the superseded GitHub Projects item");
  assert.equal(item.id, "task-260716-luiz-github-projects");
  assert.equal(item.state, "superseded");
  assert.equal(item.ownerHint, "Luiz");
  // The two ids referenced mid-sentence (what superseded it) are not this item's identity,
  // but they're real content — the parser must not have deleted them along with its own id.
  assert.match(item.text, /task-260806-luiz-linear-seed-repo/);
  assert.match(item.text, /task-260806-afo-linear-seed/);
});

test("OWNER_RE's leading anchor: a mid-line bold decoy with no leading hint yields a null hint (and no id)", () => {
  const items = parseHeartbeat(md);
  const decoy = items.find((i) => i.raw.startsWith("Loop in **Rather"));
  assert.ok(decoy, "expected the synthetic decoy line");
  // Without the ^ anchor, OWNER_RE would match "Rather" out of the mid-line
  // "**Rather — the Cloudflare lead**" span. The anchor means it never gets the chance because
  // the line doesn't open with "**" at all.
  assert.equal(decoy.ownerHint, null);
  assert.equal(decoy.id, null);
});

test("an item with a leading bold span not shaped like an owner hint yields a null hint", () => {
  // "**Share pack** (`draft`) — ..." — the bold closes into "(" rather than " —", so it never
  // satisfies OWNER_RE even though it opens the line with "**".
  const item = byId(parseHeartbeat(md), "task-260715-handoff-share-pack");
  assert.ok(item);
  assert.equal(item.ownerHint, null);
});

test("a (due: ...) date is captured", () => {
  // Zero (due: occurrences in the live file today — pinned here with a synthetic line so the
  // regex stays exercised, not just present.
  const item = byId(parseHeartbeat(md), "task-990101-luiz-q3-infra-report");
  assert.ok(item);
  assert.equal(item.due, "2026-09-01");
});

test("an asterisk-italic parked note (the *(...)* form) is skipped, same as the _(...)_ form", () => {
  const items = parseHeartbeat(md);
  assert.equal(
    items.some((i) => i.raw.startsWith("*(Parked")),
    false
  );
});

test("raw preserves the untouched source line", () => {
  const item = byId(parseHeartbeat(md), "task-260806-luiz-rather-org-access");
  assert.equal(
    item.raw,
    "**Luiz — grant Rather GitHub org access** — ★ **unblocks the Cloudflare setup**, which is now the whole dev-review surface. — `task-260806-luiz-rather-org-access`"
  );
});

test("never throws on non-string input", () => {
  assert.deepEqual(parseHeartbeat(null), []);
  assert.deepEqual(parseHeartbeat(undefined), []);
  assert.deepEqual(parseHeartbeat(42), []);
});
