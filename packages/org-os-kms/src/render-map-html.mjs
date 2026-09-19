// src/render-map-html.mjs
// `render map --html` — the vault artifact (spec §5): ONE self-contained HTML with the
// component bundle + map data inlined, openable offline from inside Obsidian. Portals
// use the vault surface (obsidian:// links).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMap } from './map.mjs';

const DEFAULT_BUNDLE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'org-os-federation-map', 'dist', 'federation-map.iife.js',
);

export function renderMapHtml({ dir = '.', out = 'renders/federation-map.html', bundlePath = DEFAULT_BUNDLE, now = new Date().toISOString() } = {}) {
  const map = buildMap({ dir, surface: 'vault', now });
  const bundle = readFileSync(bundlePath, 'utf8');
  // </script> inside inlined JSON/bundle would close our tags early — neutralize.
  const data = JSON.stringify(map).replace(/<\//g, '<\\/');
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${map.self.name} — federation map</title>
<style>body{background:#06080c;margin:0;padding:20px;max-width:980px;margin-inline:auto;font-family:ui-monospace,monospace}
h1{color:#f5c04e;font-size:15px;font-weight:normal}p{color:#5b6472;font-size:11px}</style>
</head><body>
<h1>🔦 ${map.self.name} — federation map</h1>
<federation-map><script type="application/json">${data}</script></federation-map>
<p>generated ${now} · the torch: hover to cast light, click a node to walk toward it · counterpart of the internal note graph</p>
<script>${bundle.replace(/<\//g, '<\\/')}</script>
</body></html>`;
  const outPath = join(dir, out);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);
  return { ok: true, report: { wrote: outPath, nodes: map.nodes.length, edges: map.edges.length } };
}

const KIND_HEADINGS = [['instance', 'Instances'], ['frontier', 'Frontier'], ['source', 'Sources'], ['ecosystem', 'Ecosystems']];

export function renderPortalIndex({ dir = '.', out = 'renders/federation-portals.md', now = new Date().toISOString() } = {}) {
  const map = buildMap({ dir, surface: 'vault', now });
  const lines = [
    `# Federation portals — ${map.self.name}`,
    '',
    `> Doors between the internal note graph and [the torch](federation-map.html). Generated ${now} — regenerate with \`org-os-kms render map html\`. Link to these anchors from any note.`,
  ];
  for (const [kind, heading] of KIND_HEADINGS) {
    const group = map.nodes.filter((n) => n.kind === kind).sort((a, b) => a.id.localeCompare(b.id));
    if (!group.length) continue;
    lines.push('', `## ${heading}`, '');
    for (const n of group) {
      const extras = [n.type, n.live === false && n.kind === 'instance' ? 'unreached' : null].filter(Boolean).join(' · ');
      lines.push(`- [${n.name || n.id}](federation-map.html#node=${encodeURIComponent(n.id)})${extras ? ` — ${extras}` : ''}`);
    }
  }
  const outPath = join(dir, out);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, lines.join('\n') + '\n');
  return { ok: true, report: { wrote: outPath, portals: map.nodes.length } };
}
