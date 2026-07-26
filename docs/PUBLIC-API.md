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
- API-version guard

The following target capabilities are reserved and documented before implementation:

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

Foundation code does not advertise capabilities that are not working.

## Roll request

The target v1 request describes intent rather than Foundry internals:

```ts
interface CheckRequestV1 {
  version: 1;
  requestId: string;
  actorUuid: string;
  kind: "attribute" | "skill" | "attack" | "damage" | "resistance" | "custom";
  source: {
    attributeId?: string;
    itemId?: string;
  };
  pool: {
    dice: number;
    pips: number;
    contributors: readonly PoolContributorV1[];
  };
  wildDiePolicyId: string;
  target:
    | { kind: "difficulty"; value: number }
    | { kind: "opposed"; actorUuid?: string; score?: number }
    | { kind: "none" };
  modifiers: readonly ModifierV1[];
  heroPoint: { spend: "none" | "double" | "reroll" };
  actionContext?: ActionContextV1;
  presentation: {
    label: string;
    themeId?: string;
    terminologyId?: string;
    visibility: "public" | "gm" | "self" | "blind";
  };
  followUp?: FollowUpV1;
}
```

Callers cannot provide trusted totals, resource balances, ownership, or combat
penalties. The application service re-derives authoritative values.

## Roll result

A result contains structured faces, provisional and final evaluation, Wild Die
resolution, resource transactions, follow-up metadata, and an audit-safe source
summary. Human-readable chat HTML is not part of the rules contract.

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

## Errors and authority

The API rejects unsupported versions, unavailable capabilities, invalid IDs,
unauthorized actors, stale revisions, and duplicate request IDs with typed error
codes. External integrations never write system flags or Actor resources directly.
