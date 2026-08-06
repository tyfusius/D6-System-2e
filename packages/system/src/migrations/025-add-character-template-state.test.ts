import { describe, expect, it } from "vitest";
import { addCharacterTemplateState } from "./025-add-character-template-state";

describe("schema 25 character template state", () => {
  it("adds an inactive loss-preserving state to characters", () => {
    const source = {
      items: [],
      system: { creation: { active: true } },
      type: "character",
    };
    addCharacterTemplateState(source);
    expect(source.system.creation).toEqual({
      active: true,
      template: {
        applied: false,
        catalogId: "",
        label: "",
        ownerId: "",
        sourceBook: "",
        sourcePage: 0,
        suggestedSkillKeys: [],
        templateId: "",
        version: 0,
      },
    });
  });

  it("preserves canonical state when migration repeats and ignores machines", () => {
    const state = {
      applied: true,
      catalogId: "licensed.templates",
      label: "Licensed template",
      ownerId: "licensed-module",
      sourceBook: "Licensed source",
      sourcePage: 12,
      suggestedSkillKeys: ["athletics", "athletics", "stamina"],
      rulesFamily: "superheroic",
      superpowerCreationDice: 10,
      superpowerDefinitionIds: ["licensed.flight"],
      templateId: "licensed-template",
      version: 1,
    };
    const character = {
      items: [],
      system: { creation: { template: state } },
      type: "character",
    };
    addCharacterTemplateState(character);
    expect(character.system.creation.template).toEqual({
      ...state,
      suggestedSkillKeys: ["athletics", "stamina"],
    });
    const machine = { items: [], system: { creation: {} }, type: "vehicle" };
    addCharacterTemplateState(machine);
    expect(machine.system.creation).toEqual({});
  });
});
