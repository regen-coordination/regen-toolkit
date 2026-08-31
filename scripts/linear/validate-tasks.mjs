import { loadTasks, validateTaskRegistry } from "./lib/tasks.mjs";
import { loadMembers, resolveOwner } from "./lib/members.mjs";

const tasks = loadTasks("data/tasks.yaml");
const members = loadMembers("data/members.yaml");
const errors = validateTaskRegistry(tasks, members, resolveOwner);

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
