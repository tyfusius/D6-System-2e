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
- authorizing and transacting the strategy-selected Hero Point balance;
- coordinating Wild Die choices;
- deriving a Second Edition Freeform Manifestation's printed difficulty or
  resolving a selected First Edition genre's fixed Skill/difficulty contract at
  cast time;
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

An enabled genre or companion Foundry module contributes choices but does not
become active merely by loading. The system-owned settings surface selects the
authoritative campaign package, optional companion, and world presentation from
the currently registered choices. A contributing module may register its own
package-specific settings in its Foundry category; it may not add controls to a
private system application or write private system setting keys. See ADR 0020.
First Edition genre modules may additionally register one versioned profile of
ordered Attributes, semantic roles, Skills, and creation budgets. The system
resolves the profile selected by the campaign-package setting and remains the
only authority that executes rolls, template validation, and Actor defaults.

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

The optional Environments rules component follows the same separation. Pure
threat, failure, drowning, breath-round, severe-condition, and recovery
decisions live in core. The Foundry adapter authorizes the GM, executes the
shared roll pipeline, persists one versioned effect on a personal Actor, and
renders the manager and chat audit. Roll and declaration consumers read that
effect only while the capability is active. The effect records both the prior
and directly applied Condition so recovery cannot erase a later injury. Timing,
gear state, and additional narrative hazard consequences remain table authority.

Equipment by Genre/Era is a content-boundary component rather than another
rules engine. The campaign profile selects one era, DataModels persist typed
classification and provenance, and sheets present compatibility without hiding
data. The public owner-scoped registry validates and freezes licensed catalogs;
the base system registers an empty citation-only catalog. Foundry modules own
distributed names and values, while the system continues to own schemas,
permissions, persistence, and conflict rejection.

Character Templates use the same content boundary. The version-2 public
registry accepts source-cited Attribute allocations, suggested stable Skill
keys, complete supported personal-Item snapshots, and an optional bounded
Superheroic package that references inert feature-catalog definitions by stable
ID/rank/focus. World Items use the same contract and synchronize into an
owner-scoped world catalog. The system owns campaign-profile validation, exact
preview construction, owner/GM authority, serialized application, protected
Attribute and same-key Skill writes, Specialization parent relinking, and
rollback of created Items or updated Skills if final Actor persistence fails. The
primary Game System Mode selects the template rules family; imported optional
mechanics never impersonate a mode change. A lawful same-edition template must
cover every active Attribute and may also carry values for dormant Attributes
already present in the Actor schema. Budget differences are preview advisories;
unknown Skills, unknown Attributes, invalid scores,
wrong edition, authority, and creation-state failures remain hard blocks. The
Superheroic family additionally requires the exact Charm/15D, Skill/8D, and
Superpower/10D profile and validates every contributed power before the batch.
A template may create a lawful missing Skill at its stored score without
allocating assignable Skill dice. It never writes health, advancement state, or
arbitrary Actor fields and never remains an executable rules owner.

The base template catalog is deliberately empty. The separately activatable
Core Content module registers the nine pp. 138–139 templates and owns their
`second-edition-core-templates` compendium; the Fantasy module independently
registers the four pp. 168–171 templates and owns its Fantasy compendium.
Disabling either module removes its catalog and packs from discovery without
changing the world's selected rules profile.

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
   A selected Second Edition Classic Wild Die likewise routes its p. 72
   penalty-versus-Complication mishap classification to the active GM. Basic
   and Simple resolve without a prompt. OpenD6 remains a separate policy.
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

One Foundry Hero Point service owns Heroic/Basic `heroPoints` and Classic
`experiencePoints` transactions, including feature awards, damage survival, and
Heroic session refresh. Roll contract version 2 represents arbitrary Basic
ordinary dice and independently exploding Classic Wild Dice without asking UI
or chat adapters to infer them.

## Rules and module profiles

The world has one typed cross-edition rules profile. It selects strategy families
for success, Wild Die, currency, defenses, damage, advancement, and attributes.
The `Use OpenD6 Rules` setting applies a built-in preset; independent overrides
resolve the profile as `custom`. Inactive persistent fields remain intact.

Second Edition **rules components** are configuration with dependencies and
conflicts. This term distinguishes printed optional rulebook components from
installable Foundry modules. A versioned world rules-component profile contains
stable IDs, for example:

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
advancement module. It also resolves Fantasy Skills and dependency-gated
Freeform Skill-Based Magic. It selects either native contextual initiative with a
Combat-owned GM order, or First Edition Perception initiative through Foundry's
numeric tracker. It owns the active Attribute projection and creation budgets
and is exposed read-only through `campaign.profile`. Remaining genre examples
above are planned identifiers, not advertised capabilities.

## Genre and companion packages

ADR 0022 adds a parallel official-content boundary for Second Edition. The base
system owns rule execution, schemas, settings, onboarding, and the User Manual.
Any number of official content modules may register through the version-1
`contentPackages` API and expose their Foundry packs together. Activation is
availability only. `rules.selection()` separately reports the Game System Mode
baseline and cross-edition imported mechanics derived from explicit settings.

Phase 1 extracts Skills and Equipment into
`packages/d6-system-2e-core-content`. Pack names and document IDs remain stable;
only Foundry's owning-package UUID namespace changes. Schema 44 rewrites stored
Actor/Item references and the drop resolver aliases legacy UUIDs. The system
manifest recommends the module but does not require it.

Genre packages and setting companions are separate Foundry add-on modules that
use one planned, versioned contribution contract. They are technically peers:
a genre package supplies a broad campaign foundation, while a companion adapts
or extends that foundation for a specific setting. The base system remains
usable without either.

The intended package layers are:

1. base system and generic rule execution;
2. one selected genre package, such as First Edition Adventure, Fantasy, or
   Space;
3. zero or one selected setting companion, such as Star Wars;
4. explicit world overrides; and
5. user presentation preferences, which may affect only compatible visual
   choices and never authoritative mechanics.

Installed/enabled packages are only available contributions. World selection
activates a contribution. The resolver rejects incompatible authoritative
rules owners rather than merging them by load order. Every resolved value keeps
its owner/provenance so settings and diagnostics can explain its source.

The planned contribution manifest covers identity and compatibility,
dependencies, rules presets and capabilities, Attributes and Skills,
terminology, content packs, presentation themes, Dice So Nice profiles,
placeholder artwork, character-creation presets, and owner-scoped migrations.
Rules calculations remain core/application services; packages contribute data
and select implemented strategies.

See ADR 0020 and `COMPANION-CONTRACT.md`.

## Registries

The system maintains or plans validated, owner-scoped registries for:

- terminology;
- themes and optional Dice So Nice presentation profiles;
- Psionics power catalogs;
- campaign-package and companion contributions;
- multi-active official content-package manifests.

Terminology, semantic themes, and the Psionics power-catalog registry are
implemented in API v1. Psionics registrations are inert data with one or two
known discipline IDs, fixed/scaling difficulty, and source provenance; the
system retains roll authority and the base catalog is intentionally empty.
Theme selection/render adapters and broader preset contribution registries
remain staged work.

The present theme contract covers semantic colors, optional ordinary-die Dice
So Nice colorsets and owner-scoped Wild Die face sets, plus validated
owner-scoped pause artwork. The system retains the Wild Die mechanics while the
active theme may contribute its bronze palette and face artwork. The contract does not yet cover placeholder portraits/tokens,
broader logos and presentation assets, or the unified campaign-package
manifest. Future work must extend the public contract rather than letting
packages patch sheets or Foundry configuration.

Presentation resolution must preserve user artwork. If a document still uses a
recognized placeholder sentinel, resolve companion placeholder → genre
placeholder → system placeholder → Foundry's `CONST.DEFAULT_TOKEN`
(`icons/svg/mystery-man.svg`). A selected image is never rewritten because a
package or theme changes.

A contribution is immutable after validation. An owner can replace or unregister
its own entries only. If a module is disabled, stored IDs remain but resolve to a
safe generic fallback.

Creature bestiaries follow the same owner-scoped contribution boundary. The
system owns validation, permission checks, Actor construction, schema-28
provenance, and sheet presentation; a licensed module contributes only bounded
data. The system does not expose a script callback or arbitrary Actor patch in a
bestiary entry. Players receive no catalog toolbar or creation command.

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
Character and machine weapons support attack and damage. A machine Attack
resolves its roster through the system roll service, executes as the selected
crew Actor, and retains machine target/range/scale context. The HUD remains a
projection and dispatcher; it does not calculate crew penalties.

## Build and artifacts

TypeScript source is authoritative. The system ESM and source map are generated
under `dist/`; the HUD bundle is generated beside its module manifest. Both are
ignored build artifacts. The build script removes only exact known outputs.
Package invariants reject accidental AppV1 templates, private cross-package
imports, and unexpected runtime entrypoints.
