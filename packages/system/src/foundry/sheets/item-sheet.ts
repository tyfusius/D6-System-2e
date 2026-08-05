import {
  formatPipScore,
  freeformMagicDifficulty,
  superheroicEquipmentRebuildDays,
  superpowerTalentCostPlan,
  type D6FreeformMagicDesignV1,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../../constants";
import {
  currentTerminology,
  terminologyAttributeLabel,
} from "../../registries/terminology";
import { currentRulesProfile } from "../../settings/rules-compatibility";
import {
  campaignOptionalAttributeIds,
  currentSecondEditionCampaignProfile,
} from "../../settings/campaign-profile";
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
import { superheroicGadgetTargetChanges } from "./superheroic-equipment-form";
import {
  actorItemDropData,
  itemFromDropData,
} from "../actor-item-drop-service";
import { CHARACTER_TEMPLATE_ITEM_TYPES } from "../data-models/item-types";

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

const IMMEDIATE_EQUIPMENT_ITEM_TYPES = new Set([
  "armor",
  "cybernetic",
  "gear",
  "starship-gear",
  "starship-weapon",
  "vehicle",
  "vehicle-gear",
  "vehicle-weapon",
  "weapon",
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

function descriptionChanges(value: string): Record<string, unknown> {
  // Foundry drops a literal empty-string update before the HTMLField cleaner
  // sees it. A single space produces a real diff and is normalized back to the
  // schema's canonical empty string.
  return { "system.description": value.length === 0 ? " " : value };
}

export class D6System2eItemSheet extends ItemSheetBase {
  #activeTab: "description" | "details" | "effects" = "details";

  readonly #persistCharacterTemplateAttribute = (event: Event): void => {
    if (this.item.type !== "character-template" || !this.isEditable) return;
    const input = event.target;
    if (
      !(input instanceof HTMLInputElement) &&
      !(input instanceof HTMLSelectElement)
    )
      return;
    const row = input.closest<HTMLElement>("[data-template-attribute-index]");
    const index = Number(row?.dataset.templateAttributeIndex);
    if (!Number.isSafeInteger(index) || index < 0) return;
    const dice = Number(
      row?.querySelector<HTMLInputElement>("[data-template-dice]")?.value,
    );
    const pips = Number(
      row?.querySelector<HTMLInputElement>("[data-template-pips]")?.value,
    );
    if (!Number.isSafeInteger(dice) || !Number.isSafeInteger(pips)) return;
    const attributes = Array.isArray(this.item.system.attributeScores)
      ? structuredClone(this.item.system.attributeScores)
      : [];
    const attribute = record(attributes[index]);
    attribute.attributeId = stringValue(
      row?.querySelector<HTMLSelectElement>("select")?.value,
    );
    attribute.score = Math.max(0, Math.min(60, dice * 3 + pips));
    attributes[index] = attribute;
    void this.item
      .update({ "system.attributeScores": attributes })
      .then(() => this.render());
  };

  readonly #allowCharacterTemplateDrop = (event: DragEvent): void => {
    if (this.item.type === "character-template" && this.isEditable) {
      event.preventDefault();
    }
  };

  readonly #addDroppedCharacterTemplateItem = async (
    event: DragEvent,
  ): Promise<void> => {
    if (this.item.type !== "character-template" || !this.isEditable) return;
    event.preventDefault();
    const data = actorItemDropData(event);
    const dropped = data ? await itemFromDropData(data) : null;
    if (
      !dropped ||
      !(CHARACTER_TEMPLATE_ITEM_TYPES as readonly string[]).includes(
        dropped.type,
      )
    ) {
      ui.notifications.warn(
        game.i18n.localize("D6E2.Template.UnsupportedItem"),
      );
      return;
    }
    const source = structuredClone(dropped.toObject());
    const items = Array.isArray(this.item.system.items)
      ? structuredClone(this.item.system.items)
      : [];
    const key = stringValue(record(source.system).key);
    const duplicate = items.some((value) => {
      const item = record(value);
      return (
        stringValue(item.type) === dropped.type &&
        (key
          ? stringValue(record(item.system).key) === key
          : stringValue(item.name) === dropped.name)
      );
    });
    if (duplicate) {
      ui.notifications.warn(game.i18n.localize("D6E2.Template.DuplicateItem"));
      return;
    }
    items.push({
      img: dropped.img,
      name: dropped.name,
      sourceUuid: dropped.uuid ?? "",
      system: record(source.system),
      type: dropped.type,
    });
    await this.item.update({ "system.items": items });
    this.render();
  };

  readonly #queueDroppedCharacterTemplateItem = (event: DragEvent): void => {
    void this.#addDroppedCharacterTemplateItem(event);
  };

  readonly #persistMagicDesignChange = (event: Event): void => {
    if (this.item.type !== "manifestation" || !this.isEditable) return;
    const input = event.target;
    if (
      !(input instanceof HTMLInputElement) &&
      !(input instanceof HTMLSelectElement)
    ) {
      return;
    }
    if (
      input.disabled ||
      !input.name.startsWith("system.") ||
      !input.closest(".d6e2-magic-design")
    ) {
      return;
    }
    const value =
      input instanceof HTMLInputElement && input.type === "number"
        ? input.valueAsNumber
        : input.value;
    if (typeof value === "number" && !Number.isFinite(value)) return;
    void this.item.update({ [input.name]: value }).then(() => this.render());
  };

  readonly #persistEquipmentChange = (event: Event): void => {
    if (!IMMEDIATE_EQUIPMENT_ITEM_TYPES.has(this.item.type)) return;
    if (!this.isEditable || !mayDirectEditItem(this.item)) return;
    const input = event.target;
    if (
      !(input instanceof HTMLInputElement) &&
      !(input instanceof HTMLSelectElement)
    ) {
      return;
    }
    if (
      input.disabled ||
      (!input.name.startsWith("system.") &&
        input.name !== "name" &&
        input.name !== "superheroicGadgetTarget")
    ) {
      return;
    }
    if (input.name === "superheroicGadgetTarget") {
      void this.item.update(superheroicGadgetTargetChanges(input.value));
      return;
    }
    const value =
      input instanceof HTMLInputElement && input.type === "checkbox"
        ? input.checked
        : input instanceof HTMLInputElement && input.type === "number"
          ? input.valueAsNumber
          : input.value;
    if (typeof value === "number" && !Number.isFinite(value)) return;
    void this.item.update({ [input.name]: value }).then(() => {
      if (input.name === "system.superheroicEquipmentKind") this.render();
    });
  };

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

  static readonly #addTemplateMember = async function (
    this: D6System2eItemSheet,
  ): Promise<void> {
    if (
      !this.isEditable ||
      !["item-group", "species-template"].includes(this.item.type)
    )
      return;
    const members = Array.isArray(this.item.system.members)
      ? structuredClone(this.item.system.members)
      : [];
    members.push({ label: "", required: true, uuid: "" });
    await this.item.update({ "system.members": members });
    this.render();
  };

  static readonly #useActiveCharacterTemplateProfile = async function (
    this: D6System2eItemSheet,
  ): Promise<void> {
    if (!this.isEditable || this.item.type !== "character-template") return;
    const firstEdition =
      currentRulesProfile().compatibility.firstEditionAttributes;
    const campaign = currentSecondEditionCampaignProfile();
    await this.item.update({
      "system.attributeScores": activeAttributeDefinitions(
        firstEdition,
        campaignOptionalAttributeIds(campaign),
      ).map(({ id }) => ({
        attributeId: id,
        score: id === "extranormal" ? 0 : 3,
      })),
      "system.rulesFamily": firstEdition
        ? "open-d6-first-edition"
        : "d6-system-second-edition",
    });
    this.render();
  };

  static readonly #addCharacterTemplateAttribute = async function (
    this: D6System2eItemSheet,
  ): Promise<void> {
    if (!this.isEditable || this.item.type !== "character-template") return;
    const attributes = Array.isArray(this.item.system.attributeScores)
      ? structuredClone(this.item.system.attributeScores)
      : [];
    const existing = new Set(
      attributes.map((value) => stringValue(record(value).attributeId)),
    );
    const candidate = activeAttributeDefinitions(
      currentRulesProfile().compatibility.firstEditionAttributes,
      campaignOptionalAttributeIds(currentSecondEditionCampaignProfile()),
    ).find(({ id }) => !existing.has(id));
    if (!candidate) return;
    attributes.push({
      attributeId: candidate.id,
      score: candidate.id === "extranormal" ? 0 : 3,
    });
    await this.item.update({ "system.attributeScores": attributes });
    this.render();
  };

  static readonly #removeCharacterTemplateAttribute = async function (
    this: D6System2eItemSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.isEditable || this.item.type !== "character-template") return;
    const index = Number(
      target.closest<HTMLElement>("[data-template-attribute-index]")?.dataset
        .templateAttributeIndex,
    );
    if (!Number.isSafeInteger(index) || index < 0) return;
    const attributes = Array.isArray(this.item.system.attributeScores)
      ? structuredClone(this.item.system.attributeScores)
      : [];
    attributes.splice(index, 1);
    await this.item.update({ "system.attributeScores": attributes });
    this.render();
  };

  static readonly #removeCharacterTemplateItem = async function (
    this: D6System2eItemSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.isEditable || this.item.type !== "character-template") return;
    const index = Number(
      target.closest<HTMLElement>("[data-template-item-index]")?.dataset
        .templateItemIndex,
    );
    if (!Number.isSafeInteger(index) || index < 0) return;
    const items = Array.isArray(this.item.system.items)
      ? structuredClone(this.item.system.items)
      : [];
    items.splice(index, 1);
    await this.item.update({ "system.items": items });
    this.render();
  };

  static readonly #removeTemplateMember = async function (
    this: D6System2eItemSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.isEditable) return;
    const index = Number(
      target.closest<HTMLElement>("[data-member-index]")?.dataset.memberIndex,
    );
    if (!Number.isSafeInteger(index) || index < 0) return;
    const members = Array.isArray(this.item.system.members)
      ? structuredClone(this.item.system.members)
      : [];
    members.splice(index, 1);
    await this.item.update({ "system.members": members });
    this.render();
  };

  static readonly #addSpeciesBound = async function (
    this: D6System2eItemSheet,
  ): Promise<void> {
    if (!this.isEditable || this.item.type !== "species-template") return;
    const bounds = Array.isArray(this.item.system.attributeBounds)
      ? structuredClone(this.item.system.attributeBounds)
      : [];
    bounds.push({ attributeId: "agility", maximum: 15, minimum: 3 });
    await this.item.update({ "system.attributeBounds": bounds });
    this.render();
  };

  static readonly #removeSpeciesBound = async function (
    this: D6System2eItemSheet,
    _event: Event,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.isEditable || this.item.type !== "species-template") return;
    const index = Number(
      target.closest<HTMLElement>("[data-bound-index]")?.dataset.boundIndex,
    );
    if (!Number.isSafeInteger(index) || index < 0) return;
    const bounds = Array.isArray(this.item.system.attributeBounds)
      ? structuredClone(this.item.system.attributeBounds)
      : [];
    bounds.splice(index, 1);
    await this.item.update({ "system.attributeBounds": bounds });
    this.render();
  };

  static readonly #editEffect = function (
    this: D6System2eItemSheet,
    _event: Event,
    target: HTMLElement,
  ): void {
    if (!this.#mayManageEffects()) return;
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

  static readonly #saveDescription = async function (
    this: D6System2eItemSheet,
  ): Promise<void> {
    if (!this.isEditable) return;
    const description = this.element.querySelector<HTMLTextAreaElement>(
      'textarea[name="system.description"]',
    );
    if (!description) return;
    await this.item.update(descriptionChanges(description.value));
    this.render();
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
    if (!this.isEditable) return;
    const descriptionField = _form.elements.namedItem("system.description");
    const submittedDescription =
      descriptionField instanceof HTMLTextAreaElement
        ? descriptionField.value
        : formData.object["system.description"];
    const directEdit = mayDirectEditItem(this.item);
    if (!directEdit) {
      if (typeof submittedDescription === "string") {
        await this.item.update(descriptionChanges(submittedDescription));
      }
      return;
    }
    let changes = { ...formData.object };
    // Artwork is persisted immediately by the native image picker. Foundry's
    // extended form data may otherwise synthesize an invalid `img` value from
    // the artwork button and cause the complete Item update to be rejected.
    delete changes.img;
    if (typeof submittedDescription === "string") {
      Object.assign(changes, descriptionChanges(submittedDescription));
    }
    if (this.item.type === "character-template") {
      const attributeScores = Array.from(
        _form.querySelectorAll<HTMLElement>("[data-template-attribute-index]"),
      ).flatMap((row) => {
        const attributeId = stringValue(
          row.querySelector<HTMLSelectElement>("select")?.value,
        );
        const dice = Number(
          row.querySelector<HTMLInputElement>("[data-template-dice]")?.value,
        );
        const pips = Number(
          row.querySelector<HTMLInputElement>("[data-template-pips]")?.value,
        );
        if (
          !attributeId ||
          !Number.isSafeInteger(dice) ||
          !Number.isSafeInteger(pips)
        )
          return [];
        return [
          {
            attributeId,
            score: Math.max(0, Math.min(60, dice * 3 + pips)),
          },
        ];
      });
      changes = Object.fromEntries(
        Object.entries(changes).filter(
          ([key]) => !key.startsWith("system.attributeScores."),
        ),
      );
      changes["system.attributeScores"] = attributeScores;
    }
    const prerequisites = changes.prerequisiteSkillKeys;
    const prerequisitesPresent =
      changes.prerequisiteSkillKeysPresent === "true";
    delete changes.prerequisiteSkillKeys;
    delete changes.prerequisiteSkillKeysPresent;
    const gadgetTarget = changes.superheroicGadgetTarget;
    delete changes.superheroicGadgetTarget;
    Object.assign(changes, superheroicGadgetTargetChanges(gadgetTarget));
    const superheroicPowerTalentIds = changes.superheroicPowerTalentIds;
    const superheroicPowerTalentIdsPresent =
      changes.superheroicPowerTalentIdsPresent === "true";
    delete changes.superheroicPowerTalentIds;
    delete changes.superheroicPowerTalentIdsPresent;
    if (
      typeof superheroicPowerTalentIds === "string" ||
      Array.isArray(superheroicPowerTalentIds) ||
      superheroicPowerTalentIdsPresent
    ) {
      const values = Array.isArray(superheroicPowerTalentIds)
        ? superheroicPowerTalentIds
        : typeof superheroicPowerTalentIds === "string"
          ? superheroicPowerTalentIds.split(",")
          : [];
      const selectedIds = [
        ...new Set(
          values.filter(
            (value): value is string =>
              typeof value === "string" && value.length > 0,
          ),
        ),
      ];
      const parent = this.item.parent;
      const snapshots = selectedIds.flatMap((itemId) => {
        const talent = parent?.items.get(itemId);
        if (talent?.type !== "talent" || talent.system.superpower !== true) {
          return [];
        }
        const plan = superpowerTalentCostPlan(
          integer(talent.system.cost),
          integer(talent.system.rank),
          integer(talent.system.superpowerEnhancementCost),
          integer(talent.system.superpowerLimitationCredit),
        );
        return [
          {
            automatic: talent.system.superpowerAutomatic === true,
            name: talent.name,
            sourceItemId: talent.id,
            totalCost: plan.totalCost,
          },
        ];
      });
      changes["system.superheroicPowerTalentIds"] = selectedIds;
      changes["system.superheroicPowerSnapshots"] = snapshots;
      if (
        parent &&
        stringValue(this.item.system.superheroicCreatorActorId).length === 0
      ) {
        changes["system.superheroicCreatorActorId"] = parent.id;
      }
    }
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
    } else if (this.item.type === "manifestation") {
      await game.system.api?.magic.cast(actor, this.item.id);
    } else if (this.item.type === "weapon") {
      await game.system.api?.roll.item(actor, this.item.id, "attack");
    }
  };

  static DEFAULT_OPTIONS = {
    actions: {
      addCharacterTemplateAttribute: this.#addCharacterTemplateAttribute,
      addSpeciesBound: this.#addSpeciesBound,
      addTemplateMember: this.#addTemplateMember,
      createEffect: this.#createEffect,
      deleteEffect: this.#deleteEffect,
      editImage: this.#editImage,
      editEffect: this.#editEffect,
      roll: this.#roll,
      removeSpeciesBound: this.#removeSpeciesBound,
      removeCharacterTemplateAttribute: this.#removeCharacterTemplateAttribute,
      removeCharacterTemplateItem: this.#removeCharacterTemplateItem,
      removeTemplateMember: this.#removeTemplateMember,
      saveDescription: this.#saveDescription,
      setItemTab: this.#setItemTab,
      useActiveCharacterTemplateProfile:
        this.#useActiveCharacterTemplateProfile,
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

  override async _onRender(
    context: Record<string, unknown>,
    options: Record<string, unknown>,
  ): Promise<void> {
    await super._onRender(context, options);
    for (const tab of Array.from(
      this.element.querySelectorAll<HTMLButtonElement>(
        "[data-action='setItemTab'][data-item-tab]",
      ),
    )) {
      tab.disabled = false;
    }
    this.element.removeEventListener("change", this.#persistMagicDesignChange);
    this.element.removeEventListener(
      "focusout",
      this.#persistMagicDesignChange,
    );
    this.element.addEventListener("change", this.#persistMagicDesignChange);
    this.element.addEventListener("focusout", this.#persistMagicDesignChange);
    this.element.removeEventListener("change", this.#persistEquipmentChange);
    this.element.removeEventListener("focusout", this.#persistEquipmentChange);
    this.element.addEventListener("change", this.#persistEquipmentChange);
    this.element.addEventListener("focusout", this.#persistEquipmentChange);
    this.element.removeEventListener(
      "change",
      this.#persistCharacterTemplateAttribute,
    );
    this.element.addEventListener(
      "change",
      this.#persistCharacterTemplateAttribute,
    );
    this.element.removeEventListener(
      "dragover",
      this.#allowCharacterTemplateDrop,
    );
    this.element.removeEventListener(
      "drop",
      this.#queueDroppedCharacterTemplateItem,
    );
    this.element.addEventListener("dragover", this.#allowCharacterTemplateDrop);
    this.element.addEventListener(
      "drop",
      this.#queueDroppedCharacterTemplateItem,
    );
  }

  _prepareContext(): Promise<Record<string, unknown>> {
    const rulesProfile = currentRulesProfile();
    const terminology = currentTerminology();
    const selectedAttribute =
      typeof this.item.system.attributeId === "string"
        ? this.item.system.attributeId
        : "agility";
    const score = integer(this.item.system.score);
    const creationEdit =
      this.item.parent != null &&
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
      "character-template": "D6E2.Template.Title",
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
    const typeLabel =
      this.item.type === "manifestation" && terminology.manifestations.singular
        ? terminology.manifestations.singular
        : this.item.type === "specialability" &&
            terminology.items.specialAbility
          ? terminology.items.specialAbility
          : game.i18n.localize(typeLabels[this.item.type] ?? "D6E2.Item.Item");
    const linkedTalentOptions = Object.fromEntries(
      ((this.item.parent?.items.contents ?? []) as FoundryItemDocument[])
        .filter((item) => item.type === "talent")
        .map((item) => [item.id, item.name]),
    );
    const directEdit = this.isEditable && mayDirectEditItem(this.item);
    const campaignEquipmentEra =
      currentSecondEditionCampaignProfile().equipmentEra;
    const equipmentProvenance = record(this.item.system.equipmentProvenance);
    const itemEquipmentEra = stringValue(equipmentProvenance.era, "none");
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
    const magic =
      this.item.type === "manifestation" ? this.#magicView() : undefined;
    const isSuperpower =
      this.item.type === "talent" && this.item.system.superpower === true;
    const superpowerCost = isSuperpower
      ? superpowerTalentCostPlan(
          integer(this.item.system.cost),
          integer(this.item.system.rank),
          integer(this.item.system.superpowerEnhancementCost),
          integer(this.item.system.superpowerLimitationCredit),
        )
      : null;
    const isPersonalGear = this.item.type === "gear";
    const superheroicEquipmentKind = stringValue(
      this.item.system.superheroicEquipmentKind,
      "none",
    );
    const superheroicCreatorActorId = stringValue(
      this.item.system.superheroicCreatorActorId,
    );
    const gearParent = this.item.parent;
    const mayConfigureContainedPowers =
      isPersonalGear &&
      gearParent != null &&
      (superheroicCreatorActorId.length === 0 ||
        superheroicCreatorActorId === gearParent.id);
    const selectedPowerIds = Array.isArray(
      this.item.system.superheroicPowerTalentIds,
    )
      ? this.item.system.superheroicPowerTalentIds.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    const superheroicPowerChoices = mayConfigureContainedPowers
      ? gearParent.items.contents
          .filter(
            (item) => item.type === "talent" && item.system.superpower === true,
          )
          .map((item) => ({
            id: item.id,
            name: item.name,
            selected: selectedPowerIds.includes(item.id),
          }))
      : [];
    const superheroicGadgetTargetOptions: Record<string, string> =
      Object.fromEntries([
        ...activeAttributeDefinitions(
          rulesProfile.compatibility.firstEditionAttributes,
          campaignOptionalAttributeIds(),
        ).map(({ id, label }): [string, string] => [
          `attribute:${id}`,
          `${game.i18n.localize("D6E2.GadgetsGear.Attribute")}: ${
            terminologyAttributeLabel(terminology, id) ??
            game.i18n.localize(label)
          }`,
        ]),
        ...(this.item.parent?.items.contents ?? [])
          .filter((item) => item.type === "skill")
          .map((item): [string, string] => [
            `skill:${item.id}`,
            `${game.i18n.localize("D6E2.GadgetsGear.Skill")}: ${item.name}`,
          ]),
      ]);
    const storedPowerSnapshots = Array.isArray(
      this.item.system.superheroicPowerSnapshots,
    )
      ? this.item.system.superheroicPowerSnapshots.map((value) => record(value))
      : [];
    const rebuildDays = superheroicEquipmentRebuildDays(
      storedPowerSnapshots.map((power) => ({
        totalCost: integer(power.totalCost),
      })),
      this.item.system.superheroicRebuildDisabled === true,
    );
    const superheroicEquipmentState = stringValue(
      this.item.system.superheroicEquipmentState,
      "ready",
    );
    const templateAttributeDefinitions = new Map(
      [
        ...activeAttributeDefinitions(
          false,
          new Set(["mechanical", "technical", "charm", "magic", "mysticism"]),
        ),
        ...activeAttributeDefinitions(true, new Set()),
      ].map((definition) => [definition.id, definition] as const),
    );
    const characterTemplateAttributes = (
      Array.isArray(this.item.system.attributeScores)
        ? this.item.system.attributeScores
        : []
    ).map((value, index) => {
      const attribute = record(value);
      const score = integer(attribute.score);
      return {
        attributeId: stringValue(attribute.attributeId),
        dice: Math.floor(score / 3),
        index,
        pips: score % 3,
        scoreLabel: formatPipScore(score),
      };
    });
    const characterTemplateItems = (
      Array.isArray(this.item.system.items) ? this.item.system.items : []
    ).map((value, index) => {
      const templateItem = record(value);
      const type = stringValue(templateItem.type);
      return {
        img: stringValue(templateItem.img, "icons/svg/item-bag.svg"),
        index,
        name: stringValue(templateItem.name),
        sourceUuid: stringValue(templateItem.sourceUuid),
        type,
        typeLabel:
          type === "specialability" && terminology.items.specialAbility
            ? terminology.items.specialAbility
            : game.i18n.localize(typeLabels[type] ?? "D6E2.Item.Item"),
      };
    });
    return Promise.resolve({
      attributeOptions: Object.fromEntries(
        activeAttributeDefinitions(
          rulesProfile.compatibility.firstEditionAttributes,
          campaignOptionalAttributeIds(),
        ).map(({ id, label }) => [
          id,
          terminologyAttributeLabel(terminology, id) ??
            game.i18n.localize(label),
        ]),
      ),
      armorStackingOptions: {
        "": game.i18n.localize("D6E2.Item.ArmorBody"),
        shield: game.i18n.localize("D6E2.Item.ArmorShield"),
      },
      characterTemplateAttributeOptions: Object.fromEntries(
        [...templateAttributeDefinitions.values()].map(({ id, label }) => [
          id,
          terminologyAttributeLabel(terminology, id) ??
            game.i18n.localize(label),
        ]),
      ),
      characterTemplateAttributes,
      characterTemplateItems,
      characterTemplateItemCount: characterTemplateItems.length,
      characterTemplateRulesFamilyOptions: {
        "d6-system-second-edition": game.i18n.localize(
          "D6E2.Drop.RulesFamily.SecondEdition",
        ),
        "open-d6-first-edition": game.i18n.localize(
          "D6E2.Drop.RulesFamily.FirstEdition",
        ),
      },
      isFirstEditionCharacterTemplate:
        this.item.type === "character-template" &&
        this.item.system.rulesFamily === "open-d6-first-edition",
      damageLabel: formatPipScore(currentEffectivePipScore(damage)),
      contextOptions: {
        personal: game.i18n.localize("D6E2.Item.ContextPersonal"),
        starship: game.i18n.localize("D6E2.Item.ContextStarship"),
        vehicle: game.i18n.localize("D6E2.Item.ContextVehicle"),
      },
      campaignEquipmentEraLabel: game.i18n.localize(
        campaignEquipmentEra === "science-fiction"
          ? "D6E2.Equipment.Era.ScienceFiction"
          : campaignEquipmentEra === "medieval"
            ? "D6E2.Equipment.Era.Medieval"
            : campaignEquipmentEra === "modern"
              ? "D6E2.Equipment.Era.Modern"
              : "D6E2.Equipment.Era.None",
      ),
      equipmentEraMismatch:
        campaignEquipmentEra !== "none" &&
        itemEquipmentEra !== "none" &&
        campaignEquipmentEra !== itemEquipmentEra,
      equipmentEraSummaryClass:
        campaignEquipmentEra !== "none" &&
        itemEquipmentEra !== "none" &&
        campaignEquipmentEra !== itemEquipmentEra
          ? "is-mismatch"
          : "",
      equipmentEraOptions: {
        none: game.i18n.localize("D6E2.Equipment.Era.None"),
        medieval: game.i18n.localize("D6E2.Equipment.Era.Medieval"),
        modern: game.i18n.localize("D6E2.Equipment.Era.Modern"),
        "science-fiction": game.i18n.localize(
          "D6E2.Equipment.Era.ScienceFiction",
        ),
      },
      itemEquipmentEra,
      provenanceEditable: directEdit && game.user?.isGM === true,
      directEdit,
      descriptionEditable: this.isEditable,
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
      isCybernetic: this.item.type === "cybernetic",
      augmentationKindOptions: {
        cyberware: game.i18n.localize("D6E2.Cyberpunk.Cyberware"),
        bioware: game.i18n.localize("D6E2.Cyberpunk.Bioware"),
      },
      linkedTalentOptions,
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
      isPersonalGear,
      gadgetsGearModuleActive:
        currentSecondEditionCampaignProfile().gadgetsGear,
      superheroicEquipmentKind,
      isGadget: superheroicEquipmentKind === "gadget",
      isSuperheroicGear: superheroicEquipmentKind === "gear",
      superheroicEquipmentKindOptions: {
        none: game.i18n.localize("D6E2.GadgetsGear.Kind.None"),
        gadget: game.i18n.localize("D6E2.GadgetsGear.Kind.Gadget"),
        gear: game.i18n.localize("D6E2.GadgetsGear.Kind.Gear"),
      },
      superheroicGadgetTargetOptions,
      selectedSuperheroicGadgetTarget: `${stringValue(
        this.item.system.gadgetTargetKind,
        "skill",
      )}:${stringValue(this.item.system.gadgetTargetId)}`,
      mayConfigureContainedPowers,
      superheroicPowerChoices,
      storedPowerSnapshots,
      superheroicEquipmentStateLabel: game.i18n.localize(
        superheroicEquipmentState === "destroyed"
          ? "D6E2.GadgetsGear.State.Destroyed"
          : superheroicEquipmentState === "malfunctioning"
            ? "D6E2.GadgetsGear.State.Malfunctioning"
            : "D6E2.GadgetsGear.State.Ready",
      ),
      superheroicRebuildDays: rebuildDays,
      superheroicRebuildAvailable: rebuildDays !== null,
      isMachineWeapon: ["starship-weapon", "vehicle-weapon"].includes(
        this.item.type,
      ),
      isRollable: [
        "skill",
        "specialization",
        "manifestation",
        "weapon",
      ].includes(this.item.type),
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
      isSuperpower,
      superpowerModuleActive: currentSecondEditionCampaignProfile().superpowers,
      superpowerCost,
      isNarrativeFeature: ["asset", "trouble"].includes(this.item.type),
      isManifestation: this.item.type === "manifestation",
      isItemGroup: this.item.type === "item-group",
      isCharacterTemplate: this.item.type === "character-template",
      isSpeciesTemplate: this.item.type === "species-template",
      isTemplateContainer: ["item-group", "species-template"].includes(
        this.item.type,
      ),
      rulesFamilyOptions: {
        both: game.i18n.localize("D6E2.Drop.RulesFamily.Both"),
        "d6-system-second-edition": game.i18n.localize(
          "D6E2.Drop.RulesFamily.SecondEdition",
        ),
        "open-d6-first-edition": game.i18n.localize(
          "D6E2.Drop.RulesFamily.FirstEdition",
        ),
      },
      isTrait: [
        "action",
        "advantage",
        "disadvantage",
        "specialability",
      ].includes(this.item.type),
      isWeapon: ["starship-weapon", "vehicle-weapon", "weapon"].includes(
        this.item.type,
      ),
      isThrownExplosive:
        this.item.type === "weapon" &&
        stringValue(this.item.system.weaponKind) === "thrown-explosive",
      thrownExplosiveGuidance: game.i18n.localize(
        rulesProfile.compatibility.firstEditionAttributes
          ? "D6E2.Item.ThrownExplosiveGuidance.FirstEdition"
          : "D6E2.Item.ThrownExplosiveGuidance.SecondEdition",
      ),
      weaponKindOptions: {
        standard: game.i18n.localize("D6E2.Item.WeaponKind.Standard"),
        "thrown-explosive": game.i18n.localize(
          "D6E2.Item.WeaponKind.ThrownExplosive",
        ),
      },
      damageBasisOptions: {
        fixed: game.i18n.localize("D6E2.Item.DamageBasis.Fixed"),
        "strength-damage": game.i18n.localize(
          "D6E2.Item.DamageBasis.StrengthDamage",
        ),
      },
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
      scoreLabel:
        magic === undefined
          ? formatPipScore(currentEffectivePipScore(score))
          : game.i18n.format("D6E2.Magic.DifficultySummary", {
              difficulty: record(magic.difficulty).difficulty,
            }),
      selectedAttribute,
      trainingOptions: {
        advanced: game.i18n.localize("D6E2.Item.AdvancedSkill"),
        psionic: game.i18n.localize("D6E2.Item.PsionicDiscipline"),
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
      magic,
      typeLabel,
    });
  }

  #magicView(): Record<string, unknown> {
    if (
      this.item.system.magicSystem === "first-edition-fantasy" ||
      this.item.system.magicSystem === "first-edition-adventure"
    ) {
      const firstEdition = record(this.item.system.firstEdition);
      const adventure =
        this.item.system.magicSystem === "first-edition-adventure";
      const tradition =
        adventure && firstEdition.tradition === "psionics"
          ? "psionics"
          : !adventure && firstEdition.tradition === "miracles"
            ? "miracles"
            : "magic";
      return {
        difficulty: {
          difficulty: Math.max(
            tradition === "miracles" ? 5 : 2,
            integer(firstEdition.difficulty),
          ),
        },
        firstEdition: true,
        rulesReference: adventure
          ? "D6 Adventure, printed pp. 95–111"
          : "D6 Fantasy, printed pp. 83–112",
        skillOptions:
          tradition === "psionics"
            ? {
                "psionics-astral-projection": "Psionics: Astral Projection",
                "psionics-empathy": "Psionics: Empathy",
                "psionics-far-sensing": "Psionics: Far-Sensing",
                "psionics-healing": "Psionics: Healing",
                "psionics-medium": "Psionics: Medium",
                "psionics-protection": "Psionics: Protection",
                "psionics-psychometry": "Psionics: Psychometry",
                "psionics-strike": "Psionics: Strike",
                "psionics-telekinesis": "Psionics: Telekinesis",
                "psionics-telepathy": "Psionics: Telepathy",
              }
            : tradition === "miracles"
              ? {
                  "miracles-divination": game.i18n.localize(
                    "D6E2.Magic.FirstEdition.Skill.MiraclesDivination",
                  ),
                  "miracles-favor": game.i18n.localize(
                    "D6E2.Magic.FirstEdition.Skill.Favor",
                  ),
                  "miracles-strife": game.i18n.localize(
                    "D6E2.Magic.FirstEdition.Skill.Strife",
                  ),
                }
              : {
                  "magic-alteration": game.i18n.localize(
                    "D6E2.Magic.FirstEdition.Skill.Alteration",
                  ),
                  "magic-apportation": game.i18n.localize(
                    "D6E2.Magic.FirstEdition.Skill.Apportation",
                  ),
                  "magic-conjuration": game.i18n.localize(
                    "D6E2.Magic.FirstEdition.Skill.Conjuration",
                  ),
                  "magic-divination": game.i18n.localize(
                    "D6E2.Magic.FirstEdition.Skill.MagicDivination",
                  ),
                },
        traditionOptions: {
          magic: game.i18n.localize("D6E2.Magic.FirstEdition.Tradition.Magic"),
          ...(adventure
            ? {
                psionics: game.i18n.localize(
                  "D6E2.Magic.FirstEdition.Tradition.Psionics",
                ),
              }
            : {
                miracles: game.i18n.localize(
                  "D6E2.Magic.FirstEdition.Tradition.Miracles",
                ),
              }),
        },
      };
    }
    const design = {
      castingTime: stringValue(this.item.system.castingTime, "action"),
      duration: stringValue(this.item.system.duration, "instant"),
      power: Math.max(1, integer(this.item.system.power)),
      range: stringValue(this.item.system.range, "melee"),
      resistance: stringValue(this.item.system.resistance, "partial"),
      school: stringValue(this.item.system.school, "alteration"),
      target: stringValue(this.item.system.target, "one"),
    } as D6FreeformMagicDesignV1;
    const options = (prefix: string, values: readonly string[]) =>
      Object.fromEntries(
        values.map((value) => [
          value,
          game.i18n.localize(`${prefix}.${value}`),
        ]),
      );
    return {
      firstEdition: false,
      castingTimeOptions: options("D6E2.Magic.CastingTime", [
        "action",
        "two-turns",
        "four-turns",
        "hour",
        "day",
        "week",
        "month",
        "year",
      ]),
      difficulty: freeformMagicDifficulty(design),
      durationOptions: options("D6E2.Magic.Duration", [
        "instant",
        "round",
        "ten-minutes",
        "hour",
        "day",
        "week",
        "month",
        "year",
        "century",
        "permanent",
      ]),
      rangeOptions: options("D6E2.Magic.Range", [
        "melee",
        "senses",
        "mile",
        "locale",
        "hundred-miles",
        "unlimited",
      ]),
      resistanceOptions: options("D6E2.Magic.Resistance", [
        "none",
        "partial",
        "complete",
      ]),
      schoolOptions: options("D6E2.Magic.School", [
        "alteration",
        "apportation",
        "conjuration",
        "divination",
      ]),
      targetOptions: options("D6E2.Magic.Target", [
        "self",
        "one",
        "two-three",
        "four-six",
        "small-crowd",
        "large-crowd",
        "object",
        "large-object",
        "environment",
        "large-environment",
      ]),
    };
  }
}
