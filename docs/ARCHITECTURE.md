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

The Second Edition submenu projects its stable settings through an ordered,
rulebook-facing module catalog. Each group has a stable presentation ID, exact
module title, source-page reference, kind (`core` or `module`), and explicit
setting-key membership. Every Second Edition setting must belong to exactly one
group. Reorganizing the visible campaign worksheet therefore cannot rename a
Foundry setting or require a world migration. Unimplemented modules remain in
the rules inventory and are not exposed as inert toggles. See ADR 0018.

Rules profile selection remains in `rules-compatibility.ts`; settings UI code
coordinates writes but does not decide roll, damage, or advancement outcomes.
See ADR 0009.

`EditionCapabilityProfileV1` is the next boundary after raw compatibility
switches. It resolves stable rules-family strategies and declares each active,
inactive-preserved, or planned. Runtime consumers use that profile rather than
inferring one feature from an unrelated edition switch. The public API exposes
the same immutable snapshot through `rules.capabilities()`. See ADR 0014 and
`CROSS-EDITION-CAPABILITIES.md`.

Pip-unit persistence is not a rules capability. The resolved `pips` decision
selects core whole-die projection, the Second Edition Pips module, or OpenD6
classic Pips. A single system adapter resolves each component before arithmetic,
so sheets, rolls, combat, and integrations cannot disagree. See ADR 0015.

OpenD6 advancement follows the same boundary: pure cost calculation lives in
core, an application planner produces an immutable purchase plan, the Foundry
service authorizes and commits the mutation, and sheets/public API delegate to
that service. A module-local `WeakSet` authorizes the exact in-flight document
updates, so callers cannot forge a boolean update option to bypass score and
resource guards.

Second Edition Experience Point advancement follows the same route but has an
independent pure planner and persistent resource. The selected advancement
strategy is resolved in the edition capability profile. Experience Points,
Milestone rewards, and Narrative arcs use separate state and commands rather
than masquerading as XP transactions. Post-creation specialization acquisition
uses a separate p. 99 planner because its cost and count limit depend on the
parent Skill's own rating rather than the complete Attribute-plus-Skill pool.
The Foundry service deducts XP and creates the fixed +1D embedded Item as one
rollback-safe authorized workflow. See ADR 0017.

## Roll pipeline

A single pipeline will serve sheets, Items, combat, HUD, macros, and integrations:

1. A caller supplies a typed intent with stable IDs.
2. The application service reads an authorized Actor projection.
3. Pure domain code constructs the pool and consequences.
4. The Foundry dice port rolls physical dice.
5. The application service evaluates the provisional result.
6. The rolling player resolves visible player-owned Wild Die choices. A
   successful Second Edition Wild Die 1 routes its Partial/Failure decision to
   an active GM. A blind player roll likewise routes its hidden
   Exceptional/Ordinary Advantage choice to that GM, while private-GM and self
   rolls remain local. The versioned authority socket carries only the typed
   reason, exact choice set, Actor identity, roll mode, and provisional total;
   the GM never supplies the dice pool.
7. The service commits resource/state changes with idempotency protection.
8. A typed result is rendered to chat.

Chat never parses rendered text to recover state.

For the optional Second Edition Advanced Skill module, the Foundry adapter
projects eligible related Advanced Skills into the roll builder. The user
selects at most one task context; pure domain code combines canonical pip
scores, and the chosen Item identity/rating remains in the versioned request.
No sheet or chat-card code independently calculates or infers the augmentation.
See ADR 0013.

Failed Second Edition results can be rerolled through the same pipeline. The
chat adapter reads the stored typed result, obtains a serialized GM-authorized
single-use claim on the originating message, and delegates to `roll.reroll`; it
never reconstructs a request from card text. Hero Point reroll and Doubling Down
share that claim. The condition sheet similarly delegates to
`health.condition` before writing Stunned. See ADR 0012.

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

The implemented v1 profile resolves verified, consumed choices:
core Second Edition, optional Attribute modules, the explicit additional Skill
module count, Pips, Skill Specializations & Advanced Skills, and the selected
advancement module. It also selects either native contextual initiative with a
Combat-owned GM order, or First Edition Perception initiative through Foundry's
numeric tracker. It owns the active Attribute projection and creation budgets
and is exposed read-only through `campaign.profile`. Remaining genre examples
above are planned identifiers, not advertised capabilities.

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

## Token Action HUD adapter

The independently loadable Token Action HUD module lives in
`packages/token-action-hud-d6-system-2e`. It negotiates API v1, obtains immutable
Actor projections from `read.actor`, and dispatches roll, feature, and combat
commands through the public API. It does not import Foundry adapters or calculate
rules.

The additive Actor read-model `items` collection describes equipped state,
supported roll modes, and display-ready damage Die Codes for weapon families.
Character weapons support attack and damage; machines expose damage until the
separate crew/driver attack workflow exists.

## Build and artifacts

TypeScript source is authoritative. The system ESM and source map are generated
under `dist/`; the HUD bundle is generated beside its module manifest. Both are
ignored build artifacts. The build script removes only exact known outputs.
Package invariants reject accidental AppV1 templates, private cross-package
imports, and unexpected runtime entrypoints.
