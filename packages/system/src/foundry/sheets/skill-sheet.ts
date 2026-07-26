import { SYSTEM_ID } from "../../constants";
import { CORE_ATTRIBUTES, integer, record } from "./values";

const SkillSheetBase = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2,
);

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
    await this.item.update(formData.object);
  };

  static DEFAULT_OPTIONS = {
    classes: ["d6e2", "d6e2-skill-sheet"],
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
    const selectedAttribute =
      typeof this.item.system.attributeId === "string"
        ? this.item.system.attributeId
        : "agility";
    const rating = record(this.item.system.rating);
    return Promise.resolve({
      attributeOptions: Object.fromEntries(
        CORE_ATTRIBUTES.map(({ id, label }) => [id, game.i18n.localize(label)]),
      ),
      editable: this.isEditable,
      item: this.item,
      rating: Object.freeze({
        dice: integer(rating.dice),
      }),
      selectedAttribute,
    });
  }
}
