import { test } from "node:test";
import assert from "node:assert/strict";
import { buildManifest, PROJECT_DEFS, REPO_SLUG, BRANCH } from "../lib/manifest.mjs";

const members = [
  { id: "luiz", name: "Luiz Fernando", aliases: ["Luiz"], linear_email: "luizfernandolfsg@gmail.com" },
  { id: "rather", name: "rather mercurial", aliases: ["Rather"], linear_email: null },
];

function task(overrides = {}) {
  return {
    id: "task-260806-luiz-linear-seed-repo",
    title: "Seed Linear from the regen-toolkit-os branch",
    owner: "luiz",
    project: "org-os-framework",
    layer: 10,
    estimate: 8,
    parent: null,
    cycle: 1,
    labels: ["origin/meeting-260806"],
    blocked_by: [],
    source: {
      file: "HEARTBEAT.md",
      section: "2026-08-06 engineering sync — process infrastructure landed",
      refs: ["docs/reports/2026-08-06-engineering-sync-integration.md"],
    },
    ...overrides,
  };
}

function heartbeatItem(overrides = {}) {
  return {
    id: "task-260806-luiz-linear-seed-repo",
    ownerHint: "Luiz",
    state: "open",
    section: "2026-08-06 engineering sync — process infrastructure landed",
    due: null,
    text: "Seed Linear from the regen-toolkit-os branch.",
    raw: "**Luiz —** Seed Linear from the regen-toolkit-os branch. `task-260806-luiz-linear-seed-repo`",
    ...overrides,
  };
}

test("one issue per task", () => {
  const manifest = buildManifest({ tasks: [task(), task({ id: "task-260806-rather-x", owner: "rather" })], members, heartbeat: [] });
  assert.equal(manifest.issues.length, 2);
});

test("resolves assignee_email when the member has a linear_email, and omits needs-assignee", () => {
  const manifest = buildManifest({ tasks: [task()], members, heartbeat: [heartbeatItem()] });
  const issue = manifest.issues[0];
  assert.equal(issue.assignee_email, "luizfernandolfsg@gmail.com");
  assert.ok(!issue.labels.includes("needs-assignee"));
});

test("no linear_email -> assignee_email null and needs-assignee present", () => {
  const manifest = buildManifest({
    tasks: [task({ id: "task-260806-rather-x", owner: "rather" })],
    members,
    heartbeat: [],
  });
  const issue = manifest.issues[0];
  assert.equal(issue.assignee_email, null);
  assert.ok(issue.labels.includes("needs-assignee"));
});

test("footer renders section, task id, repo@branch, and refs", () => {
  const manifest = buildManifest({ tasks: [task()], members, heartbeat: [heartbeatItem()] });
  const { description } = manifest.issues[0];
  assert.match(description, /source: HEARTBEAT\.md § 2026-08-06 engineering sync — process infrastructure landed · `task-260806-luiz-linear-seed-repo`/);
  assert.match(description, new RegExp(`repo: ${REPO_SLUG} @ ${BRANCH}`));
  assert.match(description, /refs: docs\/reports\/2026-08-06-engineering-sync-integration\.md/);
});

test("footer refs falls back to 'none' when the task has no refs", () => {
  const manifest = buildManifest({
    tasks: [task({ source: { file: "HEARTBEAT.md", section: "s", refs: [] } })],
    members,
    heartbeat: [],
  });
  assert.match(manifest.issues[0].description, /refs: none/);
});

test("footer names the owner of record only when unassigned", () => {
  const unassigned = buildManifest({
    tasks: [task({ id: "task-260806-rather-x", owner: "rather" })],
    members,
    heartbeat: [],
  });
  assert.match(unassigned.issues[0].description, /owner of record: rather mercurial \(no Linear account yet\)/);

  const assigned = buildManifest({ tasks: [task()], members, heartbeat: [heartbeatItem()] });
  assert.ok(!assigned.issues[0].description.includes("owner of record:"));
});

test("the --- divider always has a blank line on both sides (never a setext heading swallow)", () => {
  const manifest = buildManifest({ tasks: [task()], members, heartbeat: [heartbeatItem()] });
  const { description } = manifest.issues[0];
  assert.ok(description.includes("\n\n---\n\n"));
  // Not immediately following the description text with no blank line — that would silently
  // turn the last line of the body into a markdown H2.
  const dividerIndex = description.indexOf("---");
  assert.equal(description[dividerIndex - 1], "\n");
  assert.equal(description[dividerIndex - 2], "\n");
});

test("footer field lines are wrapped in a fenced code block so they can't be reparsed as markdown", () => {
  const manifest = buildManifest({ tasks: [task()], members, heartbeat: [heartbeatItem()] });
  const { description } = manifest.issues[0];
  assert.match(description, /```\nsource: /);
  assert.match(description, /\n```$/);
});

test("description body uses the matching HEARTBEAT item's text when present", () => {
  const manifest = buildManifest({
    tasks: [task()],
    members,
    heartbeat: [heartbeatItem({ text: "Custom heartbeat body text." })],
  });
  assert.match(manifest.issues[0].description, /^Custom heartbeat body text\./);
});

test("description body falls back to task.title for decomposition children absent from HEARTBEAT", () => {
  const manifest = buildManifest({
    tasks: [task({ id: "task-260806-luiz-slice-1-framework-schemas", title: "Slice 1 — framework and schemas" })],
    members,
    heartbeat: [heartbeatItem()], // present, but for a different task id
  });
  assert.match(manifest.issues[0].description, /^Slice 1 — framework and schemas/);
});

test("all three projects declared, org-os-framework is PROJECT_DEFS[2]", () => {
  const manifest = buildManifest({ tasks: [task()], members, heartbeat: [] });
  assert.deepEqual(manifest.projects, PROJECT_DEFS);
  assert.equal(manifest.projects.length, 3);
  assert.equal(PROJECT_DEFS[2].slug, "org-os-framework");
  assert.deepEqual(
    manifest.projects.map((p) => p.slug),
    ["repo-contribution", "knowledge-curation", "org-os-framework"]
  );
});

test("manifest label set is the sorted, deduplicated union of every issue's labels", () => {
  const manifest = buildManifest({
    tasks: [
      task({ id: "task-260806-luiz-a", owner: "luiz", labels: ["origin/meeting-260806"] }),
      task({ id: "task-260806-rather-b", owner: "rather", labels: ["gate/promotion"] }),
    ],
    members,
    heartbeat: [],
  });
  const union = new Set();
  for (const issue of manifest.issues) for (const l of issue.labels) union.add(l);
  assert.deepEqual(manifest.labels, [...union].sort());
  assert.deepEqual(manifest.labels, [...new Set(manifest.labels)].sort());
});

test("parent and blocked_by survive onto the issue", () => {
  const manifest = buildManifest({
    tasks: [task({ parent: "task-260806-luiz-four-slice-merge", blocked_by: ["task-260806-luiz-rather-org-access"] })],
    members,
    heartbeat: [],
  });
  assert.equal(manifest.issues[0].parent, "task-260806-luiz-four-slice-merge");
  assert.deepEqual(manifest.issues[0].blocked_by, ["task-260806-luiz-rather-org-access"]);
});

test("blocked_by defaults to [] when the task record omits it", () => {
  const { blocked_by: _omit, ...noBlockedBy } = task();
  const manifest = buildManifest({ tasks: [noBlockedBy], members, heartbeat: [] });
  assert.deepEqual(manifest.issues[0].blocked_by, []);
});

test("estimate and cycle pass through unchanged, including null", () => {
  const manifest = buildManifest({
    tasks: [task({ estimate: null, cycle: null })],
    members,
    heartbeat: [],
  });
  assert.equal(manifest.issues[0].estimate, null);
  assert.equal(manifest.issues[0].cycle, null);
});

test("schema envelope: schema_version, repo, branch, initiative", () => {
  const manifest = buildManifest({ tasks: [task()], members, heartbeat: [] });
  assert.equal(manifest.schema_version, "1.0");
  assert.equal(manifest.repo, REPO_SLUG);
  assert.equal(manifest.branch, BRANCH);
  assert.equal(manifest.initiative, "toolkit");
});

test("an owner absent from the member registry does not throw and yields no assignee", () => {
  const manifest = buildManifest({
    tasks: [task({ id: "task-260806-ghost-x", owner: "nobody-real" })],
    members,
    heartbeat: [],
  });
  const issue = manifest.issues[0];
  assert.equal(issue.assignee_email, null);
  assert.ok(issue.labels.includes("needs-assignee"));
  assert.match(issue.description, /owner of record: nobody-real \(no Linear account yet\)/);
});

// Cross-instance provenance. The 2026-08-31 handoff routes toolkit-workstream items out of
// regen-coordination-os's HEARTBEAT.md into this registry, and its whole argument for doing so
// by hand rests on the footer making that origin visible. renderFooter used to hardcode the
// literal "HEARTBEAT.md" and ignore task.source.file, so a ported item claimed it came from
// this repo's heartbeat — not merely missing provenance but asserting the wrong one, on an
// issue whose text no reviewer could trace back to a real section here.
test("footer names the source file from the task record, not a hardcoded HEARTBEAT.md", () => {
  const { issues } = buildManifest({
    tasks: [
      task({
        id: "task-260710-luiz-rc-org-repo-migration",
        source: {
          file: "../../HEARTBEAT.md",
          section: "Toolkit, Discourse, budget & wind-down (260710 — cadence now BIWEEKLY)",
          refs: [],
        },
      }),
    ],
    members,
    heartbeat: [],
  });
  assert.match(issues[0].description, /source: \.\.\/\.\.\/HEARTBEAT\.md § Toolkit, Discourse/);
  assert.doesNotMatch(issues[0].description, /source: HEARTBEAT\.md §/);
});

test("footer source file still defaults to HEARTBEAT.md when the task record omits it", () => {
  const { issues } = buildManifest({
    tasks: [task({ source: { section: "s", refs: [] } })],
    members,
    heartbeat: [],
  });
  assert.match(issues[0].description, /source: HEARTBEAT\.md § s/);
});

// Cross-instance items have no matching entry in this repo's HEARTBEAT.md, so describeBody's
// fallback made the issue body identical to its title — the ported prose (which is the only
// reason a reviewer can tell what the item means) was dropped. source.text carries it.
test("description body uses source.text for items with no HEARTBEAT match", () => {
  const { issues } = buildManifest({
    tasks: [
      task({
        id: "task-260710-luiz-koi-integrate-vs-defer",
        title: "Decide KOI integrate-now vs defer-interoperable",
        source: { file: "regen-coordination-os/HEARTBEAT.md", section: "s", refs: [], text: "Continue the joint review with Monty; decide KOI integrate-now vs defer-interoperable." },
      }),
    ],
    members,
    heartbeat: [],
  });
  assert.match(issues[0].description, /Continue the joint review with Monty/);
});

test("a matching HEARTBEAT item still wins over source.text", () => {
  const { issues } = buildManifest({
    tasks: [task({ source: { file: "HEARTBEAT.md", section: "s", refs: [], text: "ported prose" } })],
    members,
    heartbeat: [heartbeatItem({ text: "the heartbeat text" })],
  });
  assert.match(issues[0].description, /the heartbeat text/);
  assert.doesNotMatch(issues[0].description, /ported prose/);
});
