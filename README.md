# Regen Toolkit

Practical web3 knowledge for regenerative communities.

**Live site:** [regen-toolkit.superbenefit.dev](https://regen-toolkit.superbenefit.dev)

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

- [Knowledge Explorer](https://regen-toolkit.superbenefit.dev/explorer/) - Interactive graph of all topics and connections
- [Tag Explorer](https://regen-toolkit.superbenefit.dev/tags/) - Filter articles by tags and metadata
- [All Articles](https://regen-toolkit.superbenefit.dev/) - Browse the full site

## Repository Structure

```
regen-toolkit/
├── src/content/docs/     # All articles (Markdown with YAML frontmatter)
├── src/data/              # Knowledge graph data
├── public/explorer/       # Interactive knowledge map (D3.js)
├── public/tags/           # Tag explorer
├── docs/                  # Project documentation
│   ├── writing-system.md  # Content creation standards
│   ├── migration-plan.md  # Taxonomy migration plan
│   └── process/           # Sprint logs
├── content/               # Raw source articles (pre-Astro)
├── astro.config.mjs       # Site configuration
└── CONTRIBUTING.md        # How to contribute
```

## Tech Stack

- **Framework:** [Astro](https://astro.build/) + [Starlight](https://starlight.astro.build/)
- **Hosting:** [Cloudflare Workers](https://developers.cloudflare.com/workers/) (static assets)
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
