# Data model

Status: initial design. Only `character` and `skill` are admitted to the first
vertical slice. Later types are documented before they are declared in the manifest.

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

Every attribute, skill increase, and later die-code-bearing value is stored as one
non-negative integer pip score. Three pips equal one die. Thus `10` is presented
as `3D+1`, and adding a 7-pip skill increase produces a total score of 17,
presented as `5D+2`.

The Second Edition Pips module determines whether players may purchase and retain
the `+1` and `+2` remainders. It does not change the internal unit. Dice and
remainder pips are presentation projections and are never separate persistent
sources of truth.

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
- `health.condition`: stable condition ID. The healthy value is `healthy`; damage
  progression is not automated until page 33 is resolved.
- `biography`: user-authored HTML field.
- `_migration`: migration metadata.
- embedded `skill` Items and, later, other supported Items.

### Derived data

- active attributes from the world module profile;
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

### Ownership

Foundry Actor ownership is authoritative. Owners may edit ordinary character fields
and request rolls, but ownership does not grant direct writes to attribute or skill
scores. Players increase skills only through the Advance application service, which
will validate costs and transact points atomically. Direct score correction and
embedded-skill creation require a GM in Free Edit. Resource transactions use an
application service with revision and idempotency checks.

## Actor: `npc`

Uses the character rules and common schema. Differences are presentation, creation
workflow, and default permissions. Significant foes may use full character creation
rules per pages 132-137. This is core-supporting behavior, implemented in Phase 3.

## Actor: `creature`

Uses the common character schema plus explicit optional `defenseOverrides` because
pages 132-137 state that some creatures deliberately do not use standard defense
calculations. Overrides are nullable; absence means derive normally. This is
core-supporting optional content behavior.

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

## Item: `skill`

### Persistent source

- `key`: stable user/system slug;
- `attributeId`: governing stable attribute ID;
- `score`: canonical integer pip increase added to the governing attribute score;
- `training`: `standard` or `advanced`;
- `description`: user-authored HTML;
- `_migration`.

### Derived data

- localized name;
- governing attribute availability;
- total pool;
- eligible specializations;
- roll availability and permission.

### Validation and relationships

`attributeId` must be a known attribute. An embedded skill may reference an inactive
optional attribute but is visibly unavailable. `key` is unique among embedded skills
after normalization. Direct score updates and embedded creation use the same GM
Free Edit boundary as the parent Actor; future player increases go through the
Advance service rather than Item updates issued by a sheet. The Item is core for
standard skills and optional for advanced skill behavior.

## Item: `specialization`

Optional module. Stores a parent embedded Item ID plus a stable parent skill key for
import recovery, a narrow-focus label, and its bonus die code. Resolution prefers
the embedded ID and reports a broken reference rather than silently reparenting.

## Items: `perk`, `flaw`, `talent`, `trouble`, and `asset`

Optional modules. These remain distinct Foundry Item types because their validation,
usage, frequency, and advancement rules differ. Shared description and rank fields
come from source-level schema helpers, while each final Foundry DataModel is explicit.

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

Only types with a completed source schema, validation, migration, sheet/read model,
and tests are added to `system.json`. Skill/equipment catalogs are content imports,
not hard-coded schema, and remain gated by distribution rights.
Automation uses typed system services, not arbitrary executable Item data.

## Items: `equipment`, `weapon`, and `armor`

All store description, quantity, equipped state, and a context of `personal`,
`vehicle`, or `starship`.

- Weapons add typed attack source, damage code, range, and ammunition fields.
- Armor adds typed resistance bonus and stacking tags.
- Equipment adds only behavior supported by a registered system capability.

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
