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

// Descriptions are compared on CONTENT, not bytes, because Linear rewrites markdown on ingest.
// Two rewrites were observed live on 2026-08-09 across the 172-issue seed:
//
//   1. Emphasis delimiters move outside an inline-code boundary (22 issues). We send
//        **Luiz — seed Linear from the `regen-toolkit-os` branch**
//      and Linear stores
//        **Luiz — seed Linear from the** `regen-toolkit-os` **branch**
//
//   2. Bare URLs are auto-linked (8 issues). We send
//        bioregioning.org
//      and Linear stores
//        [bioregioning.org](<http://bioregioning.org>)
//
//   3. Markdown punctuation is backslash-escaped (3 issues). We send
//        ~69 source systems
//      and Linear stores
//        \~69 source systems
//
// All three render identically and differ only in bytes. A byte comparison would report all 33
// as drift forever, and every `apply` would push our form back for Linear to rewrite again on
// arrival: an endless ping-pong that also buries any real hand-edit in permanent noise.
//
// So we compare prose: unescape backslash escapes, collapse `[label](url)` to `label`, drop
// emphasis and code delimiters, collapse whitespace. Unescaping runs FIRST, or stripping `~`
// out of `\~69` would leave a stray backslash behind and the comparison would still fail.
//
// The deliberate trade: a change that ONLY alters formatting — bolding a word, or linking a
// word that was already there — is invisible to this check. That is the right call. We care
// whether someone rewrote the words, not how they are decorated.
const MD_ESCAPE = /\\([\\`*_{}[\]()#+\-.!~>])/g;
const MD_LINK = /\[([^\]]*)\]\([^)]*\)/g;
const MARKUP = /[*_`~]/g;

function sameProse(a, b) {
  const norm = (s) =>
    String(s ?? "")
      .replace(MD_ESCAPE, "$1")
      .replace(MD_LINK, "$1")
      .replace(MARKUP, "")
      .replace(/\s+/g, " ")
      .trim();
  return norm(a) === norm(b);
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
    if (!sameProse(remote.description, issue.description)) descriptionMismatch.push(issue.task_id);
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
