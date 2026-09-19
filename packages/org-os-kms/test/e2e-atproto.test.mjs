// packages/org-os-kms/test/e2e-atproto.test.mjs
// OPT-IN end-to-end round trip against a REAL PDS: publish -> pull -> retract.
// Skipped in a normal run. To run it, point it at a dev PDS account you own:
//   ATPROTO_E2E=1 ATPROTO_E2E_PDS=https://<pds> ATPROTO_E2E_HANDLE=<handle> \
//   ATPROTO_E2E_PASSWORD=<app password> ATPROTO_E2E_DID=<did of that account> npm test
// It writes one record to that account's repo and deletes it again before finishing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { OPS } from '../src/ops.mjs';
import { getAdapter } from '../src/framework.mjs';

const E = process.env;
const enabled = E.ATPROTO_E2E === '1' && E.ATPROTO_E2E_PDS && E.ATPROTO_E2E_HANDLE && E.ATPROTO_E2E_PASSWORD && E.ATPROTO_E2E_DID;
const AUTHORITY = 'xyz.regencoordination.kb';

test('e2e: publish → pull → retract', { skip: !enabled && 'set ATPROTO_E2E=1 + ATPROTO_E2E_PDS/HANDLE/PASSWORD/DID' }, async () => {
  const dirs = [];
  const mk = (x) => {
    const dir = mkdtempSync(join(tmpdir(), 'kms-e2e-'));
    dirs.push(dir);
    mkdirSync(join(dir, 'data', 'kb'), { recursive: true });
    writeFileSync(join(dir, 'data', 'kb', 'resource.yaml'), yaml.dump({ entries: x.entries || {} }));
    writeFileSync(join(dir, 'kms.yaml'), yaml.dump({ instance: x.instance, adapter: 'repo-data', target: '.',
      // publish.apply:true is what makes `publish` write to the PDS (plan mode is the default).
      publish: { apply: true, base_url: 'https://e2e.example' },
      atproto: { did: x.did, handle: E.ATPROTO_E2E_HANDLE, pds: E.ATPROTO_E2E_PDS, nsid_authority: AUTHORITY },
      connectors: x.connectors || [] }));
    return dir;
  };
  const show = (r) => JSON.stringify(r.report, null, 2);
  const title = `E2E ${Date.now()}`;
  const publisher = mk({ instance: 'pub', did: E.ATPROTO_E2E_DID,
    entries: { e2e: { title, type: 'resource', public_use: 'ok-with-caveat', url: 'https://example.org', notes: 'internal' } } });
  const deps = { env: { ATPROTO_APP_PASSWORD: E.ATPROTO_E2E_PASSWORD } };
  let retracted = false;
  try {
    // 1. publish (apply via publish.apply) -> one record created on the PDS
    const pub = await OPS.publish.run({ dir: publisher, deps });
    assert.equal(pub.ok, true, show(pub));
    assert.equal(pub.report.atproto.status, 'applied', show(pub));
    assert.equal(pub.report.atproto.created, 1, show(pub));

    // 2. pull it into a second instance that has never seen it
    const puller = mk({ instance: 'pull', did: 'did:plc:other', connectors: [{ name: 'atproto', config: { peers: [E.ATPROTO_E2E_DID] }, cursor: null }] });
    const pull = await OPS['ingest.pull'].run({ dir: puller });
    assert.equal(pull.ok, true, show(pull));
    // ingest.pull is fail-soft (ok:true even if a connector fails), so check failed/status explicitly.
    assert.equal(pull.report.failed, 0, show(pull));
    assert.equal(pull.report.connectors[0].status, 'ok', show(pull));
    assert.ok(pull.report.connectors[0].stored >= 1, show(pull));
    const got = getAdapter('repo-data').list(puller).find(({ object }) => object.title === title);
    assert.ok(got, `pulled object not found; ${show(pull)}`);
    assert.equal(got.object.maturity, 'raw');
    assert.equal(got.object.public_use, 'not-public-yet');
    assert.equal(got.object.url, 'https://example.org');
    assert.equal(got.object.notes, undefined, 'private field must not survive the outbound projection');
    assert.match(got.object.sourceUri, new RegExp(`^at://${E.ATPROTO_E2E_DID}/xyz\\.regencoordination\\.kb\\.resource/`));

    // 3. publisher drops the entry -> its record is deleted from the PDS
    writeFileSync(join(publisher, 'data', 'kb', 'resource.yaml'), yaml.dump({ entries: {} }));
    const unpub = await OPS.publish.run({ dir: publisher, deps });
    assert.equal(unpub.ok, true, show(unpub));
    assert.equal(unpub.report.atproto.deleted, 1, show(unpub));
    retracted = true;

    // 4. the puller sees the deletion and holds its copy (retraction)
    const pull2 = await OPS['ingest.pull'].run({ dir: puller });
    assert.equal(pull2.ok, true, show(pull2));
    assert.equal(pull2.report.failed, 0, show(pull2));
    assert.equal(pull2.report.connectors[0].retractions, 1, show(pull2));
    const held = getAdapter('repo-data').list(puller).find(({ object }) => object.title === title);
    assert.equal(held.object.maturity, 'held');
  } finally {
    // Best effort: if we failed after step 1, do not leave the record on the dev PDS.
    if (!retracted) {
      try {
        writeFileSync(join(publisher, 'data', 'kb', 'resource.yaml'), yaml.dump({ entries: {} }));
        await OPS.publish.run({ dir: publisher, deps });
      } catch { /* the original assertion failure is what matters */ }
    }
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  }
});
