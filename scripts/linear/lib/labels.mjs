// Linear label derivation for the seeding pipeline. Pure, no I/O, never throws.
//
// Mirrors the directory idiom (tasks.mjs / members.mjs / heartbeat.mjs / triage.mjs).
//
// Labels mirror structures that already exist rather than inventing a vocabulary:
//   layer/01..layer/10   the ten layers from docs/layers/README.md
//   origin/meeting-*     provenance back to the source meeting (explicit, from data/tasks.yaml)
//   gate/*               the three hard gates: promotion, privacy, review (explicit)
//   backlog/*            the master-doc §16 status vocabulary already used in docs/BACKLOG.md
//   needs-triage         carried from the HEARTBEAT [needs-triage] marker (explicit)
//   strategic            derived: no project, i.e. an initiative-level issue
//   needs-assignee       derived: owner of record known, Linear account not yet resolvable
//   seed/repo            derived: on everything this tool creates, so Afo's parallel seed
//                        from the call notes stays distinguishable from this one
//
// Explicit labels come from the task record; the four derived ones are computed here so a
// hand-authored registry cannot forget them.
export function deriveLabels(task, { assigneeResolved }) {
  const labels = new Set(task.labels ?? []);
  labels.add("seed/repo");
  if (task.layer != null) labels.add(`layer/${String(task.layer).padStart(2, "0")}`);
  if (task.project == null) labels.add("strategic");
  if (!assigneeResolved) labels.add("needs-assignee");
  return [...labels].sort();
}
