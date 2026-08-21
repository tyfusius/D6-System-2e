import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("Character advancement sheet UI", () => {
  const sheet = read("./character-sheet.ts");
  const service = read("../advancement-service.ts");
  const attributes = read(
    "../../../../../templates/actor/character/attributes.hbs",
  );
  const controls = read(
    "../../../../../templates/actor/character/controls.hbs",
  );

  it("rerenders after the persisted mode transition exposes Advance controls", () => {
    expect(sheet).toContain("this.#persistence.enqueueModeTransition(");
    expect(sheet).not.toContain("() => Promise.resolve(this.render(true))");
    expect(sheet).toContain('sheetMode === "advance"');
    expect(sheet).toContain("showDirectAdvancementControls:");
    expect(attributes).toContain("{{#if @root.showDirectAdvancementControls}}");
    expect(attributes).toContain('data-action="advanceAttribute"');
    expect(attributes).toContain('data-action="advanceItem"');
    expect(controls).toContain('name="system.sheetMode.value"');
    expect(sheet).toContain('if (event.type === "change")');
    expect(sheet).toContain('input.name === "system.sheetMode.value"');
    expect(sheet).toContain("this.#persistModeSelection(input)");
    expect(sheet).toContain("submitOnChange: true");
    expect(sheet).toContain("closeOnSubmit: false");
  });

  it("keeps direct resource editing GM-only while player spending uses actions", () => {
    expect(sheet).toContain(
      "const canDirectEditResources = isGM && this.isEditable",
    );
    expect(service).toContain("requireAuthorizedAdvance(actor)");
    expect(attributes).not.toContain("system.resources.experiencePoints.value");
  });
});
