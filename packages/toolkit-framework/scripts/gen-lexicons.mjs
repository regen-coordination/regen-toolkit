// packages/toolkit-framework/scripts/gen-lexicons.mjs — regenerates lexicons/. Usage: node scripts/gen-lexicons.mjs [authority]
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateAll } from '../src/lexicon.mjs';

const authority = process.argv[2] || 'xyz.regencoordination.kb';
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'lexicons');
mkdirSync(dir, { recursive: true });
for (const f of readdirSync(dir)) if (f.endsWith('.json')) unlinkSync(join(dir, f));
const all = generateAll({ authority });
for (const [nsid, doc] of Object.entries(all)) writeFileSync(join(dir, `${nsid}.json`), JSON.stringify(doc, null, 2) + '\n');
console.log(`wrote ${Object.keys(all).length} lexicons to ${dir} (authority ${authority})`);
