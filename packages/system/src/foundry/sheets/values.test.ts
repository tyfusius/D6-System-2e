import { describe, expect, it } from "vitest";
import { activeAttributeDefinitions } from "./values";

describe("active attribute definitions", () => {
  it("uses the four Second Edition core attributes by default", () => {
    expect(
      activeAttributeDefinitions(false).map((attribute) => attribute.id),
    ).toEqual(["agility", "brawn", "knowledge", "perception"]);
  });

  it("activates the six-field OpenD6 Space-compatible profile", () => {
    expect(
      activeAttributeDefinitions(true).map((attribute) => attribute.id),
    ).toEqual([
      "agility",
      "brawn",
      "mechanical",
      "knowledge",
      "perception",
      "technical",
    ]);
  });

  it("adds independently configured optional Second Edition attributes", () => {
    expect(
      activeAttributeDefinitions(
        false,
        new Set(["mechanical", "charm", "mysticism"]),
      ).map((attribute) => attribute.id),
    ).toEqual([
      "agility",
      "brawn",
      "knowledge",
      "perception",
      "mechanical",
      "charm",
      "mysticism",
    ]);
  });
});
