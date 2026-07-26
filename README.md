# D6 System Second Edition for Foundry VTT

This repository is a new Foundry Virtual Tabletop v14 system for D6 System:
Second Edition. The stable package ID is `d6-system-2e`; see
[`docs/DECISIONS/0001-package-identity.md`](docs/DECISIONS/0001-package-identity.md).

The project is in its discovery and technical-foundation phase. It is not yet
ready for campaign play. The first playable target is a character vertical slice:
create a character, edit core attributes and skills, save and reopen it, make one
typed core check, and render a modern chat card.

## Principles

- The Second Edition rulebook is the rules authority.
- OpenD6 Next is a read-only architectural and UX reference.
- Core rules are pure TypeScript with no Foundry imports.
- Foundry integration is an adapter around application services.
- Persistent data changes use ordered, tested migrations.
- Modules use a documented, versioned API and validated registries.
- Optional rules remain explicit campaign configuration, not silent defaults.

## Current status

- Phase 0 source and architecture discovery: complete for the supplied v1.1 PDF,
  with unresolved rulebook contradictions recorded.
- Package identity and initial boundaries: accepted.
- Technical foundation: scaffolded with Foundry-native `character` and `skill`
  schemas and ApplicationV2 sheets.
- Character UX: OpenD6 Next-aligned workflow with a neutral OpenD6 Classic
  charcoal-and-gold theme, compact D6 notation, and Normal, Advance, and GM-only
  Free Edit modes.
- Character persistence harness: live-tested as GM, including an embedded skill and
  world reload.
- Cross-edition foundation: master OpenD6 preset, seven independent First Edition
  switches, lossless currency fields, active six-attribute projection, and
  owner-scoped terminology/theme API.
- Typed roll/chat vertical slice: planned, not yet implemented.
- Live Foundry validation: package discovery, lifecycle, Actor/Item creation, sheet
  opening, save, close/reopen, and reload persistence passed on Build 365.

See [`docs/DISCOVERY-REPORT.md`](docs/DISCOVERY-REPORT.md),
[`docs/RULES-INVENTORY.md`](docs/RULES-INVENTORY.md), and
[`docs/HANDOVER.md`](docs/HANDOVER.md).

## Development

Use Node.js 22 or later:

```sh
npm install
npm run check
```

`npm run check` performs formatting verification, linting, strict TypeScript
checking, unit tests, a production build, and package invariant checks.

No publisher assets or rulebook text are distributed by this repository.
