import { compatibilityPreset, resolveRulesProfile } from "@d6-system-2e/core";
import { describe, expect, it } from "vitest";
import { newCharacterResourceDefaults } from "./actor-defaults";

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

  it("clamps configured resources to non-negative integers", () => {
    expect(
      newCharacterResourceDefaults(
        resolveRulesProfile(compatibilityPreset("second-edition")),
        () => -2.5,
      ),
    ).toEqual({ "system.resources.heroPoints.value": 0 });
  });
});
