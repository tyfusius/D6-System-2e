import { formatPipScore } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../../constants";
import { currentTerminology } from "../../registries/terminology";
import { currentRulesProfile } from "../../settings/rules-compatibility";
import { secondEditionOptionalAttributes } from "../../settings/setting-values";
import { mayDirectEditMechanicalScore } from "../mechanical-edit-guard";
import { activeAttributeDefinitions, integer, record } from "./values";

const ItemSheetBase = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2,
);

const MECHANICAL_ITEM_TYPES = new Set(["skill", "specialization"]);

function mayDirectEditItem(item: FoundryItemDocument): boolean {
  if (!MECHANICAL_ITEM_TYPES.has(item.type)) return true;
  if (game.user?.isGM !== true) return false;
  const parent = item.parent;
  if (!parent) return true;
  return mayDirectEditMechanicalScore(
    record(parent.system.sheetMode).value,
    true,
  );
}

export class D6System2eItemSheet extends ItemSheetBase {
  static PARTS = {
    main: {
      template: `systems/${SYSTEM_ID}/templates/item/item-sheet.hbs`,
    },
  };

  static readonly #submitSheet = async function (
    this: D6System2eItemSheet,
    _event: SubmitEvent,
    _form: HTMLFormElement,
    formData: FoundryFormData,
  ): Promise<void> {
    if (!this.isEditable || !mayDirectEditItem(this.item)) return;
    await this.item.update(formData.object);
  };

  static readonly #roll = async function (
    this: D6System2eItemSheet,
  ): Promise<void> {
    const actor = this.item.parent;
    if (!actor) {
      ui.notifications.warn("Add this skill to a character before rolling it.");
      return;
    }
    if (this.item.type === "skill") {
      await game.system.api?.roll.skill(actor, this.item.id);
    } else if (
      ["starship-weapon", "vehicle-weapon", "weapon"].includes(this.item.type)
    ) {
      await game.system.api?.roll.item(actor, this.item.id, "attack");
    }
  };

  static DEFAULT_OPTIONS = {
    actions: {
      roll: this.#roll,
    },
    classes: ["d6e2", "d6e2-item-sheet", "od6s-item-v2"],
    form: {
      closeOnSubmit: false,
      handler: this.#submitSheet,
      submitOnChange: false,
      submitOnClose: true,
    },
    position: {
      height: 680,
      width: 720,
    },
    tag: "form",
    window: {
      icon: "fa-solid fa-list-check",
      resizable: true,
    },
  };

  _prepareContext(): Promise<Record<string, unknown>> {
    const rulesProfile = currentRulesProfile();
    const terminology = currentTerminology();
    const selectedAttribute =
      typeof this.item.system.attributeId === "string"
        ? this.item.system.attributeId
        : "agility";
    const score = integer(this.item.system.score);
    const damage = integer(this.item.system.damage);
    const physicalResistance = integer(this.item.system.physicalResistance);
    const energyResistance = integer(this.item.system.energyResistance);
    const typeLabels: Readonly<Record<string, string>> = {
      advantage: "D6E2.Item.Advantage",
      armor: "D6E2.Item.Armor",
      cybernetic: "D6E2.Item.Cybernetic",
      disadvantage: "D6E2.Item.Disadvantage",
      gear: "D6E2.Item.Gear",
      manifestation: "D6E2.Item.Manifestation",
      skill: "D6E2.Item.Skill",
      specialability: "D6E2.Item.SpecialAbility",
      specialization: "D6E2.Item.Specialization",
      weapon: "D6E2.Item.Weapon",
    };
    const typeLabel = game.i18n.localize(
      typeLabels[this.item.type] ?? "D6E2.Item.Item",
    );
    return Promise.resolve({
      attributeOptions: Object.fromEntries(
        activeAttributeDefinitions(
          rulesProfile.compatibility.firstEditionAttributes,
          secondEditionOptionalAttributes(),
        ).map(({ id, label }) => [
          id,
          terminology.attributes[id] ?? game.i18n.localize(label),
        ]),
      ),
      damageLabel: formatPipScore(damage),
      contextOptions: {
        personal: game.i18n.localize("D6E2.Item.ContextPersonal"),
        starship: game.i18n.localize("D6E2.Item.ContextStarship"),
        vehicle: game.i18n.localize("D6E2.Item.ContextVehicle"),
      },
      directEdit: this.isEditable && mayDirectEditItem(this.item),
      energyResistanceLabel: formatPipScore(energyResistance),
      editable: this.isEditable,
      isArmor: this.item.type === "armor",
      isEquipment: [
        "armor",
        "cybernetic",
        "gear",
        "starship-gear",
        "starship-weapon",
        "vehicle",
        "vehicle-gear",
        "vehicle-weapon",
        "weapon",
      ].includes(this.item.type),
      isGear: [
        "cybernetic",
        "gear",
        "starship-gear",
        "vehicle",
        "vehicle-gear",
      ].includes(this.item.type),
      isRollable: [
        "skill",
        "starship-weapon",
        "vehicle-weapon",
        "weapon",
      ].includes(this.item.type),
      isSkill: this.item.type === "skill",
      isSpecialization: this.item.type === "specialization",
      isTrait: [
        "action",
        "advantage",
        "character-template",
        "disadvantage",
        "item-group",
        "manifestation",
        "specialability",
        "species-template",
      ].includes(this.item.type),
      isWeapon: ["starship-weapon", "vehicle-weapon", "weapon"].includes(
        this.item.type,
      ),
      item: this.item,
      frequencyOptions: {
        always: game.i18n.localize("D6E2.Item.FrequencyAlways"),
        limited: game.i18n.localize("D6E2.Item.FrequencyLimited"),
        scene: game.i18n.localize("D6E2.Item.FrequencyScene"),
        session: game.i18n.localize("D6E2.Item.FrequencySession"),
      },
      physicalResistanceLabel: formatPipScore(physicalResistance),
      score,
      scoreLabel: formatPipScore(score),
      selectedAttribute,
      typeLabel,
    });
  }
}
