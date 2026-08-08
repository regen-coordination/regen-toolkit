#!/usr/bin/env node

/**
 * org-os Initialize — Data Gatherer
 *
 * Reads all organizational state from local files + optional Notion API,
 * outputs structured JSON for agent consumption or pre-rendered markdown.
 *
 * Usage:
 *   node scripts/initialize.mjs                  # JSON output (for agent)
 *   node scripts/initialize.mjs --format=markdown # Pre-rendered dashboard
 *   node scripts/initialize.mjs --format=json     # Explicit JSON (default)
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import matter from "gray-matter";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { parseHeartbeat } from "./linear/lib/heartbeat.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const formatArg = args.find((a) => a.startsWith("--format="));
const format = formatArg ? formatArg.split("=")[1] : "json";

// ── Helpers ──────────────────────────────────────────────────────────────────

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function readYamlSafe(filePath) {
  const content = readFileSafe(filePath);
  if (!content) return null;
  try {
    return yaml.load(content);
  } catch {
    return null;
  }
}

function parseMarkdownFrontmatter(filePath) {
  const content = readFileSafe(filePath);
  if (!content) return null;
  try {
    return matter(content);
  } catch {
    return null;
  }
}

// Adapts the shared HEARTBEAT grammar (scripts/linear/lib/heartbeat.mjs) to the shape this
// dashboard has always consumed. Two deliberate departures from a literal field rename:
//
// 1. `[~]` (superseded) items are dropped entirely, matching current dashboard behavior:
//    the old regex `/^-\s+\[([ xX])\]\s+(.+)/` never matched `[~]` at all, so those lines were
//    silently invisible (not open, not done, not counted). Mapping `state !== "open"` to `done`
//    would newly surface them as "completed" — which misrepresents abandoned work as finished.
//    Excluding them preserves both the operator-facing invariant (a checkmark means "done", not
//    "abandoned") and the byte-for-byte dashboard baseline.
// 2. `text` is left as parseHeartbeat produced it (not re-stripped of `@\w+`). The old regex
//    stripped that pattern to remove @-mentions, but it also mangled scoped package names like
//    `` `@org-os/kms` `` into `` `-os/kms` `` — a latent bug, not a feature.
// 3. The old `assignee` field is gone rather than being fed from `ownerHint`. A hint is not an
//    owner: `T1`, `SP11`, `Infra`, `Group` and `Joint` all match the `**Name —**` shape, and
//    `--format=json` is consumed by an agent (.opencode/skills/org-os-init) that is told only
//    to "parse it and render the dashboard" — so a field literally named `assignee` holding
//    "T1" invites rendering a phase code as a person. Only resolveOwner (members.mjs) can make
//    that call, and this script has no member registry. The hint is exposed under its honest
//    name instead, and `id` is surfaced structurally since `text` no longer carries it.
function extractCheckboxes(markdownContent) {
  return parseHeartbeat(markdownContent)
    .filter((item) => item.state !== "superseded")
    .map((item) => ({
      id: item.id,
      text: item.text,
      done: item.state === "done",
      category: item.section,
      due: item.due,
      ownerHint: item.ownerHint,
    }));
}

function getRelativeAge(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

function getFileModifiedAge(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return getRelativeAge(stat.mtime.toISOString());
  } catch {
    return null;
  }
}

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  const date = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date - now) / 86400000);
}

// ── Identity ─────────────────────────────────────────────────────────────────

function loadIdentity(federation, toolsMd) {
  const soulMd = readFileSafe(path.join(rootDir, "SOUL.md"));

  const id = federation?.identity || {};

  let mission = "";
  if (soulMd) {
    const missionMatch = soulMd.match(/##\s*Mission[^\n]*\n+([^\n#]+)/i);
    if (missionMatch) {
      mission = missionMatch[1]
        .trim()
        .replace(/^[>_*]+\s*/, "")
        .replace(/[_*]+$/, "");
    }
  }

  let notionWorkspaceUrl = null;
  if (toolsMd) {
    const notionMatch = toolsMd.match(
      /Workspace URL:\s*(https:\/\/(?:www\.)?notion\.so\/[^\s]+)/i,
    );
    if (
      notionMatch &&
      !notionMatch[1].includes("[") &&
      !notionMatch[1].includes("]")
    ) {
      notionWorkspaceUrl = notionMatch[1];
    }
  }

  return {
    name: id.name || "Organizational OS",
    type: id.type || "Organization",
    emoji: id.emoji || "",
    chain: id.chain || null,
    daoURI: id.daoURI || null,
    mission,
    notionUrl: notionWorkspaceUrl,
  };
}

// ── Status ───────────────────────────────────────────────────────────────────

function loadStatus(federation) {
  const memoryDir = path.join(rootDir, "memory");

  let lastMemory = null;
  let lastMemoryAge = null;
  if (fs.existsSync(memoryDir)) {
    const memoryFiles = fs
      .readdirSync(memoryDir)
      .filter((f) => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
      .sort()
      .reverse();
    if (memoryFiles.length > 0) {
      lastMemory = memoryFiles[0].replace(".md", "");
      lastMemoryAge = getFileModifiedAge(path.join(memoryDir, memoryFiles[0]));
    }
  }

  const schemaAge = getFileModifiedAge(
    path.join(rootDir, ".well-known", "dao.json"),
  );

  const peers = federation?.federation?.peers || federation?.peers || [];
  const runtime = federation?.agent?.runtime || "none";
  const skills = federation?.agent?.skills || [];

  return {
    lastMemory,
    lastMemoryAge,
    schemaAge,
    peerCount: Array.isArray(peers) ? peers.length : 0,
    runtime,
    skillCount: skills.length,
    skills: skills,
  };
}

// ── Projects ─────────────────────────────────────────────────────────────────

function loadProjects() {
  const projects = [];

  // From data/projects.yaml
  const projectsData = readYamlSafe(
    path.join(rootDir, "data", "projects.yaml"),
  );
  if (projectsData?.projects) {
    for (const p of projectsData.projects) {
      projects.push({
        name: p.title || p.name || p.id,
        type: p.type || "project",
        stage: p.status || "idea",
        lead: p.lead || null,
        owner: p.owner || p.lead || null,
        description: p.description || "",
        members: p.contributors || p.members || [],
        startDate: p.started || p.startDate || null,
        notionUrl: p.notion_url || null,
        taskCount: 0,
      });
    }
  }

  // From packages/operations/projects/*.md (canonical v2 path)
  for (const projectsDir of [
    path.join(rootDir, "packages", "operations", "projects"),
    path.join(rootDir, "content", "projects"), // fallback for v1 instances
  ]) {
    if (!fs.existsSync(projectsDir)) continue;
    const files = fs.readdirSync(projectsDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const parsed = parseMarkdownFrontmatter(path.join(projectsDir, file));
      if (!parsed) continue;
      const { data, content } = parsed;

      const taskMatches = content.match(/- \[ \]/g);
      const taskCount = taskMatches ? taskMatches.length : 0;

      const projName = data.title || data.name || file.replace(".md", "");
      const existing = projects.find(
        (p) => p.name.toLowerCase() === projName.toLowerCase(),
      );
      if (existing) {
        existing.taskCount = taskCount;
        if (data.notion_url) existing.notionUrl = data.notion_url;
        continue;
      }

      projects.push({
        name: projName,
        type: data.type || "project",
        stage: data.status || "idea",
        lead: data.lead || null,
        owner: data.owner || data.lead || null,
        description: data.description || "",
        members: data.contributors || data.members || [],
        startDate: data.started || data.startDate || null,
        notionUrl: data.notion_url || null,
        taskCount,
      });
    }
  }

  return projects;
}

// ── Tasks (from HEARTBEAT.md) ────────────────────────────────────────────────

function loadTasks() {
  const heartbeat = readFileSafe(path.join(rootDir, "HEARTBEAT.md"));
  if (!heartbeat)
    return { critical: [], urgent: [], upcoming: [], completed: [] };

  const items = extractCheckboxes(heartbeat);

  const critical = [];
  const urgent = [];
  const upcoming = [];
  const completed = [];

  for (const item of items) {
    if (item.done) {
      completed.push(item);
      continue;
    }

    if (item.due) {
      const days = daysUntil(item.due);
      if (days <= 0) {
        critical.push({ ...item, daysLeft: days });
      } else if (days <= 7) {
        urgent.push({ ...item, daysLeft: days });
      } else {
        upcoming.push({ ...item, daysLeft: days });
      }
    } else {
      const cat = item.category.toLowerCase();
      if (cat.includes("fund") || cat.includes("governance")) {
        urgent.push({ ...item, daysLeft: null });
      } else {
        upcoming.push({ ...item, daysLeft: null });
      }
    }
  }

  return { critical, urgent, upcoming, completed };
}

// ── Backlog (from docs/BACKLOG.md) ─────────────────────────────────────────

function loadBacklog() {
  const backlog = readFileSafe(path.join(rootDir, "docs", "BACKLOG.md"));
  if (!backlog) return { total: 0, byStatus: {}, topPriority: [] };

  const items = extractCheckboxes(backlog);
  const open = items.filter((i) => !i.done);

  const byStatus = {};
  const priorityKeywords = [
    "highest priority",
    "high-risk",
    "candidate-integration",
  ];
  const topPriority = [];

  for (const item of open) {
    // Pull status labels from inline brackets like [`needs-review`]
    const text = item.title || item.text || "";
    const labelMatches = text.match(/\[`([a-z][a-z0-9-]*)`\]/gi) || [];
    for (const m of labelMatches) {
      const label = m.replace(/\[`|`\]/g, "");
      byStatus[label] = (byStatus[label] || 0) + 1;
    }
    if (priorityKeywords.some((k) => text.toLowerCase().includes(k))) {
      topPriority.push(item);
    }
  }

  return { total: open.length, byStatus, topPriority: topPriority.slice(0, 3) };
}

// ── Events (from data/events.yaml — v2) ─────────────────────────────────────

function loadEvents() {
  const eventsData = readYamlSafe(path.join(rootDir, "data", "events.yaml"));
  if (!eventsData?.events) return { thisWeek: [], upcoming: [] };

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const events = (eventsData.events || [])
    .filter((e) => e.status !== "cancelled")
    .map((e) => ({
      title: e.title || e.id,
      date: e.date,
      endDate: e.end_date || null,
      type: e.type || "event",
      location: e.location || null,
      url: e.url || null,
      relatedProject: e.related_project || null,
      status: e.status || "upcoming",
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const thisWeek = events.filter((e) => {
    const d = new Date(e.date);
    return d >= weekStart && d < weekEnd;
  });

  const upcomingEvents = events
    .filter((e) => new Date(e.date) >= weekEnd)
    .slice(0, 5);

  return { thisWeek, upcoming: upcomingEvents };
}

// ── Meetings ─────────────────────────────────────────────────────────────────

function loadMeetings() {
  const meetings = [];

  // From data/meetings.yaml (canonical source)
  const meetingsData = readYamlSafe(
    path.join(rootDir, "data", "meetings.yaml"),
  );
  if (meetingsData?.meetings) {
    for (const m of meetingsData.meetings) {
      meetings.push({
        title: m.title || m.id,
        date: m.date,
        type: m.type || "meeting",
        status: "completed",
        participants: m.participants || [],
        notionUrl: null,
      });
    }
  }

  // From packages/operations/meetings/*.md (canonical v2 path)
  for (const meetingsDir of [
    path.join(rootDir, "packages", "operations", "meetings"),
    path.join(rootDir, "content", "meetings"), // fallback for v1
  ]) {
    if (!fs.existsSync(meetingsDir)) continue;
    const files = fs.readdirSync(meetingsDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const parsed = parseMarkdownFrontmatter(path.join(meetingsDir, file));
      if (!parsed) continue;
      const { data } = parsed;
      if (!data.date) continue;

      const mtgTitle = data.title || file.replace(".md", "");
      const existing = meetings.find(
        (m) => m.title.toLowerCase() === mtgTitle.toLowerCase(),
      );
      if (existing) {
        if (data.notion_url) existing.notionUrl = data.notion_url;
        continue;
      }

      meetings.push({
        title: mtgTitle,
        date: data.date,
        type: data.type || "meeting",
        status: data.status || "planned",
        participants: data.participants || [],
        notionUrl: data.notion_url || null,
      });
    }
  }

  meetings.sort((a, b) => new Date(a.date) - new Date(b.date));

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const thisWeek = meetings.filter((m) => {
    const d = new Date(m.date);
    return d >= weekStart && d < weekEnd;
  });

  const upcomingMeetings = meetings
    .filter((m) => new Date(m.date) >= weekEnd)
    .slice(0, 5);

  return { thisWeek, upcoming: upcomingMeetings };
}

// ── Members ──────────────────────────────────────────────────────────────────

function loadMembers() {
  const membersData = readYamlSafe(path.join(rootDir, "data", "members.yaml"));
  return (membersData?.members || []).map((m) => ({
    name: m.name || m.id,
    role: m.role || "member",
    layer: m.layer || null,
    status: m.status || "active",
    joined: m.joined || null,
  }));
}

// ── Funding ──────────────────────────────────────────────────────────────────

function loadFunding(fundingData) {
  // Support both v2 key (funding_opportunities) and v1 key (opportunities)
  const opportunities =
    fundingData?.funding_opportunities || fundingData?.opportunities || [];

  const upcoming = [];
  const active = [];

  for (const opp of opportunities) {
    if (!opp.deadline) {
      if (
        opp.status === "active" ||
        opp.status === "applied" ||
        opp.status === "open"
      ) {
        active.push(opp);
      }
      continue;
    }

    const days = daysUntil(opp.deadline);
    if (days < 0) continue;
    if (opp.status === "applied" || opp.status === "awarded") {
      active.push(opp);
    } else {
      upcoming.push({ ...opp, daysLeft: days });
    }
  }

  upcoming.sort((a, b) => a.daysLeft - b.daysLeft);

  return { upcoming, active };
}

// ── Recent Memory ────────────────────────────────────────────────────────────

function loadRecentMemory() {
  const memoryDir = path.join(rootDir, "memory");
  if (!fs.existsSync(memoryDir)) return [];

  const files = fs
    .readdirSync(memoryDir)
    .filter((f) => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
    .sort()
    .reverse()
    .slice(0, 3);

  const entries = [];
  for (const file of files) {
    const content = readFileSafe(path.join(memoryDir, file));
    if (!content) continue;

    const lines = content
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("#") && !l.startsWith("---"))
      .map((l) => l.replace(/^[-*]\s+/, ""))
      .slice(0, 2)
      .join(" ")
      .trim();

    if (lines) {
      entries.push({
        date: file.replace(".md", ""),
        summary: lines.substring(0, 200),
      });
    }
  }

  return entries;
}

// ── Federation ───────────────────────────────────────────────────────────────

function loadFederation(federation) {
  if (!federation) return null;

  // Support both v3 (federation.peers) and v1 (peers at root) structures
  const fedSection = federation.federation || {};
  const peers = (fedSection.peers || federation.peers || []).map((p) => ({
    name: p.name || p.id,
    url: p.url || p.repository || null,
    role: p.role || null,
    trust: p.trust || null,
  }));

  const upstream = (fedSection.upstream || federation.upstream || []).map(
    (u) => ({
      repository: u.repository || u.url,
      lastSync: u.last_sync || null,
      syncFrequency: u.sync_frequency || null,
    }),
  );

  const knowledgeCommons = federation["knowledge-commons"] || {};
  const agentSection = federation.agent || {};

  const networks = (fedSection.networks || []).map((n) => ({
    name: n.name,
    role: n.role || null,
    url: n.url || null,
  }));

  const repos = (federation.repos || []).map((r) => ({
    name: r.name,
    path: r.path || null,
    url: r.url || null,
    role: r.role || null,
  }));

  return {
    network: fedSection.network || federation.network || null,
    networks,
    identityType: federation.identity?.type || null,
    role: fedSection.role || null,
    peers,
    upstream,
    repos,
    packages: federation.packages || agentSection.packages || {},
    knowledgeCommons: knowledgeCommons.enabled || false,
    knowledgeCommonsProtocol: knowledgeCommons["sync-protocol"] || null,
    publishedDomains: knowledgeCommons["shared-domains"] || knowledgeCommons.published_domains || [],
  };
}

// ── Key Docs ─────────────────────────────────────────────────────────────────

function loadKeyDocs() {
  const docs = [];
  const keyFiles = [
    { path: "MASTERPLAN.md", label: "Strategic vision & agent activations" },
    { path: "HEARTBEAT.md", label: "Active tasks & system health" },
    { path: "docs/BACKLOG.md", label: "Triaged TODO backlog (mirrors master doc §16)" },
    { path: "MEMORY.md", label: "Key decisions & context index" },
    { path: "SOUL.md", label: "Values, mission & voice" },
    { path: "IDENTITY.md", label: "Organization identity & addresses" },
    { path: "USER.md", label: "Operator profile & preferences" },
    { path: "federation.yaml", label: "Network config & integrations" },
    { path: "TOOLS.md", label: "Infrastructure & API endpoints" },
    { path: "data/projects.yaml", label: "Project registry" },
    { path: "data/members.yaml", label: "Member registry" },
    {
      path: "data/funding-opportunities.yaml",
      label: "Funding tracker",
    },
    { path: "data/ideas.yaml", label: "Community ideas pipeline" },
    { path: "data/events.yaml", label: "Events registry" },
  ];

  for (const doc of keyFiles) {
    const fullPath = path.join(rootDir, doc.path);
    if (fs.existsSync(fullPath)) {
      docs.push({
        path: doc.path,
        label: doc.label,
        lastModified: getFileModifiedAge(fullPath),
      });
    }
  }

  return docs;
}

// ── Apps & Workspaces ────────────────────────────────────────────────────────

function loadApps(federation) {
  const packages = federation?.packages || federation?.agent?.packages || {};
  const apps = [];

  // Check for standard org-os packages
  const packageChecks = [
    {
      dir: "packages/dashboard",
      id: "dashboard",
      name: "Dashboard",
      description: "Organizational health overview",
      command: "cd packages/dashboard && npm run dev",
      icon: "📊",
    },
    {
      dir: "packages/ideation-board",
      id: "ideation-board",
      name: "Ideation Board",
      description: "Community ideas pipeline & voting",
      command: "cd packages/ideation-board && npm run dev",
      icon: "💡",
    },
    {
      dir: "packages/aggregator",
      id: "aggregator",
      name: "Aggregator",
      description: "Content aggregation from sources",
      command: "cd packages/aggregator && npm run dev",
      icon: "📰",
    },
    {
      dir: "packages/system-canvas",
      id: "system-canvas",
      name: "System Canvas",
      description: "Obsidian canvas org visualization",
      command: "npm run generate:canvas",
      icon: "🗺️",
    },
    {
      dir: "packages/knowledge-exchange",
      id: "knowledge-exchange",
      name: "Knowledge Exchange",
      description: "Cross-org knowledge sync",
      command: "cd packages/knowledge-exchange && npm run sync",
      icon: "🔄",
    },
    {
      dir: "packages/webapps/task-manager",
      id: "task-manager",
      name: "Task Manager",
      description: "Visual task board from HEARTBEAT.md",
      command: "open packages/webapps/task-manager/index.html",
      icon: "✅",
    },
  ];

  for (const pkg of packageChecks) {
    const pkgPath = path.join(rootDir, pkg.dir);
    if (fs.existsSync(pkgPath)) {
      apps.push({
        id: pkg.id,
        name: pkg.name,
        description: pkg.description,
        command: pkg.command,
        url: null,
        status: "available",
        icon: pkg.icon,
      });
    }
  }

  // Built-in skills as invokable agents
  const builtinAgents = [
    {
      id: "research",
      name: "Research",
      description:
        "Deep research via Feynman — briefs, lit reviews, comparisons",
      command: 'feynman deepresearch "<topic>"',
      icon: "🔍",
    },
    {
      id: "meeting-processor",
      name: "Meeting Processor",
      description: "Process transcripts into structured meeting notes",
      command: '"Process the meeting notes from [date/title]"',
      icon: "📝",
    },
    {
      id: "funding-scout",
      name: "Funding Scout",
      description: "Scan funding opportunities, track deadlines",
      command: '"Scan for new funding opportunities"',
      icon: "💰",
    },
    {
      id: "schema-generator",
      name: "Schema Generator",
      description: "Regenerate EIP-4824 JSON-LD schemas",
      command: "npm run generate:schemas",
      icon: "⚙️",
    },
  ];

  for (const agent of builtinAgents) {
    apps.push({ ...agent, url: null, status: "available" });
  }

  return apps;
}

// ── Git Status ───────────────────────────────────────────────────────────────

function loadGitStatus() {
  try {
    const gitTopLevel = execSync("git rev-parse --show-toplevel 2>/dev/null", {
      cwd: rootDir,
      encoding: "utf-8",
    }).trim();
    if (path.resolve(gitTopLevel) !== path.resolve(rootDir)) {
      return { branch: null, dirty: null, lastCommit: null, lastCommitAge: null, note: "embedded in parent repo" };
    }

    const branch = execSync("git rev-parse --abbrev-ref HEAD 2>/dev/null", {
      cwd: rootDir,
      encoding: "utf-8",
    }).trim();
    const dirty =
      execSync("git status --porcelain 2>/dev/null", {
        cwd: rootDir,
        encoding: "utf-8",
      }).trim().length > 0;
    const logLine = execSync('git log -1 --format="%s|||%ar" 2>/dev/null', {
      cwd: rootDir,
      encoding: "utf-8",
    }).trim();
    const [lastCommit, lastCommitAge] = logLine.split("|||");
    return { branch, dirty, lastCommit, lastCommitAge };
  } catch {
    return null;
  }
}

// ── Skills ───────────────────────────────────────────────────────────────────

function loadSkills() {
  const skillsDir = path.join(rootDir, "skills");
  if (!fs.existsSync(skillsDir)) return [];

  const skills = [];
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillMd = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillMd)) continue;

    const parsed = parseMarkdownFrontmatter(skillMd);
    if (!parsed) continue;

    skills.push({
      name: parsed.data.name || entry.name,
      description: parsed.data.description || "",
    });
  }

  return skills;
}

// ── Pipelines ────────────────────────────────────────────────────────────────

function loadPipelines(fundingData) {
  const pipelines = [];

  // Ideas pipeline
  const ideasData = readYamlSafe(path.join(rootDir, "data", "ideas.yaml"));
  if (ideasData?.ideas) {
    const counts = {};
    for (const idea of ideasData.ideas) {
      const s = idea.status || "surfaced";
      counts[s] = (counts[s] || 0) + 1;
    }
    pipelines.push({
      id: "ideas",
      label: "Ideas",
      stages: ["surfaced", "proposed", "approved", "developing", "hatched"],
      counts,
      total: ideasData.ideas.length,
    });
  }

  // Funding pipeline
  const opportunities =
    fundingData?.funding_opportunities || fundingData?.opportunities || [];
  if (opportunities.length > 0) {
    const counts = {};
    for (const opp of opportunities) {
      const s = opp.status || "monitoring";
      counts[s] = (counts[s] || 0) + 1;
    }
    pipelines.push({
      id: "funding",
      label: "Funding",
      stages: ["monitoring", "researching", "applied", "awarded"],
      counts,
      total: opportunities.length,
    });
  }

  // Knowledge domains pipeline
  const knowledgeData = readYamlSafe(
    path.join(rootDir, "data", "knowledge-manifest.yaml"),
  );
  if (knowledgeData?.knowledge_manifest?.domains) {
    const counts = {};
    for (const domain of knowledgeData.knowledge_manifest.domains) {
      const s = domain.coverage || "stub";
      counts[s] = (counts[s] || 0) + 1;
    }
    pipelines.push({
      id: "knowledge",
      label: "Knowledge",
      stages: ["stub", "partial", "comprehensive"],
      counts,
      total: knowledgeData.knowledge_manifest.domains.length,
    });
  }

  // Plans pipeline
  const plansDir = path.join(rootDir, "docs", "plans");
  if (fs.existsSync(plansDir)) {
    const counts = {};
    const files = fs
      .readdirSync(plansDir)
      .filter((f) => f.endsWith(".md") && f !== "QUEUE.md");
    for (const file of files) {
      const parsed = parseMarkdownFrontmatter(path.join(plansDir, file));
      if (parsed?.data?.status) {
        counts[parsed.data.status] = (counts[parsed.data.status] || 0) + 1;
      }
    }
    pipelines.push({
      id: "plans",
      label: "Plans",
      stages: ["backlog", "queued", "active", "completed"],
      counts,
      total: files.length,
    });
  }

  return pipelines;
}

// ── Plans (from QUEUE.md) ───────────────────────────────────────────────────

function loadPlans() {
  const queueMd = readFileSafe(
    path.join(rootDir, "docs", "plans", "QUEUE.md"),
  );
  if (!queueMd) return { active: [], queued: [], backlog: [], completed: [] };

  const result = { active: [], queued: [], backlog: [], completed: [] };
  let currentSection = null;

  for (const line of queueMd.split("\n")) {
    const sectionMatch = line.match(/^##\s+(Active|Queued|Backlog|Completed)/i);
    if (sectionMatch) {
      currentSection = sectionMatch[1].toLowerCase();
      continue;
    }
    if (!currentSection || !result[currentSection]) continue;

    // Match numbered or bulleted list items: "1. [title](file.md) — description"
    const itemMatch = line.match(
      /^[-*\d.]+\s+\[([^\]]+)\]\(([^)]+)\)\s*[—–-]\s*(.+)/,
    );
    if (itemMatch) {
      result[currentSection].push({
        title: itemMatch[1],
        file: itemMatch[2],
        description: itemMatch[3].trim(),
      });
      continue;
    }
    // Match simple bulleted items: "- [title](file.md) — description"
    const simpleMatch = line.match(/^[-*]\s+\[([^\]]+)\]\(([^)]+)\)\s*[—–-]\s*(.+)/);
    if (simpleMatch) {
      result[currentSection].push({
        title: simpleMatch[1],
        file: simpleMatch[2],
        description: simpleMatch[3].trim(),
      });
    }
  }

  return result;
}

// ── Dashboard Config ────────────────────────────────────────────────────────

function loadDashboardConfig() {
  const config = readYamlSafe(path.join(rootDir, "dashboard.yaml"));
  const defaultSections = {
    header: { show: true, style: "ascii" },
    projects: { show: true },
    tasks: { show: true, show_completed: true },
    calendar: { show: true, days: 7 },
    funding: { show: true, horizon_days: 30 },
    context: { show: true, max_entries: 3 },
    plans: { show: true, queued_preview: 2 },
    pipelines: { show: true },
    apps: { show: true },
    cheatsheet: { show: true },
    federation: { show: true },
    prompt: { show: true, suggestions: 3 },
  };
  if (!config?.sections) return defaultSections;

  // Merge with defaults — preserve order from config
  const merged = {};
  for (const [key, val] of Object.entries(config.sections)) {
    merged[key] = { ...defaultSections[key], ...val };
  }
  return merged;
}

// ── Notion Client (optional) ─────────────────────────────────────────────────

async function fetchNotionData(toolsMd) {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    return { status: "no-key", projects: [], meetings: [], members: [] };
  }

  if (!toolsMd) return null;

  const dbIds = {};
  const projectsMatch = toolsMd.match(/Projects:\s*([a-f0-9-]{32,36})/i);
  const meetingsMatch = toolsMd.match(/Meetings:\s*([a-f0-9-]{32,36})/i);
  const membersMatch = toolsMd.match(/Members:\s*([a-f0-9-]{32,36})/i);

  if (projectsMatch) dbIds.projects = projectsMatch[1];
  if (meetingsMatch) dbIds.meetings = meetingsMatch[1];
  if (membersMatch) dbIds.members = membersMatch[1];

  if (Object.keys(dbIds).length === 0) return null;

  try {
    const { Client } = await import("@notionhq/client");
    const notion = new Client({ auth: apiKey });

    const result = { projects: [], meetings: [], members: [] };

    if (dbIds.projects) {
      try {
        const response = await notion.databases.query({
          database_id: dbIds.projects,
          page_size: 50,
        });
        result.projects = response.results.map((page) => ({
          name: extractNotionTitle(page),
          notionUrl: page.url,
          stage:
            extractNotionSelect(page, "Status") ||
            extractNotionSelect(page, "Stage") ||
            "idea",
          lead:
            extractNotionPerson(page, "Lead") ||
            extractNotionPerson(page, "Owner"),
        }));
      } catch (e) {
        process.stderr.write(`[warn] Notion projects DB: ${e.message}\n`);
      }
    }

    if (dbIds.meetings) {
      try {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 14);

        const response = await notion.databases.query({
          database_id: dbIds.meetings,
          filter: {
            property: "Date",
            date: {
              on_or_after: weekStart.toISOString().split("T")[0],
            },
          },
          sorts: [{ property: "Date", direction: "ascending" }],
          page_size: 20,
        });
        result.meetings = response.results.map((page) => ({
          title: extractNotionTitle(page),
          date: extractNotionDate(page, "Date"),
          notionUrl: page.url,
          type: extractNotionSelect(page, "Type") || "meeting",
        }));
      } catch (e) {
        process.stderr.write(`[warn] Notion meetings DB: ${e.message}\n`);
      }
    }

    return result;
  } catch {
    return null;
  }
}

function extractNotionTitle(page) {
  const props = page.properties || {};
  for (const [, prop] of Object.entries(props)) {
    if (prop.type === "title" && prop.title?.length > 0) {
      return prop.title.map((t) => t.plain_text).join("");
    }
  }
  return "Untitled";
}

function extractNotionSelect(page, propName) {
  const prop = page.properties?.[propName];
  if (!prop) return null;
  if (prop.type === "select") return prop.select?.name || null;
  if (prop.type === "status") return prop.status?.name || null;
  return null;
}

function extractNotionPerson(page, propName) {
  const prop = page.properties?.[propName];
  if (!prop || prop.type !== "people") return null;
  return prop.people?.[0]?.name || null;
}

function extractNotionDate(page, propName) {
  const prop = page.properties?.[propName];
  if (!prop || prop.type !== "date") return null;
  return prop.date?.start || null;
}

// ── Merge Notion + Local ─────────────────────────────────────────────────────

function mergeData(local, notion) {
  if (!notion) return local;

  if (notion.projects?.length > 0) {
    const merged = [...notion.projects];
    for (const localProj of local.projects) {
      const exists = merged.find(
        (p) => p.name.toLowerCase() === localProj.name.toLowerCase(),
      );
      if (!exists) {
        merged.push(localProj);
      } else {
        if (!exists.lead && localProj.lead) exists.lead = localProj.lead;
        if (localProj.taskCount) exists.taskCount = localProj.taskCount;
      }
    }
    local.projects = merged;
  }

  if (notion.meetings?.length > 0) {
    const merged = [...notion.meetings];
    for (const localMeeting of local.meetings.thisWeek) {
      const exists = merged.find(
        (m) => m.title.toLowerCase() === localMeeting.title.toLowerCase(),
      );
      if (!exists) merged.push(localMeeting);
    }
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    local.meetings.thisWeek = merged.filter((m) => {
      const d = new Date(m.date);
      return d >= weekStart && d < weekEnd;
    });
    local.meetings.upcoming = merged
      .filter((m) => {
        const d = new Date(m.date);
        return d >= weekEnd;
      })
      .slice(0, 5);
  }

  return local;
}

// ── Knowledge Commons (org-os-kms) ───────────────────────────────────────────
// Guarded: returns an ASCII section string from the derived KB index, or "" when
// the KB isn't initialized (no data/kb/index.json) or the render module can't
// load. A "" result makes the dashboard render exactly as before.
async function renderKmsSection() {
  try {
    const idxPath = path.join(rootDir, "data", "kb", "index.json");
    if (!fs.existsSync(idxPath)) return "";
    // Relative specifier resolves against this module (scripts/), i.e. repo-root/packages/…
    const { renderDashboardSection } = await import(
      "../packages/org-os-kms/src/render.mjs"
    );
    return renderDashboardSection(JSON.parse(fs.readFileSync(idxPath, "utf-8")));
  } catch {
    return ""; // KB absent or module unavailable — dashboard renders without it
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Read shared files once
  const federationData = readYamlSafe(path.join(rootDir, "federation.yaml"));
  const toolsMd = readFileSafe(path.join(rootDir, "TOOLS.md"));
  const fundingData = readYamlSafe(
    path.join(rootDir, "data", "funding-opportunities.yaml"),
  );

  const warnings = [];
  if (!fundingData) warnings.push("funding-opportunities.yaml failed to parse");

  const identity = loadIdentity(federationData, toolsMd);
  const status = loadStatus(federationData);
  const projects = loadProjects();
  const tasks = loadTasks();
  const backlog = loadBacklog();
  const events = loadEvents();
  const meetings = loadMeetings();
  const funding = loadFunding(fundingData);
  const recentMemory = loadRecentMemory();
  const federation = loadFederation(federationData);
  const apps = loadApps(federationData);
  const git = loadGitStatus();
  const pipelines = loadPipelines(fundingData);
  const plans = loadPlans();

  let state = {
    generated: new Date().toISOString(),
    identity,
    status,
    projects,
    tasks,
    backlog,
    events,
    meetings,
    funding,
    recentMemory,
    federation,
    apps,
    git,
    pipelines,
    plans,
    warnings,
  };

  // Render dashboard immediately with local data
  if (format === "markdown") {
    // org-os-kms: compute the guarded Knowledge Commons section (no-op if KB absent).
    state.kmsSection = await renderKmsSection();
    console.log(renderMarkdown(state));
  } else {
    console.log(JSON.stringify(state, null, 2));
  }

  // Fetch Notion data in parallel (after dashboard is rendered)
  // This ensures dashboard loads fast even if Notion API is slow
  process.stderr.write("[info] Dashboard loaded from local data. Checking Notion API...\n");

  let notionTimeout;
  const notionData = await Promise.race([
    fetchNotionData(toolsMd).then((r) => { clearTimeout(notionTimeout); return r; }),
    new Promise((resolve) => {
      notionTimeout = setTimeout(() => {
        process.stderr.write("[warn] Notion API timed out after 5s — dashboard uses local data only\n");
        resolve(null);
      }, 5000);
    }),
  ]);

  // Report Notion status only to stderr (doesn't block display)
  if (notionData?.status === "no-key") {
    process.stderr.write(
      "[info] NOTION_API_KEY not set — dashboard uses local YAML data only. " +
      "To sync Notion, copy .env.example to .env and add your NOTION_API_KEY.\n"
    );
  } else if (notionData && Object.keys(notionData).length > 0) {
    // Notion data available
    process.stderr.write("[info] ✓ Notion API connected and synced\n");
  } else if (process.env.NOTION_API_KEY) {
    process.stderr.write("[warn] Notion API issue (no data) — using local YAML data. Check database permissions in Notion.\n");
  }
  if (!git) process.stderr.write("[warn] git status unavailable\n");
}

// ── Visual Helpers ───────────────────────────────────────────────────────────

const W = 78; // panel width

function pad(str, len) {
  return str + " ".repeat(Math.max(0, len - str.length));
}

function truncate(str, len) {
  return str.length > len ? str.substring(0, len - 1) + "…" : str;
}

function normalizeOwner(raw) {
  if (!raw) return "—";
  // Extract name from DID URIs like "did:refibcn:luiz-fernando"
  if (raw.startsWith("did:")) return raw.split(":").pop().split("-")[0];
  return raw;
}

function stripMarkdown(str) {
  return str
    .replace(/\*\*([^*]+)\*\*/g, "$1")   // **bold**
    .replace(/\*([^*]+)\*/g, "$1")        // *italic*
    .replace(/__([^_]+)__/g, "$1")        // __bold__
    .replace(/_([^_]+)_/g, "$1")          // _italic_
    .replace(/`([^`]+)`/g, "$1")          // `code`
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](url)
    .replace(/^[-*]\s+/gm, "");           // list markers
}

function safeTruncate(str, len) {
  // Measure visible length (without markdown markers) for truncation decision
  const visible = stripMarkdown(str);
  if (visible.length <= len) return str;

  // Walk the raw string, tracking visible chars consumed
  let visCount = 0;
  let i = 0;
  while (i < str.length && visCount < len - 1) {
    if (str[i] === "*" && str[i + 1] === "*") { i += 2; continue; }
    if (str[i] === "`") { i += 1; continue; }
    visCount++;
    i++;
  }
  let result = str.substring(0, i) + "…";
  // Close any unclosed ** pairs
  const boldCount = (result.match(/\*\*/g) || []).length;
  if (boldCount % 2 !== 0) result += "**";
  // Close any unclosed backtick
  const btCount = (result.match(/`/g) || []).length;
  if (btCount % 2 !== 0) result += "`";
  return result;
}

function renderPanel(contentLines) {
  // Auto-size: fit the widest content line, minimum W
  const maxContent = Math.max(...contentLines.map((l) => l.length));
  const inner = Math.max(W - 2, maxContent + 2);
  let out = `╭${"─".repeat(inner)}╮\n`;
  for (const line of contentLines) {
    out += `│${pad(line, inner)}│\n`;
  }
  out += `╰${"─".repeat(inner)}╯\n`;
  return out;
}

function sectionHeader(title) {
  const dashes = W - title.length - 5;
  return `\n─── ${title} ${"─".repeat(Math.max(3, dashes))}\n\n`;
}

// ── Pipeline Bar Renderer ─────────────────────────────────────────────────

function renderPipelineBar(p) {
  const barTotal = p.stages.reduce((sum, s) => sum + (p.counts[s] || 0), 0);
  const maxCount = Math.max(...p.stages.map((s) => p.counts[s] || 0), 1);
  const barSlots = 4; // fixed mini-bar width per stage

  // Title line
  const totalStr = ` ${barTotal} total`;
  const dashes = W - p.label.length - totalStr.length - 5;
  let out = `  ${p.label} ${"─".repeat(Math.max(3, dashes))}${totalStr}\n`;

  // Inline mini-bars: ███░ stage (N) → ████ stage (N) → ...
  const parts = p.stages.map((s) => {
    const count = p.counts[s] || 0;
    const filled = count === 0 ? 0 : Math.max(1, Math.round((count / maxCount) * barSlots));
    const bar = "█".repeat(filled) + "░".repeat(barSlots - filled);
    return `${bar} ${s} (${count})`;
  });
  out += `  ${parts.join(" → ")}\n`;

  return out;
}

// ── ASCII Banner Generator ───────────────────────────────────────────────────

function generateAsciiBanner(name) {
  // Wide font — 7-char glyphs with ██ strokes for a cleaner, more legible look
  const font = {
    A: ["  ███  ", " ██ ██ ", "███████", "██   ██", "██   ██"],
    B: ["██████ ", "██   ██", "██████ ", "██   ██", "██████ "],
    C: [" ██████", "██     ", "██     ", "██     ", " ██████"],
    D: ["██████ ", "██   ██", "██   ██", "██   ██", "██████ "],
    E: ["███████", "██     ", "█████  ", "██     ", "███████"],
    F: ["███████", "██     ", "█████  ", "██     ", "██     "],
    G: [" ██████", "██     ", "██  ███", "██   ██", " ██████"],
    H: ["██   ██", "██   ██", "███████", "██   ██", "██   ██"],
    I: ["██", "██", "██", "██", "██"],
    J: ["███████", "     ██", "     ██", "██   ██", " █████ "],
    K: ["██  ██ ", "██ ██  ", "████   ", "██ ██  ", "██  ██ "],
    L: ["██     ", "██     ", "██     ", "██     ", "███████"],
    M: ["██   ██", "███ ███", "██ █ ██", "██   ██", "██   ██"],
    N: ["██   ██", "███  ██", "██ █ ██", "██  ███", "██   ██"],
    O: [" █████ ", "██   ██", "██   ██", "██   ██", " █████ "],
    P: ["██████ ", "██   ██", "██████ ", "██     ", "██     "],
    Q: [" █████ ", "██   ██", "██ █ ██", "██  ██ ", " ███ ██"],
    R: ["██████ ", "██   ██", "██████ ", "██  ██ ", "██   ██"],
    S: [" ██████", "██     ", " █████ ", "     ██", "██████ "],
    T: ["███████", "  ██   ", "  ██   ", "  ██   ", "  ██   "],
    U: ["██   ██", "██   ██", "██   ██", "██   ██", " █████ "],
    V: ["██   ██", "██   ██", " ██ ██ ", " ██ ██ ", "  ███  "],
    W: ["██   ██", "██   ██", "██ █ ██", "███ ███", "██   ██"],
    X: ["██   ██", " ██ ██ ", "  ███  ", " ██ ██ ", "██   ██"],
    Y: ["██   ██", " ██ ██ ", "  ███  ", "  ██   ", "  ██   "],
    Z: ["███████", "   ██  ", "  ██   ", " ██    ", "███████"],
    " ": ["   ", "   ", "   ", "   ", "   "],
  };

  let displayName;
  if (name.length <= 10) {
    displayName = name;
  } else {
    // Extract parenthetical abbreviation: "ReFi Barcelona (ReFi BCN)" → "ReFi BCN"
    const parenMatch = name.match(/\(([^)]+)\)/);
    if (parenMatch && parenMatch[1].length <= 10) {
      displayName = parenMatch[1];
    } else {
      const words = name.split(/[\s-]+/).filter((w) => w.length > 0 && !w.startsWith("("));
      if (words.length >= 2) {
        displayName = words.map((w) => w[0]).join("").toUpperCase();
        if (displayName.length < 2) displayName = words.slice(0, 2).join(" ");
      } else {
        displayName = name.substring(0, 10).trim();
      }
    }
  }

  const fullText = displayName.toUpperCase() + "  OS";
  const lines = ["", "", "", "", ""];
  for (const char of fullText) {
    const glyph = font[char] || font[" "];
    for (let row = 0; row < 5; row++) {
      lines[row] += glyph[row] + " ";
    }
  }
  return lines;
}

// ── Markdown Renderer ────────────────────────────────────────────────────────

function renderMarkdown(state) {
  const config = loadDashboardConfig();
  const {
    identity, status, projects, tasks, backlog, events, meetings,
    funding, recentMemory, federation, apps, git, pipelines,
    plans, warnings, kmsSection,
  } = state;
  const today = new Date();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  let out = "";

  // ── Header ──────────────────────────────────────────────────────────────
  if (config.header?.show !== false) {
    const bannerLines = generateAsciiBanner(identity.name || "ORG");
    const rebuilt = [""];
    for (const bl of bannerLines) {
      rebuilt.push("   " + bl);
    }
    rebuilt.push("");

    // Operational stats — compact, useful
    const pending = tasks.critical.length + tasks.urgent.length + tasks.upcoming.length;
    const urgentCount = tasks.critical.length + tasks.urgent.length;
    const taskStr = urgentCount > 0
      ? `${urgentCount} urgent / ${pending} tasks`
      : `${pending} tasks`;

    const allDeadlines = [
      ...(events?.thisWeek || []),
      ...(events?.upcoming || []),
    ].filter((e) => e.type === "deadline" && new Date(e.date) >= today);
    const nearest = allDeadlines[0];
    const deadlineStr = nearest
      ? `Next: ${nearest.date.split("T")[0].slice(5)}`
      : null;

    const fundingCount = (funding?.upcoming?.length || 0) + (funding?.active?.length || 0);

    // Meta line — identity type, git state, Notion
    const meta = [identity.type || "Organization"];
    if (git?.note) meta.push(git.note);
    else if (git?.dirty === false) meta.push("clean");
    else if (git?.dirty === true) meta.push("dirty");
    else meta.push("local");
    if (status.notionConnected) meta.push("Notion \u2197");
    rebuilt.push("   " + meta.join(" \u00b7 "));

    // Stats line — tasks, funding, deadlines, skills, memory
    const statsLine = [
      taskStr,
      fundingCount > 0 ? `${fundingCount} funding` : null,
      deadlineStr,
      status.skillCount > 0 ? `Skills: ${status.skillCount}` : null,
      status.lastMemoryAge ? `Memory: ${status.lastMemoryAge}` : null,
    ].filter(Boolean).join(" · ");

    rebuilt.push("   " + statsLine);
    if (identity.notionUrl) {
      rebuilt.push("   " + identity.notionUrl);
    }
    rebuilt.push("");

    out += renderPanel(rebuilt);
  }

  // ── Projects & Areas ─────────────────────────────────────────────────
  if (config.projects?.show !== false) {
    const areas = projects.filter((p) => p.type === "area");
    const projs = projects.filter((p) => p.type !== "area");

    const stageOrder = ["active", "integrate", "in-progress", "on-going", "planning", "backlog", "paused", "icebox", "idea"];
    const sortByStage = (a, b) =>
      (stageOrder.indexOf(a.stage?.toLowerCase()) ?? 99) -
      (stageOrder.indexOf(b.stage?.toLowerCase()) ?? 99);

    out += sectionHeader("Projects & Areas");

    if (areas.length > 0) {
      out += pad("  AREAS", 34) + pad("OWNER", 10) + "FOCUS\n";
      for (const a of areas.sort(sortByStage)) {
        const icon = a.stage === "active" ? "●" : "○";
        const name = pad(`  ${icon}  ${truncate(stripMarkdown(a.name), 24)}`, 34);
        const owner = pad(truncate(normalizeOwner(a.owner), 8), 10);
        const desc = truncate(stripMarkdown(a.description || ""), 32);
        out += `${name}${owner}${desc}\n`;
      }
      out += "\n";
    }

    if (projs.length > 0) {
      // Filter out archived/done
      const hiddenStages = ["archived", "done", "canceled"];
      const visible = projs.filter(
        (p) => !hiddenStages.includes(p.stage?.toLowerCase()),
      );
      const hidden = projs.filter((p) =>
        hiddenStages.includes(p.stage?.toLowerCase()),
      );

      out += pad("  PROJECTS", 34) + pad("OWNER", 10) + pad("STATUS", 14) + "SUMMARY\n";
      const maxShow = config.projects?.max || 999;
      for (const p of visible.sort(sortByStage).slice(0, maxShow)) {
        const isActive = ["active", "integrate", "in-progress"].includes(p.stage?.toLowerCase());
        const icon = isActive ? "●" : "○";
        const name = pad(`  ${icon}  ${truncate(stripMarkdown(p.name), 24)}`, 34);
        const owner = pad(truncate(normalizeOwner(p.owner), 8), 10);
        const stage = pad(p.stage || "idea", 14);
        const desc = truncate(stripMarkdown(p.description || ""), 18);
        out += `${name}${owner}${stage}${desc}\n`;
      }

      // Visual pipeline
      const pipelineStages = ["backlog", "planning", "in-progress", "integrate"];
      const counts = {};
      const nonPipelineCounts = {};
      for (const p of visible) {
        const s = (p.stage || "idea").toLowerCase();
        if (pipelineStages.includes(s)) {
          counts[s] = (counts[s] || 0) + 1;
        } else {
          nonPipelineCounts[s] = (nonPipelineCounts[s] || 0) + 1;
        }
      }
      const maxCount = Math.max(1, ...Object.values(counts));
      const barScale = 4;

      out += "\n";
      let pipelineRow = "  ";
      for (let i = 0; i < pipelineStages.length; i++) {
        const s = pipelineStages[i];
        const c = counts[s] || 0;
        const barLen = Math.max(0, Math.round((c / maxCount) * barScale));
        const bar = "█".repeat(barLen) + "░".repeat(barScale - barLen);
        const sep = i < pipelineStages.length - 1 ? " → " : "";
        pipelineRow += `${bar} ${s}(${c})${sep}`;
      }
      out += pipelineRow + "\n";

      // Non-pipeline stages + hidden
      const extras = [];
      for (const [k, v] of Object.entries(nonPipelineCounts)) {
        extras.push(`${v} ${k}`);
      }
      if (hidden.length > 0) extras.push(`${hidden.length} archived/done`);
      if (extras.length > 0) out += `  ${extras.join(" · ")}\n`;
    }

    if (areas.length === 0 && projs.length === 0) {
      out += "  No projects yet. Add to data/projects.yaml\n";
    }
  }

  // ── Tasks ───────────────────────────────────────────────────────────────
  if (config.tasks?.show !== false) {
    out += sectionHeader("Tasks");
    const maxPerTier = config.tasks?.max || 8;

    for (const t of tasks.critical.slice(0, maxPerTier)) {
      const due = t.due ? ` (due ${t.due})` : "";
      out += `  ⚡ ${truncate(stripMarkdown(t.text), 60)}${due}    CRITICAL\n`;
    }
    if (tasks.critical.length > maxPerTier) {
      out += `  ... +${tasks.critical.length - maxPerTier} more critical\n`;
    }
    for (const t of tasks.urgent.slice(0, maxPerTier)) {
      const days = t.daysLeft != null ? ` — ${t.daysLeft}d` : "";
      out += `  ◆  ${truncate(stripMarkdown(t.text), 58)}${days}    URGENT\n`;
    }
    if (tasks.urgent.length > maxPerTier) {
      out += `  ... +${tasks.urgent.length - maxPerTier} more urgent\n`;
    }
    const upcomingMax = config.tasks?.max_upcoming || 5;
    for (const t of tasks.upcoming.slice(0, upcomingMax)) {
      out += `  ◇  ${truncate(stripMarkdown(t.text), 68)}\n`;
    }
    if (tasks.upcoming.length > upcomingMax) {
      out += `  ... +${tasks.upcoming.length - upcomingMax} more upcoming\n`;
    }

    if (config.tasks?.show_completed && tasks.completed.length > 0) {
      for (const t of tasks.completed.slice(0, 3)) {
        out += `  ✓  ${truncate(stripMarkdown(t.text), 68)}\n`;
      }
    }

    const pending = tasks.critical.length + tasks.urgent.length + tasks.upcoming.length;
    out += `\n  ${pending} pending · ${tasks.critical.length} critical · ${tasks.completed.length} done\n`;
  }

  // ── Backlog (from docs/BACKLOG.md) ──────────────────────────────────────
  if (config.backlog?.show !== false && backlog && backlog.total > 0) {
    out += sectionHeader("Backlog");
    out += `  ${backlog.total} open · mirrors MASTER.md §16 routing table\n`;
    const statusEntries = Object.entries(backlog.byStatus).sort((a, b) => b[1] - a[1]);
    if (statusEntries.length > 0) {
      out += "\n";
      for (const [label, count] of statusEntries.slice(0, 6)) {
        out += `  ${pad(label, 28)}${count}\n`;
      }
    }
    if (backlog.topPriority.length > 0) {
      out += "\n  TOP PRIORITY\n";
      for (const item of backlog.topPriority) {
        out += `  ◆  ${truncate(stripMarkdown(item.text || item.title || ""), 66)}\n`;
      }
    }
    out += `\n  → triage at docs/BACKLOG.md\n`;
  }

  // ── Calendar (This Week) ────────────────────────────────────────────────
  if (config.calendar?.show !== false) {
    out += sectionHeader("This Week");
    const calDays = config.calendar?.days || 7;

    const weekItems = [
      ...meetings.thisWeek.map((m) => ({ ...m, source: "meeting" })),
      ...(events?.thisWeek || []).map((e) => ({ ...e, source: "event" })),
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);

    for (let i = 0; i < Math.min(calDays, 7); i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      const dayStr = dayNames[day.getDay()];
      const dateNum = String(day.getDate()).padStart(2, " ");
      const isToday = day.toDateString() === today.toDateString();
      const marker = isToday ? "  ← today" : "";

      const dayItems = weekItems.filter(
        (m) => new Date(m.date).toDateString() === day.toDateString(),
      );

      if (dayItems.length > 0) {
        for (const m of dayItems) {
          const link = m.notionUrl || m.url ? `  → ${m.relatedProject || "link"}` : "";
          out += `  ${dayStr} ${dateNum}  │  ■ ${stripMarkdown(m.title)}${link}${marker}\n`;
        }
      } else {
        out += `  ${dayStr} ${dateNum}  │${marker}\n`;
      }
    }

    // Upcoming beyond this week
    const upcomingItems = [
      ...(events?.upcoming || []),
      ...(meetings?.upcoming || []),
    ].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 3);

    if (upcomingItems.length > 0) {
      out += "\n  Coming up:\n";
      for (const item of upcomingItems) {
        const d = new Date(item.date);
        const mon = d.toLocaleString("en", { month: "short" });
        const dateNum = String(d.getDate()).padStart(2, " ");
        const related = item.relatedProject ? `  ${item.relatedProject}` : "";
        out += `  ${mon} ${dateNum}  │  ■ ${stripMarkdown(item.title)}${related}\n`;
      }
    }
  }

  // ── Funding ─────────────────────────────────────────────────────────────
  if (config.funding?.show !== false) {
    const horizon = config.funding?.horizon_days || 30;
    const withinHorizon = funding.upcoming.filter(
      (f) => f.daysLeft <= horizon,
    );

    if (withinHorizon.length > 0 || funding.active.length > 0) {
      out += sectionHeader("Funding");
      for (const f of withinHorizon.slice(0, 8)) {
        const name = stripMarkdown(f.name || f.title || f.fund || f.platform || "Unknown");
        const icon = f.daysLeft <= 7 ? "⚠" : "◇";
        out += `  ${icon}  ${name} — ${f.daysLeft}d left\n`;
      }
      for (const f of funding.active.slice(0, 3)) {
        const name = stripMarkdown(f.name || f.title || f.fund || f.platform || "Unknown");
        out += `  ●  ${name} — ${f.status}\n`;
      }
    }
  }

  // ── Recent Context ──────────────────────────────────────────────────────
  if (config.context?.show !== false && recentMemory.length > 0) {
    out += sectionHeader("Recent Context");
    const max = config.context?.max_entries || 3;
    for (const entry of recentMemory.slice(0, max)) {
      out += `  ${entry.date}: ${truncate(stripMarkdown(entry.summary), 62)}\n`;
    }
  }

  // ── Plans ───────────────────────────────────────────────────────────────
  if (config.plans?.show !== false && plans) {
    out += sectionHeader("Plans");
    if (plans.active.length > 0) {
      out += "  ACTIVE\n";
      for (const p of plans.active) {
        out += `  ●  ${stripMarkdown(p.title)} — ${stripMarkdown(p.description)}\n`;
      }
    }
    const preview = config.plans?.queued_preview || 2;
    if (plans.queued.length > 0) {
      out += "\n  QUEUED" + (plans.queued.length > preview ? ` (next ${preview})` : "") + "\n";
      for (const p of plans.queued.slice(0, preview)) {
        out += `  ○  ${stripMarkdown(p.title)} — ${stripMarkdown(p.description)}\n`;
      }
    }
    const remaining = Math.max(0, plans.queued.length - preview);
    const parts = [];
    if (remaining > 0) parts.push(`+${remaining} more queued`);
    if (plans.backlog.length > 0) parts.push(`${plans.backlog.length} backlog`);
    if (plans.completed.length > 0) parts.push(`${plans.completed.length} completed`);
    if (parts.length > 0) out += `\n  ${parts.join(" · ")}\n`;
  }

  // ── Pipelines ───────────────────────────────────────────────────────────
  if (config.pipelines?.show !== false && pipelines.length > 0) {
    out += sectionHeader("Pipelines");
    for (let i = 0; i < pipelines.length; i++) {
      out += renderPipelineBar(pipelines[i]);
      if (i < pipelines.length - 1) out += "\n";
    }
  }

  // ── Apps & Workspaces ───────────────────────────────────────────────────
  const hiddenApps = config.apps?.hide || [];
  const visibleApps = apps.filter((a) => !hiddenApps.includes(a.id));
  if (config.apps?.show !== false && visibleApps.length > 0) {
    out += sectionHeader("Apps & Workspaces");
    for (const app of visibleApps) {
      const icon = app.icon || " ";
      const name = pad(`  ${icon} ${app.name}`, 22);
      const desc = pad(truncate(app.description, 30), 32);
      out += `${name}${desc}${app.command}\n`;
    }
  }

  // ── Cheatsheet ──────────────────────────────────────────────────────────
  if (config.cheatsheet?.show !== false) {
    out += sectionHeader("Cheatsheet");
    out += "  COMMANDS                            SESSION WORKFLOW\n";
    out += "  ──────────────────────              ──────────────────────────────\n";
    const rows = [
      ["npm run initialize   Dashboard", "/initialize   Open session"],
      ["npm run generate:schemas  Schemas", "/close        Wrap up & commit"],
      ["npm run knowledge    Compile KB", "Tab           Switch plan/build"],
      ["npm run validate:schemas  Validate", "@explore      Quick research"],
    ];
    for (const [left, right] of rows) {
      out += `  ${pad(left, 38)}${right}\n`;
    }
  }

  // ── Knowledge Commons (org-os-kms) ──────────────────────────────────────
  // kmsSection is a self-contained ASCII block (own header + trailing blank line)
  // or "" when the KB isn't initialized; prepend "\n" to match section spacing.
  if (kmsSection) out += "\n" + kmsSection;

  // ── Federation ──────────────────────────────────────────────────────────
  if (config.federation?.show !== false && federation) {
    out += sectionHeader("Federation");

    // Summary line — identity type + networks + knowledge commons
    const summaryParts = [federation.identityType || "Node"];
    if (federation.networks?.length > 0) {
      const networkParts = federation.networks.map((n) =>
        n.role ? `${n.name} (${n.role})` : n.name
      );
      summaryParts.push(networkParts.join(", "));
    } else {
      summaryParts.push(federation.network || "none");
    }
    if (federation.knowledgeCommons) {
      const kcStr = federation.knowledgeCommonsProtocol
        ? `Knowledge Commons: on (${federation.knowledgeCommonsProtocol} sync)`
        : "Knowledge Commons: on";
      summaryParts.push(kcStr);
    }
    out += `  ${summaryParts.join(" · ")}\n`;

    // Upstream
    if (federation.upstream?.length > 0) {
      const up = federation.upstream[0];
      const repoName = up.repository?.split("/").pop() || up.repository;
      out += `  Upstream: ${repoName} · Last sync: ${up.lastSync || "never"}\n`;
    }
    out += "\n";

    // Peer table with trust levels
    if (federation.peers?.length > 0) {
      out += pad("  PEER", 36) + "TRUST\n";
      for (const p of federation.peers) {
        const name = pad(`  ${truncate(p.name, 30)}`, 36);
        out += `${name}${p.trust || "—"}\n`;
      }
    }

    // Repos table
    if (federation.repos?.length > 0) {
      out += "\n";
      out += pad("  REPO", 36) + "ROLE\n";
      for (const r of federation.repos) {
        const name = pad(`  ${truncate(r.name, 30)}`, 36);
        out += `${name}${r.role || "—"}\n`;
      }
    }
  }

  // ── Warnings ────────────────────────────────────────────────────────────
  if (warnings?.length > 0) {
    out += "\n";
    for (const w of warnings) {
      out += `  ⚠  ${w}\n`;
    }
  }

  // ── Session Prompt ──────────────────────────────────────────────────────
  if (config.prompt?.show !== false) {
    out += `\n${"─".repeat(W)}\n\n`;
    out += "  What would you like to work on?\n\n";

    const numSuggestions = config.prompt?.suggestions || 3;
    const suggestions = generateSuggestions(state, numSuggestions);
    if (suggestions.length > 0) {
      out += "  Suggested:\n";
      for (let i = 0; i < suggestions.length; i++) {
        out += `  ${i + 1}. ${suggestions[i]}\n`;
      }
    }
    out += "\n  Or: open an app, run a skill, continue an active plan, or describe a task.\n";
  }

  return out;
}

// ── Contextual Suggestions ──────────────────────────────────────────────────

function generateSuggestions(state, count) {
  const suggestions = [];
  const { tasks, funding, plans, events } = state;

  // Priority 1: Critical/overdue tasks
  for (const t of tasks.critical) {
    const due = t.due ? ` (due ${t.due})` : "";
    suggestions.push(`⚡ ${stripMarkdown(t.text)}${due}`);
  }

  // Priority 2: Upcoming funding deadlines (within 14 days)
  for (const f of (funding?.upcoming || []).slice(0, 2)) {
    if (f.daysLeft <= 14) {
      const name = stripMarkdown(f.name || f.title || f.fund || f.platform || "Funding");
      suggestions.push(`◆  ${name} — ${f.daysLeft}d left`);
    }
  }

  // Priority 3: Active plan next steps
  if (plans?.active) {
    for (const p of plans.active.slice(0, 1)) {
      suggestions.push(`◆  Continue plan: ${p.title}`);
    }
  }

  // Priority 4: Urgent tasks
  for (const t of tasks.urgent.slice(0, 2)) {
    const days = t.daysLeft != null ? ` — ${t.daysLeft}d` : "";
    suggestions.push(`◆  ${stripMarkdown(t.text)}${days}`);
  }

  // Priority 5: Upcoming events
  for (const e of (events?.thisWeek || []).slice(0, 1)) {
    suggestions.push(`◇  Prepare for ${stripMarkdown(e.title)}`);
  }

  // Fallbacks if nothing urgent
  if (suggestions.length === 0) {
    suggestions.push(
      '◇  Review HEARTBEAT tasks',
      '◇  Process latest meeting notes',
      '◇  Scan for funding opportunities',
    );
  }

  return suggestions.slice(0, count);
}

main().catch((err) => {
  console.error("Error during initialization:", err.message);
  process.exit(1);
});
