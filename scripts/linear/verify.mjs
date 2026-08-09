// Read-only drift report. Safe for ANY agent to run at ANY time — it makes no mutation and has
// no --confirm gate because it needs none. This is the command to reach for when you want to
// know whether the repo and Linear still agree; `apply` is the only thing that changes either.
//
// Exits 0 when in sync, 1 when drift is detected, so it can gate a workflow.
import fs from "node:fs";
import yaml from "js-yaml";
import "dotenv/config";
import { LinearClient } from "./lib/client.mjs";
import { requireApiKey } from "./lib/env.mjs";
import { loadIdMap } from "./lib/idmap.mjs";
import { computeDrift } from "./lib/drift.mjs";
import { fetchAllPages } from "./lib/pagination.mjs";

const MANIFEST = "data/linear/seed-manifest.yaml";
const ID_MAP = "data/linear/id-map.yaml";
const PAGE = 250;

// `filter: { id: { in: $ids } }` on the root `issues` connection — confirmed against live
// introspection (2026-08-09): `IssueFilter.id` is an `IssueIDComparator`, whose `in` field takes
// `[ID!]`. One batched, paginated query replaces what used to be 172 sequential awaited queries
// (~24s wall-clock at that count) — a command advertised as safe to run at any time shouldn't
// cost that much just to ask "are we in sync?". A missing id simply doesn't appear in the
// result, which is exactly the orphan signal computeDrift is looking for, same as the old
// catch-and-return-null per-query approach.
const ISSUES_BY_ID = `
  query($ids: [ID!], $after: String) {
    issues(filter: { id: { in: $ids } }, first: ${PAGE}, after: $after) {
      nodes { id title description estimate labels { nodes { name } } }
      pageInfo { hasNextPage endCursor }
    }
  }`;

requireApiKey();

if (!fs.existsSync(MANIFEST)) {
  console.error(`${MANIFEST} not found — run \`npm run linear:extract\` first.`);
  process.exit(1);
}

const manifest = yaml.load(fs.readFileSync(MANIFEST, "utf8"));
const idMap = loadIdMap(ID_MAP);
const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

const active = Object.values(idMap.entries).filter((e) => e.state === "active");
const ids = active.map((e) => e.issue_id);

const nodes = ids.length
  ? await fetchAllPages(client, { query: ISSUES_BY_ID, variables: { ids }, connectionPath: ["issues"] })
  : [];

// Flatten `labels.nodes` -> a plain name array here, at the I/O boundary, so computeDrift (pure,
// no GraphQL-shape knowledge) can compare it directly against the manifest's own `issue.labels`.
const remoteById = new Map(
  nodes.map((n) => [n.id, { id: n.id, title: n.title, description: n.description, estimate: n.estimate, labels: n.labels.nodes.map((l) => l.name) }])
);

const drift = computeDrift({ manifest, idMap, remoteById });

console.log(`manifest ${manifest.issues.length} issues · id-map ${active.length} active\n`);
console.log(`unseeded              ${drift.unseeded.length}`);
console.log(`orphaned              ${drift.orphaned.length}`);
console.log(`title mismatch        ${drift.titleMismatch.length}`);
console.log(`description mismatch  ${drift.descriptionMismatch.length}`);
console.log(`estimate mismatch     ${drift.estimateMismatch.length}`);
console.log(`labels mismatch       ${drift.labelsMismatch.length}`);

const groups = {
  unseeded: drift.unseeded,
  orphaned: drift.orphaned,
  "title mismatch": drift.titleMismatch,
  "description mismatch": drift.descriptionMismatch,
  "estimate mismatch": drift.estimateMismatch,
  "labels mismatch": drift.labelsMismatch,
};
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
