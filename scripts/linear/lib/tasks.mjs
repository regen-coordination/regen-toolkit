// Task record validator for the Linear seeding pipeline. Pure, no I/O, never throws.
// Spec §6 asked for reuse of the framework's validateObject (packages/toolkit-framework/src/index.mjs);
// it only does required/enum/axis/array-type against its own ontology schemas — no regex, no cross-field —
// so it cannot express the id format or "cycle requires an estimate". Standalone, returns string[] to flatMap.
export const PROJECTS = ["repo-contribution", "knowledge-curation", "org-os-framework"];
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
