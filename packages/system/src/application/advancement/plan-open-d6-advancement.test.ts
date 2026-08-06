import { describe, expect, it } from "vitest";
import { planOpenD6Advancement } from "./plan-open-d6-advancement";

const multipliers = {
  attribute: 10,
  skill: 1,
  specialization: 0.5,
};

describe("OpenD6 advancement plan", () => {
  it("produces an affordable one-pip skill purchase", () => {
    expect(planOpenD6Advancement("skill", 10, 5, multipliers)).toEqual({
      affordable: true,
      cost: 3,
      currentCharacterPoints: 5,
      currentScore: 10,
      kind: "skill",
      nextCharacterPoints: 2,
      nextScore: 11,
    });
  });

  it("reports insufficient Character Points without a negative balance", () => {
    const plan = planOpenD6Advancement("attribute", 10, 4, multipliers);
    expect(plan.affordable).toBe(false);
    expect(plan.cost).toBe(30);
    expect(plan.nextCharacterPoints).toBe(0);
  });
});
