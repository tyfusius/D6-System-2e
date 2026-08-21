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
const englishLocalization = JSON.parse(
  readFileSync(new URL("../../../../lang/en.json", import.meta.url), "utf8"),
) as Record<string, string>;
const attributesTemplate = readFileSync(
  new URL(
    "../../../../templates/actor/character/attributes.hbs",
    import.meta.url,
  ),
  "utf8",
);
const traitsTemplate = readFileSync(
  new URL("../../../../templates/actor/character/traits.hbs", import.meta.url),
  "utf8",
);
const systemStyles = readFileSync(
  new URL("../../../../styles/d6-system-2e.css", import.meta.url),
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
    expect(itemSheet).toContain('type="checkbox"');
    expect(itemSheet).toContain("prerequisiteSkillChoices");
    expect(itemSheet).toContain("D6E2.Item.ConnectedSkillsMinimum");
    expect(itemSheet).not.toContain("multiple");
    expect(itemSheet).not.toContain('placeholder="medicine, sciences"');
  });

  it("binds the Specialization parent selector to its resolved link kind", () => {
    expect(itemSheet).toContain('name="{{parentSkillFieldName}}"');
    expect(itemSheet).toContain("selected=selectedParentSkill");
    expect(itemSheet).toContain("D6E2.Item.ParentSkillRequired");
  });

  it("prompts for real names before either creation service runs", () => {
    expect(characterSheetSource).toContain(
      "D6E2.Creation.SpecializationNameHelp",
    );
    expect(characterSheetSource).toContain(
      "promptAdvancedSkillDefinition(this.actor)",
    );
    expect(characterSheetSource).toContain(
      "createCreationSpecialization(\n        this.actor,\n        itemId,\n        name,",
    );
    expect(characterSheetSource).toContain("definition.prerequisiteSkillKeys");
  });

  it("adds a Free Edit blue-plus menu to standard Skill rows", () => {
    expect(englishLocalization["D6E2.Creation.Specialization"]).toBe(
      "Specialization",
    );
    expect(attributesTemplate).toContain('data-action="createSkillChild"');
    expect(attributesTemplate).toMatch(
      /data-action="createSkillChild"[\s\S]{0,300}fa-plus/u,
    );
    expect(characterSheetSource).toContain("promptSkillChildKind(parent.name)");
    expect(characterSheetSource).toContain(
      "promptAdvancedSkillDefinition(\n          this.actor,\n          stringValue(parent.system.key),",
    );
    expect(characterSheetSource).toContain("createFreeEditSpecialization(");
    expect(characterSheetSource).toContain("createFreeEditAdvancedSkill(");
  });

  it("exposes explicit Specialization exchange and Advanced Skill identity", () => {
    expect(attributesTemplate).toContain(
      'data-action="setCreationSpecializationAllocation"',
    );
    expect(attributesTemplate).toContain("3(s)");
    expect(attributesTemplate).toContain(
      'data-action="createCreationAdvancedSkill"',
    );
    expect(attributesTemplate).toContain('class="od6v2-skill-kind"');
    expect(attributesTemplate).not.toMatch(
      /class="od6v2-skill-kind"[\s\S]{0,100}title=/u,
    );
    expect(attributesTemplate).toContain(
      'aria-label="{{documentLabels.specialization}}"',
    );
    expect(attributesTemplate).toContain(
      'aria-label="{{documentLabels.advancedSkill}}"',
    );
    expect(attributesTemplate).toContain("(a)");
    expect(attributesTemplate).toContain("(s)");
    expect(attributesTemplate).toContain(
      'data-action="rollLinkedAdvancedSkill"',
    );
    expect(attributesTemplate).toContain('data-tooltip="{{advanced.tooltip}}"');
    expect(attributesTemplate).toContain("skill.linkedAdvancedSkills");
    expect(attributesTemplate).toContain("advanced.canAdvance");
    expect(attributesTemplate).toContain("advanced.advanceCost");
    expect(attributesTemplate).toContain("advanced.advanceHelp");
    expect(attributesTemplate).toContain("is-linked-advanced");
    expect(attributesTemplate).toContain(
      "aria-label=\"{{localize\n                              'D6E2.PipScore'\n                            }} · {{advanced.name}}\"",
    );
    expect(attributesTemplate).toContain('data-action="rollSkill"');
    expect(attributesTemplate).toContain(
      "{{disabled (not skill.canIncreaseCreation)}}",
    );
    expect(attributesTemplate).toContain(
      "{{disabled (not attribute.canIncreaseCreation)}}",
    );
    expect(systemStyles).toMatch(
      /\.od6v2-item-row\.is-specialization[\s\S]*?\.od6v2-item-roll\s*>\s*span\s*\{\s*display:\s*block;/,
    );
    expect(systemStyles).toMatch(
      /\.od6v2-item-row\.is-specialization[\s\S]*?\.od6v2-item-roll\s+small\s*\{\s*display:\s*block;/,
    );
  });

  it("renders every linked Specialization directly under its parent Skill", () => {
    const nestedSpecializations = attributesTemplate.indexOf(
      "{{#each skill.specializations as |specialization|}}",
    );
    const linkedAdvancedSkills = attributesTemplate.indexOf(
      "{{#each skill.linkedAdvancedSkills as |advanced|}}",
    );
    expect(nestedSpecializations).toBeGreaterThan(-1);
    expect(linkedAdvancedSkills).toBeGreaterThan(nestedSpecializations);
    expect(attributesTemplate).toContain('data-parent-skill-id="{{skill.id}}"');
    expect(characterSheetSource).toContain(
      "groupCharacterSkillViews(skillViews)",
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

  it("offers confirmed deletion for GM Free Edit Skill rows", () => {
    expect(attributesTemplate).toContain('data-action="deleteItem"');
    expect(attributesTemplate).toContain("is-danger");
    expect(characterSheetSource).toContain("static readonly #deleteItem");
    expect(characterSheetSource).toContain(
      '.deleteEmbeddedDocuments("Item", [item.id])',
    );
    expect(characterSheetSource).toContain("deleteItem: this.#deleteItem");
  });

  it("offers the same confirmed deletion for embedded Items in GM Free Edit", () => {
    expect(traitsTemplate).toContain("{{#if @root.freeEdit}}");
    expect(traitsTemplate).toContain('data-action="deleteItem"');
    expect(traitsTemplate).toContain("is-danger");
    expect(characterSheetSource).not.toContain(
      '!["skill", "specialization"].includes(item.type)',
    );
  });
});
