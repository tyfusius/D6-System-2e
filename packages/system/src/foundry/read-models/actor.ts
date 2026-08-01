import {
  D6_FEATURE_SESSION_MAX_USES,
  D6_ACTOR_READ_MODEL_VERSION,
  dieCodeFromPipScore,
  firstEditionBodyPointWound,
  isFirstEditionWoundLevel,
  isSecondEditionCondition,
  secondEditionStaticDefense,
  type D6ActorReadModelV1,
  type D6FeatureMechanicV1,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../../constants";
import { currentTerminology } from "../../registries/terminology";
import { currentRulesProfile } from "../../settings/rules-compatibility";
import { campaignOptionalAttributeIds } from "../../settings/campaign-profile";
import { currentEditionCapabilityProfile } from "../../settings/edition-capabilities";
import { currentFirstEditionDamageMode } from "../../settings/setting-values";
import { booleanSetting } from "../../settings/setting-values";
import { readActorFirstEditionBodyPoints } from "../first-edition-body-point-service";
import { readFirstEditionAccumulatingStuns } from "../first-edition-accumulating-stun-service";
import { FIRST_EDITION_OPTION_KEYS } from "../../settings/settings-catalog";
import { emptyFirstEditionAccumulatingStuns } from "@d6-system-2e/core";
import {
  currentCombinedPipScore,
  currentEffectivePipScore,
} from "../../settings/pip-rules";
import { activeAttributeDefinitions, integer, record } from "../sheets/values";

function actorDocument(value: object): FoundryActorDocument {
  const actor = value as Partial<FoundryActorDocument>;
  if (
    typeof actor.id !== "string" ||
    typeof actor.name !== "string" ||
    typeof actor.system !== "object"
  ) {
    throw new TypeError("The read API requires a Foundry Actor document.");
  }
  return actor as FoundryActorDocument;
}

export function actorReadModel(actorValue: object): D6ActorReadModelV1 {
  const actor = actorDocument(actorValue);
  const profile = currentRulesProfile();
  const editionCapabilities = currentEditionCapabilityProfile();
  const terminology = currentTerminology();
  const attributesSource = record(actor.system.attributes);
  const machine = ["starship", "vehicle"].includes(actor.type);
  const attributeDefinitions = machine
    ? (actor.type === "starship"
        ? ["navicomp", "maneuverability", "engines", "hull"]
        : ["maneuverability", "hull"]
      ).map((id) => ({
        id,
        label: `D6E2.Machine.${id[0]?.toUpperCase() ?? ""}${id.slice(1)}`,
      }))
    : activeAttributeDefinitions(
        profile.compatibility.firstEditionAttributes,
        campaignOptionalAttributeIds(),
      );
  const attributes = attributeDefinitions.map(({ id, label }) => {
    const score = currentEffectivePipScore(
      integer(record(attributesSource[id]).score),
    );
    return Object.freeze({
      code: dieCodeFromPipScore(score),
      id,
      label:
        (machine ? undefined : terminology.attributes[id]) ??
        game.i18n.localize(label),
      rollable: score >= 3,
      score,
    });
  });
  const attributeScores = new Map(
    attributes.map((attribute) => [attribute.id, attribute.score]),
  );
  const skills = (machine ? [] : actor.items.contents)
    .filter((item) => ["skill", "specialization"].includes(item.type))
    .map((item) => {
      const kind =
        item.type === "specialization"
          ? ("specialization" as const)
          : item.system.training === "advanced"
            ? ("advanced" as const)
            : ("standard" as const);
      const attributeId =
        typeof item.system.attributeId === "string"
          ? item.system.attributeId
          : "";
      const bonusScore = currentEffectivePipScore(integer(item.system.score));
      const parentSkillId =
        typeof item.system.parentSkillId === "string"
          ? item.system.parentSkillId
          : undefined;
      const parent =
        kind === "specialization"
          ? (actor.items.get(parentSkillId ?? "") ??
            actor.items.contents.find(
              (candidate) =>
                candidate.type === "skill" &&
                candidate.system.key === item.system.parentSkillKey,
            ))
          : undefined;
      const parentAttributeId =
        typeof parent?.system.attributeId === "string"
          ? parent.system.attributeId
          : attributeId;
      const parentScore =
        parent?.system.training === "advanced" &&
        editionCapabilities.advancedSkills.state === "active"
          ? currentEffectivePipScore(integer(parent.system.score))
          : currentCombinedPipScore(
              attributeScores.get(parentAttributeId) ?? 0,
              integer(parent?.system.score),
            );
      const score =
        kind === "advanced"
          ? bonusScore
          : kind === "specialization"
            ? currentCombinedPipScore(parentScore, bonusScore)
            : currentCombinedPipScore(
                attributeScores.get(attributeId) ?? 0,
                bonusScore,
              );
      return Object.freeze({
        attributeId,
        bonusScore,
        code: dieCodeFromPipScore(score),
        id: item.id,
        kind,
        label: item.name,
        ...(parentSkillId ? { parentSkillId } : {}),
        rollable:
          score >= 3 &&
          (kind === "advanced"
            ? editionCapabilities.advancedSkills.state === "active"
            : kind === "specialization"
              ? parent !== undefined
              : attributeScores.has(attributeId)),
        score,
      });
    });
  const resources = record(actor.system.resources);
  const hullScore = attributeScores.get("hull") ?? 0;
  const protectionScore = machine
    ? currentEffectivePipScore(
        integer(
          record(actor.system[actor.type === "starship" ? "shields" : "armor"])
            .score,
        ),
      )
    : 0;
  const health = record(actor.system.health);
  const condition = isSecondEditionCondition(health.condition)
    ? health.condition
    : "healthy";
  const firstEditionMode = currentFirstEditionDamageMode();
  const bodyPoints = machine
    ? Object.freeze({ current: 0, maximum: 0 })
    : readActorFirstEditionBodyPoints(actor);
  const storedFirstEditionWound = isFirstEditionWoundLevel(
    health.firstEditionWound,
  )
    ? health.firstEditionWound
    : "healthy";
  const firstEditionWound =
    firstEditionMode === "wounds"
      ? storedFirstEditionWound
      : firstEditionBodyPointWound(bodyPoints.current, bodyPoints.maximum);
  const firstEditionStuns = machine
    ? emptyFirstEditionAccumulatingStuns()
    : readFirstEditionAccumulatingStuns(actor);
  const machineCrewMembers = Array.isArray(record(actor.system.crew).members)
    ? (record(actor.system.crew).members as readonly unknown[])
    : [];
  const assignedMachineCrew = machineCrewMembers.filter((value) => {
    const actorId =
      typeof record(value).actorId === "string"
        ? String(record(value).actorId)
        : "";
    return actorId.length > 0 && game.actors?.get(actorId) !== undefined;
  }).length;
  const getFlag = (
    actor as unknown as {
      getFlag?: (namespace: string, key: string) => unknown;
    }
  ).getFlag;
  const featureSession = record(
    typeof getFlag === "function"
      ? getFlag.call(actor, SYSTEM_ID, "featureSession")
      : undefined,
  );
  const featureUses = record(featureSession.uses);
  const features = (machine ? [] : actor.items.contents)
    .filter((item) =>
      ["asset", "flaw", "perk", "talent", "trouble"].includes(item.type),
    )
    .map((item) => {
      const ranked = ["flaw", "perk", "talent"].includes(item.type);
      const narrative = ["asset", "trouble"].includes(item.type);
      const rank = ranked ? Math.max(1, integer(item.system.rank)) : 0;
      const cost = item.type === "talent" ? integer(item.system.cost) : 0;
      const creationSkillCostScore =
        item.type === "perk"
          ? rank * 3
          : item.type === "flaw"
            ? rank * -3
            : item.type === "talent"
              ? cost * 3
              : 0;
      const capabilityState = ranked
        ? editionCapabilities.rankedFeatures.state
        : editionCapabilities.narrativeFeatures.state;
      const itemWithFlags = item as FoundryItemDocument & {
        getFlag?(namespace: string, key: string): unknown;
      };
      const definition = record(
        typeof itemWithFlags.getFlag === "function"
          ? itemWithFlags.getFlag(SYSTEM_ID, "featureDefinition")
          : undefined,
      );
      const mechanics: readonly D6FeatureMechanicV1[] = Array.isArray(
        definition.mechanics,
      )
        ? definition.mechanics.flatMap((mechanic) => {
            const value = record(mechanic);
            return typeof value.kind === "string"
              ? [Object.freeze({ ...value }) as unknown as D6FeatureMechanicV1]
              : [];
          })
        : [];
      return Object.freeze({
        catalogId:
          typeof definition.catalogId === "string" ? definition.catalogId : "",
        capabilityState,
        cost,
        creationSkillCostScore,
        focus: typeof item.system.focus === "string" ? item.system.focus : "",
        id: item.id,
        image: item.img,
        definitionId:
          typeof definition.definitionId === "string"
            ? definition.definitionId
            : "",
        mechanics: Object.freeze(mechanics),
        name: item.name,
        ownerId:
          typeof definition.ownerId === "string" ? definition.ownerId : "",
        rank,
        repeatable: item.system.repeatable === true,
        sessionMaximum:
          narrative && capabilityState === "active"
            ? D6_FEATURE_SESSION_MAX_USES
            : 0,
        sessionUses: narrative ? integer(featureUses[item.id]) : 0,
        trigger:
          typeof item.system.trigger === "string" ? item.system.trigger : "",
        type: item.type as "asset" | "flaw" | "perk" | "talent" | "trouble",
      });
    });
  const weaponType = machine
    ? actor.type === "starship"
      ? "starship-weapon"
      : "vehicle-weapon"
    : "weapon";
  const items = actor.items.contents
    .filter((item) => item.type === weaponType)
    .map((item) =>
      Object.freeze({
        damageCode: dieCodeFromPipScore(
          currentEffectivePipScore(integer(item.system.damage)),
        ),
        equipped: item.system.equipped === true,
        id: item.id,
        image: item.img,
        modes: Object.freeze(["attack", "damage"] as const),
        name: item.name,
        type: item.type as "starship-weapon" | "vehicle-weapon" | "weapon",
      }),
    );

  return Object.freeze({
    attributes: Object.freeze(attributes),
    contractVersion: D6_ACTOR_READ_MODEL_VERSION,
    features: Object.freeze(features),
    id: actor.id,
    image: actor.img,
    health: Object.freeze({
      bodyPoints,
      condition,
      firstEditionMode,
      firstEditionStuns,
      firstEditionStunsActive:
        !machine &&
        profile.compatibility.firstEditionDamage &&
        booleanSetting(FIRST_EDITION_OPTION_KEYS.trackStuns, false),
      firstEditionWound,
    }),
    items: Object.freeze(items),
    name: actor.name,
    ...(machine
      ? {
          machine: Object.freeze({
            capacity: Object.freeze({
              kind:
                actor.type === "starship"
                  ? ("minimum-crew" as const)
                  : ("passengers" as const),
              value:
                actor.type === "starship"
                  ? integer(record(actor.system.crew).minimum)
                  : integer(actor.system.passengers),
            }),
            condition,
            crew: Object.freeze({
              assigned: assignedMachineCrew,
              missing:
                actor.type === "starship"
                  ? Math.max(
                      0,
                      integer(record(actor.system.crew).minimum) -
                        assignedMachineCrew,
                    )
                  : 0,
            }),
            defense: secondEditionStaticDefense(hullScore),
            kind: actor.type as "starship" | "vehicle",
            protectionScore,
            resistanceScore: currentCombinedPipScore(
              hullScore,
              protectionScore,
            ),
          }),
        }
      : {}),
    permissions: Object.freeze({
      canEdit: actor.isOwner === true,
      isOwner: actor.isOwner === true,
    }),
    resources: Object.freeze({
      characterPoints: integer(record(resources.characterPoints).value),
      experiencePoints: integer(record(resources.experiencePoints).value),
      fatePoints: integer(record(resources.fatePoints).value),
      heroPoints: integer(record(resources.heroPoints).value),
      magicPoints: integer(record(resources.magicPoints).value),
    }),
    rulesProfileId: profile.id,
    skills: Object.freeze(skills),
    type: actor.type,
  });
}
