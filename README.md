# Regen Toolkit

Practical web3 knowledge for regenerative communities.

**Live site:** [regen-toolkit-site.vercel.app](https://regen-toolkit-site.vercel.app)

## What Is This?

The Regen Toolkit is a curated, open-source knowledge base that helps regenerative practitioners understand and use web3 tools. It connects the dots between existing resources and provides clear learning pathways for different audiences.

**Who it's for:**
- Community organizers new to blockchain
- Environmental practitioners exploring impact verification
- Local chapter builders setting up web3 coordination
- DAO operators and governance researchers

## Current State

- **67 published articles** across foundations, applied topics, and playbooks
- **254 total articles** in the taxonomy (remaining are stubs in progress)
- **5 learning paths** through the content for different audiences
- **Interactive Knowledge Explorer** mapping all topics and connections
- **Tag Explorer** for filtering by function, domain, systems concepts, audience, and maturity

### Browse the Content

- [Knowledge Explorer](https://regen-toolkit-site.vercel.app/explorer/) - Interactive graph of all topics and connections
- [Tag Explorer](https://regen-toolkit-site.vercel.app/tags/) - Filter articles by tags and metadata
- [All Articles](https://regen-toolkit-site.vercel.app/) - Browse the full site

## Repository Structure

This repo has two co-located layers:

**Knowledge site (Astro/Starlight)**
```
src/content/docs/          # All articles (Markdown with YAML frontmatter)
src/data/                  # Knowledge graph data
public/explorer/           # Interactive knowledge map (D3.js)
public/tags/               # Tag explorer
content/                   # Raw source articles (pre-Astro)
astro.config.mjs           # Site configuration
```

**org-os instance (coordination overlay)**
```
docs/MASTER.md             # Master doc — canonical development spec (by Matt)
docs/BACKLOG.md            # Extracted todos from master doc
docs/CSIS.md               # Structural integrity framework reference (Durgadas)
IDENTITY.md                # Project identity, leads, 8-layer ownership
MEMORY.md                  # Key decisions, active context
MASTERPLAN.md              # Current mandate and development priorities
HEARTBEAT.md               # Active coordination tasks
dashboard.yaml             # Session dashboard config
federation.yaml            # Network peers, upstream framework
data/                      # Structured registries (ontology, options, deployment reqs, feedback process)
packages/operations/       # Projects, meetings, finances
skills/                    # Native agent skills (content + coordination)
.agents/skills/            # External skill collections (git submodules)
  superpowers/             #   obra/superpowers — agentic methodology (TDD, planning, brainstorming, debugging)
  karpathy-skills/         #   forrestchang/andrej-karpathy-skills — Karpathy LLM-coding heuristics
scripts/                   # Both site pipeline scripts and org-os scripts
.claude/                   # Claude Code commands (/initialize, /close)
```

**Cloning:** the org-os overlay lives on the `feature/org-os-overlay` branch (operating directly from the branch rather than via a merged PR). External skills are git submodules, so clone with `--recurse-submodules`:

```bash
git clone --recurse-submodules -b feature/org-os-overlay https://github.com/regen-coordination/regen-toolkit.git
# or, if already cloned:
git checkout feature/org-os-overlay
git submodule update --init --recursive
```

See [`docs/ORG-OS.md`](docs/ORG-OS.md) for the operator one-pager (5-minute entry point), `CLAUDE.md` for agent instructions, and `AGENTS.md` for the session startup sequence.

## Tech Stack

- **Framework:** [Astro](https://astro.build/) + [Starlight](https://starlight.astro.build/)
- **Hosting:** [Vercel](https://vercel.com/)
- **Search:** [Pagefind](https://pagefind.app/) (static, client-side)
- **Knowledge graph:** D3.js force-directed visualization

## Article Metadata

Every article has structured frontmatter:

```yaml
---
title: What Is Blockchain
description: A clear explanation of blockchain technology
status: published
tags:
  function: Education           # What problem it solves
  domain: Web3-Literacy         # Knowledge domain
  systems:                      # Cross-cutting concepts
    - Decentralization
    - Trust-Networks
audience: Individual            # Target reader
maturity: Beginner              # Complexity level
related:                        # Cross-links
  - what-is-cryptocurrency
  - centralized-vs-decentralized
---
```

## Source References

This toolkit synthesizes content from multiple existing resources:

| Source | Focus |
|--------|-------|
| [Bankless Academy](https://app.banklessacademy.com/) | Beginner web3 education |
| [ReFi DAO Local Toolkit](https://refidao.github.io/local-refi-toolkit/) | Playbooks, protocol implementations |
| [Greenpill Network](https://greenpill.network/) | Philosophy, public goods, community building |
| [SuperBenefit Knowledge Garden](https://knowledge.superbenefit.org/) | DAO patterns, governance |
| [Open Civics](https://opencivics.co) | Civic innovation, governance frameworks |
| [P2P Foundation](https://p2pfoundation.net) | Governance patterns, open cooperatives |
| [Restor](https://restor.org) | Ecological restoration projects |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. Content standards are in [docs/writing-system.md](docs/writing-system.md).

## License

[Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/)
