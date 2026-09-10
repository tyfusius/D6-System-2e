import { describe, expect, it } from "vitest";
import { compareBaseInitiative } from "./initiative-base-ties";

describe("base Perception then Reflexes initiative ties", () => {
  it("keeps total primary and compares the full pip score independently", () => {
    const rows = [
      { id: "reflexes", total: 12, perception: 9, reflexes: 11 },
      { id: "perception", total: 12, perception: 10, reflexes: 3 },
      { id: "total", total: 13, perception: 3, reflexes: 3 },
      { id: "lower-reflexes", total: 12, perception: 9, reflexes: 10 },
    ];
    expect(rows.sort(compareBaseInitiative).map(({ id }) => id)).toEqual([
      "total",
      "perception",
      "reflexes",
      "lower-reflexes",
    ]);
  });
  it("resolves differing Perception without requiring the unused Reflexes binding", () => {
    expect(
      compareBaseInitiative(
        { total: 12, perception: 10 },
        { total: 12, perception: 9, reflexes: 15 },
      ),
    ).toBeLessThan(0);
    expect(
      compareBaseInitiative(
        { total: 12, reflexes: 15 },
        { total: 12, perception: 9, reflexes: 3 },
      ),
    ).toBe(0);
  });
  it("retains existing order after exact ties or missing bindings", () => {
    expect(
      compareBaseInitiative(
        { total: 12, perception: 9 },
        { total: 12, perception: 9, reflexes: 12 },
      ),
    ).toBe(0);
    expect(
      compareBaseInitiative(
        { total: 12, perception: 9, reflexes: 10 },
        { total: 12, perception: 9, reflexes: 10 },
      ),
    ).toBe(0);
    expect(compareBaseInitiative({ total: null }, { total: 0 })).toBe(1);
  });
});
