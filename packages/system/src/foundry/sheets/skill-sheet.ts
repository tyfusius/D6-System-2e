import { formatPipScore } from "@d6-system-2e/core";
import { SYSTEM_ID } from "../../constants";
import { currentTerminology } from "../../registries/terminology";
import { currentRulesProfile } from "../../settings/rules-compatibility";
import { mayDirectEditMechanicalScore } from "../mechanical-edit-guard";
import { activeAttributeDefinitions, integer, record } from "./values";

const SkillSheetBase = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2,
);

function mayDirectEditSkill(item: FoundryItemDocument): boolean {
  if (game.user?.isGM !== true) return false;
  const parent = item.parent;
  if (!parent) return true;
  return mayDirectEditMechanicalScore(
    record(parent.system.sheetMode).value,
    true,
  );
}

export class D6System2eSkillSheet extends SkillSheetBase {
  static PARTS = {
    main: {
      template: `systems/${SYSTEM_ID}/templates/item/skill-sheet.hbs`,
    },
  };

  static readonly #submitSheet = async function (
    this: D6System2eSkillSheet,
    _event: SubmitEvent,
    _form: HTMLFormElement,
    formData: FoundryFormData,
  ): Promise<void> {
    if (!this.isEditable || !mayDirectEditSkill(this.item)) return;
    await this.item.update(formData.object);
  };

  static readonly #roll = async function (
    this: D6System2eSkillSheet,
  ): Promise<void> {
    const actor = this.item.parent;
    if (!actor) {
      ui.notifications.warn("Add this skill to a character before rolling it.");
      return;
    }
    await game.system.api?.roll.skill(actor, this.item.id);
  };

  static DEFAULT_OPTIONS = {
    actions: {
      roll: this.#roll,
    },
    classes: ["d6e2", "d6e2-skill-sheet", "od6s-item-v2"],
    form: {
      closeOnSubmit: false,
      handler: this.#submitSheet,
      submitOnChange: false,
      submitOnClose: true,
    },
    position: {
      height: 480,
      width: 520,
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
    return Promise.resolve({
      attributeOptions: Object.fromEntries(
        activeAttributeDefinitions(
          rulesProfile.compatibility.firstEditionAttributes,
        ).map(({ id, label }) => [
          id,
          terminology.attributes[id] ?? game.i18n.localize(label),
        ]),
      ),
      directEdit: this.isEditable && mayDirectEditSkill(this.item),
      editable: this.isEditable,
      item: this.item,
      score,
      scoreLabel: formatPipScore(score),
      selectedAttribute,
    });
  }
}
