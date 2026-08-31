// Triage coverage audit for the Linear seeding pipeline. Pure, no I/O, never throws.
//
// Mirrors the directory idiom (tasks.mjs / members.mjs / heartbeat.mjs): this module only
// reports, it does not decide. It exists to give the HEARTBEAT.md triage pass a machine-checked
// finish line instead of a judgement call — the pass is done when `clean` is true.
//
// `isPerson` is injected rather than imported so this stays pure and testable without a
// member registry on disk. Callers bind it to resolveOwner(loadMembers(...), hint). This is
// load-bearing: the `**Name —**` prefix also matches phase and topic prefixes (`T1`, `T3a`,
// `SP11`, `Infra`), so an ownerHint being non-null does NOT mean the item has an owner.
export function auditCoverage(items, isPerson) {
  const open = items.filter((i) => i.state === "open");
  const missingId = open.filter((i) => !i.id);
  const missingOwner = open.filter((i) => !isPerson(i.ownerHint));

  const bySection = {};
  for (const item of items) {
    bySection[item.section] ??= { open: 0, done: 0, superseded: 0 };
    bySection[item.section][item.state] += 1;
  }

  return {
    total: items.length,
    open: open.length,
    missingId,
    missingOwner,
    bySection,
    clean: missingId.length === 0 && missingOwner.length === 0,
  };
}
