// Member registry loader + validator for the Linear seeding pipeline. Owner strings in
// HEARTBEAT.md are display names/aliases ("Regis (Durgadas)", "Rather"), not stable ids.
// This module resolves any of id / name / alias to one canonical member record, so the
// record and the Linear customer/member lists never fork (2026-08-06 engineering sync).
//
// Mirrors the tasks.mjs idiom: validateMembers(members) is pure, never throws, and returns
// string[]. loadMembers is the thin read-parse-validate wrapper that throws once with every
// message joined — so whoever hand-authors data/members.yaml gets one full error report
// instead of a whack-a-mole loop of single failures.
import fs from "node:fs";
import yaml from "js-yaml";

// Zero-width space (U+200B), zero-width non-joiner (U+200C), zero-width joiner (U+200D),
// byte-order mark / zero-width no-break space (U+FEFF). Written as \u escapes deliberately —
// these code points are invisible if pasted as literal characters into a source file.
const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/g;

// normalize("NFC") + collapse-\s + trim + lowercase is the baseline recipe. On top of that
// we strip zero-width/format chars (ZERO_WIDTH_RE above): verified empirically that \s does
// NOT match U+200B, so a name pasted from Docs/Notion with an invisible zero-width space
// would otherwise silently fail to resolve — exactly the kind of silent identity-fork this
// module exists to prevent.
const norm = (s) =>
  String(s)
    .normalize("NFC")
    .replace(ZERO_WIDTH_RE, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

// Single source of truth for "what counts as a lookup key for this member". Used by both
// validateMembers (duplicate detection) and resolveOwner (matching), so they can't drift
// out of agreement about what a key is. Guards against the bare-string `aliases: Luiz`
// authoring mistake, which would otherwise spread into per-character aliases ("L", "u", …).
function memberKeys(m) {
  if (m == null || typeof m !== "object") return [];
  const keys = [];
  if (typeof m.id === "string" && m.id.trim() !== "") keys.push({ value: m.id, field: "id" });
  if (typeof m.name === "string" && m.name.trim() !== "") keys.push({ value: m.name, field: "name" });
  if (Array.isArray(m.aliases)) {
    for (const a of m.aliases) {
      if (typeof a === "string") keys.push({ value: a, field: "alias" });
    }
  }
  return keys;
}

export function validateMembers(members) {
  const errors = [];

  if (!Array.isArray(members)) {
    errors.push(`members must be an array, got ${typeof members}`);
    return errors;
  }

  members.forEach((m, i) => {
    const where = `members[${i}]`;
    if (m == null || typeof m !== "object" || Array.isArray(m)) {
      errors.push(`${where} must be an object, got ${JSON.stringify(m)}`);
      return;
    }
    if (typeof m.id !== "string" || m.id.trim() === "") {
      errors.push(`${where} is missing a non-empty id`);
    }
    if (m.aliases != null && !Array.isArray(m.aliases)) {
      errors.push(`${where}.aliases must be an array of strings, got ${JSON.stringify(m.aliases)}`);
    } else if (Array.isArray(m.aliases)) {
      m.aliases.forEach((a, j) => {
        if (typeof a !== "string") {
          errors.push(`${where}.aliases[${j}] must be a string, got ${JSON.stringify(a)}`);
        }
      });
    }
  });

  // Duplicate detection: two members claiming the same normalized id/name/alias would make
  // resolveOwner return whichever record happens to come first, forking identity instead of
  // merging it — the exact failure this module exists to prevent.
  const claimedBy = new Map(); // normalized key -> { index, field }
  members.forEach((m, i) => {
    if (m == null || typeof m !== "object" || Array.isArray(m)) return;
    for (const { value, field } of memberKeys(m)) {
      const key = norm(value);
      const claimant = claimedBy.get(key);
      if (claimant && claimant.index !== i) {
        const other = members[claimant.index];
        errors.push(
          `"${value}" is claimed by members[${claimant.index}] (id: ${other.id ?? "?"}, as ${claimant.field}) ` +
            `and members[${i}] (id: ${m.id ?? "?"}, as ${field})`
        );
      } else if (!claimant) {
        claimedBy.set(key, { index: i, field });
      }
    }
  });

  return errors;
}

export function loadMembers(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(`Member registry not found: ${filePath}`);
    }
    throw err;
  }

  const doc = yaml.load(raw, { filename: filePath }) ?? {};
  const members = doc.members ?? [];

  const errors = validateMembers(members);
  if (errors.length > 0) {
    throw new Error(
      `${filePath}: ${errors.length} error(s) in member registry:\n` +
        errors.map((e) => `  - ${e}`).join("\n")
    );
  }

  return members;
}

export function resolveOwner(members, owner) {
  if (!owner) return null;
  const key = norm(owner);
  for (const m of members ?? []) {
    for (const { value } of memberKeys(m)) {
      if (norm(value) === key) return m;
    }
  }
  return null;
}
