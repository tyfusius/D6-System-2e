import { formatPipScore } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../../constants";
import { currentTerminology } from "../../registries/terminology";
import { currentRulesProfile } from "../../settings/rules-compatibility";
import { campaignOptionalAttributeIds } from "../../settings/campaign-profile";
import { currentEffectivePipScore } from "../../settings/pip-rules";
import {
  mayDirectEditMechanicalScore,
  withAuthorizedCreationUpdate,
} from "../mechanical-edit-guard";
import {
  activeAttributeDefinitions,
  integer,
  record,
  stringValue,
} from "./values";

const ItemSheetBase = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2,
);

const MECHANICAL_ITEM_TYPES = new Set([
  "flaw",
  "perk",
  "skill",
  "specialization",
  "talent",
]);

function mayDirectEditItem(item: FoundryItemDocument): boolean {
  if (!MECHANICAL_ITEM_TYPES.has(item.type)) return true;
  const parent = item.parent;
  if (!parent) return true;
  if (
    record(parent.system.creation).active === true &&
    parent.isOwner === true
  ) {
    return true;
  }
  if (game.user?.isGM !== true) return false;
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
    const changes = { ...formData.object };
    const prerequisites = changes.prerequisiteSkillKeys;
    delete changes.prerequisiteSkillKeys;
    if (typeof prerequisites === "string") {
      changes["system.prerequisiteSkillKeys"] = prerequisites
        .split(",")
        .map((key) => key.trim())
        .filter((key) => key.length > 0);
    }
    const parent = this.item.parent;
    const selectedParentId = changes["system.parentSkillId"];
    if (parent && typeof selectedParentId === "string") {
      const selectedParent = parent.items.get(selectedParentId);
      if (selectedParent?.type === "skill") {
        changes["system.parentSkillKey"] = stringValue(
          selectedParent.system.key,
        );
        changes["system.attributeId"] = stringValue(
          selectedParent.system.attributeId,
          "agility",
        );
      }
    }
    if (parent && record(parent.system.creation).active === true) {
      await withAuthorizedCreationUpdate(parent, () =>
        this.item.update(changes),
      );
      return;
    }
    await this.item.update(changes);
  };

  static readonly #roll = async function (
    this: D6System2eItemSheet,
  ): Promise<void> {
    const actor = this.item.parent;
    if (!actor) {
      ui.notifications.warn("Add this skill to a character before rolling it.");
      return;
    }
    if (["skill", "specialization"].includes(this.item.type)) {
      await game.system.api?.roll.skill(actor, this.item.id);
    } else if (this.item.type === "weapon") {
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
      height: 620,
      width: 680,
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
    const creationEdit =
      this.item.parent !== undefined &&
      record(this.item.parent.system.creation).active === true &&
      this.item.parent.isOwner === true;
    const damage = integer(this.item.system.damage);
    const physicalResistance = integer(this.item.system.physicalResistance);
    const energyResistance = integer(this.item.system.energyResistance);
    const typeLabels: Readonly<Record<string, string>> = {
      advantage: "D6E2.Item.Advantage",
      armor: "D6E2.Item.Armor",
      asset: "D6E2.Item.Asset",
      cybernetic: "D6E2.Item.Cybernetic",
      disadvantage: "D6E2.Item.Disadvantage",
      flaw: "D6E2.Item.Flaw",
      gear: "D6E2.Item.Gear",
      manifestation: "D6E2.Item.Manifestation",
      perk: "D6E2.Item.Perk",
      skill: "D6E2.Item.Skill",
      specialability: "D6E2.Item.SpecialAbility",
      specialization: "D6E2.Item.Specialization",
      "starship-gear": "D6E2.Item.StarshipGear",
      "starship-weapon": "D6E2.Item.StarshipWeapon",
      "vehicle-gear": "D6E2.Item.VehicleGear",
      "vehicle-weapon": "D6E2.Item.VehicleWeapon",
      talent: "D6E2.Item.Talent",
      trouble: "D6E2.Item.Trouble",
      weapon: "D6E2.Item.Weapon",
    };
    const typeLabel = game.i18n.localize(
      typeLabels[this.item.type] ?? "D6E2.Item.Item",
    );
    const directEdit = this.isEditable && mayDirectEditItem(this.item);
    return Promise.resolve({
      attributeOptions: Object.fromEntries(
        activeAttributeDefinitions(
          rulesProfile.compatibility.firstEditionAttributes,
          campaignOptionalAttributeIds(),
        ).map(({ id, label }) => [
          id,
          terminology.attributes[id] ?? game.i18n.localize(label),
        ]),
      ),
      damageLabel: formatPipScore(currentEffectivePipScore(damage)),
      contextOptions: {
        personal: game.i18n.localize("D6E2.Item.ContextPersonal"),
        starship: game.i18n.localize("D6E2.Item.ContextStarship"),
        vehicle: game.i18n.localize("D6E2.Item.ContextVehicle"),
      },
      directEdit,
      creationEdit,
      energyResistanceLabel: formatPipScore(
        currentEffectivePipScore(energyResistance),
      ),
      editable: directEdit,
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
      isMachineWeapon: ["starship-weapon", "vehicle-weapon"].includes(
        this.item.type,
      ),
      isRollable: ["skill", "specialization", "weapon"].includes(
        this.item.type,
      ),
      isSkill: this.item.type === "skill",
      isSpecialization: this.item.type === "specialization",
      isSecondEditionFeature: [
        "asset",
        "flaw",
        "perk",
        "talent",
        "trouble",
      ].includes(this.item.type),
      isRankedFeature: ["flaw", "perk", "talent"].includes(this.item.type),
      isTalent: this.item.type === "talent",
      isNarrativeFeature: ["asset", "trouble"].includes(this.item.type),
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
      hasSourceReference:
        this.item.type === "skill" ||
        ["asset", "flaw", "perk", "talent", "trouble"].includes(this.item.type),
      frequencyOptions: {
        always: game.i18n.localize("D6E2.Item.FrequencyAlways"),
        limited: game.i18n.localize("D6E2.Item.FrequencyLimited"),
        scene: game.i18n.localize("D6E2.Item.FrequencyScene"),
        session: game.i18n.localize("D6E2.Item.FrequencySession"),
      },
      physicalResistanceLabel: formatPipScore(
        currentEffectivePipScore(physicalResistance),
      ),
      score,
      scoreDirectEdit: directEdit && !creationEdit,
      scoreLabel: formatPipScore(currentEffectivePipScore(score)),
      selectedAttribute,
      trainingOptions: {
        advanced: game.i18n.localize("D6E2.Item.AdvancedSkill"),
        standard: game.i18n.localize("D6E2.Item.StandardSkill"),
      },
      prerequisiteSkillKeys: Array.isArray(
        this.item.system.prerequisiteSkillKeys,
      )
        ? this.item.system.prerequisiteSkillKeys.join(", ")
        : "",
      parentSkillOptions: Object.fromEntries(
        (this.item.parent?.items.contents ?? [])
          .filter((item) => item.type === "skill")
          .map((item) => [item.id, item.name]),
      ),
      typeLabel,
    });
  }
}
