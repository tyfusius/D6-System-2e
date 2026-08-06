import { describe, expect, it } from "vitest";
import type { ItemSource } from "@d6-system-2e/core";
import { addCharacterTemplateAuthoringContract } from "./048-add-character-template-authoring-contract";

describe("Character Template authoring migration", () => {
  it("recovers published Fantasy template Attributes and Skills", () => {
    const source = {
      flags: {
        "d6-system-2e": {
          characterTemplate: { templateId: "fantasy-warrior" },
        },
      },
      name: "Warrior",
      system: { description: "Legacy entry", key: "fantasy-warrior" },
      type: "character-template",
    } as unknown as ItemSource;

    addCharacterTemplateAuthoringContract(source);

    expect(source.system.attributeScores).toHaveLength(7);
    expect(source.system.suggestedSkillKeys).toEqual([
      "athletics",
      "melee",
      "shooting",
      "stamina",
      "throwing",
    ]);
    expect(source.system.rulesFamily).toBe("d6-system-second-edition");
  });

  it("preserves authored template snapshots", () => {
    const items = [{ name: "Sword", system: {}, type: "weapon" }];
    const source = {
      flags: {},
      name: "Custom",
      system: {
        attributeScores: [{ attributeId: "agility", score: 12 }],
        items,
        key: "custom",
        legacyField: "preserved",
        rulesFamily: "open-d6-first-edition",
      },
      type: "character-template",
    } as unknown as ItemSource;

    addCharacterTemplateAuthoringContract(source);

    expect(source.system.items).toEqual(items);
    expect(source.system.attributeScores).toEqual([
      { attributeId: "agility", score: 12 },
    ]);
    expect(source.system.rulesFamily).toBe("open-d6-first-edition");
    expect(source.system.legacyField).toBe("preserved");
  });
});
