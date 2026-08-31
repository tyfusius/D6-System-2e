import {
  formatPipScore,
  nextSecondEditionCreationScore,
  secondEditionCreationProgress,
  type SecondEditionCreationProgress,
} from "@d6-system-2e/core";
import {
  currentEffectivePipScore,
  currentPipsEnabled,
} from "../settings/pip-rules";
import { configuredSpecializationsPerSkillLimit } from "../settings/specialization-rules";
import { currentSecondEditionCampaignProfile } from "../settings/campaign-profile";
import { currentOptionalCapabilityRuntime } from "../settings/optional-capabilities";
import {
  currentAttributeCreationRuntime,
  currentAttributeRuntimeStrategy,
} from "../settings/attributes";
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
import { actorAttributeBounds } from "./species-template-service";
import {
  adjustFreeD6CreationAttribute,
  adjustFreeD6CreationSkill,
  finalizeFreeD6Creation,
  freeD6CreationStrategyActive,
  freeD6CreationStrategyState,
  freeD6CreationView,
  recordFreeD6CreationItemCost,
  type FreeD6CreationViewV1,
} from "./free-d6-creation-service";

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
  "attributes" | "skills" | "specializations"
> {
  readonly active: boolean;
  readonly attributes: CreationBudgetView;
  readonly advancedSkillIssues: readonly {
    readonly itemId: string;
    readonly issues: readonly string[];
  }[];
  readonly featureAccountingLabel: string;
  readonly freeD6?: Readonly<
    FreeD6CreationViewV1 & {
      readonly budgetLabel: string;
      readonly budgetPoints: number;
      readonly characterPointSeedLabel: string;
      readonly creditLabel: string;
      readonly remainingLabel: string;
      readonly spentLabel: string;
      readonly templatePointLabel: string;
      readonly transactionViews: readonly Readonly<{
        readonly id: string;
        readonly label: string;
        readonly pointLabel: string;
      }>[];
    }
  >;
  readonly budgetClassName: string;
  readonly moduleEnabled: boolean;
  readonly skills: CreationBudgetView;
  readonly specializations: Omit<
    SecondEditionCreationProgress["specializations"],
    "maximumCount" | "remaining"
  > & {
    readonly maximumCount: number;
    readonly remaining: number;
  };
}

function creationActive(actor: FoundryActorDocument): boolean {
  return record(actor.system.creation).active === true;
}

function creationAttributeBounds(
  actor: FoundryActorDocument,
  attributeId: string,
): Readonly<{ minimum: number; maximum: number }> {
  const bounds = actorAttributeBounds(actor, attributeId);
  return currentAttributeRuntimeStrategy().family === "open-d6" &&
    attributeId === "extranormal"
    ? Object.freeze({ ...bounds, minimum: 0 })
    : bounds;
}

function skillKind(
  item: FoundryItemDocument,
): "advanced" | "specialization" | "standard" {
  if (item.type === "specialization") return "specialization";
  return item.system.training === "advanced" ? "advanced" : "standard";
}

function humanizeStableId(value: string): string {
  const segment = value.split(/[./:]/u).at(-1) ?? value;
  return segment
    .split(/[-_\s]+/u)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function characterCreationProgress(
  actor: FoundryActorDocument,
): CharacterCreationProgressView {
  const freeD6StrategyState = freeD6CreationStrategyState();
  if (freeD6StrategyState !== "other") {
    const freeD6 = freeD6CreationView(actor);
    const units = (value: number) => `${value / 2} CP`;
    const transactionUnits = (value: number) =>
      value > 0
        ? `−${value / 2} CP`
        : value < 0
          ? `+${Math.abs(value) / 2} CP`
          : "0 CP";
    const attributeLabels = new Map(
      activeAttributeDefinitions().map(({ id, label }) => [
        id,
        game.i18n.localize(label),
      ]),
    );
    const emptyBudget = Object.freeze({
      budget: 0,
      budgetLabel: "",
      remaining: 0,
      remainingLabel: "",
      used: 0,
      usedLabel: "",
    });
    return Object.freeze({
      active: freeD6.active,
      advancedSkillIssues: Object.freeze([]),
      attributes: emptyBudget,
      budgetClassName: "is-free-d6-creation",
      canFinalize:
        freeD6StrategyState === "active" &&
        freeD6.active &&
        freeD6.ledger.canFinalize,
      featureAccountingLabel: "",
      features: Object.freeze({
        flawCredit: 0,
        perkCost: 0,
        talentCost: 0,
        total: 0,
      }),
      freeD6: Object.freeze({
        ...freeD6,
        budgetLabel: units(freeD6.ledger.budgetUnits),
        budgetPoints: freeD6.ledger.budgetUnits / 2,
        characterPointSeedLabel: units(freeD6.ledger.characterPointSeedUnits),
        creditLabel: units(freeD6.ledger.creditUnits),
        remainingLabel: units(freeD6.ledger.remainingUnits),
        spentLabel: units(freeD6.ledger.spentUnits),
        templatePointLabel: units(freeD6.ledger.templatePointUnits),
        transactionViews: Object.freeze(
          freeD6.ledger.transactions.map((transaction) =>
            Object.freeze({
              id: transaction.id,
              label:
                transaction.kind === "attribute"
                  ? (attributeLabels.get(transaction.sourceId) ??
                    humanizeStableId(transaction.label))
                  : transaction.label,
              pointLabel: transactionUnits(transaction.pointUnits),
            }),
          ),
        ),
      }),
      issues: Object.freeze(
        freeD6StrategyState === "unavailable"
          ? (["creation-strategy-unavailable"] as never[])
          : [],
      ),
      moduleEnabled: freeD6StrategyState === "active",
      pips: Object.freeze({
        attributeModifierPips: 0,
        enabled: true,
        maximumModifierPips: 6,
        skillModifierPips: 0,
      }),
      skills: emptyBudget,
      specializations: Object.freeze({
        canConvertFromSkills: false,
        canReturnToSkills: false,
        count: 0,
        maximumCount:
          freeD6StrategyState === "active" ? Number.MAX_SAFE_INTEGER : 0,
        purchaseCost: 0,
        remaining:
          freeD6StrategyState === "active" ? Number.MAX_SAFE_INTEGER : 0,
      }),
    });
  }
  const attributeStrategy = currentAttributeRuntimeStrategy();
  const firstEdition = attributeStrategy.family === "open-d6";
  const attributeRuntime = currentAttributeCreationRuntime();
  const campaign = currentSecondEditionCampaignProfile();
  const moduleEnabled =
    !firstEdition && campaign.skillSpecializationAdvancedSkills;
  const pipsEnabled = currentPipsEnabled();
  const active = creationActive(actor) && actor.type === "character";
  const attributes = record(actor.system.attributes);
  const activeAttributes = activeAttributeDefinitions();
  const attributeScores = activeAttributes.map(({ id }) =>
    integer(record(attributes[id]).score),
  );
  const skillItems = actor.items.contents.filter(
    (item) =>
      ["skill", "specialization"].includes(item.type) &&
      item.system.training !== "psionic",
  );
  const featureItems =
    currentOptionalCapabilityRuntime().rankedFeatures.state === "active"
      ? actor.items.contents.filter((item) =>
          ["flaw", "perk", "talent"].includes(item.type),
        )
      : [];
  const progress = secondEditionCreationProgress({
    attributeBudgetScore: attributeRuntime.attributeBudgetScore,
    skillBudgetScore: attributeRuntime.skillBudgetScore,
    activeAttributeBounds: activeAttributes.map(({ id }) =>
      creationAttributeBounds(actor, id),
    ),
    activeAttributeScores: attributeScores,
    features: featureItems.map((item) => ({
      cost: integer(item.system.cost),
      rank: Math.max(1, integer(item.system.rank)),
      superpower: item.system.superpower === true,
      type: item.type as "flaw" | "perk" | "talent",
    })),
    optionalSkillModules: firstEdition
      ? 0
      : campaign.additionalSkillModuleCount,
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

function isFreeEditGm(actor: FoundryActorDocument): boolean {
  return (
    game.user?.isGM === true &&
    actor.isOwner === true &&
    record(actor.system.sheetMode).value === "freeedit"
  );
}

export function mayFinalizeCharacterCreation(
  actor: FoundryActorDocument,
): boolean {
  if (!creationActive(actor) || actor.isOwner !== true) return false;
  return characterCreationProgress(actor).canFinalize || isFreeEditGm(actor);
}

function assertFreeEditGm(actor: FoundryActorDocument): void {
  if (!isFreeEditGm(actor)) {
    throw new Error("D6E2.SheetMode.FreeEditRequired");
  }
  if (currentOptionalCapabilityRuntime().advancedSkills.state !== "active") {
    throw new Error("D6E2.Creation.ModuleRequired");
  }
}

export async function adjustCreationAttribute(
  actor: FoundryActorDocument,
  attributeId: string,
  direction: -1 | 1,
): Promise<void> {
  assertCreationOwner(actor);
  if (freeD6CreationStrategyState() === "unavailable") {
    throw new Error("D6E2.Creation.Error.StrategyUnavailable");
  }
  const attribute = record(record(actor.system.attributes)[attributeId]);
  const bounds = creationAttributeBounds(actor, attributeId);
  const current = integer(attribute.score);
  if (freeD6CreationStrategyActive()) {
    const next = Math.max(
      bounds.minimum,
      Math.min(bounds.maximum, current + direction),
    );
    await adjustFreeD6CreationAttribute(actor, attributeId, next);
    return;
  }
  const next = Math.max(
    bounds.minimum,
    Math.min(
      bounds.maximum,
      nextSecondEditionCreationScore(
        integer(attribute.score),
        direction,
        currentPipsEnabled(),
      ),
    ),
  );
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
  if (freeD6CreationStrategyState() === "unavailable") {
    throw new Error("D6E2.Creation.Error.StrategyUnavailable");
  }
  const item = actor.items.get(itemId);
  if (!item || !["skill", "specialization"].includes(item.type)) {
    throw new Error("D6E2.Creation.SkillRequired");
  }
  const kind = skillKind(item);
  if (kind === "specialization") return;
  const current = integer(item.system.score);
  if (freeD6CreationStrategyActive()) {
    const next = Math.max(0, current + direction);
    await adjustFreeD6CreationSkill(actor, item, next);
    return;
  }
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
  const freeD6Creation = freeD6CreationStrategyActive();
  const parent = actor.items.get(parentSkillId);
  if (parent?.type !== "skill" || parent.system.training === "advanced") {
    throw new Error("D6E2.Creation.SkillRequired");
  }
  const specializationProgress =
    characterCreationProgress(actor).specializations;
  if (!freeD6Creation) {
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
  }
  const parentKey = stringValue(parent.system.key);
  const linkedSpecializationCount = actor.items.contents.filter((item) => {
    if (item.type !== "specialization") return false;
    const linkedId = stringValue(item.system.parentSkillId);
    if (linkedId.length > 0) return linkedId === parent.id;
    return (
      parentKey.length > 0 &&
      stringValue(item.system.parentSkillKey) === parentKey
    );
  }).length;
  const configuredPerSkillLimit = configuredSpecializationsPerSkillLimit();
  if (
    configuredPerSkillLimit !== null &&
    linkedSpecializationCount >= configuredPerSkillLimit
  ) {
    throw new Error("D6E2.Creation.SpecializationPerSkillLimit");
  }
  const name = normalizedSkillName(nameValue);
  if (name.length === 0) {
    throw new Error("D6E2.Creation.SpecializationNameRequired");
  }
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
            book: freeD6Creation
              ? "FreeD6 Player Book and GM Guide"
              : "D6 System: Second Edition",
            module: freeD6Creation
              ? "free-d6"
              : "skill-specialization-advanced-skills",
            page: freeD6Creation ? 18 : 99,
          },
        },
      },
    ]),
  );
  if (freeD6Creation && created[0]) {
    try {
      await recordFreeD6CreationItemCost(actor, {
        id: `specialization:${created[0].id}`,
        kind: "specialization",
        label: created[0].name,
        points: 1,
        sourceId: created[0].id,
      });
    } catch (error) {
      await actor.deleteEmbeddedDocuments("Item", [created[0].id]);
      throw error;
    }
  }
  return created[0];
}

export async function createCreationAdvancedSkill(
  actor: FoundryActorDocument,
  nameValue: string,
  prerequisiteSkillKeyValues: readonly string[],
): Promise<FoundryItemDocument | undefined> {
  assertCreationOwner(actor);
  const freeD6Creation = freeD6CreationStrategyActive();
  if (
    !freeD6Creation &&
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
          score: freeD6Creation ? 3 : 0,
          source: {
            book: freeD6Creation
              ? "FreeD6 Player Book and GM Guide"
              : "D6 System: Second Edition",
            module: freeD6Creation
              ? "free-d6"
              : "skill-specialization-advanced-skills",
            page: freeD6Creation ? 18 : 96,
          },
          training: "advanced",
        },
      },
    ]),
  );
  if (freeD6Creation && created[0]) {
    try {
      await recordFreeD6CreationItemCost(actor, {
        id: `advanced-skill:${created[0].id}`,
        kind: "advanced-skill",
        label: created[0].name,
        points: 3,
        sourceId: created[0].id,
      });
    } catch (error) {
      await actor.deleteEmbeddedDocuments("Item", [created[0].id]);
      throw error;
    }
  }
  return created[0];
}

export async function createFreeEditSpecialization(
  actor: FoundryActorDocument,
  parentSkillId: string,
  nameValue: string,
): Promise<FoundryItemDocument | undefined> {
  assertFreeEditGm(actor);
  const parent = actor.items.get(parentSkillId);
  if (parent?.type !== "skill" || parent.system.training !== "standard") {
    throw new Error("D6E2.Creation.SkillRequired");
  }
  const name = normalizedSkillName(nameValue);
  if (name.length === 0) {
    throw new Error("D6E2.Creation.SpecializationNameRequired");
  }
  const parentKey = stringValue(parent.system.key);
  const linked = actor.items.contents.filter((item) => {
    if (item.type !== "specialization") return false;
    const linkedId = stringValue(item.system.parentSkillId);
    return linkedId.length > 0
      ? linkedId === parent.id
      : parentKey.length > 0 &&
          stringValue(item.system.parentSkillKey) === parentKey;
  });
  if (
    linked.some(
      (item) =>
        item.name.localeCompare(name, undefined, { sensitivity: "accent" }) ===
        0,
    )
  ) {
    throw new Error("D6E2.Creation.SpecializationExists");
  }
  const configuredLimit = configuredSpecializationsPerSkillLimit();
  const maximum =
    configuredLimit ??
    Math.floor(currentEffectivePipScore(integer(parent.system.score)) / 3);
  if (linked.length >= maximum) {
    throw new Error("D6E2.Creation.SpecializationPerSkillLimit");
  }
  const created = await actor.createEmbeddedDocuments("Item", [
    {
      name,
      type: "specialization",
      system: {
        attributeId: stringValue(parent.system.attributeId, "agility"),
        description: "",
        key: specializationKey(parent, name),
        parentSkillId: parent.id,
        parentSkillKey: parentKey,
        score: 3,
        source: {
          book: "D6 System: Second Edition",
          module: "skill-specialization-advanced-skills",
          page: 99,
        },
      },
    },
  ]);
  return created[0];
}

export async function createFreeEditAdvancedSkill(
  actor: FoundryActorDocument,
  nameValue: string,
  prerequisiteSkillKeyValues: readonly string[],
): Promise<FoundryItemDocument | undefined> {
  assertFreeEditGm(actor);
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
        (item) => item.type === "skill" && item.system.training === "standard",
      )
      .map((item) => stringValue(item.system.key))
      .filter((key) => key.length > 0),
  );
  if (prerequisiteSkillKeys.some((key) => !standardSkillKeys.has(key))) {
    throw new Error("D6E2.Creation.AdvancedSkillPrerequisiteInvalid");
  }
  const created = await actor.createEmbeddedDocuments("Item", [
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
  ]);
  return created[0];
}

export async function finalizeCharacterCreation(
  actor: FoundryActorDocument,
): Promise<void> {
  assertCreationOwner(actor);
  if (freeD6CreationStrategyState() === "unavailable") {
    throw new Error("D6E2.Creation.Error.StrategyUnavailable");
  }
  if (!mayFinalizeCharacterCreation(actor)) {
    throw new Error("D6E2.Creation.Invalid");
  }
  if (freeD6CreationStrategyActive()) {
    await finalizeFreeD6Creation(actor);
    return;
  }
  await withAuthorizedCreationUpdate(actor, () =>
    actor.update({ "system.creation.active": false }),
  );
}
