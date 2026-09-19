#!/usr/bin/env node
// Task 3 — Process the 119 toolkit articles (src/content/docs/*.md) through the framework:
//   - emit `encyclopedia-entry` objects → data/encyclopedia.yaml
//   - conservatively extract `concept-lineage` candidates → data/concepts.yaml
//
// Honest-state discipline (NON-NEGOTIABLE, per docs/MASTER.md):
//   These articles are AI-pipeline drafts that happen to be live on Heenal's v1 site.
//   The master doc repeats: "Do not treat AI synthesis as human-reviewed" and
//   "human review is still needed for published AI-assisted drafts." The pipeline's
//   `review_done: true` is a PIPELINE STAGE flag (research→draft→factcheck→review→critique),
//   NOT independent human sign-off. So:
//     - maturity default = `draft` (never `reviewed` unless slug ∈ HUMAN_REVIEWED, which is EMPTY)
//     - ai_assisted = true on all
//     - public_use = `source-linked-unreviewed` (written/published, not human-reviewed)
//
// Every emitted object is validated via the framework API (validateObject); the script
// REFUSES to write if any object is invalid (exit non-zero).
//
// Exported functions are reused by Task 4/5. main() is guarded so importing has no side effects.

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { execSync } from 'node:child_process';
import matter from 'gray-matter';
import yaml from 'js-yaml';

import { validateObject } from '../packages/toolkit-framework/src/index.mjs';
import { journeys } from '../src/data/journeys.js';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(here, '..');
const DOCS_DIR = join(REPO_ROOT, 'src', 'content', 'docs');
const JOURNEYS_SRC = join(REPO_ROOT, 'src', 'data', 'journeys.js');
const ENCYCLOPEDIA_OUT = join(REPO_ROOT, 'data', 'encyclopedia.yaml');
const CONCEPTS_OUT = join(REPO_ROOT, 'data', 'concepts.yaml');
const TRACKS_OUT = join(REPO_ROOT, 'data', 'tracks.yaml');
const GENERATED_AT = '2026-06-17';
// Task 4 derives `data/tracks.yaml` from src/data/journeys.js; that pass was run 2026-06-23.
const TRACKS_GENERATED_AT = '2026-06-23';

// --- Task 5: salvage (other-branch + legacy content) -------------------------
// Output to SEPARATE files (NOT the canonical data/encyclopedia.yaml / data/resources.yaml) so:
//   (a) Task 3's verified invariant "119 articles = 119 entries, byte-identical regeneration"
//       is preserved (salvaged drafts never pollute the canonical encyclopedia), and
//   (b) the next canonical generator run never clobbers the salvage.
// This is a deliberate deviation from the plan's literal "append to …" — documented in the report.
const CONTENT_DIR = join(REPO_ROOT, 'content');
const SALVAGE_SUBDIRS = ['1-foundations', '2-applied', '3-playbooks']; // article dirs only
const ENCYCLOPEDIA_SALVAGED_OUT = join(REPO_ROOT, 'data', 'encyclopedia-salvaged.yaml');
const RESOURCES_SALVAGED_OUT = join(REPO_ROOT, 'data', 'resources-salvaged.yaml');
const SALVAGE_GENERATED_AT = '2026-06-23';

// The legacy refidao research dumps live only in this read-only archive tag.
const RESEARCH_ARCHIVE_REF = 'archive/luizfernando-refidao';
const RESEARCH_DUMP_PATHS = [
  'research/gitcoin-grants-research.md',
  'research/gnosis-safe-research.md',
  'research/refi-dao-content-inventory.md',
  'research/silvi-protocol-research.md',
];

// --- journeys → tracks (Task 4) honest-state -----------------------------------
//
// The 3 journeys in src/data/journeys.js are Heenal's curated, reviewed v1 pathways —
// more mature than the AI-draft articles. On the K1 maturity axis (review-maturity.yaml)
// the honest rung is `field-informed` ("informed by real implementation"): these are
// hand-authored v1 journeys, NOT merely `reviewed` editorial copy and not auto-promoted.
// `field-informed` is a valid maturity-axis value (verified) — no substitution needed.
const TRACK_MATURITY = 'field-informed';

// --- honest-state constants --------------------------------------------------

// Slugs known to be INDEPENDENTLY HUMAN-REVIEWED (not merely run through the AI
// pipeline's `review_done` stage). EMPTY: there is no evidence any of the 119 has
// had independent human sign-off, and the master doc is explicit that these are
// AI-assisted drafts still needing human review. Only slugs here may be `reviewed`.
export const HUMAN_REVIEWED = new Set([]);

const DEFAULT_MATURITY = 'draft';
const DEFAULT_PUBLIC_USE = 'source-linked-unreviewed';

// --- frontmatter -------------------------------------------------------------

/** Parse raw markdown into { data (frontmatter), content (body) }. */
export function parseFrontmatter(raw) {
  return matter(raw);
}

// --- page_type inference -----------------------------------------------------

const PAGE_TYPE_ENUM = new Set([
  'concept', 'framework', 'comparison', 'guide', 'case-linked', 'anti-pattern', 'frontier',
]);

/**
 * Infer the encyclopedia `page_type` from title + body using ordered heuristics.
 * Returns one of the schema enum values. Default when ambiguous = `concept`
 * (the most defensible default: an explanatory page about a thing). Documented
 * in the Task 3 report.
 */
export function inferPageType(title = '', body = '') {
  const t = String(title).toLowerCase();
  const b = String(body).toLowerCase();
  const both = `${t}\n${b}`;

  // 1. anti-pattern — failure-mode pages (checked early so "pitfalls" doesn't fall to comparison).
  if (/\b(pitfall|pitfalls|mistake|mistakes|anti-pattern|antipattern|don't|avoid(ing)?|trap|traps|gotcha|scam|scams|what not to)\b/.test(t)) {
    return 'anti-pattern';
  }

  // 2. comparison — explicit "vs", or a choosing/decision page ("which X", "is X right", "compared").
  if (/\bvs\.?\b|\bversus\b|\bcompared\b|\bcomparison\b/.test(t)) return 'comparison';
  if (/^which\b|\bwhich\b.*\bright\b|^is\b.*\bright\b|\bright for\b|\bchoosing\b|\bchoose\b|\bspectrum\b|\bcustodial\b|\bhot vs|\bcold\b/.test(t)) {
    return 'comparison';
  }

  // 3. guide — actionable how-to pages.
  if (/^how (to|transactions)\b|\bhow to\b|\bguide\b|\bplaybook\b|\bsetting up\b|\bset up\b|\bsetup\b|\brunning\b|\bwriting\b|\bonboarding\b|\bget(ting)? (your )?(first|started)\b|\bfirst \d+ days\b|\bstep(-| )by(-| )step\b|\bmanagement\b|\bplanning\b|\brecovery\b|\bbest practices\b|\bworkflow\b/.test(t)) {
    return 'guide';
  }

  // 4. frontier — emerging/speculative.
  if (/\bfuture of\b|\bfrontier\b|\bemerging\b|\bspeculative\b|\bbeyond\b|\bwhat web3 can('|)t\b/.test(t)) {
    return 'frontier';
  }

  // 5. concept — defined-term / explanatory pages.
  if (/^what (is|are)\b|\bexplained\b|\bunderstanding\b|^why\b|\bwhat it means\b|\bmatters\b|\ba-z\b|\bkey terms\b/.test(t)) {
    return 'concept';
  }

  // 6. framework — models / architectures / systems-for.
  if (/\bframework\b|\bmodel\b|\barchitecture\b|\bmechanism design\b|\bsystem for\b|\bpattern\b|\bstandards?\b|\bontology\b|\btaxonomy\b/.test(t)) {
    return 'framework';
  }

  // 7. case-linked — references a concrete named case/protocol/deployment.
  if (/\bcase stud(y|ies)\b|\bexamples? of\b|\bstories\b|\bprotocol\b|\bgitcoin\b|\bgiveth\b|\bsilvi\b|\bhypercert\b/.test(both) && !/^what (is|are)\b/.test(t)) {
    return 'case-linked';
  }

  // default — explanatory concept page (more defensible than `guide` for ambiguous titles).
  return 'concept';
}

// --- high-risk public-use boundary (Task 6 — CSIS review) --------------------
//
// CSIS check #3 (csis-review SKILL §5: "High-risk content carries a public-use-boundary").
// High-risk here = financial-instrument / custody / security guidance whose ERROR can cause
// REAL loss (funds drained, keys compromised, tax/legal exposure) — not merely a topic that
// mentions money. We deliberately DO NOT classify:
//   - grant/fundraising-strategy pages (program risk, not custody/security risk):
//     funding-landscape, funding-your-node, writing-grant-proposals, gitcoin-grants-qf, rpgf,
//     public-goods-funding, grants-daos-foundations, sustainable-funding-mix, …
//   - pure-concept token explainers (what-are-tokens, token-standards, tokens-coordination-tools).
// We DO classify: wallet/seed-phrase/multisig/treasury/custody/cold-storage/scam/key-management/
// airdrop/stablecoin/gas-fee/tax/org-security/token-design-economics/insurance/recovery topics.
//
// Matched on id + title keywords. The boundary attached is the LIGHTWEIGHT idiomatic form: a
// `public_use_boundary` sub-object on the entry (encyclopedia-entry extends frontmatter — the open
// model permits extra fields; the sub-object validates against schemas/public-use-boundary.yaml).
// Tier = `public-with-caveat`: these pages ARE published on the live site (so not `restricted-*`),
// but carry real risk and need human review before relied upon. The boundary FLAGS for review —
// it does not certify (csis-review is CSIS-informed, not CSIS-conformant).
const HIGH_RISK_RULES = [
  /\bwallets?\b/i,                                   // wallet setup / security / custody
  /seed[- ]?phrase/i,                               // seed phrases (master key)
  /\bmultisig\b|multi-?sig/i,                        // multisig treasury setup
  /\btreasur(y|ies)\b/i,                             // treasury management / custody
  /\bcustod/i,                                       // custodial vs non-custodial
  /hot[- ]?vs[- ]?cold|cold[- ]?storage|hot wallet/i, // hot / cold storage
  /\bscams?\b/i,                                     // scams / fraud prevention
  /key[- ]?management|private[- ]?key/i,             // key management
  /\bairdrop/i,                                      // conducting a token airdrop
  /\bstablecoin/i,                                   // stablecoins (financial instrument)
  /\bgas[- ]?fee/i,                                  // gas fees (loss-on-error)
  /\btax\b|tax[- ]implications/i,                    // tax / legal exposure
  /security best practices|operational security|incident response|security basics/i, // org security
  /token (incentive|economics|supply|airdrop)|tokenomics|community token|social tokens/i, // token design/economics
  /\binsurance\b|risk management/i,                  // insurance / risk
  /recovery[- ]planning/i,                           // key / treasury recovery
];

/**
 * Does this entry (by slug + title) cover a HIGH-RISK financial/security topic that needs a
 * public-use boundary? Returns true/false. (Exported for the test.)
 */
export function isHighRisk(slug = '', title = '') {
  const hay = `${slug} ${title}`;
  return HIGH_RISK_RULES.some((re) => re.test(hay));
}

/**
 * The `public_use_boundary` sub-object for a high-risk entry, or undefined if not high-risk.
 * Validates against schemas/public-use-boundary.yaml (required: [tier]; tier enum). Exported for the test.
 */
export function highRiskBoundary(slug = '', title = '') {
  if (!isHighRisk(slug, title)) return undefined;
  return {
    tier: 'public-with-caveat',
    review_type:
      'high-risk: financial/security guidance — needs human review before relied upon (CSIS check #3)',
  };
}

// --- article → encyclopedia-entry --------------------------------------------

/** Normalize a frontmatter `related` value to an array of slug strings, or undefined. */
function relatedConcepts(frontmatter) {
  const r = frontmatter?.related;
  if (Array.isArray(r) && r.length) return r.map(String);
  return undefined;
}

/**
 * Build a VALID encyclopedia-entry from a parsed article.
 * @param {{slug:string,title:string,description?:string,body?:string,frontmatter?:object}} a
 */
export function articleToEntry(a) {
  const { slug, title, description, frontmatter = {}, body = '' } = a;
  const maturity = HUMAN_REVIEWED.has(slug) ? 'reviewed' : DEFAULT_MATURITY;

  const entry = {
    id: slug,
    title,
    type: 'encyclopedia-entry',
    page_type: inferPageType(title, body),
    maturity,
    public_use: DEFAULT_PUBLIC_USE,
    ai_assisted: true,
    source_lineage: `src/content/docs/${slug}.md`,
  };
  if (description) entry.summary = description;

  const rel = relatedConcepts(frontmatter);
  if (rel) entry.related_concepts = rel;

  // CSIS check #3 — attach a public-use boundary to high-risk financial/security topics.
  const boundary = highRiskBoundary(slug, title);
  if (boundary) entry.public_use_boundary = boundary;

  return entry;
}

// --- concept extraction (conservative) ---------------------------------------

/**
 * Conservative predicate: is this article a "what is X" / defined-term concept article?
 * Criterion: slug begins `what-is-` / `what-are-` (the explicit defined-term pattern),
 * OR title begins "What is/are X" and is NOT a how-to/comparison/pitfall. Deliberately
 * narrow to avoid over-extraction (target ~10–25, not 119).
 */
export function isConceptArticle(slug = '', title = '') {
  const s = String(slug);
  const t = String(title).toLowerCase();
  if (/\b(vs\.?|versus|how to|pitfall|guide|playbook|right\?|setting up)\b/.test(t)) return false;
  if (/^what-(is|are)-/.test(s)) return true;
  if (/^what (is|are)\b/.test(t)) return true;
  return false;
}

/** Strip leading "What is/are " and trailing "?" to get the bare term, Title-Cased lightly. */
function conceptTitle(title) {
  return String(title)
    .replace(/^\s*what\s+(is|are)\s+(a|an|the)?\s*/i, '')
    .replace(/\?\s*$/, '')
    .trim() || String(title).trim();
}

/**
 * Build a VALID concept-lineage from a parsed "what is X" article.
 * Honest: does NOT fabricate source_traditions / distinctions we don't have.
 */
export function articleToConcept(a) {
  const { slug, title, description } = a;
  const concept = {
    id: slug,
    title: conceptTitle(title),
    type: 'concept-lineage',
    maturity: 'draft',
    ai_assisted: true,
    source_lineage: `src/content/docs/${slug}.md`,
  };
  if (description) concept.short_description = description;
  // source_traditions / adjacent_meanings / important_distinctions intentionally omitted —
  // not invented (honest-state). A human lineage pass (Layer 4 owner) fills these in.
  return concept;
}

// --- journey → track (Task 4) ------------------------------------------------

/** Flatten a journey's chapters → the ordered list of step slugs (the entry ids). */
function journeyStepSlugs(journey) {
  return (journey.chapters || []).flatMap((c) => (c.steps || []).map((s) => s[0]));
}

/**
 * Map a site journey (src/data/journeys.js) → a framework `track` object (Layer 7).
 * This is the DERIVED framework view; journeys.js stays the site's source of truth
 * (per Task 1, docs/reports/2026-06-17-content-through-framework-report.md).
 *
 * Honest-state: maturity = `field-informed` (Heenal's curated v1 journeys), NOT `reviewed`;
 * `options` left empty (journeys carry no option ids — not fabricated); `outcome[]` carried over
 * as an array of strings (schema's `outcome` is an array, like the journey's).
 */
export function journeyToTrack(journey) {
  const track = {
    id: journey.id,
    title: journey.label,
    type: 'track',
    audience: String(journey.kicker || '').trim(),
    outcome: (journey.outcome || []).map(String),
    concepts: journeyStepSlugs(journey),
    options: [], // journeys don't carry option ids — do not fabricate.
    maturity: TRACK_MATURITY,
    ai_assisted: false, // hand-authored by Heenal (the v1 journeys are curated, not AI-drafted).
    source_lineage: `src/data/journeys.js#${journey.id}`,
  };
  // starting_context ← intro (best semantic home per Task 1), falling back to tagline.
  const startingContext = journey.intro || journey.tagline;
  if (startingContext) track.starting_context = String(startingContext).trim();
  return track;
}

/** Derive a `track` object from each journey in the journeys map (insertion order preserved). */
export function deriveTracks(journeysMap = journeys) {
  return Object.values(journeysMap).map(journeyToTrack);
}

// --- Task 5: salvage helpers -------------------------------------------------

/**
 * Tolerant frontmatter parser for the LEGACY `content/` corpus.
 *
 * The live articles (`src/content/docs/*.md`) use standard `---`…`---` frontmatter, which
 * gray-matter parses fine. But ~80% of the legacy `content/` files are MALFORMED: they begin
 * with a blank line, then bare YAML keys, terminated by a single lone `---` (NO opening `---`).
 * gray-matter requires the doc to START with `---`, so it returns `{ data: {} }` for these and
 * loses the title. This parser recovers both shapes, plus an H1 fallback for the few stubs that
 * carry their title only as a leading `# Heading` (no YAML title at all). Returns { data, content }.
 */
export function tolerantFrontmatter(raw) {
  const s = String(raw).replace(/^﻿/, '');

  // 1. Standard frontmatter — split on `---`…`---`, then parse the YAML leniently. We do NOT use
  // gray-matter here: some legacy files have DUPLICATE mapping keys (e.g. `status:` twice), which
  // js-yaml's strict load (gray-matter's default) throws on. `{ json: true }` is lenient (last wins).
  const std = s.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (std) {
    const data = loadYamlLenient(std[1]);
    if (data) return ensureTitle(data, std[2]);
    return ensureTitle({}, s);
  }

  // 2. Legacy: optional leading blank line(s), YAML keys, then a lone `---`, then the body.
  const stripped = s.replace(/^(?:\s*\r?\n)+/, '');
  const m = stripped.match(/^([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (m && /^[A-Za-z0-9_-]+\s*:/.test(stripped)) {
    const data = loadYamlLenient(m[1]);
    if (data) return ensureTitle(data, m[2]);
  }

  // 3. No parseable frontmatter — keep the whole thing as body, recover an H1 title if present.
  return ensureTitle({}, s);
}

/** Parse a YAML mapping leniently (tolerates duplicate keys — last wins). Returns object or null. */
function loadYamlLenient(src) {
  try {
    const data = yaml.load(src, { json: true });
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/** If `data` has no `title`, recover one from the body's first `# H1` heading (honest fallback). */
function ensureTitle(data, content) {
  if (!data.title) {
    const h1 = String(content).match(/^\s*#\s+(.+?)\s*$/m);
    if (h1) data = { ...data, title: h1[1].trim() };
  }
  return { data, content };
}

/**
 * Build a VALID encyclopedia-entry from a SALVAGED legacy/other-branch article.
 * Same shape as `articleToEntry`, but with salvage provenance and NEVER promoted:
 *   maturity=draft, public_use=source-linked-unreviewed, ai_assisted=true (old AI pipeline),
 *   salvaged_from + source_lineage = the legacy path. `legacy_status` carries the pipeline's
 *   own `status` (e.g. `not-started`) so a human triage pass can see the stub/published split.
 */
export function articleToSalvagedEntry(a) {
  const { slug, title, description, frontmatter = {}, body = '', source } = a;
  const entry = {
    id: slug,
    title: title || slug,
    type: 'encyclopedia-entry',
    page_type: inferPageType(title || slug, body),
    maturity: DEFAULT_MATURITY,            // draft — never `reviewed` (HUMAN_REVIEWED is empty)
    public_use: DEFAULT_PUBLIC_USE,        // source-linked-unreviewed
    ai_assisted: true,
    source_lineage: source,
    salvaged_from: source,                 // explicit salvage provenance (open-model extra field)
  };
  if (description) entry.summary = description;
  const rel = relatedConcepts(frontmatter);
  if (rel) entry.related_concepts = rel;
  // CSIS check #3 — same high-risk boundary attachment for the salvaged pass.
  const boundary = highRiskBoundary(slug, title || slug);
  if (boundary) entry.public_use_boundary = boundary;
  // Carry the pipeline's own status into notes so the stub/published split is visible (honest).
  const legacyStatus = frontmatter.status ? String(frontmatter.status) : undefined;
  if (legacyStatus) entry.notes = `legacy pipeline status: ${legacyStatus}`;
  return entry;
}

/**
 * Build a VALID `resource` object from a SALVAGED research dump (a deep-research markdown report).
 * Kept RAW — these are unreviewed research artifacts, never auto-promoted:
 *   maturity=raw, public_use=raw-lead, resource_type=research-dump, salvaged_from + source_lineage.
 */
export function researchDumpToResource(d) {
  const { slug, title, body = '', source } = d;
  const res = {
    id: slug,
    title: title || slug,
    type: 'resource',
    resource_type: 'research-dump',
    maturity: 'raw',
    public_use: 'raw-lead',
    ai_assisted: true,
    source_lineage: source,
    salvaged_from: source,
    original_source: source,
  };
  // First non-empty prose line → a one-line summary (honest, not fabricated).
  const firstLine = String(body)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#') && !l.startsWith('---'));
  if (firstLine) res.notes = firstLine.replace(/[*_`]/g, '').slice(0, 280);
  return res;
}

/** Recursively collect every `*.md` file under `dir` (absolute paths). */
function walkMarkdown(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walkMarkdown(p));
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

/**
 * Enumerate the SALVAGE survivor articles from the legacy `content/` tree.
 *
 * Scope (per Task 5): only markdown under content/{1-foundations,2-applied,3-playbooks}, EXCLUDING
 *   - any `working/` subdir (pipeline intermediates: research/factcheck/critique/review), and
 *   - `content/archive-pipeline-v1/` (a nested archive — superseded by definition; not under our dirs).
 * Dedup: a candidate is a SURVIVOR iff its leaf slug ∉ `liveSlugs` (the 119 live articles).
 * When a survivor leaf slug appears in >1 path, the FIRST in sorted order wins (deterministic);
 * the discarded duplicate paths are returned on the survivor as `dupPaths` for the report.
 *
 * Returns the survivor objects { slug, title, description, body, frontmatter, source, dupPaths }.
 */
export function readSalvageCandidates(liveSlugs, contentDir = CONTENT_DIR) {
  const files = SALVAGE_SUBDIRS
    .flatMap((sub) => walkMarkdown(join(contentDir, sub)))
    .filter((p) => !/\/working\//.test(p))
    .sort();

  const bySlug = new Map();
  for (const abs of files) {
    const slug = abs.split('/').pop().replace(/\.md$/, '');
    if (liveSlugs.has(slug)) continue;                 // superseded → dropped (recorded by caller)
    const source = relative(REPO_ROOT, abs);
    if (!bySlug.has(slug)) {
      const { data, content } = tolerantFrontmatter(readFileSync(abs, 'utf8'));
      bySlug.set(slug, {
        slug,
        title: data.title ? String(data.title) : slug,
        description: data.description ? String(data.description) : undefined,
        body: content,
        frontmatter: data,
        source,
        dupPaths: [],
      });
    } else {
      bySlug.get(slug).dupPaths.push(source);          // deterministic: first sorted path wins
    }
  }
  return [...bySlug.values()];
}

/** The 119 live slugs (the canonical superseded set) — leaf names of src/content/docs/*.md. */
export function liveSlugs(docsDir = DOCS_DIR) {
  return new Set(
    readdirSync(docsDir).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')),
  );
}

// Test affordance: lets a test reuse the REAL live slug set without re-globbing in the test file.
readSalvageCandidates.__liveSlugsForTest = () => [...liveSlugs()];

/** Read each refidao research dump from the read-only archive tag via `git show`. */
export function readResearchDumps(ref = RESEARCH_ARCHIVE_REF, paths = RESEARCH_DUMP_PATHS) {
  return paths.map((p) => {
    const raw = execSync(`git show ${ref}:${p}`, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    const { data, content } = tolerantFrontmatter(raw);
    const slug = p.split('/').pop().replace(/\.md$/, '');
    return {
      slug,
      title: data.title ? String(data.title) : slug,
      body: content,
      source: `${ref}:${p}`,
    };
  });
}

// --- main --------------------------------------------------------------------

/** Read + parse every article into { slug, title, description, body, frontmatter }. */
export function readArticles(docsDir = DOCS_DIR) {
  return readdirSync(docsDir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => {
      const slug = f.replace(/\.md$/, '');
      const { data, content } = parseFrontmatter(readFileSync(join(docsDir, f), 'utf8'));
      return {
        slug,
        title: data.title ? String(data.title) : slug,
        description: data.description ? String(data.description) : undefined,
        body: content,
        frontmatter: data,
      };
    });
}

/**
 * Task 5 harvest pass — salvage non-superseded legacy + other-branch content into SEPARATE files
 * (data/encyclopedia-salvaged.yaml, data/resources-salvaged.yaml), leaving the canonical
 * data/encyclopedia.yaml / data/resources.yaml / data/concepts.yaml / data/tracks.yaml untouched
 * (preserves Task 3's byte-identical invariant; idempotent — never clobbered by the canonical pass).
 * Validates every emitted object via the framework API and REFUSES to write on any failure.
 */
export function harvest() {
  const live = liveSlugs();
  const survivors = readSalvageCandidates(live);
  const salvagedEntries = survivors.map(articleToSalvagedEntry);

  const dumps = readResearchDumps();
  const salvagedResources = dumps.map(researchDumpToResource);

  // Validate EVERYTHING before writing. Refuse on any invalid object (same gate as main()).
  const failures = [];
  for (const e of salvagedEntries) {
    const { valid, errors } = validateObject('encyclopedia-entry', e);
    if (!valid) failures.push(`salvaged encyclopedia-entry ${e.id}: ${errors.join('; ')}`);
  }
  for (const r of salvagedResources) {
    const { valid, errors } = validateObject('resource', r);
    if (!valid) failures.push(`salvaged resource ${r.id}: ${errors.join('; ')}`);
  }
  if (failures.length) {
    console.error(`✖ ${failures.length} salvaged object(s) failed framework validation — refusing to write:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
    return { ok: false, failures };
  }

  const dumpOpts = { lineWidth: 200, quotingType: '"', forceQuotes: false, sortKeys: false };

  const encSalvagedDoc = {
    schema_version: '0.1.0',
    generated_from: 'content/{1-foundations,2-applied,3-playbooks}/**.md (legacy pipeline, working-tree)',
    generated_at: SALVAGE_GENERATED_AT,
    generator: 'scripts/process-content.mjs (harvest)',
    honest_state_note:
      'SALVAGED legacy/other-branch articles NOT superseded by the 119 live articles (dedup by leaf ' +
      'slug). These are old AI-pipeline drafts — most are `not-started` stubs. maturity=draft, ' +
      'public_use=source-linked-unreviewed, ai_assisted=true; NEVER reviewed. Separate file so the ' +
      'canonical data/encyclopedia.yaml (119=119, byte-identical) is preserved. Human triage needed ' +
      '(see notes: legacy pipeline status). See docs/reports/2026-06-17-content-through-framework-report.md.',
    entries: salvagedEntries,
  };

  const resSalvagedDoc = {
    schema_version: '0.1.0',
    generated_from: `${RESEARCH_ARCHIVE_REF}:research/*.md (read-only archive tag)`,
    generated_at: SALVAGE_GENERATED_AT,
    generator: 'scripts/process-content.mjs (harvest)',
    honest_state_note:
      'SALVAGED deep-research dumps from the refidao archive branch. Kept RAW — unreviewed research ' +
      'artifacts. maturity=raw, public_use=raw-lead, ai_assisted=true; NEVER auto-promoted. Separate ' +
      'file so the canonical data/resources.yaml (V3 lift) is preserved.',
    resources: salvagedResources,
  };

  writeFileSync(ENCYCLOPEDIA_SALVAGED_OUT, yaml.dump(encSalvagedDoc, dumpOpts));
  writeFileSync(RESOURCES_SALVAGED_OUT, yaml.dump(resSalvagedDoc, dumpOpts));

  // Report.
  const dupCount = survivors.reduce((n, s) => n + s.dupPaths.length, 0);
  const statusDist = survivors.reduce((acc, s) => {
    const st = s.frontmatter?.status ? String(s.frontmatter.status) : 'none';
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {});
  console.log(`✓ ${salvagedEntries.length} salvaged encyclopedia entries → ${ENCYCLOPEDIA_SALVAGED_OUT}`);
  console.log(`    (deduped ${dupCount} duplicate-path survivor(s); all maturity=draft, ai_assisted=true)`);
  console.log('    legacy status distribution:');
  for (const [k, v] of Object.entries(statusDist).sort((x, y) => y[1] - x[1])) {
    console.log(`      ${String(v).padStart(4)} — ${k}`);
  }
  console.log(`✓ ${salvagedResources.length} salvaged research dumps → ${RESOURCES_SALVAGED_OUT} (all maturity=raw)`);
  return { ok: true, salvagedEntries, salvagedResources, survivors, statusDist };
}

export function main() {
  const articles = readArticles();

  const entries = articles.map(articleToEntry);
  const concepts = articles.filter((a) => isConceptArticle(a.slug, a.title)).map(articleToConcept);
  const tracks = deriveTracks(journeys); // Task 4 — derived framework view of the site journeys.

  // Validate EVERYTHING through the framework before writing. Refuse on any invalid object.
  const failures = [];
  for (const e of entries) {
    const { valid, errors } = validateObject('encyclopedia-entry', e);
    if (!valid) failures.push(`encyclopedia-entry ${e.id}: ${errors.join('; ')}`);
  }
  for (const c of concepts) {
    const { valid, errors } = validateObject('concept-lineage', c);
    if (!valid) failures.push(`concept-lineage ${c.id}: ${errors.join('; ')}`);
  }
  for (const t of tracks) {
    const { valid, errors } = validateObject('track', t);
    if (!valid) failures.push(`track ${t.id}: ${errors.join('; ')}`);
  }
  if (failures.length) {
    console.error(`✖ ${failures.length} object(s) failed framework validation — refusing to write:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
    return { ok: false, failures };
  }

  const header = (kind, list, generator) => ({
    schema_version: '0.1.0',
    generated_from: 'src/content/docs/*.md',
    generated_at: GENERATED_AT,
    generator,
    honest_state_note:
      'AI-pipeline drafts (live on Heenal v1 site) — NOT human-reviewed. maturity=draft, ' +
      'public_use=source-linked-unreviewed, ai_assisted=true. See docs/MASTER.md.',
    [kind]: list,
  });

  // Tracks have a distinct source/date/honest-note (derived from journeys.js, not the articles).
  const tracksDoc = {
    schema_version: '0.1.0',
    generated_from: 'src/data/journeys.js',
    generated_at: TRACKS_GENERATED_AT,
    generator: 'scripts/process-content.mjs',
    honest_state_note:
      "Derived from Heenal's curated v1 journeys (src/data/journeys.js). Tracks are the " +
      'framework view; journeys.js stays the site source of truth. maturity=field-informed ' +
      '(hand-authored v1, NOT auto-promoted to reviewed); options left empty (not fabricated).',
    tracks,
  };

  const dumpOpts = { lineWidth: 200, quotingType: '"', forceQuotes: false, sortKeys: false };
  writeFileSync(ENCYCLOPEDIA_OUT, yaml.dump(header('entries', entries, 'scripts/process-content.mjs'), dumpOpts));
  writeFileSync(CONCEPTS_OUT, yaml.dump(header('concepts', concepts, 'scripts/process-content.mjs'), dumpOpts));
  writeFileSync(TRACKS_OUT, yaml.dump(tracksDoc, dumpOpts));

  // Report.
  const dist = entries.reduce((acc, e) => ((acc[e.page_type] = (acc[e.page_type] || 0) + 1), acc), {});
  console.log(`✓ ${entries.length} encyclopedia entries → ${ENCYCLOPEDIA_OUT}`);
  console.log(`✓ ${concepts.length} concept-lineage candidates → ${CONCEPTS_OUT}`);
  console.log('  page_type distribution:');
  for (const [k, v] of Object.entries(dist).sort((x, y) => y[1] - x[1])) {
    console.log(`    ${String(v).padStart(4)} — ${k}`);
  }
  console.log(`  maturity: all "${DEFAULT_MATURITY}" (HUMAN_REVIEWED allowlist size: ${HUMAN_REVIEWED.size})`);
  console.log(`  public_use: all "${DEFAULT_PUBLIC_USE}", ai_assisted: true`);
  console.log(`✓ ${tracks.length} tracks (from journeys.js) → ${TRACKS_OUT}`);
  for (const t of tracks) {
    console.log(`    ${t.id}: "${t.title}" — ${t.concepts.length} concepts, maturity=${t.maturity}`);
  }

  // Task 5 — salvage pass (separate files; canonical outputs above are untouched).
  const salvage = harvest();
  if (!salvage.ok) return salvage;

  return { ok: true, entries, concepts, tracks, dist, salvage };
}

// Guard: only run when invoked directly (so the test can import functions side-effect-free).
// pathToFileURL handles spaces/percent-encoding in the path (this repo lives under "03 Libraries").
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
