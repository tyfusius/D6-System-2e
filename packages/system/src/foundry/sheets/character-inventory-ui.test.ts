import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("OpenD6 Next character inventory parity", () => {
  const template = read("../../../../../templates/actor/character/items.hbs");
  const attributesTemplate = read(
    "../../../../../templates/actor/character/attributes.hbs",
  );
  const sheet = read("./character-sheet.ts");
  const css = read("../../../../../styles/d6-system-2e.css");

  it("uses the canonical inventory row component and accessible item actions", () => {
    expect(template).toContain('class="od6v2-inventory-list"');
    expect(template).toContain('class="od6v2-inventory-row"');
    expect(template).toContain('class="od6v2-inventory-name"');
    expect(template).toContain('data-action="createItem"');
    expect(template).toContain('data-action="editItem"');
    expect(template).toContain('data-action="deleteItem"');
    expect(css).toContain("body.system-d6-system-2e .od6v2-inventory-row");
  });

  it("shows quantity and supports owner equipment toggles directly in inventory", () => {
    expect(template).toContain("{{#if item.quantity}}");
    expect(template).toContain("×{{item.quantity}}");
    expect(template).toContain("{{#if item.equippable}}");
    expect(template).toContain('data-action="toggleEquipped"');
    expect(template).toContain("{{checked item.equipped}}");
    expect(template).toContain("{{disabled (not @root.editable)}}");
    expect(sheet).toContain("const equippableItemTypes = new Set");
    expect(sheet).toContain("quantity: Math.max(0");
    expect(sheet).toContain("toggleEquipped: this.#toggleEquipped");
  });

  it("shows era classifications and preserves visible mismatch guidance", () => {
    expect(template).toContain("item.equipmentEraLabel");
    expect(template).toContain("item.equipmentEraClass");
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
    expect(template).toContain('draggable="{{@root.editable}}"');
    expect(attributesTemplate).toContain('draggable="{{@root.editable}}"');
    expect(css).toContain(".od6s-character-v2.is-item-drop-target");
  });
});
