import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const characterModel = readFileSync(
  new URL("./data-models/character.ts", import.meta.url),
  "utf8",
);
const characterSheet = readFileSync(
  new URL("./sheets/character-sheet.ts", import.meta.url),
  "utf8",
);
const itemSheet = readFileSync(
  new URL("./sheets/item-sheet.ts", import.meta.url),
  "utf8",
);

describe("universal character capability contract", () => {
  it("persists the full edition and setting Attribute superset", () => {
    for (const id of [
      "agility",
      "acumen",
      "brawn",
      "charisma",
      "charm",
      "coordination",
      "extranormal",
      "intellect",
      "knowledge",
      "magic",
      "mechanical",
      "mysticism",
      "perception",
      "physique",
      "presence",
      "reflexes",
      "technical",
    ]) {
      expect(characterModel).toContain(`${id}: pipScoreField(`);
    }
  });

  it("edits the full Attribute union in templates while projecting only active sheet Attributes", () => {
    expect(itemSheet).toContain("const templateAttributeDefinitions = new Map");
    expect(itemSheet).toContain("characterTemplateAttributeDefinitions()");
    expect(characterSheet).toContain("activeAttributeDefinitions()");
    expect(characterSheet).not.toContain(
      "compatibility.firstEditionAttributes",
    );
  });

  it("retains every supported personal Item family independently of active mechanics", () => {
    for (const type of [
      "advantage",
      "armor",
      "asset",
      "cybernetic",
      "disadvantage",
      "flaw",
      "gear",
      "manifestation",
      "perk",
      "specialability",
      "specialization",
      "talent",
      "trouble",
      "weapon",
    ]) {
      expect(characterSheet).toContain(`"${type}"`);
    }
  });
});
