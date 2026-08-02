import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function whole(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isSafeInteger(number) ? Math.max(0, number) : fallback;
}

export function addSuperheroicState(source: ActorSource): void {
  if (!["character", "creature", "npc"].includes(source.type)) return;
  const superheroic = record(source.system.superheroic);
  const identity = record(superheroic.secretIdentity);
  const status = ["active", "exposed", "public"].includes(text(identity.status))
    ? text(identity.status)
    : "active";
  source.system.superheroic = {
    secretIdentity: {
      heroicIdentity: text(identity.heroicIdentity),
      heroPoints: Math.min(3, whole(identity.heroPoints, 1)),
      secretIdentity: text(identity.secretIdentity),
      status,
      suspicion: whole(identity.suspicion),
    },
  };
}

export const addSuperheroicStateMigration: Migration = Object.freeze({
  name: "Add superheroic secret identity state",
  updateActor: addSuperheroicState,
  version: 33,
});
