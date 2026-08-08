// Compile the seed manifest. No network — this stage never talks to Linear.
//
// The manifest is the reviewable artifact at the centre of the seeding design: markdown never
// goes straight to Linear, it compiles here first so the whole seed can be read as an ordinary
// diff before anything is created.
//
// Spec §7: an unresolvable OWNER fails extraction. An owner with no Linear account does NOT —
// that degrades to a needs-assignee label inside buildManifest, and the owner of record is
// named in the issue footer so ownership is never lost.
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { parseHeartbeat } from "./lib/heartbeat.mjs";
import { loadMembers, resolveOwner } from "./lib/members.mjs";
import { loadTasks, validateTask } from "./lib/tasks.mjs";
import { buildManifest } from "./lib/manifest.mjs";

const OUT = "data/linear/seed-manifest.yaml";

const heartbeat = parseHeartbeat(fs.readFileSync("HEARTBEAT.md", "utf8"));
const members = loadMembers("data/members.yaml");
const tasks = loadTasks("data/tasks.yaml");

const errors = tasks.flatMap((task) => validateTask(task));
for (const task of tasks) {
  if (!resolveOwner(members, task.owner)) {
    errors.push(`${task.id}: owner "${task.owner}" not in data/members.yaml`);
  }
}

if (errors.length) {
  console.error(`extract aborted — ${errors.length} invalid task record(s):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

const manifest = buildManifest({ tasks, members, heartbeat });
manifest.generated_at = new Date().toISOString();

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, yaml.dump(manifest, { lineWidth: 100, noRefs: true }), "utf8");

const unassigned = manifest.issues.filter((i) => !i.assignee_email).length;
const scheduled = manifest.issues.filter((i) => i.cycle != null).length;
const children = manifest.issues.filter((i) => i.parent).length;

console.log(`wrote ${OUT}`);
console.log(`  ${manifest.issues.length} issues · ${manifest.labels.length} labels · ${manifest.projects.length} projects`);
console.log(`  ${unassigned} unassigned (needs-assignee) · ${scheduled} in a cycle · ${children} sub-issues`);
