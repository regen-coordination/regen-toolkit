// Task record schema + validator for the Linear seeding pipeline.
//
// Reuse check (see docs/plans — Task 1, Step 0): packages/toolkit-framework's
// `validateObject(schemaName, obj)` (src/index.mjs) validates plain objects against
// its own YAML-defined ontology schemas (required/enum/axis/array-type only) and
// returns { valid, errors }, not string[]. It has no regex/format validation and no
// cross-field rules, so it can't express "id must match task-YYMMDD-owner-slug",
// the custom estimate/decomposition message, or "cycle requires an estimate" without
// bolting a second mechanism onto it. This validator is written standalone instead,
// deliberately matching the framework's idiom: plain function, returns string[], no
// exceptions, no new dependency.
export const PROJECTS = ["repo-contribution", "knowledge-curation", "org-os-framework"];
export const ESTIMATES = [1, 2, 4, 8];
const ID_RE = /^task-\d{6}-[a-z0-9]+-[a-z0-9-]+$/;

export function validateTask(task) {
  const errors = [];
  if (!ID_RE.test(task.id ?? "")) {
    errors.push(`id must match task-YYMMDD-owner-slug, got "${task.id}"`);
  }
  if (!task.title || typeof task.title !== "string") {
    errors.push(`${task.id}: title is required`);
  }
  if (!task.owner || typeof task.owner !== "string") {
    errors.push(`${task.id}: owner is required`);
  }
  if (task.project != null && !PROJECTS.includes(task.project)) {
    errors.push(`${task.id}: project must be one of ${PROJECTS.join(", ")} or null`);
  }
  if (task.layer != null && !(Number.isInteger(task.layer) && task.layer >= 1 && task.layer <= 10)) {
    errors.push(`${task.id}: layer must be 1-10 or null`);
  }
  if (task.estimate != null && !ESTIMATES.includes(task.estimate)) {
    errors.push(
      `${task.id}: estimate must be 1, 2, 4, 8 or null — 16 is not representable, ` +
        `decompose into sub-issues using "parent"`
    );
  }
  if (task.cycle != null && task.estimate == null) {
    errors.push(`${task.id}: cycle ${task.cycle} requires an estimate`);
  }
  return errors;
}
