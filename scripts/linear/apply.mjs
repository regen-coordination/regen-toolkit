// Stage 3 — apply. Executes a plan artifact (from `npm run linear:plan`) against Linear. This is
// the ONLY script in the pipeline that writes to Linear. Dry-run is the default everywhere
// upstream of this file; here, --confirm is mandatory, and there is no delete path — not behind
// a flag, not anywhere. An agent that misreads its instructions must not be able to destroy the
// board (spec §4, docs/superpowers/specs/2026-08-08-linear-seeding-design.md).
import fs from "node:fs";
import "dotenv/config";
import { LinearClient } from "./lib/client.mjs";
import { loadIdMap } from "./lib/idmap.mjs";
import { executePlan } from "./lib/executor.mjs";
import { runStamp } from "./lib/runlog.mjs";

const ID_MAP_PATH = "data/linear/id-map.yaml";

function usage() {
  console.error(
    "usage: npm run linear:apply -- --plan <path/to/run-plan.json> --confirm\n\n" +
      "  --plan <path>   the plan artifact written by `npm run linear:plan`\n" +
      "                  (data/linear/runs/<timestamp>-plan.json)\n" +
      "  --confirm       required. Without it, this refuses to touch Linear.\n"
  );
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  // Checked before the plan file is even looked for: an operator who forgot --confirm should
  // never learn about a missing --plan first — the refusal to write is the more important
  // message, and it should be the same message every time regardless of what else is wrong.
  if (!process.argv.includes("--confirm")) {
    console.error(
      "refusing to apply without --confirm. This is the stage that writes to Linear — read the " +
        "plan first (npm run linear:plan, and the human-readable diff it prints), then re-run " +
        "this command with --plan <path> --confirm once you're sure."
    );
    process.exit(1);
  }

  const planPath = argValue("--plan");
  if (!planPath) {
    usage();
    process.exit(1);
  }

  let plan;
  try {
    plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
  } catch (err) {
    console.error(`could not read plan at "${planPath}": ${err.message}`);
    usage();
    process.exit(1);
  }

  if (!process.env.LINEAR_API_KEY) {
    console.error(
      "LINEAR_API_KEY is not set. Copy .env.example to .env and add your Linear personal API key, " +
        "or export it in your shell before running this command."
    );
    process.exit(1);
  }

  const idMap = loadIdMap(ID_MAP_PATH);
  idMap.team_key = plan.team?.key ?? idMap.team_key;

  // Two clients, deliberately different retry policy — see executor.mjs's module comment for why
  // a mutation must never be retried blindly the way a read safely can be.
  const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });
  const mutationClient = new LinearClient({ apiKey: process.env.LINEAR_API_KEY, maxRetries: 0 });

  const stamp = runStamp();

  const { created, updated } = await executePlan({
    plan,
    client,
    mutationClient,
    idMapPath: ID_MAP_PATH,
    idMap,
    stamp,
  });

  console.log(`created ${created} · updated ${updated}`);
  console.log(`apply log → data/linear/runs/${stamp}-apply.jsonl`);
}

main().catch((err) => {
  console.error(`apply failed: ${err.message}`);
  console.error(
    `state: everything logged in the apply log and recorded in ${ID_MAP_PATH} before this error ` +
      `landed in Linear and is durable. Re-run \`npm run linear:plan\` to see what's left (already-` +
      `created issues will show up as updates, not creates), then re-run apply — this resumes ` +
      `without duplicating anything already created.`
  );
  process.exit(1);
});
