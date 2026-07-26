import { addPipScores, formatPipScore } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../../constants";
import { currentTerminology } from "../../registries/terminology";
import { currentRulesProfile } from "../../settings/rules-compatibility";
import {
  booleanSetting,
  secondEditionOptionalAttributes,
} from "../../settings/setting-values";
import { SHARED_SETTING_KEYS } from "../../settings/settings-catalog";
import {
  advanceAttribute,
  advanceItem,
  attributeAdvancementPlan,
  itemAdvancementPlan,
} from "../advancement-service";
import { mayDirectEditMechanicalScore } from "../mechanical-edit-guard";
import {
  effectiveCharacterSheetMode,
  maySelectCharacterSheetMode,
} from "./sheet-mode";
import { activeAttributeDefinitions, integer, record } from "./values";

const CharacterSheetBase = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2,
);

interface CharacterSkillView {
  readonly advanceCost: number;
  readonly canAdvance: boolean;
  readonly attributeId: string;
  readonly bonusLabel: string;
  readonly id: string;
  readonly name: string;
  readonly rollable: boolean;
  readonly score: number;
  readonly scoreLabel: string;
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
      "disadvantage",
      "gear",
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
      disadvantage: "D6E2.New.Disadvantage",
      gear: "D6E2.New.Gear",
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
      if (
        !this.isEditable ||
        !mayDirectEditMechanicalScore(storedMode, game.user?.isGM === true)
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
      advanceAttribute: this.#advanceAttribute,
      advanceItem: this.#advanceItem,
      createItem: this.#createItem,
      editItem: this.#editItem,
      rollAttribute: this.#rollAttribute,
      rollSkill: this.#rollSkill,
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
    const terminology = currentTerminology();
    const resources = record(system.resources);
    const heroPoints = record(resources.heroPoints);
    const characterPoints = record(resources.characterPoints);
    const fatePoints = record(resources.fatePoints);
    const availableCharacterPoints = integer(characterPoints.value);
    const advancementEnabled =
      sheetMode === "advance" &&
      rulesProfile.compatibility.firstEditionAdvancement;

    const skillDocuments = this.actor.items.contents.map((item) => {
      return {
        attributeId:
          typeof item.system.attributeId === "string"
            ? item.system.attributeId
            : "",
        id: item.id,
        name: item.name,
        score: integer(item.system.score),
      };
    });

    const attributeViews: readonly CharacterAttributeView[] =
      activeAttributeDefinitions(
        rulesProfile.compatibility.firstEditionAttributes,
        secondEditionOptionalAttributes(),
      ).map(({ id, label }) => {
        const value = record(attributes[id]);
        const attributeScore = integer(value.score);
        const skills = skillDocuments
          .filter((skill) => skill.attributeId === id)
          .map((skill): CharacterSkillView => {
            const score = addPipScores(attributeScore, skill.score);
            const document = this.actor.items.get(skill.id);
            const plan = document
              ? itemAdvancementPlan(this.actor, document)
              : undefined;
            return Object.freeze({
              ...skill,
              advanceCost: plan?.cost ?? 0,
              bonusLabel: formatPipScore(skill.score),
              canAdvance: advancementEnabled && (plan?.affordable ?? false),
              rollable: score >= 3,
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
      "weapon",
      "armor",
      "gear",
    ];
    const itemLabels: Readonly<Record<string, string>> = {
      advantage: "D6E2.Item.Advantage",
      armor: "D6E2.Item.Armor",
      disadvantage: "D6E2.Item.Disadvantage",
      gear: "D6E2.Item.Gear",
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
      characterSheetLabel:
        terminology.characterSheetLabel ??
        game.i18n.localize("D6E2.Actor.CharacterRecord"),
      editable: this.isEditable,
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
