# Connectors, ingest and the publication plane (operator guide)

How an org-os-kms instance pulls knowledge from other sources (`ingest`) and publishes its own (`publish`). Every statement here was checked against the source in `packages/org-os-kms/src/` and `packages/toolkit-framework/src/`; where something is a convention rather than code, it says so.

## 1. Verbs

```bash
org-os-kms ingest  [--connector <name>] [--dry] [--dir <instance>]
org-os-kms publish [--apply] [--dry]            [--dir <instance>]
```

- `ingest` pulls the connectors declared in `kms.yaml` under `connectors:` (each entry: `name`, `config`, and optionally a seed `cursor`; see "Cursor write-back" in section 10). It is a CLI verb only: it is **not** bound to `close` (or `initialize`), so nothing runs it automatically.
  - **Fail-soft per connector.** A connector that throws is reported as `status: 'failed'` (with `error`) and counted in `report.failed`; the others still run and the op still returns `ok: true`. A connector whose `pull` is not implemented is reported as `status: 'not-implemented'`. The CLI exits 1 when the report is `ok: false` (an operator error such as an unusable `--connector`, see below) and for unknown verbs/subcommands, but per-connector failures are still fail-soft (`ok: true`, exit 0), so the exit code does **not** signal them. **Scripts must check all of:** `report.failed`, any non-empty `connectors[].errors`, and any non-empty `connectors[].invalid` / `connectors[].collided`. The `errors` check matters because the `atproto` connector catches a per-peer failure inside itself: that peer is listed in `connectors[].errors` while the connector's `status` stays `'ok'` and `report.failed` stays 0, so a run where every peer failed still looks successful if you only read `failed`. `invalid` and `collided` list candidates that were dropped (see section 10). The report is not persisted anywhere; capture the JSON the command prints.
  - `--connector <name>` runs only that declared connector. If no declared connector has that name the run does nothing and returns `report.warning: 'no declared connector named <name>'`.
  - A `--connector` with no usable name (bare `--connector`, `--connector --dry`, or an empty value) is an operator-input error, not a connector failure: nothing runs, `kms.yaml` is not touched, and the result is `ok: false` with `report.error: '--connector needs a name (usage: --connector <name>)'`. It never falls back to running every connector. Note the CLI's flag parser only understands `--connector <name>` (space-separated); `--connector=<name>` is not parsed as that flag, so use the space form. Omitting `--connector` entirely means all declared connectors.
  - `--dry` runs every pull and mapping and reports what would happen (`candidates`, `invalid`, `collided`) but stores nothing, writes no source-system card, applies no retractions, and writes no cursor (`data/kms-cursors.json` is not touched). Note that a dry run still performs the network pulls.
- `publish` is described in section 2.

The `ingest` report, per connector: `name`, `status`, `dry`, `pulled`, `candidates`, `stored`, `updated`, `unchanged`, `collisions`, `collided`, `invalid`, `retractions`, `errors`. Top level: `connectors`, `failed`, and, only when set, `warning` (unknown `--connector` name), or `error` (unusable `--connector` value, or an unreadable `data/kms-cursors.json`; nothing runs in either case).

**Exit codes.** `publish` and `ingest` exit 1 when the report is `ok: false`: operator errors, a failed publish (failed login/apply, failed static surface, partial PDS failures) and the refused mass delete (section 2). Every other verb keeps its previous behaviour (exit 1 only for `{ error }` results such as an unknown verb or subcommand; e.g. `render` returns fail-soft `ok: false` deliberately and still exits 0). `ingest`'s per-connector failures are the exception described above: `ok: true`, exit 0, read `failed`/`errors`.

## 2. What `close` does (and does not) do

`lifecycle close` (`bind.mjs`) ends with `publish` then `sync.push`. `publish` runs in **plan mode** unless `kms.yaml` has `publish.apply: true`: it makes no PDS writes and writes no manifest. Plan mode is **not read-only**. When not `--dry` it still:

- mints `id` (and `grc20Id`, see section 9) into the source yaml for objects that pass the gate, but **only when a publication target exists**: `atproto.did`, `atproto.pds` and `atproto.nsid_authority` are all set, or `publish.static` is not `false`. An instance with neither (for example `regen-toolkit`: pull-only, `publish.static: false`) gets no yaml rewritten; the report's `minted` count is then only a preview; and
- regenerates the static surface (`<publish.static_dir>`, default `public/`) unless `publish.static: false`.

`publish --dry` is the fully read-only mode: no ids minted, no static files written, no PDS calls, no manifest. Real PDS writes need `--apply` (or `publish.apply: true`), `atproto.did`, `atproto.pds`, `atproto.nsid_authority`, and `ATPROTO_APP_PASSWORD` in the environment; if any is missing the atproto part reports `not-configured` (or `planned` when only apply is missing). Publish is a write op inside `close`, so a failed static surface (for example a missing `publish.base_url`) or failed PDS writes stop the lifecycle before `sync.push`. A failed login or a network error during apply is reported as `atproto.status: 'failed'` with an `error` message (never the credential) and `ok: false`, not thrown; in that case no manifest is written (nothing trustworthy came back) while the static surface step still runs from the last persisted manifest.

**Mass-delete refusal.** The plan deletes every manifest entry that is no longer selected. If an apply would run with **no** publishable items selected while the manifest still lists published records (an empty or misconfigured selection: check `publish.gate`, `types_opt_in`/`types_opt_out`, `target` and `public_use`), publish refuses: no login, no PDS call, `atproto.status: 'failed'`, `reason: 'refusing to delete every published record: ...'`, `wouldDelete: <n>`, `deleted: 0`, `ok: false`. Plan mode (no apply) is unchanged and just reports the counts. There is deliberately no other threshold: deleting some records is normal.

**Nothing wires `lifecycle close` into the agent's `/close` command today** (the `.claude/commands/close.md` flow does not call `org-os-kms`). Run `org-os-kms lifecycle close` or `org-os-kms publish` explicitly.

## 3. The projection (what never leaves the instance)

`publicView()` (`toolkit-framework/src/publishable.mjs`) is applied to everything outbound (PDS records and static entries) and to inbound atproto records. It drops these fields:

`notes`, `work_order`, `reviewed_by`, `review_needs`, `interpretation`, `uncertainty`, `tensions`, `risks_of_flattening`, `high_risk`, `consent_note`, `salvaged_from`, `legacy_status`, `additional_provenance`

and `provenance.surfaced_by`. That list is the `PRIVATE_FIELDS` constant; read it there rather than trusting this copy if the framework version differs.

Separately, the publication gate: only these types publish by default (`claim-evidence`, `concept-lineage`, `encyclopedia-entry`, `implementation-record`, `option-entry`, `organization`, `relationship-record`, `resource`, `signal`, `track`), `source-system` and `public-use-boundary` are opt-in via `publish.types_opt_in`, `person` is never publishable, and an object needs `public_use` of `ok-with-caveat`, `source-linked-unreviewed`, `reviewed-for-explanation` or `reviewed-for-guidance`, and its `maturity` must not be `held` (no other maturity is part of the floor). An optional instance gate (`publish.gate`) can only narrow this.

## 4. `.well-known` allowlist

Only two files are written under `<static_dir>/.well-known/`: `dao.json` (copied from the instance root `.well-known/` if present) and `knowledge.json` (generated: the root file if any is merged with `did`, `geo`, `exchange.published_domains`/`subscribed_domains` and source cards). `exchange.subscribed_domains` is **empty unless `publish.disclose_subscriptions: true`** in `kms.yaml`: listing the peer DIDs and `static-json` base URLs discloses who this instance reads, so it is opt-in. `meetings.json`, `members.json`, `activities.json` and any other root `.well-known` file are never copied.

## 5. Static surface facts

- `<static_dir>/api/**` is **generated and wiped**: the whole `<static_dir>/api` subtree is deleted and rewritten on every publish that writes the surface (non-dry, `publish.static` not false). Do not hand-author files there. In instances that publish, commit it.
- `publish.base_url` is required when the surface is on (without it the surface step fails). `@context` and index endpoint paths are absolute URLs built from it.
- Source-system cards appear in `knowledge.json` `sources` only when `source-system` is opted in (`publish.types_opt_in`) **and** the card's `public_use` is publishable. Cards written by connectors are stored `internal-only`, so they stay out until an operator reviews and changes them.
- `publish.static_dir` must be a relative path inside the instance.

## 6. Install

Vendor **both** `packages/toolkit-framework` and `packages/org-os-kms` into the instance, **unedited and pinned to a tag**, as siblings. `node_modules/@org-os/kms` does not work: `src/framework.mjs` re-exports the framework through relative sibling paths (`../../toolkit-framework/src/...`), so the two directories must sit side by side. `js-yaml` is the runtime dependency. Do not edit vendored files in place; upstream changes and re-vendor.

## 7. Pulling from AT Proto peers (`atproto` connector)

```yaml
connectors:
  - name: atproto
    config: { peers: [did:plc:...] }   # peers are DIDs
    cursor: null
```

- A puller needs `atproto.pds` set in `kms.yaml` **even while `atproto.did` is null** (the did is only needed to publish, and to ignore your own records when pulling).
- The connector uses **one PDS for all listed peers**. Resolving each peer's own PDS via DID documents, or reading from a relay, is **not implemented**; peers must be reachable on the configured PDS.
- `atproto.did`, `atproto.nsid_authority` and `atproto.pds` are merged under each connector's own `config` (the connector's own keys win).
- Cursor: `{ <did>: { rev, seen } }`. A peer whose commit `rev` is unchanged is skipped. A peer's full record list is compared to `seen` to detect retractions. A per-peer failure goes into the connector's `errors` and the other peers continue.
- Inbound records are treated as untrusted: they are passed through the same projection (private fields dropped), the peer's `id` is not kept, records claiming your own DID as origin are ignored, and a record that claims another listed peer as its origin is ignored.

## 8. Static JSON sources (`static-json` connector)

```yaml
  - name: static-json
    config: { base_url: 'https://example.org', mapper: openhaven }
    cursor: null
```

- Capability only: **no instance in this plan activates it.** The only mapper is `openhaven` (Open Haven `/api/protocols.json` becomes `resource`, `/api/affordances.json` becomes `signal`; domains are deliberately unmapped). Optional config: `index` (default `/api/index.json`) and `collections`.
- Cursor: a sha256 over the index body plus every collection body, in fixed order. If it is unchanged nothing is pulled.
- The mapper emits a stable https `sourceUri` per record, so re-pulled records **upsert** by `sourceUri` instead of colliding.
- Because there is no per-record diff, `runConnector` flags **every** re-pulled record `review_needs: 'updated at origin'` even if its content is unchanged.
- A locally `reviewed` object that has `ai_assisted: true` can never receive origin updates: the update is rejected by the AI-assisted is not human-reviewed invariant and reported under `invalid`.

## 9. Ids

- `id` (UUIDv4) is the AT Proto record key (`rkey`) and the key of the publish manifest (`data/kms-published.json`). It is minted at first non-dry publish, and **only for objects that passed every gate**, and only when a publication target exists (section 2); never on `--dry`. The instance-registry bridge (`bridge`) matches an existing `data/<registry>.yaml` row by the object's `id` **or** its title slug, so a row bridged before the id was minted migrates from slug to id in place instead of being duplicated. The `id` is a field on the object in the source yaml, so git holds it.
- `grc20Id` is minted only when `kms.yaml.geo.space` is set.
- The publish plan compares the content hash of the projected record with the hash stored in the manifest under that `id`: unchanged is skipped, changed is an update (with a compare-and-swap on the stored `cid`), and manifest ids no longer present are deleted from the PDS.
- **Correction to an earlier plan note.** The plan says `sameStoredObject` (`toolkit-framework/src/util.mjs`) compares by id once an id exists. That function does **not exist** in this version of the framework (`packages/toolkit-framework/src/util.mjs` in org-os has no such export, and the storage adapters simply overwrite an entry with the same slug). The claim only holds for older vendored framework copies that ship a `sameStoredObject` in `util.mjs` (which compares by `id` when both objects have one, otherwise by content hash). Check the copy you vendor. Regardless of the framework version, the connector layer never overwrites a local object with a new candidate that has the same slug (section 10).

## 10. Ingest semantics (`runConnector`, `toolkit-framework/src/connector.mjs`)

Order per connector: describe, pull, map, validate, upsert/store, write the source-system card, apply retractions.

- Every candidate is validated **as it will be stored**: `maturity: raw`, `public_use: not-public-yet`, `ai_assisted: true` unless the mapper says otherwise, plus `work_order: connector:<name>:<time>`, `source_lineage` and `provenance.origin`. Whatever maturity or public use the origin claims is ignored.
- **Upsert is by `sourceUri`.** An existing local object with the same `sourceUri` is updated (its local `id`, `maturity`, `public_use` and `review_needs` are excluded from the origin patch, so origin cannot change them; afterwards `review_needs` is explicitly set to `updated at origin`, replacing any earlier value). **An unchanged record is skipped, not rewritten:** if applying the origin's fields would leave the stored object identical (ignoring key order, the per-pull `work_order` stamp and `review_needs`), it is counted under `unchanged`, not `updated`, and nothing is written, so a peer whose commit `rev` moves does not re-flag its whole corpus for review and a reviewer's own `review_needs` note survives. If several candidates in one pull share a `sourceUri`, only the last one is applied.
- **Collisions are skipped, never overwritten.** A new candidate whose slug is already taken by a local object (or by an earlier candidate in the same pull) is skipped and reported as `collided` (`{ schema, title }`, counted in `collisions`).
- **Invalid candidates are reported, not stored.** They appear under `invalid` (`{ title, errors }`).
- **The cursor still advances past invalid and collided records.** They are not retried until the peer's data changes (a new `rev`, or a different body hash). Read `invalid` and `collided` in the `ingest` report; that is the only place they are surfaced.
- **Retractions never delete.** A record that disappeared at the origin sets `maturity: held` and `review_needs: 'retracted at origin <sourceUri>'`. Matching is by `sourceUri`; for atproto that is the peer's record AT-URI, so a stored record that carries its own different `sourceUri` claim is not matched by a retraction.
- **`held` unpublishes.** The publication floor (section 3) refuses `maturity: held`. If a reviewer already promoted an ingested object to a publishable `public_use` and it is later retracted at the origin, the next publish drops it: deleted from the PDS when applying, removed from the static surface. The same holds for an object an operator sets to `held` to withhold it. Only `held` is special: every other maturity is left to your instance gate (`publish.gate`), which can only narrow the floor.
- **Cursor write-back.** After a successful (non-dry) pull the new cursor is written to the sidecar `data/kms-cursors.json` (`{ "version": 1, "cursors": { "<key>": <cursor> } }`), **never to `kms.yaml`, which is not rewritten (its comments survive)**. The key is the connector's `name`; a repeated name gets `#2`, `#3`, ... in declaration order. A write happens only if some cursor actually changed (an empty `{}` counts as `null`, so a peerless atproto connector causes no write), and it merges into a **fresh read** of the sidecar (a cursor another run wrote during the slow pulls survives) and lands atomically (tmp + rename). A `cursor:` in `kms.yaml` is only the **seed**: a connector with no sidecar entry starts from it, and once the sidecar has an entry the sidecar wins, so an older config keeps working and a stale seed is harmless. To re-pull a peer from scratch, delete its key from the sidecar (and clear the seed). If the sidecar is not valid JSON, `ingest` fails with `ok: false` before pulling anything and leaves the file alone. Failed and not-implemented connectors leave their cursor as it was.

### Ingested objects and `bridge` (read before running `close`)

Ingested objects land `not-public-yet`, so they are outside the publication floor (section 3). `bridge` is bound earlier than `publish` in `close` and is **not** the publish path, so know what it does with them:

- **Registry rows are still copied.** Every object of a bound schema is upserted into the org-os registries (`data/resources.yaml`, `data/source-systems.yaml`, `data/signals.yaml`, ...), whatever its `maturity` or `public_use`. Those are internal instance state, not a publication surface, and are not gated. If your site or `.well-known` generators read those registries, that is where a pulled object can surface.
- **`encyclopedia-entry` pages are gated.** They are written to the site's `src/content/docs/kb/<slug>.md`, which is the public site. An entry whose `public_use` is `not-public-yet` or `internal-only`, or whose `maturity` is `held`, gets **no page**; it is listed under `report.withheld` (`{ schema, title, reason }`). An entry with no `public_use` at all is written as before.
- **Existing pages are never deleted.** If an entry was bridged while publishable and later turns `held` or `internal-only`, its old page stays until you remove it; `bridge` only stops rewriting it.
- **Pages for publishable entries are still unprojected.** Frontmatter is every field of the object, including `notes`, `reviewed_by`, `consent_note`, `id`, `sourceUri` and `viaUri`. Only the publication plane (`publish`) applies `publicView()`; `bridge` does not. Keep private material out of publishable entries' fields, or keep the `kb/` pages out of the built site.

## 11. Identity setup for a publisher

1. Choose or run a PDS.
2. Create the account on it.
3. Obtain the account's `did:plc` and an **app password** (not the account password).
4. Fill `kms.yaml` `atproto:` with `did`, `handle`, `pds`, `nsid_authority`, and put `ATPROTO_APP_PASSWORD` in `.env` (environment only, never a tracked file; `publish` reads `process.env`).
5. Publish the lexicon DNS record so the NSIDs resolve: a TXT record at `_lexicon.<nsid authority, labels reversed>` with value `did=<your did>` (AT Protocol lexicon resolution; the code does not check it). Collections are `<nsid_authority>.<camelCaseSchema>`, e.g. `<authority>.claimEvidence`.
6. Any dev/test identity must be wiped (its records deleted and the manifest reset) **before the first real publish**, otherwise the manifest would describe records that live on the wrong account.

## 12. This plan

`regen-toolkit` publishes nothing here: it is pull-only (`publish.apply` off, `atproto.did` unset), so it uses `ingest` and does not run `publish --apply`.
