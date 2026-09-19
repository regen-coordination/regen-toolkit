/**
 * QUILT view model — maps registry data to patch/pod specs.
 * Hand-authored prose (taglines, overrides, garden groups) lives HERE as
 * template constants; everything numeric/status comes from data.
 */

export const SHADE_MATURITY = { production: "█", beta: "▓", alpha: "▒" };
export const SHADE_PROJECT = { Develop: "▓", Discovery: "▒" };

export function instanceShade(maturity) {
  const s = SHADE_MATURITY[maturity];
  if (!s) console.warn(`quilt: unknown maturity "${maturity}" — rendering ▒`);
  return s ?? "▒";
}

/** Short display id: strip -os suffix, refi-/regen- prefixes kept readable. */
export const shortId = (id) =>
  id.replace(/-os$/, "").replace(/^regen-coordination$/, "regen-coord");

export function monthsAgo(iso, now) {
  if (!iso) return null;
  return (now - new Date(iso)) / (30 * 86400000);
}

/** Round to nearest half month: 2mo, 3.5mo; null → ∅ */
export function fmtAge(months) {
  if (months == null) return "∅";
  const h = Math.round(months * 2) / 2;
  return `${Number.isInteger(h) ? h : h.toFixed(1)}mo`;
}

const mmdd = (iso) => iso.slice(5);

/** One federation patch spec {title, lines} from an instances.yaml entry. */
export function instancePatch(inst) {
  const shade = instanceShade(inst.maturity);
  const head =
    ` ${inst.type}·${inst.maturity}` +
    (inst.federation_role === "hub" ? "·hub" : "") + " ";
  const pkgsLine =
    ` pkgs ×${(inst.packages ?? []).length}` +
    ((inst.skills_extra ?? []).length ? ` · +${inst.skills_extra.length} skills` : "") + " ";
  const drift = (inst.drift ?? []).length ? `drift ☓${inst.drift.length}` : "drift ✓";
  // alpha instances aren't meaningfully drift-tracked yet, so a clean alpha omits
  // the "drift ✓" segment entirely (drift ☓n still shows if flags exist).
  const syncLine = inst.maturity === "alpha" && !(inst.drift ?? []).length
    ? ` sync ${inst.last_sync ? mmdd(inst.last_sync) : "∅"} `
    : ` sync ${inst.last_sync ? mmdd(inst.last_sync) : "∅"} · ${drift} `;
  const lines = inst.maturity === "production"
    ? [head, pkgsLine, syncLine]
    : [head, syncLine];
  return { title: `${shortId(inst.id)} ${shade}`, lines };
}

/** `ledger: freshest Nmo » … » never ∅` — freshest first, null last. */
export function syncLedger(instances, now) {
  const parts = [...instances]
    .map((i) => ({ id: shortId(i.id), m: monthsAgo(i.last_sync, now) }))
    .sort((a, b) => (a.m ?? Infinity) - (b.m ?? Infinity))
    .map((x) => `${x.id} ${fmtAge(x.m)}`);
  return "ledger: " + parts.join(" » ");
}

/** Hand-authored patch detail lines (creative residue). Derived default otherwise. */
export const PKG_DETAIL = {
  "toolkit-framework": [" 167/167 ✓ "],
  "org-os-kms": [" 44/44 ✓ "],
  "org-os-federation-map": [" the torch·d3 "],
  operations: [" bcn·dao "],
  "regen-agents": [" bcn·dao "],
  webapps: [" bcn·dao "],
  "hermes-integration": [" page auto-tool "],
  "opencode-integration": [" 2 tools·5 cmds "],
  "paperclip-agents-app": [" rgc fork AHEAD ", " backport pending "],
  dashboard: [" bcn+dao ", " » fw template "],
};

export const PKG_SHORT = {
  "toolkit-framework": "toolkit", "org-os-kms": "kms",
  "org-os-federation-map": "fed-map", "hermes-integration": "hermes",
  "opencode-integration": "opencode", "paperclip-agents-app": "paperclip",
};

const pkgShort = (id) => PKG_SHORT[id] ?? id;

function pkgShade(p) {
  if (/AHEAD|⚠/.test(p.notes ?? "")) return "☓";
  if (p.promotion_status === "candidate") return "⊕";
  if (p.promotion_status === "evaluating") return "▓";
  return "█";
}

/** Route packages-matrix entries into { patches, sleeping, away }. */
export function packageTiers(pkgs) {
  const patches = [], sleeping = [], away = [];
  for (const p of pkgs) {
    const shade = pkgShade(p);
    // ☓ (fork-ahead) and ⊕ (promotion candidate) are important travelers —
    // always a patch, even when out-of-framework (e.g. dashboard).
    if (shade === "☓" || shade === "⊕" || (p.in_framework && p.lifecycle_status === "active")) {
      const lines = PKG_DETAIL[p.id] ??
        [` ${(p.instances_using ?? []).map(shortId).join("·") || p.lifecycle_status} `];
      if (!PKG_DETAIL[p.id]) console.warn(`quilt: no PKG_DETAIL for "${p.id}" — derived line used`);
      patches.push({ title: `${pkgShort(p.id)} ${shade}`, lines });
    } else if (!p.in_framework) {
      away.push(`(${pkgShort(p.id)}${shade !== "█" ? ` ${shade}` : ""})`);
    } else {
      sleeping.push(
        p.lifecycle_status === "planned" ? `(${pkgShort(p.id)} » planned)` : `(${pkgShort(p.id)})`,
      );
    }
  }
  return { patches, sleeping, away };
}

/** Hand-authored Develop-project patch lines. */
export const PROJECT_DETAIL = {
  "v2-stabilization": [" v3 tag local only ", " changelog pending "],
  "federation-protocol": [" e2e sync queued ", " » autopoiesis p2 "],
  "instance-orchestration": [" drift 27»0 ✓ ", " backports ×3 "],
  "skill-promotion": [" v0.5 wave ✓ ", " dao-wave next "],
  "cloudflare-os-integration": [" M1+M2 core ✓ ", " M0 probe pending "],
};

export const PROJECT_SHORT = {
  "v2-stabilization": "v2-stab", "federation-protocol": "federation",
  "instance-orchestration": "orchestration", "skill-promotion": "skill-promo",
  "package-integration": "pkg-integration·multica", "non-tech-onboarding": "onboarding",
  "instance-bootstrap": "bootstrap", "opal-rollout": "opal",
  "operator-interfaces": "operator-interfaces", "framework-evolution": "evolution » autopoiesis",
  reliability: "reliability", "cloudflare-os-integration": "cloudflare-os",
};

const projShort = (id) => PROJECT_SHORT[id] ?? id;

/** Route projects.yaml entries into { patches, discovery }. */
export function projectTiers(projects) {
  const patches = [], discovery = [];
  for (const p of projects) {
    if (p.status === "Develop") {
      const lines = PROJECT_DETAIL[p.id] ?? [" develop "];
      if (!PROJECT_DETAIL[p.id]) console.warn(`quilt: no PROJECT_DETAIL for "${p.id}"`);
      patches.push({ title: `${projShort(p.id)} ${SHADE_PROJECT.Develop}`, lines });
    } else {
      discovery.push(`(${projShort(p.id)})`);
    }
  }
  return { patches, discovery };
}

/** Tally skills-matrix promotion_status values. */
export function skillCounts(skills) {
  const c = { canonical: 0, evaluating: 0, candidate: 0, "instance-specific": 0, total: 0 };
  for (const s of skills) {
    c.total++;
    if (c[s.promotion_status] == null) {
      console.warn(`quilt: unknown promotion_status "${s.promotion_status}" (${s.id})`);
      continue;
    }
    c[s.promotion_status]++;
  }
  return c;
}

/** Hand-curated garden domains (template). Membership is prose, counts are data. */
export const GARDEN_GROUPS = {
  "█ lifecycle": ["(initialize)", "(org-os-init)", "(bootstrap-interviewer)", "(commands)"],
  "█ discipline": ["(superpowers ×9 · tdd·debug·plans·worktrees·reviews)"],
  "█ org-ops": ["(heartbeat)", "(meetings)", "(funding)", "(ideas)"],
  "█ knowledge": ["(curator)", "(research)", "(web-browsing)", "(notion-cli)", "(canvas)"],
  "█ builders": ["(skill-creator)", "(mcp)", "(frontend)", "(artifacts)", "(schema-gen)"],
  "█ mentors": ["(feynman)", "(karpathy)", "(workspace)", "(transcription)"],
};
