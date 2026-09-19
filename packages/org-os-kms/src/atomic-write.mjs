// src/atomic-write.mjs — write-then-rename so a kill mid-write can never leave a truncated file.
// Shared by the registry bridge and the ingest cursor write-back.
import { writeFileSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

export function atomicWrite(absPath, text) {
  mkdirSync(dirname(absPath), { recursive: true });
  const tmp = absPath + '.tmp';
  try {
    writeFileSync(tmp, text);
    renameSync(tmp, absPath);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}
