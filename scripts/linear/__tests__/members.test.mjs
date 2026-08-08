import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadMembers, resolveOwner, validateMembers } from "../lib/members.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, "fixtures", "members.fixture.yaml");
const duplicateFixture = path.join(here, "fixtures", "members-duplicate.fixture.yaml");

// Built via fromCharCode rather than \u escapes in string literals, so the intent is
// unambiguous on read and there's no risk of an editor/tool silently materializing an
// actual invisible character into this source file.
const NBSP = String.fromCharCode(0x00a0);
const ZWSP = String.fromCharCode(0x200b);

// --- baseline behaviour (unchanged from the original plan) ---

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
  // Assert on id + falsiness rather than `=== null`: a member who *omits* linear_email
  // entirely (yielding undefined) has the same intact behaviour as one that sets it to
  // null explicitly, and the test shouldn't depend on which spelling the fixture uses.
  const members = loadMembers(fixture);
  const member = resolveOwner(members, "Afo");
  assert.equal(member.id, "afo");
  assert.ok(!member.linear_email);
});

test("a member record missing an id never matches the literal string 'undefined'", () => {
  const members = [{ name: "No Id Here", aliases: [] }];
  assert.equal(resolveOwner(members, "undefined"), null);
});

test("loadMembers throws a clear error for a missing file, rather than degrading silently", () => {
  const missing = path.join(here, "fixtures", "does-not-exist.yaml");
  assert.throws(() => loadMembers(missing), /Member registry not found/);
});

test("loadMembers rejects a registry where two members claim the same alias, naming both records", () => {
  assert.throws(() => loadMembers(duplicateFixture), (err) => {
    assert.match(err.message, /members-duplicate\.fixture\.yaml/);
    assert.match(err.message, /"Luiz" is claimed by members\[0\]/);
    assert.match(err.message, /\(id: luiz-fernando, as alias\)/);
    assert.match(err.message, /members\[1\]/);
    assert.match(err.message, /\(id: guest-luiz, as alias\)/);
    return true;
  });
});

// --- validateMembers: pure, never throws, mirrors the validateTask(task) idiom in tasks.mjs ---

test("validateMembers accepts a well-formed member list", () => {
  const members = [{ id: "luiz", name: "Luiz Fernando", aliases: ["Luiz"], linear_email: null }];
  assert.deepEqual(validateMembers(members), []);
});

test("validateMembers rejects a registry where members isn't a list", () => {
  const errors = validateMembers({ luiz: { name: "Luiz Fernando" } });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /members must be an array/);
});

test("validateMembers rejects a null entry (a stray '-' in the YAML list)", () => {
  const errors = validateMembers([null]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /members\[0\] must be an object/);
});

test("validateMembers rejects a member with no id, rather than accepting it silently", () => {
  const errors = validateMembers([{ name: "No Id" }]);
  assert.match(errors[0], /members\[0\] is missing a non-empty id/);
});

test("validateMembers rejects a bare-string aliases field instead of an array", () => {
  const errors = validateMembers([{ id: "luiz", aliases: "Luiz" }]);
  assert.match(errors[0], /members\[0\]\.aliases must be an array of strings/);
});

test("validateMembers rejects a non-string entry inside aliases", () => {
  const errors = validateMembers([{ id: "luiz", aliases: ["Luiz", 42] }]);
  assert.match(errors[0], /members\[0\]\.aliases\[1\] must be a string/);
});

test("validateMembers reports a duplicate alias by index, field, and both ids", () => {
  // ids deliberately don't equal the colliding alias text, isolating this as a pure
  // alias-vs-alias collision (a member's own id equalling its own alias is fine and
  // does not error — see the next test).
  const members = [
    { id: "luiz-fernando", aliases: ["Luiz"] },
    { id: "guest-luiz", aliases: ["Luiz"] },
  ];
  const errors = validateMembers(members);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /"Luiz" is claimed by members\[0\] \(id: luiz-fernando, as alias\)/);
  assert.match(errors[0], /members\[1\] \(id: guest-luiz, as alias\)/);
});

test("validateMembers does not flag a member whose own id equals its own alias", () => {
  // id "luiz" and alias "Luiz" normalize to the same key, but they identify the SAME
  // record — that's a self-reference, not a fork, and must not error.
  const errors = validateMembers([{ id: "luiz", name: "Luiz Fernando", aliases: ["Luiz"] }]);
  assert.deepEqual(errors, []);
});

// --- resolveOwner: bare-string aliases must never explode into per-character matches ---

test("resolveOwner never treats a bare-string aliases field as a source of matches", () => {
  // aliases: "Luiz" (forgot the brackets) is invalid shape — memberKeys ignores it outright
  // rather than spreading it into ["L", "u", "i", "z"], which would silently resolve
  // single-letter owner strings to this member.
  const members = [{ name: "Someone Else", aliases: "Luiz" }];
  assert.equal(resolveOwner(members, "L"), null);
  assert.equal(resolveOwner(members, "u"), null);
  assert.equal(resolveOwner(members, "Luiz"), null);
});

// --- normalization: previously untested, so nothing pinned trim/case-fold behaviour ---

test("resolveOwner is case-insensitive", () => {
  const members = loadMembers(fixture);
  assert.equal(resolveOwner(members, "LUIZ").id, "luiz");
});

test("resolveOwner trims surrounding whitespace", () => {
  const members = loadMembers(fixture);
  assert.equal(resolveOwner(members, "  Regis  ").id, "durgadas");
});

test("resolveOwner returns null for an empty-string owner", () => {
  const members = loadMembers(fixture);
  assert.equal(resolveOwner(members, ""), null);
});

test("resolveOwner returns null for a null owner", () => {
  const members = loadMembers(fixture);
  assert.equal(resolveOwner(members, null), null);
});

test("resolveOwner collapses interior double spaces", () => {
  const members = loadMembers(fixture);
  assert.equal(resolveOwner(members, "Regis  (Durgadas)").id, "durgadas");
});

test("resolveOwner treats a non-breaking space like a regular space", () => {
  const members = loadMembers(fixture);
  assert.equal(resolveOwner(members, `Regis${NBSP}(Durgadas)`).id, "durgadas");
});

test("resolveOwner strips an invisible zero-width space", () => {
  const members = loadMembers(fixture);
  assert.equal(resolveOwner(members, `${ZWSP}Durgadas${ZWSP}`).id, "durgadas");
});

// --- named non-person owner tokens from the live HEARTBEAT.md must resolve to null, not error ---

test("non-person owner tokens (T1, Infra, Group, Joint, ...) resolve to null, not an error", () => {
  const members = loadMembers(fixture);
  for (const token of ["T1", "T2", "T3a", "T4 core", "SP11", "Infra", "Group", "Joint"]) {
    assert.equal(resolveOwner(members, token), null);
  }
});
