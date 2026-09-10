import { describe, expect, it } from "vitest";
import provenance from "../catalog-provenance.json";
import { WESTERN1876_ATTRIBUTES, WESTERN1876_SKILLS } from "./catalog";
import { WESTERN1876_GENRE } from "./genre";
import { MODULE_ID } from "./module";
import { create1876RulesProfile, create1876SettingProfile } from "./profiles";

describe("1876 manuscript catalogue coverage", () => {
  it("covers every extracted Chapter 5 entry with its exact current attribute", () => {
    // This fixture is independently extracted from the hash-pinned manuscript headings.
    expect(
      WESTERN1876_SKILLS.map(({ key, name, attributeId }) => ({
        key,
        name,
        attributeId,
      })),
    ).toEqual(provenance.skills);
    expect(WESTERN1876_SKILLS).toHaveLength(44);
    expect(new Set(WESTERN1876_SKILLS.map(({ key }) => key)).size).toBe(44);
    expect(create1876SettingProfile((key) => key).skills).toEqual(
      WESTERN1876_SKILLS,
    );
    expect(
      WESTERN1876_SKILLS.every(({ description }) =>
        description.includes("Source: 1876 working draft, Chapter 5"),
      ),
    ).toBe(true);
  });

  it("keeps eight independent Presence Handling fields without universal or bonus pools", () => {
    const fields = WESTERN1876_SKILLS.filter(({ key }) =>
      key.startsWith("handling-"),
    );
    expect(fields.map(({ name }) => name)).toEqual(
      provenance.handlingFields.map((field) => `Handling: ${field}`),
    );
    expect(WESTERN1876_SKILLS.some(({ key }) => key === "handling")).toBe(
      false,
    );
    expect(
      fields.every(
        (skill) =>
          skill.attributeId === "presence" && skill.training === "standard",
      ),
    ).toBe(true);
    for (const field of fields) {
      expect(field.description).toContain("independent full skill");
      expect(field.description).toContain("Other agreed fields");
      expect(Object.keys(field).sort()).toEqual([
        "attributeId",
        "description",
        "img",
        "key",
        "name",
        "training",
      ]);
    }
    expect(
      WESTERN1876_SKILLS.find(({ key }) => key === "riding")?.attributeId,
    ).toBe("reflexes");
  });

  it("preserves professional permissions without changing standard base pools or costs", () => {
    expect(
      WESTERN1876_SKILLS.every(({ training }) => training === "standard"),
    ).toBe(true);
    for (const key of [
      "medicine",
      "gunsmithing",
      "lockwork",
      "craft",
      "demolition",
    ]) {
      expect(
        WESTERN1876_SKILLS.find((skill) => skill.key === key)?.description,
      ).toMatch(/learned|training/i);
    }
    const medicine = WESTERN1876_SKILLS.find(({ key }) => key === "medicine");
    if (!medicine) throw new Error("Missing canonical Medicine skill");
    expect(medicine.description).toContain("recorded training");
    expect(medicine.description).toContain("surgical permission");
    const elective = WESTERN1876_SKILLS.find(({ key }) => key === "blowguns");
    if (!elective) throw new Error("Missing elective Blowguns skill");
    expect(elective.attributeId).toBe("coordination");
    expect(elective.description).toContain("Elective");
    expect(elective.description).toContain("existing personal pips");
    expect(elective.description).toContain("no free pips");
    expect(elective.description).toContain("ordinary skill cost");
  });

  it("declares six ordered current attributes, roles and unchanged 18D/7D budgets", () => {
    expect(WESTERN1876_ATTRIBUTES.map(({ id }) => id)).toEqual([
      "reflexes",
      "coordination",
      "physique",
      "knowledge",
      "perception",
      "presence",
    ]);
    expect(WESTERN1876_GENRE).toEqual({
      version: 1,
      id: MODULE_ID,
      genreId: MODULE_ID,
      label: "1876 — Current Working Attributes",
      attributes: WESTERN1876_ATTRIBUTES,
      attributeBudgetScore: 54,
      skillBudgetScore: 21,
      roles: {
        initiative: "perception",
        knowledge: "knowledge",
        strength: "physique",
      },
      skills: [],
    });
    const vocabulary = create1876SettingProfile((key) => key).attributes;
    expect(create1876RulesProfile((key) => key)).toMatchObject({
      firstEditionGenreProfile: { version: 1, id: MODULE_ID },
    });
    expect(
      WESTERN1876_ATTRIBUTES.every(({ id }) =>
        vocabulary.some((attribute) => attribute.id === id),
      ),
    ).toBe(true);
    expect(vocabulary.every((attribute) => !("active" in attribute))).toBe(
      true,
    );
  });

  it("maps Chapter 2 working difficulties without replacing existing tier ids", () => {
    expect(create1876RulesProfile((key) => key).difficultyLadder).toEqual([
      { id: "very-easy", label: "Very Easy", value: 5 },
      { id: "easy", label: "Easy", value: 10 },
      { id: "moderate", label: "Moderate", value: 15 },
      { id: "difficult", label: "Difficult", value: 20 },
      { id: "very-difficult", label: "Very Difficult", value: 25 },
      { id: "heroic", label: "Exceptional", value: 30 },
    ]);
  });
});
