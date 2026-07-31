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
        secondEditionPipsModule: false,
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
        secondEditionPipsModule: false,
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
      secondEditionPipsModule: false,
    });

    expect(capabilities.advancedSkills).toMatchObject({
      state: "active",
      strategy: "second-edition-contextual-extension",
    });
    expect(capabilities.actionEconomy).toMatchObject({
      owner: "open-d6",
      state: "active",
      strategy: "open-d6-flexible-action-allotment",
    });
    expect(capabilities.movement).toMatchObject({
      owner: "open-d6",
      state: "active",
      strategy: "open-d6-relative-movement",
    });
    expect(capabilities.defenses).toMatchObject({
      owner: "open-d6",
      state: "active",
      strategy: "active-defense-scheduler",
    });
    expect(capabilities.advancement).toMatchObject({
      owner: "open-d6",
      state: "active",
    });
    expect(capabilities.damage.state).toBe("planned");
    expect(capabilities.initiative).toMatchObject({
      owner: "open-d6",
      state: "active",
      strategy: "open-d6-perception-roll",
    });
  });

  it("keeps action economy, movement, and active defenses independent", () => {
    const profile = resolveRulesProfile({
      ...SECOND_EDITION_COMPATIBILITY,
      firstEditionActionEconomy: true,
    });
    const capabilities = resolveEditionCapabilityProfile(profile, {
      allowSecondEditionAdvancedSkillsInOpenD6: false,
      secondEditionAdvancedSkillsModule: false,
      secondEditionPipsModule: false,
    });

    expect(capabilities.actionEconomy.strategy).toBe(
      "open-d6-flexible-action-allotment",
    );
    expect(capabilities.movement.strategy).toBe(
      "second-edition-segment-movement",
    );
    expect(capabilities.defenses.strategy).toBe("static-defenses");
  });

  it("resolves mixed profiles capability by capability", () => {
    const profile = resolveRulesProfile({
      ...SECOND_EDITION_COMPATIBILITY,
      firstEditionSuccessEvaluator: true,
    });
    const capabilities = resolveEditionCapabilityProfile(profile, {
      allowSecondEditionAdvancedSkillsInOpenD6: false,
      secondEditionAdvancedSkillsModule: true,
      secondEditionPipsModule: true,
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
    expect(capabilities.pips.strategy).toBe("second-edition-pips-module");
    expect(capabilities.retries.strategy).toBe("second-edition-doubling-down");
    expect(capabilities.initiative.strategy).toBe(
      "second-edition-contextual-initiative",
    );
  });

  it("keeps OpenD6 pips independent from the Second Edition module", () => {
    const capabilities = resolveEditionCapabilityProfile(
      resolveRulesProfile(compatibilityPreset("open-d6")),
      {
        allowSecondEditionAdvancedSkillsInOpenD6: false,
        secondEditionAdvancedSkillsModule: false,
        secondEditionPipsModule: false,
      },
    );
    expect(capabilities.pips).toMatchObject({
      owner: "open-d6",
      state: "active",
      strategy: "open-d6-classic-pips",
    });
    expect(capabilities.retries).toMatchObject({
      owner: "open-d6",
      state: "active",
      strategy: "open-d6-no-general-double-down",
    });
  });

  it("activates native feature modules without conflating OpenD6 families", () => {
    const secondEdition = resolveEditionCapabilityProfile(
      resolveRulesProfile(SECOND_EDITION_COMPATIBILITY),
      {
        allowSecondEditionAdvancedSkillsInOpenD6: false,
        secondEditionAdvancedSkillsModule: false,
        secondEditionPerksFlawsTalentsModule: true,
        secondEditionPipsModule: false,
        secondEditionTroublesAssetsModule: true,
      },
    );
    const openD6 = resolveEditionCapabilityProfile(
      resolveRulesProfile(compatibilityPreset("open-d6")),
      {
        allowSecondEditionAdvancedSkillsInOpenD6: false,
        secondEditionAdvancedSkillsModule: false,
        secondEditionPerksFlawsTalentsModule: true,
        secondEditionPipsModule: false,
        secondEditionTroublesAssetsModule: true,
      },
    );

    expect(secondEdition.rankedFeatures.state).toBe("active");
    expect(secondEdition.narrativeFeatures.state).toBe("active");
    expect(openD6.rankedFeatures.state).toBe("inactive-preserved");
    expect(openD6.narrativeFeatures.state).toBe("inactive-preserved");
  });

  it("activates every implemented Second Edition advancement strategy", () => {
    const profile = resolveRulesProfile(SECOND_EDITION_COMPATIBILITY);
    const experience = resolveEditionCapabilityProfile(profile, {
      allowSecondEditionAdvancedSkillsInOpenD6: false,
      secondEditionAdvancedSkillsModule: true,
      secondEditionAdvancementStrategy: "experience-points",
      secondEditionPipsModule: false,
    });
    const milestone = resolveEditionCapabilityProfile(profile, {
      allowSecondEditionAdvancedSkillsInOpenD6: false,
      secondEditionAdvancedSkillsModule: true,
      secondEditionAdvancementStrategy: "milestone",
      secondEditionPipsModule: false,
    });

    expect(experience.advancement).toMatchObject({
      state: "active",
      strategy: "second-edition-experience-points",
    });
    expect(milestone.advancement).toMatchObject({
      state: "active",
      strategy: "second-edition-milestone",
    });
    const narrative = resolveEditionCapabilityProfile(profile, {
      allowSecondEditionAdvancedSkillsInOpenD6: false,
      secondEditionAdvancedSkillsModule: true,
      secondEditionAdvancementStrategy: "narrative",
      secondEditionPipsModule: false,
    });
    expect(narrative.advancement).toMatchObject({
      state: "active",
      strategy: "second-edition-narrative",
    });
  });
});
