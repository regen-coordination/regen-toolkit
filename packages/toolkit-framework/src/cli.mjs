#!/usr/bin/env node
// toolkit-framework CLI — zero-dep argv parsing (portable, no build step).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import yaml from 'js-yaml';
import { listSchemas, validateObject, isValid, validateKernel, toJsonLdContext } from './index.mjs';
import { parseCsv, liftRows } from './lift.mjs';
import { prepare, acceptWorkOrder } from './ingest.mjs';
import { loadWorkOrders, loadWorkOrder, transition, saveWorkOrder } from './workorder.mjs';
import { getAdapter } from './storage.mjs';
import { reviewQueue, promote } from './review.mjs';
import { initInstance, loadConfig, federateAdd, federateCheck } from './instance.mjs';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const [cmd, ...args] = process.argv.slice(2);

// zero-dep flag parsing: pull `--flag value` pairs out of args, leave positionals
function parseFlags(rawArgs, defaults = {}) {
  const flags = { ...defaults };
  const positional = [];
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i].startsWith('--')) { flags[rawArgs[i].slice(2)] = rawArgs[i + 1]; i++; }
    else positional.push(rawArgs[i]);
  }
  return { flags, positional };
}

// work-order ids come from user argv and become file paths — validate the shape
function requireWoId(id, usage) {
  if (!id || !/^wo-[0-9a-f]{12}$/.test(id)) { console.error(usage); process.exit(2); }
  return id;
}

// config-reading verbs (store/kb/review/init) must surface a malformed kms.yaml
// as a clean "✗ message" + exit 1 — never a raw stack trace from loadConfig().
function loadConfigOrExit(dir) {
  try { return loadConfig(dir) || {}; }
  catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }
}

switch (cmd) {
  case 'version':
  case '--version':
  case '-v':
    console.log(version);
    break;

  case 'list-schemas':
    console.log(listSchemas().join('\n'));
    break;

  case 'check-state': {
    // check-state <axis> <value>  — validate a value against the K1 canonical model
    const [axis, value] = args;
    if (!axis || !value) { console.error('usage: toolkit-framework check-state <axis> <value>'); process.exit(2); }
    if (isValid(axis, value)) { console.log(`✓ "${value}" is a valid ${axis}`); }
    else { console.error(`✗ "${value}" is not a valid ${axis}`); process.exit(1); }
    break;
  }

  case 'kernel-check': {
    const { valid, errors } = validateKernel();
    if (valid) { console.log('✓ kernel consistent (every extension maps to a real core type)'); }
    else { console.error(`✗ kernel inconsistent:\n  - ${errors.join('\n  - ')}`); process.exit(1); }
    break;
  }

  case 'context': {
    // emit the JSON-LD @context generated from the kernel
    console.log(JSON.stringify(toJsonLdContext(), null, 2));
    break;
  }

  case 'lift': {
    // lift <crosswalk.csv> -> resources YAML (crosswalk-driven; raw leads never auto-promoted)
    const [file] = args;
    if (!file) { console.error('usage: toolkit-framework lift <crosswalk.csv>'); process.exit(2); }
    const { resources, skipped } = liftRows(parseCsv(readFileSync(file, 'utf8')));
    console.error(`lifted ${resources.length} resources; skipped ${skipped.length} noisy rows`);
    console.log(yaml.dump({ resources }));
    break;
  }

  case 'validate': {
    // validate <schema> <file.yaml|json>
    const [schemaName, file] = args;
    if (!schemaName || !file) { console.error('usage: toolkit-framework validate <schema> <file.yaml|json>'); process.exit(2); }
    const obj = yaml.load(readFileSync(file, 'utf8'));
    const { valid, errors } = validateObject(schemaName, obj);
    if (valid) { console.log(`✓ valid (${schemaName})`); }
    else { console.error(`✗ invalid (${schemaName}):\n  - ${errors.join('\n  - ')}`); process.exit(1); }
    break;
  }

  case 'ingest': {
    const [sub, ...rest] = args;
    const { flags, positional } = parseFlags(rest, { dir: '.workorders' });
    if (sub === 'prepare') {
      const [path] = positional;
      if (!path) { console.error('usage: toolkit-framework ingest prepare <path> [--dir .workorders]'); process.exit(2); }
      const { created, skipped } = prepare({ path, workOrdersDir: flags.dir });
      console.log(`${created.length} work order(s) created, ${skipped.length} skipped (already prepared)`);
      for (const wo of created) console.log(`  ${wo.id}  ${wo.source_type}  ${wo.source_path}${wo.chunk ? ` [${wo.chunk}]` : ''}`);
    } else if (sub === 'list') {
      const orders = loadWorkOrders(flags.dir).filter((w) => !flags.status || w.status === flags.status);
      for (const w of orders) console.log(`${w.id}  ${w.status}  ${w.source_path}`);
    } else if (sub === 'claim' || sub === 'fulfill') {
      const next = sub === 'claim' ? 'claimed' : 'fulfilled';
      const id = requireWoId(positional[0], `usage: toolkit-framework ingest ${sub} <wo-id> [--dir .workorders]`);
      const wo = transition(loadWorkOrder(flags.dir, id), next);
      if (flags.by) wo.claimed_by = flags.by;
      saveWorkOrder(flags.dir, wo);
      console.log(`${id} → ${next}`);
    } else if (sub === 'accept') {
      const id = requireWoId(positional[0], 'usage: toolkit-framework ingest accept <wo-id> [--dir .workorders]');
      const res = acceptWorkOrder({ workOrdersDir: flags.dir, id });
      if (res.accepted) { console.log(`✓ ${id} accepted (${res.objects.length} object(s))`); }
      else { console.error(`✗ ${id} not accepted:\n  - ${res.errors.join('\n  - ')}`); process.exit(1); }
    } else { console.error('usage: toolkit-framework ingest <prepare|list|claim|fulfill|accept> …'); process.exit(2); }
    break;
  }

  case 'init': {
    const { flags, positional } = parseFlags(args, {});
    const dir = positional[0] || '.';
    const mode = 'existing' in flags ? 'existing' : 'new';
    try {
      const res = initInstance({ dir, mode, existingPath: flags.existing || null,
        name: flags.name || null, adapter: flags.adapter || 'kb-folder' });
      console.log(`✓ instance "${res.instance}" initialized at ${res.dir}` +
        (res.workOrders ? ` — ${res.workOrders} work order(s) queued from existing content` : ''));
      console.log('next: complete the self source-system card (register-source skill), then run the ingest skill');
    } catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }
    break;
  }

  case 'store': {
    const cfg = loadConfigOrExit('.');
    const { flags } = parseFlags(args, { dir: '.workorders', adapter: cfg.adapter || 'kb-folder', target: cfg.target || 'kb' });
    const adapter = getAdapter(flags.adapter);
    let count = 0;
    for (const wo of loadWorkOrders(flags.dir).filter((w) => w.status === 'accepted' && !w.produced)) {
      const dir = join(flags.dir, wo.id, 'accepted');
      const entries = readdirSync(dir).filter((f) => f.endsWith('.yaml'))
        .map((f) => yaml.load(readFileSync(join(dir, f), 'utf8')));
      const { stored } = adapter.store(flags.target, entries);
      saveWorkOrder(flags.dir, { ...wo, produced: stored });
      count += stored.length;
    }
    adapter.writeIndex(flags.target);
    console.log(`stored ${count} object${count === 1 ? '' : 's'} via ${flags.adapter} → ${flags.target}`);
    break;
  }

  case 'kb': {
    const [sub, ...rest] = args;
    const cfg = loadConfigOrExit('.');
    const { flags } = parseFlags(rest, { adapter: cfg.adapter || 'kb-folder', target: cfg.target || 'kb' });
    if (sub === 'index') {
      console.log(JSON.stringify(getAdapter(flags.adapter).index(flags.target), null, 2));
    } else { console.error('usage: toolkit-framework kb index [--adapter kb-folder] [--target kb]'); process.exit(2); }
    break;
  }

  case 'review': {
    const [sub, ...rest] = args;
    const cfg = loadConfigOrExit('.');
    const { flags, positional } = parseFlags(rest, { adapter: cfg.adapter || 'kb-folder', target: cfg.target || 'kb' });
    if (sub === 'list') {
      const q = reviewQueue({ adapter: flags.adapter, target: flags.target });
      for (const { schema, object, ref } of q) console.log(`${ref}\n  ${schema} · "${object.title}" · maturity=${object.maturity} ai_assisted=${object.ai_assisted}`);
      console.log(`${q.length} awaiting review`);
    } else if (sub === 'promote') {
      const [ref] = positional;
      if (!ref || !flags.maturity) { console.error('usage: toolkit-framework review promote <ref> --maturity <value> [--reviewer <name>]'); process.exit(2); }
      try {
        const { object } = promote({ adapter: flags.adapter, target: flags.target, ref, maturity: flags.maturity, reviewer: flags.reviewer, date: flags.date });
        console.log(`✓ "${object.title}" → ${object.maturity}${flags.reviewer ? ` (reviewed by ${flags.reviewer})` : ''}`);
      } catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }
    } else { console.error('usage: toolkit-framework review <list|promote> …'); process.exit(2); }
    break;
  }

  case 'federate': {
    const [sub, ...rest] = args;
    const { positional } = parseFlags(rest, {});
    if (sub === 'add') {
      const [cardPath] = positional;
      if (!cardPath) { console.error('usage: toolkit-framework federate add <peer-card.yaml>'); process.exit(2); }
      try {
        const { slug, ref } = federateAdd({ dir: '.', cardPath });
        console.log(`✓ peer "${slug}" registered → ${ref}`);
      } catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }
    } else if (sub === 'check') {
      const [extPath] = positional;
      if (!extPath) { console.error('usage: toolkit-framework federate check <peer-extensions.yaml>'); process.exit(2); }
      try {
        const { compatible, incompatible } = federateCheck({ extensionsPath: extPath });
        for (const n of compatible) console.log(`✓ ${n}`);
        for (const n of incompatible) console.log(`✗ ${n} — no maps_to_core to a real core type`);
        console.log(`fork-compatible: ${compatible.length}/${compatible.length + incompatible.length}`);
        if (incompatible.length) process.exit(1);
      } catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }
    } else { console.error('usage: toolkit-framework federate <add|check> …'); process.exit(2); }
    break;
  }

  default:
    console.log('toolkit-framework — Regen Knowledge Commons Toolkit framework');
    console.log('commands:');
    console.log('  version                         print version');
    console.log('  list-schemas                    list available schemas');
    console.log('  check-state <axis> <value>      validate a value against the K1 state model');
    console.log('  kernel-check                    verify the semantic kernel is internally consistent');
    console.log('  context                         emit the JSON-LD @context generated from the kernel');
    console.log('  validate <schema> <file>        validate an object file against a schema');
    console.log('  init [dir] [--existing <path>]  replicate: stamp a new KB instance (or wrap existing content)');
    console.log('  ingest prepare <path>           scan a source → idempotent work orders');
    console.log('  ingest list|claim|fulfill|accept  drive the work-order lifecycle');
    console.log('  store [--adapter --target]      write accepted objects via a storage adapter');
    console.log('  kb index [--adapter --target]   print the derived KB index');
    console.log('  review list|promote <ref>       operate the review queue (human gate)');
    console.log('  federate add|check              register a peer KB / check ontology fork-compatibility');
    if (cmd && cmd !== 'help' && cmd !== '--help') process.exit(2);
}
