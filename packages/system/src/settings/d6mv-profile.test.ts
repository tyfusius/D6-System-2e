import { describe, expect, it } from "vitest";
import {
  D6MV_ATTRIBUTES,
  D6MV_SETTING_SKILLS,
  D6MV_SKILL_DEFINITIONS,
  D6MV_STRATEGY_COMPOSITION,
  missingD6MvSkillSources,
  profileUsesD6MvRules,
} from "./d6mv-profile";

describe("D6MV profile vocabulary", () => {
  it("provides six source-ordered Attributes and six skills per Attribute", () => {
    expect(D6MV_ATTRIBUTES.map(({ label }) => label)).toEqual([
      "Dexterity",
      "Knowledge",
      "Mechanical",
      "Perception",
      "Strength",
      "Willpower",
    ]);
    expect(D6MV_SKILL_DEFINITIONS).toHaveLength(36);
    for (const { id } of D6MV_ATTRIBUTES) {
      expect(
        D6MV_SKILL_DEFINITIONS.filter(({ attributeId }) => attributeId === id),
      ).toHaveLength(6);
    }
    expect(
      D6MV_SETTING_SKILLS.every(({ description }) => description === ""),
    ).toBe(true);
  });

  it("detects the complete strategy composition rather than label or profile id", () => {
    const profile = {
      id: "renamed-world-copy",
      label: "D6MV",
      strategies: { ...D6MV_STRATEGY_COMPOSITION },
    };
    expect(profileUsesD6MvRules(profile)).toBe(true);
    expect(
      profileUsesD6MvRules({
        ...profile,
        strategies: {
          ...profile.strategies,
          wildDie: "open-d6.wild-die.critical-one",
        },
      }),
    ).toBe(false);
    expect(profileUsesD6MvRules({ id: "d6mv", label: "D6MV" })).toBe(false);
  });

  it("builds source-bearing missing skills without source descriptions", () => {
    const sources = missingD6MvSkillSources(new Set(["reflex", "instinct"]));
    expect(sources).toHaveLength(34);
    expect(
      sources.some((source) => {
        const system = source.system;
        return (
          typeof system === "object" &&
          system !== null &&
          "key" in system &&
          system.key === "reflex"
        );
      }),
    ).toBe(false);
    expect(sources[0]).toMatchObject({
      system: {
        description: "",
        source: {
          book: "D6 Magnetic Variant Core Reference",
          module: "d6mv",
          page: 31,
        },
      },
      type: "skill",
    });
  });
});
