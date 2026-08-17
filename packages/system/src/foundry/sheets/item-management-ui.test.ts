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
    expect(sheet).toContain("tab.disabled = false");
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
    expect(sheet).toContain(
      "persistsEquipmentFieldsImmediately(this.item.type)",
    );
    expect(sheet).toContain("equipmentFieldRequiresRerender(input.name)");
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

  it("opens world and compendium Items whose parent is null", () => {
    expect(sheet).toContain("this.item.parent != null");
    expect(sheet).not.toContain("this.item.parent !== undefined");
  });

  it("exposes the Weapon ammunition state already stored by the data model", () => {
    expect(template).toContain('name="system.ammunition.current"');
    expect(template).toContain('name="system.ammunition.maximum"');
    expect(template).toContain("D6E2.Item.AmmunitionCurrent");
    expect(template).toContain("D6E2.Item.AmmunitionMaximum");
  });

  it("authors stable species and bundle contracts instead of name lookup", () => {
    expect(template).toContain("{{#if isTemplateContainer}}");
    expect(template).toContain('name="system.rulesFamily"');
    expect(template).toContain('name="system.members.{{@index}}.uuid"');
    expect(template).toContain(
      'name="system.attributeBounds.{{@index}}.minimum"',
    );
    expect(template).toContain('data-action="addTemplateMember"');
    expect(template).toContain('data-action="addSpeciesBound"');
    expect(sheet).toContain("addTemplateMember: this.#addTemplateMember");
    expect(sheet).toContain("addSpeciesBound: this.#addSpeciesBound");
  });
});
