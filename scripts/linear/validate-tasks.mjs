import { loadTasks, validateTask } from "./lib/tasks.mjs";
import { loadMembers, resolveOwner } from "./lib/members.mjs";

const tasks = loadTasks("data/tasks.yaml");
const members = loadMembers("data/members.yaml");
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

const unsizedInCycle = tasks.filter((t) => t.cycle != null && t.estimate == null);
if (unsizedInCycle.length) {
  console.error(`\n${unsizedInCycle.length} task(s) scheduled into a cycle without an estimate:`);
  for (const t of unsizedInCycle) console.error(`  ${t.id} — ${t.title}`);
}

if (errors.length) {
  console.error(`\n${errors.length} validation error(s):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

console.log(`data/tasks.yaml OK — ${tasks.length} tasks`);
