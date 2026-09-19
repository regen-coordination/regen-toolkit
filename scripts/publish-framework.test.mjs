// scripts/publish-framework.test.mjs — the guard on scripts/publish-framework.sh.
// The script rsyncs packages/toolkit-framework (--delete) and PUSHES it to a public repo. That package is now
// a vendored copy of org-os (incl. the AT Proto plane files), so the script must not run by accident.
// git and rsync are replaced by fakes that record any call: nothing here can touch a real remote.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./publish-framework.sh', import.meta.url));

function run(env = {}) {
  const bin = mkdtempSync(join(tmpdir(), 'pf-bin-'));
  const marker = join(bin, 'calls');
  for (const cmd of ['git', 'rsync']) {
    writeFileSync(join(bin, cmd), `#!/bin/sh\necho ${cmd} >> "${marker}"\nexit 0\n`);
    chmodSync(join(bin, cmd), 0o755);
  }
  const r = spawnSync('bash', [script], { env: { PATH: `${bin}:/usr/bin:/bin`, ...env }, encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}`, calls: existsSync(marker) ? readFileSync(marker, 'utf8') : '' };
}

test('publish-framework.sh refuses by default: exits non-zero, points at org-os, calls neither git nor rsync', () => {
  const r = run();
  assert.notEqual(r.status, 0);
  assert.match(r.out, /org-os/);
  assert.match(r.out, /PUBLISH_FRAMEWORK_OVERRIDE/);
  assert.equal(r.calls, '', 'guard fires before any side effect');
});

test('a wrong or empty override does not lift the guard', () => {
  for (const v of ['1', 'yes', 'true', '']) {
    const r = run({ PUBLISH_FRAMEWORK_OVERRIDE: v });
    assert.notEqual(r.status, 0, `override=${JSON.stringify(v)}`);
    assert.equal(r.calls, '');
  }
});

test('the exact override phrase lets the script proceed (against fakes)', () => {
  const r = run({ PUBLISH_FRAMEWORK_OVERRIDE: 'publish-the-vendored-copy' });
  assert.equal(r.status, 0, r.out);
  assert.match(r.calls, /git/); assert.match(r.calls, /rsync/);
});
