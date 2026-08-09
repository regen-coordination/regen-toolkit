// Stage 2 — plan. Reads the committed seed manifest and id-map, queries Linear READ-ONLY, and
// writes a plan artifact plus a human-readable create/update/skip diff. This stage never
// mutates Linear. The only file it writes is local: `data/linear/id-map.yaml` gets orphan
// entries marked (see the orphan sweep below), and `data/linear/runs/<ts>-plan.json` is the
// plan artifact itself. Apply (a separate, --confirm-gated stage) is what actually talks to
// Linear with a mutation.
//
// Schema-shape confidence, so this doesn't read as more certain than it is: `Team.issues`,
// `Team.projects`, `Team.labels`, `Team.cycles`, `Cycle.{id,number,startsAt,endsAt}`,
// `initiatives` as a top-level Query field, `teams(filter: { key: { eq: $key } })`, and the
// top-level `team(id: $teamId)` field used by the pagination follow-up queries below are all
// confirmed against live introspection (2026-08-08, Task 20) — no longer guesses. `Team.members`
// returning `{ id name email active }` is confirmed the same way and is new as of Task 20 (used
// to build `plan.userIdsByEmail` for assignee resolution — see below). If a field name were ever
// wrong regardless, Linear returns a GraphQL error naming it — client.mjs surfaces that verbatim
// rather than swallowing it, so a wrong guess here fails loud, not silent.
import fs from "node:fs";
import yaml from "js-yaml";
import "dotenv/config";
import { LinearClient } from "./lib/client.mjs";
import { loadIdMap, markOrphaned } from "./lib/idmap.mjs";
import { buildPlan, preflight } from "./lib/planner.mjs";
import { runStamp, writePlan } from "./lib/runlog.mjs";

const ID_MAP_PATH = "data/linear/id-map.yaml";
const MANIFEST_PATH = "data/linear/seed-manifest.yaml";

// Both connections that grow with ordinary use of this pipeline (every issue seeded, every
// meeting's origin/meeting-* label) are paginated below. `issues` is the one that matters most:
// the manifest already seeds 172 records against a first page of 250, and the registry is
// designed to keep growing as meetings get processed — an unpaginated fetch here would
// eventually under-count `existing` (breaking the empty-workspace pre-flight) and under-populate
// `liveIssueIds` (making the orphan sweep below mark still-live issues orphaned, because the
// page that would have proven them live was never fetched). `labels` grows more slowly (a
// largely fixed vocabulary plus one origin/meeting-* per meeting) but shares the same failure
// mode, so it gets the same treatment for the same cost.
//
// `projects` (3, one per lane, growing only when a new lane is proposed), `cycles` (biweekly —
// 50 covers roughly two years), `initiatives` (workspace-wide; this pipeline only ever looks
// for the single `toolkit` initiative by name), and `members` (a small team, not a growing
// registry) are left single-page. That is a latent limit, not a fixed one — revisit if any of
// those connections is ever observed near its page size.
const PAGE = 250;

async function fetchAllPages(client, { query, variables, connectionPath }) {
  const readConnection = (data) => connectionPath.reduce((node, key) => node[key], data);

  const data = await client.query(query, variables);
  const first = readConnection(data);
  let nodes = first.nodes;
  let pageInfo = first.pageInfo;

  while (pageInfo?.hasNextPage) {
    const page = await client.query(query, { ...variables, after: pageInfo.endCursor });
    const next = readConnection(page);
    nodes = nodes.concat(next.nodes);
    pageInfo = next.pageInfo;
  }

  return nodes;
}

async function main() {
  // Checked before anything else, and before the LinearClient is ever constructed, so a missing
  // key fails with one plain-English line — not the constructor's thrown Error surfacing as an
  // unhandled-rejection stack trace.
  if (!process.env.LINEAR_API_KEY) {
    console.error(
      "LINEAR_API_KEY is not set. Copy .env.example to .env and add your Linear personal API key, " +
        "or export it in your shell before running this command."
    );
    process.exit(1);
  }
  const TEAM_KEY = process.env.LINEAR_TEAM_KEY;
  if (!TEAM_KEY) {
    console.error(
      "LINEAR_TEAM_KEY is not set. Add it to .env — the short team key this seed targets (e.g. TOOL)."
    );
    process.exit(1);
  }

  const allowNonEmpty = process.argv.includes("--allow-nonempty");

  const manifest = yaml.load(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const idMap = loadIdMap(ID_MAP_PATH);
  const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

  // `teams(..., first: 1)` — discovered live (2026-08-08, Task 20), not in the original task
  // brief: without an explicit `first` on `teams`, Linear's query-complexity budget treats the
  // connection as unbounded and multiplies it against every nested connection beneath it
  // (issues, projects, labels, cycles, members), which blows the budget and the whole query
  // fails with "Query too complex" — confirmed by testing the query with and without `first: 1`
  // directly against the live API. This tool only ever wants the single team matching
  // `filter: { key: { eq: $key } }`, so `first: 1` is also the semantically correct bound, not
  // just a workaround.
  const data = await client.query(
    `query($key: String!) {
       initiatives(first: 100) { nodes { id name } }
       teams(filter: { key: { eq: $key } }, first: 1) {
         nodes {
           id key name
           issues(first: ${PAGE}) {
             nodes { id identifier labels { nodes { name } } }
             pageInfo { hasNextPage endCursor }
           }
           projects(first: 100) { nodes { id name } }
           labels(first: ${PAGE}) {
             nodes { id name }
             pageInfo { hasNextPage endCursor }
           }
           cycles(first: 50) { nodes { id number startsAt endsAt } }
           members(first: ${PAGE}) { nodes { id name email active } }
         }
       }
     }`,
    { key: TEAM_KEY }
  );

  const team = data.teams.nodes[0];
  if (!team) {
    console.error(`team "${TEAM_KEY}" not found — check LINEAR_TEAM_KEY.`);
    process.exit(1);
  }

  const issuePageQuery = `
    query($teamId: String!, $after: String) {
      team(id: $teamId) {
        issues(first: ${PAGE}, after: $after) {
          nodes { id identifier labels { nodes { name } } }
          pageInfo { hasNextPage endCursor }
        }
      }
    }`;
  const labelPageQuery = `
    query($teamId: String!, $after: String) {
      team(id: $teamId) {
        labels(first: ${PAGE}, after: $after) {
          nodes { id name }
          pageInfo { hasNextPage endCursor }
        }
      }
    }`;

  const existing = team.issues.pageInfo.hasNextPage
    ? await fetchAllPages(client, {
        query: issuePageQuery,
        variables: { teamId: team.id },
        connectionPath: ["team", "issues"],
      })
    : team.issues.nodes;

  const remoteLabels = team.labels.pageInfo.hasNextPage
    ? await fetchAllPages(client, {
        query: labelPageQuery,
        variables: { teamId: team.id },
        connectionPath: ["team", "labels"],
      })
    : team.labels.nodes;

  // Initiative check. Afo owns initiative creation — this tool only ever looks one up by name.
  const initiative = data.initiatives.nodes.find(
    (i) => i.name.toLowerCase() === manifest.initiative.toLowerCase()
  );
  if (!initiative) {
    console.error(
      `initiative "${manifest.initiative}" not found. Afo owns initiative creation — ` +
        `ask him to create it, or correct the name in ${MANIFEST_PATH}. This tool will not create one.`
    );
    process.exit(1);
  }

  const seededCount = existing.filter((i) => i.labels.nodes.some((l) => l.name === "seed/repo")).length;
  const gate = preflight({ existingIssueCount: existing.length, seededCount, allowNonEmpty });
  if (!gate.ok) {
    console.error(`preflight failed: ${gate.reason}`);
    process.exit(1);
  }

  // Orphan sweep. Any active id-map entry whose issue_id no longer shows up among Linear's live
  // issues gets marked orphaned in the LOCAL id-map only — nothing is written to Linear here, so
  // the stage stays read-only with respect to the API. The next plan recreates it as a normal
  // create; the old identifier is preserved (idmap.mjs), not dropped, so the disappearance stays
  // investigable.
  const liveIssueIds = new Set(existing.map((i) => i.id));
  let orphaned = 0;
  for (const [taskId, entry] of Object.entries(idMap.entries)) {
    if (entry.state === "active" && !liveIssueIds.has(entry.issue_id)) {
      markOrphaned(ID_MAP_PATH, idMap, taskId);
      orphaned += 1;
    }
  }

  const plan = buildPlan({
    manifest,
    idMap,
    remote: { projects: team.projects.nodes, labels: remoteLabels },
  });
  plan.team = { id: team.id, key: team.key, name: team.name };
  plan.initiative = { id: initiative.id, name: initiative.name };
  // Only tasks carrying an explicit cycle number are scheduled; everything else lands in the
  // project backlog — nothing is auto-scheduled (spec §5).
  plan.cycleIds = Object.fromEntries(team.cycles.nodes.map((c) => [c.number, c.id]));
  // Email -> Linear user id, active members only, keyed lowercased so lookups are
  // case-insensitive (consistent with members.mjs's `norm`). Consumed by executor.mjs on CREATE
  // only — spec §2.1/§4.2: an owner with no resolvable Linear account is created unassigned with
  // a `needs-assignee` label rather than failing the run, and Linear owns the assignee (not this
  // pipeline) once an issue exists, so this map is never consulted on UPDATE.
  plan.userIdsByEmail = Object.fromEntries(
    team.members.nodes
      .filter((u) => u.active && u.email)
      .map((u) => [u.email.toLowerCase(), u.id])
  );

  // Cycle check applies only to issues that actually target a cycle — an empty `plan.cycleIds`
  // (no cycles created in Linear yet) is not itself a failure, so the tool stays usable before
  // any cycle exists as long as nothing in the manifest is scheduled into one.
  const unschedulable = manifest.issues.filter((i) => i.cycle != null && !plan.cycleIds[i.cycle]);
  if (unschedulable.length) {
    console.error(`\n${unschedulable.length} issue(s) target a cycle that does not exist in Linear:`);
    for (const i of unschedulable) console.error(`  ${i.task_id} → cycle ${i.cycle}`);
    console.error(`create the cycle in Linear first, or clear the cycle field in data/tasks.yaml.`);
    process.exit(1);
  }

  const stamp = runStamp();
  const file = writePlan(stamp, plan);

  console.log(`plan → ${file}\n`);
  console.log(`initiative    ${initiative.name}`);
  console.log(`team          ${team.key} (${team.name})`);
  console.log(`projects      create ${plan.projects.create.length} · adopt ${plan.projects.adopt.length}`);
  console.log(`labels        create ${plan.labels.create.length}`);
  console.log(`issues        create ${plan.issues.create.length} · update ${plan.issues.update.length}`);
  // Only `create` is assignable — `update` never carries assignee_email (Linear owns it once
  // seeded, see planner.mjs), so counting there would misreport issues this run won't touch.
  const assignable = plan.issues.create.filter(
    (i) => i.assignee_email && plan.userIdsByEmail[i.assignee_email.toLowerCase()]
  ).length;
  const unassignable = plan.issues.create.length - assignable;
  console.log(`assignees     ${assignable} resolved · ${unassignable} unassigned (needs-assignee)`);
  if (orphaned) console.log(`orphaned      ${orphaned} (will be recreated)`);
  console.log(`\nnothing was written to Linear. run apply with --confirm to execute.`);
}

main().catch((err) => {
  console.error(`plan failed: ${err.message}`);
  process.exit(1);
});
