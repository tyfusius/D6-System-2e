import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

const CONSCIOUSNESS = new Set(["conscious", "unconscious", "unresolved"]);
const SOURCES = new Set(["none", "stun", "incapacitated", "mortally-wounded"]);
const STUN_WOUNDS = new Set([
  "none",
  "stunned",
  "wounded",
  "severely-wounded",
  "incapacitated",
]);

function nonNegativeInteger(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

export function addFirstEditionInjuryState(source: ActorSource): void {
  if (!["character", "creature", "npc"].includes(source.type)) return;
  const health = record(source.system.health) ?? {};
  const existing = record(health.firstEditionState) ?? {};
  const wound = health.firstEditionWound;
  const inferredConsciousness =
    wound === "mortally-wounded"
      ? "unconscious"
      : wound === "incapacitated"
        ? "unresolved"
        : "conscious";
  const inferredSource =
    wound === "mortally-wounded"
      ? "mortally-wounded"
      : wound === "incapacitated"
        ? "incapacitated"
        : "none";
  source.system.health = {
    ...health,
    firstEditionState: {
      consciousness:
        typeof existing.consciousness === "string" &&
        CONSCIOUSNESS.has(existing.consciousness)
          ? existing.consciousness
          : inferredConsciousness,
      source:
        typeof existing.source === "string" && SOURCES.has(existing.source)
          ? existing.source
          : inferredSource,
      stunWound:
        typeof existing.stunWound === "string" &&
        STUN_WOUNDS.has(existing.stunWound)
          ? existing.stunWound
          : "none",
      unconsciousMinutes: nonNegativeInteger(existing.unconsciousMinutes),
    },
  };
}

export const addFirstEditionInjuryStateMigration: Migration = Object.freeze({
  name: "Add First Edition stun and consciousness state",
  updateActor: addFirstEditionInjuryState,
  version: 18,
});
