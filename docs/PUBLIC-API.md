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
- `campaignPackages.current()`, `campaignPackages.register(ownerId, manifest)`,
  `campaignPackages.resolve(selection)`, `campaignPackages.selection()`, and
  owner removal
- `firstEditionGenreProfiles.current()`,
  `firstEditionGenreProfiles.register(ownerId, profile)`, and owner removal
- `combat.read(actor)`, `combat.declare(actor, declaration)`,
  `combat.completeNext(actor, expectedRevision)`, and
  `combat.reset(actor, expectedRevision)`
- `combat.commitFirstEdition(actor, commitment)` and
  `combat.spendFirstEdition(actor, expectedRevision)`
- `health.condition(actor, proposed, options)`,
  `health.wound(actor, proposed)`, and `health.posture(actor, proposed)`
- `magic.difficulty(design)`, `magic.cast(actor, manifestationId)`,
  `magic.resource(actor)`, and `magic.recover(actor, hours)`
- `combat.fullDefense(actor, expectedRevision)` and
  `combat.feint(actor, targetTokenId, expectedRevision)`
- `rules.current()` and `rules.applyPreset("second-edition" | "open-d6")`
- `read.actor(actor)`
- `roll.attribute(actor, attributeId)`, `roll.skill(actor, itemId)`, and
  `roll.item(actor, itemId, "attack" | "damage")`
- `roll.resistance(actor)`
- `roll.doubleDown(actor, failedResult, narration?)`
- `roll.reroll(actor, failedResult)`
- `terminology.register(ownerId, contribution)` and owner removal
- `themes.register(ownerId, definition)` and owner removal
- `templates.register(ownerId, catalog)` and owner removal
- `characterTemplates.preview(actor, templateId)` and
  `characterTemplates.apply(actor, templateId)`
- API-version guard

The following capabilities define the v1 boundary:

| Capability                              | Contract                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `campaign.profile`                      | Immutable versioned Second Edition campaign/module profile                                             |
| `registry.campaign-packages`            | Owner-scoped versioned genre/companion manifests and deterministic selection diagnostics               |
| `registry.content-packages`             | Multi-active official content-module manifests; activation never selects rules                         |
| `registry.first-edition-genre-profiles` | Owner-scoped First Edition Attributes, semantic roles, Skills, and creation budgets                    |
| `creation.template`                     | Preview and atomically apply a registered creation template                                            |
| `health.condition`                      | Authorized condition transitions and Stunned prevention                                                |
| `health.wound`                          | Authorized independent First Edition wound transitions                                                 |
| `magic.freeform`                        | Calculate Second Edition freeform designs and owner-cast versioned Second/First Edition Manifestations |
| `magic.points`                          | Read, spend, and recover the protected Magic Point pool                                                |
| `feature.read`                          | Revisioned Trouble/Asset session state                                                                 |
| `feature.command`                       | Authorized Trouble/Asset invocation and GM session reset                                               |
| `read.actor`                            | Immutable Actor read model with stable IDs and available actions                                       |
| `roll.check`                            | Typed check request to typed result through the system roll service                                    |
| `roll.attribute`                        | Convenience request by Actor and stable attribute ID                                                   |
| `roll.double-down`                      | Source-preserving Second Edition Doubling Down retry                                                   |
| `roll.item`                             | Weapon attack/damage request by Actor and embedded Item ID                                             |
| `roll.resistance`                       | Edition-aware Strength/Brawn-plus-equipped-armor resistance request                                    |
| `roll.reroll`                           | Source-preserving Second Edition failed-roll Hero Point reroll                                         |
| `roll.skill`                            | Convenience request by Actor and embedded skill ID                                                     |
| `registry.terminology`                  | Owner-scoped validated presentation contributions                                                      |
| `registry.theme`                        | Owner-scoped semantic theme and optional dice presentation                                             |
| `registry.templates`                    | Owner-scoped lawful character-template catalogs                                                        |
| `registry.discipline`                   | System-approved typed power discipline definitions                                                     |
| `combat.read`                           | Immutable current action/combat state                                                                  |
| `combat.command`                        | Authorized declarations and corrections through system services                                        |
| `rules.capabilities`                    | Versioned resolved cross-edition rules-family decisions                                                |
| `rules.profile`                         | Read current rules profile and apply a validated built-in preset                                       |
| `advancement.command`                   | Apply authoritative OpenD6 Attribute and embedded-Item advances                                        |

The API does not advertise capabilities that are not working.

The working capabilities are currently `foundation.identity`,
`advancement.command`, `campaign.profile`, `creation.template`, `health.condition`, `health.wound`,
`feature.read`, `feature.command`,
`rules.capabilities`, `rules.profile`, `read.actor`, `roll.check`,
`roll.attribute`, `roll.double-down`, `roll.item`, `roll.resistance`,
`roll.reroll`, `roll.skill`,
`registry.terminology`, `registry.theme`, `registry.templates`,
`registry.campaign-packages`, `registry.first-edition-genre-profiles`, `magic.freeform`,
`combat.read`, and `combat.command`.
The magic surface uses `magic.difficulty(design)` for the immutable printed
breakdown and `magic.cast(actor, manifestationId)` for the protected
embedded-Item roll.
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

## Campaign-package registry

Actual Foundry modules expose their genre or companion identity through the
versioned public registry:

```ts
game.system.api.campaignPackages.register("open-d6-space-d6-system-2e", {
  apiCompatibility: { minimum: 1, maximum: 1 },
  contractVersion: 1,
  genreId: "space",
  id: "open-d6-space-d6-system-2e",
  kind: "genre",
  label: "Open D6 Space",
  rulesFamily: "open-d6-first-edition",
  version: "0.1.0-alpha.1",
});
```

The manifest ID must equal the registering module ID. Registration makes a
package available but does not activate it. The GM's world selection is resolved
through `campaignPackages.resolve({ genreId, companionId })`; missing packages,
API mismatches, kind errors, incompatible companions, and declared conflicts are
returned as immutable diagnostics. Stored missing IDs are preserved so disabling
a module cannot silently replace the world's rules.

`campaignPackages.selection()` returns that same immutable resolution for the
system-owned current world selection. Companions use it to activate terminology,
branding, and other selected-only presentation without reading private setting
keys. Registration and theme availability remain independent of activation.

## Official content packages and rules selection

`game.system.api.contentPackages` is the version-1 owner-scoped registry for
official Second Edition content modules. A registration declares its family,
version, rules family, recommended primary profile, and stable mechanic IDs.
`current()` returns every active registration; it does not choose one winner,
apply a preset, or change presentation.

`game.system.api.rules.selection()` returns the explicit primary profile from
Game System Mode, the currently resolved profile, and active mechanic IDs owned
by the other edition. This preserves the distinction between a primary rules
baseline and explicitly imported compatible mechanics.

`terminology.register(ownerId, contribution)` accepts additive labels for
stable Attribute IDs, resources, character and system titles, currency and
allegiance details, vehicle/starship toughness, interstellar drive,
manifestations, Special Ability vocabulary, and Metaphysics vocabulary. The
system owns all data fields, validation, persistence, and rendering. A
contribution cannot add arbitrary Actor properties or controls. The GM's world
terminology overrides are applied after active owner contributions; they alter
presentation only and never change stable IDs or package ownership.

A selected First Edition genre may also register a profile whose ID, genre ID,
and owner ID match the module. Version 1 contributes ordered Attributes,
initiative/knowledge/Strength semantic roles, the genre Skill catalog, and its
canonical creation budgets. The system—not the module—uses those facts to
project sheets, seed Skills, validate templates and bestiary profiles, and route
shared First Edition Strength and initiative operations. If no selected package
has a profile, the existing six-Attribute Space-compatible baseline remains the
safe fallback.

## Campaign profile API

Second Edition configuration is resolved through:

```ts
const campaign = game.system.api.campaign.current();
```

`SecondEditionCampaignProfileV1` returns `profileVersion`, the stable
`core-default` or `custom` ID, ordered active Attribute IDs, known module IDs,
the explicit unnamed additional-Skill-module count, selected equipment era,
Pips-module activation, Advanced Skill/Specialization activation, and
character-creation Attribute/Skill budgets in canonical pips. Callers must
check `campaign.profile`; they must not read
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

Milestone awards, Perk exchange, Narrative approval, and reward completion
require GM authority. Owners may remove their own draft or completed arcs; only
a GM may remove an approved arc. Proposal and step tracking enforce Actor
ownership, the selected profile, target validity, and the printed workflow.
Narrative proposals accept `rewardKind` values `attribute`, `skill`, or `perk`.
For a new Perk, pass an empty `rewardId` and its name as `rewardName`; an
existing Perk uses its embedded Item ID. Perk proposals require the Perks,
Flaws & Talents module.

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
`D6RollResultV2`, or `null` after cancellation. The system re-derives the score
from the Actor and Item; callers cannot submit a trusted total.

The optional third argument of `roll.attribute` and `roll.skill` is reserved for
system-authorized workflow context. GM-requested rolls use it to identify the
requester, recipient, request ID, and locked Public, Player + GM, or GM-only
Blind audience. Thin integrations should initiate ordinary rolls without
manufacturing this context; request authorization and socket delivery remain
system-owned.

The current internal/public result contract uses version 2. The deprecated
`D6RollRequestV1` and `D6RollResultV1` source aliases resolve to these version-2
types so existing TypeScript imports remain additive, but persisted flags carry
`contractVersion: 2`.

```ts
interface D6RollRequestV2 {
  contractVersion: 2;
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
    combinedAction?: {
      groupId: string;
      stage: "command" | "task";
      participantCount: number;
      leaderActorId: string;
      primaryActorId: string;
      commandDifficulty: number;
      commandPenaltyScore: number;
      allocatedBonusScore: number;
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
  heroPointUse:
    | "none"
    | "double-die-code"
    | "reroll-failed"
    | "basic-bonus-dice"
    | "classic-bonus-wild-dice";
  heroPointSpend?: number;
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

`roll.reroll` requires the Heroic strategy, local ownership, an available Hero
Point, a failed result,
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
Heroic Second Edition Hero Point strategy. It spends one Hero Point and retains the
previous condition. It does not remove an existing Stunned condition.
Posture changes require the same Actor ownership boundary and return both the
previous and current posture.

## Roll result

A `D6RollResultV2` contains the normalized pool, base and Wild Die faces, total,
difficulty evaluation, authoritative success, Wild Die outcome/choice, arbitrary
Hero Point spend/award counts, exact Wild Die policy, profile ID, and source
request. Its pool distinguishes ordinary bonus dice and bonus Wild Dice;
`wildFaceGroups` preserves every independently exploding Classic Wild Die. Chat
stores this object under the system's
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
creation-budget value, typed fields, catalog/owner/definition provenance,
immutable semantic mechanic snapshots, and session uses. The `feature.read` and
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
definitions contain semantic sheet/chat tokens, an optional Dice So Nice
appearance contract, and an optional `pauseIcon`. A pause asset must be a safe
PNG, SVG, WebP, or AVIF path under the base system or the registering module's
own directory. Registration alone does not select a player or Actor theme.

The optional dice contract defines the selected theme's ordinary-die body,
edge, face, visible colorset ID, display name, Dice So Nice system ID, and an
optional six-label Wild Die face set. Owner-scoped PNG/WebP/AVIF face artwork
uses a theme-specific dice-system ID so Dice So Nice can keep that geometry
separate from other themes. The system retains the `dw` Wild Die mechanics and
allows a theme to provide a darker bronze Wild Die palette and replacement face
artwork.

Licensed content modules register equipment catalogs through
`game.system.api.equipment.register(ownerId, definition)`. Each catalog has a
stable ID, label, positive version, and entries with a stable ID, exactly one
`medieval`, `modern`, or `science-fiction` era, one `gear`, `weapon`, or `armor`
kind, display name, positive source citation, and inert system document data.
The registry clones and freezes contributions, rejects duplicate entries and
cross-owner catalog-ID collisions, and supports `unregisterOwner(ownerId)`.
`current()` returns immutable catalogs with their owner provenance. Capability
discovery exposes this working surface as `registry.equipment`. The system's
base catalog contains the concise, mechanically distributable D62e pp. 79–85
equipment records. It does not expose source prose, examples, layout, or art as
an API payload.

Lawful content modules register Perk, Flaw, and Talent catalogs through
`game.system.api.featureCatalogRegistry.register(ownerId, catalog)`. Contract
version 1 validates stable catalog and definition IDs, feature kind, rank bounds,
focus requirements, repeatability, positive source pages, Talent creation cost,
and a closed set of inert semantic mechanic records. Cross-catalog definition
collisions fail instead of following load order. `featureCatalogs.preview()`
reports module, authority, duplicate, focus, and rank issues;
`featureCatalogs.apply()` is the authoritative embedded-Item transaction and
stores a durable provenance/mechanics snapshot. The base catalog is deliberately
empty and capability discovery exposes `registry.features`.

Lawfully licensed modules register template catalogs through
`game.system.api.templates.register(ownerId, catalog)`. Catalog and template IDs
are stable lowercase slugs. Every version-2 template declares either
`d6-system-second-edition` or `open-d6-first-edition`, supplies exact canonical
pip scores for every active Attribute, source book/page provenance, and zero or
more suggested stable Skill keys. Optional additions are limited to Armor,
Gear, and Weapon sources. A First Edition template may also supply bounded
starting biography, Character Points, Fate Points, and Move values. A bounded
optional `superheroic` record belongs only to Second Edition and supplies the
literal 10D starting budget plus stable feature-definition IDs, ranks, and
optional focus values; the referenced definitions must be contributed lawful
Superpower Talents through `featureCatalogRegistry`. The registry clones/freezes input and rejects invalid
versions, duplicate IDs, unsupported Item types, bad citations, and ownership
conflicts. The base catalog supplies the four concise Fantasy templates from
D62e pp. 168–171; it contains mechanical facts and provenance but no source
prose, examples, layout, or art.

`game.system.api.characterTemplates.preview(actor, templateId)` returns exact
Attribute replacements, suggested Skill names, equipment additions,
Superpower additions/costs, edition compatibility, and typed blocking issues.
`apply` revalidates the same preview, requires a creation-active
Character owned by the caller or a GM, serializes concurrent attempts, creates
equipment and Superpower Talents in one batch, and records schema-25/schema-39
provenance only after the Actor update succeeds. If that final write fails,
every Item created by the attempt is
deleted before the error is returned. Templates cannot allocate Skill dice or
write health, advancement, Conditions, or arbitrary Actor fields. Second
Edition templates cannot write resources; the bounded First Edition startup
record may write only its declared Character Points, Fate Points, Move, and
biography. Character Template compendium Items route through this same preview
and transaction when dropped on a Character sheet.

Authorized content modules register Creature profiles through
`game.system.api.bestiaryRegistry.register(ownerId, catalog)`. Version-1 entries
contain stable IDs, canonical Attribute scores (maximum 20D), nonnegative
static Dodge/Parry overrides, scale 0–6, optional Magic Points, biography and
image, supported embedded Item sources, and a positive source citation. The
registry clones and freezes input and rejects malformed IDs, duplicate entries,
cross-owner collisions, unsupported Item families, and out-of-range facts. The
system-owned base registry supplies the four concise Fantasy Creature profiles
from D62e pp. 165–167; it contains mechanical facts and provenance but no
source prose, examples, page design, or art.

`game.system.api.bestiary.preview(entryId)` reports exact facts and typed
blocking issues for GM role, active Attributes, native Second Edition, and the
Magic Points dependency. `create(entryId)` revalidates and serializes the
request, then creates one complete Creature Actor with active Skill catalog
Items, contributed Items, static defenses, resources, scale, and schema-28
provenance in one Foundry document transaction. The command is GM-only.
Capability discovery exposes `registry.bestiary`.

### Psionics API and power catalogs

`game.system.api.psionics.read(actor)` returns the three discipline states and
all currently registered powers with availability, combined pool, and recent
attempt count. `train(actor, discipline, method)` is an owner-authorized command
that records `self-study` or `teacher` and grants only an untrained discipline's
first 1D. `roll(actor, powerId, { difficultyModifier })` requires every named
discipline, adds their complete standalone pools, records the attempt after the
roll resolves, and emits structured difficulty/source audit data.

Authorized modules call
`game.system.api.psionicPowerRegistry.register(ownerId, catalog)`. Contract
version 1 accepts stable catalog/power IDs, a display label, one or two unique
`kinesis`, `perceive`, or `reform` IDs, nonnegative base/scaling difficulty, and
positive source book/page provenance. Definitions are cloned, frozen, and
collision-checked across owners. `unregisterOwner` removes only that owner's
catalog. Capability discovery exposes `registry.discipline`; the base catalog
is intentionally empty of protected named powers and prose.

## Errors and authority

The API rejects unsupported versions, unavailable capabilities, invalid IDs,
unauthorized actors, stale revisions, and duplicate request IDs with typed error
codes. External integrations never write system flags or Actor resources directly.
