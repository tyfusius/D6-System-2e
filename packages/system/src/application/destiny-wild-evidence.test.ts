import { describe, it, expect } from "vitest";
import { destinyOriginalWildGroups } from "./destiny-wild-evidence";
describe("Destiny original Wild evidence", () => {
  it("folds deferred Second Edition explosions into their original die", () =>
    expect(destinyOriginalWildGroups(1, [[6], [2]])).toEqual([[6, 2]]));
  it("preserves a second original1 but never promotes a later exploded1", () => {
    expect(
      destinyOriginalWildGroups(2, [[6], [1], [6, 2]]).map((g) => g[0]),
    ).toEqual([6, 1]);
    expect(destinyOriginalWildGroups(1, [[6], [1]]).map((g) => g[0])).toEqual([
      6,
    ]);
  });
  it("handles multiple continuation rounds in die order", () =>
    expect(destinyOriginalWildGroups(2, [[6], [6], [6], [3], [2]])).toEqual([
      [6, 6, 2],
      [6, 3],
    ]));
  it("rejects a continuation without a preceding6", () =>
    expect(() => destinyOriginalWildGroups(1, [[1], [4]])).toThrow(
      "RollEvidence",
    ));
});
