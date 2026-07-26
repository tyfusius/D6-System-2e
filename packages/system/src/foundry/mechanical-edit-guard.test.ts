import { describe, expect, it } from "vitest";
import {
  changesAttributeScore,
  changesSkillScore,
  mayDirectEditMechanicalScore,
} from "./mechanical-edit-guard";

describe("mechanical score edit guards", () => {
  it("recognizes flattened and nested attribute score changes", () => {
    expect(
      changesAttributeScore({ "system.attributes.agility.score": 10 }),
    ).toBe(true);
    expect(
      changesAttributeScore({
        system: { attributes: { agility: { score: 10 } } },
      }),
    ).toBe(true);
    expect(
      changesAttributeScore({
        system: { attributes: { agility: { label: "Agility" } } },
      }),
    ).toBe(false);
  });

  it("recognizes flattened and nested skill score changes", () => {
    expect(changesSkillScore({ "system.score": 4 })).toBe(true);
    expect(changesSkillScore({ system: { score: 4 } })).toBe(true);
    expect(changesSkillScore({ system: { description: "safe" } })).toBe(false);
  });

  it("allows direct mechanical edits only to a GM in Free Edit", () => {
    expect(mayDirectEditMechanicalScore("freeedit", true)).toBe(true);
    expect(mayDirectEditMechanicalScore("normal", true)).toBe(false);
    expect(mayDirectEditMechanicalScore("advance", true)).toBe(false);
    expect(mayDirectEditMechanicalScore("freeedit", false)).toBe(false);
  });
});
