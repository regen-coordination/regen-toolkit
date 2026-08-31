# Draft — message to Rather (send directly, not on the board)

> Draft-and-present. Telegram or a call. Not Linear.

---

Hey — fair hit on the Linear comments, both removed. My agent wrote on KC-5 without asking you and
that was my call to let through, not yours to absorb. Won't happen again on anything you own.

Two things I do want to put to you directly, human to human:

**1. The staging/prod thing — you're probably right.**

I stood up two Workers on 08-08 as a bootstrap before the handover. My reasoning was that the dev
branch renders `/validation`, `/kb` and the handoff pages and I didn't want those reachable from
prod. If branch previews cover that, your one-project design is simpler and it's your call — you
own the hosting. Happy to tear down the second Worker. Tell me which way and I'll follow it.

**2. Something on prod I think is actually broken, and I'd rather you saw it before anyone else.**

`regen-toolkit.superbenefit.dev` — every "Contribute on GitHub" link on it points at
`github.com/explorience/regen-toolkit`.

The cause: the rename commit (`a38d5d41`, "point every repo reference at
regen-coordination/regen-toolkit") only ever landed on `regen-toolkit-os`. It never reached `main`.
`origin/main` still has `explorience` in three files:

- `astro.config.mjs`
- `src/layouts/Page.astro`
- `src/pages/index.astro`

`main` is currently 275 commits behind that branch, so it's not just those three — that's only the
part that's visibly wrong to a visitor.

Separately, and this is the bit I genuinely don't know the answer to: `main` sets
`site: 'https://regen-toolkit.superbenefit.dev'` (PR #315). Is that domain the intended canonical,
or a leftover from the Vercel migration? It changes whether there's anything to fix there at all.
Your call — I'm not going to touch it either way.

Given we're inviting Greenpill and ReFi DAO to consume that surface in V1, I'd like the GitHub
links fixed before those land. Want me to do the `main` port, or would you rather take it?
