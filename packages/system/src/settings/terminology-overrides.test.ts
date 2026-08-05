import { describe, expect, it } from "vitest";
import {
  normalizeStoredTerminologyOverrides,
  TERMINOLOGY_OVERRIDE_FIELDS,
  terminologyOverridesFromEntries,
  terminologyOverrideValue,
} from "./terminology-overrides";

describe("world terminology overrides", () => {
  it("covers every persisted character Attribute id", () => {
    const attributePaths = TERMINOLOGY_OVERRIDE_FIELDS.filter(
      ({ group }) => group === "attributes",
    ).map(({ path }) => path);
    expect(attributePaths).toEqual([
      "attributes.agility",
      "attributes.acumen",
      "attributes.brawn",
      "attributes.charisma",
      "attributes.charm",
      "attributes.coordination",
      "attributes.extranormal",
      "attributes.intellect",
      "attributes.knowledge",
      "attributes.magic",
      "attributes.mechanical",
      "attributes.mysticism",
      "attributes.perception",
      "attributes.physique",
      "attributes.presence",
      "attributes.reflexes",
      "attributes.technical",
    ]);
  });

  it("trims supported labels, ignores unknown paths, and omits blanks", () => {
    const contribution = terminologyOverridesFromEntries([
      ["attributes.brawn", " Strength "],
      ["resources.heroPoints", "Force Points"],
      ["metaphysics.skills.channel", "Control"],
      ["attributes.unknown", "Nope"],
      ["attributes.charm", "   "],
    ]);
    expect(contribution).toEqual({
      attributes: { brawn: "Strength" },
      metaphysics: { skills: { channel: "Control" } },
      resources: { heroPoints: "Force Points" },
    });
    expect(terminologyOverrideValue(contribution, "attributes.brawn")).toBe(
      "Strength",
    );
  });

  it("sanitizes malformed stored values without propagating them", () => {
    expect(
      normalizeStoredTerminologyOverrides({
        attributes: { brawn: 42, agility: "Dexterity" },
        resources: "invalid",
      }),
    ).toEqual({ attributes: { agility: "Dexterity" } });
  });
});
