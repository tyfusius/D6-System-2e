import { afterEach, describe, expect, it } from "vitest";
import {
  currentTerminology,
  resetTerminologyRegistryForTests,
  setRulesProfileTerminology,
  setSettingProfileTerminology,
  setWorldTerminologyOverrides,
  terminologyAttributeLabel,
  terminologyRegistry,
} from "./terminology";

afterEach(resetTerminologyRegistryForTests);

describe("terminology registry", () => {
  it("merges stable attribute and resource labels", () => {
    terminologyRegistry.register("example-companion", {
      attributes: { agility: "Dexterity", brawn: "Strength" },
      resources: { fatePoints: "Force Points" },
    });
    expect(currentTerminology()).toEqual({
      attributes: { agility: "Dexterity", brawn: "Strength" },
      details: {},
      items: {},
      machines: {},
      manifestations: {},
      metaphysics: { skills: {} },
      resources: { fatePoints: "Force Points" },
    });
  });

  it("merges nested companion vocabulary without losing sibling labels", () => {
    terminologyRegistry.register("first-companion", {
      details: { currency: "Credits" },
      metaphysics: { skills: { channel: "Harmonize" } },
    });
    terminologyRegistry.register("second-companion", {
      details: { allegiance: "Faction" },
      metaphysics: { skills: { sense: "Attune" } },
    });
    expect(currentTerminology().details).toEqual({
      allegiance: "Faction",
      currency: "Credits",
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
