---
status: accepted
date: 2026-09-18
---

# AT Proto is the publication plane of org-os-kms, not its substrate

Git/yaml stays where knowledge objects are authored and reviewed. AT Proto is where publishable objects go once they pass the `public_use` gate, and where peer instances pull from. We chose this over making the AT Proto repo the source of truth (which would have removed git as the review workflow and made every unreviewed draft public the moment it was written) and over leaving AT Proto as a pull-only connector (which delivers no publishing and no real federation). The cost is two copies of every published object, with the publish manifest as the explicit boundary; the benefit is DID-rooted, Lexicon-typed, permanently citable identities without betting the knowledge base on a protocol still maturing.

## Considered options

- **Substrate**: PDS repo is the source of truth; `data/kb/` becomes a cache. Rejected: rips out the storage adapter and the git/Obsidian/PR review workflow; publishes drafts; same platform-risk exposure Afo raised about Geo, pointed at a different platform.
- **Publication plane** (chosen).
- **Pull-only connector** (the 2026-07-19 stub): rejected as not delivering what was asked.

## Decisions folded in

- **Identity is `did:plc`, not `did:web`.** The instance's name (`kc.regencoordination.xyz`) has not been validated by the council; `did:web` binds identity to the hostname with no rotation primitive, so a rename would be a re-identity and break every peer's origin reference. `did:plc` keeps the DID stable and puts the name in the handle, which can change freely. Accepted trade-off: the PLC directory is Bluesky-operated (mirrorable; open spec; independent governance in progress).
- **Lexicon NSID authority is `xyz.regencoordination.kb.*`**, owned by the instance doing the publishing. A `dev.` prefix in the NSID was rejected because it guarantees a migration; instead, development publishes under a disposable dev identity and NSIDs stay stable. If the KC group later agrees a neutral authority, migration is one regeneration plus one republish.
- **Lexicons are generated from `toolkit-framework/schemas/*.yaml`**, never hand-edited, so schema governance does not move to AT Proto.
- **KOI is not on this plane.** koi-net and AT Proto share nothing at the wire, identity, or schema layer; an atproto→KOI sensor is the bridge, and it is backlogged until a koi-net coordinator exists that wants these collections.

## Consequences

- The word **"canonical"** is retired from the KMS vocabulary; the gate is the `public_use` axis (see `CONTEXT.md`).
- Every publishable object needs a stable `id`; the origin mints it at first publish. Title-slugs are no longer identity anywhere identity leaves the instance.
- A second, non-AT-Proto publication surface (static JSON-LD + `.well-known/knowledge.json`) is emitted from the same manifest, so consumers who cannot speak AT Proto (Geo "query in place", Open Haven, agents) are not excluded.
