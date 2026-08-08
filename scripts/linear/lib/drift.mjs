// Drift detection: does Linear still match the manifest? Pure, no I/O, never throws.
//
// This is the module behind `npm run linear:verify`, which is READ-ONLY and safe for any agent
// to run at any time. That matters: agents acting through this pipeline need a way to answer
// "is this in sync?" that cannot possibly cause damage. Anything that writes lives in apply.
//
// Three drift kinds, deliberately kept separate because they mean different things:
//   unseeded      a manifest task with no active id-map entry — expected before a first apply,
//                 suspicious afterwards
//   orphaned      a mapped issue that is gone from Linear — someone deleted it there, or the
//                 map points at a different workspace
//   titleMismatch the issue exists but its title has diverged — usually a hand-edit in Linear
//                 that the next apply would silently overwrite, since title is repo-owned
export function computeDrift({ manifest, idMap, remoteById }) {
  const unseeded = [];
  const orphaned = [];
  const titleMismatch = [];

  for (const issue of manifest.issues) {
    const entry = idMap.entries[issue.task_id];
    if (!entry || entry.state !== "active") {
      unseeded.push(issue.task_id);
      continue;
    }
    const remote = remoteById.get(entry.issue_id);
    if (!remote) {
      orphaned.push(issue.task_id);
      continue;
    }
    if (remote.title !== issue.title) titleMismatch.push(issue.task_id);
  }

  return {
    unseeded,
    orphaned,
    titleMismatch,
    clean: unseeded.length === 0 && orphaned.length === 0 && titleMismatch.length === 0,
  };
}
