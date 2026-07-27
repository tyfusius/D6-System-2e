# Public API

## Versioning

The API is exposed at `game.system.api`. API major version 1 uses explicit
capabilities. Integrations must check both:

```ts
api.apiVersion === 1;
api.capabilities.has("roll.check");
```

Adding a new capability or optional field is compatible within major version 1.
Changing the meaning or required shape of an existing capability requires a new
major version or an explicit adapter.

## Foundation surface

The scaffold exposes:

- `apiVersion`
- `systemId`
- immutable `capabilities`
- `migrations.latestSchemaVersion`
- `campaign.current()`
- `health.condition(actor, proposed, options)`
- `rules.current()` and `rules.applyPreset("second-edition" | "open-d6")`
- `read.actor(actor)`
- `roll.attribute(actor, attributeId)`, `roll.skill(actor, itemId)`, and
  `roll.item(actor, itemId, "attack" | "damage")`
- `roll.reroll(actor, failedResult)`
- `terminology.register(ownerId, contribution)` and owner removal
- `themes.register(ownerId, definition)` and owner removal
- API-version guard

The following capabilities define the v1 boundary:

| Capability             | Contract                                                            |
| ---------------------- | ------------------------------------------------------------------- |
| `campaign.profile`     | Immutable versioned Second Edition campaign/module profile          |
| `health.condition`     | Authorized condition transitions and Stunned prevention             |
| `read.actor`           | Immutable Actor read model with stable IDs and available actions    |
| `roll.check`           | Typed check request to typed result through the system roll service |
| `roll.attribute`       | Convenience request by Actor and stable attribute ID                |
| `roll.item`            | Weapon attack/damage request by Actor and embedded Item ID          |
| `roll.reroll`          | Source-preserving Second Edition failed-roll Hero Point reroll      |
| `roll.skill`           | Convenience request by Actor and embedded skill ID                  |
| `registry.terminology` | Owner-scoped validated presentation contributions                   |
| `registry.theme`       | Owner-scoped semantic theme and optional dice presentation          |
| `registry.discipline`  | System-approved typed power discipline definitions                  |
| `combat.read`          | Immutable current action/combat state                               |
| `combat.command`       | Authorized declarations and corrections through system services     |
| `rules.profile`        | Read current rules profile and apply a validated built-in preset    |
| `advancement.command`  | Apply authoritative OpenD6 Attribute and embedded-Item advances     |

The API does not advertise capabilities that are not working.

The working capabilities are currently `foundation.identity`,
`advancement.command`, `campaign.profile`, `health.condition`,
`rules.profile`, `read.actor`, `roll.check`, `roll.attribute`, `roll.item`,
`roll.reroll`, `roll.skill`, `registry.terminology`, and `registry.theme`. A
companion can apply the complete OpenD6 preset with:

```ts
await game.system.api.rules.applyPreset("open-d6");
```

The result reports applied, unchanged, and failed setting keys plus the resolved
profile. A partially overridden preset resolves as `custom`.

Edition-specific option values remain system-private until their consuming
services have versioned public contracts. A companion may select the complete
OpenD6 profile through `rules.applyPreset`, contribute terminology through
`terminology.register`, and contribute presentation through `themes.register`;
it must not reach into either settings ApplicationV2 class.

## Campaign profile API

Second Edition configuration is resolved through:

```ts
const campaign = game.system.api.campaign.current();
```

`SecondEditionCampaignProfileV1` returns `profileVersion`, the stable
`core-default` or `custom` ID, ordered active Attribute IDs, known module IDs,
the explicit unnamed additional-Skill-module count, Advanced
Skill/Specialization activation, and character-creation Attribute/Skill budgets
in canonical pips. Callers must check `campaign.profile`; they must not read
Foundry settings directly.

The module list deliberately contains only authoritative known IDs. The numeric
additional-Skill-module count affects the p. 20 budget without inventing module
identities.

## Advancement API

When `firstEditionAdvancement` is active, sheets, macros, and future HUD adapters
use the same protected commands:

```ts
await game.system.api.advancement.attribute(actor, "agility");
await game.system.api.advancement.item(actor, skillId);
```

Both commands require ownership (or a GM), enforce Advance mode for players,
calculate the cost from configured OpenD6 multipliers, reject insufficient
Character Points, and return the cost, new score, and remaining balance. The
Item command restores the Character Point debit if the embedded update fails.
Second Edition advancement is intentionally unavailable until an authoritative
advancement module is selected.

## Roll API and request

The first callable surface is:

```ts
await game.system.api.roll.attribute(actor, "agility");
await game.system.api.roll.skill(actor, embeddedSkill.id);
await game.system.api.roll.item(actor, embeddedWeapon.id, "attack");
await game.system.api.roll.item(actor, embeddedWeapon.id, "damage");
await game.system.api.roll.reroll(actor, failedResult);
```

These calls open the system-owned ApplicationV2 roll builder and return the typed
`D6RollResultV1`, or `null` after cancellation. The system re-derives the score
from the Actor and Item; callers cannot submit a trusted total.

The current internal/public result contract uses version 1:

```ts
interface D6RollRequestV1 {
  contractVersion: 1;
  context?: {
    advancedSkill?: {
      itemId: string;
      label: string;
      score: number; // canonical Advanced Skill pips
    };
  };
  kind: "attribute" | "skill" | "weapon-attack" | "damage" | "resistance";
  label: string;
  heroPointUse: "none" | "double-die-code" | "reroll-failed";
  source: {
    actorId: string;
    actorName: string;
    attributeId: string;
    itemId?: string;
  };
  score: number; // canonical integer pip score, derived by the system
  resultModifier: number;
  difficulty?: number;
  opposition?: {
    name: string;
    total: number;
    actorKind: "player-character" | "non-player-character" | "unknown";
    opponentKind: "player-character" | "non-player-character" | "unknown";
    wildDieFace?: number;
  };
  rollMode: "publicroll" | "gmroll" | "blindroll" | "selfroll";
}
```

Weapon attack, raw damage pools, and failed-roll Hero Point rerolls are
implemented. Resistance, damage comparison, action context, and other follow-ups
remain reserved extensions. They will extend the typed pipeline, not create
parallel sheet or HUD engines.

When the optional Second Edition Advanced Skill module is active, a standard
Skill roll can record one explicit applicable Advanced Skill in `context`.
The system derives the augmented score from the embedded documents; integrations
must not submit or recalculate a trusted total. A direct Advanced Skill roll
continues to use its own rating.

`roll.reroll` requires local ownership, an available Hero Point, a failed result,
and no prior Hero Point expenditure on that result. It preserves the original
request's source, score, difficulty/opposition, modifier, and visibility. The
chat adapter also marks its originating message action as consumed.

## Health API

Condition changes use:

```ts
await game.system.api.health.condition(actor, "wounded");
await game.system.api.health.condition(actor, "stunned", {
  preventStunnedWithHeroPoint: true,
});
```

The prevention option is accepted only for a transition into Stunned under the
Second Edition Hero Point economy. It spends one Hero Point and retains the
previous condition. It does not remove an existing Stunned condition.

## Roll result

A `D6RollResultV1` contains the normalized pool, base and Wild Die faces, total,
difficulty evaluation, authoritative success, Wild Die outcome/choice, Hero Point
award, profile ID, and source request. Chat stores this object under the system's
versioned flag. Human-readable HTML is never parsed back into rules state.

Second Edition Complication choices which the rules assign to the GM currently
require the initiating user to be a GM. The future authoritative socket service
will route that decision to a connected GM without exposing hidden roll data.

## Actor read model

`api.read.actor(actor)` returns immutable `D6ActorReadModelV1`. This is the first
HUD-facing projection.

The read model includes:

- Actor UUID, type, name, image, and ownership capabilities;
- active attributes with stable IDs and derived pools;
- embedded rollable Items with stable document IDs;
- Skill classification as `standard`, `advanced`, or `specialization`, with an
  optional parent embedded Skill ID for Specializations;
- resources and condition summaries;
- available API actions;
- combat view only when the combat capability is active.

It excludes mutable document references, private system source, raw flags, and
HTML. Attribute and skill scores remain canonical integer pips with normalized
Die Codes supplied for presentation. Consumers still delegate rolls to the API.

## Registries

Every registration includes a module owner ID. IDs use lowercase ASCII slugs.
Definitions are validated, frozen, and collision-checked. Unregister removes only
that owner's contributions. Stored unavailable IDs are preserved and resolve to a
generic fallback.

Terminology contributions map visible labels to stable IDs such as `agility`,
`brawn`, `mechanical`, and `technical`; they never rename stored fields. Theme
definitions contain semantic sheet/chat tokens and an optional Dice So Nice
appearance contract. Registration alone does not select a player or Actor theme.

## Errors and authority

The API rejects unsupported versions, unavailable capabilities, invalid IDs,
unauthorized actors, stale revisions, and duplicate request IDs with typed error
codes. External integrations never write system flags or Actor resources directly.
