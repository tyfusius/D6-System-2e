import { describe, expect, it } from "vitest";
import {
  healthTerminologyOverrideFields,
  mergeTerminologyOverrideEntries,
  normalizeStoredTerminologyOverrides,
  settingProfileTerminologyFields,
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

  it("keeps the fixed Second Edition condition terminology ids in order", () => {
    expect(
      healthTerminologyOverrideFields("d6e2.damage.conditions").map(
        ({ path }) => path,
      ),
    ).toEqual([
      "conditions.track",
      "conditions.states.healthy",
      "conditions.states.staggered",
      "conditions.states.stunned",
      "conditions.states.wounded",
      "conditions.states.incapacitated",
      "conditions.states.mortallyWounded",
      "conditions.states.dead",
    ]);
  });

  it("selects the terminology fields for the active health strategy", () => {
    expect(
      healthTerminologyOverrideFields("d6e2.damage.conditions").map(
        ({ path }) => path,
      ),
    ).toEqual([
      "conditions.track",
      "conditions.states.healthy",
      "conditions.states.staggered",
      "conditions.states.stunned",
      "conditions.states.wounded",
      "conditions.states.incapacitated",
      "conditions.states.mortallyWounded",
      "conditions.states.dead",
    ]);
    const woundPaths = [
      "wounds.track",
      "wounds.states.healthy",
      "wounds.states.stunned",
      "wounds.states.wounded",
      "wounds.states.severelyWounded",
      "wounds.states.incapacitated",
      "wounds.states.mortallyWounded",
      "wounds.states.dead",
    ];
    expect(
      healthTerminologyOverrideFields("open-d6.damage.wounds").map(
        ({ path }) => path,
      ),
    ).toEqual(woundPaths);
    expect(
      healthTerminologyOverrideFields(
        "open-d6.damage.body-points-with-wounds",
      ).map(({ path }) => path),
    ).toEqual(woundPaths);
    expect(
      healthTerminologyOverrideFields("open-d6.damage.body-points").map(
        ({ path }) => path,
      ),
    ).toEqual(["bodyPoints.track", "bodyPoints.current", "bodyPoints.maximum"]);
    const activePaths = settingProfileTerminologyFields(
      "open-d6.damage.wounds",
    ).map(({ path }) => path);
    expect(activePaths).toContain("attributes.brawn");
    expect(activePaths).toContain("actors.starship.singular");
    expect(activePaths).toContain("actors.starship.plural");
    expect(activePaths).toContain("actors.hideout.singular");
    expect(activePaths).toContain("actors.hideout.plural");
    expect(activePaths).toContain("items.weapon.singular");
    expect(activePaths).toContain("items.advancedSkill.plural");
    expect(activePaths).toContain("wounds.states.severelyWounded");
    expect(activePaths).not.toContain("conditions.states.staggered");
    expect(activePaths).not.toContain("bodyPoints.current");
  });

  it("updates only visible health-family fields and preserves inactive families", () => {
    const existing = terminologyOverridesFromEntries([
      ["conditions.track", "Condition Clock"],
      ["wounds.track", "Wound Levels"],
      ["wounds.states.severelyWounded", "Badly Hurt"],
      ["bodyPoints.track", "Vitality"],
    ]);
    const merged = mergeTerminologyOverrideEntries(existing, [
      ["wounds.track", "Injury Track"],
      ["wounds.states.severelyWounded", ""],
    ]);
    expect(merged).toEqual({
      bodyPoints: { track: "Vitality" },
      conditions: { track: "Condition Clock" },
      wounds: { track: "Injury Track" },
    });
  });

  it("trims supported labels, ignores unknown paths, and omits blanks", () => {
    const contribution = terminologyOverridesFromEntries([
      ["systemLabel", " Echo D6 "],
      ["characterSheetLabel", "Echo Character Record"],
      ["actors.starship.singular", " Spaceship "],
      ["actors.starship.plural", "Spaceships"],
      ["attributes.brawn", " Strength "],
      ["resources.heroPoints", "Force Points"],
      ["resources.experiencePoints", "Advancement Points"],
      ["metaphysics.extranormal", "Resonance"],
      ["metaphysics.skills.channel", "Control"],
      ["items.weapon.singular", "Blaster"],
      ["items.weapon.plural", "Blasters"],
      ["attributes.unknown", "Nope"],
      ["attributes.charm", "   "],
    ]);
    expect(contribution).toEqual({
      actors: {
        starship: { plural: "Spaceships", singular: "Spaceship" },
      },
      attributes: { brawn: "Strength" },
      characterSheetLabel: "Echo Character Record",
      items: { weapon: { plural: "Blasters", singular: "Blaster" } },
      metaphysics: {
        extranormal: "Resonance",
        skills: { channel: "Control" },
      },
      resources: {
        experiencePoints: "Advancement Points",
        heroPoints: "Force Points",
      },
      systemLabel: "Echo D6",
    });
    expect(terminologyOverrideValue(contribution, "attributes.brawn")).toBe(
      "Strength",
    );
  });

  it("sanitizes malformed stored values without propagating them", () => {
    expect(
      normalizeStoredTerminologyOverrides({
        attributes: { brawn: 42, agility: "Dexterity" },
        actors: { starship: { plural: 42, singular: "Spaceship" } },
        resources: "invalid",
      }),
    ).toEqual({
      actors: { starship: { singular: "Spaceship" } },
      attributes: { agility: "Dexterity" },
    });
  });

  it("normalizes every health family without changing stable mechanics", async () => {
    const { FIRST_EDITION_WOUND_LEVELS, firstEditionWoundPenaltyScore } =
      await import("@d6-system-2e/core");
    expect(
      normalizeStoredTerminologyOverrides({
        conditions: { states: { wounded: "Hurt" } },
        wounds: {
          states: { severelyWounded: "Badly Hurt" },
          track: "Injuries",
        },
        bodyPoints: {
          current: "Current Vitality",
          maximum: "Maximum Vitality",
          track: "Vitality",
        },
      }),
    ).toEqual({
      bodyPoints: {
        current: "Current Vitality",
        maximum: "Maximum Vitality",
        track: "Vitality",
      },
      conditions: { states: { wounded: "Hurt" } },
      wounds: {
        states: { severelyWounded: "Badly Hurt" },
        track: "Injuries",
      },
    });
    expect(FIRST_EDITION_WOUND_LEVELS).toEqual([
      "healthy",
      "stunned",
      "wounded",
      "severely-wounded",
      "incapacitated",
      "mortally-wounded",
      "dead",
    ]);
    expect(firstEditionWoundPenaltyScore("wounded")).toBe(3);
    expect(firstEditionWoundPenaltyScore("severely-wounded")).toBe(6);
    expect(firstEditionWoundPenaltyScore("incapacitated")).toBe(9);
  });
});
