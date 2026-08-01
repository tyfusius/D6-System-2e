import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function nonNegativeInteger(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

export function addFirstEditionAccumulatingStuns(source: ActorSource): void {
  if (!["character", "creature", "npc"].includes(source.type)) return;
  const health = record(source.system.health) ?? {};
  const legacy =
    record(health.firstEditionStuns) ??
    record(health.stuns) ??
    record(health.stunDamage) ??
    {};
  const roundsRemaining = nonNegativeInteger(
    legacy.roundsRemaining ?? legacy.rounds,
  );
  source.system.health = {
    ...health,
    firstEditionStuns: {
      version: 1,
      total: nonNegativeInteger(legacy.total ?? legacy.value),
      penaltyDice:
        roundsRemaining > 0
          ? Math.min(
              2,
              nonNegativeInteger(legacy.penaltyDice ?? legacy.current),
            )
          : 0,
      roundsRemaining,
      lastProcessedRoundId:
        typeof legacy.lastProcessedRoundId === "string"
          ? legacy.lastProcessedRoundId
          : "",
    },
  };
}

export const addFirstEditionAccumulatingStunsMigration: Migration =
  Object.freeze({
    name: "Add First Edition Accumulating Stuns",
    updateActor: addFirstEditionAccumulatingStuns,
    version: 24,
  });
