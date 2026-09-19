// src/executor.mjs
// Reads a lifecycle event's ordered op-names, resolves each via the op registry, and runs
// exec ops in order. Fail policy: write ops fail-hard (stop, no partial corruption);
// read/render ops fail-soft (log + continue). Skill directives are collected for the agent.
import { LIFECYCLE_BINDINGS } from './bind.mjs';
import { OPS as DEFAULT_OPS } from './ops.mjs';

export function runLifecycle(event, ctx = {}, deps = {}) {
  const events = deps.events || LIFECYCLE_BINDINGS;
  const ops = deps.ops || DEFAULT_OPS;
  const names = events[event];
  if (!names) throw new Error(`unknown lifecycle event: ${event}`); // synchronous: config error, fail fast before any async work

  return (async () => {
    const report = { event, ran: [], skills: [], errors: [] };
    for (const name of names) {
      const op = ops[name];
      if (!op) { report.errors.push(`unregistered op: ${name}`); return report; } // config error → fail-hard
      if (op.kind === 'skill') { report.skills.push(op.skill); continue; }
      try {
        const res = (await op.run(ctx)) || {};
        const ok = res.ok !== false;
        report.ran.push({ op: name, ok, report: res.report });
        // A write op that REPORTS failure (without throwing) is also fail-hard: the real write
        // ops (bridge) signal errors via { ok:false }, not exceptions.
        if (!ok && op.write) { report.errors.push(`${name}: reported failure`); return report; }
      } catch (e) {
        report.errors.push(`${name}: ${e.message}`);
        if (op.write) return report; // fail-hard on throw
        // else fail-soft: continue
      }
    }
    return report;
  })();
}
