# Development

## Supported environment

- Foundry Virtual Tabletop v14, verified target Build 365
- Node.js 22 or later
- TypeScript in strict mode
- ESM browser bundle
- ApplicationV2-only system UI

## Commands

```sh
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run content:build
npm run content:verify
npm run invariants
npm run check
```

The build writes only enumerated artifacts under `dist/`. It never deletes or
recreates the repository root.

## Content and private companion

`content/skills.json` is the authoritative public catalog. `npm run
content:build` selects stable document IDs and rebuilds the two public LevelDB
packs. Public descriptions must remain blank.

For a licensed local set, copy
`private-content.example/skill-descriptions.json` to
`private-content/skill-descriptions.json`, add prose keyed by stable Skill key,
and run `npm run content:build-private`. The ignored input generates the separate
local module `Data/modules/d6-system-2e-private-content`. Never add that input or
generated private module to the public repository.

## Package boundaries

- `packages/core/src/domain`: deterministic rules and values; no Foundry imports.
- `packages/core/src/contracts`: versioned public integration types.
- `packages/core/src/migrations`: migration contracts and pure runner.
- `packages/system/src/application`: use cases and ports.
- `packages/system/src/foundry`: Foundry v14 adapters and lifecycle ownership.
- `packages/system/src/api`: public API assembly.
- `packages/system/src/registries`: validated owner-scoped companion contributions.
- `packages/system/src/settings`: world rules profiles and preset coordination.
- `packages/system/src/migrations`: ordered system migrations.

Dependencies point inward. Core never imports system code. Application code may
import core. Foundry adapters may import application and core contracts.

## Rule changes

Before implementing automation:

1. Add or update the entry in `docs/RULES-INVENTORY.md`.
2. Cite the printed rulebook page and section.
3. Identify inputs, outputs, edge cases, state reads/writes, UI consumers, and tests.
4. Resolve any source contradiction that materially changes stored data or outcomes.
5. Implement the pure domain behavior first.
6. Add the application service and then Foundry adapters.

Do not make sheets, chat cards, hooks, or integrations alternate rule engines.

Rules that differ by edition use a domain strategy selected by the typed world
profile. A Foundry checkbox never contains the calculation itself. New
compatibility switches require verified sources, enabled/disabled tests, API impact
review, and documentation in ADR 0006.

## Migrations

Persistent changes require a positive, monotonically increasing schema version.
A migration must preserve unknown keys, be idempotent, report its outcome, and
record the new version only after all writes succeed. See `docs/MIGRATIONS.md`.

## Live validation

Automated checks do not prove Foundry behavior. Record exact Build 365 observations
in a milestone validation document, including:

- init and ready console output;
- Actor and Item creation;
- sheet open, edit, resize, save, close, reopen, and reload;
- roll and chat-card behavior;
- GM and player permissions;
- optional integration enabled and disabled;
- browser-console errors.

Do not commit or push unless explicitly requested.

Public compendiums contain mechanical data, stable keys, and book/page
references only. Licensed descriptive prose belongs in the separately generated,
Git-ignored private content companion; run `npm run content:build-private` after
creating `private-content/skill-descriptions.json` from the provided example.
