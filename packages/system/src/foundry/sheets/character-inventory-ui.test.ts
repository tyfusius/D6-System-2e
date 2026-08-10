import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("OpenD6 Next character inventory parity", () => {
  const equipmentTemplate = read(
    "../../../../../templates/actor/character/equipment.hbs",
  );
  const traitsTemplate = read(
    "../../../../../templates/actor/character/traits.hbs",
  );
  const attributesTemplate = read(
    "../../../../../templates/actor/character/attributes.hbs",
  );
  const sheet = read("./character-sheet.ts");
  const css = read("../../../../../styles/d6-system-2e.css");

  it("uses the canonical inventory row component and accessible item actions", () => {
    expect(equipmentTemplate).toContain('class="od6v2-inventory-list"');
    expect(equipmentTemplate).toContain('class="od6v2-inventory-row"');
    expect(equipmentTemplate).toContain('class="od6v2-inventory-name"');
    expect(equipmentTemplate).toContain('data-action="createItem"');
    expect(equipmentTemplate).toContain('data-action="editItem"');
    expect(equipmentTemplate).toContain('data-action="deleteItem"');
    expect(css).toContain("body.system-d6-system-2e .od6v2-inventory-row");
  });

  it("reserves destructive embedded Item removal for GM Free Edit", () => {
    const deleteActionStart = sheet.indexOf(
      "static readonly #deleteItem = async function",
    );
    const economyActionStart = sheet.indexOf(
      "async #runEconomyAction",
      deleteActionStart,
    );
    const deleteAction = sheet.slice(deleteActionStart, economyActionStart);
    const removableTemplates = [
      equipmentTemplate,
      traitsTemplate,
      attributesTemplate,
      read("../../../../../templates/actor/character/combat.hbs"),
      read("../../../../../templates/actor/character/cyberpunk.hbs"),
      read("../../../../../templates/actor/character/psionics.hbs"),
      read("../../../../../templates/actor/character/superheroic.hbs"),
    ];

    expect(deleteAction).toContain('storedMode !== "freeedit"');
    expect(deleteAction).toContain("game.user?.isGM !== true");
    expect(deleteAction).toContain(
      'deleteEmbeddedDocuments("Item", [item.id])',
    );
    expect(deleteAction).not.toContain("mayDirectEditMechanicalScore");
    expect(deleteAction).toContain("confirmItemDeletion(item.name)");
    for (const template of removableTemplates) {
      expect(template).toContain('data-action="deleteItem"');
      expect(template).toContain('class="fa-solid fa-trash"');
    }
    expect(equipmentTemplate).toContain("{{#if @root.freeEdit}}");
    expect(traitsTemplate).toContain("{{#if @root.freeEdit}}");
  });

  it("shows quantity and supports owner equipment toggles directly in inventory", () => {
    expect(equipmentTemplate).toContain("{{#if item.quantity}}");
    expect(equipmentTemplate).toContain("×{{item.quantity}}");
    expect(equipmentTemplate).toContain('data-action="toggleEquipped"');
    expect(equipmentTemplate).toContain("{{checked item.equipped}}");
    expect(equipmentTemplate).toContain("{{disabled (not @root.editable)}}");
    expect(sheet).toContain("const equippableItemTypes = new Set");
    expect(sheet).toContain("quantity: Math.max(0");
    expect(sheet).toContain("toggleEquipped: this.#toggleEquipped");
  });

  it("offers independently optional owner-or-GM equipment transfers on every equipment row", () => {
    expect(equipmentTemplate).toContain('data-action="transferEquipment"');
    expect(equipmentTemplate).toContain("{{#if item.showTransfer}}");
    expect(equipmentTemplate).toContain("{{disabled (not item.canTransfer)}}");
    expect(sheet).toContain("characterEquipmentTransfersEnabled()");
    expect(sheet).toContain("(isGM || this.actor.isOwner === true)");
    expect(sheet).toContain("canTransferEquipmentItem(item)");
    expect(sheet).toContain("transferCharacterEquipment(this.actor, item)");
    expect(read("../economy-service.ts")).toContain('type: "item-drop"');
    expect(css).toContain(".d6e2-equipment-transfer:disabled");
  });

  it("shows era classifications and preserves visible mismatch guidance", () => {
    expect(equipmentTemplate).toContain("item.equipmentEraLabel");
    expect(equipmentTemplate).toContain("item.equipmentEraClass");
    expect(sheet).toContain("campaignEquipmentEra");
    expect(sheet).toContain("equipmentEraClass:");
    expect(css).toContain(".d6e2-equipment-era-label.is-mismatch");
  });

  it("opens every owned Item for inspection without granting mechanical edits", () => {
    const editActionStart = sheet.indexOf(
      "static readonly #editItem = function",
    );
    const deleteActionStart = sheet.indexOf(
      "static readonly #deleteItem = async function",
    );
    const editAction = sheet.slice(editActionStart, deleteActionStart);
    expect(editAction).toContain("item.sheet.render(true)");
    expect(editAction).not.toContain("mayDirectEditMechanicalScore");
    expect(attributesTemplate).toContain("'D6E2.Item.OpenDetails'");
    expect(attributesTemplate).toContain(
      '<i class="fa-solid fa-book-open" aria-hidden="true"></i>',
    );
  });

  it("accepts specialized drops, transfer, and same-family reordering", () => {
    expect(sheet).toContain("actorItemDropData(event)");
    expect(sheet).toContain("itemFromDropData(data)");
    expect(sheet).toContain('Hooks.callAll?.("dropActorSheetData"');
    expect(sheet).toContain("previewActorItemDrop(this.actor, item)");
    expect(sheet).toContain("applyActorItemDrop(this.actor, item)");
    expect(sheet).toContain("void this.#dropItem(event)");
    expect(sheet).toContain('item.parent?.documentName === "Actor"');
    expect(sheet).toContain("transferActorItem(this.actor, item)");
    expect(sheet).toContain("sortActorItem(this.actor, item");
    expect(equipmentTemplate).toContain('draggable="{{@root.editable}}"');
    expect(attributesTemplate).toContain('draggable="{{@root.editable}}"');
    expect(css).toContain(".od6s-character-v2.is-item-drop-target");
  });

  it("separates Equipment from Traits and keeps Specializations with their Skills", () => {
    expect(equipmentTemplate).toContain('data-tab="equipment"');
    expect(equipmentTemplate).toContain("equipmentGroups");
    expect(traitsTemplate).toContain('data-tab="traits"');
    expect(traitsTemplate).toContain("traitGroups");
    expect(sheet).toContain("const equipmentItemTypes = [");
    expect(sheet).toContain("const traitItemTypes = [");
    expect(sheet).not.toContain('["specialization"]');
    expect(attributesTemplate).toContain(
      '{{#if (eq skill.training "specialization")}}',
    );
  });
});
