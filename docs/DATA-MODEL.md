# Data model

Status: active implementation. `character`, `npc`, `creature`, `vehicle`, and
`starship` Actors plus all declared Item families have explicit Foundry v14
data models. Schema 11 adds distinct native Second Edition Perk, Flaw, Talent,
Trouble, and Asset documents without reinterpreting OpenD6 compatibility Items.

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
- `movement.posture`: schema 14's `standing` or `prone` personal-combat state.
  It is independent of token position so gridless scenes retain the rule.
- `movement.base`: schema 16's positive base Move (default 10), used by the
  independent First Edition land, swim, climb, and flying movement planner.
- `scale`: schema 14's integer personal scale rank from 0 through 6. Rank alone
  has no modifier; only relative rank is meaningful.
- `creation.active`: persistent unfinished-character marker. New native Second
  Edition characters start active; schema 8 initializes existing and imported
  Actors as inactive.
- `creation.specializationSlots`: `0` or `3`. Schema 12 records the explicit
  p. 99 exchange of 1D from the Skill budget before any Specialization is
  created. Existing Actors with Specialization Items migrate to three slots;
  all others migrate to zero.
- `advancement.milestone.attributeDice`: unused whole Attribute-die rewards.
- `advancement.milestone.skillPips`: unused Skill rewards in canonical pips;
  each milestone adds nine, whole-die games spend three per increase, and
  Module: Pips games spend one.
- `advancement.narrativeArcs`: schema 13's persisted arc records. Each stores a
  stable ID, title, reward kind/document ID/name, target pip score, draft /
  approved / completed status, and ordered stable-ID steps with completion
  state.
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
- creation mode enforces page 20 budgets and limits transactionally, including
  rejecting Attribute or Skill increases that would overspend; the optional
  Specialization module separately exchanges 1D of Skill capacity for three
  slots; post-creation editing follows the selected advancement policy;
- `resources.experiencePoints.value`: latent non-negative integer owned by the
  Second Edition Experience Points profile (pp. 86-88). Schema 9 adds it without
  converting Hero Points or OpenD6 currencies;
- Milestone balances are non-negative integers and change only through
  protected award, spend, or full-bundle Perk-exchange commands;
- Narrative proposals require a live Skill or Attribute reward and exactly as
  many non-empty steps as the reward's new full-die rating. Only a GM approves
  or grants the reward, and completion revalidates that the reward rating has
  not changed;
- Hero Points cannot be negative;
- condition IDs must be registered system conditions;
- optional attributes may be stored while inactive, but cannot be selected by a
  new skill unless enabled.

### Hero Point command state

Roll ChatMessages store the complete `D6RollResultV1` under the system flag.
Eligible failed-roll cards record `rollFollowUpUsed` and a
`rollFollowUpClaim { requestId, userId }` on the originating message before a
Hero Point reroll or Doubling Down executes. Both alternatives share the marker,
so rerendering and a second owning client cannot independently consume the same
result. A cancelled or failed command releases its own claim. Legacy
`heroPointRerollUsed` is still read when rendering older messages. This is
transaction/audit state on the ChatMessage, not character state.

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

Uses the common character schema. `defenses.dodgeOverride` and
`defenses.parryOverride` are non-negative static values. A positive value
replaces the ordinary derived defense; zero retains the standard calculation.
This follows D62e p. 132 without forcing every creature to carry an override.

## Skill source reference

Every catalog Skill stores `source.book`, `source.module`, and `source.page`.
`description` remains a separate HTML field. This supports a public citation-only
record and a private companion record with licensed prose without changing the
stable `system.key`.

## Actor: `vehicle`

Optional science-fiction module:

- `attributes.maneuverability.score` and `attributes.hull.score` as canonical
  pip scores;
- `passengers` as a non-negative integer excluding the driver;
- `crew.members` as Schema 15's ordered `{actorId, name}` roster;
- `armor.score` as the vehicle-scale resistance contribution;
- `scale`, `biography`, migration metadata, and the shared condition state;
- embedded `vehicle-weapon`, `vehicle-gear`, and `armor` Items.

Defense is derived as five times the full Hull dice. Resistance combines the
effective Hull and Armor components. The roster is persistent configuration;
the selected gunner and their round action state remain transient.

## Actor: `starship`

Optional science-fiction module:

- `attributes.navicomp.score`, `attributes.maneuverability.score`,
  `attributes.engines.score`, and `attributes.hull.score` as canonical pip
  scores;
- `crew.minimum` as a positive integer and `crew.members` as Schema 15's
  ordered `{actorId, name}` roster;
- `shields.score` as the starship-scale resistance contribution;
- `scale`, `biography`, migration metadata, and the shared condition state;
- embedded `starship-weapon`, `starship-gear`, and `armor` Items.

Defense is derived as five times the full Hull dice. Resistance combines Hull
and Shields. Crew shortfall is derived from resolvable roster entries and the
minimum; the selected gunner and round evasion are transient combat state.

### Combatant round-action flag

`flags.d6-system-2e.roundAction` is `D6CombatantRoundStateV1`:

- contract version and monotonic revision;
- Foundry round number;
- ordered stable action IDs with presentation label, typed kind, optional
  movement mode, and an optional `endProne` choice for Walk or Run;
- completed action IDs.
- an optional typed First Edition active-defense snapshot containing kind,
  Partial/Full mode, source Skill, roll total/difficulty, and label.

Penalty, current action, segment number, and completion are derived read-model
fields. When the stored round differs from the active Foundry round it reads as a
clean state, so document preparation never needs a corrective write.
Completing a movement action also persists its rules-derived posture transition:
Stand becomes Standing, Crawl remains Prone, and a Walk or Run marked
`endProne` becomes Prone.
First Edition uses this flag for count-only commitments and active-defense
results. Clearing optional nested fields is explicit because Foundry flag
updates merge recursively.

### Roll scale context

`flags.d6-system-2e.roll.request.context.scale` is an optional
`D6ScaleRollContext`. It records the application (`attack`, `damage`, or
`resistance`), the applied canonical-pip modifier, both participant Actor
identities and scale ranks, available Token identities, and the p. 196 source
reference. The context is audit data; the request's final `score` remains the
authoritative pool sent to the roller.

### Personal damage-resolution flag

A targeted personal Damage message may store
`flags.d6-system-2e.damageResolution`. Version 1 first claims `resolving`, then
stores `applied` with Damage and Brawn-resistance totals, target identity,
incoming result, previous and resulting Conditions, Brawn Complication status,
and whether a Hero Point prevented Stunned. The Actor Condition remains the
authoritative health state; the message flag is an idempotency and player-visible
audit record for that specific Damage roll.

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

## Items: `perk`, `flaw`, and `talent`

These are the native Second Edition character-feature families from D62e
pp. 101-129. They remain distinct from OpenD6 Advantages, Disadvantages, and
Special Abilities.

- all three store a stable key, rank, focus/scope, description, migration
  metadata, and source book/module/page;
- Talent additionally stores its integer creation cost in Skill dice and
  whether its definition permits repeated purchase;
- Perk and Flaw creation value is derived from rank by the creation service; it
  is not duplicated as mutable cost data;
- bespoke modifiers, prerequisites, links, and activation behavior are not
  represented as executable Item data.

Schema 11 preserves these Items in every profile. The optional module activates
creation accounting in native Second Edition; complete OpenD6 keeps them
inactive-preserved. See ADR 0019.

## Items: `trouble` and `asset`

These native Second Edition narrative features store a stable key, narrative
trigger, description, migration metadata, and source citation from D62e
pp. 130-131. The printed twice-per-session limit is not stored on each Item. A
revisioned per-Actor system flag owns the session ID and per-Item use counts.
Owners invoke Troubles and Assets; only a GM may reset the session.

## Planned cross-edition document matrix

| Document                       | Shared persistent facts                                                     | Profile-specific facts preserved while inactive                                                            |
| ------------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Character/NPC/creature         | attributes, skills, biography, movement, resources, conditions              | Hero Points; Character/Fate Points; Second Edition conditions; First Edition wounds/body points if enabled |
| Skill/specialization           | stable key, governing attribute, canonical pip score, training, description | advanced/flat behavior, specialization cost/history, used-this-session state                               |
| Equipment                      | quantity, mass, value, description, equip/container state                   | availability, era, legality, profile-specific modifiers                                                    |
| Weapon                         | equipment facts, attack skill, damage score, ranges, ammunition             | active-defense interactions, scale rules, damage strategy fields                                           |
| Armor                          | equipment facts, coverage, worn state                                       | resistance bonus dice, legacy armor value/reduction                                                        |
| Perk/flaw/talent/trouble/asset | stable key, rank where applicable, description, source, focus/trigger       | typed creation accounting, public read projection, and Actor-owned narrative-feature session state         |
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
