// test/render-map-html.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderMapHtml, renderPortalIndex } from '../src/render-map-html.mjs';

const FIX = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'map', 'full');
const FAKE_BUNDLE = 'customElements.define("federation-map",class extends HTMLElement{});';

function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'kms-html-'));
  cpSync(FIX, dir, { recursive: true });
  const bundle = join(dir, 'bundle.js');
  writeFileSync(bundle, FAKE_BUNDLE);
  return { dir, bundle };
}

test('writes a self-contained HTML with inlined bundle + inlined map data', () => {
  const { dir, bundle } = scratch();
  const r = renderMapHtml({ dir, bundlePath: bundle, now: '2026-07-19T12:00:00Z' });
  assert.equal(r.ok, true);
  const html = readFileSync(join(dir, 'renders', 'federation-map.html'), 'utf8');
  assert.ok(html.includes(FAKE_BUNDLE), 'bundle inlined');
  assert.ok(html.includes('"full-os"'), 'map data inlined');
  assert.ok(html.includes('<federation-map'), 'element present');
  assert.ok(!html.includes('src='), 'no external fetches — fully offline');
});

test('JSON is script-safe: </script> sequences are escaped', () => {
  const { dir, bundle } = scratch();
  // poison a name with a script-closing sequence
  writeFileSync(join(dir, 'federation.yaml'),
    'identity:\n  name: full-os\ndownstream:\n  - id: evil\n    name: "</script><script>alert(1)</script>"\n');
  renderMapHtml({ dir, bundlePath: bundle, now: '2026-07-19T12:00:00Z' });
  const html = readFileSync(join(dir, 'renders', 'federation-map.html'), 'utf8');
  assert.ok(!html.includes('</script><script>alert(1)'), 'closing sequence neutralized');
});

test('uses vault surface: builder runs with surface=vault', () => {
  const { dir, bundle } = scratch();
  // full fixture's source-systems have no portal_vault; add one to prove the surface switch
  writeFileSync(join(dir, 'data', 'source-systems.yaml'),
    '- id: koi-network\n  title: KOI\n  portal_vault: "obsidian://open?file=koi"\n  portal_web: "/docs/koi"\n');
  renderMapHtml({ dir, bundlePath: bundle, now: '2026-07-19T12:00:00Z' });
  const html = readFileSync(join(dir, 'renders', 'federation-map.html'), 'utf8');
  assert.ok(html.includes('obsidian://open?file=koi'));
  assert.ok(!html.includes('/docs/koi'));
});

test('portal index lists every node with a deep-link into the vault artifact', () => {
  const { dir } = scratch();
  const r = renderPortalIndex({ dir, now: '2026-07-19T12:00:00Z' });
  assert.equal(r.ok, true);
  const md = readFileSync(join(dir, 'renders', 'federation-portals.md'), 'utf8');
  assert.ok(md.includes('[Child](federation-map.html#node=child-os)'));
  assert.ok(md.includes('[KOI Network](federation-map.html#node=koi-network)') || md.includes('#node=koi-network'));
  assert.ok(md.includes('## Instances'), 'grouped by kind');
});

test('portal index is deterministic for fixed now (safe to regenerate)', () => {
  const { dir } = scratch();
  renderPortalIndex({ dir, now: 'T' });
  const a = readFileSync(join(dir, 'renders', 'federation-portals.md'), 'utf8');
  renderPortalIndex({ dir, now: 'T' });
  const b = readFileSync(join(dir, 'renders', 'federation-portals.md'), 'utf8');
  assert.equal(a, b);
});
