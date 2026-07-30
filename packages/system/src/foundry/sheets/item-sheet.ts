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
  advancedSkillKey,
  normalizedSkillName,
  specializationKey,
} from "../skill-module";
import {
  activeAttributeDefinitions,
  integer,
  record,
  stringValue,
} from "./values";
import { openDocumentImagePicker } from "./open-document-image-picker";

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
  #activeTab: "description" | "details" | "effects" = "details";

  static PARTS = {
    main: {
      template: `systems/${SYSTEM_ID}/templates/item/item-sheet.hbs`,
    },
  };

  static readonly #editImage = async function (
    this: D6System2eItemSheet,
  ): Promise<void> {
    await openDocumentImagePicker(this.item);
  };

  static readonly #setItemTab = function (
    this: D6System2eItemSheet,
    _event: Event,
    target: HTMLElement,
  ): void {
    const tab = target.dataset.itemTab;
    if (tab !== "details" && tab !== "description" && tab !== "effects") return;
    this.#activeTab = tab;
    for (const button of Array.from(
      this.element.querySelectorAll<HTMLElement>(
        "[data-action='setItemTab'][data-item-tab]",
      ),
    )) {
      const active = button.dataset.itemTab === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    }
    for (const panel of Array.from(
      this.element.querySelectorAll<HTMLElement>("[data-item-tab-panel]"),
    )) {
      const active = panel.dataset.itemTabPanel === tab;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    }
  };

  static readonly #createEffect = async function (
    this: D6System2eItemSheet,
  ): Promise<void> {
    if (!this.#mayManageEffects()) return;
    const created = await this.item.createEmbeddedDocuments("ActiveEffect", [
      { name: game.i18n.localize("D6E2.Item.NewActiveEffect") },
    ]);
    created[0]?.sheet.render(true);
  };

  static readonly #editEffect = function (
    this: D6System2eItemSheet,
    _event: Event,
    target: HTMLElement,
  ): void {
    const effectId =
      target.closest<HTMLElement>("[data-effect-id]")?.dataset.effectId;
    if (effectId) this.item.effects.get(effectId)?.sheet.render(true);
  };

  static readonly #deleteEffect = async function (
    this: D6System2eItemSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.#mayManageEffects()) return;
    const effectId =
      target.closest<HTMLElement>("[data-effect-id]")?.dataset.effectId;
    if (!effectId) return;
    const effect = this.item.effects.get(effectId);
    if (!effect) return;
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
      classes: ["d6e2", "od6roll-dialog", "d6e2-delete-effect-dialog"],
      content: `<div class="od6-dialog-shell"><p>${game.i18n.localize(
        "D6E2.Item.DeleteEffectConfirm",
      )}</p></div>`,
      modal: true,
      rejectClose: false,
      window: {
        icon: "fa-solid fa-trash",
        title: game.i18n.localize("D6E2.Delete"),
      },
    });
    if (result === true) {
      await this.item.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
      this.render();
    }
  };

  #mayManageEffects(): boolean {
    const parent = this.item.parent;
    if (game.user?.isGM !== true) return false;
    return !parent || record(parent.system.sheetMode).value === "freeedit";
  }

  static readonly #submitSheet = async function (
    this: D6System2eItemSheet,
    _event: SubmitEvent,
    _form: HTMLFormElement,
    formData: FoundryFormData,
  ): Promise<void> {
    if (!this.isEditable || !mayDirectEditItem(this.item)) return;
    const changes = { ...formData.object };
    const prerequisites = changes.prerequisiteSkillKeys;
    const prerequisitesPresent =
      changes.prerequisiteSkillKeysPresent === "true";
    delete changes.prerequisiteSkillKeys;
    delete changes.prerequisiteSkillKeysPresent;
    if (typeof prerequisites === "string" || Array.isArray(prerequisites)) {
      const values = Array.isArray(prerequisites)
        ? prerequisites
        : prerequisites.split(",");
      changes["system.prerequisiteSkillKeys"] = [
        ...new Set(
          values
            .filter((key): key is string => typeof key === "string")
            .map((key) => key.trim())
            .filter((key) => key.length > 0),
        ),
      ];
    } else if (prerequisitesPresent) {
      changes["system.prerequisiteSkillKeys"] = [];
    }
    const advancedSkill =
      this.item.type === "skill" && this.item.system.training === "advanced";
    if (advancedSkill) {
      const submittedPrerequisites = Array.isArray(
        changes["system.prerequisiteSkillKeys"],
      )
        ? (changes["system.prerequisiteSkillKeys"] as unknown[]).filter(
            (key): key is string => typeof key === "string",
          )
        : [];
      if (submittedPrerequisites.length < 2) {
        ui.notifications.warn(
          game.i18n.localize("D6E2.Creation.AdvancedSkillPrerequisiteCount"),
        );
        return;
      }
      const standardSkillKeys = new Set(
        (this.item.parent?.items.contents ?? [])
          .filter(
            (item) =>
              item.type === "skill" &&
              item.system.training !== "advanced" &&
              item.id !== this.item.id,
          )
          .map((item) => stringValue(item.system.key)),
      );
      if (submittedPrerequisites.some((key) => !standardSkillKeys.has(key))) {
        ui.notifications.warn(
          game.i18n.localize("D6E2.Creation.AdvancedSkillPrerequisiteInvalid"),
        );
        return;
      }
    }
    const dedicatedName =
      this.item.type === "specialization" ||
      (this.item.type === "skill" && this.item.system.training === "advanced");
    const submittedName =
      typeof changes.name === "string"
        ? normalizedSkillName(changes.name)
        : this.item.name;
    if (dedicatedName && submittedName.length === 0) {
      ui.notifications.warn(game.i18n.localize("D6E2.Item.SkillNameRequired"));
      return;
    }
    changes.name = submittedName;
    const parent = this.item.parent;
    const selectedParentId = changes["system.parentSkillId"];
    if (parent && typeof selectedParentId === "string") {
      const selectedParent = parent.items.get(selectedParentId);
      if (
        selectedParent?.type === "skill" &&
        selectedParent.system.training !== "advanced"
      ) {
        changes["system.parentSkillKey"] = stringValue(
          selectedParent.system.key,
        );
        changes["system.attributeId"] = stringValue(
          selectedParent.system.attributeId,
          "agility",
        );
        const currentKey = stringValue(this.item.system.key);
        const legacyKey = `specialization-${stringValue(
          selectedParent.system.key,
          "skill",
        )}`;
        if (this.item.type === "specialization" && currentKey === legacyKey) {
          changes["system.key"] = specializationKey(
            selectedParent,
            submittedName,
          );
        }
      }
    }
    if (
      this.item.type === "skill" &&
      this.item.system.training === "advanced" &&
      stringValue(this.item.system.key) === "new-advanced-skill"
    ) {
      changes["system.key"] = advancedSkillKey(submittedName);
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
      createEffect: this.#createEffect,
      deleteEffect: this.#deleteEffect,
      editImage: this.#editImage,
      editEffect: this.#editEffect,
      roll: this.#roll,
      setItemTab: this.#setItemTab,
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
    const isAdvancedSkill =
      this.item.type === "skill" && this.item.system.training === "advanced";
    const prerequisiteSkillKeys = Array.isArray(
      this.item.system.prerequisiteSkillKeys,
    )
      ? this.item.system.prerequisiteSkillKeys.filter(
          (key): key is string => typeof key === "string" && key.length > 0,
        )
      : [];
    const standardPrerequisiteSkills: FoundryItemDocument[] = (
      (this.item.parent?.items.contents ?? []) as FoundryItemDocument[]
    ).filter(
      (item) =>
        item.type === "skill" &&
        item.id !== this.item.id &&
        item.system.training !== "advanced",
    );
    const prerequisiteSkillOptions: Record<string, string> = {};
    for (const item of standardPrerequisiteSkills) {
      prerequisiteSkillOptions[stringValue(item.system.key)] =
        `${item.name} (${formatPipScore(
          currentEffectivePipScore(integer(item.system.score)),
        )})`;
    }
    for (const key of prerequisiteSkillKeys) {
      if (
        !standardPrerequisiteSkills.some(
          (item) => stringValue(item.system.key) === key,
        )
      ) {
        prerequisiteSkillOptions[key] = game.i18n.format(
          "D6E2.Item.MissingPrerequisiteSkill",
          { key },
        );
      }
    }
    const prerequisiteSkillChoices = Object.entries(prerequisiteSkillOptions)
      .map(([key, label]) =>
        Object.freeze({
          key,
          label,
          selected: prerequisiteSkillKeys.includes(key),
        }),
      )
      .sort((left, right) => left.label.localeCompare(right.label));
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
      armorStackingOptions: {
        "": game.i18n.localize("D6E2.Item.ArmorBody"),
        shield: game.i18n.localize("D6E2.Item.ArmorShield"),
      },
      damageLabel: formatPipScore(currentEffectivePipScore(damage)),
      contextOptions: {
        personal: game.i18n.localize("D6E2.Item.ContextPersonal"),
        starship: game.i18n.localize("D6E2.Item.ContextStarship"),
        vehicle: game.i18n.localize("D6E2.Item.ContextVehicle"),
      },
      directEdit,
      effects: this.item.effects.contents.map((effect) => ({
        cssClass: effect.disabled ? "is-disabled" : "",
        disabled: effect.disabled,
        id: effect.id,
        name: effect.name,
      })),
      creationEdit,
      energyResistanceLabel: formatPipScore(
        currentEffectivePipScore(energyResistance),
      ),
      editable: directEdit,
      imageEditable:
        game.user?.isGM === true || this.item.parent?.isOwner === true,
      itemTabs: {
        description: {
          active: this.#activeTab === "description",
          cssClass: this.#activeTab === "description" ? "active" : "",
          tabIndex: this.#activeTab === "description" ? 0 : -1,
        },
        details: {
          active: this.#activeTab === "details",
          cssClass: this.#activeTab === "details" ? "active" : "",
          tabIndex: this.#activeTab === "details" ? 0 : -1,
        },
        effects: {
          active: this.#activeTab === "effects",
          cssClass: this.#activeTab === "effects" ? "active" : "",
          tabIndex: this.#activeTab === "effects" ? 0 : -1,
        },
      },
      mayManageEffects: this.#mayManageEffects(),
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
      hasDedicatedNameField:
        this.item.type === "specialization" || isAdvancedSkill,
      isAdvancedSkill,
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
        ["skill", "specialization"].includes(this.item.type) ||
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
      itemNameLabel: game.i18n.localize(
        this.item.type === "specialization"
          ? "D6E2.Item.SpecializationName"
          : "D6E2.Item.AdvancedSkillName",
      ),
      prerequisiteSkillKeys,
      prerequisiteSkillChoices,
      prerequisiteSkillOptions,
      parentSkillOptions: Object.fromEntries(
        (this.item.parent?.items.contents ?? [])
          .filter(
            (item) =>
              item.type === "skill" && item.system.training !== "advanced",
          )
          .map((item) => [item.id, item.name]),
      ),
      typeLabel,
    });
  }
}
