// packages/org-os-kms/test/gate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadInstanceGate, buildGateContext, applyGate } from '../src/gate.mjs';

test('buildGateContext: source-systems by ref slug (schema-keyed), boundaries structurally', () => {
  const ctx = buildGateContext([
    { schema: 'source-system', ref: 'data/kb/source-system.yaml#refi-dao-blog', object: { title: 'ReFi Blog', type: 'blog', url: 'https://blog.refidao.com' } },
    { schema: 'public-use-boundary', ref: 'b#x', object: { tier: 'never-publish-without-consent', source_lineage: 'https://x' } },
    { schema: 'resource', ref: 'r#r', object: { title: 'R', type: 'resource' } },
  ]);
  assert.ok(ctx.sourceSystems['refi-dao-blog']); assert.equal(ctx.boundaries.length, 1);
});

test('loadInstanceGate imports the module; missing export is fail-hard; absent config → null', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kms-gate-'));
  writeFileSync(join(dir, 'gate.mjs'), 'export function isPublishable(o){ return o.title === "yes" ? { ok: true } : { ok: false, reason: "no" }; }');
  const gate = await loadInstanceGate(dir, { publish: { gate: 'gate.mjs' } });
  const { passed, rejected } = applyGate(gate, [{ ref: 'x#yes', object: { title: 'yes' } }, { ref: 'x#no', object: { title: 'no' } }], {});
  assert.equal(passed.length, 1); assert.deepEqual(rejected, [{ slug: 'no', reason: 'no' }]);
  writeFileSync(join(dir, 'bad.mjs'), 'export const x = 1;');
  await assert.rejects(loadInstanceGate(dir, { publish: { gate: 'bad.mjs' } }), /isPublishable/);
  assert.equal(await loadInstanceGate(dir, {}), null);
});
