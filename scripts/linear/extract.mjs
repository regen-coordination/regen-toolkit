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
import { loadTasks, validateTaskRegistry } from "./lib/tasks.mjs";
import { buildManifest } from "./lib/manifest.mjs";

const OUT = "data/linear/seed-manifest.yaml";

const heartbeat = parseHeartbeat(fs.readFileSync("HEARTBEAT.md", "utf8"));
const members = loadMembers("data/members.yaml");
const tasks = loadTasks("data/tasks.yaml");

// Full-registry validation (id format, duplicate ids, owner resolution, parent/blocked_by
// referential integrity) — the same check `npm run linear:validate` runs, so a registry that
// would fail validation can never still produce a manifest here. See lib/tasks.mjs's
// validateTaskRegistry comment for why this used to be a weaker, separately-maintained check.
const errors = validateTaskRegistry(tasks, members, resolveOwner);

if (errors.length) {
  console.error(`extract aborted — ${errors.length} invalid task record(s):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

const manifest = buildManifest({ tasks, members, heartbeat });
// Deliberately NOT stamped with a generated_at. The manifest is meant to be reviewed as a
// diff, and a timestamp would make it dirty on every extract even when nothing changed —
// burying real changes in noise. Git already records when it changed; data/linear/runs/
// timestamps the runs themselves.

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, yaml.dump(manifest, { lineWidth: 100, noRefs: true }), "utf8");

const unassigned = manifest.issues.filter((i) => !i.assignee_email).length;
const scheduled = manifest.issues.filter((i) => i.cycle != null).length;
const children = manifest.issues.filter((i) => i.parent).length;

console.log(`wrote ${OUT}`);
console.log(`  ${manifest.issues.length} issues · ${manifest.labels.length} labels · ${manifest.projects.length} projects`);
console.log(`  ${unassigned} unassigned (needs-assignee) · ${scheduled} in a cycle · ${children} sub-issues`);
