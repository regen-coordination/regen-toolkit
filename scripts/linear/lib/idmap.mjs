// The id-map: task id → Linear issue. This is the only state the seeding pipeline holds, and
// it is committed, so idempotency is exact rather than inferred. There is deliberately no
// fuzzy title matching anywhere in this pipeline — an entry here or nothing.
//
// Writes are INCREMENTAL by design. `recordIssue` persists after every single create, so an
// apply run interrupted halfway resumes without re-creating what already landed. That is the
// safety net for a transport layer that cannot distinguish a mutation from a query.
//
// A mapped issue that has disappeared from Linear is marked `orphaned`, never silently
// recreated and never deleted from the map — losing the old identifier would make the
// disappearance uninvestigable.
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

export function loadIdMap(filePath) {
  if (!fs.existsSync(filePath)) {
    return { schema_version: "1.0", team_key: null, entries: {} };
  }
  const doc = yaml.load(fs.readFileSync(filePath, "utf8"), { filename: filePath }) ?? {};
  return {
    schema_version: doc.schema_version ?? "1.0",
    team_key: doc.team_key ?? null,
    entries: doc.entries ?? {},
  };
}

function persist(filePath, map) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, yaml.dump(map, { lineWidth: 100, noRefs: true, sortKeys: true }), "utf8");
}

export function recordIssue(filePath, map, taskId, { issue_id, identifier }, now = new Date()) {
  const stamp = now.toISOString();
  map.entries[taskId] = {
    issue_id,
    identifier,
    created_at: map.entries[taskId]?.created_at ?? stamp,
    last_synced: stamp,
    state: "active",
  };
  persist(filePath, map);
  return map;
}

export function markOrphaned(filePath, map, taskId, now = new Date()) {
  const entry = map.entries[taskId];
  if (!entry) return map;
  entry.state = "orphaned";
  entry.last_synced = now.toISOString();
  persist(filePath, map);
  return map;
}
