import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  bindCharacterAttributeKeyboardTooltips,
  characterAttributeTooltip,
  characterSkillTooltip,
  type CharacterTooltipI18n,
} from "./character-tooltips";

class FakeUnratedAttributeHeading extends EventTarget {
  readonly dataset = { tooltip: "Measures coordination." };
}

function keyboardEvent(key: string): Event {
  const event = new Event("keydown", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "key", { value: key });
  return event;
}

const i18n: CharacterTooltipI18n = {
  format: (key, data) => `${key}:${data.attribute}:${data.skill ?? ""}`,
  localize: (key) => key,
};

const localization = JSON.parse(
  readFileSync(new URL("../../../../../lang/en.json", import.meta.url), "utf8"),
) as Record<string, string>;

const localizedI18n: CharacterTooltipI18n = {
  format: (key, data) =>
    (localization[key] ?? key).replace(
      /\{(attribute|skill)\}/gu,
      (_match, field: "attribute" | "skill") => data[field] ?? "",
    ),
  localize: (key) => localization[key] ?? key,
};

describe("character sheet tooltips", () => {
  it("opens unrated Attribute help on focus and dismisses it on blur", () => {
    const heading = new FakeUnratedAttributeHeading();
    const activate = vi.fn();
    const deactivate = vi.fn();

    bindCharacterAttributeKeyboardTooltips(
      { querySelectorAll: () => [heading] } as unknown as HTMLElement,
      { activate, deactivate },
    );
    heading.dispatchEvent(new Event("focus"));
    heading.dispatchEvent(new Event("blur"));

    expect(activate).toHaveBeenCalledOnce();
    expect(activate).toHaveBeenCalledWith(heading, {
      text: "Measures coordination.",
    });
    expect(deactivate).toHaveBeenCalledOnce();
  });

  it("dismisses unrated help on Escape without implying a roll action", () => {
    const heading = new FakeUnratedAttributeHeading();
    const deactivate = vi.fn();
    bindCharacterAttributeKeyboardTooltips(
      { querySelectorAll: () => [heading] } as unknown as HTMLElement,
      { activate: vi.fn(), deactivate },
    );

    const enter = keyboardEvent("Enter");
    const space = keyboardEvent(" ");
    const escape = keyboardEvent("Escape");
    const stopPropagation = vi.spyOn(escape, "stopPropagation");
    heading.dispatchEvent(enter);
    heading.dispatchEvent(space);
    heading.dispatchEvent(escape);

    expect(deactivate).toHaveBeenCalledOnce();
    expect(enter.defaultPrevented).toBe(false);
    expect(space.defaultPrevented).toBe(false);
    expect(escape.defaultPrevented).toBe(true);
    expect(stopPropagation).toHaveBeenCalledOnce();
  });

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

  it("localizes every first-party active Attribute label and specific tooltip", () => {
    const attributeIds = new Set([
      // Second Edition, OpenD6 Space, and optional system Attributes.
      "agility",
      "brawn",
      "charm",
      "knowledge",
      "magic",
      "mechanical",
      "mysticism",
      "perception",
      "technical",
      // Official generated OpenD6 Adventure/Fantasy Attributes.
      "acumen",
      "charisma",
      "coordination",
      "extranormal",
      "intellect",
      "physique",
      "presence",
      "reflexes",
      // FreeD6's distinct semantic Strength Attribute.
      "strength",
    ]);

    for (const id of attributeIds) {
      const name = `${id[0]?.toUpperCase() ?? ""}${id.slice(1)}`;
      const labelKey = `D6E2.Attribute.${name}`;
      const tooltipKey = `D6E2.Tooltip.Attribute.${name}`;
      const label = localization[labelKey];

      expect(label, labelKey).toBeTypeOf("string");
      expect(label, labelKey).not.toBe(labelKey);
      expect(localization[tooltipKey], tooltipKey).toBeTypeOf("string");
      expect(
        characterAttributeTooltip(id, label ?? id, "", localizedI18n),
      ).toBe(localization[tooltipKey]);
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

  it("uses the exact Advanced Skill or Specialization description", () => {
    for (const skill of [
      {
        description: "<p>Diagnose and perform complex surgical care.</p>",
        key: "medicine-surgery",
        name: "Surgery",
      },
      {
        description: "<p>Plot routes through the Elrood sector.</p>",
        key: "astrogation-elrood-sector",
        name: "Elrood Sector",
      },
    ]) {
      expect(
        characterSkillTooltip(
          {
            attributeLabel: "Knowledge",
            requestedRollLabel: "",
            ...skill,
          },
          i18n,
        ),
      ).toBe(
        skill.name === "Surgery"
          ? "Diagnose and perform complex surgical care."
          : "Plot routes through the Elrood sector.",
      );
    }
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
