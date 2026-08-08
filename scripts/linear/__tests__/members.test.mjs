import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadMembers, resolveOwner } from "../lib/members.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, "fixtures", "members.fixture.yaml");

test("resolves a canonical id", () => {
  const members = loadMembers(fixture);
  assert.equal(resolveOwner(members, "luiz").id, "luiz");
});

test("resolves Regis and Durgadas to one record", () => {
  const members = loadMembers(fixture);
  assert.equal(resolveOwner(members, "Regis (Durgadas)").id, "durgadas");
  assert.equal(resolveOwner(members, "Durgadas").id, "durgadas");
  assert.equal(resolveOwner(members, "Regis").id, "durgadas");
});

test("returns null for an unknown owner", () => {
  const members = loadMembers(fixture);
  assert.equal(resolveOwner(members, "Nobody"), null);
});

test("a member without a linear_email still resolves", () => {
  const members = loadMembers(fixture);
  assert.equal(resolveOwner(members, "Afo").linear_email, null);
});

// --- edge cases beyond the plan's baseline four (see task self-review) ---

test("a member record missing an id never matches the literal string 'undefined'", () => {
  const members = [{ name: "No Id Here", aliases: [] }];
  assert.equal(resolveOwner(members, "undefined"), null);
});

test("loadMembers throws a clear error for a missing file, rather than degrading silently", () => {
  const missing = path.join(here, "fixtures", "does-not-exist.yaml");
  assert.throws(() => loadMembers(missing), /Member registry not found/);
});

test("loadMembers rejects a registry where two members claim the same alias", () => {
  // Written at runtime (not a tracked fixture) so this edge case doesn't need its own
  // committed file: two members both list "Luiz" as an alias/id, which would otherwise
  // let resolveOwner silently pick whichever record happens to come first.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "members-test-"));
  const dupe = path.join(dir, "duplicate.yaml");
  fs.writeFileSync(
    dupe,
    [
      'schema_version: "2.0"',
      "members:",
      "  - id: luiz",
      "    name: Luiz Fernando",
      "    aliases: [Luiz]",
      "    linear_email: null",
      "  - id: not-luiz",
      "    name: Someone Else",
      "    aliases: [Luiz]",
      "    linear_email: null",
      "",
    ].join("\n")
  );
  assert.throws(() => loadMembers(dupe), /duplicate alias/i);
});
