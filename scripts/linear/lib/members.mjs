// Member registry loader for the Linear seeding pipeline. Owner strings in HEARTBEAT.md
// are display names/aliases ("Regis (Durgadas)", "Rather"), not stable ids. This module
// resolves any of id / name / alias to one canonical member record, so the record and the
// Linear customer/member lists never fork (2026-08-06 engineering sync).
import fs from "node:fs";
import yaml from "js-yaml";

const norm = (s) => String(s).trim().toLowerCase();

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

  const doc = yaml.load(raw) ?? {};
  const members = doc.members ?? [];

  // Guard the thing this module exists to prevent: two members silently claiming the
  // same id/name/alias would make resolveOwner return whichever record happens to come
  // first, forking identity instead of merging it.
  const claimedBy = new Map(); // normalized key -> index into members
  members.forEach((m, i) => {
    const keys = [m.id, m.name, ...(m.aliases ?? [])].filter((k) => k != null);
    for (const label of keys) {
      const key = norm(label);
      const claimant = claimedBy.get(key);
      if (claimant !== undefined && claimant !== i) {
        const other = members[claimant];
        throw new Error(
          `Member registry has a duplicate alias "${label}" claimed by both ` +
            `"${other.id ?? other.name}" and "${m.id ?? m.name}"`
        );
      }
      claimedBy.set(key, i);
    }
  });

  return members;
}

export function resolveOwner(members, owner) {
  if (!owner) return null;
  const key = norm(owner);
  for (const m of members) {
    if (m.id != null && norm(m.id) === key) return m;
    if (m.name != null && norm(m.name) === key) return m;
    for (const alias of m.aliases ?? []) {
      if (alias != null && norm(alias) === key) return m;
    }
  }
  return null;
}
