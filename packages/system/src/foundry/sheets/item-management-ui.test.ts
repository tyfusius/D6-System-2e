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
    expect(template).toContain("{{#if mayManageEffects}}");
  });
});
