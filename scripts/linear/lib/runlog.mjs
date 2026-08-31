// Run artifacts. Every plan and every apply leaves a file under data/linear/runs/, so a
// mutation is auditable after the fact and an interrupted run is diagnosable rather than
// mysterious. The apply log is append-only JSONL: one line per operation, written as it
// happens, so a crash leaves a truthful partial record instead of nothing.
import fs from "node:fs";
import path from "node:path";

export const RUNS_DIR = "data/linear/runs";

export function runStamp(now = new Date()) {
  return now.toISOString().replace(/[:.]/g, "-");
}

export function writePlan(stamp, plan, dir = RUNS_DIR) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${stamp}-plan.json`);
  fs.writeFileSync(file, JSON.stringify(plan, null, 2), "utf8");
  return file;
}

export function appendApply(stamp, entry, dir = RUNS_DIR, now = new Date()) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${stamp}-apply.jsonl`);
  fs.appendFileSync(file, JSON.stringify({ at: now.toISOString(), ...entry }) + "\n", "utf8");
  return file;
}
