// Read-only drift report. Safe for ANY agent to run at ANY time — it makes no mutation and has
// no --confirm gate because it needs none. This is the command to reach for when you want to
// know whether the repo and Linear still agree; `apply` is the only thing that changes either.
//
// Exits 0 when in sync, 1 when drift is detected, so it can gate a workflow.
import fs from "node:fs";
import yaml from "js-yaml";
import "dotenv/config";
import { LinearClient } from "./lib/client.mjs";
import { loadIdMap } from "./lib/idmap.mjs";
import { computeDrift } from "./lib/drift.mjs";

const MANIFEST = "data/linear/seed-manifest.yaml";
const ID_MAP = "data/linear/id-map.yaml";

if (!process.env.LINEAR_API_KEY) {
  console.error(
    "LINEAR_API_KEY is not set. Copy .env.example to .env and add your Linear personal API key, " +
      "or export it in your shell before running this command."
  );
  process.exit(1);
}

if (!fs.existsSync(MANIFEST)) {
  console.error(`${MANIFEST} not found — run \`npm run linear:extract\` first.`);
  process.exit(1);
}

const manifest = yaml.load(fs.readFileSync(MANIFEST, "utf8"));
const idMap = loadIdMap(ID_MAP);
const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

const active = Object.values(idMap.entries).filter((e) => e.state === "active");
const remoteById = new Map();

// One query per mapped issue. At 172 issues that is well inside Linear's ~1500/hour budget, and
// keeping it simple beats batching we would have to maintain. A missing issue resolves to null
// rather than throwing, which is exactly the orphan signal computeDrift is looking for.
for (const entry of active) {
  const data = await client
    .query(`query($id: String!) { issue(id: $id) { id title } }`, { id: entry.issue_id })
    .catch(() => null);
  if (data?.issue) remoteById.set(entry.issue_id, data.issue);
}

const drift = computeDrift({ manifest, idMap, remoteById });

console.log(`manifest ${manifest.issues.length} issues · id-map ${active.length} active\n`);
console.log(`unseeded        ${drift.unseeded.length}`);
console.log(`orphaned        ${drift.orphaned.length}`);
console.log(`title mismatch  ${drift.titleMismatch.length}`);

const groups = { unseeded: drift.unseeded, orphaned: drift.orphaned, "title mismatch": drift.titleMismatch };
for (const [label, list] of Object.entries(groups)) {
  for (const id of list) console.log(`  ${label}: ${id}`);
}

console.log(
  drift.clean
    ? "\nin sync"
    : "\ndrift detected — this command is read-only, nothing was changed. " +
        "Run `npm run linear:plan` to see what an apply would do about it."
);

process.exit(drift.clean ? 0 : 1);
