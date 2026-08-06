import { describe, expect, it } from "vitest";
import {
  environmentBreathRounds,
  environmentThreat,
  recoverEnvironmentCondition,
  resolveEnvironmentFailure,
  severeEnvironmentPromotesStunned,
} from "./environment";

describe("Second Edition environments", () => {
  it("maps every printed threat to its fixed difficulty and effect", () => {
    expect(environmentThreat("cold", "moderate")).toMatchObject({
      difficulty: 15,
      halfMove: true,
      penaltyScore: 3,
      sourcePage: 77,
    });
    expect(environmentThreat("heat", "severe")).toMatchObject({
      difficulty: 20,
      penaltyScore: 6,
      sourcePage: 78,
    });
    expect(environmentThreat("poisonous-air", "severe")).toMatchObject({
      difficulty: 20,
      penaltyScore: 0,
      sourcePage: 78,
    });
    expect(environmentThreat("drowning", "deadly")).toMatchObject({
      difficulty: 15,
      severity: "moderate",
      sourcePage: 77,
    });
  });

  it("applies printed penalties and direct conditions without stacking", () => {
    expect(
      resolveEnvironmentFailure(
        environmentThreat("cold", "moderate"),
        "healthy",
      ),
    ).toMatchObject({
      effect: { appliedCondition: "none", halfMove: true, penaltyScore: 3 },
      nextCondition: "healthy",
    });
    expect(
      resolveEnvironmentFailure(
        environmentThreat("poisonous-air", "severe"),
        "wounded",
      ),
    ).toMatchObject({
      effect: {
        appliedCondition: "incapacitated",
        previousCondition: "wounded",
      },
      nextCondition: "incapacitated",
    });
  });

  it("progresses drowning failures through the printed three outcomes", () => {
    const threat = environmentThreat("drowning", "moderate");
    expect(resolveEnvironmentFailure(threat, "healthy").nextCondition).toBe(
      "incapacitated",
    );
    expect(
      resolveEnvironmentFailure(threat, "incapacitated").nextCondition,
    ).toBe("mortally-wounded");
    expect(
      resolveEnvironmentFailure(threat, "mortally-wounded").nextCondition,
    ).toBe("dead");
  });

  it("promotes Stunned only for active severe cold or heat", () => {
    const severe = resolveEnvironmentFailure(
      environmentThreat("cold", "severe"),
      "healthy",
    ).effect;
    const moderate = resolveEnvironmentFailure(
      environmentThreat("heat", "moderate"),
      "healthy",
    ).effect;
    expect(severeEnvironmentPromotesStunned(severe)).toBe(true);
    expect(severeEnvironmentPromotesStunned(moderate)).toBe(false);
  });

  it("restores only the condition caused by the same active effect", () => {
    const effect = resolveEnvironmentFailure(
      environmentThreat("heat", "deadly"),
      "wounded",
    ).effect;
    expect(recoverEnvironmentCondition(effect, "mortally-wounded")).toBe(
      "wounded",
    );
    expect(recoverEnvironmentCondition(effect, "dead")).toBe("dead");
  });

  it("derives whole safe breath rounds from the Stamina die code", () => {
    expect(environmentBreathRounds(11)).toBe(3);
    expect(environmentBreathRounds(0)).toBe(1);
  });
});
