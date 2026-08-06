import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function choice<T extends string>(
  value: unknown,
  choices: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && choices.includes(value as T)
    ? (value as T)
    : fallback;
}

export function addEnvironmentEffects(source: ActorSource): void {
  if (!["character", "creature", "npc"].includes(source.type)) return;
  const environment = record(source.system.environment) ?? {};
  source.system.environment = {
    ...environment,
    active: environment.active === true,
    appliedCondition: choice(
      environment.appliedCondition,
      [
        "none",
        "healthy",
        "staggered",
        "stunned",
        "wounded",
        "incapacitated",
        "mortally-wounded",
        "dead",
      ],
      "none",
    ),
    difficulty: [15, 20, 30].includes(Number(environment.difficulty))
      ? Number(environment.difficulty)
      : 0,
    halfMove: environment.halfMove === true,
    hazard: choice(
      environment.hazard,
      ["none", "cold", "drowning", "heat", "poisonous-air"],
      "none",
    ),
    penaltyScore: [3, 6].includes(Number(environment.penaltyScore))
      ? Number(environment.penaltyScore)
      : 0,
    previousCondition: choice(
      environment.previousCondition,
      [
        "healthy",
        "staggered",
        "stunned",
        "wounded",
        "incapacitated",
        "mortally-wounded",
        "dead",
      ],
      "healthy",
    ),
    severity: choice(
      environment.severity,
      ["none", "moderate", "severe", "deadly"],
      "none",
    ),
    sourcePage:
      environment.sourcePage === 78
        ? 78
        : environment.sourcePage === 77
          ? 77
          : 0,
    version: 1,
  };
}

export const addEnvironmentEffectsMigration: Migration = Object.freeze({
  name: "Add Second Edition environment effects",
  updateActor: addEnvironmentEffects,
  version: 20,
});
