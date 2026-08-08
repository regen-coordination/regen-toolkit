// The plan stage's pure core: manifest + id-map + already-fetched Linear state -> a
// create/update/skip diff. No I/O, no network — `plan.mjs` is the thin CLI that queries Linear
// read-only and hands the result here as `remote`. Mirrors the tasks.mjs/members.mjs idiom:
// this module only shapes data it is handed.
//
// Ownership model (spec §2.1, docs/superpowers/specs/2026-08-08-linear-seeding-design.md):
// the repo owns identity and routing — title, description, project, labels, estimate, parent,
// blocked_by. Linear owns execution state — status, assignee, cycle, priority, comments — once
// an issue exists. `create` proposes the full issue shape because nothing is Linear-owned yet.
// `update` deliberately drops `assignee_email` and `cycle`: carrying them forward would let a
// routine re-plan silently propose reverting a hand-done reassignment or cycle move, which is
// exactly the kind of field-ownership fork the whole design exists to avoid.
//
// The Linear workspace is empty and awaiting this seed, so there is deliberately no fuzzy title
// matching anywhere in this pipeline — idempotency comes only from the exact id-map
// (data/linear/id-map.yaml). Name matching for projects/labels below is a narrower thing: exact
// identity, tolerant only of case and incidental whitespace, mirroring the house style in
// members.mjs's `resolveOwner` (a person's name typed with different capitalisation is still
// that person; a project renamed with different capitalisation is still that project). It is
// still not fuzzy — no substring or edit-distance matching is done anywhere here.
const normName = (s) => String(s).replace(/\s+/g, " ").trim().toLowerCase();

// Builds a normalized-name -> item map and separately reports which normalized keys were
// claimed more than once, so callers can decide whether a collision is fatal. Sharing this
// between the manifest side and the remote side keeps both checks expressed identically.
function indexByName(items, nameOf) {
  const map = new Map();
  const dupes = new Set();
  for (const item of items) {
    const key = normName(nameOf(item));
    if (map.has(key)) dupes.add(key);
    map.set(key, item);
  }
  return { map, dupes };
}

// The pre-flight assertion that stands in for fuzzy matching (spec §2.2, §7). The Linear
// workspace is expected to be empty, or to contain only issues this tool already created
// (every one of which carries `seed/repo`). Anything else means the tool is pointed at a team
// with issues it doesn't recognise, and refuses to touch it without an explicit override.
export function preflight({ existingIssueCount, seededCount, allowNonEmpty }) {
  if (allowNonEmpty) return { ok: true };
  if (existingIssueCount === 0) return { ok: true };
  if (existingIssueCount === seededCount) return { ok: true };
  return {
    ok: false,
    reason:
      `target team has ${existingIssueCount} issue(s), only ${seededCount} of which carry ` +
      `seed/repo. Refusing to seed a workspace this tool did not create. Pass --allow-nonempty to override.`,
  };
}

export function buildPlan({ manifest, idMap, remote }) {
  const projects = manifest.projects ?? [];
  const labels = manifest.labels ?? [];
  const remoteProjects = remote.projects ?? [];
  const remoteLabels = remote.labels ?? [];

  // Two manifest projects sharing a name (even by exact string, let alone case-insensitively)
  // is a data-authoring bug: adopt-by-name has no principled way to tell them apart, and
  // whichever remote project matches would silently absorb issues meant for both. Fail loudly
  // naming the offending name, rather than let one project's issues land in the other's bucket.
  const { dupes: manifestDupes } = indexByName(projects, (p) => p.name);
  if (manifestDupes.size > 0) {
    throw new Error(
      `buildPlan: manifest declares more than one project named "${[...manifestDupes][0]}" ` +
        `(case/whitespace-insensitive) — project names must be unique for adopt-by-name matching.`
    );
  }

  // The same ambiguity on Linear's side: if the team already has two projects whose names
  // collide once normalized, there is no safe way to choose which one this run adopts. A Map
  // would just keep whichever came last from the API and adopt that one silently. Fail instead
  // — this is a Linear-side naming collision for a human (most likely Afo, who owns project
  // structure) to resolve, not something this tool should guess through.
  const { map: remoteProjectByName, dupes: remoteDupes } = indexByName(remoteProjects, (p) => p.name);
  if (remoteDupes.size > 0) {
    throw new Error(
      `buildPlan: Linear already has more than one project named "${[...remoteDupes][0]}" ` +
        `(case/whitespace-insensitive) in this team — adopt-by-name can't tell them apart. ` +
        `Rename one in Linear before planning.`
    );
  }

  const { map: remoteLabelByName } = indexByName(remoteLabels, (l) => l.name);

  const create = [];
  const update = [];
  for (const issue of manifest.issues) {
    const entry = idMap.entries[issue.task_id];
    if (entry && entry.state === "active") {
      // Drop the two Linear-owned fields before proposing an update — see module comment.
      const { assignee_email, cycle, ...repoOwned } = issue;
      update.push({ ...repoOwned, issue_id: entry.issue_id, identifier: entry.identifier });
    } else {
      // Everything else — never mapped, or mapped but `orphaned` — recreates. An orphaned
      // entry is never silently recreated behind the id-map's back (idmap.mjs keeps the old
      // identifier for investigation); it just also isn't treated as still live here, so its
      // task reappears as a normal create.
      create.push(issue);
    }
  }

  return {
    projects: {
      create: projects.filter((p) => !remoteProjectByName.has(normName(p.name))),
      // Adopted projects carry the remote id — without it the executor has nothing to attach
      // issues to. This is the bug that matters most in this module.
      adopt: projects
        .filter((p) => remoteProjectByName.has(normName(p.name)))
        .map((p) => ({ ...p, id: remoteProjectByName.get(normName(p.name)).id })),
    },
    labels: { create: labels.filter((name) => !remoteLabelByName.has(normName(name))) },
    // name -> id for labels that already exist, keyed by their real (remote) spelling, so the
    // executor can attach them without re-querying or re-deriving the normalization.
    labelIds: Object.fromEntries([...remoteLabelByName.values()].map((l) => [l.name, l.id])),
    issues: { create, update },
  };
}
