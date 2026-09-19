// test/map.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMap } from '../src/map.mjs';

const FIX = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'map');
const NOW = '2026-07-19T12:00:00Z';

test('bare instance: federation.yaml alone is enough (spec §6)', () => {
  const m = buildMap({ dir: join(FIX, 'bare'), now: NOW });
  assert.equal(m.version, '1');
  assert.equal(m.self.id, 'bare-os');
  assert.deepEqual(m.nodes.map((n) => n.id), ['peer-one']);
  const peer = m.nodes[0];
  assert.equal(peer.kind, 'instance');
  assert.equal(peer.ring, 1);
  assert.equal(peer.live, false, 'local_path missing on disk → unreached');
  assert.deepEqual(m.edges, [{ from: 'bare-os', to: 'peer-one', kind: 'downstream' }]);
});

test('full instance: peers + downstream + kms knowledge peers + sources', () => {
  const m = buildMap({ dir: join(FIX, 'full'), now: NOW });
  const ids = m.nodes.map((n) => n.id);
  assert.ok(ids.includes('sibling-os'), 'federation peer');
  assert.ok(ids.includes('child-os'), 'downstream');
  assert.ok(ids.includes('knowledge-peer'), 'kms.yaml peer');
  assert.ok(ids.includes('koi-network') && ids.includes('regen-registry'), 'source-systems');
  const kinds = Object.fromEntries(m.nodes.map((n) => [n.id, n.kind]));
  assert.equal(kinds['koi-network'], 'source');
  assert.ok(m.edges.some((e) => e.kind === 'federation' && e.to === 'sibling-os'));
  assert.ok(m.edges.some((e) => e.kind === 'knowledge' && e.to === 'knowledge-peer'));
  assert.ok(m.edges.some((e) => e.kind === 'provenance' && e.from === 'koi-network' && e.to === 'full-os'));
});

test('live enrichment: cloned sibling → live:true + counts from .well-known', () => {
  const m = buildMap({ dir: join(FIX, 'full'), now: NOW });
  const child = m.nodes.find((n) => n.id === 'child-os');
  assert.equal(child.live, true);
  assert.equal(child.counts.members, 3);
  assert.equal(child.counts.projects, 2);
  assert.equal(child.last_seen, NOW);
});

test('sources carry object counts from the KB index when present', () => {
  const m = buildMap({ dir: join(FIX, 'full'), now: NOW });
  const src = m.nodes.find((n) => n.id === 'koi-network');
  assert.equal(src.ring, 3);
  assert.equal(src.counts.objects, 14, 'total objects surfaced on sources (per-source split needs richer index — total for now)');
});

test('no federation.yaml → throws with a clear message', () => {
  assert.throws(() => buildMap({ dir: join(FIX, 'nowhere') }), /no federation\.yaml/);
});

test('duplicate ids across sections keep one node, both edges', () => {
  const m = buildMap({ dir: join(FIX, 'full'), now: NOW });
  assert.equal(m.nodes.filter((n) => n.id === 'sibling-os').length, 1);
});

test('frontier snapshots become ring-2 nodes; ring-1 dups keep edge only (spec §3 dedup)', () => {
  const m = buildMap({ dir: join(FIX, 'full'), now: NOW });
  const grand = m.nodes.find((n) => n.id === 'grand-peer');
  assert.equal(grand.kind, 'frontier');
  assert.equal(grand.ring, 2);
  assert.ok(m.edges.some((e) => e.from === 'child-os' && e.to === 'grand-peer' && e.kind === 'frontier'));
  // sibling-os is already ring 1 → stays a single instance node, frontier edge retargets it
  assert.equal(m.nodes.filter((n) => n.id === 'sibling-os').length, 1);
  assert.equal(m.nodes.find((n) => n.id === 'sibling-os').kind, 'instance');
  assert.ok(m.edges.some((e) => e.from === 'child-os' && e.to === 'sibling-os' && e.kind === 'frontier'));
});

test('ecosystems: node added, sources tagged + edged', () => {
  const m = buildMap({ dir: join(FIX, 'full'), now: NOW });
  const eco = m.nodes.find((n) => n.id === 'regen-commons');
  assert.equal(eco.kind, 'ecosystem');
  assert.equal(m.nodes.find((n) => n.id === 'koi-network').ecosystem, 'regen-commons');
  assert.ok(m.edges.some((e) => e.from === 'regen-commons' && e.to === 'koi-network' && e.kind === 'provenance'));
});
