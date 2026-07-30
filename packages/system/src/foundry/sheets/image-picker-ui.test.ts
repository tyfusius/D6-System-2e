import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("editable sheet artwork", () => {
  it.each([
    ["character", "../../../../../templates/actor/character/header.hbs"],
    ["machine", "../../../../../templates/actor/machine/header.hbs"],
    ["item", "../../../../../templates/item/item-sheet.hbs"],
  ])(
    "%s artwork exposes the native image action and Edit overlay",
    (_, path) => {
      const template = read(path);

      expect(template).toContain('data-action="editImage"');
      expect(template).toContain('data-edit="img"');
      expect(template).toContain('class="od6-artwork-edit"');
      expect(template).toContain('localize "D6E2.Edit"');
    },
  );

  it.each(["character-sheet.ts", "machine-sheet.ts", "item-sheet.ts"])(
    "%s registers the image-picker action",
    (filename) => {
      const source = read(`./${filename}`);
      const actionStart = source.indexOf("static readonly #editImage");
      const actionEnd = source.indexOf("\n  };", actionStart);
      const actionBody = source.slice(actionStart, actionEnd);

      expect(source).toContain("editImage: this.#editImage");
      expect(source).toContain("openDocumentImagePicker");
      expect(actionBody).not.toContain("this.isEditable");
    },
  );

  it("keeps item artwork editable for owning users outside mechanical edit mode", () => {
    const source = read("./item-sheet.ts");

    expect(source).toContain(
      "game.user?.isGM === true || this.item.parent?.isOwner === true",
    );
  });
});
