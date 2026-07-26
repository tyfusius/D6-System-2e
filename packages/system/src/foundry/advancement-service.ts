import type {
  AdvancementCostMultipliers,
  AdvancementKind,
} from "@d6-system-2e/core";
import { planOpenD6Advancement } from "../application/advancement/plan-open-d6-advancement";
import { currentRulesProfile } from "../settings/rules-compatibility";
import { numberSetting } from "../settings/setting-values";
import { FIRST_EDITION_OPTION_KEYS } from "../settings/settings-catalog";
import { withAuthorizedAdvancementUpdate } from "./mechanical-edit-guard";
import { integer, record } from "./sheets/values";

export interface AdvancementResult {
  readonly cost: number;
  readonly kind: AdvancementKind;
  readonly remainingCharacterPoints: number;
  readonly score: number;
}

function actorDocument(value: object): FoundryActorDocument {
  const actor = value as Partial<FoundryActorDocument>;
  if (
    typeof actor.id !== "string" ||
    typeof actor.name !== "string" ||
    typeof actor.system !== "object"
  ) {
    throw new TypeError(
      "The public advancement API requires a Foundry Actor document.",
    );
  }
  return actor as FoundryActorDocument;
}

export function currentAdvancementMultipliers(): AdvancementCostMultipliers {
  return Object.freeze({
    attribute: numberSetting(
      FIRST_EDITION_OPTION_KEYS.advanceCostAttribute,
      10,
    ),
    skill: numberSetting(FIRST_EDITION_OPTION_KEYS.advanceCostSkill, 1),
    specialization: numberSetting(
      FIRST_EDITION_OPTION_KEYS.advanceCostSpecialization,
      0.5,
    ),
  });
}

function requireAuthorizedAdvance(actor: FoundryActorDocument): void {
  if (!currentRulesProfile().compatibility.firstEditionAdvancement) {
    throw new Error("D6E2.Advancement.FirstEditionRequired");
  }
  if (game.user?.isGM !== true && actor.isOwner !== true) {
    throw new Error("D6E2.Advancement.OwnerRequired");
  }
  if (
    game.user?.isGM !== true &&
    record(actor.system.sheetMode).value !== "advance"
  ) {
    throw new Error("D6E2.Advancement.AdvanceModeRequired");
  }
}

function characterPoints(actor: FoundryActorDocument): number {
  return integer(record(record(actor.system.resources).characterPoints).value);
}

export function attributeAdvancementPlan(
  actor: FoundryActorDocument,
  attributeId: string,
) {
  const score = integer(
    record(record(actor.system.attributes)[attributeId]).score,
  );
  return planOpenD6Advancement(
    "attribute",
    score,
    characterPoints(actor),
    currentAdvancementMultipliers(),
  );
}

export function itemAdvancementPlan(
  actor: FoundryActorDocument,
  item: FoundryItemDocument,
) {
  const kind: AdvancementKind =
    item.type === "specialization" ? "specialization" : "skill";
  const bonus = integer(item.system.score);
  const attributeId =
    typeof item.system.attributeId === "string" ? item.system.attributeId : "";
  const parentSkill =
    kind === "specialization"
      ? actor.items.get(
          typeof item.system.parentSkillId === "string"
            ? item.system.parentSkillId
            : "",
        )
      : undefined;
  const governingAttributeId =
    parentSkill && typeof parentSkill.system.attributeId === "string"
      ? parentSkill.system.attributeId
      : attributeId;
  const attributeScore = integer(
    record(record(actor.system.attributes)[governingAttributeId]).score,
  );
  const score =
    attributeScore +
    (kind === "specialization"
      ? integer(parentSkill?.system.score) + bonus
      : bonus);
  return planOpenD6Advancement(
    kind,
    score,
    characterPoints(actor),
    currentAdvancementMultipliers(),
    item.system.advanced === true,
  );
}

export async function advanceAttribute(
  actorValue: object,
  attributeId: string,
): Promise<AdvancementResult> {
  const actor = actorDocument(actorValue);
  requireAuthorizedAdvance(actor);
  const plan = attributeAdvancementPlan(actor, attributeId);
  if (!plan.affordable) throw new Error("D6E2.Advancement.InsufficientPoints");
  if (plan.nextScore > 15) throw new Error("D6E2.Advancement.MaximumReached");
  await withAuthorizedAdvancementUpdate(actor, () =>
    actor.update({
      [`system.attributes.${attributeId}.score`]: plan.nextScore,
      "system.resources.characterPoints.value": plan.nextCharacterPoints,
    }),
  );
  return Object.freeze({
    cost: plan.cost,
    kind: "attribute",
    remainingCharacterPoints: plan.nextCharacterPoints,
    score: plan.nextScore,
  });
}

export async function advanceItem(
  actorValue: object,
  itemId: string,
): Promise<AdvancementResult> {
  const actor = actorDocument(actorValue);
  requireAuthorizedAdvance(actor);
  const item = actor.items.get(itemId);
  if (!item || !["skill", "specialization"].includes(item.type)) {
    throw new Error("D6E2.Advancement.ItemRequired");
  }
  const plan = itemAdvancementPlan(actor, item);
  if (!plan.affordable) throw new Error("D6E2.Advancement.InsufficientPoints");
  const currentBonus = integer(item.system.score);
  await withAuthorizedAdvancementUpdate(actor, () =>
    actor.update({
      "system.resources.characterPoints.value": plan.nextCharacterPoints,
    }),
  );
  try {
    await withAuthorizedAdvancementUpdate(item, () =>
      item.update({ "system.score": currentBonus + 1 }),
    );
  } catch (error) {
    await withAuthorizedAdvancementUpdate(actor, () =>
      actor.update({
        "system.resources.characterPoints.value": plan.currentCharacterPoints,
      }),
    );
    throw error;
  }
  return Object.freeze({
    cost: plan.cost,
    kind: item.type === "specialization" ? "specialization" : "skill",
    remainingCharacterPoints: plan.nextCharacterPoints,
    score: plan.nextScore,
  });
}
