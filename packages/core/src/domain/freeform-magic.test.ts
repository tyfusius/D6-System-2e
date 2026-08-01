import { describe, expect, it } from "vitest";
import {
  freeformMagicDifficulty,
  freeformMagicResistancePower,
  freeformMagicUntrainedPenalty,
} from "./freeform-magic";

describe("Second Edition freeform skill-based magic", () => {
  it("adds every printed design modifier and floors the result at 5", () => {
    expect(
      freeformMagicDifficulty({
        castingTime: "action",
        duration: "round",
        power: 3,
        range: "senses",
        resistance: "partial",
        school: "alteration",
        target: "two-three",
      }),
    ).toMatchObject({ difficulty: 30, powerModifier: 10, targetModifier: 5 });
    expect(
      freeformMagicDifficulty({
        castingTime: "year",
        duration: "instant",
        power: 1,
        range: "melee",
        resistance: "complete",
        school: "divination",
        target: "self",
      }).difficulty,
    ).toBe(5);
  });

  it("continues Power by +5 per point above ten", () => {
    expect(
      freeformMagicDifficulty({
        castingTime: "action",
        duration: "round",
        power: 12,
        range: "melee",
        resistance: "complete",
        school: "conjuration",
        target: "one",
      }).powerModifier,
    ).toBe(55);
  });

  it("applies partial and complete successful resistance without mutating the design", () => {
    expect(freeformMagicResistancePower(5, "partial", true)).toBe(2);
    expect(freeformMagicResistancePower(5, "complete", true)).toBe(0);
    expect(freeformMagicResistancePower(5, "partial", false)).toBe(5);
  });

  it("applies trained, untrained-with-dice, and no-dice penalties", () => {
    expect(freeformMagicUntrainedPenalty(true, 0, 0)).toBe(0);
    expect(freeformMagicUntrainedPenalty(false, 3, 0)).toBe(5);
    expect(freeformMagicUntrainedPenalty(false, 0, 3)).toBe(5);
    expect(freeformMagicUntrainedPenalty(false, 0, 0)).toBe(10);
  });
});
