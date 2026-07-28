import {
  D6_ACTOR_READ_MODEL_VERSION,
  dieCodeFromPipScore,
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
  const attributes = activeAttributeDefinitions(
    profile.compatibility.firstEditionAttributes,
    campaignOptionalAttributeIds(),
  ).map(({ id, label }) => {
    const score = currentEffectivePipScore(
      integer(record(attributesSource[id]).score),
    );
    return Object.freeze({
      code: dieCodeFromPipScore(score),
      id,
      label: terminology.attributes[id] ?? game.i18n.localize(label),
      rollable: score >= 3,
      score,
    });
  });
  const attributeScores = new Map(
    attributes.map((attribute) => [attribute.id, attribute.score]),
  );
  const skills = actor.items.contents
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

  return Object.freeze({
    attributes: Object.freeze(attributes),
    contractVersion: D6_ACTOR_READ_MODEL_VERSION,
    id: actor.id,
    image: actor.img,
    name: actor.name,
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
