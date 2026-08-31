# D6 System Nexus (with support for D6 System Second Edition) for Foundry VTT

<p align="center">
  <img src="assets/ui/d6-pause-mark.svg" width="180" alt="D6 System Second Edition" />
</p>

This repository provides the Foundry Virtual Tabletop v14 implementation of D6
System: Second Edition. The stable package ID is `d6-system-2e`.

Version `0.1.0-beta.18` is the current private campaign-testing release for
Foundry VTT v14 Build 367. The stable manifest and the latest GitHub release
identify the currently published collaborator version.
The distribution includes the base rules system, modular Second Edition and
Open D6 content packages, and the Token Action HUD adapter. Setting companions
remain separately installable modules.

## Installation and updates

Install the system from Foundry's **Install System** window using this manifest
URL:

```text
https://raw.githubusercontent.com/tyfusius/D6-System-2e/main/system.json
```

Foundry uses the same URL to detect later system releases. Install desired
content packages and setting companions from their manifests, then enable them
for the world through **Manage Modules**. The [current GitHub
release](https://github.com/tyfusius/D6-System-2e/releases/latest)
provides every module manifest and ZIP, along with `release-manifests.json` and
`SHA256SUMS.txt`.

## User manual

The illustrated **D6 System Second Edition — User Manual** Journal compendium is
included with the system. It documents the implemented player and Gamemaster
workflows, campaign configuration, and edition-specific behavior directly
inside Foundry.

## Principles

- The Second Edition rulebook is the rules authority.
- Core rules are pure TypeScript with no Foundry imports.
- Foundry integration is an adapter around application services.
- Persistent data changes use ordered, tested migrations.
- Modules use a documented, versioned API and validated registries.
- Optional rules remain explicit campaign configuration, not silent defaults.
- Genre packages and setting companions are separate Foundry add-on modules;
  installation makes contributions available, while explicit world settings
  determine which package is authoritative.

## Current release

- Foundry-native character, creature, vehicle, and starship sheets.
- Configurable Second Edition, OpenD6, FreeD6, and neutral D6MV rules profiles.
- Matching-combination pools and optional best-result Homebrew rewards alongside
  the ordinary total-based D6 workflows.
- Setting Profile branding, shared palettes, Personal Themes, and scoped
  display/interface typography with safe local and module font support.
- Attribute, Skill, Specialization, weapon, Wild Die, Hero Point, and combined
  action roll workflows.
- Configurable personal Health Models with ordered states, penalties, action
  availability, and profile-aware terminology.
- A resizable, responsive Health Model Builder with Guided and Exact authoring,
  validation, simulation, and an illustrated in-game workflow guide.
- Per-client Personal Themes, including theme-aware active highlighting in the
  D6 Token Action HUD adapter without modifying Token Action HUD Core.
- Unified pending prompts and initiating-root combat cards, including the
  Second Edition Feint and Riposte continuation flow.
- Automated extraordinary-power sequences with role-bound Skill rolls,
  authored difficulties, shared multiple-action penalties, and per-check
  results.
- Profile-configurable health terminology and difficulty suggestions, including
  First Edition Wounds, Body Points, and Second Edition Conditions.
- Targeted Weapon rolls with measured range and automatic range-derived final
  difficulty.
- Foundry-native thrown-explosive aiming with colored blast zones, measured
  range and difficulty, hit or scatter placement, affected-token detection,
  and ordinary damage/resistance continuation.
- Readable explosive-deviation chat audits, standard six-direction scatter,
  and an optional eight-direction Tyfusius Home Brew rule.
- Editable Health Model state descriptions with pointer and keyboard tooltips
  on Character condition controls.
- Visible final difficulty, signed manual dice adjustments, GM-resolved Wild
  Die complications, and owner-routed resistance rolls with a GM fallback.
- Character creation and reusable character templates.
- Configurable Attribute-, Skill-, or fixed-base personal Weapon damage.
- GM Free Edit inventory management plus GM-authorized equipment transfers and
  audited equipment dropping for character owners. Player-to-player transfers
  require the receiving owner to approve the transaction.
- Optional rules components and terminology customization.
- Modular genre content and setting companions with explicit campaign
  activation.
- GM tools for quickbar actions, roll requests, tasks, and creature management.
- Token Action HUD integration through its separate adapter module.

## Development

Use Node.js 22 or later:

```sh
npm install
npm run check
```

`npm run check` performs formatting verification, linting, strict TypeScript
checking, unit tests, a production build, and package invariant checks.

No publisher assets or rulebook text are distributed by this repository.
