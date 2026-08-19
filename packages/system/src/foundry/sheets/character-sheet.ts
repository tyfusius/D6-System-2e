import {
  advancedSkillAugmentedScore,
  canPreventBecomingStunned,
  firstEditionAssistedHealingDifficulty,
  firstEditionBodyPointMaximum,
  firstEditionNaturalHealingRule,
  firstEditionMortalityElapsedMinutes,
  formatPipScore,
  dieCodeFromPipScore,
  isFirstEditionWoundLevel,
  isSecondEditionCondition,
  nextSecondEditionCreationScore,
  secondEditionConditionAllowsActions,
  secondEditionDefenseForPosture,
  secondEditionDodgeDefense as resolveSecondEditionDodgeDefense,
  secondEditionFlyingGuidance,
  secondEditionStaticDefense,
  specializationScore,
  superheroicEquipmentUsePenaltyScore,
  superpowerTalentCostPlan,
  type D6CombatActionKind,
  type D6CharacterTemplatePreviewV1,
  type D6PsionicDiscipline,
  type D6PsionicTrainingMethod,
  type D6System2eApiV2,
  type FirstEditionActiveDefenseKind,
  type FirstEditionWoundLevel,
  type SecondEditionMovementMode,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../../constants";
import {
  currentTerminology,
  terminologyAttributeLabel,
  terminologyBodyPointLabel,
  terminologyConditionLabel,
  terminologyHealthStateLabel,
  terminologyHealthTrackLabel,
} from "../../registries/terminology";
import { currentConfiguredRulesProfile } from "../../settings/rules-profile-library";
import {
  booleanSetting,
  currentActionDeclarationAssistance,
} from "../../settings/setting-values";
import { currentSecondEditionCampaignProfile } from "../../settings/campaign-profile";
import { currentOptionalCapabilityRuntime } from "../../settings/optional-capabilities";
import { currentDefenseRuntimeStrategy } from "../../settings/defenses";
import { currentActionEconomyRuntimeStrategy } from "../../settings/action-economy";
import { currentScaleRuntimeStrategy } from "../../settings/scale";
import { currentAdvancementRuntimeStrategy } from "../../settings/advancement";
import {
  FIRST_EDITION_OPTION_KEYS,
  SHARED_SETTING_KEYS,
} from "../../settings/settings-catalog";
import {
  currentCombinedPipScore,
  currentEffectivePipScore,
  currentPipsEnabled,
  currentPipsRuntimeStrategy,
} from "../../settings/pip-rules";
import { configuredSpecializationsPerSkillLimit } from "../../settings/specialization-rules";
import {
  adjustCreationAttribute,
  adjustCreationSkill,
  characterCreationProgress,
  createCreationAdvancedSkill,
  createCreationSpecialization,
  createFreeEditAdvancedSkill,
  createFreeEditSpecialization,
  finalizeCharacterCreation,
  setCreationSpecializationAllocation,
} from "../character-creation-service";
import {
  acquireSpecialization,
  advanceAttribute,
  advanceItem,
  attributeAdvancementPlan,
  itemAdvancementPlan,
  specializationAcquisitionPlan,
  type SpecializationAcquisitionPlan,
} from "../advancement-service";
import { FocusedFieldRenderGuard } from "./focused-field-render-guard";
import { groupCharacterSkillViews } from "./character-skill-hierarchy";
import {
  approveNarrativeArc,
  awardMilestone,
  completeNarrativeArc,
  exchangeMilestoneForPerk,
  proposeNarrativeArc,
  readMilestoneBalance,
  readNarrativeArcs,
  removeNarrativeArc,
  toggleNarrativeArcStep,
} from "../second-edition-advancement-service";
import {
  mayDirectEditMechanicalScore,
  withAuthorizedCreationUpdate,
} from "../mechanical-edit-guard";
import { advancedSkillIssues, skillKeySegment } from "../skill-module";
import { synchronizeActorSkills } from "../skill-sync";
import {
  currentSettingProfile,
  currentSettingSkill,
} from "../../settings/setting-profile";
import {
  createCharacterTemplateFromActor,
  synchronizeWorldCharacterTemplates,
} from "../world-character-templates";
import {
  effectiveCharacterSheetMode,
  maySelectCharacterSheetMode,
} from "./sheet-mode";
import {
  activeAttributeDefinitions,
  integer,
  record,
  stringValue,
} from "./values";
import { extraordinaryPowerSheetModel } from "./extraordinary-power-sheet-model";
import {
  characterAttributeTooltip,
  characterSkillTooltip,
} from "./character-tooltips";
import {
  actorMagicPointPool,
  actorResistancePlan,
  recoverActorMagicPoints,
  rollCyberpunkHack,
  rollCyberpunkInstallation,
  type CyberpunkHackOutcome,
} from "../rolls/roll-service";
import { openDocumentImagePicker } from "./open-document-image-picker";
import { combatDeclarationOptions } from "../combat-service";
import { currentFirstEditionGenreProfile } from "../../settings/first-edition-genre-profile";
import {
  currentAttributeRole,
  currentAttributeRuntimeStrategy,
} from "../../settings/attributes";
import { firstEditionActorSegmentMovementPlan } from "../first-edition-movement-service";
import { readActorEnvironmentEffect } from "../environment-state";
import { chooseTokenMovementDestination } from "../token-movement-controller";
import {
  moveActorToken,
  previewActorTokenMovement,
  resolveActorMovementToken,
  type ActorTokenMovementRequest,
} from "../token-movement-service";
import { currentMetaCurrencyRuntimeStrategy } from "../../settings/roll-outcome";
import { currentMovementRuntimeStrategy } from "../../settings/movement";
import { actorHeroPointBalance } from "../hero-point-service";
import {
  resolveFirstEditionBodyPointAssistedHealing,
  resolveFirstEditionBodyPointNaturalHealing,
  resolveFirstEditionAssistedHealing,
  resolveFirstEditionMortalityCheck,
  resolveFirstEditionNaturalHealing,
} from "../first-edition-healing-service";
import {
  clearFirstEditionUnconsciousness,
  readFirstEditionInjuryState,
  resolveFirstEditionIncapacitation,
} from "../first-edition-injury-service";
import {
  actorHealthResolutionStrategy,
  readActorHealth,
  setActorHealthPool,
  setActorHealthTrack,
} from "../health-runtime";
import {
  actorFirstEditionAccumulatingStunThreshold,
  clearActorFirstEditionAccumulatingStuns,
  readFirstEditionAccumulatingStuns,
} from "../first-edition-accumulating-stun-service";
import { readActorPsionics } from "../psionics-service";
import { hardenActorFirewall, readActorCyberpunk } from "../cyberpunk-service";
import {
  executeHighlightedRollRequest,
  highlightedRollRequestForSubject,
} from "../roll-requests";
import {
  addActorSecretIdentitySuspicion,
  addSuperheroicAction,
  clearActorSecretIdentity,
  makeActorIdentityPublic,
  readActorSecretIdentity,
  reinforceActorSecretIdentity,
  relyOnActorSuperpower,
  spendActorSecretIdentityHeroPoint,
  transferSuperheroicHeroPoint,
  boostSuperheroicTalent,
} from "../superheroic-service";
import {
  actorSuperheroicEquipmentRebuildDays,
  readActorSuperheroicEquipmentPowers,
  relyOnActorGearPower,
  setActorSuperheroicEquipmentState,
  useActorGadget,
} from "../superheroic-equipment-service";
import {
  beginActorNemesisEncounter,
  configureActorSuperheroicRelationships,
  readActorSuperheroicRelationships,
  recoverActorCompanionHeroPoint,
  resetActorSuperheroicRelationships,
  resolveActorNemesisDefeat,
} from "../superheroic-relationships-service";
import {
  applyActorItemDrop,
  canTransferActorItem,
  confirmActorItemTransfer,
  previewActorItemDrop,
  resolveActorSheetItemDrop,
  sortActorItem,
  transferActorItem,
} from "../actor-item-drop-service";
import { bindActorItemDropTarget } from "../actor-item-drop-binding";
import { actorAttributeBounds } from "../species-template-service";
import {
  actorIsInWorldBestiaryCatalog,
  addActorToWorldCatalog,
} from "../bestiary-document-repository";
import {
  actorCurrency,
  canTransferEquipmentItem,
  characterCurrencyTransactionsEnabled,
  characterEquipmentTransfersEnabled,
  economyCurrencyLabel,
  economyRecipients,
  spendCharacterCurrency,
  transferCharacterCurrency,
  transferCharacterEquipment,
} from "../economy-service";

const CharacterSheetBase = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2,
);

interface LinkedAdvancedSkillView {
  readonly advanceCost: number;
  readonly advanceHelp: string;
  readonly advanceResourceLabel: string;
  readonly augmentedScoreLabel: string;
  readonly canAdvance: boolean;
  readonly id: string;
  readonly name: string;
  readonly rollable: boolean;
  readonly score: number;
  readonly scoreLabel: string;
  readonly tooltip: string;
}

interface CharacterSkillView {
  readonly advanceCost: number;
  readonly advanceResourceLabel: string;
  readonly canAdvance: boolean;
  readonly canAcquireSpecialization: boolean;
  readonly attributeId: string;
  readonly bonusLabel: string;
  readonly canEditCreation: boolean;
  readonly canCreateCreationSpecialization: boolean;
  readonly canCreateSkillChild: boolean;
  readonly canIncreaseCreation: boolean;
  readonly id: string;
  readonly key: string;
  readonly linkedAdvancedSkills: readonly LinkedAdvancedSkillView[];
  readonly name: string;
  readonly parentSkillId: string;
  readonly parentSkillKey: string;
  readonly requestedRoll: boolean;
  readonly requestedRollLabel: string;
  readonly parentSkillName: string;
  readonly rollable: boolean;
  readonly score: number;
  readonly scoreLabel: string;
  readonly showAdvanceControl: boolean;
  readonly showSpecializationAcquisition: boolean;
  readonly specializationAcquisitionCost: number;
  readonly specializationAcquisitionHelp: string;
  readonly specializations: readonly CharacterSkillView[];
  readonly training: "advanced" | "psionic" | "specialization" | "standard";
  readonly tooltip: string;
}

interface CharacterAttributeView {
  readonly advanceCost: number;
  readonly advanceResourceLabel: string;
  readonly canAdvance: boolean;
  readonly canIncreaseCreation: boolean;
  readonly id: string;
  readonly label: string;
  readonly maximumScore: number;
  readonly requestedRoll: boolean;
  readonly requestedRollLabel: string;
  readonly rollable: boolean;
  readonly score: number;
  readonly scoreLabel: string;
  readonly skills: readonly CharacterSkillView[];
  readonly tooltip: string;
}

interface CharacterItemView {
  readonly advanceCost: number;
  readonly canAdvance: boolean;
  readonly equippable?: boolean;
  readonly equipped?: boolean;
  readonly id: string;
  readonly img: string;
  readonly name: string;
  readonly canInvokeFeature?: boolean;
  readonly featureUses?: number;
  readonly featureUsesMaximum?: number;
  readonly quantity?: number;
  readonly type: string;
  readonly equipmentEraLabel?: string;
  readonly equipmentEraMismatch?: boolean;
  readonly equipmentEraClass?: string;
  readonly showTransfer?: boolean;
  readonly canTransfer?: boolean;
}

interface CombatItemView extends CharacterItemView {
  readonly damageLabel: string;
  readonly equipped: boolean;
}

interface SheetTab {
  readonly cssClass: string;
  readonly group: string;
  readonly icon: string;
  readonly id: string;
  readonly label: string;
}

interface SheetTabFamily {
  readonly active: boolean;
  readonly cssClass: string;
  readonly icon: string;
  readonly id: "character" | "gear" | "powers" | "profile";
  readonly label: string;
  readonly showChildNavigation: boolean;
  readonly tabs: readonly SheetTab[];
}

interface CharacterSheetContext extends Record<string, unknown> {
  activeTabFamily?: SheetTabFamily;
  tab?: SheetTab;
  tabFamilies?: readonly SheetTabFamily[];
  tabs: Readonly<Record<string, SheetTab>>;
}

interface SkillTreeModuleApi {
  readonly apps?: {
    readonly SkillTreeActor?: new (actor: FoundryActorDocument) => {
      render(force?: boolean): unknown;
    };
  };
}

interface FoundryModuleLike {
  readonly active?: boolean;
  readonly API?: SkillTreeModuleApi;
}

function foundryModule(id: string): FoundryModuleLike | undefined {
  const modules = (
    game as FoundryGame & {
      modules?: { get(key: string): FoundryModuleLike | undefined };
    }
  ).modules;
  return modules?.get(id);
}

function systemApi(): D6System2eApiV2 {
  const api = game.system.api;
  if (!api) throw new Error("D6E2.SystemApiUnavailable");
  return api;
}

interface FirstEditionActionSelection {
  readonly actions?: readonly {
    readonly kind: D6CombatActionKind;
    readonly label: string;
    readonly sourceId?: string;
  }[];
  readonly actionAllotment: number;
  readonly defense: "full-defense" | "none" | "partial-defense";
  readonly plannedActionCount: number;
  readonly spentActionCount: number;
}

type FirstEditionQueuedActionSelection = NonNullable<
  FirstEditionActionSelection["actions"]
>[number];

interface MedicineHealerSelection {
  readonly actorId: string;
  readonly itemId: string;
}

async function confirmAdvancement(
  label: string,
  cost: number,
  resourceLabel: string,
  stepLabel: string,
): Promise<boolean> {
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/actor/character/advance-confirm.hbs`,
    { cost, label, resourceLabel, stepLabel },
  );
  const result = await foundry.applications.api.DialogV2.wait<boolean>({
    buttons: [
      {
        action: "cancel",
        callback: () => false,
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "advance",
        callback: () => true,
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-arrow-up",
        label: game.i18n.localize("D6E2.Advancement.Advance"),
      },
    ],
    classes: ["d6e2", "od6roll-dialog", "d6e2-advance-dialog"],
    content,
    modal: true,
    rejectClose: false,
    window: {
      icon: "fa-solid fa-arrow-trend-up",
      title: game.i18n.localize("D6E2.SheetMode.Advance"),
    },
  });
  return result === true;
}

function advancementPlanResourceLabel(resource: string): string {
  const key =
    resource === "character-points"
      ? "D6E2.CharacterPoints"
      : resource === "experience-points"
        ? "D6E2.ExperiencePoints"
        : resource === "milestone-attribute-dice"
          ? "D6E2.Advancement.MilestoneAttributeDice"
          : "D6E2.Advancement.MilestoneSkillPips";
  return game.i18n.localize(key);
}

async function promptStunnedPrevention(): Promise<"accept" | "prevent" | null> {
  const condition = terminologyConditionLabel(currentTerminology(), "stunned");
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/actor/character/prevent-stunned.hbs`,
    { condition },
  );
  const result = await foundry.applications.api.DialogV2.wait<
    "accept" | "prevent"
  >({
    buttons: [
      {
        action: "accept",
        callback: () => "accept",
        label: game.i18n.format("D6E2.Condition.AcceptStunned", { condition }),
      },
      {
        action: "prevent",
        callback: () => "prevent",
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-bolt",
        label: game.i18n.localize("D6E2.Condition.PreventStunned"),
      },
    ],
    classes: ["d6e2", "od6roll-dialog", "d6e2-hero-point-dialog"],
    content,
    modal: true,
    rejectClose: false,
    window: {
      icon: "fa-solid fa-heart-pulse",
      title: game.i18n.format("D6E2.Condition.StunnedIncoming", { condition }),
    },
  });
  return result ?? null;
}

async function promptAssetChoice(): Promise<
  "hero-point" | "roll-bonus" | null
> {
  const result = await foundry.applications.api.DialogV2.wait<
    "hero-point" | "roll-bonus"
  >({
    buttons: [
      {
        action: "hero-point",
        callback: () => "hero-point",
        label: game.i18n.localize("D6E2.Feature.AssetHeroPoint"),
      },
      {
        action: "roll-bonus",
        callback: () => "roll-bonus",
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-dice-d6",
        label: game.i18n.localize("D6E2.Feature.AssetRollBonus"),
      },
    ],
    classes: ["d6e2", "od6roll-dialog"],
    content: `<p>${game.i18n.localize("D6E2.Feature.AssetChoiceHelp")}</p>`,
    modal: true,
    rejectClose: false,
    window: {
      icon: "fa-solid fa-star",
      title: game.i18n.localize("D6E2.Item.Asset"),
    },
  });
  return result ?? null;
}

function htmlEscape(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

async function promptCharacterTemplate(
  previews: readonly D6CharacterTemplatePreviewV1[],
): Promise<string | null> {
  const terminology = currentTerminology();
  const initiallySelectedTemplateId = previews.find(
    (preview) => preview.canApply,
  )?.templateId;
  const issueLabel = (issue: string): string =>
    game.i18n.localize(`D6E2.Template.Issue.${issue}`);
  const templates = previews.map((preview) => ({
    ...preview,
    cssClass: preview.canApply ? "" : "is-invalid",
    selected: preview.templateId === initiallySelectedTemplateId,
    attributeChanges: preview.attributeChanges.map((change) => ({
      ...change,
      currentLabel: formatPipScore(change.currentScore),
      label:
        terminologyAttributeLabel(terminology, change.attributeId) ??
        change.attributeId,
      nextLabel: formatPipScore(change.nextScore),
    })),
    unassignedAttributeLabel: formatPipScore(preview.unassignedAttributeScore),
    issueLabels: preview.issues.map(issueLabel),
  }));
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/actor/character/template-dialog.hbs`,
    {
      compatibleTemplates: templates.filter(
        (template) => !template.issues.includes("rules-family"),
      ),
      otherTemplates: templates.filter((template) =>
        template.issues.includes("rules-family"),
      ),
    },
  );
  const result = await foundry.applications.api.DialogV2.wait<string | null>({
    buttons: [
      {
        action: "cancel",
        callback: () => null,
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "apply",
        callback: (_event, button) => {
          const selected = button.form?.querySelector<HTMLInputElement>(
            'input[name="characterTemplateId"]:checked',
          );
          return selected?.value ?? null;
        },
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-file-import",
        label: game.i18n.localize("D6E2.Template.Apply"),
      },
    ],
    classes: ["d6e2", "od6roll-dialog", "d6e2-template-dialog"],
    content,
    modal: true,
    position: { width: 720 },
    rejectClose: false,
    window: {
      icon: "fa-solid fa-address-card",
      title: game.i18n.localize("D6E2.Template.Title"),
    },
  });
  return typeof result === "string" && result.length > 0 ? result : null;
}

interface SkillNameSelection {
  readonly name: string;
}

interface AdvancedSkillDefinition {
  readonly name: string;
  readonly prerequisiteSkillKeys: readonly string[];
}

type SkillChildKind = "advanced" | "specialization";

interface NarrativeArcDefinition {
  readonly rewardId: string;
  readonly rewardKind: "attribute" | "perk" | "skill";
  readonly rewardName?: string;
  readonly steps: readonly string[];
  readonly title: string;
}

interface MilestonePerkSelection {
  readonly name: string;
  readonly perkId: string | null;
}

async function promptNarrativeArcDefinition(
  actor: FoundryActorDocument,
): Promise<NarrativeArcDefinition | null> {
  const system = record(actor.system);
  const attributes = record(system.attributes);
  const attributeChoices = activeAttributeDefinitions().map(({ id, label }) => {
    const current = currentEffectivePipScore(
      integer(record(attributes[id]).score),
    );
    const target = current + 3;
    return {
      label: `${game.i18n.localize(label)} · ${formatPipScore(current)} → ${formatPipScore(target)} · ${Math.floor(target / 3)} ${game.i18n.localize("D6E2.Advancement.NarrativeSteps")}`,
      value: `attribute:${id}`,
    };
  });
  const skillChoices = actor.items.contents
    .filter((item) => item.type === "skill")
    .map((item) => {
      const stored = integer(item.system.score);
      const attributeScore = integer(
        record(attributes[stringValue(item.system.attributeId)]).score,
      );
      const current =
        item.system.training === "advanced" ||
        item.system.training === "psionic"
          ? currentEffectivePipScore(stored)
          : currentCombinedPipScore(attributeScore, stored);
      const target = current + 3;
      return {
        label: `${item.name} · ${formatPipScore(current)} → ${formatPipScore(target)} · ${Math.floor(target / 3)} ${game.i18n.localize("D6E2.Advancement.NarrativeSteps")}`,
        value: `skill:${item.id}`,
      };
    });
  const perkChoices =
    currentOptionalCapabilityRuntime().rankedFeatures.state === "active"
      ? [
          {
            label: `${game.i18n.localize("D6E2.Advancement.NarrativeNewPerk")} · R1 · 1 ${game.i18n.localize("D6E2.Advancement.NarrativeSteps")}`,
            value: "perk:",
          },
          ...actor.items.contents
            .filter((item) => item.type === "perk")
            .map((item) => {
              const target = Math.max(1, integer(item.system.rank)) + 1;
              return {
                label: `${item.name} · R${target - 1} → R${target} · ${target} ${game.i18n.localize("D6E2.Advancement.NarrativeSteps")}`,
                value: `perk:${item.id}`,
              };
            }),
        ]
      : [];
  const options = [...skillChoices, ...attributeChoices, ...perkChoices]
    .sort((left, right) => left.label.localeCompare(right.label))
    .map(
      ({ label, value }) =>
        `<option value="${htmlEscape(value)}">${htmlEscape(label)}</option>`,
    )
    .join("");
  const result =
    await foundry.applications.api.DialogV2.wait<NarrativeArcDefinition | null>(
      {
        buttons: [
          {
            action: "cancel",
            callback: () => null,
            label: game.i18n.localize("D6E2.Cancel"),
          },
          {
            action: "propose",
            callback: (_event, button) => {
              const reward = button.form?.elements.namedItem("arcReward");
              const title = button.form?.elements.namedItem("arcTitle");
              const steps = button.form?.elements.namedItem("arcSteps");
              const rewardName =
                button.form?.elements.namedItem("arcRewardName");
              const [rewardKind, rewardId] =
                reward instanceof HTMLSelectElement
                  ? reward.value.split(":", 2)
                  : [];
              return {
                rewardId: rewardId ?? "",
                rewardKind:
                  rewardKind === "attribute"
                    ? ("attribute" as const)
                    : rewardKind === "perk"
                      ? ("perk" as const)
                      : ("skill" as const),
                rewardName:
                  rewardName instanceof HTMLInputElement
                    ? rewardName.value.trim()
                    : "",
                steps:
                  steps instanceof HTMLTextAreaElement
                    ? steps.value
                        .split(/\r?\n/u)
                        .map((value) => value.trim())
                        .filter((value) => value.length > 0)
                    : [],
                title:
                  title instanceof HTMLInputElement ? title.value.trim() : "",
              };
            },
            class: "od6roll-submit",
            default: true,
            icon: "fa-solid fa-feather-pointed",
            label: game.i18n.localize("D6E2.Advancement.NarrativePropose"),
          },
        ],
        classes: ["d6e2", "od6roll-dialog", "d6e2-narrative-arc-dialog"],
        content: `<div class="od6-dialog-shell">
        <p>${game.i18n.localize("D6E2.Advancement.NarrativeProposalHelp")}</p>
        <label><span>${game.i18n.localize("D6E2.Advancement.NarrativeTitle")}</span><input name="arcTitle" type="text" maxlength="120" required autofocus></label>
        <label><span>${game.i18n.localize("D6E2.Advancement.NarrativeReward")}</span><select name="arcReward">${options}</select></label>
        <label><span>${game.i18n.localize("D6E2.Advancement.NarrativeNewPerkName")}</span><input name="arcRewardName" type="text" maxlength="120"></label>
        <label><span>${game.i18n.localize("D6E2.Advancement.NarrativeStepsOnePerLine")}</span><textarea name="arcSteps" rows="8" required></textarea></label>
      </div>`,
        modal: true,
        rejectClose: false,
        window: {
          icon: "fa-solid fa-feather-pointed",
          title: game.i18n.localize("D6E2.Advancement.NarrativeNewArc"),
        },
      },
    );
  return result ?? null;
}

async function promptMilestonePerk(
  actor: FoundryActorDocument,
): Promise<MilestonePerkSelection | null> {
  const perks = actor.items.contents
    .filter((item) => item.type === "perk")
    .sort((left, right) => left.name.localeCompare(right.name));
  const options = [
    `<option value="">${htmlEscape(game.i18n.localize("D6E2.Advancement.MilestoneNewPerk"))}</option>`,
    ...perks.map(
      (perk) =>
        `<option value="${htmlEscape(perk.id)}">${htmlEscape(perk.name)} · R${integer(perk.system.rank)}</option>`,
    ),
  ].join("");
  const result =
    await foundry.applications.api.DialogV2.wait<MilestonePerkSelection | null>(
      {
        buttons: [
          {
            action: "cancel",
            callback: () => null,
            label: game.i18n.localize("D6E2.Cancel"),
          },
          {
            action: "exchange",
            callback: (_event, button) => {
              const perk = button.form?.elements.namedItem("perkId");
              const name = button.form?.elements.namedItem("perkName");
              const perkId =
                perk instanceof HTMLSelectElement && perk.value.length > 0
                  ? perk.value
                  : null;
              return {
                name: name instanceof HTMLInputElement ? name.value.trim() : "",
                perkId,
              };
            },
            class: "od6roll-submit",
            default: true,
            icon: "fa-solid fa-star",
            label: game.i18n.localize("D6E2.Advancement.MilestoneExchange"),
          },
        ],
        classes: ["d6e2", "od6roll-dialog"],
        content: `<div class="od6-dialog-shell">
        <p>${game.i18n.localize("D6E2.Advancement.MilestonePerkHelp")}</p>
        <label><span>${game.i18n.localize("D6E2.Advancement.MilestonePerk")}</span><select name="perkId">${options}</select></label>
        <label><span>${game.i18n.localize("D6E2.Advancement.MilestoneNewPerkName")}</span><input name="perkName" type="text" maxlength="120"></label>
      </div>`,
        modal: true,
        rejectClose: false,
        window: {
          icon: "fa-solid fa-star",
          title: game.i18n.localize("D6E2.Advancement.MilestoneExchange"),
        },
      },
    );
  return result ?? null;
}

async function promptSkillName(options: {
  readonly actionLabel: string;
  readonly fieldLabel: string;
  readonly help: string;
  readonly icon: string;
  readonly title: string;
}): Promise<string | null> {
  const result =
    await foundry.applications.api.DialogV2.wait<SkillNameSelection | null>({
      buttons: [
        {
          action: "cancel",
          callback: () => null,
          label: game.i18n.localize("D6E2.Cancel"),
        },
        {
          action: "create",
          callback: (_event, button) => {
            const control = button.form?.elements.namedItem("skillName");
            return {
              name:
                control instanceof HTMLInputElement ? control.value.trim() : "",
            };
          },
          class: "od6roll-submit",
          default: true,
          icon: options.icon,
          label: options.actionLabel,
        },
      ],
      classes: ["d6e2", "od6roll-dialog", "d6e2-skill-name-dialog"],
      content: `<div class="od6-dialog-shell">
        <p>${options.help}</p>
        <label>
          <span>${options.fieldLabel}</span>
          <input name="skillName" type="text" maxlength="120" required autofocus>
        </label>
      </div>`,
      modal: true,
      rejectClose: false,
      window: {
        icon: options.icon,
        title: options.title,
      },
    });
  if (
    typeof result !== "object" ||
    result === null ||
    !("name" in result) ||
    typeof result.name !== "string"
  ) {
    return null;
  }
  const name = result.name.trim();
  return name.length > 0 ? name : null;
}

async function promptAdvancedSkillDefinition(
  actor: FoundryActorDocument,
  initialPrerequisiteSkillKey = "",
): Promise<AdvancedSkillDefinition | null> {
  const choices = actor.items.contents
    .filter(
      (item) =>
        item.type === "skill" &&
        item.system.training !== "advanced" &&
        item.system.training !== "psionic",
    )
    .map((item) => ({
      key: stringValue(item.system.key),
      label: `${item.name} (${formatPipScore(
        currentEffectivePipScore(integer(item.system.score)),
      )})`,
    }))
    .filter((choice) => choice.key.length > 0)
    .sort((left, right) => left.label.localeCompare(right.label));
  let currentName = "";
  let currentKeys: readonly string[] = initialPrerequisiteSkillKey
    ? [initialPrerequisiteSkillKey]
    : [];
  for (;;) {
    const checkboxes = choices
      .map(
        (choice) => `<label class="od6-advanced-choice">
          <input
            type="checkbox"
            name="prerequisiteSkillKeys"
            value="${htmlEscape(choice.key)}"
            ${currentKeys.includes(choice.key) ? "checked" : ""}
          >
          <span>${htmlEscape(choice.label)}</span>
        </label>`,
      )
      .join("");
    const result =
      await foundry.applications.api.DialogV2.wait<AdvancedSkillDefinition | null>(
        {
          buttons: [
            {
              action: "cancel",
              callback: () => null,
              label: game.i18n.localize("D6E2.Cancel"),
            },
            {
              action: "create",
              callback: (_event, button) => ({
                name:
                  button.form?.elements.namedItem("skillName") instanceof
                  HTMLInputElement
                    ? (
                        button.form.elements.namedItem(
                          "skillName",
                        ) as HTMLInputElement
                      ).value.trim()
                    : "",
                prerequisiteSkillKeys: Array.from(
                  button.form?.querySelectorAll<HTMLInputElement>(
                    'input[name="prerequisiteSkillKeys"]:checked',
                  ) ?? [],
                ).map((control) => control.value),
              }),
              class: "od6roll-submit",
              default: true,
              icon: "fa-solid fa-graduation-cap",
              label: game.i18n.localize("D6E2.Creation.AddAdvancedSkill"),
            },
          ],
          classes: ["d6e2", "od6roll-dialog", "d6e2-advanced-skill-dialog"],
          content: `<div class="od6-dialog-shell">
            <p>${game.i18n.localize("D6E2.Creation.AdvancedSkillDefinitionHelp")}</p>
            <label>
              <span>${game.i18n.localize("D6E2.Creation.AdvancedSkillName")}</span>
              <input
                name="skillName"
                type="text"
                maxlength="120"
                value="${htmlEscape(currentName)}"
                required
                autofocus
              >
            </label>
            <fieldset class="od6-advanced-choice-fieldset">
              <legend>${game.i18n.localize("D6E2.Item.ConnectedSkills")}</legend>
              <p>${game.i18n.localize("D6E2.Item.ConnectedSkillsMinimum")}</p>
              <div class="od6-advanced-choice-list">${checkboxes}</div>
            </fieldset>
          </div>`,
          modal: true,
          rejectClose: false,
          window: {
            icon: "fa-solid fa-graduation-cap",
            title: game.i18n.localize("D6E2.Creation.AddAdvancedSkill"),
          },
        },
      );
    if (result === null || typeof result !== "object") return null;
    currentName = result.name.trim();
    currentKeys = [...new Set(result.prerequisiteSkillKeys)];
    if (currentName.length === 0) {
      ui.notifications.warn(
        game.i18n.localize("D6E2.Creation.AdvancedSkillNameRequired"),
      );
      continue;
    }
    if (currentKeys.length < 2) {
      ui.notifications.warn(
        game.i18n.localize("D6E2.Creation.AdvancedSkillPrerequisiteCount"),
      );
      continue;
    }
    return Object.freeze({
      name: currentName,
      prerequisiteSkillKeys: Object.freeze([...currentKeys]),
    });
  }
}

async function promptSkillChildKind(
  parentName: string,
): Promise<SkillChildKind | null> {
  const result =
    await foundry.applications.api.DialogV2.wait<SkillChildKind | null>({
      buttons: [
        {
          action: "specialization",
          callback: () => "specialization",
          class: "od6roll-submit",
          icon: "fa-solid fa-crosshairs",
          label: game.i18n.localize("D6E2.Creation.Specialization"),
        },
        {
          action: "advanced",
          callback: () => "advanced",
          icon: "fa-solid fa-graduation-cap",
          label: game.i18n.localize("D6E2.Creation.AdvancedSkill"),
        },
        {
          action: "cancel",
          callback: () => null,
          label: game.i18n.localize("D6E2.Cancel"),
        },
      ],
      classes: ["d6e2", "od6roll-dialog", "d6e2-skill-child-dialog"],
      content: `<div class="od6-dialog-shell">
      <p>${game.i18n.format("D6E2.Skill.AddChildHelp", {
        skill: htmlEscape(parentName),
      })}</p>
    </div>`,
      modal: true,
      rejectClose: false,
      window: {
        icon: "fa-solid fa-plus",
        title: game.i18n.localize("D6E2.Skill.AddChild"),
      },
    });
  return result ?? null;
}

async function confirmItemDeletion(itemName: string): Promise<boolean> {
  const result = await foundry.applications.api.DialogV2.wait<boolean>({
    buttons: [
      {
        action: "cancel",
        callback: () => false,
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "delete",
        callback: () => true,
        class: "is-danger",
        default: true,
        icon: "fa-solid fa-trash",
        label: game.i18n.localize("D6E2.Delete"),
      },
    ],
    classes: ["d6e2", "od6roll-dialog", "d6e2-delete-item-dialog"],
    content: `<div class="od6-dialog-shell"><p>${htmlEscape(
      game.i18n.format("D6E2.DeleteItemConfirm", { item: itemName }),
    )}</p></div>`,
    modal: true,
    rejectClose: false,
    window: {
      icon: "fa-solid fa-trash",
      title: game.i18n.localize("D6E2.Delete"),
    },
  });
  return result === true;
}

async function confirmFirstEditionNaturalHealing(
  restLabel: string,
): Promise<boolean> {
  const result = await foundry.applications.api.DialogV2.wait<boolean>({
    buttons: [
      {
        action: "cancel",
        callback: () => false,
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "heal",
        callback: () => true,
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-bed",
        label: game.i18n.localize(
          "D6E2.Combat.FirstEdition.Healing.ResolveNatural",
        ),
      },
    ],
    classes: ["d6e2", "od6roll-dialog"],
    content: `<div class="od6-dialog-shell"><p>${htmlEscape(
      game.i18n.format("D6E2.Combat.FirstEdition.Healing.RestConfirm", {
        rest: restLabel,
      }),
    )}</p></div>`,
    modal: true,
    rejectClose: false,
    window: {
      icon: "fa-solid fa-kit-medical",
      title: game.i18n.localize("D6E2.Combat.FirstEdition.Healing.Natural"),
    },
  });
  return result === true;
}

async function confirmFirstEditionStunRest(): Promise<boolean> {
  const result = await foundry.applications.api.DialogV2.wait<boolean>({
    buttons: [
      {
        action: "cancel",
        callback: () => false,
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "rest",
        callback: () => true,
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-bed",
        label: game.i18n.localize(
          "D6E2.Combat.FirstEdition.AccumulatingStuns.Clear",
        ),
      },
    ],
    classes: ["d6e2", "od6roll-dialog"],
    content: `<div class="od6-dialog-shell"><p>${htmlEscape(
      game.i18n.localize(
        "D6E2.Combat.FirstEdition.AccumulatingStuns.RestConfirm",
      ),
    )}</p></div>`,
    modal: true,
    rejectClose: false,
    window: {
      icon: "fa-solid fa-bed",
      title: game.i18n.localize(
        "D6E2.Combat.FirstEdition.AccumulatingStuns.Title",
      ),
    },
  });
  return result === true;
}

async function promptBodyPointRestModifier(): Promise<-3 | 0 | 3 | null> {
  const result = await foundry.applications.api.DialogV2.wait<
    -3 | 0 | 3 | null
  >({
    buttons: [
      {
        action: "cancel",
        callback: () => null,
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "strenuous",
        callback: () => -3,
        label: game.i18n.localize(
          "D6E2.Combat.FirstEdition.BodyPoints.Rest.Strenuous",
        ),
      },
      {
        action: "light",
        callback: () => 0,
        label: game.i18n.localize(
          "D6E2.Combat.FirstEdition.BodyPoints.Rest.Light",
        ),
      },
      {
        action: "full",
        callback: () => 3,
        class: "od6roll-submit",
        default: true,
        label: game.i18n.localize(
          "D6E2.Combat.FirstEdition.BodyPoints.Rest.Full",
        ),
      },
    ],
    classes: ["d6e2", "od6roll-dialog"],
    content: `<div class="od6-dialog-shell"><p>${game.i18n.localize(
      "D6E2.Combat.FirstEdition.BodyPoints.Rest.Help",
    )}</p></div>`,
    modal: true,
    rejectClose: false,
    window: {
      title: game.i18n.localize(
        "D6E2.Combat.FirstEdition.BodyPoints.NaturalHealing",
      ),
    },
  });
  return result ?? null;
}

async function promptMedicineHealer(): Promise<MedicineHealerSelection | null> {
  const options = (game.actors?.contents ?? []).flatMap((actor) =>
    actor.isOwner !== true
      ? []
      : actor.items.contents
          .filter(
            (item) =>
              item.type === "skill" &&
              (stringValue(item.system.key) === "medicine" ||
                item.name.trim().toLocaleLowerCase() === "medicine"),
          )
          .map((item) => ({ actor, item })),
  );
  if (options.length === 0) {
    ui.notifications.warn(
      game.i18n.localize("D6E2.Combat.FirstEdition.Healing.NoMedicineHealer"),
    );
    return null;
  }
  const optionMarkup = options
    .map(
      ({ actor, item }) =>
        `<option value="${htmlEscape(`${actor.id}:${item.id}`)}">${htmlEscape(
          `${actor.name} · ${item.name}`,
        )}</option>`,
    )
    .join("");
  const result =
    await foundry.applications.api.DialogV2.wait<MedicineHealerSelection | null>(
      {
        buttons: [
          {
            action: "cancel",
            callback: () => null,
            label: game.i18n.localize("D6E2.Cancel"),
          },
          {
            action: "heal",
            callback: (_event, button) => {
              const control = button.form?.elements.namedItem("medicineHealer");
              const [actorId = "", itemId = ""] =
                control instanceof HTMLSelectElement
                  ? control.value.split(":")
                  : [];
              return actorId && itemId ? { actorId, itemId } : null;
            },
            class: "od6roll-submit",
            default: true,
            icon: "fa-solid fa-kit-medical",
            label: game.i18n.localize(
              "D6E2.Combat.FirstEdition.Healing.RollMedicine",
            ),
          },
        ],
        classes: ["d6e2", "od6roll-dialog"],
        content: `<div class="od6-dialog-shell"><label><span>${htmlEscape(
          game.i18n.localize("D6E2.Combat.FirstEdition.Healing.Healer"),
        )}</span><select name="medicineHealer">${optionMarkup}</select></label><p>${htmlEscape(
          game.i18n.localize("D6E2.Combat.FirstEdition.Healing.OncePerDay"),
        )}</p></div>`,
        modal: true,
        rejectClose: false,
        window: {
          icon: "fa-solid fa-kit-medical",
          title: game.i18n.localize(
            "D6E2.Combat.FirstEdition.Healing.Assisted",
          ),
        },
      },
    );
  return result ?? null;
}

async function promptMortallyWoundedMinutes(): Promise<number | null> {
  const result = await foundry.applications.api.DialogV2.wait<number | null>({
    buttons: [
      {
        action: "cancel",
        callback: () => null,
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "roll",
        callback: (_event, button) => {
          const control = button.form?.elements.namedItem("minutes");
          return control instanceof HTMLInputElement
            ? Math.max(1, Math.trunc(control.valueAsNumber || 1))
            : 1;
        },
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-heart-pulse",
        label: game.i18n.localize(
          "D6E2.Combat.FirstEdition.Healing.RollMortality",
        ),
      },
    ],
    classes: ["d6e2", "od6roll-dialog"],
    content: `<div class="od6-dialog-shell"><label><span>${htmlEscape(
      game.i18n.localize("D6E2.Combat.FirstEdition.Healing.Minutes"),
    )}</span><input name="minutes" type="number" value="1" min="1" step="1" /></label></div>`,
    modal: true,
    rejectClose: false,
    window: {
      icon: "fa-solid fa-heart-pulse",
      title: game.i18n.localize(
        "D6E2.Combat.FirstEdition.Healing.MortalityCheck",
      ),
    },
  });
  return result ?? null;
}

async function promptFirstEditionIncapacitationSkill(): Promise<
  "stamina" | "willpower" | null
> {
  const result = await foundry.applications.api.DialogV2.wait<
    "stamina" | "willpower" | null
  >({
    buttons: [
      {
        action: "cancel",
        callback: () => null,
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "stamina",
        callback: () => "stamina",
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-dumbbell",
        label: game.i18n.localize("D6E2.Skill.Stamina"),
      },
      {
        action: "willpower",
        callback: () => "willpower",
        icon: "fa-solid fa-brain",
        label: game.i18n.localize("D6E2.Skill.Willpower"),
      },
    ],
    classes: ["d6e2", "od6roll-dialog"],
    content: `<div class="od6-dialog-shell"><p>${htmlEscape(
      game.i18n.localize(
        "D6E2.Combat.FirstEdition.Consciousness.IncapacitationHelp",
      ),
    )}</p></div>`,
    modal: true,
    rejectClose: false,
    window: {
      icon: "fa-solid fa-person-falling",
      title: game.i18n.localize(
        "D6E2.Combat.FirstEdition.Consciousness.IncapacitationTitle",
      ),
    },
  });
  return result ?? null;
}

async function promptSpecializationAcquisition(
  parentName: string,
  plan: SpecializationAcquisitionPlan,
): Promise<string | null> {
  const result =
    await foundry.applications.api.DialogV2.wait<SkillNameSelection | null>({
      buttons: [
        {
          action: "cancel",
          callback: () => null,
          label: game.i18n.localize("D6E2.Cancel"),
        },
        {
          action: "acquire",
          callback: (_event, button) => {
            const control =
              button.form?.elements.namedItem("specializationName");
            return {
              name:
                control instanceof HTMLInputElement ? control.value.trim() : "",
            };
          },
          class: "od6roll-submit",
          default: true,
          icon: "fa-solid fa-crosshairs",
          label: game.i18n.localize("D6E2.Advancement.AcquireSpecialization"),
        },
      ],
      classes: [
        "d6e2",
        "od6roll-dialog",
        "d6e2-specialization-acquisition-dialog",
      ],
      content: `<div class="od6-dialog-shell">
        <p>${game.i18n.format("D6E2.Advancement.SpecializationHelp", {
          cost: plan.cost,
          resource: advancementPlanResourceLabel(plan.resource),
          skill: htmlEscape(parentName),
        })}</p>
        <label>
          <span>${game.i18n.localize("D6E2.Advancement.SpecializationName")}</span>
          <input name="specializationName" type="text" maxlength="120" required autofocus>
        </label>
        <small>${game.i18n.localize("D6E2.Advancement.SpecializationReference")}</small>
      </div>`,
      modal: true,
      rejectClose: false,
      window: {
        icon: "fa-solid fa-crosshairs",
        title: game.i18n.localize("D6E2.Advancement.AcquireSpecialization"),
      },
    });
  if (
    typeof result !== "object" ||
    result === null ||
    !("name" in result) ||
    typeof result.name !== "string"
  ) {
    return null;
  }
  return result.name.trim().length > 0 ? result.name.trim() : null;
}

async function promptAssetRollTarget(
  actor: FoundryActorDocument,
): Promise<string | null> {
  const terminology = currentTerminology();
  const attributeOptions = activeAttributeDefinitions().map(
    ({ id, label }) => ({
      label:
        terminologyAttributeLabel(terminology, id) ?? game.i18n.localize(label),
      value: `attribute:${id}`,
    }),
  );
  const skillOptions = actor.items.contents
    .filter((item) => ["skill", "specialization"].includes(item.type))
    .map((item) => ({ label: item.name, value: `skill:${item.id}` }));
  const options = [...attributeOptions, ...skillOptions]
    .map(
      ({ label, value }) =>
        `<option value="${htmlEscape(value)}">${htmlEscape(label)}</option>`,
    )
    .join("");
  const result = await foundry.applications.api.DialogV2.wait<string | null>({
    buttons: [
      {
        action: "cancel",
        callback: () => null,
        label: game.i18n.localize("D6E2.Cancel"),
      },
      {
        action: "roll",
        callback: (_event, button) => {
          const control = button.form?.elements.namedItem("assetRollTarget");
          return control instanceof HTMLSelectElement ? control.value : "";
        },
        class: "od6roll-submit",
        default: true,
        icon: "fa-solid fa-dice-d6",
        label: game.i18n.localize("D6E2.Roll.Action"),
      },
    ],
    classes: ["d6e2", "od6roll-dialog"],
    content: `<label><span>${game.i18n.localize("D6E2.Feature.AssetRollTarget")}</span><select name="assetRollTarget">${options}</select></label>`,
    modal: true,
    rejectClose: false,
    window: {
      icon: "fa-solid fa-dice-d6",
      title: game.i18n.localize("D6E2.Feature.AssetRollBonus"),
    },
  });
  return result ?? null;
}

export class D6System2eCharacterSheet extends CharacterSheetBase {
  readonly #focusedFieldRenderGuard = new FocusedFieldRenderGuard(
    () => this.element,
    () => this.render(true),
  );
  #persistChangeQueue: Promise<void> = Promise.resolve();
  #powerWorkspace: "powers" | "skills" = "skills";
  readonly #lastFamilyTab: Record<SheetTabFamily["id"], string> = {
    character: "attributes",
    gear: "equipment",
    powers: "extraordinaryPowers",
    profile: "biography",
  };

  static readonly #addToCreatureCatalog = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    if (game.user?.isGM !== true || this.actor.type !== "creature") return;
    try {
      const document = await addActorToWorldCatalog(this.actor);
      document.sheet.render(true);
      ui.notifications.info(
        game.i18n.localize("D6E2.Bestiary.AddedToWorldCatalog"),
      );
      this.render();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "D6E2.Bestiary.CreationFailed";
      ui.notifications.warn(
        message.startsWith("D6E2.") ? game.i18n.localize(message) : message,
      );
    }
  };

  readonly #clearDropState = (): void => {
    this.element.classList.remove("is-item-drop-target");
  };

  readonly #dragOver = (event: DragEvent): void => {
    if (!this.isEditable) return;
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    this.element.classList.add("is-item-drop-target");
  };

  readonly #dragItem = (event: DragEvent): void => {
    if (!this.isEditable || !event.dataTransfer) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const itemId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    const item = itemId ? this.actor.items.get(itemId) : undefined;
    if (!item) return;
    const data = item.toDragData?.() ?? { type: "Item", uuid: item.uuid };
    const serialized = JSON.stringify(data);
    event.dataTransfer.setData("application/json", serialized);
    event.dataTransfer.setData("text/plain", serialized);
    event.dataTransfer.effectAllowed = "copyMove";
  };

  readonly #dropItem = async (event: DragEvent): Promise<void> => {
    this.#clearDropState();
    const preflight = await resolveActorSheetItemDrop(event, this.isEditable);
    if (!preflight) return;
    if ("issue" in preflight) {
      ui.notifications.warn(
        game.i18n.localize(`D6E2.Drop.Issue.${preflight.issue}`),
      );
      return;
    }
    const { data, item } = preflight;
    if (
      Hooks.callAll?.("dropActorSheetData", this.actor, this, data) === false
    ) {
      return;
    }
    if (item.parent?.id === this.actor.id) {
      const target = event.target;
      const row =
        target instanceof HTMLElement
          ? target.closest<HTMLElement>("[data-item-id]")
          : null;
      const targetItem = row?.dataset.itemId
        ? this.actor.items.get(row.dataset.itemId)
        : undefined;
      const siblingItems = row?.parentElement
        ? Array.from(
            row.parentElement.querySelectorAll<HTMLElement>(
              ":scope > [data-item-id]",
            ),
          ).flatMap((element) => {
            const sibling = element.dataset.itemId
              ? this.actor.items.get(element.dataset.itemId)
              : undefined;
            return sibling ? [sibling] : [];
          })
        : [];
      if (
        targetItem &&
        (await sortActorItem(this.actor, item, targetItem, siblingItems))
      )
        this.render();
      return;
    }
    const transferring = item.parent?.documentName === "Actor";
    if (transferring) {
      const transferPreview = canTransferActorItem(this.actor, item);
      if (!transferPreview.canApply) {
        ui.notifications.warn(
          game.i18n.localize(
            `D6E2.Drop.Issue.${transferPreview.issue ?? "drop-data"}`,
          ),
        );
        return;
      }
      if (!(await confirmActorItemTransfer(item, this.actor))) return;
      try {
        await transferActorItem(this.actor, item);
        ui.notifications.info(
          game.i18n.format("D6E2.Drop.ItemTransferred", { name: item.name }),
        );
        this.render();
      } catch (error) {
        ui.notifications.warn(
          game.i18n.localize(
            error instanceof Error ? error.message : "D6E2.Drop.Error",
          ),
        );
      }
      return;
    }
    const preview = previewActorItemDrop(this.actor, item);
    if (!preview.canApply) {
      const templateIssue = preview.templatePreview?.issues[0];
      ui.notifications.warn(
        game.i18n.localize(
          templateIssue
            ? `D6E2.Template.Issue.${templateIssue}`
            : `D6E2.Drop.Issue.${preview.issue ?? "drop-data"}`,
        ),
      );
      return;
    }
    if (
      preview.action === "apply-template" &&
      preview.templatePreview &&
      !(await promptCharacterTemplate([preview.templatePreview]))
    ) {
      return;
    }
    try {
      const applied = await applyActorItemDrop(this.actor, item);
      ui.notifications.info(
        game.i18n.format(
          applied.action === "apply-template"
            ? "D6E2.Drop.TemplateApplied"
            : "D6E2.Drop.ItemAdded",
          { name: item.name },
        ),
      );
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : "D6E2.Drop.Error",
        ),
      );
    }
  };

  static PARTS = {
    header: {
      template: `systems/${SYSTEM_ID}/templates/actor/character/header.hbs`,
    },
    controls: {
      template: `systems/${SYSTEM_ID}/templates/actor/character/controls.hbs`,
    },
    tabs: {
      template: `systems/${SYSTEM_ID}/templates/actor/character/navigation.hbs`,
    },
    attributes: {
      scrollable: [""],
      template: `systems/${SYSTEM_ID}/templates/actor/character/attributes.hbs`,
    },
    biography: {
      scrollable: [""],
      template: `systems/${SYSTEM_ID}/templates/actor/character/biography.hbs`,
    },
    traits: {
      scrollable: [""],
      template: `systems/${SYSTEM_ID}/templates/actor/character/traits.hbs`,
    },
    equipment: {
      scrollable: [""],
      template: `systems/${SYSTEM_ID}/templates/actor/character/equipment.hbs`,
    },
    combat: {
      scrollable: [""],
      template: `systems/${SYSTEM_ID}/templates/actor/character/combat.hbs`,
    },
    psionics: {
      scrollable: [""],
      template: `systems/${SYSTEM_ID}/templates/actor/character/psionics.hbs`,
    },
    extraordinaryPowers: {
      scrollable: [""],
      template: `systems/${SYSTEM_ID}/templates/actor/character/extraordinary-powers.hbs`,
    },
    cyberpunk: {
      scrollable: [""],
      template: `systems/${SYSTEM_ID}/templates/actor/character/cyberpunk.hbs`,
    },
    superheroic: {
      scrollable: [""],
      template: `systems/${SYSTEM_ID}/templates/actor/character/superheroic.hbs`,
    },
  };

  async #runSuperheroic(action: () => Promise<unknown>): Promise<void> {
    try {
      await action();
      this.render();
    } catch (error) {
      const key = error instanceof Error ? error.message : String(error);
      ui.notifications.warn(game.i18n.localize(key));
    }
  }

  async #runExtraordinaryPower(action: () => Promise<unknown>): Promise<void> {
    try {
      await action();
      this.render();
    } catch (error) {
      const key = error instanceof Error ? error.message : String(error);
      ui.notifications.warn(game.i18n.localize(key));
    }
  }

  static readonly #saveExtraordinarySkillBinding = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const row = target.closest<HTMLElement>(
      "[data-framework-id][data-role-id]",
    );
    const select = row?.querySelector<HTMLSelectElement>(
      "[data-extraordinary-skill-binding]",
    );
    const frameworkId = row?.dataset.frameworkId;
    const roleId = row?.dataset.roleId;
    if (!frameworkId || !roleId || !select) return;
    await this.#runExtraordinaryPower(() =>
      select.value
        ? systemApi().extraordinaryPowers.bindSkill(
            this.actor,
            frameworkId,
            roleId,
            select.value,
          )
        : systemApi().extraordinaryPowers.unbindSkill(
            this.actor,
            frameworkId,
            roleId,
          ),
    );
  };

  static readonly #saveExtraordinaryPowerBinding = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const row = target.closest<HTMLElement>(
      "[data-framework-id][data-power-id]",
    );
    const select = row?.querySelector<HTMLSelectElement>(
      "[data-extraordinary-power-binding]",
    );
    const frameworkId = row?.dataset.frameworkId;
    const powerId = row?.dataset.powerId;
    if (!frameworkId || !powerId || !select) return;
    await this.#runExtraordinaryPower(() =>
      select.value
        ? systemApi().extraordinaryPowers.bindPower(
            this.actor,
            frameworkId,
            powerId,
            select.value,
          )
        : systemApi().extraordinaryPowers.unbindPower(
            this.actor,
            frameworkId,
            powerId,
          ),
    );
  };

  static readonly #activateExtraordinaryPower = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const row = target.closest<HTMLElement>(
      "[data-framework-id][data-power-id]",
    );
    const frameworkId = row?.dataset.frameworkId;
    const powerId = row?.dataset.powerId;
    if (!frameworkId || !powerId) return;
    await this.#runExtraordinaryPower(() =>
      systemApi().extraordinaryPowers.activate(
        this.actor,
        frameworkId,
        powerId,
      ),
    );
  };

  static readonly #deactivateExtraordinaryPower = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const row = target.closest<HTMLElement>(
      "[data-framework-id][data-power-id]",
    );
    const frameworkId = row?.dataset.frameworkId;
    const powerId = row?.dataset.powerId;
    if (!frameworkId || !powerId) return;
    await this.#runExtraordinaryPower(() =>
      systemApi().extraordinaryPowers.deactivate(
        this.actor,
        frameworkId,
        powerId,
      ),
    );
  };

  static readonly #setExtraordinaryConsequence = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const row = target.closest<HTMLElement>(
      "[data-framework-id][data-resource-id]",
    );
    const input = row?.querySelector<HTMLInputElement>(
      "[data-extraordinary-consequence]",
    );
    const frameworkId = row?.dataset.frameworkId;
    const resourceId = row?.dataset.resourceId;
    if (!frameworkId || !resourceId || !input) return;
    await this.#runExtraordinaryPower(() =>
      systemApi().extraordinaryPowers.setConsequence(
        this.actor,
        frameworkId,
        resourceId,
        input.valueAsNumber,
      ),
    );
  };

  static readonly #reinforceSecretIdentity = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    await this.#runSuperheroic(() => reinforceActorSecretIdentity(this.actor));
  };

  static readonly #spendSecretIdentityPoint = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    await this.#runSuperheroic(() =>
      spendActorSecretIdentityHeroPoint(this.actor),
    );
  };

  static readonly #addSecretIdentitySuspicion = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    await this.#runSuperheroic(() =>
      addActorSecretIdentitySuspicion(this.actor, false),
    );
  };

  static readonly #takeSecretIdentityClue = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    await this.#runSuperheroic(() =>
      addActorSecretIdentitySuspicion(this.actor, true),
    );
  };

  static readonly #clearSecretIdentity = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    await this.#runSuperheroic(() => clearActorSecretIdentity(this.actor));
  };

  static readonly #makeIdentityPublic = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    await this.#runSuperheroic(() => makeActorIdentityPublic(this.actor));
  };

  static readonly #beginNemesisEncounter = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    await this.#runSuperheroic(() => beginActorNemesisEncounter(this.actor));
  };

  static readonly #saveSuperheroicRelationships = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    const value = (name: string): string =>
      this.element.querySelector<HTMLInputElement | HTMLSelectElement>(
        `[name="${name}"]`,
      )?.value ?? "";
    const checked = (name: string): boolean =>
      this.element.querySelector<HTMLInputElement>(`[name="${name}"]`)
        ?.checked === true;
    const scope = value("system.superheroic.relationships.nemesisScope");
    const status = value("system.superheroic.relationships.sidekickStatus");
    const current = readActorSuperheroicRelationships(this.actor);
    await this.#runSuperheroic(() =>
      configureActorSuperheroicRelationships(this.actor, {
        ...current,
        companionName: value("system.superheroic.relationships.companionName"),
        companionNotes: value(
          "system.superheroic.relationships.companionNotes",
        ),
        heroActorId: value("system.superheroic.relationships.heroActorId"),
        mentorActorId: value("system.superheroic.relationships.mentorActorId"),
        nemesisActive: checked(
          "system.superheroic.relationships.nemesisActive",
        ),
        nemesisScope: scope === "group" ? "group" : "individual",
        sidekickActive: checked(
          "system.superheroic.relationships.sidekickActive",
        ),
        sidekickCreation: checked("system.creation.sidekick"),
        sidekickRequirementsConfirmed: checked(
          "system.superheroic.relationships.sidekickRequirementsConfirmed",
        ),
        sidekickStatus:
          status === "independent" || status === "removed" ? status : "active",
      }),
    );
  };

  static readonly #recoverCompanionHeroPoint = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    await this.#runSuperheroic(() =>
      recoverActorCompanionHeroPoint(this.actor),
    );
  };

  static readonly #resetSuperheroicRelationships = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    await this.#runSuperheroic(() =>
      resetActorSuperheroicRelationships(this.actor),
    );
  };

  static readonly #resolveNemesisDefeat = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    await this.#runSuperheroic(() => resolveActorNemesisDefeat(this.actor));
  };

  static readonly #addSuperheroicAction = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    await this.#runSuperheroic(() => addSuperheroicAction(this.actor));
  };

  static readonly #transferSuperheroicHeroPoint = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    const targets = (game.actors?.contents ?? []).filter(
      (actor) =>
        actor.type === "character" &&
        actor.id !== this.actor.id &&
        (game.user?.isGM === true || actor.isOwner === true),
    );
    const options = targets
      .map(
        (actor) =>
          `<option value="${htmlEscape(actor.id)}">${htmlEscape(actor.name)}</option>`,
      )
      .join("");
    if (!options) {
      ui.notifications.warn(
        game.i18n.localize("D6E2.Superheroic.NoEligibleAlly"),
      );
      return;
    }
    const selected = await foundry.applications.api.DialogV2.wait<
      string | null
    >({
      buttons: [
        {
          action: "cancel",
          callback: () => null,
          label: game.i18n.localize("D6E2.Cancel"),
        },
        {
          action: "transfer",
          callback: (_event, button) => {
            const control = button.form?.elements.namedItem("targetActorId");
            return control instanceof HTMLSelectElement ? control.value : null;
          },
          default: true,
          label: game.i18n.localize("D6E2.Superheroic.TransferHeroPoint"),
        },
      ],
      classes: ["d6e2", "od6roll-dialog"],
      content: `<label><span>${game.i18n.localize("D6E2.Superheroic.Ally")}</span><select name="targetActorId">${options}</select></label>`,
      rejectClose: false,
      window: {
        title: game.i18n.localize("D6E2.Superheroic.TransferHeroPoint"),
      },
    });
    const target =
      typeof selected === "string" ? game.actors?.get(selected) : undefined;
    if (target) {
      await this.#runSuperheroic(() =>
        transferSuperheroicHeroPoint(this.actor, target),
      );
    }
  };

  static readonly #boostSuperheroicTalent = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    const talents = this.actor.items.contents.filter(
      (item) => item.type === "talent",
    );
    const options = talents
      .map(
        (item) =>
          `<option value="${htmlEscape(item.id)}">${htmlEscape(item.name)}</option>`,
      )
      .join("");
    if (!options) {
      ui.notifications.warn(
        game.i18n.localize("D6E2.Superheroic.TalentRequired"),
      );
      return;
    }
    const selected = await foundry.applications.api.DialogV2.wait<
      string | null
    >({
      buttons: [
        {
          action: "cancel",
          callback: () => null,
          label: game.i18n.localize("D6E2.Cancel"),
        },
        {
          action: "boost",
          callback: (_event, button) => {
            const control = button.form?.elements.namedItem("talentId");
            return control instanceof HTMLSelectElement ? control.value : null;
          },
          default: true,
          label: game.i18n.localize("D6E2.Superheroic.BoostTalent"),
        },
      ],
      classes: ["d6e2", "od6roll-dialog"],
      content: `<label><span>${game.i18n.localize("D6E2.Superheroic.Talent")}</span><select name="talentId">${options}</select></label>`,
      rejectClose: false,
      window: { title: game.i18n.localize("D6E2.Superheroic.BoostTalent") },
    });
    if (typeof selected === "string") {
      await this.#runSuperheroic(() =>
        boostSuperheroicTalent(this.actor, selected),
      );
    }
  };

  static readonly #relyOnSuperpower = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const talentId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    if (!talentId) return;
    await this.#runSuperheroic(() =>
      relyOnActorSuperpower(this.actor, talentId),
    );
  };

  static readonly #useGadget = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const itemId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    if (!itemId) return;
    await this.#runSuperheroic(() => useActorGadget(this.actor, itemId));
  };

  static readonly #useGearPower = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const row = target.closest<HTMLElement>("[data-item-id][data-power-id]");
    const itemId = row?.dataset.itemId;
    const powerId = row?.dataset.powerId;
    if (!itemId || !powerId) return;
    await this.#runSuperheroic(() =>
      relyOnActorGearPower(this.actor, itemId, powerId),
    );
  };

  static readonly #setSuperheroicEquipmentState = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const row = target.closest<HTMLElement>("[data-item-id]");
    const itemId = row?.dataset.itemId;
    const state = target.dataset.equipmentState;
    if (
      !itemId ||
      (state !== "ready" && state !== "malfunctioning" && state !== "destroyed")
    ) {
      return;
    }
    await this.#runSuperheroic(() =>
      setActorSuperheroicEquipmentState(this.actor, itemId, state),
    );
  };

  static readonly #hardenFirewall = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    try {
      await hardenActorFirewall(this.actor);
      this.render();
    } catch (error) {
      const key = error instanceof Error ? error.message : String(error);
      ui.notifications.warn(game.i18n.localize(key));
    }
  };

  static readonly #installCybernetic = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const itemId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    if (!itemId) return;
    const installers = (game.actors?.contents ?? []).filter(
      (actor) =>
        actor.isOwner === true &&
        actor.items.contents.some(
          (item) => item.type === "skill" && item.system.key === "medicine",
        ),
    );
    const options = installers
      .map(
        (actor) =>
          `<option value="${htmlEscape(actor.id)}">${htmlEscape(actor.name)}</option>`,
      )
      .join("");
    if (!options) {
      ui.notifications.warn(
        game.i18n.localize("D6E2.Cyberpunk.MedicineRequired"),
      );
      return;
    }
    const installerId = await foundry.applications.api.DialogV2.wait<
      string | null
    >({
      buttons: [
        {
          action: "install",
          callback: (_event, button) => {
            const input = button.form?.elements.namedItem("installerId");
            return input instanceof HTMLSelectElement ? input.value : null;
          },
          default: true,
          label: game.i18n.localize("D6E2.Cyberpunk.Install"),
        },
        {
          action: "cancel",
          callback: () => null,
          label: game.i18n.localize("D6E2.Cancel"),
        },
      ],
      classes: ["d6e2", "od6roll-dialog"],
      content: `<div class="od6-dialog-shell"><label><span>${htmlEscape(game.i18n.localize("D6E2.Cyberpunk.Installer"))}</span><select name="installerId">${options}</select></label><p>${htmlEscape(game.i18n.localize("D6E2.Cyberpunk.InstallDialogHelp"))}</p></div>`,
      modal: true,
      rejectClose: false,
      window: { title: game.i18n.localize("D6E2.Cyberpunk.Install") },
    });
    const installer = installerId ? game.actors?.get(installerId) : undefined;
    if (!installer) return;
    try {
      await rollCyberpunkInstallation(this.actor, itemId, installer);
      this.render();
    } catch (error) {
      const key = error instanceof Error ? error.message : String(error);
      ui.notifications.warn(game.i18n.localize(key));
    }
  };

  static readonly #hackCyberpunkTarget = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    const targetOptions = (game.actors?.contents ?? []).flatMap((actor) => {
      const state = readActorCyberpunk(actor);
      return [
        { actor, firewall: state.firewall, itemId: "", label: actor.name },
        ...state.augmentations
          .filter((item) => item.installed && item.kind === "cyberware")
          .map((item) => ({
            actor,
            firewall: item.firewall,
            itemId: item.id,
            label: `${actor.name} · ${item.name}`,
          })),
      ];
    });
    const optionMarkup = [
      `<option value="manual">${htmlEscape(game.i18n.localize("D6E2.Cyberpunk.ManualTarget"))}</option>`,
      ...targetOptions.map(
        (entry) =>
          `<option value="${htmlEscape(`${entry.actor.id}:${entry.itemId}`)}" data-firewall="${entry.firewall}">${htmlEscape(entry.label)} · ${entry.firewall}</option>`,
      ),
    ].join("");
    const selection = await foundry.applications.api.DialogV2.wait<{
      firewall: number;
      outcome: CyberpunkHackOutcome;
      targetKey: string;
      targetLabel: string;
    } | null>({
      buttons: [
        {
          action: "hack",
          callback: (_event, button) => {
            const form = button.form;
            const targetControl = form?.elements.namedItem("targetKey");
            const labelControl = form?.elements.namedItem("targetLabel");
            const firewallControl = form?.elements.namedItem("firewall");
            const outcomeControl = form?.elements.namedItem("outcome");
            return targetControl instanceof HTMLSelectElement &&
              labelControl instanceof HTMLInputElement &&
              firewallControl instanceof HTMLInputElement &&
              outcomeControl instanceof HTMLSelectElement
              ? {
                  firewall: Math.max(
                    0,
                    Math.trunc(firewallControl.valueAsNumber || 0),
                  ),
                  outcome: outcomeControl.value as CyberpunkHackOutcome,
                  targetKey: targetControl.value,
                  targetLabel: labelControl.value,
                }
              : null;
          },
          default: true,
          label: game.i18n.localize("D6E2.Cyberpunk.Hack"),
        },
        {
          action: "cancel",
          callback: () => null,
          label: game.i18n.localize("D6E2.Cancel"),
        },
      ],
      classes: ["d6e2", "od6roll-dialog"],
      content: `<div class="od6-dialog-shell"><label><span>${htmlEscape(game.i18n.localize("D6E2.Cyberpunk.Target"))}</span><select name="targetKey">${optionMarkup}</select></label><label><span>${htmlEscape(game.i18n.localize("D6E2.Cyberpunk.TargetName"))}</span><input name="targetLabel" value="${htmlEscape(game.i18n.localize("D6E2.Cyberpunk.NetworkTarget"))}" /></label><label><span>${htmlEscape(game.i18n.localize("D6E2.Cyberpunk.Firewall"))}</span><input type="number" name="firewall" value="10" min="0" step="1" /></label><label><span>${htmlEscape(game.i18n.localize("D6E2.Cyberpunk.DesiredOutcome"))}</span><select name="outcome"><option value="operate">${htmlEscape(game.i18n.localize("D6E2.Cyberpunk.Outcome.operate"))}</option><option value="data">${htmlEscape(game.i18n.localize("D6E2.Cyberpunk.Outcome.data"))}</option><option value="misdirect">${htmlEscape(game.i18n.localize("D6E2.Cyberpunk.Outcome.misdirect"))}</option><option value="disable">${htmlEscape(game.i18n.localize("D6E2.Cyberpunk.Outcome.disable"))}</option><option value="fry">${htmlEscape(game.i18n.localize("D6E2.Cyberpunk.Outcome.fry"))}</option></select></label><p>${htmlEscape(game.i18n.localize("D6E2.Cyberpunk.HackDialogHelp"))}</p></div>`,
      modal: true,
      rejectClose: false,
      window: { title: game.i18n.localize("D6E2.Cyberpunk.Hack") },
    });
    if (!selection) return;
    let targetActor: FoundryActorDocument | undefined;
    let targetItemId = "";
    let targetLabel = selection.targetLabel;
    let firewall = selection.firewall;
    if (selection.targetKey !== "manual") {
      const [actorId = "", itemId = ""] = selection.targetKey.split(":");
      targetActor = game.actors?.get(actorId);
      targetItemId = itemId;
      const entry = targetOptions.find(
        (candidate) =>
          candidate.actor.id === actorId && candidate.itemId === itemId,
      );
      if (entry) {
        targetLabel = entry.label;
        firewall = entry.firewall;
      }
    }
    try {
      await rollCyberpunkHack(
        this.actor,
        targetLabel,
        firewall,
        selection.outcome,
        targetActor,
        targetItemId || undefined,
      );
      this.render();
    } catch (error) {
      const key = error instanceof Error ? error.message : String(error);
      ui.notifications.warn(game.i18n.localize(key));
    }
  };

  static readonly #trainPsionics = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const discipline = target.closest<HTMLElement>("[data-discipline]")?.dataset
      .discipline as D6PsionicDiscipline | undefined;
    if (!discipline) return;
    const method =
      await foundry.applications.api.DialogV2.wait<D6PsionicTrainingMethod | null>(
        {
          buttons: [
            {
              action: "teacher",
              callback: () => "teacher",
              label: game.i18n.localize("D6E2.Psionics.Training.Teacher"),
            },
            {
              action: "self-study",
              callback: () => "self-study",
              label: game.i18n.localize("D6E2.Psionics.Training.SelfStudy"),
            },
            {
              action: "cancel",
              callback: () => null,
              label: game.i18n.localize("D6E2.Cancel"),
            },
          ],
          classes: ["d6e2", "od6roll-dialog"],
          content: `<p>${game.i18n.localize("D6E2.Psionics.Training.Help")}</p>`,
          modal: true,
          rejectClose: false,
          window: { title: game.i18n.localize("D6E2.Psionics.Training.Title") },
        },
      );
    if (!method) return;
    try {
      await game.system.api?.psionics.train(this.actor, discipline, method);
      this.render();
    } catch (error) {
      const key = error instanceof Error ? error.message : String(error);
      ui.notifications.warn(game.i18n.localize(key));
    }
  };

  static readonly #rollPsionicPower = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const powerId =
      target.closest<HTMLElement>("[data-power-id]")?.dataset.powerId;
    if (!powerId) return;
    const difficultyModifier = await foundry.applications.api.DialogV2.wait<
      number | null
    >({
      buttons: [
        {
          action: "roll",
          callback: (_event, button) => {
            const control = button.form?.elements.namedItem(
              "psionicDifficultyModifier",
            );
            return control instanceof HTMLInputElement
              ? Math.max(0, Math.trunc(control.valueAsNumber || 0))
              : 0;
          },
          default: true,
          label: game.i18n.localize("D6E2.Roll.Action"),
        },
        {
          action: "cancel",
          callback: () => null,
          label: game.i18n.localize("D6E2.Cancel"),
        },
      ],
      classes: ["d6e2", "od6roll-dialog"],
      content: `<label><span>${game.i18n.localize("D6E2.Psionics.DifficultyModifier")}</span><input type="number" name="psionicDifficultyModifier" value="0" min="0" step="1" /></label>`,
      modal: true,
      rejectClose: false,
      window: { title: game.i18n.localize("D6E2.Psionics.RollTitle") },
    });
    if (difficultyModifier === null) return;
    await game.system.api?.psionics.roll(this.actor, powerId, {
      difficultyModifier,
    });
  };

  static readonly #editImage = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    await openDocumentImagePicker(this.actor);
  };

  static readonly #createItem = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.isEditable) return;
    const type = target.dataset.itemType ?? "skill";
    const allowedTypes = new Set([
      "advantage",
      "armor",
      "asset",
      "cybernetic",
      "disadvantage",
      "flaw",
      "gear",
      "manifestation",
      "perk",
      "skill",
      "specialability",
      "specialization",
      "talent",
      "trouble",
      "weapon",
    ]);
    if (!allowedTypes.has(type)) return;
    if (type === "skill" || type === "specialization") {
      const storedMode = record(this.actor.system.sheetMode).value;
      if (!mayDirectEditMechanicalScore(storedMode, game.user?.isGM === true)) {
        return;
      }
    }
    const labels: Readonly<Record<string, string>> = {
      advantage: "D6E2.New.Advantage",
      armor: "D6E2.New.Armor",
      asset: "D6E2.New.Asset",
      cybernetic: "D6E2.New.Cybernetic",
      disadvantage: "D6E2.New.Disadvantage",
      flaw: "D6E2.New.Flaw",
      gear: "D6E2.New.Gear",
      manifestation: "D6E2.New.Manifestation",
      perk: "D6E2.New.Perk",
      skill: "D6E2.NewSkill",
      specialability: "D6E2.New.SpecialAbility",
      specialization: "D6E2.New.Specialization",
      talent: "D6E2.New.Talent",
      trouble: "D6E2.New.Trouble",
      weapon: "D6E2.New.Weapon",
    };
    const source: Record<string, unknown> = {
      name: game.i18n.localize(labels[type] ?? "D6E2.New.Item"),
      type,
    };
    if (type === "skill") {
      const name = await promptSkillName({
        actionLabel: game.i18n.localize("D6E2.Skill.Create"),
        fieldLabel: game.i18n.localize("D6E2.Skill.Name"),
        help: game.i18n.localize("D6E2.Skill.NameHelp"),
        icon: "fa-solid fa-book-open",
        title: game.i18n.localize("D6E2.AddSkill"),
      });
      if (name === null) return;
      const key = skillKeySegment(name);
      const duplicate = this.actor.items.contents.some(
        (item) =>
          item.type === "skill" &&
          (item.name.localeCompare(name, undefined, {
            sensitivity: "accent",
          }) === 0 ||
            stringValue(item.system.key) === key),
      );
      if (duplicate) {
        ui.notifications.warn(game.i18n.localize("D6E2.Skill.Exists"));
        return;
      }
      const attributeId =
        target.closest<HTMLElement>("[data-attribute-id]")?.dataset
          .attributeId ?? "agility";
      source.name = name;
      source.system = {
        attributeId,
        description: "",
        key,
        score: 0,
        training: "standard",
      };
    }
    const creationEdit =
      record(this.actor.system.creation).active === true &&
      this.actor.isOwner === true;
    const created =
      creationEdit && ["flaw", "perk", "talent"].includes(type)
        ? await withAuthorizedCreationUpdate(this.actor, () =>
            this.actor.createEmbeddedDocuments("Item", [source]),
          )
        : await this.actor.createEmbeddedDocuments("Item", [source]);
    created[0]?.sheet.render(true);
  };

  static readonly #editItem = function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): void {
    const itemId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    if (!itemId) return;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    item.sheet.render(true);
  };

  static readonly #deleteItem = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const itemId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    if (!itemId) return;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    const storedMode = record(this.actor.system.sheetMode).value;
    if (
      !this.isEditable ||
      game.user?.isGM !== true ||
      storedMode !== "freeedit"
    ) {
      return;
    }
    if (!(await confirmItemDeletion(item.name))) return;
    await (
      this.actor as FoundryActorDocument & {
        deleteEmbeddedDocuments(
          documentName: "Item",
          ids: readonly string[],
        ): Promise<unknown>;
      }
    ).deleteEmbeddedDocuments("Item", [item.id]);
    this.render();
  };

  async #runEconomyAction(action: () => Promise<boolean>): Promise<void> {
    try {
      if (await action()) {
        ui.notifications.info(game.i18n.localize("D6E2.Economy.Completed"));
        this.render();
      }
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error
            ? error.message
            : "D6E2.Economy.Error.TransactionFailed",
        ),
      );
    }
  }

  static readonly #spendCurrency = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    await this.#runEconomyAction(() => spendCharacterCurrency(this.actor));
  };

  static readonly #transferCurrency = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    await this.#runEconomyAction(() => transferCharacterCurrency(this.actor));
  };

  static readonly #transferEquipment = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const itemId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    const item = itemId ? this.actor.items.get(itemId) : undefined;
    if (!item) return;
    await this.#runEconomyAction(() =>
      transferCharacterEquipment(this.actor, item),
    );
  };

  static readonly #invokeFeature = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const itemId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    const item = itemId ? this.actor.items.get(itemId) : undefined;
    if (!item || !["asset", "trouble"].includes(item.type)) return;
    const choice =
      item.type === "asset" ? await promptAssetChoice() : undefined;
    if (item.type === "asset" && choice === null) return;
    const rollTarget =
      choice === "roll-bonus" ? await promptAssetRollTarget(this.actor) : null;
    if (choice === "roll-bonus" && rollTarget === null) return;
    try {
      const state = game.system.api?.features.read(this.actor);
      if (!state) return;
      const result = await game.system.api?.features.invoke(
        this.actor,
        item.id,
        {
          ...(choice ? { choice } : {}),
          expectedRevision: state.revision,
        },
      );
      if (result) {
        ui.notifications.info(
          game.i18n.localize(
            result.complicationRequired
              ? "D6E2.Feature.ComplicationRequired"
              : result.rollBonusScore === 9
                ? "D6E2.Feature.AssetRollBonus"
                : "D6E2.Feature.HeroPointAwarded",
          ),
        );
        if (result.rollBonusScore === 9 && rollTarget) {
          const [kind, id] = rollTarget.split(":", 2);
          if (kind === "attribute") {
            await game.system.api?.roll.attribute(this.actor, id ?? "", {
              featureBonus: { itemId: item.id, score: 9 },
            });
          } else if (kind === "skill") {
            await game.system.api?.roll.skill(this.actor, id ?? "", {
              featureBonus: { itemId: item.id, score: 9 },
            });
          }
        }
        this.render();
      }
    } catch (error) {
      const key =
        error instanceof Error ? error.message : "D6E2.Feature.Error.Unknown";
      ui.notifications.warn(game.i18n.localize(key));
    }
  };

  static readonly #resetFeatureSession = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    try {
      const state = game.system.api?.features.read(this.actor);
      if (!state) return;
      await game.system.api?.features.reset(this.actor, state.revision);
      ui.notifications.info(game.i18n.localize("D6E2.Feature.SessionReset"));
      this.render();
    } catch (error) {
      const key =
        error instanceof Error ? error.message : "D6E2.Feature.Error.Unknown";
      ui.notifications.warn(game.i18n.localize(key));
    }
  };

  static readonly #rollAttribute = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const attributeId = target.closest<HTMLElement>("[data-attribute-id]")
      ?.dataset.attributeId;
    if (!attributeId) return;
    if (
      await executeHighlightedRollRequest(this.actor, {
        attributeId,
        kind: "attribute",
      })
    ) {
      return;
    }
    await game.system.api?.roll.attribute(this.actor, attributeId);
  };

  static readonly #rollSkill = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const itemId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    if (!itemId) return;
    if (
      await executeHighlightedRollRequest(this.actor, {
        itemId,
        kind: "skill",
      })
    ) {
      return;
    }
    await game.system.api?.roll.skill(this.actor, itemId);
  };

  static readonly #rollLinkedAdvancedSkill = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const linkedRow = target.closest<HTMLElement>(
      "[data-parent-skill-id][data-advanced-skill-id]",
    );
    const parentSkillId = linkedRow?.dataset.parentSkillId;
    const advancedSkillItemId = linkedRow?.dataset.advancedSkillId;
    if (!parentSkillId || !advancedSkillItemId) return;
    await game.system.api?.roll.skill(this.actor, parentSkillId, {
      advancedSkillItemId,
    });
  };

  static readonly #rollCombatItem = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const itemId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    if (!itemId) return;
    await game.system.api?.roll.item(this.actor, itemId, "attack");
  };

  static readonly #rollCombatItemDamage = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const itemId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    if (!itemId) return;
    await game.system.api?.roll.item(this.actor, itemId, "damage");
  };

  static readonly #rollResistance = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    await game.system.api?.roll.resistance(this.actor);
  };

  static readonly #rollFirstEditionDefense = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const kind = target.closest<HTMLElement>("[data-defense-kind]")?.dataset
      .defenseKind;
    if (!kind || !["block", "dodge", "parry"].includes(kind)) return;
    await game.system.api?.roll.defense(
      this.actor,
      kind as FirstEditionActiveDefenseKind,
    );
    this.render();
  };

  static readonly #planFirstEditionMovement = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    const roundState = game.system.api?.combat.read(this.actor) ?? null;
    const content = await foundry.applications.handlebars.renderTemplate(
      `systems/${SYSTEM_ID}/templates/actor/character/first-edition-movement.hbs`,
      {
        segmented:
          currentActionEconomyRuntimeStrategy().turnScheduling ===
          "round-robin-segments",
      },
    );
    const input = await foundry.applications.api.DialogV2.wait<{
      terrainModifier: number;
      type: "climb" | "fly" | "land" | "swim";
      reactive: boolean;
    } | null>({
      buttons: [
        {
          action: "cancel",
          callback: () => null,
          label: game.i18n.localize("D6E2.Cancel"),
        },
        {
          action: "plan",
          callback: (_event, button) => {
            const form = button.form;
            if (!form) return null;
            const data = new FormData(form);
            const typeEntry = data.get("type");
            const type = typeof typeEntry === "string" ? typeEntry : "";
            if (!["climb", "fly", "land", "swim"].includes(type)) return null;
            return {
              reactive: data.get("reactive") === "on",
              terrainModifier: Number(data.get("terrainModifier")),
              type: type as "climb" | "fly" | "land" | "swim",
            };
          },
          class: "od6roll-submit",
          default: true,
          icon: "fa-solid fa-person-running",
          label: game.i18n.localize("D6E2.Movement.ChooseDestination"),
        },
      ],
      classes: ["d6e2", "od6roll-dialog"],
      content,
      modal: true,
      rejectClose: false,
      window: {
        icon: "fa-solid fa-person-running",
        title: game.i18n.localize("D6E2.Combat.FirstEdition.PlanMovement"),
      },
    });
    if (!input) return;
    try {
      resolveActorMovementToken(this.actor);
      const request: Omit<ActorTokenMovementRequest, "destination"> = {
        terrainModifier: input.terrainModifier,
        reactive: input.reactive,
        type: input.type,
        ...(roundState === null
          ? {}
          : { expectedRevision: roundState.revision }),
      };
      const destination = await chooseTokenMovementDestination({
        preview: (point) =>
          previewActorTokenMovement(this.actor, {
            ...request,
            destination: point,
          }),
        title: game.i18n.localize("D6E2.Combat.FirstEdition.PlanMovement"),
      });
      if (!destination) return;
      const result = await moveActorToken(this.actor, {
        ...request,
        destination,
      });
      if (!result.moved) {
        ui.notifications.warn(
          game.i18n.localize("D6E2.Movement.RollFailedManual"),
        );
      }
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };

  static readonly #moveSecondEditionToken = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    const roundState = game.system.api?.combat.read(this.actor) ?? null;
    const declaredMode = roundState?.currentAction?.movementMode;
    let mode = ["walk", "run", "crawl"].includes(declaredMode ?? "")
      ? (declaredMode as "walk" | "run" | "crawl")
      : undefined;
    if (!mode) {
      const prone = record(this.actor.system.movement).posture === "prone";
      const choice = await foundry.applications.api.DialogV2.wait<
        "walk" | "run" | "crawl"
      >({
        buttons: [
          {
            action: "cancel",
            label: game.i18n.localize("D6E2.Cancel"),
          },
          {
            action: "choose",
            callback: (_event, button) => {
              const field = button.form?.elements.namedItem("mode");
              return field instanceof HTMLSelectElement
                ? (field.value as "walk" | "run" | "crawl")
                : prone
                  ? "crawl"
                  : "walk";
            },
            class: "od6roll-submit",
            default: true,
            label: game.i18n.localize("D6E2.Movement.ChooseDestination"),
          },
        ],
        classes: ["d6e2", "od6roll-dialog"],
        content: `<div class="od6roll-shell"><label><span>${game.i18n.localize("D6E2.Combat.Movement.Title")}</span><select name="mode">${prone ? `<option value="crawl">${game.i18n.localize("D6E2.Combat.Movement.Crawl")}</option>` : `<option value="walk">${game.i18n.localize("D6E2.Combat.Movement.Walk")}</option><option value="run">${game.i18n.localize("D6E2.Combat.Movement.Run")}</option>`}</select></label></div>`,
        modal: true,
        window: {
          icon: "fa-solid fa-person-walking-arrow-right",
          title: game.i18n.localize("D6E2.Movement.MoveToken"),
        },
      });
      if (choice !== "walk" && choice !== "run" && choice !== "crawl") return;
      mode = choice;
    }
    const request: Omit<ActorTokenMovementRequest, "destination"> = {
      mode,
      ...(roundState === null ? {} : { expectedRevision: roundState.revision }),
    };
    try {
      resolveActorMovementToken(this.actor);
      const destination = await chooseTokenMovementDestination({
        preview: (point) =>
          previewActorTokenMovement(this.actor, {
            ...request,
            destination: point,
          }),
        title: game.i18n.localize("D6E2.Movement.MoveToken"),
      });
      if (!destination) return;
      await moveActorToken(this.actor, { ...request, destination });
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };

  static readonly #declareCombatActions = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    const roundState = game.system.api?.combat.read(this.actor);
    if (!roundState) {
      ui.notifications.warn(
        game.i18n.localize("D6E2.Combat.Error.NotInCombat"),
      );
      return;
    }
    const declarationOptions = combatDeclarationOptions(this.actor);
    const actionGroups = (
      [
        ["attribute", "D6E2.Combat.Attributes"],
        ["skill", "D6E2.Combat.Skills"],
        ["weapon", "D6E2.Combat.WeaponAttacks"],
      ] as const
    ).map(([group, label]) => ({
      label: game.i18n.localize(label),
      options: declarationOptions.filter((option) => option.group === group),
    }));
    const selectedSourceValues = roundState.actions
      .filter(
        (action) =>
          action.sourceId !== undefined &&
          ["attribute", "attack", "skill"].includes(action.kind),
      )
      .map((action) => `${action.kind}:${action.sourceId}`);
    const activeHealth = readActorHealth(this.actor);
    const condition = isSecondEditionCondition(
      activeHealth.track?.currentStateId,
    )
      ? activeHealth.track.currentStateId
      : "healthy";
    const environmentEffect =
      currentOptionalCapabilityRuntime().environments.state === "active"
        ? readActorEnvironmentEffect(this.actor)
        : null;
    const movementAction = roundState.actions.find(
      (action) => action.movementMode !== undefined,
    );
    const movementMode = movementAction?.movementMode ?? "hold";
    const prone = record(this.actor.system.movement).posture === "prone";
    const canEndProne = ["walk", "run"].includes(movementMode);
    const content = await foundry.applications.handlebars.renderTemplate(
      `systems/${SYSTEM_ID}/templates/actor/character/combat-declaration.hbs`,
      {
        actions: roundState.actions
          .filter(
            (action) =>
              action.movementMode === undefined &&
              action.sourceId === undefined,
          )
          .map((action) => action.label)
          .join("\n"),
        canAct: secondEditionConditionAllowsActions(condition),
        canEndProne,
        endProneCheckedAttribute:
          movementAction?.endProne === true ? "checked" : "",
        endProneDisabledAttribute: canEndProne ? "" : "disabled",
        holdSelectedAttribute: movementMode === "hold" ? "selected" : "",
        walkSelectedAttribute: movementMode === "walk" ? "selected" : "",
        runSelectedAttribute: movementMode === "run" ? "selected" : "",
        crawlSelectedAttribute: movementMode === "crawl" ? "selected" : "",
        standSelectedAttribute: movementMode === "stand" ? "selected" : "",
        uprightMovementDisabledAttribute: prone ? "disabled" : "",
        proneMovementDisabledAttribute: prone ? "" : "disabled",
        conditionPenaltyScore:
          activeHealth.track?.currentState.penaltyScore ?? 0,
        environmentPenaltyScore: environmentEffect?.penaltyScore ?? 0,
        walkDistance: environmentEffect?.halfMove ? 2.5 : 5,
        runDistance: environmentEffect?.halfMove ? 5 : 10,
        crawlDistance: environmentEffect?.halfMove ? 1 : 2,
      },
    );
    const declaration = await foundry.applications.api.DialogV2.wait<
      readonly {
        readonly endProne?: boolean;
        readonly kind: D6CombatActionKind;
        readonly label: string;
        readonly movementMode?: SecondEditionMovementMode;
        readonly sourceId?: string;
      }[]
    >({
      buttons: [
        {
          action: "cancel",
          callback: () => [],
          label: game.i18n.localize("D6E2.Cancel"),
        },
        {
          action: "declare",
          callback: (_event, button) => {
            const form = button.form;
            if (!form) return [];
            const data = new FormData(form);
            const actions = data.get("actions");
            if (typeof actions !== "string") return [];
            const selectedActions = data
              .getAll("actionSource")
              .filter(
                (value): value is string =>
                  typeof value === "string" && value.includes(":"),
              )
              .flatMap((value) => {
                const separator = value.indexOf(":");
                const kind = value.slice(0, separator);
                const sourceId = value.slice(separator + 1);
                if (
                  !["attribute", "attack", "skill"].includes(kind) ||
                  !sourceId
                ) {
                  return [];
                }
                const option = declarationOptions.find(
                  (candidate) =>
                    candidate.kind === kind && candidate.sourceId === sourceId,
                );
                return option
                  ? [
                      {
                        kind: option.kind,
                        label: option.label,
                        sourceId: option.sourceId,
                      },
                    ]
                  : [];
              });
            const movementMode = data.get("movementMode");
            const modes: readonly SecondEditionMovementMode[] = [
              "hold",
              "walk",
              "run",
              "crawl",
              "stand",
            ];
            const selectedMovement = modes.includes(
              movementMode as SecondEditionMovementMode,
            )
              ? (movementMode as SecondEditionMovementMode)
              : "hold";
            const endProne =
              data.get("endProne") === "on" &&
              (selectedMovement === "walk" || selectedMovement === "run");
            const declaredActions: {
              endProne?: boolean;
              kind: D6CombatActionKind;
              label: string;
              movementMode?: SecondEditionMovementMode;
              sourceId?: string;
            }[] =
              selectedMovement === "hold"
                ? []
                : [
                    {
                      kind: "move",
                      label: game.i18n.localize(
                        `D6E2.Combat.Movement.${selectedMovement[0]?.toUpperCase()}${selectedMovement.slice(1)}`,
                      ),
                      ...(endProne ? { endProne: true } : {}),
                      movementMode: selectedMovement,
                    },
                  ];
            declaredActions.push(
              ...selectedActions,
              ...actions
                .split(/\r?\n/)
                .map((label) => label.trim())
                .filter((label) => label.length > 0)
                .map((label) => ({ kind: "other" as const, label })),
            );
            return declaredActions;
          },
          class: "od6roll-submit",
          default: true,
          icon: "fa-solid fa-list-check",
          label: game.i18n.localize("D6E2.Combat.Declare"),
        },
      ],
      classes: ["d6e2", "od6roll-dialog", "d6e2-combat-dialog"],
      content,
      modal: true,
      rejectClose: false,
      render: (_event, dialog) => {
        const movement = dialog.element.querySelector<HTMLSelectElement>(
          'select[name="movementMode"]',
        );
        const endProne = dialog.element.querySelector<HTMLInputElement>(
          'input[name="endProne"]',
        );
        const picker = dialog.element.querySelector<HTMLElement>(
          ".d6e2-combat-action-picker",
        );
        const rows =
          dialog.element.querySelector<HTMLElement>("[data-action-rows]");
        const add = dialog.element.querySelector<HTMLButtonElement>(
          "[data-declaration-add]",
        );
        const other = dialog.element.querySelector<HTMLTextAreaElement>(
          'textarea[name="actions"]',
        );
        const summary = dialog.element.querySelector<HTMLElement>(
          "[data-declaration-summary]",
        );
        const validation = dialog.element.querySelector<HTMLElement>(
          "[data-declaration-error]",
        );
        const declare = dialog.element.querySelector<HTMLButtonElement>(
          '[data-action="declare"]',
        );
        if (
          !movement ||
          !endProne ||
          !picker ||
          !rows ||
          !add ||
          !other ||
          !summary ||
          !validation ||
          !declare
        ) {
          return;
        }
        const populateActionSelect = (select: HTMLSelectElement): void => {
          for (const group of actionGroups) {
            if (group.options.length === 0) continue;
            const optgroup = document.createElement("optgroup");
            optgroup.label = group.label;
            for (const source of group.options) {
              const option = document.createElement("option");
              option.value = source.value;
              option.dataset.kind = source.kind;
              option.dataset.label = source.label;
              option.dataset.score = String(source.score);
              option.textContent = `${source.label} · ${source.scoreLabel}`;
              optgroup.append(option);
            }
            select.append(optgroup);
          }
        };
        const initialSelect = rows.querySelector<HTMLSelectElement>(
          'select[name="actionSource"]',
        );
        const initialRow =
          initialSelect?.closest<HTMLElement>("[data-action-row]");
        if (!initialSelect || !initialRow) return;
        populateActionSelect(initialSelect);
        const createActionRow = (): HTMLElement => {
          const row = initialRow.cloneNode(true) as HTMLElement;
          row.classList.remove("is-invalid");
          const select = row.querySelector<HTMLSelectElement>(
            'select[name="actionSource"]',
          );
          const output =
            row.querySelector<HTMLOutputElement>("[data-action-pool]");
          if (select) select.value = "";
          if (output) output.textContent = "";
          return row;
        };
        if (selectedSourceValues.length > 0) {
          initialSelect.value = selectedSourceValues[0] ?? "";
          for (const value of selectedSourceValues.slice(1)) {
            const row = createActionRow();
            rows.append(row);
            const select = row.querySelector<HTMLSelectElement>(
              'select[name="actionSource"]',
            );
            if (select) select.value = value;
          }
        }
        const conditionPenalty = Number(picker.dataset.conditionPenalty ?? "0");
        const environmentPenalty = Number(
          picker.dataset.environmentPenalty ?? "0",
        );
        const conditionAllowsActions =
          picker.dataset.conditionAllowsActions === "true";
        const synchronize = () => {
          const permitted =
            movement.value === "walk" || movement.value === "run";
          endProne.disabled = !permitted;
          if (!permitted) endProne.checked = false;
          const movementIsAction = movement.value !== "hold";
          const movementPenalty =
            movement.value === "run" || movement.value === "crawl" ? 3 : 0;
          const selectedRows = Array.from(
            rows.querySelectorAll<HTMLElement>("[data-action-row]"),
          );
          const selectedCount = selectedRows.filter((row) => {
            const select = row.querySelector<HTMLSelectElement>(
              'select[name="actionSource"]',
            );
            return Boolean(select?.value);
          }).length;
          const otherCount = other.value
            .split(/\r?\n/)
            .map((value) => value.trim())
            .filter(Boolean).length;
          const actionCount =
            (movementIsAction ? 1 : 0) + selectedCount + otherCount;
          const actionPenalty = Math.max(0, actionCount - 1) * 3;
          let invalidPool = false;
          for (const row of selectedRows) {
            const select = row.querySelector<HTMLSelectElement>(
              'select[name="actionSource"]',
            );
            const output =
              row.querySelector<HTMLOutputElement>("[data-action-pool]");
            const option = select?.selectedOptions[0];
            if (!select?.value || !option || !output) {
              if (output) output.textContent = "";
              row.classList.remove("is-invalid");
              continue;
            }
            const baseScore = Number(option.dataset.score ?? "0");
            const skillMovementPenalty =
              option.dataset.kind === "attribute" ? 0 : movementPenalty;
            const effectiveScore =
              baseScore -
              actionPenalty -
              conditionPenalty -
              environmentPenalty -
              skillMovementPenalty;
            const legal = effectiveScore >= 3;
            output.textContent = `${formatPipScore(baseScore)} → ${formatPipScore(Math.max(0, effectiveScore))}`;
            row.classList.toggle("is-invalid", !legal);
            invalidPool ||= !legal;
          }
          summary.textContent = game.i18n.format(
            "D6E2.Combat.DeclarationPreview",
            {
              count: actionCount,
              penalty:
                actionPenalty === 0
                  ? "0D"
                  : `−${formatPipScore(actionPenalty)}`,
            },
          );
          const invalid =
            actionCount < 1 || invalidPool || !conditionAllowsActions;
          validation.hidden = !invalid;
          validation.textContent = !conditionAllowsActions
            ? game.i18n.localize("D6E2.Combat.Error.ConditionCannotAct")
            : invalidPool
              ? game.i18n.localize(
                  "D6E2.Combat.Error.DeclarationPoolBelowOneDie",
                )
              : game.i18n.localize("D6E2.Combat.Error.ActionRequired");
          declare.disabled = invalid;
        };
        add.addEventListener("click", () => {
          rows.append(createActionRow());
          synchronize();
        });
        rows.addEventListener("click", (event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          const remove = target.closest<HTMLButtonElement>(
            "[data-declaration-remove]",
          );
          if (!remove) return;
          remove.closest("[data-action-row]")?.remove();
          if (!rows.querySelector("[data-action-row]")) {
            rows.append(createActionRow());
          }
          synchronize();
        });
        dialog.element.addEventListener("input", synchronize);
        dialog.element.addEventListener("change", synchronize);
        synchronize();
      },
      window: {
        icon: "fa-solid fa-list-ol",
        title: game.i18n.localize("D6E2.Combat.DeclareActions"),
      },
    });
    if (!Array.isArray(declaration) || declaration.length === 0) return;
    try {
      await game.system.api?.combat.declare(this.actor, {
        actions: declaration,
        expectedRevision: roundState.revision,
      });
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };

  static readonly #completeCombatAction = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    const state = game.system.api?.combat.read(this.actor);
    if (!state) return;
    try {
      await game.system.api?.combat.completeNext(this.actor, state.revision);
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };

  static readonly #enterSecondEditionFullDefense = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    const state = game.system.api?.combat.read(this.actor);
    if (!state) return;
    try {
      await game.system.api?.combat.fullDefense(this.actor, state.revision);
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };

  static readonly #recordSecondEditionFeint = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    const state = game.system.api?.combat.read(this.actor);
    const target = Array.from(game.user?.targets ?? [])[0];
    if (!state || !target) {
      ui.notifications.warn(
        game.i18n.localize("D6E2.Combat.ActiveResponsive.TargetRequired"),
      );
      return;
    }
    try {
      await game.system.api?.combat.feint(
        this.actor,
        target.id,
        state.revision,
      );
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };

  static readonly #commitFirstEditionActions = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    const state = game.system.api?.combat.read(this.actor);
    if (!state) {
      ui.notifications.warn(
        game.i18n.localize("D6E2.Combat.Error.NotInCombat"),
      );
      return;
    }
    const current = state.firstEditionCommitment;
    const segmentedActions =
      currentActionEconomyRuntimeStrategy().turnScheduling ===
      "round-robin-segments";
    if (segmentedActions) {
      const declarationOptions = combatDeclarationOptions(this.actor);
      const actionGroups = (
        [
          ["attribute", "D6E2.Combat.Attributes"],
          ["movement", "D6E2.Combat.FirstEdition.MovementActions"],
          ["skill", "D6E2.Combat.Skills"],
          ["weapon", "D6E2.Combat.WeaponAttacks"],
        ] as const
      ).map(([group, label]) => ({
        label: game.i18n.localize(label),
        options: declarationOptions.filter((option) => option.group === group),
      }));
      const queued = state.actions.length
        ? state.actions
        : [{ id: "", kind: "other" as const, label: "" }];
      const content = await foundry.applications.handlebars.renderTemplate(
        `systems/${SYSTEM_ID}/templates/actor/character/first-edition-action-queue.hbs`,
        {
          actionAllotment: current?.actionAllotment ?? 1,
          fullDefenseSelectedAttribute:
            current?.defense === "full-defense" ? "selected" : "",
          noDefenseSelectedAttribute:
            !current || current.defense === "none" ? "selected" : "",
          partialDefenseSelectedAttribute:
            current?.defense === "partial-defense" ? "selected" : "",
          spentCheckedAttribute:
            (current?.spentActionCount ?? 0) > 0 ? "checked" : "",
        },
      );
      const selection =
        await foundry.applications.api.DialogV2.wait<FirstEditionActionSelection | null>(
          {
            buttons: [
              {
                action: "cancel",
                callback: () => null,
                label: game.i18n.localize("D6E2.Cancel"),
              },
              {
                action: "commit",
                callback: (_event, button) => {
                  const form = button.form;
                  if (!form) return null;
                  const data = new FormData(form);
                  const actionAllotment = Number(data.get("actionAllotment"));
                  const defenseEntry = data.get("defense");
                  const defense =
                    typeof defenseEntry === "string" ? defenseEntry : "";
                  const actions = Array.from(
                    form.querySelectorAll<HTMLElement>("[data-queue-row]"),
                  ).flatMap<FirstEditionQueuedActionSelection>((row) => {
                    const selected = row.querySelector<HTMLSelectElement>(
                      'select[name="actionSource"]',
                    )?.value;
                    const custom =
                      row
                        .querySelector<HTMLInputElement>(
                          'input[name="actionLabel"]',
                        )
                        ?.value.trim() ?? "";
                    if (selected?.includes(":")) {
                      const separator = selected.indexOf(":");
                      const kind = selected.slice(0, separator);
                      const sourceId = selected.slice(separator + 1);
                      const option = declarationOptions.find(
                        (candidate) =>
                          candidate.kind === kind &&
                          candidate.sourceId === sourceId,
                      );
                      return option
                        ? [
                            {
                              kind: option.kind,
                              label: option.label,
                              sourceId: option.sourceId,
                            },
                          ]
                        : [];
                    }
                    return custom
                      ? [{ kind: "other" as const, label: custom }]
                      : [];
                  });
                  const spentActionCount =
                    data.get("actionAlreadySpent") === "on" ? 1 : 0;
                  if (
                    !Number.isSafeInteger(actionAllotment) ||
                    actionAllotment < 1 ||
                    actions.length < 1 ||
                    !["none", "partial-defense", "full-defense"].includes(
                      defense,
                    ) ||
                    (defense === "full-defense" && actions.length !== 1)
                  ) {
                    return null;
                  }
                  return {
                    actions,
                    actionAllotment,
                    defense: defense as FirstEditionActionSelection["defense"],
                    plannedActionCount: actions.length,
                    spentActionCount,
                  };
                },
                class: "od6roll-submit",
                default: true,
                icon: "fa-solid fa-list-ol",
                label: game.i18n.localize(
                  "D6E2.Combat.FirstEdition.CommitQueue",
                ),
              },
            ],
            classes: [
              "d6e2",
              "od6roll-dialog",
              "d6e2-first-edition-actions-dialog",
            ],
            content,
            modal: true,
            rejectClose: false,
            render: (_event, dialog) => {
              const rows =
                dialog.element.querySelector<HTMLElement>("[data-queue-rows]");
              const add =
                dialog.element.querySelector<HTMLButtonElement>(
                  "[data-queue-add]",
                );
              const summary = dialog.element.querySelector<HTMLElement>(
                "[data-queue-summary]",
              );
              const validation =
                dialog.element.querySelector<HTMLElement>("[data-queue-error]");
              const allotment = dialog.element.querySelector<HTMLInputElement>(
                'input[name="actionAllotment"]',
              );
              const defense = dialog.element.querySelector<HTMLSelectElement>(
                'select[name="defense"]',
              );
              const commit = dialog.element.querySelector<HTMLButtonElement>(
                '[data-action="commit"]',
              );
              const initialRow =
                rows?.querySelector<HTMLElement>("[data-queue-row]");
              if (
                !rows ||
                !add ||
                !summary ||
                !validation ||
                !allotment ||
                !defense ||
                !commit ||
                !initialRow
              ) {
                return;
              }
              const populate = (select: HTMLSelectElement): void => {
                for (const group of actionGroups) {
                  if (!group.options.length) continue;
                  const optgroup = document.createElement("optgroup");
                  optgroup.label = group.label;
                  for (const source of group.options) {
                    const option = document.createElement("option");
                    option.value = source.value;
                    option.dataset.kind = source.kind;
                    option.dataset.score = String(source.score);
                    option.textContent = `${source.label} · ${source.scoreLabel}`;
                    optgroup.append(option);
                  }
                  select.append(optgroup);
                }
              };
              const createRow = (): HTMLElement => {
                const row = initialRow.cloneNode(true) as HTMLElement;
                const select = row.querySelector<HTMLSelectElement>(
                  'select[name="actionSource"]',
                );
                const input = row.querySelector<HTMLInputElement>(
                  'input[name="actionLabel"]',
                );
                const output =
                  row.querySelector<HTMLOutputElement>("[data-action-pool]");
                if (select) {
                  select.replaceChildren(
                    select.options[0]?.cloneNode(true) ?? "",
                  );
                  populate(select);
                  select.value = "";
                }
                if (input) input.value = "";
                if (output) output.textContent = "";
                return row;
              };
              const setRow = (
                row: HTMLElement,
                action: (typeof queued)[number],
              ): void => {
                const select = row.querySelector<HTMLSelectElement>(
                  'select[name="actionSource"]',
                );
                const input = row.querySelector<HTMLInputElement>(
                  'input[name="actionLabel"]',
                );
                if (!select || !input) return;
                if (action.sourceId) {
                  select.value = `${action.kind}:${action.sourceId}`;
                  input.value = "";
                } else {
                  select.value = "";
                  input.value = action.label;
                }
              };
              const initialSelect = initialRow.querySelector<HTMLSelectElement>(
                'select[name="actionSource"]',
              );
              if (initialSelect) populate(initialSelect);
              const firstQueuedAction = queued[0];
              if (firstQueuedAction) setRow(initialRow, firstQueuedAction);
              for (const action of queued.slice(1)) {
                const row = createRow();
                rows.append(row);
                setRow(row, action);
              }
              const synchronize = (): void => {
                const actionRows = Array.from(
                  rows.querySelectorAll<HTMLElement>("[data-queue-row]"),
                );
                const penalty =
                  Math.max(
                    0,
                    actionRows.length - Number(allotment.value || 1),
                  ) * 3;
                let invalid = actionRows.length < 1;
                actionRows.forEach((row, index) => {
                  const select = row.querySelector<HTMLSelectElement>(
                    'select[name="actionSource"]',
                  );
                  const input = row.querySelector<HTMLInputElement>(
                    'input[name="actionLabel"]',
                  );
                  const output =
                    row.querySelector<HTMLOutputElement>("[data-action-pool]");
                  const number = row.querySelector<HTMLElement>(
                    "[data-queue-number]",
                  );
                  if (number) number.textContent = String(index + 1);
                  const option = select?.selectedOptions[0];
                  const baseScore = Number(option?.dataset.score ?? "0");
                  const linked = Boolean(select?.value);
                  const legalPool = !linked || baseScore - penalty >= 3;
                  const hasAction = linked || Boolean(input?.value.trim());
                  if (input) input.disabled = linked;
                  if (output) {
                    output.textContent = linked
                      ? `${formatPipScore(baseScore)} → ${formatPipScore(Math.max(0, baseScore - penalty))}`
                      : "";
                  }
                  row.classList.toggle("is-invalid", !hasAction || !legalPool);
                  invalid ||= !hasAction || !legalPool;
                });
                if (
                  defense.value === "full-defense" &&
                  actionRows.length !== 1
                ) {
                  invalid = true;
                }
                summary.textContent = game.i18n.format(
                  "D6E2.Combat.FirstEdition.QueuePreview",
                  {
                    count: actionRows.length,
                    penalty:
                      penalty === 0 ? "0D" : `−${formatPipScore(penalty)}`,
                  },
                );
                validation.hidden = !invalid;
                validation.textContent = game.i18n.localize(
                  defense.value === "full-defense" && actionRows.length !== 1
                    ? "D6E2.Combat.FirstEdition.FullDefenseExclusive"
                    : "D6E2.Combat.Error.DeclarationPoolBelowOneDie",
                );
                commit.disabled = invalid;
              };
              add.addEventListener("click", () => {
                rows.append(createRow());
                synchronize();
              });
              rows.addEventListener("click", (event) => {
                const target = event.target;
                if (!(target instanceof Element)) return;
                const remove = target.closest("[data-queue-remove]");
                if (!remove) return;
                remove.closest("[data-queue-row]")?.remove();
                if (!rows.querySelector("[data-queue-row]")) {
                  rows.append(createRow());
                }
                synchronize();
              });
              dialog.element.addEventListener("input", synchronize);
              dialog.element.addEventListener("change", synchronize);
              synchronize();
            },
            window: {
              icon: "fa-solid fa-list-ol",
              title: game.i18n.localize("D6E2.Combat.FirstEdition.QueueTitle"),
            },
          },
        );
      if (!selection) return;
      try {
        await game.system.api?.combat.commitFirstEdition(this.actor, {
          ...selection,
          expectedRevision: state.revision,
        });
        this.render();
      } catch (error) {
        ui.notifications.warn(
          game.i18n.localize(
            error instanceof Error ? error.message : String(error),
          ),
        );
      }
      return;
    }
    const content = await foundry.applications.handlebars.renderTemplate(
      `systems/${SYSTEM_ID}/templates/actor/character/first-edition-actions.hbs`,
      {
        actionAllotment: current?.actionAllotment ?? 1,
        defense: current?.defense ?? "none",
        fullDefenseSelectedAttribute:
          current?.defense === "full-defense" ? "selected" : "",
        noDefenseSelectedAttribute:
          !current || current.defense === "none" ? "selected" : "",
        partialDefenseSelectedAttribute:
          current?.defense === "partial-defense" ? "selected" : "",
        plannedActionCount: current?.plannedActionCount ?? 1,
        spentCheckedAttribute:
          (current?.spentActionCount ?? 0) > 0 ? "checked" : "",
        spentActionCount: current?.spentActionCount ?? 0,
      },
    );
    const selection =
      await foundry.applications.api.DialogV2.wait<FirstEditionActionSelection | null>(
        {
          buttons: [
            {
              action: "cancel",
              callback: () => null,
              label: game.i18n.localize("D6E2.Cancel"),
            },
            {
              action: "commit",
              callback: (_event, button) => {
                const form = button.form;
                if (!form) return null;
                const data = new FormData(form);
                const plannedActionCount = Number(
                  data.get("plannedActionCount"),
                );
                const actionAllotment = Number(data.get("actionAllotment"));
                const defenseEntry = data.get("defense");
                const defense =
                  typeof defenseEntry === "string" ? defenseEntry : "";
                const actionAlreadySpent =
                  data.get("actionAlreadySpent") === "on";
                if (
                  !Number.isSafeInteger(plannedActionCount) ||
                  plannedActionCount < 1 ||
                  !Number.isSafeInteger(actionAllotment) ||
                  actionAllotment < 1 ||
                  !["none", "partial-defense", "full-defense"].includes(
                    defense,
                  ) ||
                  (defense === "full-defense" && plannedActionCount !== 1)
                ) {
                  return null;
                }
                return {
                  actionAllotment,
                  defense: defense as FirstEditionActionSelection["defense"],
                  plannedActionCount,
                  spentActionCount: actionAlreadySpent ? 1 : 0,
                };
              },
              class: "od6roll-submit",
              default: true,
              icon: "fa-solid fa-layer-group",
              label: game.i18n.localize("D6E2.Combat.FirstEdition.Commit"),
            },
          ],
          classes: [
            "d6e2",
            "od6roll-dialog",
            "d6e2-first-edition-actions-dialog",
          ],
          content,
          modal: true,
          rejectClose: false,
          render: (_event, dialog) => {
            const defense = dialog.element.querySelector<HTMLSelectElement>(
              'select[name="defense"]',
            );
            const planned = dialog.element.querySelector<HTMLInputElement>(
              'input[name="plannedActionCount"]',
            );
            if (!defense || !planned) return;
            const synchronize = (): void => {
              if (defense.value === "full-defense") {
                planned.value = "1";
                planned.readOnly = true;
              } else {
                planned.readOnly = false;
              }
            };
            defense.addEventListener("change", synchronize);
            synchronize();
          },
          window: {
            icon: "fa-solid fa-layer-group",
            title: game.i18n.localize("D6E2.Combat.FirstEdition.CommitTitle"),
          },
        },
      );
    if (!selection) return;
    try {
      await game.system.api?.combat.commitFirstEdition(this.actor, {
        ...selection,
        expectedRevision: state.revision,
      });
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };

  static readonly #spendFirstEditionAction = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    const state = game.system.api?.combat.read(this.actor);
    if (!state) return;
    try {
      await game.system.api?.combat.spendFirstEdition(
        this.actor,
        state.revision,
      );
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };

  static readonly #resetCombatActions = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    const state = game.system.api?.combat.read(this.actor);
    if (!state) return;
    try {
      await game.system.api?.combat.reset(this.actor, state.revision);
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };

  static readonly #setCondition = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.isEditable) return;
    const condition =
      target.closest<HTMLElement>("[data-condition]")?.dataset.condition;
    if (!condition) return;
    const health = readActorHealth(this.actor);
    const track = health.track;
    const currentStateId = track?.currentStateId;
    if (!currentStateId || !track.states.some(({ id }) => id === condition))
      return;
    const heroPoints = actorHeroPointBalance(this.actor);
    const mayPrevent =
      health.damageStrategyId === "d6e2.damage.conditions" &&
      isSecondEditionCondition(currentStateId) &&
      isSecondEditionCondition(condition) &&
      currentMetaCurrencyRuntimeStrategy().preventStunned &&
      heroPoints > 0 &&
      canPreventBecomingStunned(currentStateId, condition);
    const stunnedChoice = mayPrevent
      ? await promptStunnedPrevention()
      : "accept";
    if (stunnedChoice === null) return;
    const result = await setActorHealthTrack(this.actor, condition, {
      preventStunnedWithHeroPoint: stunnedChoice === "prevent",
    });
    if (result.prevented) {
      ui.notifications.info(
        game.i18n.format("D6E2.Condition.StunnedPrevented", {
          condition: terminologyConditionLabel(currentTerminology(), "stunned"),
        }),
      );
    }
    this.render();
  };

  static readonly #generateBodyPoints = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    if (
      !this.isEditable ||
      actorHealthResolutionStrategy(this.actor).family !== "body-points"
    )
      return;
    const current = readActorHealth(this.actor).pool;
    if (!current) return;
    if (current.maximum > 0) {
      const confirmed = await foundry.applications.api.DialogV2.wait<boolean>({
        buttons: [
          {
            action: "cancel",
            callback: () => false,
            label: game.i18n.localize("D6E2.Cancel"),
          },
          {
            action: "replace",
            callback: () => true,
            class: "od6roll-submit",
            default: true,
            label: game.i18n.localize(
              "D6E2.Combat.FirstEdition.BodyPoints.Replace",
            ),
          },
        ],
        classes: ["d6e2", "od6roll-dialog"],
        content: `<div class="od6-dialog-shell"><p>${game.i18n.localize(
          "D6E2.Combat.FirstEdition.BodyPoints.ReplaceHelp",
        )}</p></div>`,
        modal: true,
        rejectClose: false,
        window: {
          title: game.i18n.localize(
            "D6E2.Combat.FirstEdition.BodyPoints.Generate",
          ),
        },
      });
      if (confirmed !== true) return;
    }
    const score = currentEffectivePipScore(
      integer(
        record(
          record(this.actor.system.attributes)[
            currentAttributeRole("strength")
          ],
        ).score,
      ),
    );
    const code = dieCodeFromPipScore(score);
    const pip =
      code.pips === 0
        ? ""
        : code.pips > 0
          ? `+${code.pips}`
          : String(code.pips);
    const roll = await new Roll(`${code.dice}d6${pip}`).evaluate();
    const maximum = firstEditionBodyPointMaximum(roll.total);
    await setActorHealthPool(this.actor, {
      current: maximum,
      maximum,
    });
    await ChatMessage.create({
      content: `<div class="od6chat-roll"><strong>${game.i18n.localize(
        "D6E2.Combat.FirstEdition.BodyPoints.Generated",
      )}</strong><span>${maximum} · ${currentFirstEditionGenreProfile().label}</span></div>`,
      flags: {
        [SYSTEM_ID]: {
          bodyPointsMaximum: maximum,
          kind: "firstEditionBodyPointMaximum",
          sourcePage: 14,
          version: 1,
        },
      },
      rolls: [roll],
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    });
    this.render();
  };

  static readonly #resolveNaturalHealing = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    if (!this.isEditable) return;
    if (actorHealthResolutionStrategy(this.actor).family === "body-points") {
      const modifier = await promptBodyPointRestModifier();
      if (modifier === null) return;
      const result = await resolveFirstEditionBodyPointNaturalHealing(
        this.actor,
        modifier,
      );
      if (!result) return;
      ui.notifications.info(
        game.i18n.format("D6E2.Combat.FirstEdition.BodyPoints.Recovered", {
          current: result.current,
          maximum: result.maximum,
          recovered: result.recovered,
        }),
      );
      this.render();
      return;
    }
    const health = record(this.actor.system.health);
    const wound = isFirstEditionWoundLevel(health.firstEditionWound)
      ? health.firstEditionWound
      : "healthy";
    const rule = firstEditionNaturalHealingRule(wound);
    if (!rule) return;
    const restLabel = game.i18n.format(
      `D6E2.Combat.FirstEdition.Healing.Rest.${rule.restUnit}`,
      { amount: rule.restAmount },
    );
    if (!(await confirmFirstEditionNaturalHealing(restLabel))) return;
    const result = await resolveFirstEditionNaturalHealing(this.actor);
    if (!result) return;
    ui.notifications.info(
      game.i18n.localize(
        `D6E2.Combat.FirstEdition.Healing.Outcome.${result.outcome}`,
      ),
    );
    this.render();
  };

  static readonly #resolveAssistedHealing = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    if (!this.isEditable) return;
    const selection = await promptMedicineHealer();
    if (!selection) return;
    const healer = game.actors?.get(selection.actorId);
    if (!healer) return;
    const bodyPointMode =
      actorHealthResolutionStrategy(this.actor).family === "body-points";
    const result = bodyPointMode
      ? await resolveFirstEditionBodyPointAssistedHealing(
          this.actor,
          healer,
          selection.itemId,
        )
      : await resolveFirstEditionAssistedHealing(
          this.actor,
          healer,
          selection.itemId,
        );
    if (!result) return;
    ui.notifications.info(
      bodyPointMode
        ? "rescue" in result && result.rescue === "dead"
          ? game.i18n.localize("D6E2.Combat.FirstEdition.BodyPoints.RescueDead")
          : game.i18n.format("D6E2.Combat.FirstEdition.BodyPoints.Recovered", {
              current: "current" in result ? result.current : 0,
              maximum: "maximum" in result ? result.maximum : 0,
              recovered: "recovered" in result ? result.recovered : 0,
            })
        : game.i18n.localize(
            `D6E2.Combat.FirstEdition.Healing.Outcome.${"outcome" in result ? result.outcome : "unchanged"}`,
          ),
    );
    this.render();
  };

  static readonly #resolveMortalityCheck = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    if (!this.isEditable) return;
    const minutes = await promptMortallyWoundedMinutes();
    if (minutes === null) return;
    const result = await resolveFirstEditionMortalityCheck(this.actor, minutes);
    if (!result) return;
    ui.notifications.info(
      game.i18n.localize(
        `D6E2.Combat.FirstEdition.Healing.Mortality.${result}`,
      ),
    );
    this.render();
  };

  static readonly #resolveIncapacitationCheck = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    if (!this.isEditable) return;
    const skill = await promptFirstEditionIncapacitationSkill();
    if (!skill) return;
    const result = await resolveFirstEditionIncapacitation(this.actor, skill);
    if (!result) return;
    ui.notifications.info(
      game.i18n.localize(
        result.consciousness === "conscious"
          ? "D6E2.Combat.FirstEdition.Consciousness.StayedConscious"
          : "D6E2.Combat.FirstEdition.Consciousness.FellUnconscious",
      ),
    );
    this.render();
  };

  static readonly #clearUnconsciousness = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    if (!this.isEditable) return;
    await clearFirstEditionUnconsciousness(this.actor);
    this.render();
  };

  static readonly #clearAccumulatingStuns = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    if (!this.isEditable || !(await confirmFirstEditionStunRest())) return;
    await clearActorFirstEditionAccumulatingStuns(this.actor);
    this.render();
  };

  static readonly #setPosture = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.isEditable) return;
    const posture =
      target.closest<HTMLElement>("[data-posture]")?.dataset.posture;
    if (posture !== "standing" && posture !== "prone") return;
    await game.system.api?.health.posture(this.actor, posture);
    this.render();
  };

  static readonly #toggleEquipped = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.isEditable) return;
    const itemId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    const item = itemId ? this.actor.items.get(itemId) : undefined;
    if (!item || !(target instanceof HTMLInputElement)) return;
    await item.update({ "system.equipped": target.checked });
    this.render();
  };

  static readonly #synchronizeSkills = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    const added = await synchronizeActorSkills(this.actor);
    ui.notifications.info(
      game.i18n.format("D6E2.SkillCatalog.Synchronized", { count: added }),
    );
    if (added > 0) this.render();
  };

  static readonly #adjustCreationAttribute = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const attributeId = target.closest<HTMLElement>("[data-attribute-id]")
      ?.dataset.attributeId;
    const direction = target.dataset.direction === "decrease" ? -1 : 1;
    if (!attributeId) return;
    try {
      await adjustCreationAttribute(this.actor, attributeId, direction);
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };

  static readonly #adjustCreationSkill = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const itemId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    const direction = target.dataset.direction === "decrease" ? -1 : 1;
    if (!itemId) return;
    try {
      await adjustCreationSkill(this.actor, itemId, direction);
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };

  static readonly #setCreationSpecializationAllocation = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    try {
      await setCreationSpecializationAllocation(
        this.actor,
        target.dataset.direction !== "return",
      );
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };

  static readonly #createCreationSpecialization = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const itemId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    if (!itemId) return;
    try {
      const parent = this.actor.items.get(itemId);
      if (parent?.type !== "skill") return;
      const name = await promptSkillName({
        actionLabel: game.i18n.localize("D6E2.Creation.AddSpecialization"),
        fieldLabel: game.i18n.localize("D6E2.Creation.SpecializationName"),
        help: game.i18n.format("D6E2.Creation.SpecializationNameHelp", {
          skill: htmlEscape(parent.name),
        }),
        icon: "fa-solid fa-crosshairs",
        title: game.i18n.localize("D6E2.Creation.AddSpecialization"),
      });
      if (name === null) return;
      const created = await createCreationSpecialization(
        this.actor,
        itemId,
        name,
      );
      this.render();
      created?.sheet.render(true);
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };

  static readonly #createCreationAdvancedSkill = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    try {
      const definition = await promptAdvancedSkillDefinition(this.actor);
      if (definition === null) return;
      const created = await createCreationAdvancedSkill(
        this.actor,
        definition.name,
        definition.prerequisiteSkillKeys,
      );
      this.render();
      created?.sheet.render(true);
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };

  static readonly #createSkillChild = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.isEditable || game.user?.isGM !== true) return;
    const parentSkillId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    const parent = parentSkillId
      ? this.actor.items.get(parentSkillId)
      : undefined;
    if (parent?.type !== "skill" || parent.system.training !== "standard") {
      return;
    }
    try {
      const kind = await promptSkillChildKind(parent.name);
      if (kind === null) return;
      let created: FoundryItemDocument | undefined;
      if (kind === "specialization") {
        const name = await promptSkillName({
          actionLabel: game.i18n.localize("D6E2.Creation.AddSpecialization"),
          fieldLabel: game.i18n.localize("D6E2.Creation.SpecializationName"),
          help: game.i18n.format("D6E2.Creation.SpecializationNameHelp", {
            skill: htmlEscape(parent.name),
          }),
          icon: "fa-solid fa-crosshairs",
          title: game.i18n.localize("D6E2.Creation.AddSpecialization"),
        });
        if (name === null) return;
        created = await createFreeEditSpecialization(
          this.actor,
          parent.id,
          name,
        );
      } else {
        const definition = await promptAdvancedSkillDefinition(
          this.actor,
          stringValue(parent.system.key),
        );
        if (definition === null) return;
        created = await createFreeEditAdvancedSkill(
          this.actor,
          definition.name,
          definition.prerequisiteSkillKeys,
        );
      }
      this.render();
      created?.sheet.render(true);
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };

  static readonly #finalizeCharacterCreation = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    try {
      await finalizeCharacterCreation(this.actor);
      ui.notifications.info(game.i18n.localize("D6E2.Creation.Finalized"));
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };

  static readonly #applyCharacterTemplate = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    const api = game.system.api;
    if (!api?.capabilities.has("creation.template")) return;
    synchronizeWorldCharacterTemplates();
    const previews = api.templates
      .current()
      .flatMap((catalog) =>
        catalog.templates.map((template) =>
          api.characterTemplates.preview(this.actor, template.id),
        ),
      );
    if (previews.length === 0) {
      ui.notifications.info(game.i18n.localize("D6E2.Template.NoneAvailable"));
      return;
    }
    const templateId = await promptCharacterTemplate(previews);
    if (!templateId) return;
    try {
      await api.characterTemplates.apply(this.actor, templateId);
      ui.notifications.info(game.i18n.localize("D6E2.Template.Applied"));
      this.render();
    } catch (error) {
      const key =
        error instanceof Error ? error.message : "D6E2.Template.Error";
      ui.notifications.warn(game.i18n.localize(key));
    }
  };

  static readonly #createCharacterTemplate = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    try {
      await createCharacterTemplateFromActor(this.actor);
      ui.notifications.info(game.i18n.localize("D6E2.Template.Created"));
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : "D6E2.Template.Error",
        ),
      );
    }
  };

  static readonly #advanceAttribute = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.isEditable) return;
    const attributeId = target.closest<HTMLElement>("[data-attribute-id]")
      ?.dataset.attributeId;
    if (!attributeId) return;
    const plan = attributeAdvancementPlan(this.actor, attributeId);
    const label =
      target.closest<HTMLElement>("[data-label]")?.dataset.label ?? attributeId;
    if (
      !(await confirmAdvancement(
        label,
        plan.cost,
        advancementPlanResourceLabel(plan.resource),
        game.i18n.localize(
          plan.nextScore - plan.currentScore === 1
            ? "D6E2.Advancement.OnePip"
            : "D6E2.Advancement.OneDie",
        ),
      ))
    )
      return;
    try {
      await advanceAttribute(this.actor, attributeId);
      this.render();
    } catch (error) {
      const key = error instanceof Error ? error.message : String(error);
      ui.notifications.warn(game.i18n.localize(key));
    }
  };

  static readonly #advanceItem = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.isEditable) return;
    const itemId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    const item = itemId ? this.actor.items.get(itemId) : undefined;
    if (!item) return;
    const plan = itemAdvancementPlan(this.actor, item);
    if (
      !(await confirmAdvancement(
        item.name,
        plan.cost,
        advancementPlanResourceLabel(plan.resource),
        game.i18n.localize(
          plan.nextScore - plan.currentScore === 1
            ? "D6E2.Advancement.OnePip"
            : "D6E2.Advancement.OneDie",
        ),
      ))
    )
      return;
    try {
      await advanceItem(this.actor, item.id);
      this.render();
    } catch (error) {
      const key = error instanceof Error ? error.message : String(error);
      ui.notifications.warn(game.i18n.localize(key));
    }
  };

  static readonly #acquireSpecialization = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.isEditable) return;
    const parentSkillId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    const parent = parentSkillId
      ? this.actor.items.get(parentSkillId)
      : undefined;
    if (!parent) return;
    const plan = specializationAcquisitionPlan(this.actor, parent);
    const name = await promptSpecializationAcquisition(parent.name, plan);
    if (name === null) return;
    try {
      await acquireSpecialization(this.actor, parent.id, name);
      this.render();
    } catch (error) {
      const key = error instanceof Error ? error.message : String(error);
      ui.notifications.warn(game.i18n.localize(key));
    }
  };

  static readonly #awardMilestone = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    try {
      await awardMilestone(this.actor);
      ui.notifications.info(
        game.i18n.localize("D6E2.Advancement.MilestoneAwarded"),
      );
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };

  static readonly #exchangeMilestonePerk = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    const selection = await promptMilestonePerk(this.actor);
    if (selection === null) return;
    try {
      await exchangeMilestoneForPerk(
        this.actor,
        selection.perkId,
        selection.name,
      );
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };

  static readonly #proposeNarrativeArc = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    const definition = await promptNarrativeArcDefinition(this.actor);
    if (definition === null) return;
    try {
      await proposeNarrativeArc(this.actor, definition);
      this.render();
    } catch (error) {
      ui.notifications.warn(
        error instanceof Error &&
          error.message === "D6E2.Advancement.NarrativeStepCount"
          ? game.i18n.localize(error.message)
          : game.i18n.localize(
              error instanceof Error ? error.message : String(error),
            ),
      );
    }
  };

  static readonly #approveNarrativeArc = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const arcId = target.closest<HTMLElement>("[data-arc-id]")?.dataset.arcId;
    if (!arcId) return;
    try {
      await approveNarrativeArc(this.actor, arcId);
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };

  static readonly #toggleNarrativeStep = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const arc = target.closest<HTMLElement>("[data-arc-id]");
    const stepId =
      target.closest<HTMLElement>("[data-step-id]")?.dataset.stepId;
    if (!arc?.dataset.arcId || !stepId) return;
    try {
      await toggleNarrativeArcStep(this.actor, arc.dataset.arcId, stepId);
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };

  static readonly #completeNarrativeArc = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const arcId = target.closest<HTMLElement>("[data-arc-id]")?.dataset.arcId;
    if (!arcId) return;
    try {
      await completeNarrativeArc(this.actor, arcId);
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };

  static readonly #removeNarrativeArc = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const arcId = target.closest<HTMLElement>("[data-arc-id]")?.dataset.arcId;
    if (!arcId) return;
    try {
      await removeNarrativeArc(this.actor, arcId);
      this.render();
    } catch (error) {
      ui.notifications.warn(
        game.i18n.localize(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  };

  static readonly #submitSheet = async function (
    this: D6System2eCharacterSheet,
    _event: SubmitEvent,
    _form: HTMLFormElement,
    formData: FoundryFormData,
  ): Promise<void> {
    await this.actor.update(formData.object);
  };

  static readonly #openSkillTree = function (
    this: D6System2eCharacterSheet,
  ): void {
    const module = foundryModule("skill-tree");
    const api = module?.API;
    const SkillTreeActor = api?.apps?.SkillTreeActor;
    if (module?.active !== true || !SkillTreeActor) {
      ui.notifications.warn(game.i18n.localize("D6E2.SkillTree.Unavailable"));
      return;
    }
    new SkillTreeActor(this.actor).render(true);
  };

  static readonly #selectPowerWorkspace = function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): void {
    this.#powerWorkspace =
      target.dataset.powerWorkspace === "powers" ? "powers" : "skills";
    this.render();
  };

  static readonly #selectTabFamily = function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): void {
    const familyId = target.dataset.tabFamily as
      SheetTabFamily["id"] | undefined;
    if (!familyId) return;
    const tabs = this.#tabs();
    const family = this.#tabFamilies(tabs).find(({ id }) => id === familyId);
    const nextTab = this.#lastFamilyTab[familyId];
    if (!family?.tabs.some(({ id }) => id === nextTab)) return;
    this.tabGroups.primary = nextTab;
    this.render();
  };

  static readonly #recoverMagicPoints = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    try {
      await recoverActorMagicPoints(this.actor, 1);
      await this.render();
    } catch (error) {
      const key = error instanceof Error ? error.message : String(error);
      ui.notifications.warn(game.i18n.localize(key));
    }
  };

  readonly #queuePersistChange = (operation: () => Promise<unknown>): void => {
    this.#persistChangeQueue = this.#persistChangeQueue
      .then(async () => {
        await operation();
      })
      .catch((error: unknown) => {
        const key = error instanceof Error ? error.message : String(error);
        ui.notifications.warn(
          key.startsWith("D6E2.") ? game.i18n.localize(key) : key,
        );
      });
  };

  readonly #persistChange = (event: Event): void => {
    const input = event.target;
    if (
      !(input instanceof HTMLInputElement) &&
      !(input instanceof HTMLSelectElement) &&
      !(input instanceof HTMLTextAreaElement)
    ) {
      return;
    }

    if (input.name === "system.sheetMode.value") {
      const isGM = game.user?.isGM === true;
      if (!maySelectCharacterSheetMode(input.value, isGM)) {
        input.value = "normal";
        this.#queuePersistChange(() =>
          this.actor.update({ "system.sheetMode.value": "normal" }),
        );
        return;
      }
      const value = input.value;
      this.#queuePersistChange(() =>
        this.actor.update({ "system.sheetMode.value": value }),
      );
      return;
    }

    const itemRow = input.closest<HTMLElement>("[data-item-id]");
    const itemField = input.dataset.itemField;
    if (itemRow && itemField) {
      const storedMode = record(this.actor.system.sheetMode).value;
      if (
        !this.isEditable ||
        !mayDirectEditMechanicalScore(storedMode, game.user?.isGM === true)
      ) {
        return;
      }
      const itemId = itemRow.dataset.itemId;
      const item = itemId ? this.actor.items.get(itemId) : undefined;
      if (!item) return;
      const value =
        input instanceof HTMLInputElement && input.type === "number"
          ? input.valueAsNumber
          : input.value;
      this.#queuePersistChange(() => item.update({ [itemField]: value }));
      return;
    }

    if (!input.name || !this.isEditable) return;
    const value =
      input instanceof HTMLInputElement && input.type === "checkbox"
        ? input.checked
        : input instanceof HTMLInputElement && input.type === "number"
          ? input.valueAsNumber
          : input.value;
    if (
      input.name === "system.health.firstEditionBodyPoints.current" ||
      input.name === "system.health.firstEditionBodyPoints.maximum"
    ) {
      const current = readActorHealth(this.actor).pool;
      if (!current) return;
      const pool = {
        current: input.name.endsWith(".current")
          ? Number(value)
          : current.current,
        maximum: input.name.endsWith(".maximum")
          ? Number(value)
          : current.maximum,
      };
      this.#queuePersistChange(async () => {
        await setActorHealthPool(this.actor, pool);
        await this.render();
      });
      return;
    }
    const name = input.name;
    this.#queuePersistChange(() => this.actor.update({ [name]: value }));
  };

  readonly #persistDirectResourceInput = (event: Event): void => {
    const input = event.target;
    if (
      !(input instanceof HTMLInputElement) ||
      game.user?.isGM !== true ||
      !this.isEditable ||
      (input.name !== "system.profile.currency" &&
        !/^system\.resources\.[^.]+\.value$/.test(input.name))
    ) {
      return;
    }
    this.#persistChange(event);
  };

  static DEFAULT_OPTIONS = {
    actions: {
      addToCreatureCatalog: this.#addToCreatureCatalog,
      adjustCreationAttribute: this.#adjustCreationAttribute,
      adjustCreationSkill: this.#adjustCreationSkill,
      setCreationSpecializationAllocation:
        this.#setCreationSpecializationAllocation,
      acquireSpecialization: this.#acquireSpecialization,
      approveNarrativeArc: this.#approveNarrativeArc,
      advanceAttribute: this.#advanceAttribute,
      advanceItem: this.#advanceItem,
      awardMilestone: this.#awardMilestone,
      completeNarrativeArc: this.#completeNarrativeArc,
      createCreationSpecialization: this.#createCreationSpecialization,
      createCreationAdvancedSkill: this.#createCreationAdvancedSkill,
      createSkillChild: this.#createSkillChild,
      createItem: this.#createItem,
      declareCombatActions: this.#declareCombatActions,
      deleteItem: this.#deleteItem,
      editImage: this.#editImage,
      editItem: this.#editItem,
      applyCharacterTemplate: this.#applyCharacterTemplate,
      createCharacterTemplate: this.#createCharacterTemplate,
      finalizeCharacterCreation: this.#finalizeCharacterCreation,
      generateBodyPoints: this.#generateBodyPoints,
      exchangeMilestonePerk: this.#exchangeMilestonePerk,
      invokeFeature: this.#invokeFeature,
      hackCyberpunkTarget: this.#hackCyberpunkTarget,
      hardenFirewall: this.#hardenFirewall,
      reinforceSecretIdentity: this.#reinforceSecretIdentity,
      spendSecretIdentityPoint: this.#spendSecretIdentityPoint,
      addSecretIdentitySuspicion: this.#addSecretIdentitySuspicion,
      takeSecretIdentityClue: this.#takeSecretIdentityClue,
      clearSecretIdentity: this.#clearSecretIdentity,
      makeIdentityPublic: this.#makeIdentityPublic,
      beginNemesisEncounter: this.#beginNemesisEncounter,
      saveSuperheroicRelationships: this.#saveSuperheroicRelationships,
      resetSuperheroicRelationships: this.#resetSuperheroicRelationships,
      recoverCompanionHeroPoint: this.#recoverCompanionHeroPoint,
      resolveNemesisDefeat: this.#resolveNemesisDefeat,
      addSuperheroicAction: this.#addSuperheroicAction,
      transferSuperheroicHeroPoint: this.#transferSuperheroicHeroPoint,
      boostSuperheroicTalent: this.#boostSuperheroicTalent,
      relyOnSuperpower: this.#relyOnSuperpower,
      useGadget: this.#useGadget,
      useGearPower: this.#useGearPower,
      setSuperheroicEquipmentState: this.#setSuperheroicEquipmentState,
      installCybernetic: this.#installCybernetic,
      completeCombatAction: this.#completeCombatAction,
      enterSecondEditionFullDefense: this.#enterSecondEditionFullDefense,
      recordSecondEditionFeint: this.#recordSecondEditionFeint,
      commitFirstEditionActions: this.#commitFirstEditionActions,
      rollAttribute: this.#rollAttribute,
      rollCombatItem: this.#rollCombatItem,
      rollCombatItemDamage: this.#rollCombatItemDamage,
      rollFirstEditionDefense: this.#rollFirstEditionDefense,
      clearUnconsciousness: this.#clearUnconsciousness,
      clearAccumulatingStuns: this.#clearAccumulatingStuns,
      resolveAssistedHealing: this.#resolveAssistedHealing,
      resolveMortalityCheck: this.#resolveMortalityCheck,
      resolveNaturalHealing: this.#resolveNaturalHealing,
      resolveIncapacitationCheck: this.#resolveIncapacitationCheck,
      planFirstEditionMovement: this.#planFirstEditionMovement,
      moveSecondEditionToken: this.#moveSecondEditionToken,
      openSkillTree: this.#openSkillTree,
      rollResistance: this.#rollResistance,
      rollLinkedAdvancedSkill: this.#rollLinkedAdvancedSkill,
      rollSkill: this.#rollSkill,
      rollPsionicPower: this.#rollPsionicPower,
      saveExtraordinarySkillBinding: this.#saveExtraordinarySkillBinding,
      selectPowerWorkspace: this.#selectPowerWorkspace,
      selectTabFamily: this.#selectTabFamily,
      saveExtraordinaryPowerBinding: this.#saveExtraordinaryPowerBinding,
      activateExtraordinaryPower: this.#activateExtraordinaryPower,
      deactivateExtraordinaryPower: this.#deactivateExtraordinaryPower,
      setExtraordinaryConsequence: this.#setExtraordinaryConsequence,
      setCondition: this.#setCondition,
      setPosture: this.#setPosture,
      resetCombatActions: this.#resetCombatActions,
      spendFirstEditionAction: this.#spendFirstEditionAction,
      resetFeatureSession: this.#resetFeatureSession,
      recoverMagicPoints: this.#recoverMagicPoints,
      proposeNarrativeArc: this.#proposeNarrativeArc,
      removeNarrativeArc: this.#removeNarrativeArc,
      synchronizeSkills: this.#synchronizeSkills,
      trainPsionics: this.#trainPsionics,
      toggleEquipped: this.#toggleEquipped,
      spendCurrency: this.#spendCurrency,
      transferCurrency: this.#transferCurrency,
      transferEquipment: this.#transferEquipment,
      toggleNarrativeStep: this.#toggleNarrativeStep,
    },
    classes: ["d6e2", "d6e2-character-v2", "od6s-character-v2"],
    form: {
      closeOnSubmit: false,
      handler: this.#submitSheet,
      submitOnChange: false,
      // Every editable field is persisted by #persistChange. Submitting the
      // entire rendered form during a mode-triggered rerender can replay stale
      // resource balances over a newer point edit.
      submitOnClose: false,
    },
    position: {
      height: 820,
      width: 980,
    },
    tag: "form",
    window: {
      icon: "fa-solid fa-dice-d6",
      resizable: true,
    },
  };

  _prepareContext(): Promise<CharacterSheetContext> {
    const system = record(this.actor.system);
    const attributes = record(system.attributes);
    const storedSheetMode = record(system.sheetMode).value;
    const isGM = game.user?.isGM === true;
    const canDirectEditResources = isGM && this.isEditable;
    const sheetMode = effectiveCharacterSheetMode(storedSheetMode, isGM);
    const rulesProfile = currentConfiguredRulesProfile();
    const attributeStrategy = currentAttributeRuntimeStrategy();
    const firstEditionGenreProfile = currentFirstEditionGenreProfile();
    const optionalCapabilities = currentOptionalCapabilityRuntime();
    const defenseStrategy = currentDefenseRuntimeStrategy();
    const movementStrategy = currentMovementRuntimeStrategy();
    const terminology = currentTerminology();
    const currencyTransactionsEnabled = characterCurrencyTransactionsEnabled();
    const equipmentTransfersEnabled = characterEquipmentTransfersEnabled();
    const transferRecipients =
      currencyTransactionsEnabled || equipmentTransfersEnabled
        ? economyRecipients(this.actor)
        : [];
    const resources = record(system.resources);
    const heroPoints = record(resources.heroPoints);
    const characterPoints = record(resources.characterPoints);
    const fatePoints = record(resources.fatePoints);
    const experiencePoints = record(resources.experiencePoints);
    const metaCurrencyStrategy = currentMetaCurrencyRuntimeStrategy();
    const heroPointStrategy =
      metaCurrencyStrategy.heroPointStrategy ?? "heroic";
    const classicHeroPoints = heroPointStrategy === "classic";
    const advancementStrategy = currentAdvancementRuntimeStrategy();
    const advancementUsesExperiencePoints =
      advancementStrategy.family === "experience-points";
    const milestoneAdvancement =
      advancementStrategy.family === "milestone" && sheetMode === "advance";
    const narrativeAdvancement =
      advancementStrategy.family === "narrative" && sheetMode === "advance";
    const milestoneBalance = readMilestoneBalance(this.actor);
    const narrativeArcs = readNarrativeArcs(this.actor).map((arc) => {
      const completedSteps = arc.steps.filter((step) => step.complete).length;
      return Object.freeze({
        ...arc,
        canApprove: isGM && arc.status === "draft",
        canComplete:
          isGM &&
          arc.status === "approved" &&
          completedSteps === arc.steps.length,
        canRemove: arc.status !== "approved" || isGM,
        canToggle: arc.status === "approved",
        completedSteps,
        steps: arc.steps.map((step) =>
          Object.freeze({
            ...step,
            cssClass: step.complete ? "is-complete" : "",
            icon: step.complete ? "fa-check" : "fa-circle",
          }),
        ),
        statusLabel: game.i18n.localize(
          arc.status === "draft"
            ? "D6E2.Advancement.NarrativeDraft"
            : arc.status === "approved"
              ? "D6E2.Advancement.NarrativeApproved"
              : "D6E2.Advancement.NarrativeCompleted",
        ),
        targetScoreLabel:
          arc.rewardKind === "perk"
            ? `R${arc.targetScore}`
            : formatPipScore(arc.targetScore),
      });
    });
    const availableAdvancementResource = advancementUsesExperiencePoints
      ? integer(experiencePoints.value)
      : integer(characterPoints.value);
    const advancementEnabled =
      sheetMode === "advance" &&
      advancementStrategy.progression !== "unavailable";
    const creation = characterCreationProgress(this.actor);
    const storedTemplate = record(record(system.creation).template);
    const storedBestiary = record(system.bestiary);
    const bestiaryProvenance =
      this.actor.type === "creature" && storedBestiary.applied === true
        ? Object.freeze({
            catalogId: stringValue(storedBestiary.catalogId),
            entryId: stringValue(storedBestiary.entryId),
            label: stringValue(storedBestiary.label),
            ownerId: stringValue(storedBestiary.ownerId),
            sourceBook: stringValue(storedBestiary.sourceBook),
            sourcePage: integer(storedBestiary.sourcePage),
            version: integer(storedBestiary.version),
          })
        : null;
    synchronizeWorldCharacterTemplates();
    const templateCatalogs = game.system.api?.templates.current() ?? [];
    const templatePreviews = templateCatalogs
      .flatMap((catalog) =>
        catalog.templates.map((template) =>
          game.system.api?.characterTemplates.preview(this.actor, template.id),
        ),
      )
      .filter(
        (preview): preview is D6CharacterTemplatePreviewV1 =>
          preview !== undefined,
      );
    const appliedTemplateSkillNames = Array.isArray(
      storedTemplate.suggestedSkillKeys,
    )
      ? storedTemplate.suggestedSkillKeys.flatMap((key) => {
          if (typeof key !== "string") return [];
          const skill = this.actor.items.contents.find(
            (item) =>
              item.type === "skill" && stringValue(item.system.key) === key,
          );
          return skill ? [skill.name] : [];
        })
      : [];
    const compatibleTemplatePreviews = templatePreviews.filter(
      (preview) => !preview.issues.includes("rules-family"),
    );
    const characterTemplate = Object.freeze({
      applied: storedTemplate.applied === true,
      availableCount: compatibleTemplatePreviews.length,
      canApply:
        storedTemplate.applied !== true &&
        compatibleTemplatePreviews.length > 0,
      canCreate: this.actor.isOwner === true || game.user?.isGM === true,
      label: stringValue(storedTemplate.label),
      sourceBook: stringValue(storedTemplate.sourceBook),
      sourcePage: integer(storedTemplate.sourcePage),
      superpowerCreationDice: integer(storedTemplate.superpowerCreationDice),
      suggestedSkillNames: Object.freeze(appliedTemplateSkillNames),
    });
    const featureSession = game.system.api?.features.read(this.actor);
    const campaignProfile = currentSecondEditionCampaignProfile();
    const magicPointResource = campaignProfile.magicPointsCasting
      ? actorMagicPointPool(this.actor)
      : null;

    const mechanicalDocuments = this.actor.items.contents
      .filter((item) => ["skill", "specialization"].includes(item.type))
      .map((item) => {
        return {
          attributeId:
            typeof item.system.attributeId === "string"
              ? item.system.attributeId
              : "",
          description: item.system.description,
          id: item.id,
          key: stringValue(item.system.key),
          name: item.name,
          parentSkillId:
            typeof item.system.parentSkillId === "string"
              ? item.system.parentSkillId
              : "",
          parentSkillKey:
            typeof item.system.parentSkillKey === "string"
              ? item.system.parentSkillKey
              : "",
          score: integer(item.system.score),
          prerequisiteSkillKeys: Array.isArray(
            item.system.prerequisiteSkillKeys,
          )
            ? item.system.prerequisiteSkillKeys.filter(
                (key): key is string =>
                  typeof key === "string" && key.length > 0,
              )
            : [],
          training:
            item.type === "specialization"
              ? ("specialization" as const)
              : item.system.training === "advanced"
                ? ("advanced" as const)
                : item.system.training === "psionic"
                  ? ("psionic" as const)
                  : ("standard" as const),
        };
      });
    const skillById = new Map(
      mechanicalDocuments
        .filter((item) => item.training !== "specialization")
        .map((item) => [item.id, item]),
    );
    const skillByKey = new Map(
      mechanicalDocuments
        .filter((item) => item.training === "standard")
        .map((item) => [item.key, item.id]),
    );
    const parentSkillFor = (
      skill: (typeof mechanicalDocuments)[number],
    ): (typeof mechanicalDocuments)[number] | undefined => {
      if (skill.training !== "specialization") return undefined;
      const parent =
        skillById.get(skill.parentSkillId) ??
        skillById.get(skillByKey.get(skill.parentSkillKey) ?? "");
      return parent?.training === "standard" ? parent : undefined;
    };
    const configuredPerSkillLimit = configuredSpecializationsPerSkillLimit();

    const attributeViews: readonly CharacterAttributeView[] =
      activeAttributeDefinitions().map(({ id, label }) => {
        const value = record(attributes[id]);
        const attributeScore = integer(value.score);
        const effectiveAttributeScore =
          currentEffectivePipScore(attributeScore);
        const skillViews = mechanicalDocuments
          .filter(
            (skill) =>
              (parentSkillFor(skill)?.attributeId ?? skill.attributeId) ===
                id &&
              skill.training !== "advanced" &&
              skill.training !== "psionic",
          )
          .map((skill): CharacterSkillView => {
            const parent = parentSkillFor(skill);
            const parentScore =
              parent?.training === "advanced" &&
              optionalCapabilities.advancedSkills.state === "active"
                ? currentEffectivePipScore(parent.score)
                : currentCombinedPipScore(attributeScore, parent?.score ?? 0);
            const score =
              skill.training === "advanced"
                ? currentEffectivePipScore(skill.score)
                : skill.training === "specialization"
                  ? specializationScore(
                      parentScore,
                      currentEffectivePipScore(skill.score),
                    )
                  : currentCombinedPipScore(attributeScore, skill.score);
            const document = this.actor.items.get(skill.id);
            const plan = document
              ? itemAdvancementPlan(this.actor, document)
              : undefined;
            const requestedRoll = highlightedRollRequestForSubject(
              this.actor.id,
              { itemId: skill.id, kind: "skill" },
            );
            const requestedRollLabel = requestedRoll
              ? game.i18n.format("D6E2.RequestRoll.Highlighted", {
                  requester: requestedRoll.requesterName,
                })
              : "";
            const acquisitionPlan =
              document && skill.training === "standard"
                ? specializationAcquisitionPlan(this.actor, document)
                : undefined;
            const showSpecializationAcquisition =
              advancementEnabled &&
              (acquisitionPlan?.active ?? false) &&
              optionalCapabilities.advancedSkills.state === "active" &&
              skill.training === "standard";
            const specializationAcquisitionHelp = acquisitionPlan?.atLimit
              ? game.i18n.format("D6E2.Advancement.SpecializationLimit", {
                  maximum: acquisitionPlan.maximumSpecializations,
                })
              : acquisitionPlan && !acquisitionPlan.affordable
                ? game.i18n.localize("D6E2.Advancement.InsufficientPoints")
                : game.i18n.localize("D6E2.Advancement.AcquireSpecialization");
            const linkedAdvancedSkills =
              skill.training === "standard"
                ? mechanicalDocuments
                    .filter(
                      (candidate) =>
                        candidate.training === "advanced" &&
                        candidate.prerequisiteSkillKeys.includes(skill.key),
                    )
                    .map((candidate): LinkedAdvancedSkillView => {
                      const candidateDocument = this.actor.items.get(
                        candidate.id,
                      );
                      const advancePlan = candidateDocument
                        ? itemAdvancementPlan(this.actor, candidateDocument)
                        : undefined;
                      const advancedScore = currentEffectivePipScore(
                        candidate.score,
                      );
                      const advanceHelp =
                        advancePlan?.blockedReason ===
                        "advanced-skill-prerequisite"
                          ? game.i18n.localize(
                              "D6E2.Advancement.AdvancedSkillPrerequisite",
                            )
                          : advancePlan?.active === true &&
                              !advancePlan.affordable
                            ? game.i18n.localize(
                                "D6E2.Advancement.InsufficientPoints",
                              )
                            : game.i18n.localize(
                                advancementStrategy.family ===
                                  "character-points"
                                  ? "D6E2.Advancement.OpenD6Ready"
                                  : advancementStrategy.family ===
                                      "experience-points"
                                    ? "D6E2.Advancement.ExperienceReady"
                                    : advancementStrategy.family === "milestone"
                                      ? "D6E2.Advancement.MilestoneReady"
                                      : "D6E2.Advancement.ProfileRequired",
                              );
                      return Object.freeze({
                        advanceCost: advancePlan?.cost ?? 0,
                        advanceHelp,
                        advanceResourceLabel: advancementPlanResourceLabel(
                          advancePlan?.resource ?? "",
                        ),
                        augmentedScoreLabel: formatPipScore(
                          advancedSkillAugmentedScore(score, advancedScore),
                        ),
                        canAdvance:
                          advancementEnabled &&
                          (advancePlan?.active ?? false) &&
                          (advancePlan?.affordable ?? false),
                        id: candidate.id,
                        name: candidate.name,
                        rollable:
                          optionalCapabilities.advancedSkills.state ===
                            "active" &&
                          candidateDocument !== undefined &&
                          advancedSkillIssues(this.actor, candidateDocument)
                            .length === 0,
                        score: candidate.score,
                        scoreLabel: formatPipScore(advancedScore),
                        tooltip: characterSkillTooltip(
                          {
                            attributeLabel:
                              terminologyAttributeLabel(terminology, id) ??
                              game.i18n.localize(label),
                            description: candidate.description,
                            key: candidate.key,
                            name: candidate.name,
                            requestedRollLabel: "",
                          },
                          game.i18n,
                        ),
                      });
                    })
                    .sort((left, right) => left.name.localeCompare(right.name))
                : [];
            return Object.freeze({
              ...skill,
              name:
                currentSettingSkill(skill.key)?.name ??
                (skill.key === "channel"
                  ? (terminology.metaphysics.skills.channel ?? skill.name)
                  : skill.key === "sense"
                    ? (terminology.metaphysics.skills.sense ?? skill.name)
                    : skill.key === "transform"
                      ? (terminology.metaphysics.skills.transform ?? skill.name)
                      : skill.name),
              advanceCost: plan?.cost ?? 0,
              advanceResourceLabel: advancementPlanResourceLabel(
                plan?.resource ?? "",
              ),
              bonusLabel: formatPipScore(currentEffectivePipScore(skill.score)),
              canAcquireSpecialization:
                showSpecializationAcquisition &&
                (acquisitionPlan?.affordable ?? false),
              canEditCreation: creation.active && skill.training !== "standard",
              canCreateCreationSpecialization:
                creation.active &&
                skill.training === "standard" &&
                creation.specializations.remaining > 0,
              canCreateSkillChild:
                sheetMode === "freeedit" &&
                isGM &&
                optionalCapabilities.advancedSkills.state === "active" &&
                skill.training === "standard",
              canIncreaseCreation:
                skill.training !== "specialization" &&
                nextSecondEditionCreationScore(
                  skill.score,
                  1,
                  currentPipsEnabled(),
                ) <= 6 &&
                nextSecondEditionCreationScore(
                  skill.score,
                  1,
                  currentPipsEnabled(),
                ) -
                  skill.score <=
                  creation.skills.remaining,
              linkedAdvancedSkills: Object.freeze(linkedAdvancedSkills),
              canAdvance:
                advancementEnabled &&
                (plan?.active ?? false) &&
                (plan?.affordable ?? false),
              parentSkillName: parent?.name ?? "",
              requestedRoll: requestedRoll !== undefined,
              requestedRollLabel,
              rollable:
                score >= 3 &&
                (skill.training !== "advanced" ||
                  optionalCapabilities.advancedSkills.state === "active"),
              scoreLabel: formatPipScore(score),
              showAdvanceControl:
                skill.training !== "specialization" ||
                advancementStrategy.specialization === "direct-spend",
              showSpecializationAcquisition,
              specializationAcquisitionCost: acquisitionPlan?.cost ?? 0,
              specializationAcquisitionHelp,
              specializations: Object.freeze([]),
              tooltip: characterSkillTooltip(
                {
                  attributeLabel:
                    terminologyAttributeLabel(terminology, id) ??
                    game.i18n.localize(label),
                  description: skill.description,
                  key: skill.key,
                  name: skill.name,
                  requestedRollLabel,
                },
                game.i18n,
              ),
            });
          });
        const skills = groupCharacterSkillViews(skillViews).map(
          (skill): CharacterSkillView => {
            if (skill.training !== "standard") return skill;
            return Object.freeze({
              ...skill,
              canCreateCreationSpecialization:
                skill.canCreateCreationSpecialization &&
                (configuredPerSkillLimit === null ||
                  skill.specializations.length < configuredPerSkillLimit),
            });
          },
        );
        const plan = attributeAdvancementPlan(this.actor, id);
        const attributeBounds = actorAttributeBounds(this.actor, id);
        const nextCreationScore = Math.min(
          attributeBounds.maximum,
          nextSecondEditionCreationScore(
            attributeScore,
            1,
            currentPipsEnabled(),
          ),
        );
        const requestedRoll = highlightedRollRequestForSubject(this.actor.id, {
          attributeId: id,
          kind: "attribute",
        });
        const requestedRollLabel = requestedRoll
          ? game.i18n.format("D6E2.RequestRoll.Highlighted", {
              requester: requestedRoll.requesterName,
            })
          : "";
        const attributeLabel =
          terminologyAttributeLabel(terminology, id) ??
          game.i18n.localize(label);
        return Object.freeze({
          advanceCost: plan.cost,
          advanceResourceLabel: advancementPlanResourceLabel(plan.resource),
          canAdvance:
            advancementEnabled &&
            plan.active &&
            plan.affordable &&
            plan.nextScore <= attributeBounds.maximum,
          canIncreaseCreation:
            nextCreationScore > attributeScore &&
            nextCreationScore - attributeScore <= creation.attributes.remaining,
          id,
          label: attributeLabel,
          maximumScore:
            this.actor.type === "creature" ? 60 : attributeBounds.maximum,
          requestedRoll: requestedRoll !== undefined,
          requestedRollLabel,
          rollable: effectiveAttributeScore >= 3,
          score: attributeScore,
          scoreLabel: formatPipScore(effectiveAttributeScore),
          skills: Object.freeze(skills),
          tooltip: characterAttributeTooltip(
            id,
            attributeLabel,
            requestedRollLabel,
            game.i18n,
          ),
        });
      });

    const attributeColumns = [
      attributeViews.filter((_attribute, index) => index % 2 === 0),
      attributeViews.filter((_attribute, index) => index % 2 === 1),
    ];
    const tabs = this.#tabs();
    const tabFamilies = this.#tabFamilies(tabs);
    const activeTabFamily =
      tabFamilies.find(({ active }) => active) ?? tabFamilies[0];
    const traitItemTypes = [
      "perk",
      "flaw",
      "talent",
      "trouble",
      "asset",
      ...(booleanSetting(SHARED_SETTING_KEYS.showAdvantagesDisadvantages, true)
        ? ["advantage", "disadvantage"]
        : []),
      "specialability",
      "manifestation",
    ];
    const equipmentItemTypes = ["weapon", "armor", "gear", "cybernetic"];
    const itemLabels: Readonly<Record<string, string>> = {
      advantage: "D6E2.Item.Advantage",
      armor: "D6E2.Item.Armor",
      asset: "D6E2.Item.Asset",
      cybernetic: "D6E2.Item.Cybernetic",
      disadvantage: "D6E2.Item.Disadvantage",
      flaw: "D6E2.Item.Flaw",
      gear: "D6E2.Item.Gear",
      manifestation: "D6E2.Item.Manifestation",
      perk: "D6E2.Item.Perk",
      specialability: "D6E2.Item.SpecialAbility",
      specialization: "D6E2.Item.Specialization",
      talent: "D6E2.Item.Talent",
      trouble: "D6E2.Item.Trouble",
      weapon: "D6E2.Item.Weapon",
    };
    const equippableItemTypes = new Set([
      "armor",
      "cybernetic",
      "gear",
      "weapon",
    ]);
    const campaignEquipmentEra = campaignProfile.equipmentEra;
    const equipmentEraLabel = (era: string): string =>
      game.i18n.localize(
        era === "science-fiction"
          ? "D6E2.Equipment.Era.ScienceFiction"
          : era === "medieval"
            ? "D6E2.Equipment.Era.Medieval"
            : era === "modern"
              ? "D6E2.Equipment.Era.Modern"
              : "D6E2.Equipment.Era.None",
      );
    const buildItemGroups = (itemTypes: readonly string[]) =>
      itemTypes.map((type) => ({
        canCreate:
          !["flaw", "perk", "talent"].includes(type) ||
          creation.active ||
          (isGM && sheetMode === "freeedit"),
        items: this.actor.items.contents
          .filter((item) => item.type === type)
          .map((item): CharacterItemView => {
            const equipmentEra = stringValue(
              record(record(item.system).equipmentProvenance).era,
              "none",
            );
            return {
              advanceCost: 0,
              canAdvance: false,
              equippable: equippableItemTypes.has(item.type),
              equipped: record(item.system).equipped === true,
              id: item.id,
              img: item.img,
              canInvokeFeature:
                ["asset", "trouble"].includes(item.type) &&
                optionalCapabilities.narrativeFeatures.state === "active" &&
                integer(featureSession?.uses[item.id]) < 2 &&
                this.actor.isOwner === true,
              featureUses: integer(featureSession?.uses[item.id]),
              featureUsesMaximum:
                ["asset", "trouble"].includes(item.type) &&
                optionalCapabilities.narrativeFeatures.state === "active"
                  ? 2
                  : 0,
              name: item.name,
              quantity: Math.max(0, integer(record(item.system).quantity)),
              type: item.type,
              showTransfer:
                equipmentTransfersEnabled && equippableItemTypes.has(item.type),
              canTransfer:
                equipmentTransfersEnabled &&
                (isGM || this.actor.isOwner === true) &&
                canTransferEquipmentItem(item) &&
                transferRecipients.length > 0,
              ...(equippableItemTypes.has(item.type)
                ? {
                    equipmentEraLabel: equipmentEraLabel(equipmentEra),
                    equipmentEraMismatch:
                      campaignEquipmentEra !== "none" &&
                      equipmentEra !== "none" &&
                      campaignEquipmentEra !== equipmentEra,
                    equipmentEraClass:
                      campaignEquipmentEra !== "none" &&
                      equipmentEra !== "none" &&
                      campaignEquipmentEra !== equipmentEra
                        ? "is-mismatch"
                        : "",
                  }
                : {}),
            };
          }),
        label:
          type === "manifestation" && terminology.manifestations.plural
            ? terminology.manifestations.plural
            : type === "specialability" && terminology.items.specialAbility
              ? terminology.items.specialAbility
              : game.i18n.localize(itemLabels[type] ?? "D6E2.Item.Item"),
        type,
      }));
    const traitGroups = buildItemGroups(traitItemTypes);
    const equipmentGroups = buildItemGroups(equipmentItemTypes);
    const health = record(system.health);
    const activeHealth = readActorHealth(this.actor);
    const healthStrategy = actorHealthResolutionStrategy(this.actor);
    const firstEditionDamage = healthStrategy.family !== "conditions";
    const firstEditionDamageMode =
      healthStrategy.family === "wounds"
        ? "wounds"
        : healthStrategy.family === "body-points" &&
            healthStrategy.woundDerivation
          ? "body-points-with-wounds"
          : "body-points";
    const bodyPoints =
      activeHealth.pool ?? Object.freeze({ current: 0, maximum: 0 });
    const condition = activeHealth.track?.currentStateId ?? "healthy";
    const posture =
      record(system.movement).posture === "prone" ? "prone" : "standing";
    const environmentEffect =
      optionalCapabilities.environments.state === "active"
        ? readActorEnvironmentEffect(this.actor)
        : null;
    const conditions = (activeHealth.track?.states ?? []).map((state) => ({
      cssClass: condition === state.id ? "is-current" : "",
      current: condition === state.id,
      label: terminologyHealthStateLabel(
        terminology,
        healthStrategy.id,
        state.id as Parameters<typeof terminologyHealthStateLabel>[2],
      ),
      penaltyLabel:
        state.penaltyScore > 0
          ? `(−${formatPipScore(state.penaltyScore)})`
          : "",
      value: state.id,
    }));
    const firstEditionHealingRule =
      firstEditionDamage && firstEditionDamageMode === "wounds"
        ? firstEditionNaturalHealingRule(condition as FirstEditionWoundLevel)
        : null;
    const firstEditionMedicineDifficulty =
      firstEditionDamage && firstEditionDamageMode === "wounds"
        ? firstEditionAssistedHealingDifficulty(
            condition as FirstEditionWoundLevel,
          )
        : null;
    const firstEditionInjuryState = firstEditionDamage
      ? readFirstEditionInjuryState(this.actor)
      : null;
    const firstEditionAccumulatingStunsActive =
      healthStrategy.lifecycle.accumulatingStuns ===
        "open-d6.optional-accumulating-stuns" &&
      booleanSetting(FIRST_EDITION_OPTION_KEYS.trackStuns, false);
    const firstEditionStuns = firstEditionAccumulatingStunsActive
      ? readFirstEditionAccumulatingStuns(this.actor)
      : null;
    const firstEditionMortalityRounds = Math.max(
      0,
      integer(record(health.firstEditionState).mortalityRounds),
    );
    const attributeScores = new Map(
      attributeViews.map((attribute) => [
        attribute.id,
        currentEffectivePipScore(attribute.score),
      ]),
    );
    const combatItems = this.actor.items.contents
      .filter((item) => item.type === "weapon")
      .map((item): CombatItemView => ({
        advanceCost: 0,
        canAdvance: false,
        damageLabel: formatPipScore(
          currentEffectivePipScore(integer(item.system.damage)),
        ),
        equipped: item.system.equipped === true,
        id: item.id,
        img: item.img,
        name: item.name,
        type: item.type,
      }));
    const armorItems = this.actor.items.contents
      .filter((item) => item.type === "armor")
      .map((item) => ({
        equipped: item.system.equipped === true,
        id: item.id,
        img: item.img,
        name: item.name,
        protectionLabel: formatPipScore(
          Math.max(
            currentEffectivePipScore(integer(item.system.physicalResistance)),
            currentEffectivePipScore(integer(item.system.energyResistance)),
          ),
        ),
      }));
    const secondEditionCombat = healthStrategy.family === "conditions";
    const secondEditionDefenses = defenseStrategy.family !== "active";
    const secondEditionDodgeDefense = defenseStrategy.ranged === "static-dodge";
    const secondEditionMovement = movementStrategy.distance === "fixed-mode";
    const firstEditionDefenses =
      defenseStrategy.activeDefense === "committed-roll";
    const firstEditionMovement = movementStrategy.distance === "relative-rate";
    const baseMove = Math.max(1, integer(record(system.movement).base));
    const resistancePlan = secondEditionCombat
      ? actorResistancePlan(this.actor)
      : null;
    const defenses = record(system.defenses);
    const creatureDodgeOverride = integer(defenses.dodgeOverride);
    const creatureParryOverride = integer(defenses.parryOverride);
    const isCreature = this.actor.type === "creature";
    const flyingSkill = this.actor.items.contents.find(
      (item) => item.type === "skill" && item.system.key === "flying-zero-g",
    );
    const flyingDodgeAvailable =
      campaignProfile.scienceFictionSkills && flyingSkill !== undefined;
    const dodgeBasis =
      flyingDodgeAvailable && defenses.dodgeBasis === "flying"
        ? "flying"
        : "perception";
    const flyingGuidance = flyingDodgeAvailable
      ? secondEditionFlyingGuidance(
          attributeScores.get("agility") ?? 0,
          currentEffectivePipScore(integer(flyingSkill.system.score)),
        )
      : null;
    const dodge =
      isCreature && creatureDodgeOverride > 0
        ? creatureDodgeOverride
        : resolveSecondEditionDodgeDefense(
            attributeScores.get("perception") ?? 0,
            attributeScores.get("agility") ?? 0,
            currentEffectivePipScore(integer(flyingSkill?.system.score)),
            dodgeBasis,
          );
    const parry =
      isCreature && creatureParryOverride > 0
        ? creatureParryOverride
        : secondEditionStaticDefense(attributeScores.get("agility") ?? 0);
    const actionEconomyStrategy = currentActionEconomyRuntimeStrategy();
    const secondEditionActionSegments =
      actionEconomyStrategy.declaration === "ordered-actions" &&
      currentActionDeclarationAssistance() !== "manual";
    const firstEditionFlexibleActions =
      actionEconomyStrategy.declaration === "action-commitment" &&
      currentActionDeclarationAssistance() !== "manual";
    const firstEditionSegmentedActions =
      firstEditionFlexibleActions &&
      actionEconomyStrategy.turnScheduling === "round-robin-segments";
    const roundState = game.system.api?.combat.read(this.actor) ?? null;
    const firstEditionSegmentMovement =
      firstEditionSegmentedActions &&
      movementStrategy.segment === "round-robin-rate"
        ? firstEditionActorSegmentMovementPlan(this.actor, baseMove)
        : null;
    const activeResponsiveCombat =
      campaignProfile.activeResponsiveCombat &&
      defenseStrategy.fullDefense === "second-edition-skill-bonus";
    const meleeSkill = this.actor.items.contents.find(
      (item) => item.type === "skill" && item.system.key === "melee",
    );
    const meleeAttribute = meleeSkill
      ? record(
          record(system.attributes)[stringValue(meleeSkill.system.attributeId)],
        )
      : {};
    const meleeScore = meleeSkill
      ? currentCombinedPipScore(
          integer(meleeAttribute.score),
          integer(meleeSkill.system.score),
        )
      : 0;
    const fullDefense = roundState?.secondEditionFullDefense;
    const secondEditionFeint = roundState?.secondEditionFeint;
    const firstEditionCommitment = roundState?.firstEditionCommitment;
    const firstEditionActionState = firstEditionCommitment
      ? {
          actionAllotment: firstEditionCommitment.actionAllotment,
          defenseLabel: game.i18n.localize(
            firstEditionCommitment.defense === "full-defense"
              ? "D6E2.Combat.FirstEdition.FullDefense"
              : firstEditionCommitment.defense === "partial-defense"
                ? "D6E2.Combat.FirstEdition.PartialDefense"
                : "D6E2.Combat.FirstEdition.DefenseNone",
          ),
          mapLabel:
            roundState.firstEditionActionPenaltyScore === 0
              ? "0D"
              : `−${formatPipScore(roundState.firstEditionActionPenaltyScore)}`,
          currentSegment: roundState.firstEditionCurrentSegment,
          nextLabel: roundState.firstEditionNextLabel ?? "",
          plannedActionCount: firstEditionCommitment.plannedActionCount,
          remainingActionCount: roundState.firstEditionRemainingActionCount,
          spentActionCount: firstEditionCommitment.spentActionCount,
          waitingLabels: roundState.firstEditionSegmentWaitingLabels.join(", "),
        }
      : null;
    const conditionPenaltyScore =
      activeHealth.track?.currentState.penaltyScore ?? 0;
    const stunPenaltyScore =
      firstEditionStuns === null ? 0 : firstEditionStuns.penaltyDice * 3;
    const environmentPenaltyScore = environmentEffect?.penaltyScore ?? 0;
    const roundPenaltyScore = secondEditionActionSegments
      ? (roundState?.actionPenaltyScore ?? 0)
      : firstEditionFlexibleActions
        ? (roundState?.firstEditionActionPenaltyScore ?? 0)
        : 0;
    const movementSkillPenaltyScore = secondEditionActionSegments
      ? (roundState?.movementSkillPenaltyScore ?? 0)
      : 0;
    const activeDicePenaltyScore =
      conditionPenaltyScore +
      stunPenaltyScore +
      environmentPenaltyScore +
      roundPenaltyScore;
    const headerStatuses = [
      ...(posture === "prone"
        ? [
            {
              icon: "fa-person-falling",
              label: game.i18n.localize("D6E2.Combat.Posture.Prone"),
              tone: "posture",
            },
          ]
        : []),
      ...(roundPenaltyScore > 0
        ? [
            {
              icon: "fa-layer-group",
              label: game.i18n.format("D6E2.Combat.Status.RoundPenalty", {
                penalty: `−${formatPipScore(roundPenaltyScore)}`,
              }),
              tone: "penalty",
            },
          ]
        : []),
      ...(movementSkillPenaltyScore > 0
        ? [
            {
              icon: "fa-person-running",
              label: game.i18n.format("D6E2.Combat.Status.SkillPenalty", {
                penalty: `−${formatPipScore(movementSkillPenaltyScore)}`,
              }),
              tone: "penalty",
            },
          ]
        : []),
      ...(environmentEffect !== null && environmentPenaltyScore > 0
        ? [
            {
              icon: "fa-cloud-bolt",
              label: game.i18n.format("D6E2.Combat.Status.EnvironmentPenalty", {
                penalty: `−${formatPipScore(environmentPenaltyScore)}`,
              }),
              tone: "penalty",
            },
          ]
        : []),
      ...(firstEditionStuns !== null && firstEditionStuns.total > 0
        ? [
            {
              icon: "fa-burst",
              label: game.i18n.format("D6E2.Combat.Status.Stuns", {
                count: firstEditionStuns.total,
                penalty:
                  stunPenaltyScore > 0
                    ? ` · −${formatPipScore(stunPenaltyScore)}`
                    : "",
              }),
              tone: "penalty",
            },
          ]
        : []),
      ...(firstEditionInjuryState !== null &&
      firstEditionInjuryState.consciousness !== "conscious"
        ? [
            {
              icon: "fa-bed-pulse",
              label: game.i18n.localize(
                `D6E2.Combat.FirstEdition.Consciousness.${firstEditionInjuryState.consciousness}`,
              ),
              tone: "danger",
            },
          ]
        : []),
      ...(fullDefense || secondEditionFeint
        ? [
            {
              icon: fullDefense ? "fa-shield-halved" : "fa-masks-theater",
              label: fullDefense
                ? game.i18n.localize(
                    "D6E2.Combat.ActiveResponsive.FullDefenseActive",
                  )
                : game.i18n.format("D6E2.Combat.ActiveResponsive.FeintActive", {
                    target: secondEditionFeint?.targetName ?? "",
                  }),
              tone: "combat",
            },
          ]
        : []),
    ];
    const firstEditionDefenseKinds = (
      [
        ["dodge", "dodge", "D6E2.Combat.Dodge"],
        ["block", "brawling", "D6E2.Combat.Block"],
        ["parry", "melee-combat", "D6E2.Combat.Parry"],
      ] as const
    ).flatMap(([kind, key, labelKey]) => {
      const skill = this.actor.items.contents.find(
        (candidate) =>
          candidate.type === "skill" && candidate.system.key === key,
      );
      if (!skill) return [];
      return [{ kind, label: game.i18n.localize(labelKey), skill: skill.name }];
    });
    const firstEditionActiveDefense = roundState?.firstEditionActiveDefense;
    const completedCombatActionIds = new Set(
      roundState?.completedActionIds ?? [],
    );
    const roundActions =
      roundState?.actions.map((action, index) => ({
        ...action,
        complete: completedCombatActionIds.has(action.id),
        forfeited:
          !completedCombatActionIds.has(action.id) &&
          roundState.actionForfeiture?.reason === "wounded",
        cssClass: completedCombatActionIds.has(action.id)
          ? "is-complete"
          : roundState.actionForfeiture?.reason === "wounded"
            ? "is-forfeited"
            : "",
        detail:
          action.endProne === true
            ? game.i18n.localize("D6E2.Combat.Movement.EndProne")
            : action.effectiveScore !== undefined
              ? game.i18n.format("D6E2.Combat.DeclaredPool", {
                  score: formatPipScore(action.effectiveScore),
                })
              : action.kind,
        icon: completedCombatActionIds.has(action.id)
          ? "fa-check"
          : roundState.actionForfeiture?.reason === "wounded"
            ? "fa-ban"
            : "fa-hourglass-half",
        number: index + 1,
      })) ?? [];
    const psionicsState = campaignProfile.psionics
      ? readActorPsionics(this.actor)
      : null;
    const psionics =
      psionicsState === null
        ? null
        : {
            disciplines: psionicsState.disciplines.map((discipline) => ({
              ...discipline,
              canAdvance:
                discipline.trained &&
                sheetMode === "advance" &&
                advancementEnabled,
              canTrain: this.isEditable && !discipline.trained,
              label: game.i18n.localize(
                `D6E2.Psionics.Discipline.${discipline.id}`,
              ),
              scoreLabel: formatPipScore(discipline.score),
              trainingLabel: discipline.trainingMethod
                ? game.i18n.localize(
                    `D6E2.Psionics.Training.${discipline.trainingMethod === "teacher" ? "Teacher" : "SelfStudy"}`,
                  )
                : "",
            })),
            hasPowers: psionicsState.powers.length > 0,
            powers: psionicsState.powers.map((power) => ({
              ...power,
              difficulty:
                power.baseDifficulty +
                power.recentAttempts * (power.scalingDifficultyPerAttempt ?? 0),
              disciplineLabels: power.disciplines
                .map((discipline) =>
                  game.i18n.localize(`D6E2.Psionics.Discipline.${discipline}`),
                )
                .join(" + "),
              poolLabel: formatPipScore(power.poolScore),
            })),
          };
    const cyberpunkState = campaignProfile.cyberpunk
      ? readActorCyberpunk(this.actor)
      : null;
    const cyberpunk =
      cyberpunkState === null
        ? null
        : {
            ...cyberpunkState,
            augmentations: cyberpunkState.augmentations.map((augmentation) => ({
              ...augmentation,
              acquisitionLabel: game.i18n.format(
                "D6E2.Cyberpunk.AcquisitionDifficultyValue",
                { difficulty: augmentation.acquisitionDifficulty },
              ),
              canInstall: this.isEditable && !augmentation.installed,
              capacityLabel:
                augmentation.kind === "bioware"
                  ? `${cyberpunkState.biowareCount}/${cyberpunkState.brawnCapacity}`
                  : `${cyberpunkState.cyberwareCount}/${cyberpunkState.knowledgeCapacity}`,
              installTimeLabel: game.i18n.format(
                "D6E2.Cyberpunk.InstallMinutesValue",
                { minutes: augmentation.installMinutes },
              ),
              kindLabel: game.i18n.localize(
                augmentation.kind === "bioware"
                  ? "D6E2.Cyberpunk.Bioware"
                  : "D6E2.Cyberpunk.Cyberware",
              ),
            })),
            canHarden:
              this.isEditable && roundState?.currentAction !== undefined,
            canHack: this.isEditable,
          };
    const superheroicActive =
      campaignProfile.superheroicSkills ||
      campaignProfile.superheroicHeroPoints ||
      campaignProfile.superheroicDieCodeCap !== "none" ||
      campaignProfile.secretIdentities ||
      campaignProfile.superpowers ||
      campaignProfile.gadgetsGear ||
      campaignProfile.nemesisCompanionsSidekicks;
    const relationshipState = campaignProfile.nemesisCompanionsSidekicks
      ? readActorSuperheroicRelationships(this.actor)
      : null;
    const secretIdentity = campaignProfile.secretIdentities
      ? readActorSecretIdentity(this.actor)
      : null;
    const superheroic = superheroicActive
      ? {
          canAddAction:
            this.isEditable &&
            campaignProfile.superheroicHeroPoints &&
            roundState?.currentAction !== undefined &&
            actorHeroPointBalance(this.actor) > 0,
          canTransfer:
            this.isEditable &&
            campaignProfile.superheroicHeroPoints &&
            actorHeroPointBalance(this.actor) > 0,
          canBoostTalent:
            this.isEditable &&
            campaignProfile.superheroicHeroPoints &&
            actorHeroPointBalance(this.actor) > 0 &&
            this.actor.items.contents.some((item) => item.type === "talent"),
          dieCodeCap:
            campaignProfile.superheroicDieCodeCap === "none"
              ? null
              : campaignProfile.superheroicDieCodeCap,
          dieCodeCapLabel:
            campaignProfile.superheroicDieCodeCap === "none"
              ? ""
              : game.i18n.localize(
                  `D6E2.Settings.SecondEdition.SuperheroicDieCodeCap.${
                    campaignProfile.superheroicDieCodeCap[0]?.toUpperCase() ??
                    ""
                  }${campaignProfile.superheroicDieCodeCap.slice(1)}`,
                ),
          heroPointsActive: campaignProfile.superheroicHeroPoints,
          heroPointBalance: actorHeroPointBalance(this.actor),
          relationships:
            relationshipState === null
              ? null
              : {
                  ...relationshipState,
                  actorChoices: Object.freeze(
                    (game.actors?.contents ?? [])
                      .filter(
                        (actor) =>
                          actor.type === "character" &&
                          actor.id !== this.actor.id,
                      )
                      .map((actor) => ({
                        id: actor.id,
                        name: actor.name,
                        selectedHero:
                          actor.id === relationshipState.heroActorId,
                        selectedMentor:
                          actor.id === relationshipState.mentorActorId,
                      })),
                  ),
                  actorChoiceOptions: Object.fromEntries(
                    (game.actors?.contents ?? [])
                      .filter(
                        (actor) =>
                          actor.type === "character" &&
                          actor.id !== this.actor.id,
                      )
                      .map((actor) => [actor.id, actor.name]),
                  ),
                  canBeginEncounter:
                    game.user?.isGM === true && relationshipState.nemesisActive,
                  canConfigure: game.user?.isGM === true,
                  canRecover:
                    this.isEditable &&
                    relationshipState.companionName.trim().length > 0,
                  canResolve:
                    game.user?.isGM === true &&
                    relationshipState.nemesisActive &&
                    relationshipState.heroActorId.length > 0,
                  heroName:
                    game.actors?.get(relationshipState.heroActorId)?.name ?? "",
                  mentorName:
                    game.actors?.get(relationshipState.mentorActorId)?.name ??
                    "",
                  sidekickCreation:
                    record(this.actor.system.creation).sidekick === true,
                  nemesisScopeOptions: {
                    individual: game.i18n.localize(
                      "D6E2.SuperheroicRelationships.Individual",
                    ),
                    group: game.i18n.localize(
                      "D6E2.SuperheroicRelationships.Group",
                    ),
                  },
                  sidekickStatusOptions: {
                    active: game.i18n.localize(
                      "D6E2.SuperheroicRelationships.Active",
                    ),
                    independent: game.i18n.localize(
                      "D6E2.SuperheroicRelationships.Independent",
                    ),
                    removed: game.i18n.localize(
                      "D6E2.SuperheroicRelationships.Removed",
                    ),
                  },
                },
          superpowers: campaignProfile.superpowers
            ? (() => {
                const talents = this.actor.items.contents
                  .filter(
                    (item) =>
                      item.type === "talent" && item.system.superpower === true,
                  )
                  .map((item) => {
                    const cost = superpowerTalentCostPlan(
                      integer(item.system.cost),
                      integer(item.system.rank),
                      integer(item.system.superpowerEnhancementCost),
                      integer(item.system.superpowerLimitationCredit),
                    );
                    return Object.freeze({
                      automatic: item.system.superpowerAutomatic === true,
                      canRely:
                        this.isEditable &&
                        item.system.superpowerAutomatic !== true,
                      id: item.id,
                      name: item.name,
                      rank: cost.rank,
                      totalCost: cost.totalCost,
                    });
                  });
                const used = talents.reduce(
                  (total, talent) => total + talent.totalCost,
                  0,
                );
                return Object.freeze({
                  budget:
                    record(this.actor.system.creation).sidekick === true
                      ? Math.floor(campaignProfile.superpowerCreationDice / 2)
                      : campaignProfile.superpowerCreationDice,
                  budgetClass:
                    used >
                    (record(this.actor.system.creation).sidekick === true
                      ? Math.floor(campaignProfile.superpowerCreationDice / 2)
                      : campaignProfile.superpowerCreationDice)
                      ? "is-warning"
                      : "",
                  overBudget:
                    used >
                    (record(this.actor.system.creation).sidekick === true
                      ? Math.floor(campaignProfile.superpowerCreationDice / 2)
                      : campaignProfile.superpowerCreationDice),
                  remaining:
                    (record(this.actor.system.creation).sidekick === true
                      ? Math.floor(campaignProfile.superpowerCreationDice / 2)
                      : campaignProfile.superpowerCreationDice) - used,
                  talents: Object.freeze(talents),
                  used,
                });
              })()
            : null,
          gadgetsGear: campaignProfile.gadgetsGear
            ? Object.freeze(
                this.actor.items.contents
                  .filter(
                    (item) =>
                      item.type === "gear" &&
                      ["gadget", "gear"].includes(
                        stringValue(item.system.superheroicEquipmentKind),
                      ),
                  )
                  .map((item) => {
                    const kind = stringValue(
                      item.system.superheroicEquipmentKind,
                    );
                    const state = stringValue(
                      item.system.superheroicEquipmentState,
                      "ready",
                    );
                    const ready =
                      state === "ready" && item.system.equipped === true;
                    const powers =
                      kind === "gear"
                        ? readActorSuperheroicEquipmentPowers(
                            this.actor,
                            item.id,
                          ).map((power) => ({
                            ...power,
                            canUse: this.isEditable && ready,
                          }))
                        : [];
                    const targetKind = stringValue(
                      item.system.gadgetTargetKind,
                      "skill",
                    );
                    const targetId = stringValue(item.system.gadgetTargetId);
                    const targetLabel =
                      targetKind === "attribute"
                        ? (terminologyAttributeLabel(terminology, targetId) ??
                          targetId)
                        : (this.actor.items.get(targetId)?.name ?? targetId);
                    const rebuildDays =
                      kind === "gear"
                        ? actorSuperheroicEquipmentRebuildDays(
                            this.actor,
                            item.id,
                          )
                        : 0;
                    return Object.freeze({
                      borrowedPenalty:
                        kind === "gear"
                          ? superheroicEquipmentUsePenaltyScore(
                              stringValue(
                                item.system.superheroicCreatorActorId,
                              ),
                              this.actor.id,
                            ) / 3
                          : 0,
                      canDestroy:
                        game.user?.isGM === true && state !== "destroyed",
                      canMalfunction:
                        game.user?.isGM === true && state === "ready",
                      canRepair:
                        game.user?.isGM === true && state === "malfunctioning",
                      canRebuild:
                        game.user?.isGM === true &&
                        state === "destroyed" &&
                        rebuildDays !== null,
                      canUse: this.isEditable && ready,
                      equipped: item.system.equipped === true,
                      id: item.id,
                      iconClass:
                        kind === "gadget"
                          ? "fa-screwdriver-wrench"
                          : "fa-toolbox",
                      isGadget: kind === "gadget",
                      isGear: kind === "gear",
                      name: item.name,
                      powers,
                      rebuildDays,
                      state,
                      stateLabel: game.i18n.localize(
                        state === "destroyed"
                          ? "D6E2.GadgetsGear.State.Destroyed"
                          : state === "malfunctioning"
                            ? "D6E2.GadgetsGear.State.Malfunctioning"
                            : "D6E2.GadgetsGear.State.Ready",
                      ),
                      targetLabel,
                      useCase: stringValue(item.system.gadgetUseCase),
                    });
                  }),
              )
            : null,
          secretIdentity:
            secretIdentity === null
              ? null
              : {
                  ...secretIdentity,
                  active: secretIdentity.status === "active",
                  canClear:
                    game.user?.isGM === true &&
                    secretIdentity.status === "exposed",
                  canClue:
                    this.isEditable &&
                    secretIdentity.status === "active" &&
                    secretIdentity.heroPoints < 3,
                  canGoPublic:
                    game.user?.isGM === true &&
                    secretIdentity.status !== "public",
                  canReinforce:
                    game.user?.isGM === true &&
                    secretIdentity.status === "active" &&
                    secretIdentity.heroPoints < 3,
                  canSpend:
                    this.isEditable &&
                    secretIdentity.status === "active" &&
                    secretIdentity.heroPoints > 0,
                  canSuspicion:
                    this.isEditable && secretIdentity.status === "active",
                  statusLabel: game.i18n.localize(
                    `D6E2.Superheroic.Status.${
                      secretIdentity.status === "exposed"
                        ? "Exposed"
                        : secretIdentity.status === "public"
                          ? "Public"
                          : "Active"
                    }`,
                  ),
                },
          skillsActive: campaignProfile.superheroicSkills,
        }
      : null;

    return Promise.resolve({
      actor: this.actor,
      advanceMode: sheetMode === "advance",
      showDirectAdvancementControls:
        sheetMode === "advance" &&
        advancementStrategy.progression !== "narrative-arcs",
      advancementEnabled,
      advancementHelp: game.i18n.localize(
        advancementStrategy.family === "character-points"
          ? "D6E2.Advancement.OpenD6Ready"
          : advancementStrategy.family === "experience-points"
            ? "D6E2.Advancement.ExperienceReady"
            : advancementStrategy.family === "milestone"
              ? "D6E2.Advancement.MilestoneReady"
              : advancementStrategy.family === "narrative"
                ? "D6E2.Advancement.NarrativeReady"
                : "D6E2.Advancement.ProfileRequired",
      ),
      advancementResourceLabel: game.i18n.localize(
        advancementUsesExperiencePoints
          ? "D6E2.ExperiencePoints"
          : "D6E2.CharacterPoints",
      ),
      availableAdvancementResource,
      showAdvancementResource:
        advancementStrategy.family === "character-points" ||
        advancementUsesExperiencePoints,
      milestoneAdvancement,
      milestoneBalance,
      canAwardMilestone: milestoneAdvancement && isGM,
      canExchangeMilestonePerk:
        milestoneAdvancement &&
        milestoneBalance.attributeDice >= 1 &&
        milestoneBalance.skillPips >= 9 &&
        optionalCapabilities.rankedFeatures.state === "active",
      narrativeAdvancement,
      narrativeArcs,
      canProposeNarrativeArc:
        narrativeAdvancement && (this.actor.isOwner === true || isGM),
      attributeColumns,
      characterPoints: integer(characterPoints.value),
      canEditCharacterPoints: canDirectEditResources,
      canEditExperiencePoints: canDirectEditResources,
      canEditFatePoints: canDirectEditResources,
      experiencePoints: integer(experiencePoints.value),
      showExperiencePoints:
        advancementUsesExperiencePoints && !classicHeroPoints,
      campaignProfile,
      cyberpunk,
      extraordinaryPowers: (() => {
        const model = extraordinaryPowerSheetModel(this.actor, systemApi());
        const frameworkLabel = model.frameworks[0]?.label;
        const workspaceLabel =
          frameworkLabel ?? game.i18n.localize("D6E2.ExtraordinaryPower.Tab");
        const namedSkills = workspaceLabel.replace(/^The\s+/iu, "");
        return Object.freeze({
          ...model,
          powersActive: this.#powerWorkspace === "powers",
          powersClass: this.#powerWorkspace === "powers" ? "active" : "",
          powersLabel:
            terminology.manifestations.plural ??
            game.i18n.localize("D6E2.ExtraordinaryPower.Powers"),
          skillsActive: this.#powerWorkspace === "skills",
          skillsClass: this.#powerWorkspace === "skills" ? "active" : "",
          skillsLabel: game.i18n.format("D6E2.ExtraordinaryPower.SkillsNamed", {
            name: namedSkills,
          }),
          workspaceHelp: game.i18n.localize(
            "D6E2.ExtraordinaryPower.WorkspaceHelp",
          ),
          workspaceLabel,
        });
      })(),
      psionics,
      superheroic,
      creationProfileLabel:
        attributeStrategy.family === "open-d6"
          ? firstEditionGenreProfile.label
          : game.i18n.localize(
              campaignProfile.id === "core-default"
                ? "D6E2.Settings.CampaignProfile.CoreDefault"
                : "D6E2.Settings.CampaignProfile.Custom",
            ),
      creationProfileVersion:
        attributeStrategy.family === "open-d6"
          ? firstEditionGenreProfile.version
          : campaignProfile.profileVersion,
      creationSource: game.i18n.localize(
        attributeStrategy.family === "open-d6" &&
          firstEditionGenreProfile.genreId === "open-d6-adventure-d6-system-2e"
          ? "D6E2.Creation.AdventureSource"
          : attributeStrategy.family === "open-d6"
            ? "D6E2.Creation.FirstEditionSource"
            : "D6E2.Creation.Source",
      ),
      creation,
      characterTemplate,
      bestiaryProvenance,
      canAddToCreatureCatalog:
        game.user?.isGM === true &&
        this.actor.type === "creature" &&
        !actorIsInWorldBestiaryCatalog(this.actor),
      canResetFeatureSession:
        game.user?.isGM === true &&
        optionalCapabilities.narrativeFeatures.state === "active",
      pipsEnabled: currentPipsEnabled(),
      pipsStrategyLabel:
        currentPipsRuntimeStrategy().id === "open-d6.pips.classic"
          ? "D6E2.Creation.ClassicPips"
          : currentPipsRuntimeStrategy().id === "d6e2.pips.module"
            ? "D6E2.Creation.PipsModule"
            : "D6E2.Creation.WholeDice",
      combat: {
        armor: armorItems,
        actionSegmentsActive: secondEditionActionSegments,
        firstEditionActionsActive: firstEditionFlexibleActions,
        firstEditionSegmentedActions,
        firstEditionActionState,
        firstEditionDefensesActive: firstEditionDefenses,
        firstEditionMovementActive: firstEditionMovement,
        firstEditionMovement: {
          baseMove,
          freeLand: baseMove / 2,
          freeSwim: Math.ceil(baseMove / 2) / 2,
          maximumLand: baseMove * 4,
          swimRate: Math.ceil(baseMove / 2),
          segment: firstEditionSegmentMovement
            ? {
                complication:
                  roundState?.firstEditionSegmentMovement?.complication ===
                  true,
                maximumDistance: firstEditionSegmentMovement.maximumDistance,
                normalDistance: firstEditionSegmentMovement.normalDistance,
                running: firstEditionSegmentMovement.running,
                runningDifficulty:
                  firstEditionSegmentMovement.runningDifficulty,
              }
            : null,
        },
        firstEditionHealing:
          firstEditionDamage &&
          ((firstEditionDamageMode !== "wounds" &&
            bodyPoints.maximum > 0 &&
            bodyPoints.current < bodyPoints.maximum) ||
            firstEditionHealingRule !== null ||
            firstEditionMedicineDifficulty !== null ||
            condition === "mortally-wounded")
            ? {
                canAssist:
                  this.isEditable &&
                  (firstEditionDamageMode !== "wounds" ||
                    firstEditionMedicineDifficulty !== null),
                canStabilize:
                  this.isEditable && condition === "mortally-wounded",
                canHealNaturally:
                  this.isEditable &&
                  (firstEditionDamageMode === "wounds"
                    ? firstEditionHealingRule !== null
                    : !["mortally-wounded", "dead"].includes(condition)),
                canRollMortality:
                  this.isEditable && condition === "mortally-wounded",
                medicineDifficulty: firstEditionMedicineDifficulty,
                mortalityMinutes: firstEditionMortalityElapsedMinutes(
                  firstEditionMortalityRounds,
                ),
                mortalityRounds: firstEditionMortalityRounds,
                showMortalityClock: condition === "mortally-wounded",
                title: game.i18n.localize(
                  firstEditionDamageMode === "wounds"
                    ? "D6E2.Combat.FirstEdition.Healing.Title"
                    : "D6E2.Combat.FirstEdition.BodyPoints.HealingTitle",
                ),
                restLabel:
                  firstEditionHealingRule === null
                    ? ""
                    : game.i18n.format(
                        `D6E2.Combat.FirstEdition.Healing.Rest.${firstEditionHealingRule.restUnit}`,
                        { amount: firstEditionHealingRule.restAmount },
                      ),
              }
            : null,
        firstEditionInjury:
          firstEditionInjuryState !== null &&
          (firstEditionInjuryState.consciousness !== "conscious" ||
            firstEditionInjuryState.source !== "none" ||
            firstEditionInjuryState.stunWound !== "none")
            ? {
                canClear:
                  this.isEditable &&
                  firstEditionInjuryState.consciousness === "unconscious" &&
                  firstEditionInjuryState.source !== "mortally-wounded",
                canResolve:
                  this.isEditable &&
                  firstEditionInjuryState.consciousness === "unresolved",
                consciousnessLabel: game.i18n.localize(
                  `D6E2.Combat.FirstEdition.Consciousness.${firstEditionInjuryState.consciousness}`,
                ),
                sourceLabel: game.i18n.localize(
                  `D6E2.Combat.FirstEdition.Consciousness.Source.${firstEditionInjuryState.source}`,
                ),
                stunLabel:
                  firstEditionInjuryState.stunWound === "none"
                    ? ""
                    : terminologyHealthStateLabel(
                        terminology,
                        healthStrategy.id,
                        firstEditionInjuryState.stunWound,
                      ),
                unconsciousMinutes: firstEditionInjuryState.unconsciousMinutes,
              }
            : null,
        firstEditionStuns:
          firstEditionStuns === null
            ? null
            : {
                canClear: this.isEditable && firstEditionStuns.total > 0,
                penaltyLabel:
                  firstEditionStuns.penaltyDice > 0
                    ? `−${firstEditionStuns.penaltyDice}D`
                    : "0D",
                roundsRemaining: firstEditionStuns.roundsRemaining,
                threshold: actorFirstEditionAccumulatingStunThreshold(
                  this.actor,
                ),
                total: firstEditionStuns.total,
              },
        firstEditionDefenseKinds,
        firstEditionActiveDefense:
          firstEditionActiveDefense === undefined
            ? null
            : {
                ...firstEditionActiveDefense,
                modeLabel: game.i18n.localize(
                  firstEditionActiveDefense.mode === "full"
                    ? "D6E2.Combat.FirstEdition.FullDefense"
                    : "D6E2.Combat.FirstEdition.PartialDefense",
                ),
              },
        condition,
        conditionEditable:
          this.isEditable &&
          (!firstEditionDamage || firstEditionDamageMode === "wounds"),
        conditionLabel:
          healthStrategy.id === "open-d6.damage.body-points"
            ? `${bodyPoints.current} / ${bodyPoints.maximum}`
            : terminologyHealthStateLabel(
                terminology,
                healthStrategy.id,
                condition as Parameters<typeof terminologyHealthStateLabel>[2],
              ),
        conditionTrackLabel: terminologyHealthTrackLabel(
          terminology,
          healthStrategy.id,
        ),
        activeDicePenaltyLabel:
          activeDicePenaltyScore > 0
            ? `−${formatPipScore(activeDicePenaltyScore)}`
            : "",
        headerStatuses,
        conditions,
        firstEditionBodyPoints:
          firstEditionDamage && firstEditionDamageMode !== "wounds"
            ? {
                current: bodyPoints.current,
                currentLabel: terminologyBodyPointLabel(terminology, "current"),
                maximum: bodyPoints.maximum,
                maximumLabel: terminologyBodyPointLabel(terminology, "maximum"),
                mode: firstEditionDamageMode,
                percentage:
                  bodyPoints.maximum <= 0
                    ? 0
                    : Math.max(
                        0,
                        Math.ceil(
                          (bodyPoints.current / bodyPoints.maximum) * 100,
                        ),
                      ),
                canEditMaximum: this.isEditable && sheetMode === "freeedit",
                canGenerate: this.isEditable,
              }
            : null,
        environment:
          environmentEffect === null
            ? null
            : {
                ...environmentEffect,
                hazardLabel: game.i18n.localize(
                  `D6E2.Environment.Hazard.${environmentEffect.hazard}`,
                ),
                penaltyLabel: formatPipScore(environmentEffect.penaltyScore),
                severityLabel: game.i18n.localize(
                  `D6E2.Environment.Severity.${environmentEffect.severity}`,
                ),
              },
        walkDistance: environmentEffect?.halfMove ? 2.5 : 5,
        runDistance: environmentEffect?.halfMove ? 5 : 10,
        crawlDistance: environmentEffect?.halfMove ? 1 : 2,
        dodge: secondEditionDefenses
          ? (fullDefense?.dodge ?? dodge)
          : undefined,
        dodgeBasisFlying: dodgeBasis === "flying",
        dodgeBasisPerception: dodgeBasis === "perception",
        flyingDodgeAvailable:
          secondEditionDodgeDefense &&
          flyingDodgeAvailable &&
          !isCreature &&
          this.isEditable,
        flyingGuidance:
          flyingGuidance === null
            ? null
            : {
                flyMeters: flyingGuidance.flyMeters,
                hoverRounds: flyingGuidance.hoverRounds,
                scoreLabel: formatPipScore(flyingGuidance.score),
              },
        dodgeBasisHelp: game.i18n.localize(
          dodgeBasis === "flying"
            ? "D6E2.Combat.FlyingDefense"
            : "D6E2.Combat.PerceptionDefense",
        ),
        parry: secondEditionDefenses
          ? (fullDefense?.parry ?? parry)
          : undefined,
        activeResponsiveCombat,
        activeResponsiveState: fullDefense
          ? game.i18n.localize("D6E2.Combat.ActiveResponsive.FullDefenseActive")
          : roundState?.secondEditionFeint
            ? game.i18n.format("D6E2.Combat.ActiveResponsive.FeintActive", {
                target: roundState.secondEditionFeint.targetName,
              })
            : "",
        canEnterFullDefense:
          activeResponsiveCombat &&
          this.isEditable &&
          roundState !== null &&
          roundState.actions.length === 0 &&
          roundState.completedActionIds.length === 0,
        canFeint:
          activeResponsiveCombat &&
          this.isEditable &&
          roundState !== null &&
          meleeScore >= 12 &&
          roundState.actions.length === 0,
        posture,
        prone: posture === "prone",
        proneClass: posture === "prone" ? "is-active" : "",
        standing: posture === "standing",
        standingClass: posture === "standing" ? "is-active" : "",
        postureLabel: game.i18n.localize(
          posture === "prone"
            ? "D6E2.Combat.Posture.Prone"
            : "D6E2.Combat.Posture.Standing",
        ),
        rangedDodge: secondEditionCombat
          ? secondEditionDefenseForPosture(
              fullDefense?.dodge ?? dodge,
              "ranged",
              posture,
            )
          : undefined,
        meleeParry: secondEditionCombat
          ? secondEditionDefenseForPosture(
              fullDefense?.parry ?? parry,
              "melee",
              posture,
            )
          : undefined,
        scale:
          currentScaleRuntimeStrategy().family === "scalar"
            ? Math.max(0, integer(system.scale))
            : Math.min(6, Math.max(0, integer(system.scale))),
        scaleScalar: currentScaleRuntimeStrategy().family === "scalar",
        scaleSide: stringValue(system.scaleSide, "human"),
        scaleSideOptions: {
          human: game.i18n.localize("D6E2.Combat.ScaleSide.human"),
          larger: game.i18n.localize("D6E2.Combat.ScaleSide.larger"),
          smaller: game.i18n.localize("D6E2.Combat.ScaleSide.smaller"),
          unresolved: game.i18n.localize("D6E2.Combat.ScaleSide.unresolved"),
        },
        resistance:
          resistancePlan === null
            ? null
            : {
                armorLabel: formatPipScore(resistancePlan.armorScore),
                brawnLabel: formatPipScore(resistancePlan.brawnScore),
                capped: resistancePlan.capped,
                contributorLabel:
                  resistancePlan.contributors.length > 0
                    ? resistancePlan.contributors
                        .map(
                          (item) =>
                            `${item.label} +${formatPipScore(item.score)}`,
                        )
                        .join(" · ")
                    : game.i18n.localize("D6E2.Combat.NoArmorContribution"),
                scoreLabel: formatPipScore(resistancePlan.score),
                maximumLabel:
                  resistancePlan.maximumScore === undefined
                    ? undefined
                    : formatPipScore(resistancePlan.maximumScore),
                maximumClass: resistancePlan.capped ? "is-warning" : "",
                uncappedLabel: formatPipScore(resistancePlan.uncappedScore),
              },
        creatureDefenseOverrides: isCreature
          ? {
              dodge: creatureDodgeOverride,
              parry: creatureParryOverride,
              source: "D62e p. 132",
            }
          : null,
        roundState,
        roundStateClass:
          roundState?.actionForfeiture?.reason === "wounded"
            ? "is-forfeited"
            : roundState?.complete
              ? "is-complete"
              : "",
        roundActions,
        canDeclareActions:
          this.isEditable &&
          roundState !== null &&
          roundState.completedActionIds.length === 0 &&
          roundState.actionForfeiture === undefined,
        canCompleteAction:
          this.isEditable &&
          roundState !== null &&
          roundState.actions.length > 0 &&
          !roundState.complete,
        canResetActions:
          this.isEditable &&
          roundState !== null &&
          (isGM ||
            (roundState.actionForfeiture === undefined &&
              roundState.completedActionIds.length === 0 &&
              (roundState.firstEditionCommitment?.spentActionCount ?? 0) ===
                0)),
        canCommitFirstEditionActions:
          this.isEditable &&
          roundState !== null &&
          (isGM ||
            (roundState.firstEditionCommitment?.spentActionCount ?? 0) === 0),
        canSpendFirstEditionAction:
          this.isEditable &&
          roundState !== null &&
          roundState.firstEditionRemainingActionCount > 0 &&
          (!firstEditionSegmentedActions ||
            (roundState.firstEditionSegmentReady &&
              roundState.firstEditionNextCombatantId ===
                roundState.combatantId)),
        canRollFirstEditionDefense:
          this.isEditable &&
          roundState?.firstEditionCommitment?.defense !== undefined &&
          roundState.firstEditionCommitment.defense !== "none" &&
          roundState.firstEditionActiveDefense === undefined,
        secondEdition: secondEditionCombat,
        secondEditionDefenses,
        secondEditionDodgeDefense,
        secondEditionMovement,
        weapons: combatItems,
      },
      characterSheetLabel:
        terminology.characterSheetLabel ??
        game.i18n.localize("D6E2.Actor.CharacterRecord"),
      editable: this.isEditable,
      companionDetails: {
        allegianceLabel: terminology.details.allegiance,
        currencyLabel: economyCurrencyLabel(),
        allegiance: stringValue(record(system.profile).allegiance),
        currency: actorCurrency(this.actor),
      },
      economy: {
        canSpend:
          currencyTransactionsEnabled &&
          (isGM || this.actor.isOwner === true) &&
          actorCurrency(this.actor) > 0,
        canTransfer:
          currencyTransactionsEnabled &&
          (isGM || this.actor.isOwner === true) &&
          actorCurrency(this.actor) > 0 &&
          transferRecipients.length > 0,
        currencyEnabled: currencyTransactionsEnabled,
        directEdit: canDirectEditResources,
      },
      canSynchronizeSkills: false,
      fatePoints: integer(fatePoints.value),
      openD6MetaCurrency:
        metaCurrencyStrategy.primaryResource === "characterPoints",
      freeEdit: sheetMode === "freeedit" && isGM && this.isEditable,
      heroPoints: classicHeroPoints
        ? integer(experiencePoints.value)
        : integer(heroPoints.value),
      heroPointResourcePath: classicHeroPoints
        ? "system.resources.experiencePoints.value"
        : "system.resources.heroPoints.value",
      classicHeroPoints,
      canEditHeroPoints: canDirectEditResources,
      magicPointResource,
      showMagicPoints: magicPointResource !== null,
      baseMove,
      showBaseMove: firstEditionMovement,
      isGM,
      equipmentGroups,
      traitGroups,
      rulesProfile,
      resourceLabels: {
        characterPoints:
          terminology.resources.characterPoints ??
          game.i18n.localize("D6E2.CharacterPoints"),
        fatePoints:
          terminology.resources.fatePoints ??
          game.i18n.localize("D6E2.FatePoints"),
        heroPoints: classicHeroPoints
          ? game.i18n.localize("D6E2.HeroExperiencePoints")
          : (terminology.resources.heroPoints ??
            game.i18n.localize("D6E2.HeroPoints")),
      },
      sheetMode,
      sheetModes: [
        {
          label: game.i18n.localize("D6E2.SheetMode.Normal"),
          selected: sheetMode === "normal",
          value: "normal",
        },
        {
          label: game.i18n.localize("D6E2.SheetMode.Advance"),
          selected: sheetMode === "advance",
          value: "advance",
        },
        ...(isGM
          ? [
              {
                label: game.i18n.localize("D6E2.SheetMode.FreeEdit"),
                selected: sheetMode === "freeedit",
                value: "freeedit",
              },
            ]
          : []),
      ],
      systemLabel:
        terminology.systemLabel ??
        (currentAttributeRuntimeStrategy().family === "open-d6"
          ? game.i18n.localize("D6E2.OpenD6Compatible")
          : game.i18n.localize("D6E2.SecondEdition")),
      settingLabel: currentSettingProfile().label,
      settingLogo: currentSettingProfile().logo,
      settingLogoAsWatermark: currentSettingProfile().logoAsWatermark,
      settingLogoClass: currentSettingProfile().logoAsWatermark
        ? "is-watermark"
        : "is-row-logo",
      skillTree: (() => {
        const module = foundryModule("skill-tree");
        const active = module?.active === true;
        const api = module?.API;
        const available = active && api?.apps?.SkillTreeActor !== undefined;
        return Object.freeze({
          active,
          available,
          help: game.i18n.localize(
            available
              ? "D6E2.SkillTree.OpenHelp"
              : "D6E2.SkillTree.Unavailable",
          ),
        });
      })(),
      ...(activeTabFamily ? { activeTabFamily } : {}),
      tabFamilies,
      tabs,
    });
  }

  _preparePartContext(
    partId: string,
    context: CharacterSheetContext,
  ): Promise<CharacterSheetContext> {
    if (!["header", "controls", "tabs"].includes(partId)) {
      const tab = context.tabs[partId];
      if (tab) context.tab = tab;
    }
    return Promise.resolve(context);
  }

  override _configureRenderOptions(options: { parts: string[] }): void {
    super._configureRenderOptions(options);
    const tabs = this.#tabs();
    options.parts = options.parts.filter(
      (partId) =>
        ![
          "psionics",
          "extraordinaryPowers",
          "cyberpunk",
          "superheroic",
        ].includes(partId) || tabs[partId] !== undefined,
    );
  }

  override _attachPartListeners(
    partId: string,
    htmlElement: HTMLElement,
    options: Record<string, unknown>,
  ): void {
    super._attachPartListeners(partId, htmlElement, options);
    bindActorItemDropTarget(htmlElement, {
      canDrag: () => this.isEditable,
      dragend: this.#clearDropState,
      dragleave: this.#clearDropState,
      dragover: this.#dragOver,
      dragstart: this.#dragItem,
      drop: this.#dropItem,
    });
    htmlElement.addEventListener(
      "focusin",
      this.#focusedFieldRenderGuard.trackFocusIn,
    );
    htmlElement.addEventListener(
      "focusout",
      this.#focusedFieldRenderGuard.trackFocusOut,
    );
    htmlElement.addEventListener("change", this.#persistChange);
    htmlElement.addEventListener("input", this.#persistDirectResourceInput);
  }

  override render(force?: boolean): unknown {
    if (this.#focusedFieldRenderGuard.deferRenderWhileEditing()) return this;
    return super.render(force);
  }

  #tabs(): Readonly<Record<string, SheetTab>> {
    const group = "primary";
    const extraordinaryPowers = extraordinaryPowerSheetModel(
      this.actor,
      systemApi(),
    );
    this.tabGroups[group] ||= "attributes";
    const definitions = {
      attributes: {
        icon: "fa-solid fa-chart-simple",
        label: "D6E2.Tab.AttributesSkills",
      },
      biography: {
        icon: "fa-solid fa-id-card",
        label: "D6E2.Biography",
      },
      traits: {
        icon: "fa-solid fa-star",
        label: "D6E2.Tab.Traits",
      },
      equipment: {
        icon: "fa-solid fa-suitcase",
        label: "D6E2.Tab.Equipment",
      },
      combat: {
        icon: "fa-solid fa-crosshairs",
        label: "D6E2.Tab.Combat",
      },
      ...(currentSecondEditionCampaignProfile().psionics
        ? {
            psionics: {
              icon: "fa-solid fa-brain",
              label: "D6E2.Psionics.Tab",
            },
          }
        : {}),
      ...(extraordinaryPowers.frameworks.length > 0
        ? {
            extraordinaryPowers: {
              icon: "fa-solid fa-wand-sparkles",
              label:
                extraordinaryPowers.frameworks[0]?.label ??
                "D6E2.ExtraordinaryPower.Tab",
            },
          }
        : {}),
      ...(currentSecondEditionCampaignProfile().cyberpunk
        ? {
            cyberpunk: {
              icon: "fa-solid fa-microchip",
              label: "D6E2.Cyberpunk.Tab",
            },
          }
        : {}),
      ...(currentSecondEditionCampaignProfile().superheroicSkills ||
      currentSecondEditionCampaignProfile().superheroicHeroPoints ||
      currentSecondEditionCampaignProfile().superheroicDieCodeCap !== "none" ||
      currentSecondEditionCampaignProfile().secretIdentities ||
      currentSecondEditionCampaignProfile().superpowers ||
      currentSecondEditionCampaignProfile().gadgetsGear ||
      currentSecondEditionCampaignProfile().nemesisCompanionsSidekicks
        ? {
            superheroic: {
              icon: "fa-solid fa-mask",
              label: "D6E2.Superheroic.Tab",
            },
          }
        : {}),
    } as const;
    return Object.fromEntries(
      Object.entries(definitions).map(([id, definition]) => [
        id,
        {
          cssClass: this.tabGroups[group] === id ? "active" : "",
          group,
          icon: definition.icon,
          id,
          label: definition.label,
        },
      ]),
    );
  }

  #tabFamilies(
    tabs: Readonly<Record<string, SheetTab>>,
  ): readonly SheetTabFamily[] {
    const activeTab = this.tabGroups.primary ?? "attributes";
    const definitions = [
      {
        icon: "fa-solid fa-user",
        id: "character",
        label: "D6E2.TabGroup.Character",
        tabIds: ["attributes", "combat"],
      },
      {
        icon: "fa-solid fa-address-card",
        id: "profile",
        label: "D6E2.TabGroup.Profile",
        tabIds: ["biography", "traits"],
      },
      {
        icon: "fa-solid fa-suitcase",
        id: "gear",
        label: "D6E2.TabGroup.Gear",
        tabIds: ["equipment"],
      },
      {
        icon: "fa-solid fa-wand-sparkles",
        id: "powers",
        label: "D6E2.TabGroup.Powers",
        tabIds: ["extraordinaryPowers", "psionics", "cyberpunk", "superheroic"],
      },
    ] as const;
    return definitions.flatMap((definition) => {
      const familyTabs = definition.tabIds.flatMap((id) =>
        tabs[id] ? [tabs[id]] : [],
      );
      if (familyTabs.length === 0) return [];
      const active = familyTabs.some(({ id }) => id === activeTab);
      if (active) this.#lastFamilyTab[definition.id] = activeTab;
      const flattenedTab =
        definition.id === "powers" && familyTabs.length === 1
          ? familyTabs[0]
          : undefined;
      return [
        Object.freeze({
          active,
          cssClass: active ? "active" : "",
          icon: flattenedTab?.icon ?? definition.icon,
          id: definition.id,
          label: flattenedTab?.label ?? definition.label,
          showChildNavigation: familyTabs.length > 1,
          tabs: Object.freeze(familyTabs),
        }),
      ];
    });
  }
}
