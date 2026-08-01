import { describe, expect, it } from "vitest";
import {
  applyFirstEditionBodyPointDamage,
  firstEditionBodyPointHealingPlan,
  firstEditionBodyPointMaximum,
  firstEditionBodyPointRescueMinimum,
  firstEditionBodyPointSkillLossDice,
  firstEditionBodyPointWound,
  recoverFirstEditionBodyPoints,
} from "./first-edition-body-points";

describe("First Edition Body Points", () => {
  it("derives the creation maximum from the Strength roll plus 20", () => {
    expect(firstEditionBodyPointMaximum(12)).toBe(32);
    expect(firstEditionBodyPointMaximum(Number.NaN)).toBe(20);
  });

  it("maps every printed percentage band without overlap", () => {
    expect(firstEditionBodyPointWound(81, 100)).toBe("healthy");
    expect(firstEditionBodyPointWound(80, 100)).toBe("stunned");
    expect(firstEditionBodyPointWound(60, 100)).toBe("stunned");
    expect(firstEditionBodyPointWound(59, 100)).toBe("wounded");
    expect(firstEditionBodyPointWound(40, 100)).toBe("wounded");
    expect(firstEditionBodyPointWound(39, 100)).toBe("severely-wounded");
    expect(firstEditionBodyPointWound(20, 100)).toBe("severely-wounded");
    expect(firstEditionBodyPointWound(19, 100)).toBe("incapacitated");
    expect(firstEditionBodyPointWound(10, 100)).toBe("incapacitated");
    expect(firstEditionBodyPointWound(9, 100)).toBe("mortally-wounded");
  });

  it("keeps zero rescue-eligible and makes another maximum fatal", () => {
    expect(firstEditionBodyPointWound(0, 30)).toBe("mortally-wounded");
    expect(firstEditionBodyPointWound(-29, 30)).toBe("mortally-wounded");
    expect(firstEditionBodyPointWound(-30, 30)).toBe("dead");
  });

  it("subtracts net damage and caps healing at maximum", () => {
    expect(
      applyFirstEditionBodyPointDamage({ current: 20, maximum: 30 }, 9),
    ).toEqual({ current: 11, maximum: 30 });
    expect(
      recoverFirstEditionBodyPoints({ current: 28, maximum: 30 }, 6),
    ).toEqual({ current: 30, maximum: 30 });
  });

  it("maps the complete Body Points healing table", () => {
    expect(firstEditionBodyPointHealingPlan(0)).toEqual({ dice: 0, fixed: 0 });
    expect(firstEditionBodyPointHealingPlan(5)).toEqual({ dice: 0, fixed: 2 });
    expect(firstEditionBodyPointHealingPlan(10)).toEqual({ dice: 1, fixed: 0 });
    expect(firstEditionBodyPointHealingPlan(15)).toEqual({ dice: 2, fixed: 0 });
    expect(firstEditionBodyPointHealingPlan(20)).toEqual({ dice: 3, fixed: 0 });
    expect(firstEditionBodyPointHealingPlan(25)).toEqual({ dice: 4, fixed: 0 });
    expect(firstEditionBodyPointHealingPlan(30)).toEqual({ dice: 5, fixed: 0 });
    expect(firstEditionBodyPointHealingPlan(31)).toEqual({ dice: 6, fixed: 0 });
  });

  it("derives rescue and elapsed-time skill-loss boundaries", () => {
    expect(firstEditionBodyPointRescueMinimum(31)).toBe(4);
    expect(firstEditionBodyPointSkillLossDice(4)).toBe(0);
    expect(firstEditionBodyPointSkillLossDice(10)).toBe(1);
    expect(firstEditionBodyPointSkillLossDice(15)).toBe(2);
    expect(firstEditionBodyPointSkillLossDice(16)).toBeNull();
  });
});
