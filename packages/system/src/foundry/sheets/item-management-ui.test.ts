import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("OpenD6 Next item-management parity", () => {
  const template = read("../../../../../templates/item/item-sheet.hbs");
  const sheet = read("./item-sheet.ts");

  it("provides accessible Details, Description, and Effects workspaces", () => {
    expect(template.match(/data-action="setItemTab"/gu)).toHaveLength(3);
    expect(template).toContain('data-item-tab="details"');
    expect(template).toContain('data-item-tab="description"');
    expect(template).toContain('data-item-tab="effects"');
    expect(template).toContain('role="tab"');
    expect(sheet).toContain("setItemTab: this.#setItemTab");
  });

  it("registers native Active Effect create, inspect, and delete actions", () => {
    expect(template).toContain('data-action="createEffect"');
    expect(template).toContain('data-action="editEffect"');
    expect(template).toContain('data-action="deleteEffect"');
    expect(sheet).toContain("createEffect: this.#createEffect");
    expect(sheet).toContain("editEffect: this.#editEffect");
    expect(sheet).toContain("deleteEffect: this.#deleteEffect");
    expect(sheet).toContain('createEmbeddedDocuments("ActiveEffect"');
    expect(sheet).toContain('deleteEmbeddedDocuments("ActiveEffect"');
  });

  it("keeps effect mutation behind the GM Free Edit boundary", () => {
    expect(sheet).toContain("if (game.user?.isGM !== true) return false");
    expect(sheet).toContain(
      'record(parent.system.sheetMode).value === "freeedit"',
    );
    expect(sheet).toContain("if (!this.#mayManageEffects()) return");
    expect(template).toContain("{{#if mayManageEffects}}");
    expect(template).toContain("{{#if @root.mayManageEffects}}");
    expect(template).toContain('class="od6item-effect-summary"');
  });

  it("lets owners edit narrative descriptions without unlocking mechanics", () => {
    expect(template).toContain("{{disabled (not descriptionEditable)}}");
    expect(template).toContain("{{#if descriptionEditable}}");
    expect(sheet).toContain("descriptionEditable: this.isEditable");
    expect(sheet).toContain('_form.elements.namedItem("system.description")');
    expect(sheet).toContain("descriptionField.value");
    expect(sheet).toContain("if (!directEdit)");
    expect(sheet).toContain(
      "Object.assign(changes, descriptionChanges(submittedDescription))",
    );
    expect(template).toContain('data-action="saveDescription"');
    expect(sheet).toContain("saveDescription: this.#saveDescription");
    expect(sheet).toContain('value.length === 0 ? " " : value');
    expect(sheet).toContain("descriptionChanges(description.value)");
    expect(sheet).toContain("delete changes.img");
  });

  it("offers an explicit submit action for directly editable item details", () => {
    expect(template).toContain("{{#if directEdit}}");
    expect(template).toContain('<button type="submit">');
  });

  it("presents campaign era and restricts provenance changes to the GM", () => {
    expect(template).toContain("campaignEquipmentEraLabel");
    expect(template).toContain('name="system.equipmentProvenance.era"');
    expect(template).toContain("{{disabled (not provenanceEditable)}}");
    expect(template).toContain("D6E2.Equipment.Catalog.Provenance");
    expect(sheet).toContain(
      "provenanceEditable: directEdit && game.user?.isGM === true",
    );
  });
});
