// Drift detection: does Linear still match the manifest? Pure, no I/O, never throws.
//
// This is the module behind `npm run linear:verify`, which is READ-ONLY and safe for any agent
// to run at any time. That matters: agents acting through this pipeline need a way to answer
// "is this in sync?" that cannot possibly cause damage. Anything that writes lives in apply.
//
// Six drift kinds, deliberately kept separate because they mean different things:
//   unseeded            a manifest task with no active id-map entry — expected before a first
//                        apply, suspicious afterwards
//   orphaned             a mapped issue that is gone from Linear — someone deleted it there, or
//                        the map points at a different workspace
//   titleMismatch        the issue's title has diverged
//   descriptionMismatch  the issue's description has diverged
//   estimateMismatch     the issue's estimate has diverged
//   labelsMismatch       the issue's label set has diverged
//
// title, description, estimate and labels are all repo-owned (spec §2.1) — any of the last four
// kinds means the next `apply` would silently overwrite a hand-edit made directly in Linear, not
// just that "something" is out of sync.
function sameLabelSet(a, b) {
  const as = new Set(a ?? []);
  const bs = new Set(b ?? []);
  if (as.size !== bs.size) return false;
  for (const label of as) if (!bs.has(label)) return false;
  return true;
}

export function computeDrift({ manifest, idMap, remoteById }) {
  const unseeded = [];
  const orphaned = [];
  const titleMismatch = [];
  const descriptionMismatch = [];
  const estimateMismatch = [];
  const labelsMismatch = [];

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
    if (remote.description !== issue.description) descriptionMismatch.push(issue.task_id);
    if (remote.estimate !== issue.estimate) estimateMismatch.push(issue.task_id);
    if (!sameLabelSet(remote.labels, issue.labels)) labelsMismatch.push(issue.task_id);
  }

  return {
    unseeded,
    orphaned,
    titleMismatch,
    descriptionMismatch,
    estimateMismatch,
    labelsMismatch,
    clean:
      unseeded.length === 0 &&
      orphaned.length === 0 &&
      titleMismatch.length === 0 &&
      descriptionMismatch.length === 0 &&
      estimateMismatch.length === 0 &&
      labelsMismatch.length === 0,
  };
}
