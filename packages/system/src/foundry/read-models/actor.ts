import {
  D6_ACTOR_READ_MODEL_VERSION,
  dieCodeFromPipScore,
  isSecondEditionCondition,
  secondEditionStaticDefense,
  type D6ActorReadModelV1,
} from "@d6-system-2e/core";
import { currentTerminology } from "../../registries/terminology";
import { currentRulesProfile } from "../../settings/rules-compatibility";
import { campaignOptionalAttributeIds } from "../../settings/campaign-profile";
import { currentEditionCapabilityProfile } from "../../settings/edition-capabilities";
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

  return Object.freeze({
    attributes: Object.freeze(attributes),
    contractVersion: D6_ACTOR_READ_MODEL_VERSION,
    id: actor.id,
    image: actor.img,
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
    }),
    rulesProfileId: profile.id,
    skills: Object.freeze(skills),
    type: actor.type,
  });
}
