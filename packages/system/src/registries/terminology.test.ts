import { afterEach, describe, expect, it, vi } from "vitest";
import {
  currentTerminology,
  resetTerminologyRegistryForTests,
  setRulesProfileTerminology,
  setSettingProfileTerminology,
  setWorldTerminologyOverrides,
  terminologyAttributeLabel,
  terminologyActorLabel,
  terminologyBodyPointLabel,
  terminologyConditionLabel,
  terminologyConditionTrackLabel,
  terminologyHealthStateLabel,
  terminologyHealthTrackLabel,
  terminologyItemDocumentLabel,
  terminologyRegistry,
  terminologyResourceLabel,
  terminologyWoundLabel,
} from "./terminology";

afterEach(() => {
  resetTerminologyRegistryForTests();
  vi.unstubAllGlobals();
});

describe("terminology registry", () => {
  it("merges stable attribute and resource labels", () => {
    terminologyRegistry.register("example-companion", {
      attributes: { agility: "Dexterity", brawn: "Strength" },
      resources: {
        experiencePoints: "Character Points",
        fatePoints: "Force Points",
      },
    });
    expect(currentTerminology()).toEqual({
      actors: {},
      attributes: { agility: "Dexterity", brawn: "Strength" },
      bodyPoints: {},
      conditions: { states: {} },
      details: {},
      items: {},
      machines: {},
      manifestations: {},
      metaphysics: { skills: {} },
      resources: {
        experiencePoints: "Character Points",
        fatePoints: "Force Points",
      },
      wounds: { states: {} },
    });
  });

  it("resolves actor and Item document names without changing document types", () => {
    setSettingProfileTerminology({
      actors: {
        starship: { plural: "Spaceships", singular: "Spaceship" },
      },
      items: {
        advancedSkill: { plural: "Disciplines", singular: "Discipline" },
        weapon: { plural: "Arms", singular: "Arm" },
      },
    });
    const terminology = currentTerminology();

    expect(
      terminologyActorLabel(terminology, "starship", "singular", "Starship"),
    ).toBe("Spaceship");
    expect(
      terminologyItemDocumentLabel(terminology, "weapon", "plural", "Weapons"),
    ).toBe("Arms");
    expect(
      terminologyItemDocumentLabel(terminology, "skill", "singular", "Skill", {
        advanced: true,
      }),
    ).toBe("Discipline");
    expect(
      terminologyItemDocumentLabel(
        terminology,
        "specialization",
        "singular",
        "Specialization",
      ),
    ).toBe("Specialization");
  });

  it("resolves stable Second Edition condition labels without changing ids", () => {
    setSettingProfileTerminology({
      conditions: {
        states: { mortallyWounded: "At Death's Door", wounded: "Hurt" },
        track: "Injury Track",
      },
    });
    const terminology = currentTerminology();
    expect(terminologyConditionTrackLabel(terminology)).toBe("Injury Track");
    expect(terminologyConditionLabel(terminology, "wounded")).toBe("Hurt");
    expect(terminologyConditionLabel(terminology, "mortally-wounded")).toBe(
      "At Death's Door",
    );
  });

  it("resolves First Edition wound and Body Point labels independently", () => {
    setSettingProfileTerminology({
      bodyPoints: {
        current: "Current Vitality",
        maximum: "Maximum Vitality",
        track: "Vitality",
      },
      conditions: { states: { wounded: "Hurt" }, track: "Condition Clock" },
      wounds: {
        states: { severelyWounded: "Badly Hurt", wounded: "Injured" },
        track: "Wound Levels",
      },
    });
    const terminology = currentTerminology();

    expect(terminologyConditionTrackLabel(terminology)).toBe("Condition Clock");
    expect(terminologyConditionLabel(terminology, "wounded")).toBe("Hurt");
    expect(terminologyWoundLabel(terminology, "wounded")).toBe("Injured");
    expect(terminologyWoundLabel(terminology, "severely-wounded")).toBe(
      "Badly Hurt",
    );
    expect(
      terminologyHealthTrackLabel(terminology, "open-d6.damage.wounds"),
    ).toBe("Wound Levels");
    expect(
      terminologyHealthStateLabel(
        terminology,
        "open-d6.damage.body-points-with-wounds",
        "severely-wounded",
      ),
    ).toBe("Badly Hurt");
    expect(
      terminologyHealthTrackLabel(terminology, "open-d6.damage.body-points"),
    ).toBe("Vitality");
    expect(terminologyBodyPointLabel(terminology, "current")).toBe(
      "Current Vitality",
    );
    expect(terminologyBodyPointLabel(terminology, "maximum")).toBe(
      "Maximum Vitality",
    );
  });

  it("inherits the active family defaults when labels are absent", () => {
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => `default:${key}` },
    });
    const terminology = currentTerminology();

    expect(
      terminologyHealthTrackLabel(terminology, "open-d6.damage.wounds"),
    ).toBe("default:D6E2.Combat.FirstEdition.WoundTrack");
    expect(terminologyWoundLabel(terminology, "severely-wounded")).toBe(
      "default:D6E2.Condition.SeverelyWounded",
    );
    expect(
      terminologyHealthTrackLabel(terminology, "open-d6.damage.body-points"),
    ).toBe("default:D6E2.Combat.FirstEdition.BodyPoints.Track");
    expect(terminologyBodyPointLabel(terminology, "current")).toBe(
      "default:D6E2.Combat.FirstEdition.BodyPoints.Current",
    );
  });

  it("merges nested companion vocabulary without losing sibling labels", () => {
    terminologyRegistry.register("first-companion", {
      actors: { starship: { singular: "Spaceship" } },
      details: { currency: "Credits" },
      items: { weapon: { singular: "Arm" } },
      metaphysics: { skills: { channel: "Harmonize" } },
    });
    terminologyRegistry.register("second-companion", {
      actors: { starship: { plural: "Spaceships" } },
      details: { allegiance: "Faction" },
      items: { weapon: { plural: "Arms" } },
      metaphysics: { skills: { sense: "Attune" } },
    });
    expect(currentTerminology().details).toEqual({
      allegiance: "Faction",
      currency: "Credits",
    });
    expect(currentTerminology().actors.starship).toEqual({
      plural: "Spaceships",
      singular: "Spaceship",
    });
    expect(currentTerminology().items.weapon).toEqual({
      plural: "Arms",
      singular: "Arm",
    });
    expect(currentTerminology().metaphysics.skills).toEqual({
      channel: "Harmonize",
      sense: "Attune",
    });
  });

  it("applies world labels after companion terminology without changing ids", () => {
    terminologyRegistry.register("example-companion", {
      attributes: { brawn: "Strength" },
      resources: { heroPoints: "Echo Points" },
    });
    setWorldTerminologyOverrides({
      attributes: { brawn: "Might" },
      resources: { heroPoints: "Force Points" },
    });
    expect(currentTerminology().attributes).toEqual({ brawn: "Might" });
    expect(currentTerminology().resources).toEqual({
      heroPoints: "Force Points",
    });
  });

  it("resolves package, Rules Profile, then Setting Profile terminology", () => {
    terminologyRegistry.register("engine-defaults", {
      resources: { heroPoints: "Hero Points" },
    });
    setRulesProfileTerminology({
      resources: { heroPoints: "Fate Points" },
    });
    expect(currentTerminology().resources.heroPoints).toBe("Fate Points");
    setSettingProfileTerminology({
      resources: { heroPoints: "Echo Points" },
    });
    expect(currentTerminology().resources.heroPoints).toBe("Echo Points");
  });

  it("resolves Experience Point labels independently from the stable resource id", () => {
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => `default:${key}` },
    });
    expect(
      terminologyResourceLabel(currentTerminology(), "experiencePoints"),
    ).toBe("default:D6E2.ExperiencePoints");

    setSettingProfileTerminology({
      resources: { experiencePoints: "Character Points" },
    });
    expect(
      terminologyResourceLabel(currentTerminology(), "experiencePoints"),
    ).toBe("Character Points");
  });

  it("uses the metaphysics Attribute name for the stable Extranormal id", () => {
    terminologyRegistry.register("example-companion", {
      metaphysics: { attribute: "Echo Resonance" },
    });
    expect(terminologyAttributeLabel(currentTerminology(), "extranormal")).toBe(
      "Echo Resonance",
    );
    setWorldTerminologyOverrides({
      attributes: { extranormal: "The Force" },
    });
    expect(terminologyAttributeLabel(currentTerminology(), "extranormal")).toBe(
      "The Force",
    );
  });

  it("allows an owner to unregister without changing stored document IDs", () => {
    terminologyRegistry.register("example-companion", {
      attributes: { agility: "Dexterity" },
    });
    terminologyRegistry.unregisterOwner("example-companion");
    expect(currentTerminology().attributes).toEqual({});
  });

  it("rejects malformed owner, attribute, and empty labels", () => {
    expect(() => terminologyRegistry.register("Bad Owner", {})).toThrow(
      TypeError,
    );
    expect(() =>
      terminologyRegistry.register("valid-owner", {
        attributes: { "Bad Attribute": "Label" },
      }),
    ).toThrow(TypeError);
    expect(() =>
      terminologyRegistry.register("valid-owner", {
        systemLabel: " ",
      }),
    ).toThrow(TypeError);
  });
});
