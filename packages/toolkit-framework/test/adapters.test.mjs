// test/adapters.test.mjs — the adapter contract. Every shipping adapter passes
// the same assertions; the interface is what this file says it is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdapter } from '../src/storage.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SHIPPING = ['kb-folder', 'repo-data'];
// id is a stable identity for the "same object, re-stored" contract test below
// (B5 fix: a shared title-slug alone no longer implies "same object" — same id does).
const entry = (title = 'Contract Fixture') => ({
  schema: 'source-system',
  object: { id: 'contract-fixture', title, type: 'wiki', steward: 'Suite', return_path: 'PRs', maturity: 'raw', ai_assisted: true },
});

for (const name of SHIPPING) {
  test(`[${name}] store → list → update → index round-trip, idempotent + derived`, () => {
    const target = mkdtempSync(join(tmpdir(), `tf-${name}-`));
    const a = getAdapter(name);
    assert.equal(a.name, name);

    const { stored } = a.store(target, [entry()]);
    assert.equal(stored.length, 1);
    // idempotent by id: a re-store of the SAME object (same id) with a changed field overwrites in place
    a.store(target, [{ ...entry(), object: { ...entry().object, steward: 'Suite v2' } }]);
    assert.equal(a.list(target).length, 1);
    assert.equal(a.list(target)[0].object.steward, 'Suite v2');
    assert.equal(a.list(target)[0].ref, stored[0]);   // list refs identical to store refs

    const upd = a.update(target, stored[0], { maturity: 'plausible' });
    assert.equal(upd.ref, stored[0]);                 // update returns { ref, object }
    assert.equal(upd.object.maturity, 'plausible');
    assert.equal(a.list(target)[0].object.maturity, 'plausible');

    const idx = a.index(target);
    assert.equal(idx.total, 1);
    assert.equal(idx.by_type['source-system'], 1);
    assert.ok(idx.generated_from.includes('derived'));

    const { indexPath, contextPath } = a.writeIndex(target);
    assert.ok(existsSync(indexPath) && existsSync(contextPath));
    // index.json content is real, not just present
    const written = JSON.parse(readFileSync(indexPath, 'utf8'));
    assert.equal(written.total, 1);

    // empty target: list/index degrade gracefully
    const empty = mkdtempSync(join(tmpdir(), `tf-${name}-empty-`));
    assert.deepEqual(a.list(empty), []);
    assert.equal(a.index(empty).total, 0);
  });

  test(`[${name}] non-Latin titles never degenerate to an empty slug`, () => {
    const target = mkdtempSync(join(tmpdir(), `tf-${name}-nl-`));
    const a = getAdapter(name);
    const { stored } = a.store(target, [entry('知识共享')]);
    assert.equal(stored.length, 1);
    assert.equal(a.list(target).length, 1);
    assert.ok(!stored[0].includes('/.yaml') && !stored[0].endsWith('#'), `bad ref: ${stored[0]}`);
  });

  test(`[${name}] store rejects path-escaping schema names`, () => {
    const target = mkdtempSync(join(tmpdir(), `tf-${name}-esc-`));
    const a = getAdapter(name);
    assert.throws(() => a.store(target, [{ schema: '../../evil', object: { title: 'x' } }]), /invalid schema name/);
  });

  test(`[${name}] adapter module is importable as the entry module (no import cycle)`, () => {
    const out = execFileSync('node', ['-e',
      `import('./src/adapters/${name}.mjs').then(m => console.log(Object.values(m)[0].name))`],
      { encoding: 'utf8', cwd: join(here, '..') });
    assert.equal(out.trim(), name);
  });
}

// repo-data-specific: a hand-edited registry file without `entries:` must not crash writes
test('[repo-data] store/update tolerate a legacy registry file lacking entries key', () => {
  const target = mkdtempSync(join(tmpdir(), 'tf-repo-data-legacy-'));
  const a = getAdapter('repo-data');
  mkdirSync(join(target, 'data', 'kb'), { recursive: true });
  writeFileSync(join(target, 'data', 'kb', 'source-system.yaml'), 'foo: bar\n');
  const { stored } = a.store(target, [entry('Legacy Survivor')]);
  assert.equal(stored.length, 1);
  assert.equal(a.list(target).length, 1);
  const { object } = a.update(target, stored[0], { maturity: 'plausible' });
  assert.equal(object.maturity, 'plausible');
});

// repo-data-specific: a registry file whose `entries` is a YAML LIST cannot be
// round-tripped through the mapping model — refusing loudly beats silently
// dropping the list items on the next write.
test('[repo-data] store refuses a registry file whose entries is a list — file left untouched', () => {
  const target = mkdtempSync(join(tmpdir(), 'tf-repo-data-list-'));
  const a = getAdapter('repo-data');
  const file = join(target, 'data', 'kb', 'source-system.yaml');
  mkdirSync(dirname(file), { recursive: true });
  const original = 'entries:\n  - a\n  - b\n';
  writeFileSync(file, original);
  assert.throws(() => a.store(target, [entry('Doomed')]), /non-mapping "entries"/);
  assert.equal(readFileSync(file, 'utf8'), original); // no silent loss: bytes unchanged
});

// repo-data-specific: a scalar doc is not a registry at all — spreading a string
// would leak its character indices into the registry.
test('[repo-data] store refuses a scalar (non-mapping) registry file', () => {
  const target = mkdtempSync(join(tmpdir(), 'tf-repo-data-scalar-'));
  const a = getAdapter('repo-data');
  const file = join(target, 'data', 'kb', 'source-system.yaml');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, 'just a string\n');
  assert.throws(() => a.store(target, [entry('Doomed')]), /not a registry file/);
});

// repo-data-specific: refs are <file>#<slug>; slugs are [a-z0-9-] and never
// contain '#', but the TARGET path may — update must split at the last '#'.
test('[repo-data] update works when the target path itself contains "#"', () => {
  const target = mkdtempSync(join(tmpdir(), 'tf-hash#dir-'));
  const a = getAdapter('repo-data');
  const { stored } = a.store(target, [entry('Hash Path')]);
  const upd = a.update(target, stored[0], { maturity: 'plausible' });
  assert.equal(upd.ref, stored[0]);
  assert.equal(upd.object.maturity, 'plausible');
  assert.equal(a.list(target)[0].object.maturity, 'plausible');
});

// B5: distinct objects that merely share a title-slug must never clobber each
// other in the registry — the newcomer gets a hash-suffixed key and the
// collision is reported, not silently swallowed.
test('[repo-data] B5: distinct objects with the same title-slug do not clobber', () => {
  const target = mkdtempSync(join(tmpdir(), 'tf-repo-data-b5-'));
  const a = getAdapter('repo-data');
  const objA = { title: 'Impact Vault', id: 'obj-a', body: 'first author' };
  const objB = { title: 'Impact Vault', id: 'obj-b', body: 'second author' };
  const res = a.store(target, [{ schema: 'resource', object: objA }, { schema: 'resource', object: objB }]);
  const items = a.list(target).filter((i) => i.schema === 'resource');
  assert.equal(items.length, 2, 'both distinct objects survive');
  assert.deepEqual(items.map((i) => i.object.body).sort(), ['first author', 'second author']);
  assert.equal(res.collisions.length, 1, 'the collision is reported, not silent');
});

test('[repo-data] idempotent: re-storing the same object (same id) stays one entry', () => {
  const target = mkdtempSync(join(tmpdir(), 'tf-repo-data-b5-idem-'));
  const a = getAdapter('repo-data');
  const objA = { title: 'Impact Vault', id: 'obj-a', body: 'v1' };
  a.store(target, [{ schema: 'resource', object: objA }]);
  a.store(target, [{ schema: 'resource', object: { ...objA, body: 'v2' } }]);
  const items = a.list(target).filter((i) => i.schema === 'resource');
  assert.equal(items.length, 1, 'same id overwrites in place');
  assert.equal(items[0].object.body, 'v2');
});

// geo is a registered, documented STUB — the seam Rather's Geo Protocol SDK fills.
// Not in SHIPPING: it must never pass the round-trip; it must fail loudly with docs.
test('[geo] is a documented stub: registered, but every operation throws with the seam docs', () => {
  const geo = getAdapter('geo');
  assert.equal(geo.name, 'geo');
  for (const call of [() => geo.store('x', []), () => geo.list('x'), () => geo.update('x', 'r', {}), () => geo.index('x'), () => geo.writeIndex('x')]) {
    assert.throws(call, /geo adapter is a documented stub[\s\S]*(Geo Protocol|IPFS)/);
  }
});

test('[geo] adapter module is importable as the entry module (no import cycle)', () => {
  const out = execFileSync('node', ['-e',
    "import('./src/adapters/geo.mjs').then(m => console.log(Object.values(m)[0].name))"],
    { encoding: 'utf8', cwd: join(here, '..') });
  assert.equal(out.trim(), 'geo');
});

// D1: `replaces` — the caller holds the opaque ref a previous store() issued for
// this same logical object and wants the new version written THERE (replace, not
// merge, not a hash-suffixed sibling). Objects without an id can't prove identity
// by content once they change, so the caller asserts it.
for (const name of SHIPPING) {
  const card = (over = {}) => ({ title: 'Peer Wiki', type: 'wiki', steward: 'Ana', return_path: 'PRs', url: 'https://a.example', ...over });

  test(`[${name}] store with replaces supersedes the ref in place: one object, removed fields gone, same ref, no collision`, () => {
    const target = mkdtempSync(join(tmpdir(), `tf-${name}-replaces-`));
    const a = getAdapter(name);
    const { stored } = a.store(target, [{ schema: 'source-system', object: card() }]);
    const v2 = card({ steward: 'Ben' }); delete v2.url;
    const res = a.store(target, [{ schema: 'source-system', object: v2, replaces: stored[0] }]);
    assert.deepEqual(res.stored, stored, 'same ref issued back');
    assert.equal(res.collisions.length, 0);
    const items = a.list(target).filter((i) => i.schema === 'source-system');
    assert.equal(items.length, 1, 'no hash-suffixed duplicate');
    assert.deepEqual(items[0].object, v2, 'replaced, not merged: the dropped url is gone');
  });

  test(`[${name}] replaces never licenses clobbering a different object`, () => {
    const target = mkdtempSync(join(tmpdir(), `tf-${name}-replaces-other-`));
    const a = getAdapter(name);
    const { stored: [beta] } = a.store(target, [{ schema: 'source-system', object: card({ title: 'Beta Garden', steward: 'Beta Steward' }) }]);
    // a stale/wrong ref: it points at Beta, but the entry is Alpha
    a.store(target, [{ schema: 'source-system', object: card({ title: 'Alpha Garden' }), replaces: beta }]);
    const items = a.list(target).filter((i) => i.schema === 'source-system');
    assert.equal(items.length, 2, 'Alpha stored on its own key');
    assert.equal(items.find((i) => i.object.title === 'Beta Garden').object.steward, 'Beta Steward', 'Beta untouched');
  });

  test(`[${name}] replaces pointing outside this target's schema location is ignored (no write there)`, () => {
    const target = mkdtempSync(join(tmpdir(), `tf-${name}-replaces-escape-`));
    const outside = mkdtempSync(join(tmpdir(), `tf-${name}-outside-`));
    const sentinel = join(outside, 'peer-wiki.yaml');
    writeFileSync(sentinel, 'sentinel: true\n');
    const foreign = name === 'kb-folder' ? sentinel : `${sentinel}#peer-wiki`;
    const a = getAdapter(name);
    a.store(target, [{ schema: 'source-system', object: card(), replaces: foreign }]);
    assert.equal(readFileSync(sentinel, 'utf8'), 'sentinel: true\n', 'foreign file untouched');
    assert.equal(a.list(target).filter((i) => i.schema === 'source-system').length, 1, 'stored normally in-target');
  });
}
