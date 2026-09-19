import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { toOrgOsRegistries, profileManifest, REGISTRY_BINDINGS, LIFECYCLE_BINDINGS } from '../src/bind.mjs';

const here = dirname(fileURLToPath(import.meta.url));

test('binds framework objects to their org-os registries (module)', () => {
  const out = toOrgOsRegistries([
    { type: 'resource', title: 'a' },
    { type: 'source-system', title: 'b' },
    { type: 'mystery', title: 'c' },
  ]);
  assert.ok(out['data/resources.yaml']);
  assert.ok(out['data/source-systems.yaml']);
  assert.ok(out['data/misc.yaml'], 'unknown types fall through to misc');
});

test('profile ships the framework pre-loaded as the default KMS (profile)', () => {
  const m = profileManifest();
  assert.equal(m.default_knowledge_system, '@regen-commons/toolkit-framework');
  // schemas are loaded live from the framework package — proves the binding resolves
  assert.ok(m.schemas.includes('source-system'));
  assert.ok(m.schemas.includes('review-maturity'));
  assert.equal(m.replaceable, true);
  assert.ok(Object.keys(REGISTRY_BINDINGS).length >= 8);
});

test('lifecycle bindings are canonical op-names (initialize/close)', () => {
  assert.deepEqual(LIFECYCLE_BINDINGS.initialize,
    ['config.load', 'index.rebuild', 'review.list', 'render.dashboard', 'render.site']);
  assert.deepEqual(LIFECYCLE_BINDINGS.close,
    ['csis-review', 'bridge', 'emit-contributions', 'federate.check', 'index.rebuild', 'render.site', 'render.dashboard', 'publish', 'sync.push']);
});

test('REGISTRY_BINDINGS keeps all 10 schema targets', () => {
  assert.equal(Object.keys(REGISTRY_BINDINGS).length, 10);
  assert.equal(REGISTRY_BINDINGS['encyclopedia-entry'], 'src/content/docs/kb/');
});

test('profile.yaml stays in sync with bind.mjs (no drift)', () => {
  const profile = yaml.load(readFileSync(join(here, '../profile/profile.yaml'), 'utf8'));
  assert.deepEqual(profile.registry_bindings, REGISTRY_BINDINGS);
  assert.deepEqual(profile.lifecycle_bindings, LIFECYCLE_BINDINGS);
});
