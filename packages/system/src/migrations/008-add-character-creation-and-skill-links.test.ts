import { describe, expect, it } from "vitest";
import {
  addCharacterCreationState,
  addSkillRelationshipFields,
} from "./008-add-character-creation-and-skill-links";

describe("schema 8 character creation and skill links", () => {
  it("keeps existing actors out of creation and is idempotent", () => {
    const source = {
      items: [],
      system: {},
      type: "character",
    };
    addCharacterCreationState(source);
    addCharacterCreationState(source);
    expect(source.system).toEqual({ creation: { active: false } });
  });

  it("adds relationship fields without replacing known data", () => {
    const skill = {
      system: {},
      type: "skill",
    };
    const specialization = {
      system: { source: { book: "Private source", page: 99 } },
      type: "specialization",
    };
    addSkillRelationshipFields(skill);
    addSkillRelationshipFields(specialization);
    expect(skill.system).toEqual({ prerequisiteSkillKeys: [] });
    expect(specialization.system.source).toEqual({
      book: "Private source",
      page: 99,
    });
  });
});
