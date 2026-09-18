# Regen Knowledge Commons (org-os-kms)

The knowledge-commons layer of this org-os instance: how knowledge objects are authored, reviewed, published to the wider commons, and exchanged with peer instances and external systems.

## Language

### Planes

**Editorial plane**:
Where knowledge objects are authored and reviewed, inside one instance's git repository. Objects here may be at any maturity or public-use level.
_Avoid_: working copy, local KB, draft plane

**Publication plane**:
The public surfaces an instance exposes for its publishable objects: its AT Proto repo and its static JSON surface. Only publishable objects exist here.
_Avoid_: substrate, canonical store, the graph

**Federation plane**:
The exchange of published objects between instances and with external systems. Everything arriving from it re-enters the editorial plane at raw maturity.
_Avoid_: sync, network

### Objects and identity

**Knowledge object**:
One typed entry in an instance's knowledge base (a claim-evidence, an encyclopedia entry, a source-system card, …). Typed by a framework schema.
_Avoid_: record (reserved for the AT Proto form), entry, node, document

**Publishable**:
A knowledge object that passes the framework gate (type and `public_use`) **and** any stricter instance gate the instance declares. The framework gate is the floor, never the ceiling; maturity is not part of the framework gate.
_Avoid_: canonical (a legacy crosswalk value, not a real state), final, approved

**Instance gate**:
A fail-closed rule an instance adds on top of the framework gate (ReFi DAO's requires reviewed maturity, a resolvable non-internal source, and no consent boundary). Declared in the instance's config; applied wherever `publish` runs.
_Avoid_: override, policy

**Consent boundary**:
A record binding a consent tier (e.g. never-publish-without-consent) to a source lineage. ReFi DAO stores these as `public-use-boundary` objects; the toolkit's ontology uses the same type name for an axis of labels — do not conflate. A consent boundary is never itself published.
_Avoid_: public-use-boundary (ambiguous across instances), restriction

**Published**:
A publishable object that currently exists on the instance's publication plane. Tracked by the publish manifest.

**Object ID** (`id`):
The stable UUID of one knowledge object *as held by one instance*. Minted by the origin at first publish; never derived from the title. Two instances holding the same concept have different object IDs.
_Avoid_: slug (a title-derived file key, not identity), key, rkey (the AT Proto spelling of the same value)

**Origin**:
The instance that first published a knowledge object. Its AT-URI is the object's permanent identity across every republish.
_Avoid_: source (overloaded — see source-system), author

**Republish**:
An instance publishing, in its own repo, a knowledge object whose origin is another instance. Allowed; the origin is preserved.
_Avoid_: mirror, fork, copy

**Retraction**:
The removal of an object from an origin's publication plane. Peers flag a retracted object for review; they never delete it automatically.
_Avoid_: delete, forget, unpublish

**Geo entity ID** (`grc20Id`):
The GRC-20 UUID shared with Geo for *the same concept*. Minted by the origin at first publish, or pasted from Geo if the concept already exists there. Never re-minted on republish.
_Avoid_: Geo ID (ambiguous with space ID)

**Geo space ID**:
The GRC-20 identifier of a Geo *space* (a governed collection), such as the Knowledge Commons topic space or the Regen Knowledge Commons space. Belongs to an instance's manifest, never to a single object.

### Peers and sources

**Peer**:
Another instance whose publication plane this instance pulls from. Every peer is described by a source-system card.
_Avoid_: remote, upstream, neighbor

**Source-system**:
The framework's federation card for any external environment knowledge is pulled from — a peer instance, Open Haven, a KOI node, a GitHub repo. "I pull from X" and "X is my source-system" are the same fact.
_Avoid_: source (bare), integration, provider

**Static source**:
A source-system that is a plain, read-only JSON dataset with a discovery document, pulled without any protocol client. Open Haven is the first.
_Avoid_: API source, dataset (bare)

**Static surface**:
An instance's own static-source-shaped publication target: JSON-LD files plus a discovery document, readable by anyone who cannot speak AT Proto.
_Avoid_: API, export, site data

**Connector**:
The driver that knows how to reach one kind of source-system and turn its native objects into knowledge-object candidates.
_Avoid_: adapter (reserved for storage), plugin, bridge

### AT Proto terms as used here

**Instance DID**:
The `did:plc` identity of one org-os instance. Permanent; one per instance; contributors are attributed in fields, not by their own DIDs.
_Avoid_: did:web (rejected — binds identity to a hostname the council has not validated)

**Handle**:
The DNS name an instance DID is displayed as (e.g. `kc.regencoordination.xyz`). Changeable without touching any record.
_Avoid_: domain, name, address

**Dev identity**:
A disposable instance DID used while developing. Its repo is wiped before the first real publish; nothing published under it is an origin anyone may cite.

**PDS**:
The AT Proto host that stores and serves an instance's repo. One PDS may host many instances.

**Lexicon**:
The AT Proto schema for one knowledge-object type. Always generated from the framework schema; never hand-edited.

**NSID authority**:
The domain under which the Lexicons are named. Permanent once records carry it.
