import { describe, expect, it } from "vitest";
import { resolveEditionCapabilityProfile } from "./edition-capabilities";
import {
  compatibilityPreset,
  resolveRulesProfile,
  SECOND_EDITION_COMPATIBILITY,
} from "./rules-profile";

describe("cross-edition capability profile", () => {
  it("activates native Second Edition Advanced Skills only with its module", () => {
    const profile = resolveRulesProfile(SECOND_EDITION_COMPATIBILITY);
    expect(
      resolveEditionCapabilityProfile(profile, {
        allowSecondEditionAdvancedSkillsInOpenD6: false,
        secondEditionAdvancedSkillsModule: true,
      }).advancedSkills,
    ).toMatchObject({
      owner: "second-edition",
      state: "active",
      strategy: "second-edition-contextual",
    });
  });

  it("preserves Second Edition Advanced Skills inactive in OpenD6 by default", () => {
    const profile = resolveRulesProfile(compatibilityPreset("open-d6"));
    expect(
      resolveEditionCapabilityProfile(profile, {
        allowSecondEditionAdvancedSkillsInOpenD6: false,
        secondEditionAdvancedSkillsModule: true,
      }).advancedSkills,
    ).toMatchObject({
      state: "inactive-preserved",
      strategy: "stored-inactive",
    });
  });

  it("allows the explicit Second Edition Advanced Skill extension in OpenD6", () => {
    const profile = resolveRulesProfile(compatibilityPreset("open-d6"));
    const capabilities = resolveEditionCapabilityProfile(profile, {
      allowSecondEditionAdvancedSkillsInOpenD6: true,
      secondEditionAdvancedSkillsModule: true,
    });

    expect(capabilities.advancedSkills).toMatchObject({
      state: "active",
      strategy: "second-edition-contextual-extension",
    });
    expect(capabilities.actionEconomy).toMatchObject({
      owner: "open-d6",
      state: "planned",
      strategy: "open-d6-flexible-action-allotment",
    });
    expect(capabilities.advancement).toMatchObject({
      owner: "open-d6",
      state: "active",
    });
    expect(capabilities.damage.state).toBe("planned");
  });

  it("resolves mixed profiles capability by capability", () => {
    const profile = resolveRulesProfile({
      ...SECOND_EDITION_COMPATIBILITY,
      firstEditionSuccessEvaluator: true,
    });
    const capabilities = resolveEditionCapabilityProfile(profile, {
      allowSecondEditionAdvancedSkillsInOpenD6: false,
      secondEditionAdvancedSkillsModule: true,
    });

    expect(capabilities.rulesProfileId).toBe("custom");
    expect(capabilities.successEvaluator.strategy).toBe("meets-or-exceeds");
    expect(capabilities.wildDie.strategy).toBe(
      "second-edition-advantage-complication",
    );
    expect(capabilities.advancedSkills.state).toBe("active");
    expect(capabilities.actionEconomy.strategy).toBe(
      "second-edition-action-segments",
    );
  });
});
