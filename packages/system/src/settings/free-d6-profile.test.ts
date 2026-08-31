import { describe, expect, it } from "vitest";
import {
  FREE_D6_ATTRIBUTE_IDS,
  FREE_D6_SETTING_SKILLS,
  FREE_D6_SKILL_DEFINITIONS,
  FREE_D6_SOURCE_BOOK,
  freeD6SkillDefinition,
  missingFreeD6SkillSources,
  profileUsesFreeD6AttributeVocabulary,
  skillSourcesForRulesProfile,
} from "./free-d6-profile";

describe("FreeD6 playable profile vocabulary", () => {
  it("publishes the seven source Attributes in their canonical order", () => {
    expect(FREE_D6_ATTRIBUTE_IDS).toEqual([
      "agility",
      "coordination",
      "strength",
      "knowledge",
      "perception",
      "charisma",
      "technical",
    ]);
    expect(Object.isFrozen(FREE_D6_ATTRIBUTE_IDS)).toBe(true);
  });

  it("ships the complete generic source table without copied rules prose", () => {
    expect(FREE_D6_SOURCE_BOOK).toBe("FreeD6 Player Book and GM Guide");
    expect(FREE_D6_SKILL_DEFINITIONS).toHaveLength(107);
    expect(new Set(FREE_D6_SKILL_DEFINITIONS.map(({ key }) => key)).size).toBe(
      FREE_D6_SKILL_DEFINITIONS.length,
    );
    expect(
      FREE_D6_SKILL_DEFINITIONS.every(
        ({ attributeId, key, name, sourcePage }) =>
          FREE_D6_ATTRIBUTE_IDS.includes(attributeId) &&
          /^[a-z][a-z0-9-]*$/u.test(key) &&
          name.length > 0 &&
          [16, 17].includes(sourcePage),
      ),
    ).toBe(true);
    expect(
      FREE_D6_SETTING_SKILLS.every(({ description }) => !description),
    ).toBe(true);
  });

  it("preserves source-owned Attribute roles and advanced-skill identity", () => {
    expect(freeD6SkillDefinition("firearms")).toMatchObject({
      attributeId: "coordination",
      sourcePage: 16,
      training: "standard",
    });
    expect(freeD6SkillDefinition("stamina")).toMatchObject({
      attributeId: "strength",
      sourcePage: 16,
    });
    expect(freeD6SkillDefinition("willpower")).toMatchObject({
      attributeId: "charisma",
      sourcePage: 17,
    });
    expect(freeD6SkillDefinition("medicine")).toMatchObject({
      attributeId: "knowledge",
      sourcePage: 17,
      training: "advanced",
    });
    expect(freeD6SkillDefinition("first-aid")).toMatchObject({
      attributeId: "technical",
      sourcePage: 17,
      training: "standard",
    });
  });

  it("builds provenance-bearing Actor skills without duplicating owned keys", () => {
    const sources = missingFreeD6SkillSources(new Set(["firearms"]));
    expect(sources).toHaveLength(106);
    expect(sources.some((source) => source.name === "Firearms")).toBe(false);
    expect(sources.find((source) => source.name === "First Aid")).toMatchObject(
      {
        system: {
          attributeId: "technical",
          source: {
            book: FREE_D6_SOURCE_BOOK,
            module: "free-d6",
            page: 17,
          },
        },
        type: "skill",
      },
    );
  });

  it("selects the FreeD6 catalog only for the exact mechanics composition", () => {
    const profile = {
      strategies: {
        actionEconomy: "open-d6.action-economy.flexible",
        activeDefenses: "open-d6.defenses.active",
        advancement: "open-d6.advancement.character-points",
        attributes: "d6e2.attributes.campaign-profile",
        health: "open-d6.health.wounds-or-body-points",
        initiative: "open-d6.initiative.perception",
        movement: "open-d6.movement.relative",
        metaCurrency: "open-d6.meta-currency.character-and-fate-points",
        pips: "open-d6.pips.classic",
        retries: "open-d6.retries.no-general-reroll",
        scale: "open-d6.scale.scalar",
        successEvaluator: "open-d6.success.meets-or-exceeds",
        wildDie: "open-d6.wild-die.critical-one",
      },
    };
    const fallback = () => [{ name: "Fallback" }];
    expect(profileUsesFreeD6AttributeVocabulary(profile)).toBe(true);
    expect(
      skillSourcesForRulesProfile(profile, new Set(["firearms"]), fallback),
    ).toHaveLength(106);
    expect(
      skillSourcesForRulesProfile(
        {
          ...profile,
          strategies: {
            ...profile.strategies,
            initiative: "d6e2.initiative.basic",
          },
        },
        new Set(),
        fallback,
      ),
    ).toEqual([{ name: "Fallback" }]);
  });
});
