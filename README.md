# D6 System Second Edition for Foundry VTT

This repository provides the Foundry Virtual Tabletop v14 implementation of D6
System: Second Edition. The stable package ID is `d6-system-2e`.

Version `0.1.0-beta.3` is the current campaign-testing release for Foundry VTT
v14 Build 365. It includes the base rules system, modular Second Edition and
Open D6 content packages, the Echo setting companion, and the Token Action HUD
adapter.

## Installation and updates

Install the system from Foundry's **Install System** window using this manifest
URL:

```text
https://raw.githubusercontent.com/tyfusius/D6-System-2e/main/system.json
```

Foundry uses the same URL to detect later system releases. Install desired
content packages and setting companions from their manifests, then enable them
for the world through **Manage Modules**. The [current GitHub
release](https://github.com/tyfusius/D6-System-2e/releases/tag/0.1.0-beta.3)
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
- Configurable First Edition and Second Edition rules workspaces.
- Attribute, Skill, Specialization, weapon, Wild Die, Hero Point, and combined
  action roll workflows.
- Character creation and reusable character templates.
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
