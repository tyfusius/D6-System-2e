# Phase 0 discovery report

Date: 2026-07-26

## Repository observation

The requested installation path did not exist and no `D6-System-2e` checkout was
found under the supplied workspace roots. A new empty Git repository was therefore
initialized on branch `main`. During the first Build 365 smoke check, Foundry
correctly rejected the capitalized directory because a system folder must exactly
match its manifest ID. The repository was moved to
`data/Data/systems/d6-system-2e`. At discovery time no remote, commit, or push
existed; the repository now tracks
`https://github.com/geimau/D6-System-2e.git`.

The locally installed OpenD6 Next system and three companion projects were found.
The main system and Star Wars companion contain substantial live LevelDB compendium
churn. They were treated as read-only and were not modified.

## Authoritative material

Two PDFs were supplied:

| File                          | Role                       | Observation                                        |
| ----------------------------- | -------------------------- | -------------------------------------------------- |
| `D6_2e_Core_Rulebook_1_1.pdf` | Rules authority            | 257 pages; Second Edition v1.1 content and modules |
| `weg51012OGL-D6-Space.pdf`    | Historical comparison only | 146 pages; not authority for Second Edition        |

The supplied NotebookLM summary is useful as a lead, not as authority. Direct
verification found material corrections:

- Core success is a score strictly greater than the difficulty, confirmed on
  printed page 26.
- The core Wild Die choices on pages 26-27 depend on whether the unmodified result
  would succeed. The summary's unconditional three-option prompt is not accurate.
- Hero Points can double one die code, reroll a failed roll without Doubling Down,
  or avoid becoming Stunned, per page 28. The source does not say an existing
  Stunned condition can simply be removed.
- Page 33 contradicts itself: its rule bullet refers to a Complication on the damage
  roll, while its example refers to a `1` on the defender's Brawn Wild Die. The same
  example calls the higher-resistance outcome Stunned where the rule bullet and
  following paragraph call it Staggered.

No damage automation will choose between those contradictory readings without
errata or an explicit, documented table decision.

## Package identity

Accepted system ID: `d6-system-2e`

Rationale:

- lowercase and URL-safe;
- concise while retaining the edition boundary;
- does not reuse `od6s`, `od6s-next`, or a setting-specific identity;
- suitable for flags, settings, sockets, API namespaces, asset paths, and releases.

The display title is `D6 System Second Edition`. A separately hosted repository may
use the display-oriented name `D6-System-2e`, but the installed folder and all
release and asset paths must use the lowercase manifest ID.

## Product shape

Second Edition is explicitly modular. The system must distinguish:

- mandatory core rules;
- mutually exclusive campaign choices, such as initiative, Wild Die, and advancement
  variants;
- compatible optional modules;
- genre modules;
- companion-provided presentation and content.

The campaign module profile is a first-class world configuration concept. It is
not an unstructured collection of feature toggles.

## Initial implementation scope

The first vertical slice supports one `character` Actor and embedded `skill` Items:

1. Create a character with the four core attributes.
2. Edit attributes, skills, biography, and Hero Points.
3. Derive a skill pool from attribute plus skill rating.
4. Save, close, reopen, and reload without shape changes.
5. Submit one typed check request using the strict `>` evaluator.
6. Resolve the core Wild Die workflow with explicit player/GM choices.
7. Render a structured, accessible chat card from a typed result.
8. Expose the same action through the public API.

Combat, damage, advancement, powers, vehicles, starships, and optional module
automation are outside this slice.

## Proposed document types

Actor types are staged:

| Type        | Basis                                                          | Stage          |
| ----------- | -------------------------------------------------------------- | -------------- |
| `character` | Core player character                                          | Vertical slice |
| `npc`       | Significant foes use character rules, pp. 132-137              | Phase 3        |
| `creature`  | Same broad rules, with explicit defense overrides, pp. 132-137 | Phase 3        |
| `vehicle`   | Optional science-fiction module, pp. 181-183                   | Phase 3/4      |
| `starship`  | Optional science-fiction module, pp. 176-180                   | Phase 3/4      |

Item types are also staged. The stable proposal is:

- `skill` and `specialization`;
- `perk`, `flaw`, `talent`, `trouble`, and `asset`;
- `equipment`, `weapon`, and `armor`;
- `power` with a registered discipline ID and typed discipline payload;
- `character-template`.

Vehicle/starship context belongs in typed fields on equipment and weapons rather
than multiplying item types solely by scale. A later mapping study will decide
whether importer compatibility justifies aliases for OpenD6 Next types.

## First public API boundary

API major version 1 is capability-negotiated. Its intended stable boundary contains:

- package identity, schema version, and capability inspection;
- immutable Actor read models;
- typed check requests and typed roll results;
- convenience calls by stable Actor/Item IDs;
- validated terminology, theme, and discipline registries;
- later, typed combat state reads and authoritative commands.

Adding a capability is compatible within API major 1. Changing an existing contract
requires a new API major or an explicit compatibility adapter.

The foundation publishes only capabilities that actually work. Integrations must
not infer support from method names or inspect private documents.

## Roadmap

### Phase 0 - Discovery and product definition

Complete the source inventory, licensing gate, identity, architecture, data model,
scope, API shape, and first vertical slice.

### Phase 1 - Technical foundation

Maintain strict checks, register Foundry-native data models, add the world module
profile, implement the migration service, expose API v1, and prove init/ready on
Build 365.

### Phase 2 - Character vertical slice

Implement the ApplicationV2 character and skill sheets, persistence, one typed
roll pipeline, core Wild Die choice flow, Hero Point transaction handling, chat
card, permissions, and narrow-layout validation.

### Phase 3 - Core documents and optional character modules

Add NPCs, creatures, equipment, weapons, armor, features, specializations,
advancement profiles, damage state after errata resolution, localization, and
accessible item management.

### Phase 4 - Combat

Write and accept the combat ADR, then implement declaration, action segments,
initiative profile, attacks, defenses, damage/resistance, conditions, Combatant
and Combat state, authority, sockets, and recovery.

### Phase 5 - Integrations

Stabilize the API needed by a separate Token Action HUD adapter, optional Dice So
Nice integration, macros, and a minimal companion test fixture.

### Phase 6 - Content, import, and release

Add only licensed content, compendium validation, dry-run import tools, live
regression matrices, backups, rollback, release archives, and update manifests.

## Release gates

- Publisher/trademark permission is documented.
- Every automated rule is represented in the rules inventory.
- `npm run check` passes.
- Required Build 365 live checks are recorded.
- No protected setting content is present.
- Import claims are backed by a mapping study and dry-run reports.
