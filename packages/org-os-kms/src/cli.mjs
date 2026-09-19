#!/usr/bin/env node
// src/cli.mjs
// Thin zero-dep CLI. dispatch(argv, {dry}) is unit-testable: with dry:true it only parses +
// routes; without it, it executes. Framework-style hand-rolled --flag value parsing.
import { runLifecycle } from './executor.mjs';
import { bridge } from './registry-bridge.mjs';
import { renderDashboardSection, renderSiteData } from './render.mjs';
import { addPeer, checkPeers, contribute } from './federate.mjs';
import { promote } from './promote.mjs';
import { loadKmsConfig } from './config.mjs';
import { buildMap } from './map.mjs';
import { renderMapHtml, renderPortalIndex } from './render-map-html.mjs';
import { fetchFrontier } from './frontier.mjs';
import { OPS } from './ops.mjs';
import * as fw from './framework.mjs';
import { fileURLToPath } from 'node:url';
import { resolve, join, dirname as pathDirname } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const VERBS = new Set(['lifecycle', 'bridge', 'render', 'federate', 'promote', 'init', 'publish', 'ingest']);

function parseFlags(argv) {
  const args = [], flags = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) { args.push(t); continue; }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) flags[t.slice(2)] = true; else { flags[t.slice(2)] = next; i++; }
  }
  return { args, flags };
}

export function dispatch(argv, opts = {}) {
  const [verb, ...rest] = argv;
  const { args, flags } = parseFlags(rest);
  if (!VERBS.has(verb)) return { error: `unknown verb: ${verb}` };
  if (opts.dry) return { verb, args, flags };

  const dir = flags.dir || '.';
  switch (verb) {
    case 'lifecycle': return runLifecycle(args[0], { dir });
    case 'bridge':    return bridge({ dir, config: loadKmsConfig(dir) });
    case 'render': {
      if (args[0] === 'map') {
        if (args[1] === 'html') {
          const now = new Date().toISOString(); // one timestamp → artifact + index stay in sync
          const html = renderMapHtml({ dir, out: flags.out || 'renders/federation-map.html', now });
          const portals = renderPortalIndex({ dir, now });
          return { ok: true, report: { ...html.report, portals: portals.report.wrote } };
        }
        // No loadKmsConfig here — the map degrades gracefully without kms.yaml (spec §6).
        const map = buildMap({ dir, surface: flags.surface || 'web' });
        const out = join(dir, flags.out || 'data/kb/map.json');
        mkdirSync(pathDirname(out), { recursive: true });
        writeFileSync(out, JSON.stringify(map, null, 2));
        return { ok: true, report: { wrote: out, nodes: map.nodes.length, edges: map.edges.length } };
      }
      const cfg = loadKmsConfig(dir);
      if (args[0] === 'site') return renderSiteData({ dir, target: cfg.target, outPath: (cfg.render && cfg.render.site_data) || 'src/data/kms-index.json' });
      const a = fw.getAdapter(cfg.adapter);
      return { section: renderDashboardSection(a.index(join(dir, cfg.target))) };
    }
    case 'federate': {
      if (args[0] === 'add')      return addPeer({ dir, cardPath: flags.card });
      if (args[0] === 'check')    return checkPeers({ dir, config: loadKmsConfig(dir) });
      if (args[0] === 'contribute') return contribute({ dir, slug: flags.peer });
      if (args[0] === 'frontier') return fetchFrontier({ dir });
      return { error: `federate: unknown subcommand ${args[0]}` };
    }
    case 'promote':   return promote({ from: flags.from || '.', to: flags.to });
    case 'init':      return fw.initInstance({ dir, name: flags.name, adapter: flags.adapter || 'repo-data', target: flags.target || '.' });
    case 'publish':   return OPS.publish.run({ dir, flags: { dry: flags.dry === true, apply: flags.apply === true } });
    case 'ingest':    return OPS['ingest.pull'].run({ dir, flags: { dry: flags.dry === true, connector: flags.connector } });
  }
}

// Process exit code for a verb's result. `{error}` (unknown verb / bad subcommand) always fails; `publish` and
// `ingest` also fail on `{ok:false}` (operator errors, failed publish, refused mass delete). Other verbs keep
// their existing behaviour: some (e.g. render) return fail-soft `ok:false` deliberately.
const FAIL_ON_NOT_OK = new Set(['publish', 'ingest']);
export function exitCodeFor(verb, result) {
  if (result && result.error) return 1;
  if (FAIL_ON_NOT_OK.has(verb) && result && result.ok === false) return 1;
  return 0;
}

// Entry point when run directly (robust to relative argv + spaces/encoding in the path).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await dispatch(process.argv.slice(2));
    console.log(JSON.stringify(result, null, 2));
    const code = exitCodeFor(process.argv[2], result); // {error} (unknown verb / bad subcommand) or publish/ingest ok:false
    if (code) process.exit(code);
  } catch (e) {
    console.error(`✗ ${e.message}`);              // clean message, not a raw stack trace
    process.exit(1);
  }
}
