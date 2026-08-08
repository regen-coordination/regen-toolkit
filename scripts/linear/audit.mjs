// Triage coverage audit — the finish line for the HEARTBEAT.md triage pass.
//
// Exits 0 only when every OPEN item carries a stable task id and an owner that resolves to a
// real member. Until then it prints the worklist. Read-only: it never writes anything.
import fs from "node:fs";
import { parseHeartbeat } from "./lib/heartbeat.mjs";
import { auditCoverage } from "./lib/triage.mjs";
import { loadMembers, resolveOwner } from "./lib/members.mjs";

const members = loadMembers("data/members.yaml");
const isPerson = (hint) => Boolean(resolveOwner(members, hint));

const report = auditCoverage(parseHeartbeat(fs.readFileSync("HEARTBEAT.md", "utf8")), isPerson);

console.log(`total ${report.total} · open ${report.open}`);
console.log(`missing id: ${report.missingId.length} · missing owner: ${report.missingOwner.length}\n`);

const sections = Object.entries(report.bySection).sort((a, b) => b[1].open - a[1].open);
for (const [section, counts] of sections) {
  if (counts.open === 0) continue;
  console.log(`${String(counts.open).padStart(3)} open  ${section}`);
}

if (!report.clean) {
  console.log(`\n— ${report.missingId.length} open item(s) with no task id —`);
  for (const item of report.missingId) {
    console.log(`  [${item.section}] ${item.text.slice(0, 88)}`);
  }
  console.log(`\n— ${report.missingOwner.length} open item(s) with no resolvable owner —`);
  for (const item of report.missingOwner) {
    console.log(`  [${item.section}] hint=${item.ownerHint ?? "none"} · ${item.text.slice(0, 66)}`);
  }
}

process.exit(report.clean ? 0 : 1);
