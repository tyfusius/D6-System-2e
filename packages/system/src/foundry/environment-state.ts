import {
  D6_ENVIRONMENT_EFFECT_VERSION,
  isSecondEditionCondition,
  type D6EnvironmentEffectV1,
  type D6EnvironmentHazard,
  type D6EnvironmentSeverity,
} from "@d6-system-2e/core";
import { record } from "./sheets/values";

const HAZARDS: readonly D6EnvironmentHazard[] = [
  "cold",
  "drowning",
  "heat",
  "poisonous-air",
];
const SEVERITIES: readonly D6EnvironmentSeverity[] = [
  "moderate",
  "severe",
  "deadly",
];

export function readActorEnvironmentEffect(actor: {
  readonly system: Readonly<Record<string, unknown>>;
}): D6EnvironmentEffectV1 | null {
  const value = record(actor.system.environment);
  const hazard = value.hazard;
  const severity = value.severity;
  const previousCondition = value.previousCondition;
  const appliedCondition = value.appliedCondition;
  const difficulty = Number(value.difficulty);
  const penaltyScore = Number(value.penaltyScore);
  const sourcePage = Number(value.sourcePage);
  if (
    value.active !== true ||
    value.version !== D6_ENVIRONMENT_EFFECT_VERSION ||
    !HAZARDS.includes(hazard as D6EnvironmentHazard) ||
    !SEVERITIES.includes(severity as D6EnvironmentSeverity) ||
    !isSecondEditionCondition(previousCondition) ||
    !(
      appliedCondition === "none" || isSecondEditionCondition(appliedCondition)
    ) ||
    !([15, 20, 30] as const).includes(difficulty as 15 | 20 | 30) ||
    !([0, 3, 6] as const).includes(penaltyScore as 0 | 3 | 6) ||
    !([77, 78] as const).includes(sourcePage as 77 | 78)
  ) {
    return null;
  }
  return Object.freeze({
    active: true,
    appliedCondition,
    difficulty: difficulty as 15 | 20 | 30,
    halfMove: value.halfMove === true,
    hazard: hazard as D6EnvironmentHazard,
    penaltyScore: penaltyScore as 0 | 3 | 6,
    previousCondition,
    severity: severity as D6EnvironmentSeverity,
    sourcePage: sourcePage as 77 | 78,
    version: D6_ENVIRONMENT_EFFECT_VERSION,
  });
}

export const CLEAR_ENVIRONMENT_EFFECT = Object.freeze({
  "system.environment.active": false,
  "system.environment.appliedCondition": "none",
  "system.environment.difficulty": 0,
  "system.environment.halfMove": false,
  "system.environment.hazard": "none",
  "system.environment.penaltyScore": 0,
  "system.environment.previousCondition": "healthy",
  "system.environment.severity": "none",
  "system.environment.sourcePage": 0,
  "system.environment.version": D6_ENVIRONMENT_EFFECT_VERSION,
});
