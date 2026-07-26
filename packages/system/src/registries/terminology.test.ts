import { afterEach, describe, expect, it } from "vitest";
import {
  currentTerminology,
  resetTerminologyRegistryForTests,
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
      resources: { fatePoints: "Force Points" },
    });
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
