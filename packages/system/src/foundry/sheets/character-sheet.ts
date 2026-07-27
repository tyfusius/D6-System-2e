import {
  addPipScores,
  canPreventBecomingStunned,
  formatPipScore,
  isSecondEditionCondition,
  SECOND_EDITION_CONDITIONS,
  secondEditionStaticDefense,
  specializationScore,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../../constants";
import { currentTerminology } from "../../registries/terminology";
import { currentRulesProfile } from "../../settings/rules-compatibility";
import { booleanSetting } from "../../settings/setting-values";
import {
  campaignOptionalAttributeIds,
  currentSecondEditionCampaignProfile,
} from "../../settings/campaign-profile";
import { currentEditionCapabilityProfile } from "../../settings/edition-capabilities";
import { SHARED_SETTING_KEYS } from "../../settings/settings-catalog";
import {
  adjustCreationAttribute,
  adjustCreationSkill,
  characterCreationProgress,
  createCreationAdvancedSkill,
  createCreationSpecialization,
  finalizeCharacterCreation,
} from "../character-creation-service";
import {
  advanceAttribute,
  advanceItem,
  attributeAdvancementPlan,
  itemAdvancementPlan,
} from "../advancement-service";
import { mayDirectEditMechanicalScore } from "../mechanical-edit-guard";
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

const CharacterSheetBase = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2,
);

interface CharacterSkillView {
  readonly advanceCost: number;
  readonly canAdvance: boolean;
  readonly attributeId: string;
  readonly bonusLabel: string;
  readonly canEditCreation: boolean;
  readonly id: string;
  readonly name: string;
  readonly parentSkillName: string;
  readonly rollable: boolean;
  readonly score: number;
  readonly scoreLabel: string;
  readonly training: "advanced" | "specialization" | "standard";
}

interface CharacterAttributeView {
  readonly advanceCost: number;
  readonly canAdvance: boolean;
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
  readonly id: string;
  readonly img: string;
  readonly name: string;
  readonly type: string;
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

async function confirmAdvancement(
  label: string,
  cost: number,
): Promise<boolean> {
  const content = await foundry.applications.handlebars.renderTemplate(
    `systems/${SYSTEM_ID}/templates/actor/character/advance-confirm.hbs`,
    { cost, label },
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
      "cybernetic",
      "disadvantage",
      "gear",
      "manifestation",
      "skill",
      "specialability",
      "specialization",
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
      cybernetic: "D6E2.New.Cybernetic",
      disadvantage: "D6E2.New.Disadvantage",
      gear: "D6E2.New.Gear",
      manifestation: "D6E2.New.Manifestation",
      skill: "D6E2.NewSkill",
      specialability: "D6E2.New.SpecialAbility",
      specialization: "D6E2.New.Specialization",
      weapon: "D6E2.New.Weapon",
    };
    const source: Record<string, unknown> = {
      name: game.i18n.localize(labels[type] ?? "D6E2.New.Item"),
      type,
    };
    if (type === "skill") {
      const attributeId =
        target.closest<HTMLElement>("[data-attribute-id]")?.dataset
          .attributeId ?? "agility";
      source.system = {
        attributeId,
        description: "",
        key: "new-skill",
        score: 0,
        training: "standard",
      };
    }
    const created = await this.actor.createEmbeddedDocuments("Item", [source]);
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
    if (item.type === "skill" || item.type === "specialization") {
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
    }
    item.sheet.render(true);
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
    const content = await foundry.applications.handlebars.renderTemplate(
      `systems/${SYSTEM_ID}/templates/actor/character/combat-declaration.hbs`,
      {
        actions: roundState.actions.map((action) => action.label).join("\n"),
      },
    );
    const declaration = await foundry.applications.api.DialogV2.wait<
      readonly { readonly kind: "other"; readonly label: string }[]
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
            return actions
              .split(/\r?\n/)
              .map((label) => label.trim())
              .filter((label) => label.length > 0)
              .map((label) => ({ kind: "other" as const, label }));
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
      window: {
        icon: "fa-solid fa-list-ol",
        title: game.i18n.localize("D6E2.Combat.DeclareActions"),
      },
    });
    if (!declaration?.length) return;
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
    if (!isSecondEditionCondition(condition)) return;
    const health = record(this.actor.system.health);
    const current = isSecondEditionCondition(health.condition)
      ? health.condition
      : "healthy";
    const resources = record(this.actor.system.resources);
    const heroPoints = integer(record(resources.heroPoints).value);
    const mayPrevent =
      !currentRulesProfile().compatibility.firstEditionMetaCurrency &&
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

  static readonly #createCreationSpecialization = async function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    const itemId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    if (!itemId) return;
    try {
      const created = await createCreationSpecialization(this.actor, itemId);
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
      const created = await createCreationAdvancedSkill(this.actor);
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
    if (!(await confirmAdvancement(label, plan.cost))) return;
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
    if (!(await confirmAdvancement(item.name, plan.cost))) return;
    try {
      await advanceItem(this.actor, item.id);
      this.render();
    } catch (error) {
      const key = error instanceof Error ? error.message : String(error);
      ui.notifications.warn(game.i18n.localize(key));
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
      advanceAttribute: this.#advanceAttribute,
      advanceItem: this.#advanceItem,
      createCreationSpecialization: this.#createCreationSpecialization,
      createCreationAdvancedSkill: this.#createCreationAdvancedSkill,
      createItem: this.#createItem,
      declareCombatActions: this.#declareCombatActions,
      editItem: this.#editItem,
      finalizeCharacterCreation: this.#finalizeCharacterCreation,
      completeCombatAction: this.#completeCombatAction,
      rollAttribute: this.#rollAttribute,
      rollCombatItem: this.#rollCombatItem,
      rollCombatItemDamage: this.#rollCombatItemDamage,
      rollSkill: this.#rollSkill,
      setCondition: this.#setCondition,
      resetCombatActions: this.#resetCombatActions,
      synchronizeSkills: this.#synchronizeSkills,
      toggleEquipped: this.#toggleEquipped,
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
    const availableCharacterPoints = integer(characterPoints.value);
    const advancementEnabled =
      sheetMode === "advance" &&
      rulesProfile.compatibility.firstEditionAdvancement;
    const creation = characterCreationProgress(this.actor);
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
        const skills = mechanicalDocuments
          .filter((skill) => skill.attributeId === id)
          .map((skill): CharacterSkillView => {
            const parent =
              skill.training === "specialization"
                ? (skillById.get(skill.parentSkillId) ??
                  skillById.get(skillByKey.get(skill.parentSkillKey) ?? ""))
                : undefined;
            const parentScore =
              parent?.training === "advanced" &&
              editionCapabilities.advancedSkills.state === "active"
                ? parent.score
                : addPipScores(attributeScore, parent?.score ?? 0);
            const score =
              skill.training === "advanced"
                ? skill.score
                : skill.training === "specialization"
                  ? specializationScore(parentScore, skill.score)
                  : addPipScores(attributeScore, skill.score);
            const document = this.actor.items.get(skill.id);
            const plan = document
              ? itemAdvancementPlan(this.actor, document)
              : undefined;
            return Object.freeze({
              ...skill,
              advanceCost: plan?.cost ?? 0,
              bonusLabel: formatPipScore(skill.score),
              canEditCreation: creation.active && skill.training !== "standard",
              canAdvance: advancementEnabled && (plan?.affordable ?? false),
              parentSkillName: parent?.name ?? "",
              rollable:
                score >= 3 &&
                (skill.training !== "advanced" ||
                  editionCapabilities.advancedSkills.state === "active"),
              scoreLabel: formatPipScore(score),
            });
          });
        const plan = attributeAdvancementPlan(this.actor, id);
        return Object.freeze({
          advanceCost: plan.cost,
          canAdvance:
            advancementEnabled && plan.affordable && plan.nextScore <= 15,
          id,
          label: terminology.attributes[id] ?? game.i18n.localize(label),
          rollable: attributeScore >= 3,
          score: attributeScore,
          scoreLabel: formatPipScore(attributeScore),
          skills: Object.freeze(skills),
        });
      });

    const attributeColumns = [
      attributeViews.filter((_attribute, index) => index % 2 === 0),
      attributeViews.filter((_attribute, index) => index % 2 === 1),
    ];
    const tabs = this.#tabs();
    const itemTypes = [
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
      cybernetic: "D6E2.Item.Cybernetic",
      disadvantage: "D6E2.Item.Disadvantage",
      gear: "D6E2.Item.Gear",
      manifestation: "D6E2.Item.Manifestation",
      specialability: "D6E2.Item.SpecialAbility",
      specialization: "D6E2.Item.Specialization",
      weapon: "D6E2.Item.Weapon",
    };
    const itemGroups = itemTypes.map((type) => ({
      items: this.actor.items.contents
        .filter((item) => item.type === type)
        .map((item): CharacterItemView => {
          const plan =
            item.type === "specialization"
              ? itemAdvancementPlan(this.actor, item)
              : undefined;
          return {
            advanceCost: plan?.cost ?? 0,
            canAdvance: advancementEnabled && (plan?.affordable ?? false),
            id: item.id,
            img: item.img,
            name: item.name,
            type: item.type,
          };
        }),
      label: game.i18n.localize(itemLabels[type] ?? "D6E2.Item.Item"),
      type,
    }));
    const health = record(system.health);
    const condition = isSecondEditionCondition(health.condition)
      ? health.condition
      : "healthy";
    const conditionLabel = (value: string): string =>
      game.i18n.localize(
        `D6E2.Condition.${value
          .split("-")
          .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
          .join("")}`,
      );
    const conditions = SECOND_EDITION_CONDITIONS.map((value) => ({
      cssClass: condition === value ? "is-current" : "",
      current: condition === value,
      label: conditionLabel(value),
      value,
    }));
    const attributeScores = new Map(
      attributeViews.map((attribute) => [attribute.id, attribute.score]),
    );
    const combatItems = this.actor.items.contents
      .filter((item) => item.type === "weapon")
      .map((item): CombatItemView => ({
        advanceCost: 0,
        canAdvance: false,
        damageLabel: formatPipScore(integer(item.system.damage)),
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
            integer(item.system.physicalResistance),
            integer(item.system.energyResistance),
          ),
        ),
      }));
    const secondEditionCombat = !rulesProfile.compatibility.firstEditionDamage;
    const secondEditionActionSegments =
      editionCapabilities.actionEconomy.strategy ===
      "second-edition-action-segments";
    const roundState = game.system.api?.combat.read(this.actor) ?? null;
    const completedCombatActionIds = new Set(
      roundState?.completedActionIds ?? [],
    );
    const roundActions =
      roundState?.actions.map((action, index) => ({
        ...action,
        complete: completedCombatActionIds.has(action.id),
        cssClass: completedCombatActionIds.has(action.id) ? "is-complete" : "",
        icon: completedCombatActionIds.has(action.id)
          ? "fa-check"
          : "fa-hourglass-half",
        number: index + 1,
      })) ?? [];

    return Promise.resolve({
      actor: this.actor,
      advanceMode: sheetMode === "advance",
      advancementEnabled,
      advancementHelp: game.i18n.localize(
        advancementEnabled
          ? "D6E2.Advancement.OpenD6Ready"
          : "D6E2.Advancement.ProfileRequired",
      ),
      availableCharacterPoints,
      attributeColumns,
      characterPoints: integer(characterPoints.value),
      campaignProfile,
      campaignProfileLabel: game.i18n.localize(
        campaignProfile.id === "core-default"
          ? "D6E2.Settings.CampaignProfile.CoreDefault"
          : "D6E2.Settings.CampaignProfile.Custom",
      ),
      creation,
      combat: {
        armor: armorItems,
        actionSegmentsActive: secondEditionActionSegments,
        condition,
        conditionLabel: conditionLabel(condition),
        conditions,
        dodge: secondEditionCombat
          ? secondEditionStaticDefense(attributeScores.get("perception") ?? 0)
          : undefined,
        parry: secondEditionCombat
          ? secondEditionStaticDefense(attributeScores.get("agility") ?? 0)
          : undefined,
        roundState,
        roundStateClass: roundState?.complete ? "is-complete" : "",
        roundActions,
        canDeclareActions:
          this.isEditable &&
          roundState !== null &&
          roundState.completedActionIds.length === 0,
        canCompleteAction:
          this.isEditable &&
          roundState !== null &&
          roundState.actions.length > 0 &&
          !roundState.complete,
        canResetActions:
          this.isEditable &&
          roundState !== null &&
          (roundState.completedActionIds.length === 0 || isGM),
        secondEdition: secondEditionCombat,
        weapons: combatItems,
      },
      characterSheetLabel:
        terminology.characterSheetLabel ??
        game.i18n.localize("D6E2.Actor.CharacterRecord"),
      editable: this.isEditable,
      canSynchronizeSkills: isGM && this.isEditable,
      fatePoints: integer(fatePoints.value),
      freeEdit: sheetMode === "freeedit" && isGM && this.isEditable,
      heroPoints: integer(heroPoints.value),
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
        heroPoints:
          terminology.resources.heroPoints ??
          game.i18n.localize("D6E2.HeroPoints"),
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
