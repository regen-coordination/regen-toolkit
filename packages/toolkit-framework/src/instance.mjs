// src/instance.mjs — replication (design spec §6a): one command from empty dir
// (or existing content) to a working, ingestable, federation-ready KB instance.
//
// Design note (self-card placement): the self source-system card is stored
// THROUGH the storage adapter (adapter.store + writeIndex), not as a loose file
// at kb/self.source-system.yaml. The kb-folder adapter's list()/index() only
// see objects/<schema>/*.yaml — a loose file would be invisible to `kb index`
// and to review/promote, i.e. the instance would NOT actually be a federation
// citizen from the adapter's point of view. Storing via the adapter means the
// card is real inventory from birth (kb index → total 1). Peer cards (federate
// add, below) get the identical treatment — same visibility principle, applied
// twice: peers are first-class KB inventory, not a loose kb/federation/ folder.
//
// Design note (self_ref / peers.<slug> are adapter-opaque, NOT paths): refs are
// adapter-opaque tokens (storage.mjs contract — kb-folder issues file paths,
// repo-data issues `<file>#<slug>`). kms.yaml stores them EXACTLY as the adapter
// issued them. Never parse a ref, join() it against `dir`, or resolve it as a
// path outside the adapter. Card PRESENCE/staleness is decided by asking the
// adapter itself (findSelfCard, below) — never by existsSync on a derived path,
// which broke under adapters whose refs aren't filesystem paths (e.g. repo-data).
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import yaml from 'js-yaml';
import { prepare } from './ingest.mjs';
import { getAdapter } from './storage.mjs';
import { validateObject, isForkCompatible } from './index.mjs';
import { slugify } from './util.mjs';

export function loadConfig(dir = '.') {
  const p = join(dir, 'kms.yaml');
  if (!existsSync(p)) return null;
  try {
    return yaml.load(readFileSync(p, 'utf8'));
  } catch (e) {
    if (e instanceof yaml.YAMLException) {
      throw new Error(`kms.yaml is not valid YAML (fix or remove it): ${p} — ${e.message}`);
    }
    throw e;
  }
}

/**
 * Adapter-agnostic self-card lookup: is this instance's own source-system card
 * present in the adapter's inventory? Matches on the object itself (schema +
 * title) via the adapter's list() — never by resolving a ref as a path, since
 * refs are opaque and not all adapters issue filesystem paths (repo-data).
 */
function findSelfCard(adapter, targetDir, instance) {
  return adapter.list(targetDir).find((e) => e.schema === 'source-system' && e.object.title === instance) || null;
}

export function initInstance({ dir, name = null, mode = 'new', existingPath = null, adapter = 'kb-folder', target = 'kb' }) {
  // An existing kms.yaml is the instance's identity — re-init never renames it.
  const cfg = loadConfig(dir);
  const instance = cfg?.instance || name || basename(resolve(dir));
  const useAdapter = cfg?.adapter || adapter;
  const useTarget = cfg?.target || target;
  mkdirSync(join(dir, useTarget), { recursive: true });
  mkdirSync(join(dir, '.workorders'), { recursive: true });

  const a = getAdapter(useAdapter);
  const targetPath = join(dir, useTarget);
  // Presence is decided adapter-agnostically (see design note above) — a truly
  // missing self card gets healed (re-stamped); a merely moved/renamed one is
  // found by the adapter's own list() and self_ref is repointed, not duplicated.
  const found = findSelfCard(a, targetPath, instance);

  if (!found) {
    // Born a federation citizen: the instance's own source-system card (draft —
    // the operator completes steward/return_path via the register-source skill).
    const card = {
      title: instance, type: 'repo', steward: instance,
      return_path: 'unset — complete via the register-source skill',
      maturity: 'raw', lifecycle_state: 'raw-lead', ai_assisted: true,
      notes: 'Self card created by init. Complete steward, return_path, reuse_conditions, how_to_credit before federating.',
    };
    // Validate before persisting (same discipline as acceptWorkOrder) — schema
    // drift must fail loudly, not silently stamp invalid cards into every instance.
    const v = validateObject('source-system', card);
    if (!v.valid) throw new Error(`self card invalid — framework bug or schema drift:\n  - ${v.errors.join('\n  - ')}`);

    const { stored } = a.store(targetPath, [{ schema: 'source-system', object: card }]);
    a.writeIndex(targetPath);
    const selfRef = stored[0]; // adapter-opaque — stored VERBATIM, never relative()'d or joined

    if (!cfg) {
      writeFileSync(join(dir, 'kms.yaml'), yaml.dump({
        instance, adapter: useAdapter, target: useTarget,
        self_ref: selfRef,
        peers: {},
        framework: '@regen-commons/toolkit-framework',
      }));
    } else if (cfg.self_ref !== selfRef) {
      // Heal re-stamped the missing card: update ONLY self_ref — every other
      // config key (including peers) stays exactly as the operator left it.
      writeFileSync(join(dir, 'kms.yaml'), yaml.dump({ ...cfg, self_ref: selfRef }));
    }
  } else if (cfg && cfg.self_ref !== found.ref) {
    // The card exists (the adapter says so) but self_ref is stale — moved,
    // renamed, or a legacy/relative-path ref from an older kms.yaml. Repoint to
    // whatever the adapter issues NOW, verbatim — do not re-stamp a duplicate.
    writeFileSync(join(dir, 'kms.yaml'), yaml.dump({ ...cfg, self_ref: found.ref }));
  }

  let workOrders = 0;
  if (mode === 'existing') {
    if (!existingPath) throw new Error('init --existing requires a content path');
    workOrders = prepare({ path: existingPath, workOrdersDir: join(dir, '.workorders') }).created.length;
  }
  return { instance, dir, workOrders };
}

/**
 * The federation handshake, part 1 (design spec §6a): register a peer KB.
 * Validate its source-system card, then store it through THIS instance's own
 * adapter — same visibility principle as the self card: a peer is first-class
 * KB inventory (visible to kb index/review/site), not a loose federation/ file.
 * Validation happens before any write, so an invalid card leaves kms.yaml and
 * the KB untouched (nothing partially stored).
 */
export function federateAdd({ dir, cardPath }) {
  const cfg = loadConfig(dir);
  if (!cfg) throw new Error(`not an initialized instance (no kms.yaml): ${dir} — run init first`);
  const card = yaml.load(readFileSync(cardPath, 'utf8'));
  const { valid, errors } = validateObject('source-system', card);
  if (!valid) throw new Error(`peer card invalid:\n  - ${errors.join('\n  - ')}`);
  const slug = slugify(card.title);
  // A peer card slugging to the instance's own name must never reach the adapter:
  // it would be a same-slug object next to the self card, and a peer that can pass
  // for us is a return-path hijack (external content standing in for our
  // steward/return_path). A peer can never be us; refuse before any write.
  if (slug === slugify(cfg.instance)) {
    throw new Error(`peer card collides with this instance's own identity ("${card.title}") — a peer cannot replace the self card`);
  }
  const a = getAdapter(cfg.adapter);
  const targetDir = join(dir, cfg.target);
  // Re-adding a REGISTERED peer updates its card in place: peer cards carry no id, so
  // without the hint a changed card reads as a different object (B5) and leaves a
  // hash-suffixed duplicate. Only a slug we registered gets the hint — a same-slug card
  // that arrived any other way stays a distinct object and is never overwritten here.
  const { stored } = a.store(targetDir, [{ schema: 'source-system', object: card, replaces: (cfg.peers || {})[slug] }]);
  a.writeIndex(targetDir);
  const peers = { ...(cfg.peers || {}), [slug]: stored[0] };
  writeFileSync(join(dir, 'kms.yaml'), yaml.dump({ ...cfg, peers }));
  return { slug, ref: stored[0] };
}

/**
 * The federation handshake, part 2: does a peer's ontology extension set compose
 * with ours? Fork-compatibility (isForkCompatible, K4) over a peer-published
 * extensions file shaped `{ entities: { <name>: { maps_to_core } } }`.
 * A missing file throws a clear error; an empty/null doc means nothing to
 * check — { compatible: [], incompatible: [] }, i.e. vacuously compatible.
 */
export function federateCheck({ extensionsPath }) {
  if (!existsSync(extensionsPath)) throw new Error(`peer extensions file not found: ${extensionsPath}`);
  const doc = yaml.load(readFileSync(extensionsPath, 'utf8')) || {};
  const compatible = []; const incompatible = [];
  for (const [name, def] of Object.entries(doc.entities || {})) {
    (isForkCompatible(def) ? compatible : incompatible).push(name);
  }
  return { compatible, incompatible };
}
