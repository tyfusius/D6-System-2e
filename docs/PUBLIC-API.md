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
- `combat.read(actor)`, `combat.declare(actor, declaration)`,
  `combat.completeNext(actor, expectedRevision)`, and
  `combat.reset(actor, expectedRevision)`
- `combat.commitFirstEdition(actor, commitment)` and
  `combat.spendFirstEdition(actor, expectedRevision)`
- `health.condition(actor, proposed, options)`,
  `health.wound(actor, proposed)`, and `health.posture(actor, proposed)`
- `rules.current()` and `rules.applyPreset("second-edition" | "open-d6")`
- `read.actor(actor)`
- `roll.attribute(actor, attributeId)`, `roll.skill(actor, itemId)`, and
  `roll.item(actor, itemId, "attack" | "damage")`
- `roll.resistance(actor)`
- `roll.doubleDown(actor, failedResult, narration?)`
- `roll.reroll(actor, failedResult)`
- `terminology.register(ownerId, contribution)` and owner removal
- `themes.register(ownerId, definition)` and owner removal
- API-version guard

The following capabilities define the v1 boundary:

| Capability             | Contract                                                            |
| ---------------------- | ------------------------------------------------------------------- |
| `campaign.profile`     | Immutable versioned Second Edition campaign/module profile          |
| `health.condition`     | Authorized condition transitions and Stunned prevention             |
| `health.wound`         | Authorized independent First Edition wound transitions              |
| `feature.read`         | Revisioned Trouble/Asset session state                              |
| `feature.command`      | Authorized Trouble/Asset invocation and GM session reset            |
| `read.actor`           | Immutable Actor read model with stable IDs and available actions    |
| `roll.check`           | Typed check request to typed result through the system roll service |
| `roll.attribute`       | Convenience request by Actor and stable attribute ID                |
| `roll.double-down`     | Source-preserving Second Edition Doubling Down retry                |
| `roll.item`            | Weapon attack/damage request by Actor and embedded Item ID          |
| `roll.resistance`      | Edition-aware Strength/Brawn-plus-equipped-armor resistance request |
| `roll.reroll`          | Source-preserving Second Edition failed-roll Hero Point reroll      |
| `roll.skill`           | Convenience request by Actor and embedded skill ID                  |
| `registry.terminology` | Owner-scoped validated presentation contributions                   |
| `registry.theme`       | Owner-scoped semantic theme and optional dice presentation          |
| `registry.discipline`  | System-approved typed power discipline definitions                  |
| `combat.read`          | Immutable current action/combat state                               |
| `combat.command`       | Authorized declarations and corrections through system services     |
| `rules.capabilities`   | Versioned resolved cross-edition rules-family decisions             |
| `rules.profile`        | Read current rules profile and apply a validated built-in preset    |
| `advancement.command`  | Apply authoritative OpenD6 Attribute and embedded-Item advances     |

The API does not advertise capabilities that are not working.

The working capabilities are currently `foundation.identity`,
`advancement.command`, `campaign.profile`, `health.condition`, `health.wound`,
`feature.read`, `feature.command`,
`rules.capabilities`, `rules.profile`, `read.actor`, `roll.check`,
`roll.attribute`, `roll.double-down`, `roll.item`, `roll.resistance`,
`roll.reroll`, `roll.skill`,
`registry.terminology`, `registry.theme`, `combat.read`, and `combat.command`.
A companion can apply the
complete OpenD6 preset with:

```ts
await game.system.api.rules.applyPreset("open-d6");
const capabilities = game.system.api.rules.capabilities();
```

The result reports applied, unchanged, and failed setting keys plus the resolved
profile. A partially overridden preset resolves as `custom`.

`rules.capabilities()` returns versioned `EditionCapabilityProfileV1`. Each
rules-family decision has a stable ID, owning edition, strategy ID, and
`active`, `inactive-preserved`, or `planned` state. Integrations inspect the
relevant decision instead of treating the overall profile ID as proof that every
feature uses one edition.

The `pips` decision resolves to `second-edition-whole-dice`,
`second-edition-pips-module`, or `open-d6-classic-pips`. Actor read-model
`score`, `bonusScore`, and `code` values are effective rules values, not raw
Foundry persistence. Integrations must not recombine private stored scores.

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
the explicit unnamed additional-Skill-module count, Pips-module activation,
Advanced Skill/Specialization activation, and character-creation Attribute/Skill budgets
in canonical pips. Callers must check `campaign.profile`; they must not read
Foundry settings directly.

The module list deliberately contains only authoritative known IDs. The numeric
additional-Skill-module count affects the p. 20 budget without inventing module
identities.

## Advancement API

When OpenD6 Character Point advancement or Second Edition Experience Point
advancement is active, sheets, macros, and future HUD adapters
use the same protected commands:

```ts
await game.system.api.advancement.attribute(actor, "agility");
await game.system.api.advancement.item(actor, skillId);
```

Both commands require ownership (or a GM), enforce Advance mode for players,
calculate the cost through the selected strategy, reject insufficient resources,
and return the cost, new score, and remaining balance. The Item command restores
the resource debit if the embedded update fails.
Results identify `strategy`, `resource`, `cost`, `remaining`, and the resulting
score. The legacy `remainingCharacterPoints` field remains required for API-v1
compatibility; XP results report the unchanged Character Point balance there
and the XP balance in `remaining`. Second Edition XP Attribute and Skill
improvements and Specialization acquisition are authoritative. The same
protected surface now publishes:

```ts
await game.system.api.advancement.milestone.read(actor);
await game.system.api.advancement.milestone.award(actor);
await game.system.api.advancement.milestone.exchangeForPerk(actor, perk);

await game.system.api.advancement.narrative.read(actor);
await game.system.api.advancement.narrative.propose(actor, proposal);
await game.system.api.advancement.narrative.approve(actor, arcId);
await game.system.api.advancement.narrative.toggleStep(actor, arcId, stepId);
await game.system.api.advancement.narrative.complete(actor, arcId);
await game.system.api.advancement.narrative.remove(actor, arcId);
```

Milestone awards, Perk exchange, Narrative approval, reward completion, and
removal require GM authority. Proposal and step tracking enforce Actor
ownership, the selected profile, target validity, and the printed workflow.

## Roll API and request

The first callable surface is:

```ts
await game.system.api.roll.attribute(actor, "agility");
await game.system.api.roll.skill(actor, embeddedSkill.id);
await game.system.api.roll.item(actor, embeddedWeapon.id, "attack");
await game.system.api.roll.item(actor, embeddedWeapon.id, "damage");
await game.system.api.roll.doubleDown(
  actor,
  failedResult,
  "I find a safer handhold.",
);
await game.system.api.roll.reroll(actor, failedResult);
```

These calls open the system-owned ApplicationV2 roll builder and return the typed
`D6RollResultV1`, or `null` after cancellation. The system re-derives the score
from the Actor and Item; callers cannot submit a trusted total.

The optional third argument of `roll.attribute` and `roll.skill` is reserved for
system-authorized workflow context. GM-requested rolls use it to identify the
requester, recipient, request ID, and locked Public, Player + GM, or GM-only
Blind audience. Thin integrations should initiate ordinary rolls without
manufacturing this context; request authorization and socket delivery remain
system-owned.

The current internal/public result contract uses version 1:

```ts
interface D6RollRequestV1 {
  contractVersion: 1;
  context?: {
    actionEconomy?: {
      round: number;
      actionCount: number;
      penaltyScore: number; // canonical pips
      penaltyLabel: string;
    };
    advancedSkill?: {
      itemId: string;
      label: string;
      score: number; // canonical Advanced Skill pips
    };
    requestedRoll?: {
      recipientUserId: string;
      requestId: string;
      requesterName: string;
      requesterUserId: string;
      rollMode: "publicroll" | "gmroll" | "blindroll";
      visibility: "public" | "private" | "hidden";
    };
    scale?: {
      application: "attack" | "damage" | "resistance";
      modifierScore: number; // canonical pips already included in score
      sourcePage: 196;
      sourceActorId: string;
      sourceName: string;
      sourceRank: number; // 0 through 6
      sourceTokenId?: string;
      targetActorId: string;
      targetName: string;
      targetRank: number; // 0 through 6
      targetTokenId?: string;
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

Weapon attack, raw damage pools, Brawn-plus-armor resistance, failed-roll Hero
Point rerolls, Doubling Down, and declared action context are implemented.
Action-producing rolls expose an editable MAP in dice. Their typed
`actionEconomy` context separates applied MAP, tracked MAP, movement, and
Condition penalties and records whether the applied MAP came from tracked state
or a manual override. Resistance and Damage rolls remain action-penalty exempt.
Targeted weapon attacks preserve target Actor/Token IDs, measured distance,
range band, static defense kind/value, and weapon identity in the typed result.
When a scene participant is selected, Second Edition relative scale is included
in the same immutable request: the smaller attacker gains its attack bonus, a
smaller ranged target gains its Dodge bonus, a larger attacker gains its damage
bonus, and a larger resisting Actor gains its Brawn-resistance bonus. Parry
never receives the relative-scale bonus. These fixed +1D-per-rank applications
follow D62e pp. 196–197.
Targeted personal Damage chat cards now extend this pipeline with a GM-only
resolver. It rolls the target's Brawn-plus-armor resistance through the same
public roll service, applies the accepted p. 33 ruling through the health
service, and persists the resolution on the original chat message. This
Foundry-facing orchestration is intentionally not a new public API command;
external consumers continue to call the typed roll and health commands.
If the applied result freshly makes an active Combatant Wounded, the same
orchestration stores p. 33's action forfeiture and audits it on the Damage card.

## Combat action API

`combat.read(actor)` returns the immutable versioned state for the Actor's
Combatant in the active combat, or `null`. Declarations contain one or more
ordered `{kind, label, movementMode?, endProne?}` entries. Movement mode is one
of `hold`, `walk`, `run`, `crawl`, or `stand`; `endProne` is accepted only for a
Walk or Run. Legacy declarations without either field remain valid.
State-changing commands require the last observed revision and reject stale
writes. Player owners may declare and advance their own state, but only a GM may
reset after resolution begins. Completing movement persists the resulting
posture without moving the Token automatically.

The read model's optional `actionForfeiture` is present for a character who
became Wounded during that active round. Its stable reason is `wounded` and its
source page is 33. While present, `currentAction` is absent, `complete` is true,
ordinary action rolls and redeclaration are rejected, and only a GM may perform
a corrective reset. The next Foundry round resolves to a clean state without a
write. First Edition commitments never receive this Second Edition marker.

First Edition uses the same versioned Combatant document but does not fabricate
ordered action entries. `combat.commitFirstEdition` stores only total actions,
base action allotment, `none`/`partial-defense`/`full-defense`, and the number
already spent. `combat.spendFirstEdition` advances the spent count. Full Defense
requires exactly one action; Partial Defense uses the complete round MAP. These
commands are rejected unless the resolved action-economy strategy is
`open-d6-flexible-action-allotment`.

`roll.defense(actor, kind)` is the typed First Edition active-defense command.
It accepts `dodge`, `block`, or `parry`, resolves the canonical Dodge,
Brawling, or Melee Combat Skill, applies tracked MAP only to Partial Defense,
adds Full Defense's +10 automatically, posts structured roll audit, and records
the active difficulty on the Combatant. Capability discovery exposes it as
`roll.defense`.

The current standard-initiative slice deliberately does not publish a global
turn order: printed pp. 30-31 use the same contextual action roll both for order
and task success. A future Combat-owned strategy/cursor contract will be added
for alternate initiative rather than changing this contract's meaning.

When the optional Second Edition Advanced Skill module is active, a standard
Skill roll can record one explicit applicable Advanced Skill in `context`.
The system derives the augmented score from the embedded documents; integrations
must not submit or recalculate a trusted total. A direct Advanced Skill roll
continues to use its own rating.

`roll.reroll` requires local ownership, an available Hero Point, a failed result,
and no prior Hero Point expenditure on that result. It preserves the original
request's source, score, difficulty/opposition, modifier, and visibility. The
chat adapter also marks its originating message action as consumed.

`roll.doubleDown` requires local ownership, an eligible failed non-combat
Attribute or Skill result, and the active Second Edition retry strategy. It
replays the complete effective Die Code without spending a resource twice. The
typed retry records the original total, optional narration, and printed page 25
reference. Retry failure is a Complication with no Hero Point award.

## Health API

Condition changes use:

```ts
await game.system.api.health.condition(actor, "wounded");
await game.system.api.health.condition(actor, "stunned", {
  preventStunnedWithHeroPoint: true,
});
await game.system.api.health.posture(actor, "prone");
```

The prevention option is accepted only for a transition into Stunned under the
Second Edition Hero Point economy. It spends one Hero Point and retains the
previous condition. It does not remove an existing Stunned condition.
Posture changes require the same Actor ownership boundary and return both the
previous and current posture.

## Roll result

A `D6RollResultV1` contains the normalized pool, base and Wild Die faces, total,
difficulty evaluation, authoritative success, Wild Die outcome/choice, Hero Point
award, exact Wild Die policy, profile ID, and source request. Chat stores this object under the system's
versioned flag. Human-readable HTML is never parsed back into rules state.

Second Edition Core Complication decisions and Classic mishap classifications
route to the deterministic active GM through the authoritative socket without
exposing hidden roll data. A missing GM cancels the unresolved roll rather than
choosing a result.

## Actor read model

`api.read.actor(actor)` returns immutable `D6ActorReadModelV1`. This is the first
HUD-facing projection.

Character-family read models include:

- Actor ID, type, name, image, and ownership capabilities;
- active attributes with stable IDs and derived pools;
- embedded rollable Items with stable document IDs;
- Skill classification as `standard`, `advanced`, or `specialization`, with an
  optional parent embedded Skill ID for Specializations;
- cross-edition resource balances.

API v1 projects native Perks, Flaws, Talents, Troubles, and Assets in the
immutable Actor `features` collection. Entries include capability state,
creation-budget value, typed fields, and session uses. The `feature.read` and
`feature.command` capabilities expose revision-checked Trouble/Asset invocation
and GM reset commands. OpenD6 compatibility feature Items remain distinct.

Vehicle and starship models keep the same envelope, project only their
source-backed systems in `attributes`, and add an optional immutable `machine`
object containing machine kind, capacity kind/value, current Condition, derived
Defense, protection score, combined resistance score, assigned crew count, and
minimum-crew shortfall. Machine weapons advertise Attack and Damage. Calling
`roll.item(machine, weaponId, "attack")` selects a rostered crew Actor inside
the authoritative system roll service. Machine models do not fabricate
character Attributes, Skills, or resources.

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
