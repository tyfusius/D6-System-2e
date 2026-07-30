import {
  secondEditionMilestoneSpend,
  type AdvancementCostMultipliers,
  type AdvancementKind,
  type D6AdvancementResultV1,
} from "@d6-system-2e/core";
import { planOpenD6Advancement } from "../application/advancement/plan-open-d6-advancement";
import {
  planSecondEditionExperienceAdvancement,
  planSecondEditionSpecializationAcquisition,
} from "../application/advancement/plan-second-edition-experience-advancement";
import { numberSetting } from "../settings/setting-values";
import { FIRST_EDITION_OPTION_KEYS } from "../settings/settings-catalog";
import { currentEditionCapabilityProfile } from "../settings/edition-capabilities";
import { currentSecondEditionCampaignProfile } from "../settings/campaign-profile";
import {
  currentCombinedPipScore,
  currentEffectivePipScore,
  currentPipsEnabled,
} from "../settings/pip-rules";
import { withAuthorizedAdvancementUpdate } from "./mechanical-edit-guard";
import {
  advancedSkillIssues,
  normalizedSkillName,
  specializationKey,
} from "./skill-module";
import { integer, record, stringValue } from "./sheets/values";
import { readMilestoneBalance } from "./second-edition-advancement-service";

export interface AdvancementPlan {
  readonly active: boolean;
  readonly affordable: boolean;
  readonly blockedReason?: "advanced-skill-prerequisite";
  readonly cost: number;
  readonly currentResource: number;
  readonly currentScore: number;
  readonly kind: AdvancementKind;
  readonly nextResource: number;
  readonly nextScore: number;
  readonly nextStoredScore: number;
  readonly resource:
    | "character-points"
    | "experience-points"
    | "milestone-attribute-dice"
    | "milestone-skill-pips";
  readonly strategy:
    | "open-d6-character-points"
    | "second-edition-experience-points"
    | "second-edition-milestone"
    | "unavailable";
}

export interface SpecializationAcquisitionPlan {
  readonly active: boolean;
  readonly affordable: boolean;
  readonly atLimit: boolean;
  readonly blockedReason?:
    "module-required" | "profile-required" | "skill-required";
  readonly cost: number;
  readonly currentExperiencePoints: number;
  readonly currentSpecializations: number;
  readonly maximumSpecializations: number;
  readonly nextExperiencePoints: number;
  readonly skillRating: number;
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

function resource(actor: FoundryActorDocument, key: string): number {
  return integer(record(record(actor.system.resources)[key]).value);
}

function unavailablePlan(
  kind: AdvancementKind,
  score: number,
): AdvancementPlan {
  return Object.freeze({
    active: false,
    affordable: false,
    cost: 0,
    currentResource: 0,
    currentScore: score,
    kind,
    nextResource: 0,
    nextScore: score,
    nextStoredScore: score,
    resource: "experience-points",
    strategy: "unavailable",
  });
}

function openD6Plan(
  kind: AdvancementKind,
  score: number,
  storedScore: number,
  actor: FoundryActorDocument,
  advanced = false,
): AdvancementPlan {
  const plan = planOpenD6Advancement(
    kind,
    score,
    resource(actor, "characterPoints"),
    currentAdvancementMultipliers(),
    advanced,
  );
  return Object.freeze({
    active: true,
    affordable: plan.affordable,
    cost: plan.cost,
    currentResource: plan.currentCharacterPoints,
    currentScore: plan.currentScore,
    kind,
    nextResource: plan.nextCharacterPoints,
    nextScore: plan.nextScore,
    nextStoredScore: storedScore + 1,
    resource: "character-points",
    strategy: "open-d6-character-points",
  });
}

function experiencePlan(
  kind: "attribute" | "skill",
  score: number,
  storedScore: number,
  actor: FoundryActorDocument,
  advanced = false,
): AdvancementPlan {
  const plan = planSecondEditionExperienceAdvancement(
    kind,
    score,
    resource(actor, "experiencePoints"),
    currentPipsEnabled(),
    advanced,
  );
  const nextStoredScore = currentPipsEnabled()
    ? storedScore + plan.scoreIncrease
    : currentEffectivePipScore(storedScore) + plan.scoreIncrease;
  return Object.freeze({
    active: true,
    affordable: plan.affordable,
    cost: plan.cost,
    currentResource: plan.currentExperiencePoints,
    currentScore: plan.currentScore,
    kind,
    nextResource: plan.nextExperiencePoints,
    nextScore: plan.nextScore,
    nextStoredScore,
    resource: "experience-points",
    strategy: "second-edition-experience-points",
  });
}

function milestonePlan(
  kind: "attribute" | "skill",
  score: number,
  storedScore: number,
  actor: FoundryActorDocument,
): AdvancementPlan {
  const balance = readMilestoneBalance(actor);
  const plan = secondEditionMilestoneSpend(kind, balance, currentPipsEnabled());
  const currentResource =
    kind === "attribute" ? balance.attributeDice : balance.skillPips;
  const nextResource =
    kind === "attribute"
      ? plan.nextBalance.attributeDice
      : plan.nextBalance.skillPips;
  return Object.freeze({
    active: true,
    affordable: plan.affordable,
    cost: plan.cost,
    currentResource,
    currentScore: score,
    kind,
    nextResource,
    nextScore: score + plan.scoreIncrease,
    nextStoredScore: storedScore + plan.scoreIncrease,
    resource:
      kind === "attribute"
        ? "milestone-attribute-dice"
        : "milestone-skill-pips",
    strategy: "second-edition-milestone",
  });
}

function advancedSkillPrerequisitesPermit(
  actor: FoundryActorDocument,
  item: FoundryItemDocument,
  nextScore: number,
): boolean {
  if (item.system.training !== "advanced") return true;
  return advancedSkillIssues(actor, item, nextScore).length === 0;
}

function requireAuthorizedAdvance(actor: FoundryActorDocument): void {
  const strategy = currentEditionCapabilityProfile().advancement.strategy;
  if (
    strategy !== "character-point-advancement" &&
    strategy !== "second-edition-experience-points" &&
    strategy !== "second-edition-milestone"
  ) {
    throw new Error("D6E2.Advancement.ProfileRequired");
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

export function attributeAdvancementPlan(
  actor: FoundryActorDocument,
  attributeId: string,
): AdvancementPlan {
  const storedScore = integer(
    record(record(actor.system.attributes)[attributeId]).score,
  );
  const strategy = currentEditionCapabilityProfile().advancement.strategy;
  if (strategy === "character-point-advancement") {
    return openD6Plan("attribute", storedScore, storedScore, actor);
  }
  if (strategy === "second-edition-experience-points") {
    return experiencePlan(
      "attribute",
      currentEffectivePipScore(storedScore),
      storedScore,
      actor,
    );
  }
  if (strategy === "second-edition-milestone") {
    return milestonePlan(
      "attribute",
      currentEffectivePipScore(storedScore),
      storedScore,
      actor,
    );
  }
  return unavailablePlan("attribute", storedScore);
}

export function itemAdvancementPlan(
  actor: FoundryActorDocument,
  item: FoundryItemDocument,
): AdvancementPlan {
  const kind: AdvancementKind =
    item.type === "specialization" ? "specialization" : "skill";
  const storedScore = integer(item.system.score);
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
  const advanced = item.system.training === "advanced";
  const score = advanced
    ? currentEffectivePipScore(storedScore)
    : kind === "specialization"
      ? currentCombinedPipScore(
          attributeScore,
          integer(parentSkill?.system.score),
          storedScore,
        )
      : currentCombinedPipScore(attributeScore, storedScore);
  const strategy = currentEditionCapabilityProfile().advancement.strategy;
  if (strategy === "character-point-advancement") {
    return openD6Plan(kind, score, storedScore, actor, advanced);
  }
  if (strategy === "second-edition-experience-points" && kind === "skill") {
    const plan = experiencePlan("skill", score, storedScore, actor, advanced);
    if (
      advanced &&
      !advancedSkillPrerequisitesPermit(actor, item, plan.nextScore)
    ) {
      return Object.freeze({
        ...plan,
        affordable: false,
        blockedReason: "advanced-skill-prerequisite" as const,
      });
    }
    return plan;
  }
  if (strategy === "second-edition-milestone" && kind === "skill") {
    const plan = milestonePlan("skill", score, storedScore, actor);
    if (
      advanced &&
      !advancedSkillPrerequisitesPermit(actor, item, plan.nextScore)
    ) {
      return Object.freeze({
        ...plan,
        affordable: false,
        blockedReason: "advanced-skill-prerequisite" as const,
      });
    }
    return plan;
  }
  return unavailablePlan(kind, score);
}

function linkedSpecializations(
  actor: FoundryActorDocument,
  parent: FoundryItemDocument,
): readonly FoundryItemDocument[] {
  const parentKey = stringValue(parent.system.key);
  return actor.items.contents.filter((candidate) => {
    if (candidate.type !== "specialization") return false;
    const linkedId = stringValue(candidate.system.parentSkillId);
    if (linkedId.length > 0) return linkedId === parent.id;
    return (
      parentKey.length > 0 &&
      stringValue(candidate.system.parentSkillKey) === parentKey
    );
  });
}

export function specializationAcquisitionPlan(
  actor: FoundryActorDocument,
  parent: FoundryItemDocument,
): SpecializationAcquisitionPlan {
  const profileSupportsSpecializations =
    currentSecondEditionCampaignProfile().skillSpecializationAdvancedSkills;
  const experienceStrategy =
    currentEditionCapabilityProfile().advancement.strategy ===
    "second-edition-experience-points";
  const validSkill =
    parent.type === "skill" && parent.system.training !== "advanced";
  const plan = planSecondEditionSpecializationAcquisition(
    currentEffectivePipScore(integer(parent.system.score)),
    validSkill ? linkedSpecializations(actor, parent).length : 0,
    resource(actor, "experiencePoints"),
  );
  const blockedReason = !profileSupportsSpecializations
    ? ("module-required" as const)
    : !experienceStrategy
      ? ("profile-required" as const)
      : !validSkill
        ? ("skill-required" as const)
        : undefined;
  const active = blockedReason === undefined;
  return Object.freeze({
    ...plan,
    active,
    affordable: active && plan.affordable,
    ...(blockedReason === undefined ? {} : { blockedReason }),
  });
}

function result(
  plan: AdvancementPlan,
  actor: FoundryActorDocument,
): D6AdvancementResultV1 {
  if (plan.strategy === "unavailable") {
    throw new Error("D6E2.Advancement.ProfileRequired");
  }
  return Object.freeze({
    cost: plan.cost,
    kind: plan.kind,
    remaining: plan.nextResource,
    remainingCharacterPoints:
      plan.resource === "character-points"
        ? plan.nextResource
        : resource(actor, "characterPoints"),
    resource: plan.resource,
    score: plan.nextScore,
    strategy: plan.strategy,
  });
}

function resourcePath(plan: AdvancementPlan): string {
  if (plan.resource === "character-points") {
    return "system.resources.characterPoints.value";
  }
  if (plan.resource === "experience-points") {
    return "system.resources.experiencePoints.value";
  }
  return plan.resource === "milestone-attribute-dice"
    ? "system.advancement.milestone.attributeDice"
    : "system.advancement.milestone.skillPips";
}

function resourceChanges(
  actor: FoundryActorDocument,
  plan: AdvancementPlan,
  value: number,
): Readonly<Record<string, unknown>> {
  if (
    plan.resource === "character-points" ||
    plan.resource === "experience-points"
  ) {
    return { [resourcePath(plan)]: value };
  }
  const balance = readMilestoneBalance(actor);
  return {
    "system.advancement.milestone": {
      attributeDice:
        plan.resource === "milestone-attribute-dice"
          ? value
          : balance.attributeDice,
      skillPips:
        plan.resource === "milestone-skill-pips" ? value : balance.skillPips,
    },
  };
}

export async function advanceAttribute(
  actorValue: object,
  attributeId: string,
): Promise<D6AdvancementResultV1> {
  const actor = actorDocument(actorValue);
  requireAuthorizedAdvance(actor);
  const plan = attributeAdvancementPlan(actor, attributeId);
  if (!plan.active) throw new Error("D6E2.Advancement.ProfileRequired");
  if (!plan.affordable) throw new Error("D6E2.Advancement.InsufficientPoints");
  if (plan.nextScore > 15) throw new Error("D6E2.Advancement.MaximumReached");
  await withAuthorizedAdvancementUpdate(actor, () =>
    actor.update({
      [`system.attributes.${attributeId}.score`]: plan.nextStoredScore,
      ...resourceChanges(actor, plan, plan.nextResource),
    }),
  );
  return result(plan, actor);
}

export async function advanceItem(
  actorValue: object,
  itemId: string,
): Promise<D6AdvancementResultV1> {
  const actor = actorDocument(actorValue);
  requireAuthorizedAdvance(actor);
  const item = actor.items.get(itemId);
  if (!item || !["skill", "specialization"].includes(item.type)) {
    throw new Error("D6E2.Advancement.ItemRequired");
  }
  const plan = itemAdvancementPlan(actor, item);
  if (!plan.active) throw new Error("D6E2.Advancement.ItemUnsupported");
  if (plan.blockedReason === "advanced-skill-prerequisite") {
    throw new Error("D6E2.Advancement.AdvancedSkillPrerequisite");
  }
  if (!plan.affordable) throw new Error("D6E2.Advancement.InsufficientPoints");
  await withAuthorizedAdvancementUpdate(actor, () =>
    actor.update(resourceChanges(actor, plan, plan.nextResource)),
  );
  try {
    await withAuthorizedAdvancementUpdate(item, () =>
      item.update({ "system.score": plan.nextStoredScore }),
    );
  } catch (error) {
    await withAuthorizedAdvancementUpdate(actor, () =>
      actor.update(resourceChanges(actor, plan, plan.currentResource)),
    );
    throw error;
  }
  return result(plan, actor);
}

export async function acquireSpecialization(
  actorValue: object,
  parentSkillId: string,
  nameValue: string,
): Promise<D6AdvancementResultV1> {
  const actor = actorDocument(actorValue);
  requireAuthorizedAdvance(actor);
  const parent = actor.items.get(parentSkillId);
  if (parent?.type !== "skill" || parent.system.training === "advanced") {
    throw new Error("D6E2.Advancement.SpecializationSkillRequired");
  }
  const plan = specializationAcquisitionPlan(actor, parent);
  if (plan.blockedReason === "module-required") {
    throw new Error("D6E2.Advancement.SpecializationModuleRequired");
  }
  if (plan.blockedReason === "profile-required") {
    throw new Error("D6E2.Advancement.SpecializationExperienceRequired");
  }
  if (plan.atLimit) {
    throw new Error("D6E2.Advancement.SpecializationLimit");
  }
  if (!plan.affordable) {
    throw new Error("D6E2.Advancement.InsufficientPoints");
  }
  const name = normalizedSkillName(nameValue);
  if (name.length === 0) {
    throw new Error("D6E2.Advancement.SpecializationNameRequired");
  }
  if (
    linkedSpecializations(actor, parent).some(
      (candidate) =>
        candidate.name.localeCompare(name, undefined, {
          sensitivity: "accent",
        }) === 0,
    )
  ) {
    throw new Error("D6E2.Advancement.SpecializationExists");
  }

  const resourcePath = "system.resources.experiencePoints.value";
  await withAuthorizedAdvancementUpdate(actor, () =>
    actor.update({ [resourcePath]: plan.nextExperiencePoints }),
  );
  try {
    await withAuthorizedAdvancementUpdate(actor, () =>
      actor.createEmbeddedDocuments("Item", [
        {
          name,
          type: "specialization",
          system: {
            attributeId: stringValue(parent.system.attributeId, "agility"),
            key: specializationKey(parent, name),
            parentSkillId: parent.id,
            parentSkillKey: stringValue(parent.system.key),
            score: 3,
            source: {
              book: "D6 System: Second Edition",
              module: "skill-specialization-advanced-skills",
              page: 99,
            },
          },
        },
      ]),
    );
  } catch (error) {
    await withAuthorizedAdvancementUpdate(actor, () =>
      actor.update({ [resourcePath]: plan.currentExperiencePoints }),
    );
    throw error;
  }
  return Object.freeze({
    cost: plan.cost,
    kind: "specialization",
    remaining: plan.nextExperiencePoints,
    remainingCharacterPoints: resource(actor, "characterPoints"),
    resource: "experience-points",
    score: 3,
    strategy: "second-edition-experience-points",
  });
}
