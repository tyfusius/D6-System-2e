import {
  addPipScores,
  D6_ACTOR_READ_MODEL_VERSION,
  dieCodeFromPipScore,
  type D6ActorReadModelV1,
} from "@d6-system-2e/core";
import { currentTerminology } from "../../registries/terminology";
import { currentRulesProfile } from "../../settings/rules-compatibility";
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
  const terminology = currentTerminology();
  const attributesSource = record(actor.system.attributes);
  const attributes = activeAttributeDefinitions(
    profile.compatibility.firstEditionAttributes,
  ).map(({ id, label }) => {
    const score = integer(record(attributesSource[id]).score);
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
    .filter((item) => item.type === "skill")
    .map((item) => {
      const attributeId =
        typeof item.system.attributeId === "string"
          ? item.system.attributeId
          : "";
      const bonusScore = integer(item.system.score);
      const score = addPipScores(
        attributeScores.get(attributeId) ?? 0,
        bonusScore,
      );
      return Object.freeze({
        attributeId,
        bonusScore,
        code: dieCodeFromPipScore(score),
        id: item.id,
        label: item.name,
        rollable: score >= 3 && attributeScores.has(attributeId),
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
      fatePoints: integer(record(resources.fatePoints).value),
      heroPoints: integer(record(resources.heroPoints).value),
    }),
    rulesProfileId: profile.id,
    skills: Object.freeze(skills),
    type: actor.type,
  });
}
