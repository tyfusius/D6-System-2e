# Architecture

## Dependency direction

Dependencies point inward:

1. `core/domain` contains deterministic Second Edition rules and values.
2. `core/contracts` contains versioned integration contracts and read models.
3. `system/application` coordinates use cases through explicit ports.
4. `system/foundry` owns Foundry documents, lifecycle, persistence, permissions,
   flags, settings, sockets, sheets, dialogs, and chat adapters.
5. System UI and external integrations call application services or the public API.

Core imports no Foundry package, runtime global, DOM type, or browser API.

## Data boundaries

- Persistent source types describe what Foundry stores.
- Domain inputs contain only values needed by a rule.
- Derived models contain recalculable values and are never persisted merely for UI speed.
- Presentation models contain localized labels, theme tokens, permissions, and control state.
- Public read models are immutable projections, not document objects.

The adapter that crosses a boundary validates unknown input. It does not cast an
untyped Foundry object into a domain type and hope its shape is correct.

## Application services

Application services own workflows such as:

- constructing a check request from an Actor and embedded Item;
- authorizing and spending Hero Points;
- coordinating Wild Die choices;
- persisting a completed transaction exactly once;
- rendering a typed result through a chat port;
- executing ordered world migrations.

Services receive persistence, dice, prompt, clock, and chat ports. They do not call
Foundry globals directly.

## Foundry ownership

The Foundry layer owns:

- data-model registration;
- document classes and preparation;
- settings and campaign module profile storage;
- ApplicationV2 sheets and dialogs;
- `Roll` execution and ChatMessage creation;
- GM/player permission checks;
- hooks and sockets;
- Combat and Combatant flags when combat architecture is accepted;
- API installation at `game.system.api`.

Hooks delegate to named handlers and contain no calculations.

### Settings

`settings/settings-catalog.ts` is the stable inventory of shared, First
Edition-only, and Second Edition-only configuration. Root Foundry settings
contain only cross-edition presentation/workflow preferences. Two ApplicationV2
submenus own edition-specific configuration. Pure setting readers live
separately from the ApplicationV2 classes so domain-facing adapters and tests do
not acquire a browser-global dependency.

Rules profile selection remains in `rules-compatibility.ts`; settings UI code
coordinates writes but does not decide roll, damage, or advancement outcomes.
See ADR 0009.

## Roll pipeline

A single pipeline will serve sheets, Items, combat, HUD, macros, and integrations:

1. A caller supplies a typed intent with stable IDs.
2. The application service reads an authorized Actor projection.
3. Pure domain code constructs the pool and consequences.
4. The Foundry dice port rolls physical dice.
5. The application service evaluates the provisional result.
6. The authorized player or GM resolves any Wild Die choice.
7. The service commits resource/state changes with idempotency protection.
8. A typed result is rendered to chat.

Chat never parses rendered text to recover state.

## Rules and module profiles

The world has one typed cross-edition rules profile. It selects strategy families
for success, Wild Die, currency, defenses, damage, advancement, and attributes.
The `Use OpenD6 Rules` setting applies a built-in preset; independent overrides
resolve the profile as `custom`. Inactive persistent fields remain intact.

Second Edition modules are configuration with dependencies and conflicts. A versioned
world module profile contains stable IDs, for example:

- `core.initiative.standard`;
- `core.wild-die.standard`;
- `core.advancement.experience`;
- `attribute.charm`;
- `genre.science-fiction.starships`.

Visible labels are localized separately. Validation rejects incompatible selections.
Changing a profile after documents exist must produce an impact report and preserve
inactive data.

## Registries

The system maintains validated, owner-scoped registries for:

- terminology;
- themes and optional Dice So Nice presentation profiles;
- power disciplines;
- companion configuration presets.

Terminology and semantic theme registration are implemented in API v1. Theme
selection/render adapters and discipline/preset contribution registries remain
staged work.

A contribution is immutable after validation. An owner can replace or unregister
its own entries only. If a module is disabled, stored IDs remain but resolve to a
safe generic fallback.

## Combat state

No action scheduler is being copied from OpenD6 Next. The core rulebook describes
round declarations and action segments on pages 29-31, but Foundry ownership and
authority details require the separate proposed combat ADR. Actor documents will
not hold transient round UI state.

## Build and artifacts

TypeScript source is authoritative. The production ESM and source map are generated
under `dist/`. The build script removes only exact known outputs. Package invariants
reject accidental AppV1 templates, private cross-package imports, and unexpected
runtime entrypoints.
