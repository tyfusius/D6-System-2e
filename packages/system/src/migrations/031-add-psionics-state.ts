import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function addPsionicsState(source: ActorSource): void {
  if (!["character", "creature", "npc"].includes(source.type)) return;
  const current = record(source.system.psionics) ?? {};
  const attempts = Array.isArray(current.attempts)
    ? current.attempts.flatMap((value) => {
        const attempt = record(value);
        const powerId =
          typeof attempt?.powerId === "string" ? attempt.powerId : "";
        const worldTime = Number(attempt?.worldTime);
        return powerId && Number.isFinite(worldTime) && worldTime >= 0
          ? [{ powerId, worldTime }]
          : [];
      })
    : [];
  source.system.psionics = { attempts };
}

export const addPsionicsStateMigration: Migration = Object.freeze({
  name: "Add Psionics attempt state",
  updateActor: addPsionicsState,
  version: 31,
});
