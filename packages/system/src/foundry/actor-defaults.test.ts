import { describe, expect, it } from "vitest";
import {
  expandedSourcePaths,
  explicitSystemSourcePaths,
  isCompendiumImport,
  newCharacterCreationDefaults,
  newCharacterResourceDefaults,
} from "./actor-defaults";

describe("explicit Actor system source preservation", () => {
  it("treats only a populated compendium UUID as an import", () => {
    expect(isCompendiumImport(null)).toBe(false);
    expect(isCompendiumImport("")).toBe(false);
    expect(isCompendiumImport("Compendium.module.pack.Actor.id")).toBe(true);
  });

  it("reapplies only caller-provided leaves after creation defaults", () => {
    expect(
      explicitSystemSourcePaths({
        bestiary: { applied: true, sourceBook: "Licensed source" },
        resources: { magicPoints: { initialized: true, value: 10 } },
        scale: 3,
      }),
    ).toEqual({
      "system.bestiary.applied": true,
      "system.bestiary.sourceBook": "Licensed source",
      "system.resources.magicPoints.initialized": true,
      "system.resources.magicPoints.value": 10,
      "system.scale": 3,
    });
  });

  it("expands dotted creation paths before Foundry source updates", () => {
    expect(
      expandedSourcePaths({
        "system.bestiary.sourceBook": "Licensed source",
        "system.resources.heroPoints.value": 2,
        "system.scale": 3,
      }),
    ).toEqual({
      system: {
        bestiary: { sourceBook: "Licensed source" },
        resources: { heroPoints: { value: 2 } },
        scale: 3,
      },
    });
  });
});

describe("new character resource defaults", () => {
  const heroic = {
    heroPointStrategy: "heroic" as const,
    primaryResource: "heroPoints" as const,
  };
  const classic = {
    heroPointStrategy: "classic" as const,
    primaryResource: "experiencePoints" as const,
  };
  const openD6 = {
    heroPointStrategy: null,
    primaryResource: "characterPoints" as const,
  };

  it("uses the Second Edition Hero Point setting", () => {
    expect(newCharacterResourceDefaults(heroic, () => 3)).toEqual({
      "system.resources.heroPoints.value": 3,
    });
  });

  it("starts superheroic characters with the printed three Hero Points", () => {
    expect(newCharacterResourceDefaults(heroic, () => 1, true)).toEqual({
      "system.resources.heroPoints.value": 3,
    });
  });

  it("uses First Edition Character and Fate Point settings", () => {
    expect(
      newCharacterResourceDefaults(openD6, (key) =>
        key.includes("Character") ? 9 : 2,
      ),
    ).toEqual({
      "system.resources.characterPoints.value": 9,
      "system.resources.fatePoints.value": 2,
    });
  });

  it("starts Classic characters with one shared zero Experience Point balance", () => {
    expect(newCharacterResourceDefaults(classic, () => 5)).toEqual({
      "system.resources.experiencePoints.value": 0,
    });
  });

  it("clamps configured resources to non-negative integers", () => {
    expect(newCharacterResourceDefaults(heroic, () => -2.5)).toEqual({
      "system.resources.heroPoints.value": 0,
    });
  });
});

describe("new character creation defaults", () => {
  it("starts a new native Second Edition character in creation", () => {
    expect(newCharacterCreationDefaults("character", false)).toEqual({
      "system.creation.active": true,
      "system.creation.specializationSlots": 0,
    });
  });

  it("starts a new native OpenD6 character in creation", () => {
    expect(newCharacterCreationDefaults("character", false)).toEqual({
      "system.creation.active": true,
      "system.creation.specializationSlots": 0,
    });
  });

  it("does not activate creation for imports or NPCs", () => {
    expect(newCharacterCreationDefaults("character", true)).toEqual({});
    expect(newCharacterCreationDefaults("npc", false)).toEqual({});
  });
});
