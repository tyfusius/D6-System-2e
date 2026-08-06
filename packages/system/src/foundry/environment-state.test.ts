import { describe, expect, it } from "vitest";
import {
  CLEAR_ENVIRONMENT_EFFECT,
  readActorEnvironmentEffect,
} from "./environment-state";

describe("environment effect persistence", () => {
  it("reads a complete versioned effect", () => {
    const effect = readActorEnvironmentEffect({
      system: {
        environment: {
          active: true,
          appliedCondition: "wounded",
          difficulty: 20,
          halfMove: true,
          hazard: "cold",
          penaltyScore: 6,
          previousCondition: "healthy",
          severity: "severe",
          sourcePage: 77,
          version: 1,
        },
      },
    });
    expect(effect).toMatchObject({
      hazard: "cold",
      penaltyScore: 6,
      previousCondition: "healthy",
      severity: "severe",
    });
    expect(Object.isFrozen(effect)).toBe(true);
  });

  it("rejects partial or invalid state and exposes a complete clear update", () => {
    expect(
      readActorEnvironmentEffect({
        system: { environment: { active: true, hazard: "cold", version: 1 } },
      }),
    ).toBeNull();
    expect(CLEAR_ENVIRONMENT_EFFECT).toMatchObject({
      "system.environment.active": false,
      "system.environment.hazard": "none",
      "system.environment.penaltyScore": 0,
      "system.environment.version": 1,
    });
  });
});
