# Data model

Status: initial implementation. `character`, `npc`, `creature`, `skill`, `specialization`,
`advantage`, `disadvantage`, `specialability`, `weapon`, `armor`, and `gear`
have explicit Foundry v14 data models and are declared in the manifest. Later
types remain documented before declaration.

Schema 7 also admits compatibility Item families needed for loss-aware future
imports: `action`, `character-template`, `cybernetic`, `item-group`,
`manifestation`, `species-template`, `vehicle`, `vehicle-gear`,
`vehicle-weapon`, `starship-gear`, and `starship-weapon`. They currently reuse
the closest typed union schema; their full automation is not implied.

## Cross-edition union-schema policy

Supported editions do not get separate Actor or Item types merely because one field
is inactive under a profile. A document stores the lossless union of supported
facts; the resolved rules profile decides which facts are active and which
application service may change them.

- inactive fields are preserved and migrated;
- visible labels never become storage keys;
- a profile switch does not delete, convert, or zero another profile's resources;
- strategy-specific transient state belongs in typed roll/combat state, not on an
  Actor for UI convenience;
- import provenance and unmapped source data remain namespaced until an explicit
  mapping is accepted.

This policy enables dry-run OpenD6 Next imports and reversible profile changes while
avoiding an untyped `legacy` property bag.

## Shared values

### Canonical pip score

```ts
type PipScore = number;
```

Every Attribute, Skill increase, and other Die Code is stored as one
non-negative integer pip score. Three stored units equal one die. Storage is
lossless and edition-neutral; it is not itself a rule that enables modifiers.

The resolved Pips capability determines the effective value. Stored `10`
resolves as `3D` in core Second Edition and `3D+1` under Module: Pips or OpenD6.
Each component resolves before arithmetic, so inactive remainders cannot combine
into an extra die. Turning Pips off preserves remainders for later profile
changes and imports. Dice and remainder pips are never separate persistent
sources of truth. See ADR 0015.

### Migration metadata

Each Actor and Item system source contains:

```ts
interface MigrationSource {
  schema: number;
  foundry: string;
  system: string;
}
```

The runner updates metadata only after successful migration.

### Stable IDs

Internal IDs are lowercase ASCII slugs. Core attribute IDs are:

- `agility`
- `brawn`
- `knowledge`
- `perception`

Optional attribute IDs are:

- `charm`
- `mechanical`
- `technical`
- `magic`
- `mysticism`

Labels are localization or terminology-registry values. Stored IDs do not change
when a companion changes presentation.

## Actor: `character`

### Persistent source

- `attributes`: fixed schema entries for all core and optional attributes, each a
  canonical integer `score` measured in pips. Optional values survive when their
  module is inactive.
- `resources.heroPoints.value`: non-negative integer, initialized to 1 for new
  characters through the creation service.
- `resources.characterPoints.value` and `resources.fatePoints.value`: latent,
  non-negative First Edition compatibility fields, initialized to 5 and 1. They
  remain preserved while the Second Edition Hero Point economy is active.
- `sheetMode.value`: `normal`, `advance`, or `freeedit`. This is persistent
  workflow presentation state; Free Edit authorization is still checked against
  the current user at render and update time.
- `health.condition`: stable condition ID. Values are `healthy`, `staggered`,
  `stunned`, `wounded`, `incapacitated`, `mortally-wounded`, and `dead`.
  Progression is not automated until page 33 is resolved.
- `creation.active`: persistent unfinished-character marker. New native Second
  Edition characters start active; schema 8 initializes existing and imported
  Actors as inactive.
- `biography`: user-authored HTML field.
- `_migration`: migration metadata.
- embedded `skill` Items and, later, other supported Items.

### Derived data

- `SecondEditionCampaignProfileV1`, resolved from typed world settings rather
  than stored on each Actor;
- active attributes and creation budgets from that campaign profile;
- Dodge and Parry from active core attribute dice;
- skill pool from attribute plus skill rating;
- effective modifiers and an auditable contributor list;
- localized labels and theme tokens;
- current user's permission capabilities.
- canonical normalized die-code labels derived from stored pip scores.
- resolved rules-profile ID and active resource/attribute projections.

Derived values are not written during document preparation.

### Validation

- core attribute scores are finite integer pip totals from 3 through 15; inactive
  optional attribute scores are finite integer pip totals from 0 through 15;
- skill increases are finite non-negative integer pip totals;
- creation mode enforces page 20 budgets and limits, while post-creation editing
  follows the selected advancement policy;
- Hero Points cannot be negative;
- condition IDs must be registered system conditions;
- optional attributes may be stored while inactive, but cannot be selected by a
  new skill unless enabled.

### Hero Point command state

Roll ChatMessages store the complete `D6RollResultV1` under the system flag.
Failed-roll reroll cards additionally record `heroPointRerollUsed` on the
originating message before executing the follow-up, so rerendering cannot
re-enable that message's command. This is transaction/audit state on the
ChatMessage, not character state.

Stunned prevention stores no pending marker on the Actor. The authoritative
condition command validates the current and proposed condition, spends one Hero
Point, and deliberately leaves the prior condition unchanged.

### Ownership

Foundry Actor ownership is authoritative. Owners may edit ordinary character
fields and request rolls, but ownership does not grant direct writes to attribute
or skill scores. While `creation.active` is true, an owner may use the protected
whole-die allocation commands; arbitrary document updates remain blocked. Players
increase skills after finalization only through the Advance application service.
Direct score correction and embedded-skill creation require a GM in Free Edit.
Resource transactions use an application service with revision and idempotency
checks.

## Actor: `npc`

Uses the character rules and common schema. The type is now admitted and uses the
shared ApplicationV2 sheet; specialized creation defaults and presentation remain
Phase 3 work.

## Actor: `creature`

Uses the common character schema. A later explicit `defenseOverrides` field is
required because pages 132-137 state that some creatures deliberately do not use
standard defense calculations.

## Skill source reference

Every catalog Skill stores `source.book`, `source.module`, and `source.page`.
`description` remains a separate HTML field. This supports a public citation-only
record and a private companion record with licensed prose without changing the
stable `system.key`.

## Actor: `vehicle`

Optional science-fiction module:

- Maneuverability and Hull die codes;
- passenger capacity;
- movement/range presentation fields where rules require them;
- condition state;
- embedded vehicle-context weapons, armor, and equipment;
- driver reference only if persistent assignment is a campaign fact.

Active driver/action state is not stored on the Actor merely for UI convenience.

## Actor: `starship`

Optional science-fiction module:

- Navicomp, Maneuverability, Engines, and Hull die codes;
- minimum crew;
- persistent crew assignments by Actor UUID where explicitly managed;
- condition state;
- embedded starship-context weapons, shields, and equipment.

Current participants and round evasion are combat state, not permanent Actor fields.

### Combatant round-action flag

`flags.d6-system-2e.roundAction` is `D6CombatantRoundStateV1`:

- contract version and monotonic revision;
- Foundry round number;
- ordered stable action IDs with presentation label and typed kind;
- completed action IDs.

Penalty, current action, segment number, and completion are derived read-model
fields. When the stored round differs from the active Foundry round it reads as a
clean state, so document preparation never needs a corrective write.

## Item: `skill`

### Persistent source

- `key`: stable user/system slug;
- `attributeId`: governing stable attribute ID;
- `score`: canonical integer pip increase added to the governing attribute score;
- `training`: `standard` or `advanced`;
- `prerequisiteSkillKeys`: stable Skill keys used by Advanced Skills;
- `source.book`, `source.module`, and `source.page`: concise authority
  reference;
- `description`: user-authored HTML;
- `_migration`.

### Derived data

- localized name;
- governing attribute availability;
- total pool;
- eligible specializations;
- roll availability and permission.

### Validation and relationships

`attributeId` must be a known attribute. An embedded skill may reference an
inactive optional attribute but is visibly unavailable. `key` is unique among
embedded skills after normalization. A Second Edition Advanced Skill requires at
least two prerequisite Skills with derived ratings of 3D or more and cannot
exceed the lowest prerequisite. It uses its own rating when rolled alone. When
explicitly selected as the task context for one of its prerequisite Skill
rolls, its rating is added to that complete Skill pool as derived roll state.
The selection is stored on the typed roll request, not on the Actor or Item.
Creation commands are available to the owner only while the parent Actor is in
creation; later direct changes use the GM Free Edit boundary.

## Item: `specialization`

Optional module. Stores a parent embedded Item ID plus a stable parent Skill key
for import recovery, governing Attribute ID, source reference, narrow-focus
label, and canonical pip bonus. Resolution prefers the embedded ID and reports a
broken reference rather than silently reparenting. Second Edition creation fixes
the bonus at +1D, permits at most three for its one-die purchase, and rejects an
Advanced Skill as the parent.

## Items: `advantage`, `disadvantage`, and `specialability`

These remain distinct Foundry Item types for OpenD6 Next import compatibility and
because their validation, usage, frequency, and advancement rules differ. The
initial lossless union stores stable key, description, rank, numeric cost,
frequency, and activation/trigger text. Profile-specific automation remains
deferred until its authoritative rules inventory entry is complete.

## Planned cross-edition document matrix

| Document                       | Shared persistent facts                                                     | Profile-specific facts preserved while inactive                                                            |
| ------------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Character/NPC/creature         | attributes, skills, biography, movement, resources, conditions              | Hero Points; Character/Fate Points; Second Edition conditions; First Edition wounds/body points if enabled |
| Skill/specialization           | stable key, governing attribute, canonical pip score, training, description | advanced/flat behavior, specialization cost/history, used-this-session state                               |
| Equipment                      | quantity, mass, value, description, equip/container state                   | availability, era, legality, profile-specific modifiers                                                    |
| Weapon                         | equipment facts, attack skill, damage score, ranges, ammunition             | active-defense interactions, scale rules, damage strategy fields                                           |
| Armor                          | equipment facts, coverage, worn state                                       | resistance bonus dice, legacy armor value/reduction                                                        |
| Perk/flaw/talent/trouble/asset | stable key, rank, description, activation metadata                          | edition-specific costs, frequency, session counters, narrative triggers                                    |
| Power                          | discipline ID, stable effect references, rank/cost                          | Magic, Mysticism, Psionics, Metaphysics/Force presentation and profile rules                               |
| Vehicle/starship               | hull/body, movement, crew, weapons, scale, conditions                       | static/active defense state, shields, repair versus healing, legacy toughness                              |
| Template/species               | stable identity, proposed Actor/Item changes, provenance                    | edition/setting prerequisites and mapping choices                                                          |

Only types with a completed source schema, validation, migration, and sheet model
are added to `system.json`. Skill/equipment catalogs are content imports,
not hard-coded schema, and remain gated by distribution rights.
Automation uses typed system services, not arbitrary executable Item data.

## Items: `gear`, `weapon`, and `armor`

All now store stable key, description, quantity, mass, value, equipped state, and
a context of `personal`, `vehicle`, or `starship`.

- Weapons add attack attribute/skill keys, canonical pip damage, damage type,
  scale, three range bands, and ammunition.
- Armor adds canonical physical and energy resistance pip scores, coverage, and
  a stacking tag.
- Gear adds availability and legality metadata without executable behavior.

Context replaces separate vehicle/starship Item types unless the importer mapping
study demonstrates a stronger compatibility need.

## Item: `power`

Deferred. Stores a stable `disciplineId` and a payload validated by a system-owned
discipline definition. Companions may provide labels, themes, and content but may
not register executable rules engines.

## Item: `character-template`

Deferred. Applying a template is an explicit, previewable application service. It
does not remain a hidden alternate authority after application.

## Unknown data

Migrations and importers preserve unrecognized keys in a namespaced report/passthrough
area where Foundry validation would otherwise discard them. Importers never silently
coerce a foreign concept into a superficially similar Second Edition field.
