import {
  formatPipScore,
  nextSecondEditionCreationScore,
  secondEditionCreationProgress,
  type SecondEditionCreationProgress,
} from "@d6-system-2e/core";
import { currentRulesProfile } from "../settings/rules-compatibility";
import { currentPipsEnabled } from "../settings/pip-rules";
import {
  campaignOptionalAttributeIds,
  currentSecondEditionCampaignProfile,
} from "../settings/campaign-profile";
import { currentEditionCapabilityProfile } from "../settings/edition-capabilities";
import { withAuthorizedCreationUpdate } from "./mechanical-edit-guard";
import {
  advancedSkillIssues as validateAdvancedSkillItem,
  advancedSkillKey,
  normalizedSkillName,
  specializationKey,
} from "./skill-module";
import {
  activeAttributeDefinitions,
  integer,
  record,
  stringValue,
} from "./sheets/values";

interface CreationBudgetView {
  readonly budget: number;
  readonly budgetLabel: string;
  readonly remaining: number;
  readonly remainingLabel: string;
  readonly used: number;
  readonly usedLabel: string;
}

export interface CharacterCreationProgressView extends Omit<
  SecondEditionCreationProgress,
  "attributes" | "skills"
> {
  readonly active: boolean;
  readonly attributes: CreationBudgetView;
  readonly advancedSkillIssues: readonly {
    readonly itemId: string;
    readonly issues: readonly string[];
  }[];
  readonly featureAccountingLabel: string;
  readonly budgetClassName: string;
  readonly moduleEnabled: boolean;
  readonly skills: CreationBudgetView;
}

function creationActive(actor: FoundryActorDocument): boolean {
  return record(actor.system.creation).active === true;
}

function skillKind(
  item: FoundryItemDocument,
): "advanced" | "specialization" | "standard" {
  if (item.type === "specialization") return "specialization";
  return item.system.training === "advanced" ? "advanced" : "standard";
}

export function characterCreationProgress(
  actor: FoundryActorDocument,
): CharacterCreationProgressView {
  const profile = currentRulesProfile();
  const campaign = currentSecondEditionCampaignProfile();
  const moduleEnabled = campaign.skillSpecializationAdvancedSkills;
  const pipsEnabled = currentPipsEnabled();
  const active =
    creationActive(actor) &&
    actor.type === "character" &&
    !profile.compatibility.firstEditionAttributes;
  const attributes = record(actor.system.attributes);
  const attributeScores = activeAttributeDefinitions(
    false,
    campaignOptionalAttributeIds(campaign),
  ).map(({ id }) => integer(record(attributes[id]).score));
  const skillItems = actor.items.contents.filter(
    (item) =>
      ["skill", "specialization"].includes(item.type) &&
      item.system.training !== "psionic",
  );
  const featureItems =
    currentEditionCapabilityProfile().rankedFeatures.state === "active"
      ? actor.items.contents.filter((item) =>
          ["flaw", "perk", "talent"].includes(item.type),
        )
      : [];
  const progress = secondEditionCreationProgress({
    activeAttributeScores: attributeScores,
    features: featureItems.map((item) => ({
      cost: integer(item.system.cost),
      rank: Math.max(1, integer(item.system.rank)),
      superpower: item.system.superpower === true,
      type: item.type as "flaw" | "perk" | "talent",
    })),
    optionalSkillModules: campaign.additionalSkillModuleCount,
    pipsEnabled,
    sidekick: record(actor.system.creation).sidekick === true,
    specializationSlots: integer(
      record(actor.system.creation).specializationSlots,
    ),
    skills: skillItems
      .filter(
        (item) =>
          moduleEnabled ||
          (item.type === "skill" && item.system.training !== "advanced"),
      )
      .map((item) => ({
        kind: skillKind(item),
        score: integer(item.system.score),
      })),
  });
  const advancedSkillIssues = moduleEnabled
    ? skillItems
        .filter(
          (item) =>
            item.type === "skill" && item.system.training === "advanced",
        )
        .map((item) => {
          return Object.freeze({
            itemId: item.id,
            issues: validateAdvancedSkillItem(actor, item),
          });
        })
        .filter(({ issues }) => issues.length > 0)
    : [];
  return Object.freeze({
    ...progress,
    active,
    attributes: Object.freeze({
      ...progress.attributes,
      budgetLabel: formatPipScore(progress.attributes.budget),
      remainingLabel: formatPipScore(
        Math.max(0, progress.attributes.remaining),
      ),
      usedLabel: formatPipScore(progress.attributes.used),
    }),
    advancedSkillIssues: Object.freeze(advancedSkillIssues),
    canFinalize:
      active && progress.canFinalize && advancedSkillIssues.length === 0,
    featureAccountingLabel: formatPipScore(progress.features.total),
    budgetClassName: moduleEnabled ? "has-specialization-exchange" : "",
    moduleEnabled,
    skills: Object.freeze({
      ...progress.skills,
      budgetLabel: formatPipScore(progress.skills.budget),
      remainingLabel: formatPipScore(Math.max(0, progress.skills.remaining)),
      usedLabel: formatPipScore(progress.skills.used),
    }),
  });
}

function assertCreationOwner(actor: FoundryActorDocument): void {
  if (!creationActive(actor)) {
    throw new Error("D6E2.Creation.NotActive");
  }
  if (actor.isOwner !== true) {
    throw new Error("D6E2.Creation.OwnerRequired");
  }
}

export async function adjustCreationAttribute(
  actor: FoundryActorDocument,
  attributeId: string,
  direction: -1 | 1,
): Promise<void> {
  assertCreationOwner(actor);
  const attribute = record(record(actor.system.attributes)[attributeId]);
  const next = Math.max(
    3,
    Math.min(
      15,
      nextSecondEditionCreationScore(
        integer(attribute.score),
        direction,
        currentPipsEnabled(),
      ),
    ),
  );
  const current = integer(attribute.score);
  if (
    next > current &&
    next - current > characterCreationProgress(actor).attributes.remaining
  ) {
    throw new Error("D6E2.Creation.AttributeBudgetExceeded");
  }
  await withAuthorizedCreationUpdate(actor, () =>
    actor.update({ [`system.attributes.${attributeId}.score`]: next }),
  );
}

export async function adjustCreationSkill(
  actor: FoundryActorDocument,
  itemId: string,
  direction: -1 | 1,
): Promise<void> {
  assertCreationOwner(actor);
  const item = actor.items.get(itemId);
  if (!item || !["skill", "specialization"].includes(item.type)) {
    throw new Error("D6E2.Creation.SkillRequired");
  }
  const kind = skillKind(item);
  if (kind === "specialization") return;
  const next = Math.max(
    0,
    Math.min(
      6,
      nextSecondEditionCreationScore(
        integer(item.system.score),
        direction,
        currentPipsEnabled(),
      ),
    ),
  );
  const current = integer(item.system.score);
  if (
    next > current &&
    next - current > characterCreationProgress(actor).skills.remaining
  ) {
    throw new Error("D6E2.Creation.SkillBudgetExceeded");
  }
  await withAuthorizedCreationUpdate(actor, () =>
    item.update({ "system.score": next }),
  );
}

export async function setCreationSpecializationAllocation(
  actor: FoundryActorDocument,
  allocate: boolean,
): Promise<void> {
  assertCreationOwner(actor);
  if (
    !currentSecondEditionCampaignProfile().skillSpecializationAdvancedSkills
  ) {
    throw new Error("D6E2.Creation.ModuleRequired");
  }
  const progress = characterCreationProgress(actor);
  if (allocate) {
    if (progress.specializations.maximumCount === 3) return;
    if (!progress.specializations.canConvertFromSkills) {
      throw new Error("D6E2.Creation.SkillBudgetConversionRequired");
    }
  } else {
    if (progress.specializations.maximumCount === 0) return;
    if (!progress.specializations.canReturnToSkills) {
      throw new Error("D6E2.Creation.SpecializationsSpent");
    }
  }
  await withAuthorizedCreationUpdate(actor, () =>
    actor.update({
      "system.creation.specializationSlots": allocate ? 3 : 0,
    }),
  );
}

export async function createCreationSpecialization(
  actor: FoundryActorDocument,
  parentSkillId: string,
  nameValue: string,
): Promise<FoundryItemDocument | undefined> {
  assertCreationOwner(actor);
  const parent = actor.items.get(parentSkillId);
  if (parent?.type !== "skill" || parent.system.training === "advanced") {
    throw new Error("D6E2.Creation.SkillRequired");
  }
  const specializationProgress =
    characterCreationProgress(actor).specializations;
  if (
    actor.items.contents.filter((item) => item.type === "specialization")
      .length >= specializationProgress.maximumCount
  ) {
    throw new Error(
      specializationProgress.maximumCount === 0
        ? "D6E2.Creation.SpecializationAllocationRequired"
        : "D6E2.Creation.SpecializationLimit",
    );
  }
  const name = normalizedSkillName(nameValue);
  if (name.length === 0) {
    throw new Error("D6E2.Creation.SpecializationNameRequired");
  }
  const parentKey = stringValue(parent.system.key);
  const duplicate = actor.items.contents.some((item) => {
    if (item.type !== "specialization") return false;
    const sameParent =
      stringValue(item.system.parentSkillId) === parent.id ||
      (parentKey.length > 0 &&
        stringValue(item.system.parentSkillKey) === parentKey);
    return (
      sameParent &&
      item.name.localeCompare(name, undefined, { sensitivity: "accent" }) === 0
    );
  });
  if (duplicate) {
    throw new Error("D6E2.Creation.SpecializationExists");
  }
  const created = await withAuthorizedCreationUpdate(actor, () =>
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
  return created[0];
}

export async function createCreationAdvancedSkill(
  actor: FoundryActorDocument,
  nameValue: string,
  prerequisiteSkillKeyValues: readonly string[],
): Promise<FoundryItemDocument | undefined> {
  assertCreationOwner(actor);
  if (
    !currentSecondEditionCampaignProfile().skillSpecializationAdvancedSkills
  ) {
    throw new Error("D6E2.Creation.ModuleRequired");
  }
  const name = normalizedSkillName(nameValue);
  if (name.length === 0) {
    throw new Error("D6E2.Creation.AdvancedSkillNameRequired");
  }
  if (
    actor.items.contents.some(
      (item) =>
        item.type === "skill" &&
        item.name.localeCompare(name, undefined, {
          sensitivity: "accent",
        }) === 0,
    )
  ) {
    throw new Error("D6E2.Creation.AdvancedSkillExists");
  }
  const prerequisiteSkillKeys = [
    ...new Set(
      prerequisiteSkillKeyValues
        .map((key) => key.trim())
        .filter((key) => key.length > 0),
    ),
  ];
  if (prerequisiteSkillKeys.length < 2) {
    throw new Error("D6E2.Creation.AdvancedSkillPrerequisiteCount");
  }
  const standardSkillKeys = new Set(
    actor.items.contents
      .filter(
        (item) =>
          item.type === "skill" &&
          item.system.training !== "advanced" &&
          item.system.training !== "psionic",
      )
      .map((item) => stringValue(item.system.key))
      .filter((key) => key.length > 0),
  );
  if (prerequisiteSkillKeys.some((key) => !standardSkillKeys.has(key))) {
    throw new Error("D6E2.Creation.AdvancedSkillPrerequisiteInvalid");
  }
  const created = await withAuthorizedCreationUpdate(actor, () =>
    actor.createEmbeddedDocuments("Item", [
      {
        name,
        type: "skill",
        system: {
          attributeId: "knowledge",
          description: "",
          key: advancedSkillKey(name),
          prerequisiteSkillKeys,
          score: 0,
          source: {
            book: "D6 System: Second Edition",
            module: "skill-specialization-advanced-skills",
            page: 96,
          },
          training: "advanced",
        },
      },
    ]),
  );
  return created[0];
}

export async function finalizeCharacterCreation(
  actor: FoundryActorDocument,
): Promise<void> {
  assertCreationOwner(actor);
  const progress = characterCreationProgress(actor);
  if (!progress.canFinalize) {
    throw new Error("D6E2.Creation.Invalid");
  }
  await withAuthorizedCreationUpdate(actor, () =>
    actor.update({ "system.creation.active": false }),
  );
}
