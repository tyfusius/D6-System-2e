import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function repositoryFile(relative: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../../../${relative}`, import.meta.url)),
    "utf8",
  );
}

describe("character template UI contract", () => {
  it("exposes preview-before-apply from the creation workspace", () => {
    const attributes = repositoryFile(
      "templates/actor/character/attributes.hbs",
    );
    const dialog = repositoryFile(
      "templates/actor/character/template-dialog.hbs",
    );
    const sheet = repositoryFile(
      "packages/system/src/foundry/sheets/character-sheet.ts",
    );
    expect(attributes).toContain('data-action="applyCharacterTemplate"');
    expect(attributes).toContain("characterTemplate.applied");
    expect(dialog).toContain('name="characterTemplateId"');
    expect(dialog).toContain("template.attributeChanges");
    expect(dialog).toContain("template.suggestedSkills");
    expect(dialog).toContain("template.itemAdditions");
    expect(dialog).toContain("template.issueLabels");
    expect(sheet).toContain("api.characterTemplates.preview");
    expect(sheet).toContain("api.characterTemplates.apply");
  });
});
