import { describe, expect, it } from "vitest";
import {
  compatibilityPreset,
  resolveRulesProfile,
  SECOND_EDITION_COMPATIBILITY,
} from "./rules-profile";

describe("rules profiles", () => {
  it("resolves the native Second Edition profile", () => {
    expect(resolveRulesProfile(SECOND_EDITION_COMPATIBILITY).id).toBe(
      "second-edition",
    );
  });

  it("resolves the complete OpenD6 compatibility profile", () => {
    const compatibility = compatibilityPreset("open-d6");
    expect(Object.values(compatibility).every(Boolean)).toBe(true);
    expect(resolveRulesProfile(compatibility).id).toBe("open-d6");
  });

  it("reports a partially overridden preset as custom", () => {
    expect(
      resolveRulesProfile({
        ...compatibilityPreset("open-d6"),
        firstEditionDamage: false,
      }).id,
    ).toBe("custom");
  });
});
