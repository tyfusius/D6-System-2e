# Data model

Status: initial design. Only `character` and `skill` are admitted to the first
vertical slice. Later types are documented before they are declared in the manifest.

## Shared values

### Die code

```ts
interface DieCodeSource {
  dice: number;
  pips: number;
}
```

`dice` and `pips` are stored separately. Pips remain zero and inactive unless the
campaign profile enables their module. Presentation strings such as `3D+1` are derived.

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
  die code. Optional values survive when their module is inactive.
- `resources.heroPoints.value`: non-negative integer, initialized to 1 for new
  characters through the creation service.
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

Derived values are not written during document preparation.

### Validation

- core attribute dice are finite integers from 1 through 5; inactive optional
  attribute dice are finite integers from 0 through 5;
- pip values are finite non-negative integers until the optional pip module's
  authoritative normalization rules are implemented;
- creation mode enforces page 20 budgets and limits, while post-creation editing
  follows the selected advancement policy;
- Hero Points cannot be negative;
- condition IDs must be registered system conditions;
- optional attributes may be stored while inactive, but cannot be selected by a
  new skill unless enabled.

### Ownership

Foundry Actor ownership is authoritative. Owners may edit ordinary character fields
and request rolls. Resource transactions use an application service with revision
and idempotency checks. GM-only configuration and corrections are separate commands.

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
- `rating`: die code added to the attribute;
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
after normalization. The Item is core for standard skills and optional for advanced
skill behavior.

## Item: `specialization`

Optional module. Stores a parent embedded Item ID plus a stable parent skill key for
import recovery, a narrow-focus label, and its bonus die code. Resolution prefers
the embedded ID and reports a broken reference rather than silently reparenting.

## Items: `perk`, `flaw`, `talent`, `trouble`, and `asset`

Optional modules. These remain distinct Foundry Item types because their validation,
usage, frequency, and advancement rules differ. Shared description and rank fields
come from source-level schema helpers, while each final Foundry DataModel is explicit.
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
