import { describe, expect, it } from "vitest";
import {
  characterAttributeTooltip,
  characterSkillTooltip,
  type CharacterTooltipI18n,
} from "./character-tooltips";

const i18n: CharacterTooltipI18n = {
  format: (key, data) => `${key}:${data.attribute}:${data.skill ?? ""}`,
  localize: (key) => key,
};

describe("character sheet tooltips", () => {
  it("provides original guidance for every built-in Attribute identity", () => {
    for (const id of [
      "agility",
      "brawn",
      "charm",
      "knowledge",
      "magic",
      "mechanical",
      "mysticism",
      "perception",
      "technical",
    ]) {
      expect(characterAttributeTooltip(id, id, "", i18n)).toMatch(
        /^D6E2\.Tooltip\.Attribute\./,
      );
    }
  });

  it("uses a stored lawful Skill description before catalog guidance", () => {
    expect(
      characterSkillTooltip(
        {
          attributeLabel: "Agility",
          description: "<p>Campaign-specific use.</p>",
          key: "acrobatics",
          name: "Acrobatics",
          requestedRollLabel: "",
        },
        i18n,
      ),
    ).toBe("Campaign-specific use.");
  });

  it("turns long imported rules text into a short readable hover summary", () => {
    const tooltip = characterSkillTooltip(
      {
        attributeLabel: "Strength",
        description: `<p><strong>Specializations:</strong> Climbing, jumping.</p><p>Use this skill when a character attempts to climb a wall or leap a wide gap.</p><p>${"Long modifier table. ".repeat(30)}</p>`,
        key: "climbing-jumping",
        name: "Climbing/Jumping",
        requestedRollLabel: "",
      },
      i18n,
    );
    expect(tooltip.length).toBeLessThanOrEqual(221);
    expect(tooltip).not.toContain("<p>");
    expect(tooltip).toContain("Specializations");
  });

  it("never renders null-like descriptions and falls back safely", () => {
    for (const description of [null, undefined, "", " null ", "undefined"]) {
      const tooltip = characterSkillTooltip(
        {
          attributeLabel: "Agility",
          description,
          key: "campaign-skill",
          name: "Campaign Skill",
          requestedRollLabel: "",
        },
        i18n,
      );
      expect(tooltip).toBe("D6E2.Tooltip.Skill.Generic:Agility:Campaign Skill");
      expect(tooltip.toLowerCase()).not.toBe("null");
    }
  });

  it("keeps highlighted roll-request context above the description", () => {
    expect(
      characterAttributeTooltip("agility", "Agility", "Requested by GM", i18n),
    ).toBe("Requested by GM<br>D6E2.Tooltip.Attribute.Agility");
  });
});
