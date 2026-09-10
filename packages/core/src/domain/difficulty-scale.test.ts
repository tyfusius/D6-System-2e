import { describe, expect, it } from "vitest";
import {
  difficultyScaleErrors,
  normalizeDifficultyScale,
} from "./difficulty-scale";
import { destinyDifficultyShift } from "./destiny";
const defaults = [
  "very-easy",
  "easy",
  "moderate",
  "difficult",
  "very-difficult",
  "heroic",
].map((id, i) => ({ id, label: id, value: [5, 10, 15, 20, 30, 35][i] ?? 0 }));
describe("extensible difficulty scale", () => {
  it("orders every custom anchor and uses its exact adjacent Destiny step without off-anchor inference", () => {
    const scale = normalizeDifficultyScale(
      [
        ...defaults,
        { id: "custom-between", label: "Between", value: 17 },
        { id: "custom-high", label: "Far beyond", value: 1000 },
      ],
      defaults,
    );
    expect(difficultyScaleErrors(scale)).toEqual([]);
    const ladder = scale.map((e) => e.value);
    expect(destinyDifficultyShift(20, ladder, "light")).toBe(17);
    expect(destinyDifficultyShift(17, ladder, "light")).toBe(15);
    expect(destinyDifficultyShift(15, ladder, "dark")).toBe(17);
    expect(destinyDifficultyShift(35, ladder, "dark")).toBe(1000);
    expect(() => destinyDifficultyShift(16, ladder, "light")).toThrow(
      "CustomDifficultyCategory",
    );
    expect(() => destinyDifficultyShift(1000, ladder, "dark")).toThrow(
      "DifficultyBoundary",
    );
  });
  it("retains legacy numeric values exactly while diagnosing ambiguity and invalid write values", () => {
    const legacy = defaults.map((e) => ({
      ...e,
      value: e.id === "easy" ? 35 : e.id === "moderate" ? 1.5 : e.value,
    }));
    const scale = normalizeDifficultyScale(legacy, defaults);
    expect(Object.fromEntries(scale.map((e) => [e.id, e.value]))).toEqual(
      Object.fromEntries(legacy.map((e) => [e.id, e.value])),
    );
    expect(difficultyScaleErrors(scale)).toEqual(
      expect.arrayContaining(["easy.value", "heroic.value", "moderate.value"]),
    );
    expect(() =>
      destinyDifficultyShift(
        35,
        scale.map((e) => e.value),
        "light",
      ),
    ).toThrow("DifficultyScale");
    expect(
      difficultyScaleErrors(defaults.filter((e) => e.id !== "easy")),
    ).toContain("scale");
  });
});
