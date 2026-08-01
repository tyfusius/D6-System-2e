import {
  advancedSkillAugmentedScore,
  canPreventBecomingStunned,
  FIRST_EDITION_WOUND_LEVELS,
  firstEditionAssistedHealingDifficulty,
  firstEditionNaturalHealingRule,
  firstEditionMortalityElapsedMinutes,
  formatPipScore,
  isFirstEditionWoundLevel,
  isSecondEditionCondition,
  nextSecondEditionCreationScore,
  SECOND_EDITION_CONDITIONS,
  secondEditionConditionAllowsActions,
  secondEditionConditionPenaltyScore,
  secondEditionDefenseForPosture,
  secondEditionStaticDefense,
  specializationScore,
  type D6CombatActionKind,
  type FirstEditionActiveDefenseKind,
  type FirstEditionWoundLevel,
  type SecondEditionMovementMode,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../../constants";
import { currentTerminology } from "../../registries/terminology";
import { currentRulesProfile } from "../../settings/rules-compatibility";
import {
  booleanSetting,
  currentActionDeclarationAssistance,
} from "../../settings/setting-values";
import {
  campaignOptionalAttributeIds,
  currentSecondEditionCampaignProfile,
} from "../../settings/campaign-profile";
import { currentEditionCapabilityProfile } from "../../settings/edition-capabilities";
import { SHARED_SETTING_KEYS } from "../../settings/settings-catalog";
import {
  currentCombinedPipScore,
  currentEffectivePipScore,
  currentPipsEnabled,
} from "../../settings/pip-rules";
import {
  adjustCreationAttribute,
  adjustCreationSkill,
  characterCreationProgress,
  createCreationAdvancedSkill,
  createCreationSpecialization,
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
  effectiveCharacterSheetMode,
  maySelectCharacterSheetMode,
} from "./sheet-mode";
import {
  activeAttributeDefinitions,
  integer,
  record,
  stringValue,
} from "./values";
import { actorResistancePlan } from "../rolls/roll-service";
import { openDocumentImagePicker } from "./open-document-image-picker";
import { combatDeclarationOptions } from "../combat-service";
import { planFirstEditionActorMovement } from "../first-edition-movement-service";
import { readActorEnvironmentEffect } from "../environment-state";
import { currentSecondEditionHeroPointStrategy } from "../../settings/hero-points";
import { actorHeroPointBalance } from "../hero-point-service";
import {
  resolveFirstEditionAssistedHealing,
  resolveFirstEditionMortalityCheck,
  resolveFirstEditionNaturalHealing,
} from "../first-edition-healing-service";
import {
  clearFirstEditionUnconsciousness,
  readFirstEditionInjuryState,
  resolveFirstEditionIncapacitation,
} from "../first-edition-injury-service";

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
  readonly canIncreaseCreation: boolean;
  readonly id: string;
  readonly linkedAdvancedSkills: readonly LinkedAdvancedSkillView[];
  readonly name: string;
  readonly parentSkillName: string;
  readonly rollable: boolean;
  readonly score: number;
  readonly scoreLabel: string;
  readonly showAdvanceControl: boolean;
  readonly showSpecializationAcquisition: boolean;
  readonly specializationAcquisitionCost: number;
  readonly specializationAcquisitionHelp: string;
  readonly training: "advanced" | "specialization" | "standard";
}

interface CharacterAttributeView {
  readonly advanceCost: number;
  readonly advanceResourceLabel: string;
  readonly canAdvance: boolean;
  readonly canIncreaseCreation: boolean;
  readonly id: string;
  readonly label: string;
  readonly rollable: boolean;
  readonly score: number;
  readonly scoreLabel: string;
  readonly skills: readonly CharacterSkillView[];
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

interface CharacterSheetContext extends Record<string, unknown> {
  tab?: SheetTab;
  tabs: Readonly<Record<string, SheetTab>>;
}

interface FirstEditionActionSelection {
  readonly actionAllotment: number;
  readonly defense: "full-defense" | "none" | "partial-defense";
  readonly plannedActionCount: number;
  readonly spentActionCount: number;
}

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
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/actor/character/prevent-stunned.hbs`,
    {},
  );
  const result = await foundry.applications.api.DialogV2.wait<
    "accept" | "prevent"
  >({
    buttons: [
      {
        action: "accept",
        callback: () => "accept",
        label: game.i18n.localize("D6E2.Condition.AcceptStunned"),
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
      title: game.i18n.localize("D6E2.Condition.StunnedIncoming"),
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

interface SkillNameSelection {
  readonly name: string;
}

interface AdvancedSkillDefinition {
  readonly name: string;
  readonly prerequisiteSkillKeys: readonly string[];
}

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
  const profile = currentRulesProfile();
  const attributeChoices = activeAttributeDefinitions(
    profile.compatibility.firstEditionAttributes,
    campaignOptionalAttributeIds(),
  ).map(({ id, label }) => {
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
        item.system.training === "advanced"
          ? currentEffectivePipScore(stored)
          : currentCombinedPipScore(attributeScore, stored);
      const target = current + 3;
      return {
        label: `${item.name} · ${formatPipScore(current)} → ${formatPipScore(target)} · ${Math.floor(target / 3)} ${game.i18n.localize("D6E2.Advancement.NarrativeSteps")}`,
        value: `skill:${item.id}`,
      };
    });
  const perkChoices =
    currentEditionCapabilityProfile().rankedFeatures.state === "active"
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
): Promise<AdvancedSkillDefinition | null> {
  const choices = actor.items.contents
    .filter(
      (item) => item.type === "skill" && item.system.training !== "advanced",
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
  let currentKeys: readonly string[] = [];
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
  const profile = currentRulesProfile();
  const terminology = currentTerminology();
  const attributeOptions = activeAttributeDefinitions(
    profile.compatibility.firstEditionAttributes,
    campaignOptionalAttributeIds(),
  ).map(({ id, label }) => ({
    label: terminology.attributes[id] ?? game.i18n.localize(label),
    value: `attribute:${id}`,
  }));
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
  static PARTS = {
    header: {
      template: `systems/${SYSTEM_ID}/templates/actor/character/header.hbs`,
    },
    controls: {
      template: `systems/${SYSTEM_ID}/templates/actor/character/controls.hbs`,
    },
    tabs: {
      template: "templates/generic/tab-navigation.hbs",
    },
    attributes: {
      scrollable: [""],
      template: `systems/${SYSTEM_ID}/templates/actor/character/attributes.hbs`,
    },
    biography: {
      scrollable: [""],
      template: `systems/${SYSTEM_ID}/templates/actor/character/biography.hbs`,
    },
    items: {
      scrollable: [""],
      template: `systems/${SYSTEM_ID}/templates/actor/character/items.hbs`,
    },
    combat: {
      scrollable: [""],
      template: `systems/${SYSTEM_ID}/templates/actor/character/combat.hbs`,
    },
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
    const creationEdit =
      record(this.actor.system.creation).active === true &&
      this.actor.isOwner === true;
    if (
      !this.isEditable ||
      (!creationEdit &&
        !mayDirectEditMechanicalScore(storedMode, game.user?.isGM === true))
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
    const baseMove = Math.max(
      1,
      integer(record(this.actor.system.movement).base),
    );
    const roundState = game.system.api?.combat.read(this.actor) ?? null;
    const content = await foundry.applications.handlebars.renderTemplate(
      `systems/${SYSTEM_ID}/templates/actor/character/first-edition-movement.hbs`,
      { freeDistance: baseMove / 2 },
    );
    const input = await foundry.applications.api.DialogV2.wait<{
      distance: number;
      terrainModifier: number;
      type: "climb" | "fly" | "land" | "swim";
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
              distance: Number(data.get("distance")),
              terrainModifier: Number(data.get("terrainModifier")),
              type: type as "climb" | "fly" | "land" | "swim",
            };
          },
          class: "od6roll-submit",
          default: true,
          icon: "fa-solid fa-person-running",
          label: game.i18n.localize("D6E2.Combat.FirstEdition.PlanMovement"),
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
      await planFirstEditionActorMovement(this.actor, {
        ...input,
        baseMove,
        ...(roundState === null
          ? {}
          : { expectedRevision: roundState.revision }),
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
    const conditionValue = record(this.actor.system.health).condition;
    const condition = isSecondEditionCondition(conditionValue)
      ? conditionValue
      : "healthy";
    const environmentEffect =
      currentEditionCapabilityProfile().environments.state === "active"
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
        conditionPenaltyScore: secondEditionConditionPenaltyScore(condition),
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
    if (
      currentEditionCapabilityProfile().damage.strategy ===
      "open-d6-wounds-or-body-points"
    ) {
      if (!isFirstEditionWoundLevel(condition)) return;
      await game.system.api?.health.wound(this.actor, condition);
      this.render();
      return;
    }
    if (!isSecondEditionCondition(condition)) return;
    const health = record(this.actor.system.health);
    const current = isSecondEditionCondition(health.condition)
      ? health.condition
      : "healthy";
    const heroPoints = actorHeroPointBalance(this.actor);
    const mayPrevent =
      !currentRulesProfile().compatibility.firstEditionMetaCurrency &&
      currentSecondEditionHeroPointStrategy() === "heroic" &&
      heroPoints > 0 &&
      canPreventBecomingStunned(current, condition);
    const stunnedChoice = mayPrevent
      ? await promptStunnedPrevention()
      : "accept";
    if (stunnedChoice === null) return;
    const result = await game.system.api?.health.condition(
      this.actor,
      condition,
      {
        preventStunnedWithHeroPoint: stunnedChoice === "prevent",
      },
    );
    if (result?.prevented) {
      ui.notifications.info(
        game.i18n.localize("D6E2.Condition.StunnedPrevented"),
      );
    }
    this.render();
  };

  static readonly #resolveNaturalHealing = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    if (!this.isEditable) return;
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
    const result = await resolveFirstEditionAssistedHealing(
      this.actor,
      healer,
      selection.itemId,
    );
    if (!result) return;
    ui.notifications.info(
      game.i18n.localize(
        `D6E2.Combat.FirstEdition.Healing.Outcome.${result.outcome}`,
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
        void this.actor.update({ "system.sheetMode.value": "normal" });
        return;
      }
      void this.actor.update({ "system.sheetMode.value": input.value });
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
      void item.update({
        [itemField]:
          input instanceof HTMLInputElement && input.type === "number"
            ? input.valueAsNumber
            : input.value,
      });
      return;
    }

    if (!input.name || !this.isEditable) return;
    const value =
      input instanceof HTMLInputElement && input.type === "number"
        ? input.valueAsNumber
        : input.value;
    void this.actor.update({ [input.name]: value });
  };

  static DEFAULT_OPTIONS = {
    actions: {
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
      createItem: this.#createItem,
      declareCombatActions: this.#declareCombatActions,
      deleteItem: this.#deleteItem,
      editImage: this.#editImage,
      editItem: this.#editItem,
      finalizeCharacterCreation: this.#finalizeCharacterCreation,
      exchangeMilestonePerk: this.#exchangeMilestonePerk,
      invokeFeature: this.#invokeFeature,
      completeCombatAction: this.#completeCombatAction,
      commitFirstEditionActions: this.#commitFirstEditionActions,
      rollAttribute: this.#rollAttribute,
      rollCombatItem: this.#rollCombatItem,
      rollCombatItemDamage: this.#rollCombatItemDamage,
      rollFirstEditionDefense: this.#rollFirstEditionDefense,
      clearUnconsciousness: this.#clearUnconsciousness,
      resolveAssistedHealing: this.#resolveAssistedHealing,
      resolveMortalityCheck: this.#resolveMortalityCheck,
      resolveNaturalHealing: this.#resolveNaturalHealing,
      resolveIncapacitationCheck: this.#resolveIncapacitationCheck,
      planFirstEditionMovement: this.#planFirstEditionMovement,
      rollResistance: this.#rollResistance,
      rollLinkedAdvancedSkill: this.#rollLinkedAdvancedSkill,
      rollSkill: this.#rollSkill,
      setCondition: this.#setCondition,
      setPosture: this.#setPosture,
      resetCombatActions: this.#resetCombatActions,
      spendFirstEditionAction: this.#spendFirstEditionAction,
      resetFeatureSession: this.#resetFeatureSession,
      proposeNarrativeArc: this.#proposeNarrativeArc,
      removeNarrativeArc: this.#removeNarrativeArc,
      synchronizeSkills: this.#synchronizeSkills,
      toggleEquipped: this.#toggleEquipped,
      toggleNarrativeStep: this.#toggleNarrativeStep,
    },
    classes: ["d6e2", "d6e2-character-v2", "od6s-character-v2"],
    form: {
      closeOnSubmit: false,
      handler: this.#submitSheet,
      submitOnChange: false,
      submitOnClose: true,
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
    const sheetMode = effectiveCharacterSheetMode(storedSheetMode, isGM);
    const rulesProfile = currentRulesProfile();
    const editionCapabilities = currentEditionCapabilityProfile();
    const terminology = currentTerminology();
    const resources = record(system.resources);
    const heroPoints = record(resources.heroPoints);
    const characterPoints = record(resources.characterPoints);
    const fatePoints = record(resources.fatePoints);
    const experiencePoints = record(resources.experiencePoints);
    const heroPointStrategy = currentSecondEditionHeroPointStrategy();
    const classicHeroPoints = heroPointStrategy === "classic";
    const advancementStrategy = editionCapabilities.advancement.strategy;
    const advancementUsesExperiencePoints =
      advancementStrategy === "second-edition-experience-points";
    const milestoneAdvancement =
      advancementStrategy === "second-edition-milestone" &&
      sheetMode === "advance";
    const narrativeAdvancement =
      advancementStrategy === "second-edition-narrative" &&
      sheetMode === "advance";
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
      editionCapabilities.advancement.state === "active";
    const creation = characterCreationProgress(this.actor);
    const featureSession = game.system.api?.features.read(this.actor);
    const campaignProfile = currentSecondEditionCampaignProfile();

    const mechanicalDocuments = this.actor.items.contents
      .filter((item) => ["skill", "specialization"].includes(item.type))
      .map((item) => {
        return {
          attributeId:
            typeof item.system.attributeId === "string"
              ? item.system.attributeId
              : "",
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
                : ("standard" as const),
        };
      });
    const skillById = new Map(
      mechanicalDocuments
        .filter((item) => item.training !== "specialization")
        .map((item) => [item.id, item]),
    );
    const skillByKey = new Map(
      this.actor.items.contents
        .filter((item) => item.type === "skill")
        .map((item) => [stringValue(item.system.key), item.id]),
    );

    const attributeViews: readonly CharacterAttributeView[] =
      activeAttributeDefinitions(
        rulesProfile.compatibility.firstEditionAttributes,
        campaignOptionalAttributeIds(campaignProfile),
      ).map(({ id, label }) => {
        const value = record(attributes[id]);
        const attributeScore = integer(value.score);
        const effectiveAttributeScore =
          currentEffectivePipScore(attributeScore);
        const skills = mechanicalDocuments
          .filter(
            (skill) =>
              skill.attributeId === id && skill.training !== "advanced",
          )
          .map((skill): CharacterSkillView => {
            const parent =
              skill.training === "specialization"
                ? (skillById.get(skill.parentSkillId) ??
                  skillById.get(skillByKey.get(skill.parentSkillKey) ?? ""))
                : undefined;
            const parentScore =
              parent?.training === "advanced" &&
              editionCapabilities.advancedSkills.state === "active"
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
            const acquisitionPlan =
              document && skill.training === "standard"
                ? specializationAcquisitionPlan(this.actor, document)
                : undefined;
            const showSpecializationAcquisition =
              advancementEnabled &&
              advancementStrategy === "second-edition-experience-points" &&
              editionCapabilities.advancedSkills.state === "active" &&
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
                                advancementStrategy ===
                                  "character-point-advancement"
                                  ? "D6E2.Advancement.OpenD6Ready"
                                  : advancementStrategy ===
                                      "second-edition-experience-points"
                                    ? "D6E2.Advancement.ExperienceReady"
                                    : advancementStrategy ===
                                        "second-edition-milestone"
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
                          editionCapabilities.advancedSkills.state ===
                            "active" &&
                          candidateDocument !== undefined &&
                          advancedSkillIssues(this.actor, candidateDocument)
                            .length === 0,
                        score: candidate.score,
                        scoreLabel: formatPipScore(advancedScore),
                      });
                    })
                    .sort((left, right) => left.name.localeCompare(right.name))
                : [];
            return Object.freeze({
              ...skill,
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
              rollable:
                score >= 3 &&
                (skill.training !== "advanced" ||
                  editionCapabilities.advancedSkills.state === "active"),
              scoreLabel: formatPipScore(score),
              showAdvanceControl:
                skill.training !== "specialization" ||
                advancementStrategy === "character-point-advancement",
              showSpecializationAcquisition,
              specializationAcquisitionCost: acquisitionPlan?.cost ?? 0,
              specializationAcquisitionHelp,
            });
          });
        const plan = attributeAdvancementPlan(this.actor, id);
        const nextCreationScore = Math.min(
          15,
          nextSecondEditionCreationScore(
            attributeScore,
            1,
            currentPipsEnabled(),
          ),
        );
        return Object.freeze({
          advanceCost: plan.cost,
          advanceResourceLabel: advancementPlanResourceLabel(plan.resource),
          canAdvance:
            advancementEnabled &&
            plan.active &&
            plan.affordable &&
            plan.nextScore <= 15,
          canIncreaseCreation:
            nextCreationScore > attributeScore &&
            nextCreationScore - attributeScore <= creation.attributes.remaining,
          id,
          label: terminology.attributes[id] ?? game.i18n.localize(label),
          rollable: effectiveAttributeScore >= 3,
          score: attributeScore,
          scoreLabel: formatPipScore(effectiveAttributeScore),
          skills: Object.freeze(skills),
        });
      });

    const attributeColumns = [
      attributeViews.filter((_attribute, index) => index % 2 === 0),
      attributeViews.filter((_attribute, index) => index % 2 === 1),
    ];
    const tabs = this.#tabs();
    const itemTypes = [
      "perk",
      "flaw",
      "talent",
      "trouble",
      "asset",
      ...(booleanSetting(SHARED_SETTING_KEYS.showAdvantagesDisadvantages, true)
        ? ["advantage", "disadvantage"]
        : []),
      "specialability",
      ...(booleanSetting(SHARED_SETTING_KEYS.showSpecializations, true)
        ? ["specialization"]
        : []),
      "manifestation",
      "weapon",
      "armor",
      "gear",
      "cybernetic",
    ];
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
    const itemGroups = itemTypes.map((type) => ({
      canCreate:
        !["flaw", "perk", "talent"].includes(type) ||
        creation.active ||
        (isGM && sheetMode === "freeedit"),
      items: this.actor.items.contents
        .filter((item) => item.type === type)
        .map((item): CharacterItemView => {
          const plan =
            item.type === "specialization"
              ? itemAdvancementPlan(this.actor, item)
              : undefined;
          const equipmentEra = stringValue(
            record(record(item.system).equipmentProvenance).era,
            "none",
          );
          return {
            advanceCost: plan?.cost ?? 0,
            canAdvance:
              advancementEnabled &&
              (plan?.active ?? false) &&
              (plan?.affordable ?? false),
            equippable: equippableItemTypes.has(item.type),
            equipped: record(item.system).equipped === true,
            id: item.id,
            img: item.img,
            canInvokeFeature:
              ["asset", "trouble"].includes(item.type) &&
              editionCapabilities.narrativeFeatures.state === "active" &&
              integer(featureSession?.uses[item.id]) < 2 &&
              this.actor.isOwner === true,
            featureUses: integer(featureSession?.uses[item.id]),
            featureUsesMaximum:
              ["asset", "trouble"].includes(item.type) &&
              editionCapabilities.narrativeFeatures.state === "active"
                ? 2
                : 0,
            name: item.name,
            quantity: Math.max(0, integer(record(item.system).quantity)),
            type: item.type,
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
      label: game.i18n.localize(itemLabels[type] ?? "D6E2.Item.Item"),
      type,
    }));
    const health = record(system.health);
    const firstEditionDamage =
      editionCapabilities.damage.strategy === "open-d6-wounds-or-body-points";
    const condition = firstEditionDamage
      ? isFirstEditionWoundLevel(health.firstEditionWound)
        ? health.firstEditionWound
        : "healthy"
      : isSecondEditionCondition(health.condition)
        ? health.condition
        : "healthy";
    const posture =
      record(system.movement).posture === "prone" ? "prone" : "standing";
    const environmentEffect =
      editionCapabilities.environments.state === "active"
        ? readActorEnvironmentEffect(this.actor)
        : null;
    const conditionLabel = (value: string): string =>
      game.i18n.localize(
        `D6E2.Condition.${value
          .split("-")
          .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
          .join("")}`,
      );
    const conditions = (
      firstEditionDamage
        ? FIRST_EDITION_WOUND_LEVELS
        : SECOND_EDITION_CONDITIONS
    ).map((value) => ({
      cssClass: condition === value ? "is-current" : "",
      current: condition === value,
      label: conditionLabel(value),
      value,
    }));
    const firstEditionHealingRule = firstEditionDamage
      ? firstEditionNaturalHealingRule(condition as FirstEditionWoundLevel)
      : null;
    const firstEditionMedicineDifficulty = firstEditionDamage
      ? firstEditionAssistedHealingDifficulty(
          condition as FirstEditionWoundLevel,
        )
      : null;
    const firstEditionInjuryState = firstEditionDamage
      ? readFirstEditionInjuryState(this.actor)
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
    const secondEditionCombat = !rulesProfile.compatibility.firstEditionDamage;
    const secondEditionDefenses =
      editionCapabilities.defenses.strategy === "static-defenses" ||
      editionCapabilities.defenses.strategy === "no-dodge-range-difficulties";
    const secondEditionDodgeDefense =
      editionCapabilities.defenses.strategy === "static-defenses";
    const secondEditionMovement =
      editionCapabilities.movement.strategy ===
      "second-edition-segment-movement";
    const firstEditionDefenses =
      editionCapabilities.defenses.strategy === "active-defense-scheduler";
    const firstEditionMovement =
      editionCapabilities.movement.strategy === "open-d6-relative-movement";
    const baseMove = Math.max(1, integer(record(system.movement).base));
    const resistancePlan = secondEditionCombat
      ? actorResistancePlan(this.actor)
      : null;
    const defenses = record(system.defenses);
    const creatureDodgeOverride = integer(defenses.dodgeOverride);
    const creatureParryOverride = integer(defenses.parryOverride);
    const isCreature = this.actor.type === "creature";
    const dodge =
      isCreature && creatureDodgeOverride > 0
        ? creatureDodgeOverride
        : secondEditionStaticDefense(attributeScores.get("perception") ?? 0);
    const parry =
      isCreature && creatureParryOverride > 0
        ? creatureParryOverride
        : secondEditionStaticDefense(attributeScores.get("agility") ?? 0);
    const secondEditionActionSegments =
      editionCapabilities.actionEconomy.strategy ===
        "second-edition-action-segments" &&
      currentActionDeclarationAssistance() !== "manual";
    const firstEditionFlexibleActions =
      editionCapabilities.actionEconomy.strategy ===
        "open-d6-flexible-action-allotment" &&
      currentActionDeclarationAssistance() !== "manual";
    const roundState = game.system.api?.combat.read(this.actor) ?? null;
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
          plannedActionCount: firstEditionCommitment.plannedActionCount,
          remainingActionCount: roundState.firstEditionRemainingActionCount,
          spentActionCount: firstEditionCommitment.spentActionCount,
        }
      : null;
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

    return Promise.resolve({
      actor: this.actor,
      advanceMode: sheetMode === "advance",
      showDirectAdvancementControls:
        sheetMode === "advance" &&
        advancementStrategy !== "second-edition-narrative",
      advancementEnabled,
      advancementHelp: game.i18n.localize(
        advancementStrategy === "character-point-advancement"
          ? "D6E2.Advancement.OpenD6Ready"
          : advancementStrategy === "second-edition-experience-points"
            ? "D6E2.Advancement.ExperienceReady"
            : advancementStrategy === "second-edition-milestone"
              ? "D6E2.Advancement.MilestoneReady"
              : advancementStrategy === "second-edition-narrative"
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
        advancementStrategy === "character-point-advancement" ||
        advancementUsesExperiencePoints,
      milestoneAdvancement,
      milestoneBalance,
      canAwardMilestone: milestoneAdvancement && isGM,
      canExchangeMilestonePerk:
        milestoneAdvancement &&
        milestoneBalance.attributeDice >= 1 &&
        milestoneBalance.skillPips >= 9 &&
        editionCapabilities.rankedFeatures.state === "active",
      narrativeAdvancement,
      narrativeArcs,
      canProposeNarrativeArc:
        narrativeAdvancement && (this.actor.isOwner === true || isGM),
      attributeColumns,
      characterPoints: integer(characterPoints.value),
      canEditExperiencePoints: isGM,
      experiencePoints: integer(experiencePoints.value),
      showExperiencePoints:
        advancementUsesExperiencePoints && !classicHeroPoints,
      campaignProfile,
      campaignProfileLabel: game.i18n.localize(
        campaignProfile.id === "core-default"
          ? "D6E2.Settings.CampaignProfile.CoreDefault"
          : "D6E2.Settings.CampaignProfile.Custom",
      ),
      creation,
      canResetFeatureSession:
        game.user?.isGM === true &&
        editionCapabilities.narrativeFeatures.state === "active",
      pipsEnabled: currentPipsEnabled(),
      combat: {
        armor: armorItems,
        actionSegmentsActive: secondEditionActionSegments,
        firstEditionActionsActive: firstEditionFlexibleActions,
        firstEditionActionState,
        firstEditionDefensesActive: firstEditionDefenses,
        firstEditionMovementActive: firstEditionMovement,
        firstEditionMovement: {
          baseMove,
          freeLand: baseMove / 2,
          freeSwim: Math.ceil(baseMove / 2) / 2,
          maximumLand: baseMove * 4,
          swimRate: Math.ceil(baseMove / 2),
        },
        firstEditionHealing:
          firstEditionDamage &&
          (firstEditionHealingRule !== null ||
            firstEditionMedicineDifficulty !== null ||
            condition === "mortally-wounded")
            ? {
                canAssist:
                  this.isEditable && firstEditionMedicineDifficulty !== null,
                canStabilize:
                  this.isEditable && condition === "mortally-wounded",
                canHealNaturally:
                  this.isEditable && firstEditionHealingRule !== null,
                canRollMortality:
                  this.isEditable && condition === "mortally-wounded",
                medicineDifficulty: firstEditionMedicineDifficulty,
                mortalityMinutes: firstEditionMortalityElapsedMinutes(
                  firstEditionMortalityRounds,
                ),
                mortalityRounds: firstEditionMortalityRounds,
                showMortalityClock: condition === "mortally-wounded",
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
                    : conditionLabel(firstEditionInjuryState.stunWound),
                unconsciousMinutes: firstEditionInjuryState.unconsciousMinutes,
              }
            : null,
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
        conditionLabel: conditionLabel(condition),
        conditions,
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
        dodge: secondEditionCombat ? dodge : undefined,
        parry: secondEditionCombat ? parry : undefined,
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
          ? secondEditionDefenseForPosture(dodge, "ranged", posture)
          : undefined,
        meleeParry: secondEditionCombat
          ? secondEditionDefenseForPosture(parry, "melee", posture)
          : undefined,
        scale: Math.min(6, Math.max(0, integer(system.scale))),
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
          roundState.firstEditionRemainingActionCount > 0,
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
      canSynchronizeSkills: isGM && this.isEditable,
      fatePoints: integer(fatePoints.value),
      freeEdit: sheetMode === "freeedit" && isGM && this.isEditable,
      heroPoints: classicHeroPoints
        ? integer(experiencePoints.value)
        : integer(heroPoints.value),
      heroPointResourcePath: classicHeroPoints
        ? "system.resources.experiencePoints.value"
        : "system.resources.heroPoints.value",
      classicHeroPoints,
      canEditHeroPoints: this.isEditable && (!classicHeroPoints || isGM),
      baseMove,
      showBaseMove: firstEditionMovement,
      isGM,
      itemGroups,
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
        (rulesProfile.compatibility.firstEditionAttributes
          ? game.i18n.localize("D6E2.OpenD6Compatible")
          : game.i18n.localize("D6E2.SecondEdition")),
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

  override _attachPartListeners(
    partId: string,
    htmlElement: HTMLElement,
    options: Record<string, unknown>,
  ): void {
    super._attachPartListeners(partId, htmlElement, options);
    htmlElement.addEventListener("change", this.#persistChange);
    htmlElement.addEventListener("input", (event) => {
      const input = event.target;
      if (input instanceof HTMLInputElement && input.type === "number") {
        this.#persistChange(event);
      }
    });
  }

  #tabs(): Readonly<Record<string, SheetTab>> {
    const group = "primary";
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
      items: {
        icon: "fa-solid fa-suitcase",
        label: "D6E2.Tab.Items",
      },
      combat: {
        icon: "fa-solid fa-crosshairs",
        label: "D6E2.Tab.Combat",
      },
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
}
