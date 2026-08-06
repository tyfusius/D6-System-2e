# D6 System Second Edition for Foundry VTT

This repository is a new Foundry Virtual Tabletop v14 system for D6 System:
Second Edition. The stable package ID is `d6-system-2e`; see
[`docs/DECISIONS/0001-package-identity.md`](docs/DECISIONS/0001-package-identity.md).

Version `0.1.0-beta.2` is the current private collaborator update for campaign
testing on Foundry VTT v14 Build 365. It includes the base rules system, modular
Second Edition and Open D6 content packages, the Echo setting companion, and
the Token Action HUD adapter.

## Private release installation

The Tyfusius GitHub distribution is private. A collaborator must sign in to
GitHub, open the `0.1.0-beta.2` release, and download the desired ZIP assets.
Private GitHub manifests cannot be fetched anonymously by Foundry, so this
release uses manual installation:

1. Stop Foundry.
2. Extract `d6-system-2e.zip` into `Data/systems/`.
3. Extract each desired module ZIP into `Data/modules/`. Install
   `open-d6-space-d6-system-2e.zip` before enabling the Echo companion.
4. Start Foundry, create or open a D6 System Second Edition world, and enable
   the desired modules in **Manage Modules**.

Each archive contains exactly one correctly named package directory. The
release also provides standalone manifests, `release-manifests.json`, and
`SHA256SUMS.txt` for verification. If the repository later becomes public, the
same manifest metadata supports Foundry's normal manifest installer and update
workflow.

## User manual

The illustrated [User Manual](docs/USER-MANUAL.md) documents the currently
implemented player and Gamemaster workflows, cross-edition behavior, source
references, and explicit alpha boundaries. The same source is compiled into the
**D6 System Second Edition — User Manual** Journal compendium shipped with the
system.

## Principles

- The Second Edition rulebook is the rules authority.
- OpenD6 Next is a read-only architectural and UX reference.
- Core rules are pure TypeScript with no Foundry imports.
- Foundry integration is an adapter around application services.
- Persistent data changes use ordered, tested migrations.
- Modules use a documented, versioned API and validated registries.
- Optional rules remain explicit campaign configuration, not silent defaults.
- Genre packages and setting companions are separate Foundry add-on modules;
  installation makes contributions available, while explicit world settings
  determine which package is authoritative.

## Current status

- Phase 0 source and architecture discovery: complete for the supplied v1.1 PDF,
  with unresolved rulebook contradictions recorded.
- Schema 10 includes native Second Edition vehicle and starship Actors with
  source-cited ApplicationV2 sheets and public read models.
- Package identity and initial boundaries: accepted.
- Technical foundation: scaffolded with Foundry-native `character` and `skill`
  schemas and ApplicationV2 sheets.
- Character UX: OpenD6 Next-aligned workflow with a neutral OpenD6 Classic
  charcoal-and-gold theme, compact D6 notation, and Normal, Advance, and GM-only
  Free Edit modes.
- Character persistence harness: live-tested as GM, including an embedded skill and
  world reload.
- Cross-edition foundation: master OpenD6 preset, nine independent First Edition
  switches, a versioned per-capability resolution matrix, lossless currency
  fields, active six-attribute projection, and owner-scoped terminology/theme
  API.
- Typed roll/chat vertical slice: implemented for Attributes, Skills, Advanced
  Skill task context, Specializations, weapons, Hero Point follow-ups, and
  Second Edition Doubling Down.
- Second Edition Fantasy magic/combat modules: Freeform Manifestations, Magic
  Point casting/recovery, persisted Full Defense and Feint, Riposte, and
  Autofire are implemented behind explicit campaign settings.
- Fantasy catalog foundations: creation templates and bestiary Creature
  profiles use versioned, source-cited contribution contracts. The system ships
  empty lawful base catalogs; authorized Foundry modules supply named content.
- Live Foundry validation: package discovery, lifecycle, Actor/Item creation, sheet
  opening, save, close/reopen, and reload persistence passed on Build 365.

See [`docs/DISCOVERY-REPORT.md`](docs/DISCOVERY-REPORT.md),
[`docs/RULES-INVENTORY.md`](docs/RULES-INVENTORY.md),
[`docs/CROSS-EDITION-CAPABILITIES.md`](docs/CROSS-EDITION-CAPABILITIES.md), and
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
