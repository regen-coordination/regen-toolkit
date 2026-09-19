import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { initInstance, loadConfig, federateAdd, federateCheck } from '../src/instance.mjs';
import { validateObject } from '../src/index.mjs';
import { loadWorkOrders } from '../src/workorder.mjs';
import { getAdapter } from '../src/storage.mjs';
import yaml from 'js-yaml';

test('init --new stamps the substrate: kb/, .workorders/, kms.yaml, self source-system card', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tf-init-'));
  const res = initInstance({ dir, name: 'test-commons' });
  assert.ok(existsSync(join(dir, 'kb')));
  assert.ok(existsSync(join(dir, '.workorders')));
  const cfg = loadConfig(dir);
  assert.equal(cfg.instance, 'test-commons');
  assert.equal(cfg.adapter, 'kb-folder');
  assert.equal(cfg.target, 'kb');
  // born a federation citizen: its own card exists (stored via the adapter, so
  // it's real inventory — visible to kb index / review, not a loose file) and validates
  const entries = getAdapter('kb-folder').list(join(dir, 'kb'));
  assert.equal(entries.length, 1);
  const card = entries[0].object;
  // self_ref is recorded as the adapter-opaque ref VERBATIM (not a path to
  // parse/join — the contract every adapter, including non-path ones, honors)
  assert.equal(entries[0].ref, cfg.self_ref, 'kms.yaml remembers the self card via an adapter-opaque ref');
  const { valid, errors } = validateObject('source-system', card);
  assert.equal(valid, true, errors.join('; '));
  assert.equal(card.maturity, 'raw', 'draft card until the operator completes it via register-source');
  assert.equal(res.workOrders, 0);
});

test('init --existing also queues the existing corpus as work orders', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tf-init-ex-'));
  const content = join(dir, 'content');
  const sub = join(content, 'docs');
  mkdirSync(sub, { recursive: true });   // build a tiny corpus
  writeFileSync(join(content, 'a.md'), '# A\nprose');
  writeFileSync(join(sub, 'b.md'), '# B\nprose');
  const res = initInstance({ dir, name: 'wrapped', mode: 'existing', existingPath: content });
  assert.equal(res.workOrders, 2);
  assert.equal(loadWorkOrders(join(dir, '.workorders')).length, 2);
});

test('init is idempotent — re-running never clobbers an existing kms.yaml or card', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tf-init-idem-'));
  initInstance({ dir, name: 'once' });
  const before = readFileSync(join(dir, 'kms.yaml'), 'utf8');
  initInstance({ dir, name: 'twice' });
  assert.equal(readFileSync(join(dir, 'kms.yaml'), 'utf8'), before, 'existing config untouched');
  // and the card inventory is still exactly one entry — re-init did not re-stamp
  assert.equal(getAdapter('kb-folder').list(join(dir, 'kb')).length, 1);
});

test('init heals a deleted self card on re-run (self_ref always resolves)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tf-init-heal-'));
  initInstance({ dir, name: 'healable' });
  const cfg = loadConfig(dir);
  const cardPath = cfg.self_ref;            // self_ref is the adapter's ref, verbatim (kb-folder: a file path)
  assert.ok(existsSync(cardPath), `self_ref must resolve to the stored card: ${cfg.self_ref}`);
  rmSync(cardPath);
  initInstance({ dir, name: 'ignored' });
  assert.ok(existsSync(cardPath), 'card re-stamped');
  const cfgAfter = loadConfig(dir);
  assert.equal(cfgAfter.instance, 'healable', 'config identity untouched by heal');
  assert.equal(getAdapter('kb-folder').list(join(dir, cfg.target)).length, 1, 'exactly one card — no duplication');
});

test('init --adapter repo-data: re-init never duplicates the self card (adapter-agnostic presence check)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tf-init-rd-'));
  initInstance({ dir, name: 'rd', adapter: 'repo-data' });
  initInstance({ dir, name: 'rd', adapter: 'repo-data' });
  const cfg = loadConfig(dir);
  assert.equal(cfg.adapter, 'repo-data');
  const cards = getAdapter('repo-data').list(join(dir, cfg.target))
    .filter((e) => e.schema === 'source-system');
  assert.equal(cards.length, 1, 'repo-data refs (`<file>#<slug>`) never resolve as filesystem paths — presence must not be decided by existsSync');
  assert.equal(cfg.self_ref, cards[0].ref);
});

test('init heals a moved/renamed self card without duplication (repoints self_ref, does not re-stamp)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tf-init-rename-'));
  initInstance({ dir, name: 'renameable' });
  const cfg = loadConfig(dir);
  const oldRef = cfg.self_ref;
  const renamed = join(dirname(oldRef), 'renamed-card.yaml');
  renameSync(oldRef, renamed);
  initInstance({ dir, name: 'ignored' });
  const cfgAfter = loadConfig(dir);
  assert.equal(cfgAfter.self_ref, renamed, 'self_ref repointed to the found ref');
  const cards = getAdapter('kb-folder').list(join(dir, cfg.target)).filter((e) => e.schema === 'source-system');
  assert.equal(cards.length, 1, 'moved card found by title, not re-stamped as a duplicate');
});

test('loadConfig throws a clear error on malformed kms.yaml (not a raw YAML parser stack)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tf-badcfg-'));
  writeFileSync(join(dir, 'kms.yaml'), 'foo: [unclosed');
  assert.throws(() => loadConfig(dir), (e) => /kms\.yaml/.test(e.message) && /is not valid YAML/.test(e.message));
});

test('federate add validates a peer card, stores it through the adapter, records it in kms.yaml', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tf-fed-'));
  initInstance({ dir, name: 'home' });
  const peerCard = join(dir, 'peer.yaml');
  writeFileSync(peerCard, yaml.dump({
    title: 'ReFi DAO Commons', type: 'repo', steward: 'ReFi DAO',
    return_path: 'PRs to refi-dao-os', maturity: 'raw', ai_assisted: true,
  }));
  const res = federateAdd({ dir, cardPath: peerCard });
  assert.equal(res.slug, 'refi-dao-commons');
  const cards = getAdapter('kb-folder').list(join(dir, 'kb'))
    .filter((e) => e.schema === 'source-system');
  assert.equal(cards.length, 2, 'self + peer both first-class KB inventory');
  assert.equal(loadConfig(dir).peers['refi-dao-commons'], res.ref);
  // invalid card refuses (nothing stored)
  const bad = join(dir, 'bad.yaml');
  writeFileSync(bad, yaml.dump({ title: 'No Return Path', type: 'repo', steward: 'X' }));
  assert.throws(() => federateAdd({ dir, cardPath: bad }), /return_path/);
  assert.equal(getAdapter('kb-folder').list(join(dir, 'kb')).filter((e) => e.schema === 'source-system').length, 2,
    'refused card left nothing stored');
});

test('federate add refuses a peer card that collides with the instance identity (self-card hijack)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tf-fed-hijack-'));
  initInstance({ dir, name: 'home' });
  const selfBefore = getAdapter('kb-folder').list(join(dir, 'kb'))
    .find((e) => e.schema === 'source-system' && e.object.title === 'home');
  // a VALID card whose title slugs to the instance name — adapters are
  // idempotent by slug, so storing it would silently overwrite the self card
  // (steward/return_path replaced by external content = return-path hijack)
  const evil = join(dir, 'evil.yaml');
  writeFileSync(evil, yaml.dump({
    title: 'home', type: 'repo', steward: 'Mallory',
    return_path: 'exfiltrate to mallory.example', maturity: 'raw', ai_assisted: true,
  }));
  assert.throws(() => federateAdd({ dir, cardPath: evil }), /collides with this instance's own identity/);
  const selfAfter = getAdapter('kb-folder').list(join(dir, 'kb'))
    .find((e) => e.schema === 'source-system' && e.object.title === 'home');
  assert.equal(selfAfter.object.steward, selfBefore.object.steward, 'self card steward untouched');
  assert.equal(selfAfter.object.return_path, selfBefore.object.return_path, 'return path not hijacked');
  assert.equal(loadConfig(dir).peers?.home, undefined, 'no peers.home recorded');
});

test('federate check tolerates an empty/null extensions file (nothing to check = nothing incompatible)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tf-fedchk-empty-'));
  const emptyExt = join(dir, 'empty.yaml');
  writeFileSync(emptyExt, '');
  assert.deepEqual(federateCheck({ extensionsPath: emptyExt }), { compatible: [], incompatible: [] });
});

test('federate check runs fork-compatibility over a peer extensions file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tf-fedchk-'));
  const peerExt = join(dir, 'peer-extensions.yaml');
  writeFileSync(peerExt, yaml.dump({
    entities: {
      'mediation-protocol': { maps_to_core: 'protocol' },
      'vibes-object': {},
    },
  }));
  const res = federateCheck({ extensionsPath: peerExt });
  assert.deepEqual(res.compatible, ['mediation-protocol']);
  assert.deepEqual(res.incompatible, ['vibes-object']);
});

// D1: re-adding a registered peer's (changed) card updates it in place. Peer cards
// carry no id, so a content change used to look like a different object and left a
// hash-suffixed duplicate, with peers.<slug> repointed and the old card orphaned.
for (const adapter of ['kb-folder', 'repo-data']) {
  const cardV1 = { title: 'ReFi DAO Commons', type: 'repo', steward: 'ReFi DAO', return_path: 'PRs to refi-dao-os', maturity: 'raw', ai_assisted: true, url: 'https://refi.example', what_it_curates: 'v1 scope' };
  const setup = (prefix) => {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    initInstance({ dir, name: 'home', adapter });
    const write = (name, obj) => { const p = join(dir, name); writeFileSync(p, yaml.dump(obj)); return p; };
    const peerCards = () => { const cfg = loadConfig(dir); return getAdapter(cfg.adapter).list(join(dir, cfg.target)).filter((e) => e.schema === 'source-system' && e.object.title !== 'home'); };
    return { dir, write, peerCards };
  };

  test(`[${adapter}] federate add of a changed card for a registered peer updates in place (no duplicate, same ref, removed fields gone)`, () => {
    const { dir, write, peerCards } = setup('tf-fed-readd-');
    const first = federateAdd({ dir, cardPath: write('v1.yaml', cardV1) });
    const v2 = { ...cardV1, steward: 'ReFi DAO Stewards' }; delete v2.what_it_curates;
    const second = federateAdd({ dir, cardPath: write('v2.yaml', v2) });
    assert.equal(second.ref, first.ref, 'same ref: updated, not re-issued');
    const cards = peerCards();
    assert.equal(cards.length, 1, 'no hash-suffixed duplicate');
    assert.deepEqual(cards[0].object, v2, 'stored card is the new one, not a merge');
    assert.equal(loadConfig(dir).peers['refi-dao-commons'], first.ref);
  });

  test(`[${adapter}] federate add stays idempotent for an unchanged card`, () => {
    const { dir, write, peerCards } = setup('tf-fed-idem-');
    const p = write('v1.yaml', cardV1);
    const first = federateAdd({ dir, cardPath: p });
    assert.equal(federateAdd({ dir, cardPath: p }).ref, first.ref);
    assert.equal(peerCards().length, 1);
  });

  // The narrowing that keeps B5 alive: only a slug that is a REGISTERED PEER updates
  // in place. A same-slug card that arrived another way (ingest, hand-authored) is a
  // different object and must never be overwritten by `federate add`.
  test(`[${adapter}] federate add never overwrites a same-slug card that is not a registered peer (B5)`, () => {
    const { dir, write, peerCards } = setup('tf-fed-b5-');
    const cfg = loadConfig(dir);
    getAdapter(cfg.adapter).store(join(dir, cfg.target), [{ schema: 'source-system', object: { title: 'ReFi DAO Commons', type: 'wiki', steward: 'Someone Else', return_path: 'their PRs' } }]);
    federateAdd({ dir, cardPath: write('v1.yaml', cardV1) });
    const cards = peerCards();
    assert.equal(cards.length, 2, 'both survive');
    assert.equal(cards.find((c) => c.object.steward === 'Someone Else').object.return_path, 'their PRs', 'the unrelated card is untouched');
  });
}
