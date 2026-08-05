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
    expect(dialog).toContain("template.superpowerAdditions");
    expect(dialog).toContain("template.superpowerCreationDice");
    expect(dialog).toContain("template.issueLabels");
    expect(sheet).toContain("api.characterTemplates.preview");
    expect(sheet).toContain("api.characterTemplates.apply");
  });

  it("exposes complete world-template authoring without generic trait fields", () => {
    const attributes = repositoryFile(
      "templates/actor/character/attributes.hbs",
    );
    const itemTemplate = repositoryFile("templates/item/item-sheet.hbs");
    const itemSheet = repositoryFile(
      "packages/system/src/foundry/sheets/item-sheet.ts",
    );
    const registration = repositoryFile(
      "packages/system/src/foundry/data-models/register.ts",
    );

    expect(attributes).toContain('data-action="createCharacterTemplate"');
    expect(attributes).toContain('class="d6e2-creation-template-actions"');
    expect(itemTemplate).toContain("D6E2.Template.AuthoringTitle");
    expect(itemTemplate).toContain("characterTemplateAttributes");
    expect(itemTemplate).toContain("characterTemplateItems");
    expect(itemTemplate).toContain("D6E2.Template.DropItems");
    expect(itemSheet).toContain("#addDroppedCharacterTemplateItem");
    expect(registration).toContain("CharacterTemplateDataModel");
    expect(registration).toContain(
      'dataModels["character-template"] = CharacterTemplateDataModel',
    );
  });
});
