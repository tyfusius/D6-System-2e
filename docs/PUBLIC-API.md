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
- `rules.current()` and `rules.applyPreset("second-edition" | "open-d6")`
- `roll.attribute(actor, attributeId)` and `roll.skill(actor, itemId)`
- `terminology.register(ownerId, contribution)` and owner removal
- `themes.register(ownerId, definition)` and owner removal
- API-version guard

The following capabilities define the v1 boundary:

| Capability             | Contract                                                            |
| ---------------------- | ------------------------------------------------------------------- |
| `read.actor`           | Immutable Actor read model with stable IDs and available actions    |
| `roll.check`           | Typed check request to typed result through the system roll service |
| `roll.attribute`       | Convenience request by Actor and stable attribute ID                |
| `roll.skill`           | Convenience request by Actor and embedded skill ID                  |
| `registry.terminology` | Owner-scoped validated presentation contributions                   |
| `registry.theme`       | Owner-scoped semantic theme and optional dice presentation          |
| `registry.discipline`  | System-approved typed power discipline definitions                  |
| `combat.read`          | Immutable current action/combat state                               |
| `combat.command`       | Authorized declarations and corrections through system services     |
| `rules.profile`        | Read current rules profile and apply a validated built-in preset    |

The API does not advertise capabilities that are not working.

The working capabilities are currently `foundation.identity`, `rules.profile`,
`roll.check`, `roll.attribute`, `roll.skill`, `registry.terminology`, and
`registry.theme`. A companion can apply the complete OpenD6 preset with:

```ts
await game.system.api.rules.applyPreset("open-d6");
```

The result reports applied, unchanged, and failed setting keys plus the resolved
profile. A partially overridden preset resolves as `custom`.

## Roll API and request

The first callable surface is:

```ts
await game.system.api.roll.attribute(actor, "agility");
await game.system.api.roll.skill(actor, embeddedSkill.id);
```

Both calls open the system-owned ApplicationV2 roll builder and return the typed
`D6RollResultV1`, or `null` after cancellation. The system re-derives the score
from the Actor and Item; callers cannot submit a trusted total.

The current internal/public result contract uses version 1:

```ts
interface D6RollRequestV1 {
  contractVersion: 1;
  kind: "attribute" | "skill";
  label: string;
  source: {
    actorId: string;
    actorName: string;
    attributeId: string;
    itemId?: string;
  };
  score: number; // canonical integer pip score, derived by the system
  resultModifier: number;
  difficulty?: number;
  rollMode: "publicroll" | "gmroll" | "blindroll" | "selfroll";
}
```

Attack, damage, resistance, opposed checks, resource spending, action context,
and follow-ups remain reserved extensions. They will extend the typed pipeline,
not create parallel sheet or HUD engines.

## Roll result

A `D6RollResultV1` contains the normalized pool, base and Wild Die faces, total,
difficulty evaluation, authoritative success, Wild Die outcome/choice, Hero Point
award, profile ID, and source request. Chat stores this object under the system's
versioned flag. Human-readable HTML is never parsed back into rules state.

Second Edition Complication choices which the rules assign to the GM currently
require the initiating user to be a GM. The future authoritative socket service
will route that decision to a connected GM without exposing hidden roll data.

## Actor read model

The read model includes:

- Actor UUID, type, name, image, and ownership capabilities;
- active attributes with stable IDs and derived pools;
- embedded rollable Items with stable document IDs;
- resources and condition summaries;
- available API actions;
- combat view only when the combat capability is active.

It excludes mutable document references, private system source, raw flags, and HTML.

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
