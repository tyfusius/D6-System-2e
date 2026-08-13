import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string): string =>
  readFileSync(`${root}/${path}`, "utf8");

describe("focused field render protection", () => {
  it("uses the shared render guard on every system-owned document sheet", () => {
    for (const path of [
      "packages/system/src/foundry/sheets/character-sheet.ts",
      "packages/system/src/foundry/sheets/hideout-sheet.ts",
      "packages/system/src/foundry/sheets/item-sheet.ts",
      "packages/system/src/foundry/sheets/machine-sheet.ts",
    ]) {
      const implementation = source(path);
      expect(implementation).toContain("FocusedFieldRenderGuard");
      expect(implementation).toContain(
        "this.#focusedFieldRenderGuard.trackFocusIn",
      );
      expect(implementation).toContain(
        "this.#focusedFieldRenderGuard.trackFocusOut",
      );
      expect(implementation).toContain(
        "this.#focusedFieldRenderGuard.deferRenderWhileEditing()",
      );
    }
  });

  it("does not persist Character text fields on every keystroke", () => {
    const header = source("templates/actor/character/header.hbs");
    const biography = source("templates/actor/character/biography.hbs");
    const sheet = source(
      "packages/system/src/foundry/sheets/character-sheet.ts",
    );

    expect(header).not.toContain("data-persist-on-input");
    expect(biography).not.toContain("data-persist-on-input");
    expect(sheet).not.toContain("persistOnInput");
    expect(sheet).toContain(
      'htmlElement.addEventListener("change", this.#persistChange)',
    );
  });

  it("releases one deferred render only after focus leaves editable fields", () => {
    const guard = source(
      "packages/system/src/foundry/sheets/focused-field-render-guard.ts",
    );

    expect(guard).toContain("queueMicrotask");
    expect(guard).toContain("root.ownerDocument.activeElement");
    expect(guard).toContain("root.contains(active)");
    expect(guard).toContain("this.renderAfterEditing()");
  });
});
