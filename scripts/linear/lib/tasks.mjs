// Task record validator for the Linear seeding pipeline. Pure, no I/O, never throws.
// Spec §6 asked for reuse of the framework's validateObject (packages/toolkit-framework/src/index.mjs);
// it only does required/enum/axis/array-type against its own ontology schemas — no regex, no cross-field —
// so it cannot express the id format or "cycle requires an estimate". Standalone, returns string[] to flatMap.
import fs from "node:fs";
import yaml from "js-yaml";
import { PROJECT_DEFS } from "./manifest.mjs";

// Derived from PROJECT_DEFS (manifest.mjs), the source of truth for what the three project
// slugs actually are — this file used to hardcode its own copy, independently of manifest.mjs's
// PROJECT_DEFS, with nothing keeping the two lists in agreement if a lane were ever renamed or
// added. Import direction checked: manifest.mjs imports only labels.mjs and members.mjs, neither
// of which imports tasks.mjs, so tasks.mjs -> manifest.mjs introduces no cycle.
export const PROJECTS = PROJECT_DEFS.map((p) => p.slug);
export const ESTIMATES = [1, 2, 4, 8];
const ID_RE = /^task-\d{6}-[a-z0-9]+-[a-z0-9-]+$/;

export function validateTask(task) {
  if (task == null || typeof task !== "object") {
    return [`not a task record: ${JSON.stringify(task)}`];
  }

  const errors = [];
  const where = task.id ?? "<no id>";

  if (!ID_RE.test(task.id ?? "")) {
    errors.push(`id must match task-YYMMDD-owner-slug, got "${task.id}"`);
  }
  if (!task.title || typeof task.title !== "string") {
    errors.push(`${where}: title is required`);
  }
  if (!task.owner || typeof task.owner !== "string") {
    errors.push(`${where}: owner is required`);
  }
  if (task.project != null && !PROJECTS.includes(task.project)) {
    errors.push(`${where}: project must be one of ${PROJECTS.join(", ")} or null`);
  }
  if (task.layer != null && !(Number.isInteger(task.layer) && task.layer >= 1 && task.layer <= 10)) {
    errors.push(`${where}: layer must be 1-10 or null`);
  }
  if (task.estimate != null && !ESTIMATES.includes(task.estimate)) {
    errors.push(
      `${where}: estimate must be 1, 2, 4, or 8 (or null) — got ${JSON.stringify(task.estimate)}. ` +
        `16 is not representable: decompose into sub-issues using "parent".`
    );
  }
  if (task.cycle != null && task.estimate == null) {
    errors.push(`${where}: cycle ${task.cycle} requires an estimate`);
  }
  return errors;
}

// Full-registry validation: per-task shape (validateTask) plus the two checks that only make
// sense across the whole set — duplicate ids, and parent/blocked_by references that point
// nowhere. Pure, no I/O, never throws, same idiom as validateTask. `resolveOwner` is taken as a
// parameter rather than imported from members.mjs so this module stays a leaf with respect to
// the rest of the directory — the caller (validate-tasks.mjs, extract.mjs) already has both
// `members` and `resolveOwner` in hand from loading the member registry.
//
// This used to be duplicated: validate-tasks.mjs ran the full version below; extract.mjs
// separately re-implemented a weaker subset (validateTask + owner resolution only, no duplicate-
// id or referential-integrity check). That let a registry with a duplicate id or a dangling
// parent fail `linear:validate` yet still produce a manifest via `linear:extract` — which
// manifest.mjs's own header explicitly assumes can't happen (buildManifest deliberately doesn't
// re-check any of this, on the assumption the registry was already validated). One function,
// called by both CLIs, closes that gap.
export function validateTaskRegistry(tasks, members, resolveOwner) {
  const ids = new Set();
  const errors = [];

  for (const task of tasks) {
    errors.push(...validateTask(task));
    if (ids.has(task.id)) errors.push(`${task.id}: duplicate id`);
    ids.add(task.id);
    if (!resolveOwner(members, task.owner)) {
      errors.push(`${task.id}: owner "${task.owner}" not in data/members.yaml`);
    }
  }

  for (const task of tasks) {
    if (task.parent && !ids.has(task.parent)) errors.push(`${task.id}: parent "${task.parent}" not found`);
    for (const dep of task.blocked_by ?? []) {
      if (!ids.has(dep)) errors.push(`${task.id}: blocked_by "${dep}" not found`);
    }
  }

  return errors;
}

// Thin read-parse wrapper, mirroring loadMembers' idiom: throws once with a clear message
// rather than degrading silently. validateTask itself stays pure and I/O-free — callers run
// it over whatever loadTasks returns.
export function loadTasks(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") throw new Error(`Task registry not found: ${filePath}`);
    throw err;
  }
  const doc = yaml.load(raw, { filename: filePath }) ?? {};
  return doc.tasks ?? [];
}
