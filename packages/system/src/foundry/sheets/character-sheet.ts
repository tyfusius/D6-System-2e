import { SYSTEM_ID } from "../../constants";
import { CORE_ATTRIBUTES, integer, record } from "./values";

const CharacterSheetBase = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2,
);

interface CharacterAttributeView {
  readonly dice: number;
  readonly editable: boolean;
  readonly id: string;
  readonly label: string;
}

interface CharacterSkillView {
  readonly attributeId: string;
  readonly dice: number;
  readonly id: string;
  readonly name: string;
}

export class D6System2eCharacterSheet extends CharacterSheetBase {
  static PARTS = {
    main: {
      template: `systems/${SYSTEM_ID}/templates/actor/character-sheet.hbs`,
    },
  };

  static readonly #createSkill = async function (
    this: D6System2eCharacterSheet,
  ): Promise<void> {
    const created = await this.actor.createEmbeddedDocuments("Item", [
      {
        name: game.i18n.localize("D6E2.NewSkill"),
        system: {
          attributeId: "agility",
          description: "",
          key: "new-skill",
          rating: { dice: 0, pips: 0 },
          training: "standard",
        },
        type: "skill",
      },
    ]);
    created[0]?.sheet.render(true);
  };

  static readonly #editSkill = function (
    this: D6System2eCharacterSheet,
    _event: Event,
    target: HTMLElement,
  ): void {
    const itemId =
      target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
    if (!itemId) return;
    this.actor.items.get(itemId)?.sheet.render(true);
  };

  static readonly #submitSheet = async function (
    this: D6System2eCharacterSheet,
    _event: SubmitEvent,
    _form: HTMLFormElement,
    formData: FoundryFormData,
  ): Promise<void> {
    await this.actor.update(formData.object);
  };

  static DEFAULT_OPTIONS = {
    actions: {
      createSkill: this.#createSkill,
      editSkill: this.#editSkill,
    },
    classes: ["d6e2", "d6e2-character-sheet"],
    form: {
      closeOnSubmit: false,
      handler: this.#submitSheet,
      submitOnChange: false,
      submitOnClose: true,
    },
    position: {
      height: 720,
      width: 760,
    },
    tag: "form",
    window: {
      icon: "fa-solid fa-dice-d6",
      resizable: true,
    },
  };

  _prepareContext(): Promise<Record<string, unknown>> {
    const attributes = record(this.actor.system.attributes);
    const coreAttributes: readonly CharacterAttributeView[] =
      CORE_ATTRIBUTES.map(({ id, label }) => {
        const value = record(attributes[id]);
        return Object.freeze({
          dice: integer(value.dice),
          editable: this.isEditable,
          id,
          label: game.i18n.localize(label),
        });
      });
    const skills: readonly CharacterSkillView[] = this.actor.items.contents.map(
      (item) => {
        const rating = record(item.system.rating);
        return Object.freeze({
          attributeId:
            typeof item.system.attributeId === "string"
              ? item.system.attributeId
              : "",
          dice: integer(rating.dice),
          id: item.id,
          name: item.name,
        });
      },
    );
    const resources = record(this.actor.system.resources);
    const heroPoints = record(resources.heroPoints);
    return Promise.resolve({
      actor: this.actor,
      coreAttributes,
      editable: this.isEditable,
      heroPoints: integer(heroPoints.value),
      skills,
    });
  }
}
