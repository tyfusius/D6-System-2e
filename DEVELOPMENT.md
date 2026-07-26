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
npm run invariants
npm run check
```

The build writes only enumerated artifacts under `dist/`. It never deletes or
recreates the repository root.

## Package boundaries

- `packages/core/src/domain`: deterministic rules and values; no Foundry imports.
- `packages/core/src/contracts`: versioned public integration types.
- `packages/core/src/migrations`: migration contracts and pure runner.
- `packages/system/src/application`: use cases and ports.
- `packages/system/src/foundry`: Foundry v14 adapters and lifecycle ownership.
- `packages/system/src/api`: public API assembly.
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
