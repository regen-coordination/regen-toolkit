// src/identity.mjs — mint object ids at first publish, only for objects that passed every gate. git holds the ids.
import { randomUUID } from 'node:crypto';
import * as fw from './framework.mjs';

const RKEY = /^[a-zA-Z0-9.\-_:~]{1,512}$/;
export function assertRkey(id) {
  if (typeof id !== 'string' || !RKEY.test(id)) throw new Error(`invalid rkey: ${JSON.stringify(id)}`);
  return id;
}

export function ensureIds({ adapter, target, items, uuid = randomUUID, write = true, mintGeo = false }) {
  const a = fw.getAdapter(adapter);
  const minted = [];
  const out = [];
  for (const it of items) {
    const patch = {};
    if (!it.object.id) patch.id = uuid();
    if (mintGeo && !it.object.grc20Id) patch.grc20Id = uuid();   // delta: grc20Id only when mintGeo
    if (Object.keys(patch).length) {
      minted.push({ ref: it.ref, id: patch.id ?? it.object.id, grc20Id: patch.grc20Id ?? it.object.grc20Id });
      if (write) a.update(target, it.ref, patch);
    }
    out.push({ ...it, object: { ...it.object, ...patch } });
  }
  const items2 = write ? (() => { const refs = new Set(items.map((i) => i.ref)); return a.list(target).filter((i) => refs.has(i.ref)); })() : out;
  for (const { object } of items2) assertRkey(object.id);   // delta: assertRkey on id only, never grc20Id
  return { minted, items: items2 };
}
