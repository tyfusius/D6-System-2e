import { compatibilityPreset, resolveRulesProfile } from "@d6-system-2e/core";
import { describe, expect, it } from "vitest";
import {
  expandedSourcePaths,
  explicitSystemSourcePaths,
  newCharacterCreationDefaults,
  newCharacterResourceDefaults,
} from "./actor-defaults";

describe("explicit Actor system source preservation", () => {
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
  it("uses the Second Edition Hero Point setting", () => {
    expect(
      newCharacterResourceDefaults(
        resolveRulesProfile(compatibilityPreset("second-edition")),
        () => 3,
      ),
    ).toEqual({ "system.resources.heroPoints.value": 3 });
  });

  it("uses First Edition Character and Fate Point settings", () => {
    expect(
      newCharacterResourceDefaults(
        resolveRulesProfile(compatibilityPreset("open-d6")),
        (key) => (key.includes("Character") ? 9 : 2),
      ),
    ).toEqual({
      "system.resources.characterPoints.value": 9,
      "system.resources.fatePoints.value": 2,
    });
  });

  it("starts Classic characters with one shared zero Experience Point balance", () => {
    expect(
      newCharacterResourceDefaults(
        resolveRulesProfile(compatibilityPreset("second-edition")),
        () => 5,
        "classic",
      ),
    ).toEqual({ "system.resources.experiencePoints.value": 0 });
  });

  it("clamps configured resources to non-negative integers", () => {
    expect(
      newCharacterResourceDefaults(
        resolveRulesProfile(compatibilityPreset("second-edition")),
        () => -2.5,
      ),
    ).toEqual({ "system.resources.heroPoints.value": 0 });
  });
});

describe("new character creation defaults", () => {
  it("starts a new native Second Edition character in creation", () => {
    expect(
      newCharacterCreationDefaults(
        "character",
        resolveRulesProfile(compatibilityPreset("second-edition")),
        false,
      ),
    ).toEqual({
      "system.creation.active": true,
      "system.creation.specializationSlots": 0,
    });
  });

  it("does not activate creation for imports, NPCs, or OpenD6 profiles", () => {
    const secondEdition = resolveRulesProfile(
      compatibilityPreset("second-edition"),
    );
    const openD6 = resolveRulesProfile(compatibilityPreset("open-d6"));
    expect(
      newCharacterCreationDefaults("character", secondEdition, true),
    ).toEqual({});
    expect(newCharacterCreationDefaults("npc", secondEdition, false)).toEqual(
      {},
    );
    expect(newCharacterCreationDefaults("character", openD6, false)).toEqual(
      {},
    );
  });
});
