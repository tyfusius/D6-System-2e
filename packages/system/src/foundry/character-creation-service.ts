import {
  formatPipScore,
  nextSecondEditionCreationScore,
  secondEditionCreationProgress,
  validateAdvancedSkill,
  type SecondEditionCreationProgress,
} from "@d6-system-2e/core";
import { currentRulesProfile } from "../settings/rules-compatibility";
import {
  currentCombinedPipScore,
  currentEffectivePipScore,
  currentPipsEnabled,
} from "../settings/pip-rules";
import {
  campaignOptionalAttributeIds,
  currentSecondEditionCampaignProfile,
} from "../settings/campaign-profile";
import { withAuthorizedCreationUpdate } from "./mechanical-edit-guard";
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
  const skillItems = actor.items.contents.filter((item) =>
    ["skill", "specialization"].includes(item.type),
  );
  const progress = secondEditionCreationProgress({
    activeAttributeScores: attributeScores,
    optionalSkillModules: campaign.additionalSkillModuleCount,
    pipsEnabled,
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
  const byKey = new Map(
    skillItems
      .filter((item) => item.type === "skill")
      .map((item) => [stringValue(item.system.key), item]),
  );
  const prerequisiteScore = (item: FoundryItemDocument | undefined): number => {
    if (!item) return 0;
    if (item.system.training === "advanced") {
      return currentEffectivePipScore(integer(item.system.score));
    }
    const attributeId = stringValue(item.system.attributeId);
    return currentCombinedPipScore(
      integer(record(attributes[attributeId]).score),
      integer(item.system.score),
    );
  };
  const advancedSkillIssues = moduleEnabled
    ? skillItems
        .filter(
          (item) =>
            item.type === "skill" && item.system.training === "advanced",
        )
        .map((item) => {
          const keys = Array.isArray(item.system.prerequisiteSkillKeys)
            ? item.system.prerequisiteSkillKeys.filter(
                (key): key is string => typeof key === "string",
              )
            : [];
          return Object.freeze({
            itemId: item.id,
            issues: validateAdvancedSkill({
              prerequisiteScores: keys.map((key) =>
                prerequisiteScore(byKey.get(key)),
              ),
              score: currentEffectivePipScore(integer(item.system.score)),
            }),
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
  await withAuthorizedCreationUpdate(actor, () =>
    item.update({ "system.score": next }),
  );
}

export async function createCreationSpecialization(
  actor: FoundryActorDocument,
  parentSkillId: string,
): Promise<FoundryItemDocument | undefined> {
  assertCreationOwner(actor);
  const parent = actor.items.get(parentSkillId);
  if (parent?.type !== "skill" || parent.system.training === "advanced") {
    throw new Error("D6E2.Creation.SkillRequired");
  }
  if (
    actor.items.contents.filter((item) => item.type === "specialization")
      .length >= 3
  ) {
    throw new Error("D6E2.Creation.SpecializationLimit");
  }
  const created = await withAuthorizedCreationUpdate(actor, () =>
    actor.createEmbeddedDocuments("Item", [
      {
        name: `${parent.name} Specialization`,
        type: "specialization",
        system: {
          attributeId: stringValue(parent.system.attributeId, "agility"),
          key: `specialization-${stringValue(parent.system.key, "skill")}`,
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
): Promise<FoundryItemDocument | undefined> {
  assertCreationOwner(actor);
  if (
    !currentSecondEditionCampaignProfile().skillSpecializationAdvancedSkills
  ) {
    throw new Error("D6E2.Creation.ModuleRequired");
  }
  const created = await withAuthorizedCreationUpdate(actor, () =>
    actor.createEmbeddedDocuments("Item", [
      {
        name: "New Advanced Skill",
        type: "skill",
        system: {
          attributeId: "knowledge",
          description: "",
          key: "new-advanced-skill",
          prerequisiteSkillKeys: [],
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
