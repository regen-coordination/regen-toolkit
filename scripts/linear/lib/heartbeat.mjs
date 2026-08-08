// HEARTBEAT.md parser for the Linear seeding pipeline. Pure, no I/O, never throws.
//
// Mirrors the directory idiom (tasks.mjs / members.mjs): this module only extracts structure
// from text. It does not decide what is valid or who is a person — that is downstream work.
//
// Deliberate design point: the `**Name —**` prefix at the start of a checkbox item is a HINT,
// not an owner. Verified against the live file, the same shape also matches phase prefixes
// (`T1`, `T3a`, `T4 core`), topic prefixes (`Infra`, `Group`, `Joint`, `SP11`), and even a bare
// sentence used as a heading-like item. So the field is `ownerHint`, and it is on the caller
// (resolveOwner in members.mjs, against data/members.yaml) to decide whether it names a person.
// This module stays dumb on purpose — do not add owner filtering here.
//
// `text` is markdown, not a title: it still carries `**bold**`, `[links](...)`, emoji, and
// (on items where trailing content followed the removed id, e.g. the Handoff Integration
// `[x]` items) a dangling "— ✅" or "— ✅ (remainder logged in master plan)". That's a
// defensible, honest parse of the source — do not silently launder it into title case
// upstream without deciding that on purpose.
//
// `section` is display-only provenance prose (it appears in the issue-body footer). It is
// NOT a stable key: cleaned headings still embed volatile status ("... — DONE",
// "... — IN PROGRESS") that drifts as work completes. Identity, dedupe and idempotency run
// off the task `id`, never off `section` — do not build routing on it.
const HEADING_RE = /^#{2,3}\s+(.+)/;
const CHECKBOX_RE = /^-\s+\[([ xX~])\]\s+(.+)/;

// NOT anchored to end-of-line. Verified against the live HEARTBEAT.md: several `[x]` lines
// carry the id mid-line, followed by a trailing "✅" or a parenthetical aside
// (e.g. "... — `task-260715-handoff-t4-framework-evolution` ✅ (remainder logged in master plan)").
// An end-anchored `\`(task-[a-z0-9-]+)\`\s*$` silently fails to capture the id on exactly those
// lines (six of them in the live file). We instead take the LAST backtick-wrapped task-id span
// found anywhere in the line — matching the common case (id truly at the end) and staying
// correct on the one live line that names three ids (two cross-referenced elsewhere in the
// sentence, the item's own id last): the last one is always the one that belongs to this item.
const TASK_ID_RE = /`(task-[a-z0-9-]+)`/g;

// Anchored to the start of the item text on purpose: only a bold span opening the line, if
// immediately followed by " —", counts as an owner hint. Measured against the live file: of
// the items with no owner hint under this anchored form, 22 contain a LATER bold span shaped
// like "**Name — ...**" that an unanchored version of this regex would wrongly promote to
// ownerHint (e.g. a mid-sentence "loop in **Rather + Regis**" aside on an otherwise Luiz-owned
// item). The anchor is what keeps those 22 from becoming garbage hints; it is not needed to
// prefer an item's own leading hint over a later one — `.match()` already returns the
// leftmost match, so on lines where the leading span *is* real content (not a decoy), removing
// the anchor happens not to change the answer. The 22 is the number that matters.
// The character class excludes `*` (so it stops at the bold-close) and `—` (so it stops at the
// hint/description separator); it does NOT exclude hyphens, `&`, `/`, or parentheses, so a
// compound hint that legitimately opens the line (none observed in the live file, but not
// assumed impossible) would be captured whole, e.g. "Rather + Regis" if that were the leading
// bold span. Resolving whether a hint is one person, several, or not a person is out of scope.
const OWNER_RE = /^~*\*\*([^—*]+?)\s+—/;

// Zero `(due:` occurrences anywhere in the live HEARTBEAT.md today — this regex is currently
// dead against real content. Kept anyway: scripts/initialize.mjs extracts `due` today and the
// Linear-seeding dashboard refactor (next task) must preserve that parity. Pinned by a
// synthetic fixture line so "dead" doesn't silently become "wrong".
const DUE_RE = /\(due:\s*(\d{4}-\d{2}-\d{2})\)/i;

const STATE = { " ": "open", x: "done", X: "done", "~": "superseded" };

function cleanSection(heading) {
  return heading.replace(/_\(.*?\)_/g, "").replace(/\*\(.*?\)\*/g, "").replace(/\s+/g, " ").trim();
}

// Returns the last task-id backtick span in `raw`, or null. "Last" matters twice over: it is
// what makes end-of-line trailing content (✅, parentheticals) harmless, and it is the
// documented tie-break on the one live line that names three task ids.
function lastTaskIdMatch(raw) {
  let last = null;
  for (const m of raw.matchAll(TASK_ID_RE)) last = m;
  return last;
}

export function parseHeartbeat(markdown) {
  if (typeof markdown !== "string") return [];

  const items = [];
  let section = "";

  for (const line of markdown.split("\n")) {
    const heading = line.match(HEADING_RE);
    if (heading) {
      section = cleanSection(heading[1]);
      continue;
    }

    const box = line.match(CHECKBOX_RE);
    if (!box) continue;

    const raw = box[2].trim();
    // Skip a checkbox item whose entire text is an italicized aside — a parked note, not a
    // real task — in either markdown italic convention the file uses: "_(...)_" or "*(...)*".
    // No line in the live corpus currently matches; kept because it's cheap and is the kind of
    // thing that silently reappears in a future edit of HEARTBEAT.md.
    if (
      (raw.startsWith("_(") && raw.endsWith(")_")) ||
      (raw.startsWith("*(") && raw.endsWith(")*"))
    ) {
      continue;
    }

    const idMatch = lastTaskIdMatch(raw);
    const ownerMatch = raw.match(OWNER_RE);
    const dueMatch = raw.match(DUE_RE);

    // Remove the id span itself (wherever it falls), then collapse whitespace and drop a
    // trailing " — " left behind when the id was the last thing on the line. When trailing
    // content follows the id (✅, a parenthetical), that content is intentionally left in
    // place rather than guessed away — e.g. "...registered. — ✅" stays as-is.
    let text = idMatch ? raw.slice(0, idMatch.index) + raw.slice(idMatch.index + idMatch[0].length) : raw;
    text = text.replace(/\s+/g, " ").replace(/\s+—\s*$/, "").trim();

    items.push({
      id: idMatch ? idMatch[1] : null,
      // A hint only. `**T1 —**`, `**SP11 —**` and `**Infra —**` match this shape too.
      // Resolve against data/members.yaml before treating it as a person.
      ownerHint: ownerMatch ? ownerMatch[1].trim() : null,
      state: STATE[box[1]],
      section,
      due: dueMatch ? dueMatch[1] : null,
      text,
      raw,
    });
  }

  return items;
}
