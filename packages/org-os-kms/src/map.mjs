// src/map.mjs
// buildMap() — the map.json aggregation (spec §3). Tolerant of every input except
// federation.yaml itself; degradation table in spec §6. Pure filesystem reads, no
// network — frontier data comes pre-fetched from data/federation/frontier/ (P2).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

function readYaml(p) { try { return yaml.load(readFileSync(p, 'utf8')); } catch { return null; } }
function readJson(p) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } }
function firstArray(x) {
  if (Array.isArray(x)) return x;
  if (x && typeof x === 'object') return Object.values(x).find(Array.isArray) || [];
  return [];
}

export function buildMap({ dir = '.', surface = 'web', now = new Date().toISOString() } = {}) {
  const fed = readYaml(join(dir, 'federation.yaml'));
  if (!fed || !fed.identity || !fed.identity.name) throw new Error(`no federation.yaml with identity in: ${dir}`);
  const self = {
    id: fed.identity.name, name: fed.identity.name, type: fed.identity.type || null,
    emoji: fed.identity.emoji || null, url: fed.hub || null,
  };
  const nodes = [], edges = [], seen = new Map(); // id → node
  const edgeKeys = new Set();
  const addEdge = (from, to, kind) => {
    const k = `${from}→${to}:${kind}`;
    if (!edgeKeys.has(k)) { edgeKeys.add(k); edges.push({ from, to, kind }); }
  };
  const addNode = (n) => { if (!seen.has(n.id)) { seen.set(n.id, n); nodes.push(n); } return seen.get(n.id); };

  // ── ring 1: instances from federation.yaml ──────────────────────────────────
  const instance = (entry, edgeKind) => {
    const id = entry.id || entry.name;
    if (!id || id === self.id) return;
    const localAbs = entry.local_path ? join(dir, entry.local_path) : null;
    const live = !!(localAbs && existsSync(localAbs));
    const counts = {};
    if (live) {
      const members = readJson(join(localAbs, '.well-known', 'members.json'));
      if (Array.isArray(members?.members)) counts.members = members.members.length;
      const projects = readJson(join(localAbs, '.well-known', 'projects.json'));
      if (Array.isArray(projects?.projects)) counts.projects = projects.projects.length;
    }
    addNode({
      id, kind: 'instance', name: entry.name || id, type: entry.type || null, ring: 1,
      trust: entry.trust || null, live, url: entry.url || null, repo: entry.repo || null,
      counts, last_seen: live ? now : null,
    });
    addEdge(self.id, id, edgeKind);
  };
  for (const p of fed.peers || []) instance(p, 'federation');
  for (const u of fed.upstream || []) instance(u, 'upstream');
  for (const d of fed.downstream || []) instance(d, 'downstream');

  // ── ring 1: knowledge peers from kms.yaml (optional) ────────────────────────
  const kms = readYaml(join(dir, 'kms.yaml'));
  for (const slug of Object.keys(kms?.peers || {})) {
    addNode({ id: slug, kind: 'instance', name: slug, type: null, ring: 1, trust: null,
      live: false, url: null, repo: null, counts: {}, last_seen: null });
    addEdge(self.id, slug, 'knowledge');
  }

  // ── ring 3: sources from data/source-systems.yaml + KB index (optional) ─────
  const kb = readJson(join(dir, 'data', 'kb', 'index.json'));
  for (const s of firstArray(readYaml(join(dir, 'data', 'source-systems.yaml')))) {
    const id = s.id || s.title;
    if (!id) continue;
    const counts = {};
    if (kb && typeof kb.total === 'number') counts.objects = kb.total;
    addNode({ id, kind: 'source', name: s.title || id, type: null, ring: 3,
      ecosystem: s.ecosystem || null, url: s.url || null, counts,
      portal: (surface === 'vault' ? s.portal_vault : s.portal_web) || null });
    addEdge(id, self.id, 'provenance');
  }

  // ── ring 3: curated ecosystems (optional; P2 populates data/ecosystems.yaml) ─
  const eco = readYaml(join(dir, 'data', 'ecosystems.yaml'));
  for (const e of eco?.ecosystems || []) {
    if (!e.id) continue;
    addNode({ id: e.id, kind: 'ecosystem', name: e.name || e.id, type: null, ring: 3,
      url: e.url || null, counts: {} });
    for (const sid of e.sources || []) {
      if (seen.has(sid)) { seen.get(sid).ecosystem = e.id; addEdge(e.id, sid, 'provenance'); }
    }
  }

  // ── ring 2: frontier from cached snapshots (optional; written by P2 op) ─────
  const frontierDir = join(dir, 'data', 'federation', 'frontier');
  if (existsSync(frontierDir)) {
    for (const f of readdirSync(frontierDir).filter((f) => f.endsWith('.json'))) {
      const owner = f.replace(/\.json$/, '');
      if (!seen.has(owner)) continue; // snapshot for a peer we no longer list
      const snap = readJson(join(frontierDir, f));
      for (const p of snap?.peers || []) {
        const pid = p.id || p.name;
        if (!pid || pid === self.id) continue;
        if (!seen.has(pid)) {
          addNode({ id: pid, kind: 'frontier', name: p.name || pid, type: p.type || null,
            ring: 2, live: false, url: p.url || null, repo: p.repo || null, counts: {} });
        }
        addEdge(owner, pid, 'frontier'); // ring-1 dup → edge retargets existing node (spec §3 dedup)
      }
    }
  }

  return { version: '1', generated_at: now, self, nodes, edges };
}
