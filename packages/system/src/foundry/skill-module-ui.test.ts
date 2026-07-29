import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const itemSheet = readFileSync(
  new URL("../../../../templates/item/item-sheet.hbs", import.meta.url),
  "utf8",
);
const characterSheetSource = readFileSync(
  new URL("./sheets/character-sheet.ts", import.meta.url),
  "utf8",
);

describe("Specialization and Advanced Skill UI contract", () => {
  it("uses an explicit required name field for both focused Item types", () => {
    expect(itemSheet).toContain("hasDedicatedNameField");
    expect(itemSheet).toContain("<span>{{itemNameLabel}}</span>");
    expect(itemSheet).toContain('name="name"');
    expect(itemSheet).toContain("required");
    expect(itemSheet).toContain("D6E2.Item.SpecializationNameHelp");
    expect(itemSheet).toContain("D6E2.Item.AdvancedSkillNameHelp");
  });

  it("selects named prerequisite Skills instead of editing raw keys", () => {
    expect(itemSheet).toContain('name="prerequisiteSkillKeys"');
    expect(itemSheet).toContain('name="prerequisiteSkillKeysPresent"');
    expect(itemSheet).toContain("multiple");
    expect(itemSheet).toContain("prerequisiteSkillOptions");
    expect(itemSheet).not.toContain('placeholder="medicine, sciences"');
  });

  it("prompts for real names before either creation service runs", () => {
    expect(characterSheetSource).toContain(
      "D6E2.Creation.SpecializationNameHelp",
    );
    expect(characterSheetSource).toContain(
      "D6E2.Creation.AdvancedSkillNameHelp",
    );
    expect(characterSheetSource).toContain(
      "createCreationSpecialization(\n        this.actor,\n        itemId,\n        name,",
    );
    expect(characterSheetSource).toContain(
      "createCreationAdvancedSkill(this.actor, name)",
    );
  });

  it("collects a standard Skill name before persisting the Item", () => {
    const createItemSource = characterSheetSource.slice(
      characterSheetSource.indexOf("static readonly #createItem"),
      characterSheetSource.indexOf("static readonly #editItem"),
    );
    expect(createItemSource).toContain("D6E2.Skill.NameHelp");
    expect(createItemSource.indexOf("await promptSkillName")).toBeGreaterThan(
      -1,
    );
    expect(
      createItemSource.indexOf('createEmbeddedDocuments("Item"'),
    ).toBeGreaterThan(createItemSource.indexOf("await promptSkillName"));
  });

  it("offers confirmed deletion for editable Skill rows", () => {
    const attributesTemplate = readFileSync(
      new URL(
        "../../../../templates/actor/character/attributes.hbs",
        import.meta.url,
      ),
      "utf8",
    );
    expect(attributesTemplate).toContain('data-action="deleteItem"');
    expect(attributesTemplate).toContain("is-danger");
    expect(characterSheetSource).toContain("static readonly #deleteItem");
    expect(characterSheetSource).toContain(
      '.deleteEmbeddedDocuments("Item", [item.id])',
    );
    expect(characterSheetSource).toContain("deleteItem: this.#deleteItem");
  });
});
