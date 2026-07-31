import {
  isSecondEditionCondition,
  type SecondEditionCondition,
} from "./combat";

export const D6_ENVIRONMENT_EFFECT_VERSION = 1 as const;

export type D6EnvironmentHazard =
  "cold" | "drowning" | "heat" | "poisonous-air";
export type D6EnvironmentSeverity = "moderate" | "severe" | "deadly";

export interface D6EnvironmentThreat {
  readonly difficulty: 15 | 20 | 30;
  readonly halfMove: boolean;
  readonly hazard: D6EnvironmentHazard;
  readonly penaltyScore: 0 | 3 | 6;
  readonly severity: D6EnvironmentSeverity;
  readonly sourcePage: 77 | 78;
}

export interface D6EnvironmentEffectV1 extends D6EnvironmentThreat {
  readonly active: true;
  readonly appliedCondition: SecondEditionCondition | "none";
  readonly previousCondition: SecondEditionCondition;
  readonly version: typeof D6_ENVIRONMENT_EFFECT_VERSION;
}

export interface D6EnvironmentFailureResolution {
  readonly effect: D6EnvironmentEffectV1;
  readonly nextCondition: SecondEditionCondition;
}

const THREATS = Object.freeze({
  cold: Object.freeze({
    deadly: Object.freeze({ difficulty: 30, halfMove: false, penaltyScore: 0 }),
    moderate: Object.freeze({
      difficulty: 15,
      halfMove: true,
      penaltyScore: 3,
    }),
    severe: Object.freeze({ difficulty: 20, halfMove: false, penaltyScore: 6 }),
  }),
  heat: Object.freeze({
    deadly: Object.freeze({ difficulty: 30, halfMove: false, penaltyScore: 0 }),
    moderate: Object.freeze({
      difficulty: 15,
      halfMove: false,
      penaltyScore: 3,
    }),
    severe: Object.freeze({ difficulty: 20, halfMove: false, penaltyScore: 6 }),
  }),
  "poisonous-air": Object.freeze({
    deadly: Object.freeze({ difficulty: 30, halfMove: false, penaltyScore: 0 }),
    moderate: Object.freeze({
      difficulty: 15,
      halfMove: false,
      penaltyScore: 3,
    }),
    severe: Object.freeze({ difficulty: 20, halfMove: false, penaltyScore: 0 }),
  }),
} as const);

export function environmentThreat(
  hazard: D6EnvironmentHazard,
  severity: D6EnvironmentSeverity,
): D6EnvironmentThreat {
  if (hazard === "drowning") {
    return Object.freeze({
      difficulty: 15,
      halfMove: false,
      hazard,
      penaltyScore: 0,
      severity: "moderate",
      sourcePage: 77,
    });
  }
  const threat = THREATS[hazard][severity];
  return Object.freeze({
    ...threat,
    hazard,
    severity,
    sourcePage: hazard === "cold" ? 77 : 78,
  });
}

function drowningFailure(
  condition: SecondEditionCondition,
): SecondEditionCondition {
  if (condition === "dead") return "dead";
  if (condition === "mortally-wounded") return "dead";
  if (condition === "incapacitated") return "mortally-wounded";
  return "incapacitated";
}

function directCondition(
  threat: D6EnvironmentThreat,
): SecondEditionCondition | null {
  if (threat.hazard === "drowning") return null;
  if (threat.severity === "deadly") return "mortally-wounded";
  if (threat.hazard === "poisonous-air" && threat.severity === "severe") {
    return "incapacitated";
  }
  return null;
}

export function resolveEnvironmentFailure(
  threat: D6EnvironmentThreat,
  currentCondition: SecondEditionCondition,
): D6EnvironmentFailureResolution {
  const previousCondition = isSecondEditionCondition(currentCondition)
    ? currentCondition
    : "healthy";
  const nextCondition =
    threat.hazard === "drowning"
      ? drowningFailure(previousCondition)
      : (directCondition(threat) ?? previousCondition);
  return Object.freeze({
    effect: Object.freeze({
      ...threat,
      active: true,
      appliedCondition:
        nextCondition === previousCondition ? "none" : nextCondition,
      previousCondition,
      version: D6_ENVIRONMENT_EFFECT_VERSION,
    }),
    nextCondition,
  });
}

export function severeEnvironmentPromotesStunned(
  effect: D6EnvironmentEffectV1 | null,
): boolean {
  return (
    effect?.active === true &&
    effect.severity === "severe" &&
    (effect.hazard === "cold" || effect.hazard === "heat")
  );
}

export function recoverEnvironmentCondition(
  effect: D6EnvironmentEffectV1,
  currentCondition: SecondEditionCondition,
): SecondEditionCondition {
  if (effect.appliedCondition === "none") return currentCondition;
  return currentCondition === effect.appliedCondition
    ? effect.previousCondition
    : currentCondition;
}

export function environmentBreathRounds(staminaScore: number): number {
  if (!Number.isFinite(staminaScore)) return 1;
  return Math.max(1, Math.floor(Math.max(0, staminaScore) / 3));
}
