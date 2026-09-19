// Test-first (TDD) for scripts/process-content.mjs (Task 3).
// Asserts the article processor emits VALID encyclopedia-entry objects with honest-state
// labels (draft / source-linked-unreviewed, never `reviewed`), infers page_type correctly,
// and conservatively extracts concept-lineage candidates from "what is X" articles.
//
// Run: node --test scripts/process-content.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { validateObject } from '../packages/toolkit-framework/src/index.mjs';
import {
  inferPageType,
  articleToEntry,
  isConceptArticle,
  articleToConcept,
  HUMAN_REVIEWED,
  journeyToTrack,
  deriveTracks,
  tolerantFrontmatter,
  articleToSalvagedEntry,
  researchDumpToResource,
  readSalvageCandidates,
  isHighRisk,
  highRiskBoundary,
} from './process-content.mjs';
import { journeys } from '../src/data/journeys.js';

const here = dirname(fileURLToPath(import.meta.url));

// --- inferPageType -----------------------------------------------------------

test('inferPageType: "X vs Y" → comparison', () => {
  assert.equal(
    inferPageType('Centralized vs. Decentralized Systems', 'A comparison of two models.'),
    'comparison',
  );
  assert.equal(inferPageType('ReFi vs. DeFi vs. TradFi', 'three ways to move money'), 'comparison');
});

test('inferPageType: "Which X / Is X right" → comparison (a choosing/decision page)', () => {
  assert.equal(inferPageType('Which Chain is Right for Your Project?', 'pick a chain'), 'comparison');
});

test('inferPageType: "How to X / guide / setting up" → guide', () => {
  assert.equal(inferPageType('How to Get Your First Crypto', 'a step by step walk'), 'guide');
  assert.equal(inferPageType('Setting Up Your First Wallet', 'install and configure'), 'guide');
});

test('inferPageType: "What is X" / explained → concept', () => {
  assert.equal(inferPageType('What Is a Blockchain?', 'a shared notebook'), 'concept');
  assert.equal(inferPageType('Smart Contracts Explained', 'self-executing code'), 'concept');
});

test('inferPageType: pitfalls / mistakes / avoid → anti-pattern', () => {
  assert.equal(
    inferPageType('Common Pitfalls When Starting a Local Node', 'the failure patterns that sink nodes'),
    'anti-pattern',
  );
});

test('inferPageType: framework / model / architecture → framework', () => {
  assert.equal(inferPageType('Governance Mechanism Design', 'a framework for voting models'), 'framework');
  assert.equal(inferPageType('Local Node Model', 'an architecture for nodes'), 'framework');
});

test('inferPageType: always returns a value in the schema enum', () => {
  const enumVals = new Set([
    'concept', 'framework', 'comparison', 'guide', 'case-linked', 'anti-pattern', 'frontier',
  ]);
  assert.ok(enumVals.has(inferPageType('Totally Ambiguous Title', 'some body text')));
});

// --- articleToEntry → a VALID encyclopedia-entry ------------------------------

test('articleToEntry produces a valid encyclopedia-entry (framework validateObject)', () => {
  const entry = articleToEntry({
    slug: 'what-is-blockchain',
    title: 'What Is a Blockchain?',
    description: 'A plain-language introduction to blockchains.',
    body: 'A blockchain is a shared notebook the whole village keeps.',
    frontmatter: {},
  });
  const { valid, errors } = validateObject('encyclopedia-entry', entry);
  assert.ok(valid, `expected valid encyclopedia-entry, got errors: ${JSON.stringify(errors)}`);
});

test('articleToEntry: honest-state defaults — draft maturity, ai_assisted, non-reviewed public_use', () => {
  const entry = articleToEntry({
    slug: 'what-is-blockchain',
    title: 'What Is a Blockchain?',
    description: 'intro',
    body: 'body',
    frontmatter: {},
  });
  // honest maturity default: these are AI-pipeline drafts, NOT human-reviewed.
  assert.equal(entry.maturity, 'draft');
  assert.notEqual(entry.maturity, 'reviewed');
  // honest flag.
  assert.equal(entry.ai_assisted, true);
  // honest public_use: must not be a `reviewed-*` overclaim.
  assert.ok(!/^reviewed-/.test(entry.public_use), `public_use overclaims: ${entry.public_use}`);
  assert.equal(entry.public_use, 'source-linked-unreviewed');
});

test('articleToEntry: NEVER marks reviewed when the human-review allowlist is empty', () => {
  // The allowlist is empty (no evidence of independent human review per the master doc).
  assert.equal(HUMAN_REVIEWED.size, 0);
  const entry = articleToEntry({
    slug: 'centralized-vs-decentralized', // has review_done:true in real frontmatter — must NOT promote it
    title: 'Centralized vs. Decentralized',
    description: 'x',
    body: 'y',
    frontmatter: { review_done: true, published_flag: true, status: 'published' },
  });
  assert.equal(entry.maturity, 'draft');
  assert.notEqual(entry.maturity, 'reviewed');
});

test('articleToEntry: carries description→summary, source_lineage, slug id, page_type', () => {
  const entry = articleToEntry({
    slug: 'how-to-get-crypto',
    title: 'How to Get Your First Crypto',
    description: 'A calm, scam-aware guide.',
    body: 'walk through getting your first crypto',
    frontmatter: {},
  });
  assert.equal(entry.summary, 'A calm, scam-aware guide.');
  assert.equal(entry.source_lineage, 'src/content/docs/how-to-get-crypto.md');
  assert.equal(entry.id, 'how-to-get-crypto');
  assert.equal(entry.type, 'encyclopedia-entry');
  assert.equal(entry.page_type, 'guide');
});

test('articleToEntry: harvests honest related_concepts from frontmatter `related`', () => {
  const entry = articleToEntry({
    slug: 'silvi-protocol',
    title: 'Silvi Protocol Playbook',
    description: 'a guide',
    body: 'using silvi',
    frontmatter: { related: ['dmrv', 'onchain-attestations'] },
  });
  assert.deepEqual(entry.related_concepts, ['dmrv', 'onchain-attestations']);
});

// --- concept extraction (conservative) ---------------------------------------

test('isConceptArticle: true for "what is X" defined-term articles', () => {
  assert.equal(isConceptArticle('what-is-dao', 'What Is a DAO?'), true);
  assert.equal(isConceptArticle('what-is-blockchain', 'What Is a Blockchain?'), true);
});

test('isConceptArticle: false for guides / comparisons / pitfalls (no over-extraction)', () => {
  assert.equal(isConceptArticle('how-to-get-crypto', 'How to Get Your First Crypto'), false);
  assert.equal(isConceptArticle('common-pitfalls', 'Common Pitfalls When Starting a Local Node'), false);
  assert.equal(isConceptArticle('which-chain-right', 'Which Chain is Right for Your Project?'), false);
});

test('articleToConcept produces a valid concept-lineage (framework validateObject)', () => {
  const concept = articleToConcept({
    slug: 'what-is-dao',
    title: 'What Is a DAO?',
    description: 'A plain-language introduction to DAOs.',
    body: 'A DAO is ...',
    frontmatter: {},
  });
  const { valid, errors } = validateObject('concept-lineage', concept);
  assert.ok(valid, `expected valid concept-lineage, got errors: ${JSON.stringify(errors)}`);
  assert.equal(concept.maturity, 'draft');
  assert.equal(concept.ai_assisted, true);
  assert.equal(concept.type, 'concept-lineage');
  assert.equal(concept.source_lineage, 'src/content/docs/what-is-dao.md');
  // honest: do not fabricate traditions/distinctions.
  assert.ok(!concept.source_traditions || concept.source_traditions.length === 0);
});

// --- journeys → tracks (Task 4) ----------------------------------------------

test('deriveTracks: the 3 journeys map to 3 track objects', () => {
  const tracks = deriveTracks(journeys);
  assert.equal(tracks.length, 3);
  assert.deepEqual(
    tracks.map((t) => t.id).sort(),
    ['knowledge-commons', 'local-node', 'newcomer'],
  );
});

test('deriveTracks: every derived track validates against schemas/track.yaml', () => {
  for (const t of deriveTracks(journeys)) {
    const { valid, errors } = validateObject('track', t);
    assert.ok(valid, `track ${t.id} invalid: ${JSON.stringify(errors)}`);
  }
});

test('journeyToTrack: required fields present — title, type=track, non-empty audience', () => {
  const t = journeyToTrack(journeys.newcomer);
  assert.equal(t.title, 'Newcomer Orientation');
  assert.equal(t.type, 'track');
  assert.equal(typeof t.audience, 'string');
  assert.ok(t.audience.length > 0, 'audience must be a non-empty string');
});

test('journeyToTrack: outcome stays an array — one entry per bullet, in order, bullets never re-split or merged', () => {
  const t = journeyToTrack({ ...journeys.newcomer, outcome: ['Set up a wallet; avoid scams', 'Take a first step', 3] });
  assert.deepEqual(t.outcome, ['Set up a wallet; avoid scams', 'Take a first step', '3']);
});

test('journeyToTrack: a journey with no outcome yields an empty outcome array (schema type: array)', () => {
  const { outcome, ...noOutcome } = journeys.newcomer;
  assert.deepEqual(journeyToTrack(noOutcome).outcome, []);
});

test('journeyToTrack: concepts = flattened, ordered step slugs across all chapters', () => {
  const t = journeyToTrack(journeys.newcomer);
  assert.ok(Array.isArray(t.concepts));
  // newcomer has 16 steps across 4 chapters.
  const expected = journeys.newcomer.chapters.flatMap((c) => c.steps.map((s) => s[0]));
  assert.deepEqual(t.concepts, expected);
  // spot-check a known slug is present and order is preserved.
  assert.ok(t.concepts.includes('what-is-blockchain'));
  assert.equal(t.concepts[0], 'why-regens-interested');
});

test('journeyToTrack: maturity is the valid axis value field-informed (Heenal v1, not auto-promoted to reviewed)', () => {
  const t = journeyToTrack(journeys.newcomer);
  assert.equal(t.maturity, 'field-informed');
  assert.notEqual(t.maturity, 'reviewed');
});

test('journeyToTrack: traceability — id slug + source_lineage back to journeys.js', () => {
  const t = journeyToTrack(journeys['knowledge-commons']);
  assert.equal(t.id, 'knowledge-commons');
  assert.equal(t.source_lineage, 'src/data/journeys.js#knowledge-commons');
});

test('journeyToTrack: options NOT fabricated — left empty (journeys carry no option ids)', () => {
  const t = journeyToTrack(journeys.newcomer);
  assert.deepEqual(t.options, []);
});

// --- Task 5: salvage (other-branch + legacy content) -------------------------

// tolerantFrontmatter handles the LEGACY content/ shape: leading blank line, YAML keys,
// then a single lone `---` (no opening `---`). gray-matter returns {} for these — the
// salvage path must still recover the title.
test('tolerantFrontmatter: parses legacy frontmatter (no opening ---, single closing ---)', () => {
  const raw = '\ntitle: Consensus mechanisms explained\nstatus: not-started\n---\n\nBody text here.\n';
  const { data, content } = tolerantFrontmatter(raw);
  assert.equal(data.title, 'Consensus mechanisms explained');
  assert.equal(data.status, 'not-started');
  assert.ok(content.includes('Body text here.'));
});

test('tolerantFrontmatter: parses standard frontmatter (---...---) like the live articles', () => {
  const raw = '---\ntitle: Bitcoin History\nstatus: published\n---\n\nThe body.\n';
  const { data, content } = tolerantFrontmatter(raw);
  assert.equal(data.title, 'Bitcoin History');
  assert.equal(data.status, 'published');
  assert.ok(content.includes('The body.'));
});

test('tolerantFrontmatter: falls back to the H1 heading when there is no YAML title', () => {
  const raw = '\n# Key ReFi Projects and Protocols\n\nFrom KlimaDAO to Gitcoin.\n\n---\n';
  const { data } = tolerantFrontmatter(raw);
  assert.equal(data.title, 'Key ReFi Projects and Protocols');
});

// A known survivor slug → a valid encyclopedia-entry with honest salvage provenance.
test('articleToSalvagedEntry: produces a valid encyclopedia-entry (framework validateObject)', () => {
  const entry = articleToSalvagedEntry({
    slug: 'consensus-mechanisms',
    title: 'Consensus mechanisms explained',
    description: 'How blockchains agree.',
    body: 'Proof of work, proof of stake.',
    frontmatter: { status: 'not-started' },
    source: 'content/1-foundations/1.3-blockchain-fundamentals/consensus-mechanisms.md',
  });
  const { valid, errors } = validateObject('encyclopedia-entry', entry);
  assert.ok(valid, `expected valid encyclopedia-entry, got: ${JSON.stringify(errors)}`);
});

test('articleToSalvagedEntry: honest-state — draft, ai_assisted, salvaged_from provenance, never reviewed', () => {
  const entry = articleToSalvagedEntry({
    slug: 'gitcoin-grants',
    title: 'Gitcoin Grants: Running and participating in QF rounds',
    description: 'A guide.',
    body: 'Quadratic funding.',
    frontmatter: { status: 'not-started' },
    source: 'content/3-playbooks/3.1-protocol-playbooks/gitcoin-grants.md',
  });
  assert.equal(entry.maturity, 'draft');
  assert.notEqual(entry.maturity, 'reviewed');
  assert.equal(entry.ai_assisted, true);
  assert.equal(entry.public_use, 'source-linked-unreviewed');
  assert.ok(!/^reviewed-/.test(entry.public_use), `public_use overclaims: ${entry.public_use}`);
  assert.equal(entry.salvaged_from, 'content/3-playbooks/3.1-protocol-playbooks/gitcoin-grants.md');
  assert.equal(entry.source_lineage, 'content/3-playbooks/3.1-protocol-playbooks/gitcoin-grants.md');
  assert.equal(entry.id, 'gitcoin-grants');
  assert.equal(entry.type, 'encyclopedia-entry');
});

// A research dump → a valid `resource` object, kept raw.
test('researchDumpToResource: produces a valid resource (framework validateObject), kept raw', () => {
  const res = researchDumpToResource({
    slug: 'silvi-protocol-research',
    title: 'Silvi Protocol — Deep Research Report',
    body: 'Executive summary ...',
    source: 'archive/luizfernando-refidao:research/silvi-protocol-research.md',
  });
  const { valid, errors } = validateObject('resource', res);
  assert.ok(valid, `expected valid resource, got: ${JSON.stringify(errors)}`);
  assert.equal(res.type, 'resource');
  assert.equal(res.maturity, 'raw');
  assert.equal(res.public_use, 'raw-lead');
  assert.notEqual(res.maturity, 'reviewed');
  assert.equal(res.resource_type, 'research-dump');
  assert.equal(res.salvaged_from, 'archive/luizfernando-refidao:research/silvi-protocol-research.md');
  assert.equal(res.source_lineage, 'archive/luizfernando-refidao:research/silvi-protocol-research.md');
});

// Dedup: survivors are the content/ leaf-slugs NOT in the live set; superseded slugs are excluded.
test('readSalvageCandidates: excludes superseded slugs (in the live set), keeps survivors', () => {
  // A live slug present on disk under content/ (e.g. bitcoin-history) must NOT appear as a survivor.
  const live = new Set([
    'bitcoin-history', 'what-is-blockchain', 'what-is-dao', 'common-scams', 'stablecoins',
  ]);
  const survivors = readSalvageCandidates(live);
  const slugs = new Set(survivors.map((s) => s.slug));
  // superseded → excluded
  assert.ok(!slugs.has('bitcoin-history'), 'bitcoin-history is live → must be dropped as superseded');
  assert.ok(!slugs.has('what-is-blockchain'), 'what-is-blockchain is live → must be dropped');
  // known not-live survivors → present
  assert.ok(slugs.has('gitcoin-grants'), 'gitcoin-grants is not live → must be a survivor');
  assert.ok(slugs.has('consensus-mechanisms'), 'consensus-mechanisms is not live → must be a survivor');
  // dedup-within: one entry per leaf slug (no duplicate slugs across paths)
  assert.equal(slugs.size, survivors.length, 'survivors must be unique by leaf slug');
});

test('readSalvageCandidates: every survivor → a valid salvaged encyclopedia-entry', () => {
  // Use the real live set so this asserts the actual emitted corpus is all-valid.
  const liveSlugs = new Set(
    readSalvageCandidates.__liveSlugsForTest
      ? readSalvageCandidates.__liveSlugsForTest()
      : [],
  );
  // Fall back to an empty live set if the helper is unavailable — still asserts validity.
  const survivors = readSalvageCandidates(liveSlugs);
  assert.ok(survivors.length > 0, 'expected at least one survivor');
  for (const a of survivors) {
    const entry = articleToSalvagedEntry(a);
    const { valid, errors } = validateObject('encyclopedia-entry', entry);
    assert.ok(valid, `survivor ${a.slug} invalid: ${JSON.stringify(errors)}`);
  }
});

// --- Task 6: CSIS check #3 — high-risk public-use boundaries ------------------

test('isHighRisk: true for financial/security guidance (named in-set examples)', () => {
  for (const [slug, title] of [
    ['seed-phrases', 'Seed Phrases: Your Master Key to Crypto'],
    ['setting-up-multisig-treasury', 'Setting Up a Multisig Treasury'],
    ['common-scams', 'Common Crypto Scams and How to Spot Them'],
    ['conducting-token-airdrop', 'Conducting a Token Airdrop'],
    ['tax-implications', 'Tax Implications'],
    ['stablecoins', 'Stablecoins: Digital Dollars That Hold Their Value'],
    ['gas-fees', 'Gas Fees'],
    ['treasury-best-practices', 'Treasury Best Practices'],
    ['key-management', 'Key Management for Communities'],
    ['wallet-security', 'Teaching Wallet Security'],
  ]) {
    assert.equal(isHighRisk(slug, title), true, `expected high-risk: ${slug}`);
  }
});

test('isHighRisk: false for general explainers and grant/fundraising-strategy pages (no over-classify)', () => {
  for (const [slug, title] of [
    ['what-is-dao', 'What Is a DAO?'],                              // general concept — NOT high-risk
    ['funding-landscape', 'The Funding Landscape'],                 // fundraising strategy, not custody
    ['funding-your-node', 'Funding Your Local Node'],
    ['writing-grant-proposals', 'Writing Grant Proposals'],
    ['gitcoin-grants-qf', 'Gitcoin Grants and Quadratic Funding'],
    ['rpgf', 'Retroactive Public Goods Funding'],
    ['what-are-tokens', "What Are Tokens? A Beginner's Guide to Digital Assets"], // pure token concept
    ['token-standards', 'Token Standards'],                         // technical concept, not guidance
    ['tokens-coordination-tools', 'Tokens as Coordination Tools'],
  ]) {
    assert.equal(isHighRisk(slug, title), false, `expected NOT high-risk: ${slug}`);
  }
});

test('highRiskBoundary: returns a VALID public-use-boundary for high-risk, undefined otherwise', () => {
  const b = highRiskBoundary('seed-phrases', 'Seed Phrases: Your Master Key to Crypto');
  assert.ok(b, 'seed-phrases must get a boundary');
  assert.equal(b.tier, 'public-with-caveat');
  const { valid, errors } = validateObject('public-use-boundary', b);
  assert.ok(valid, `boundary invalid: ${JSON.stringify(errors)}`);
  // a general explainer gets none.
  assert.equal(highRiskBoundary('what-is-dao', 'What Is a DAO?'), undefined);
});

test('articleToEntry: attaches public_use_boundary to a high-risk entry; entry still validates', () => {
  const entry = articleToEntry({
    slug: 'seed-phrases',
    title: 'Seed Phrases: Your Master Key to Crypto',
    description: 'Protect your master key.',
    body: 'A seed phrase is your master key.',
    frontmatter: {},
  });
  assert.ok(entry.public_use_boundary, 'high-risk entry must carry public_use_boundary');
  assert.equal(entry.public_use_boundary.tier, 'public-with-caveat');
  // open model: extra field is allowed — entry still validates as an encyclopedia-entry.
  const { valid, errors } = validateObject('encyclopedia-entry', entry);
  assert.ok(valid, `entry invalid: ${JSON.stringify(errors)}`);
  // the sub-object validates as a public-use-boundary.
  const b = validateObject('public-use-boundary', entry.public_use_boundary);
  assert.ok(b.valid, `boundary invalid: ${JSON.stringify(b.errors)}`);
});

test('articleToEntry: a general explainer gets NO boundary (no over-classify)', () => {
  const entry = articleToEntry({
    slug: 'what-is-dao',
    title: 'What Is a DAO?',
    description: 'A plain-language intro.',
    body: 'A DAO is ...',
    frontmatter: {},
  });
  assert.equal(entry.public_use_boundary, undefined);
});

test('articleToSalvagedEntry: high-risk salvaged entry also carries a valid boundary', () => {
  const entry = articleToSalvagedEntry({
    slug: 'setting-up-multisig-treasury',
    title: 'Setting Up a Multisig Treasury',
    description: 'How to set up a multisig.',
    body: 'A multisig requires M-of-N signatures.',
    frontmatter: { status: 'not-started' },
    source: 'content/3-playbooks/3.x/setting-up-multisig-treasury.md',
  });
  assert.ok(entry.public_use_boundary, 'high-risk salvaged entry must carry a boundary');
  assert.equal(entry.public_use_boundary.tier, 'public-with-caveat');
  const { valid, errors } = validateObject('encyclopedia-entry', entry);
  assert.ok(valid, `salvaged entry invalid: ${JSON.stringify(errors)}`);
});

// sanity: the module under test lives where we expect.
test('module path sanity', () => {
  assert.ok(join(here, 'process-content.mjs').endsWith('scripts/process-content.mjs'));
});
