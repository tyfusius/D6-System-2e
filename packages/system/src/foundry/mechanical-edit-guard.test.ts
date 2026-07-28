import { describe, expect, it } from "vitest";
import {
  changesAttributeScore,
  changesProtectedFirstEditionResource,
  changesProtectedSecondEditionAdvancementResource,
  changesSkillScore,
  mayDirectEditMechanicalScore,
  usesPersonalMechanicalEditGuard,
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

  it("recognizes protected First Edition resource changes", () => {
    expect(
      changesProtectedFirstEditionResource({
        "system.resources.characterPoints.value": 3,
      }),
    ).toBe(true);
    expect(
      changesProtectedFirstEditionResource({
        system: { resources: { fatePoints: { value: 2 } } },
      }),
    ).toBe(true);
    expect(
      changesProtectedFirstEditionResource({
        system: { resources: { heroPoints: { value: 2 } } },
      }),
    ).toBe(false);
  });

  it("recognizes flattened and nested Experience Point changes", () => {
    expect(
      changesProtectedSecondEditionAdvancementResource({
        "system.resources.experiencePoints.value": 6,
      }),
    ).toBe(true);
    expect(
      changesProtectedSecondEditionAdvancementResource({
        system: { resources: { experiencePoints: { value: 4 } } },
      }),
    ).toBe(true);
    expect(
      changesProtectedSecondEditionAdvancementResource({
        system: { resources: { heroPoints: { value: 2 } } },
      }),
    ).toBe(false);
  });

  it("allows direct mechanical edits only to a GM in Free Edit", () => {
    expect(mayDirectEditMechanicalScore("freeedit", true)).toBe(true);
    expect(mayDirectEditMechanicalScore("normal", true)).toBe(false);
    expect(mayDirectEditMechanicalScore("advance", true)).toBe(false);
    expect(mayDirectEditMechanicalScore("freeedit", false)).toBe(false);
  });

  it("does not apply character advancement locks to machine Actors", () => {
    expect(usesPersonalMechanicalEditGuard("character")).toBe(true);
    expect(usesPersonalMechanicalEditGuard("creature")).toBe(true);
    expect(usesPersonalMechanicalEditGuard("npc")).toBe(true);
    expect(usesPersonalMechanicalEditGuard("starship")).toBe(false);
    expect(usesPersonalMechanicalEditGuard("vehicle")).toBe(false);
  });
});
