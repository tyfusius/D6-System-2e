import type { ActorSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function crewMembers(value: unknown): readonly Record<string, string>[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((entry) => {
    const member = record(entry);
    const actorId =
      typeof member?.actorId === "string" ? member.actorId.trim() : "";
    if (!actorId || seen.has(actorId)) return [];
    seen.add(actorId);
    return [
      {
        actorId,
        name: typeof member?.name === "string" ? member.name.trim() : "",
      },
    ];
  });
}

export function addMachineCrews(source: ActorSource): void {
  if (!["starship", "vehicle"].includes(source.type)) return;
  const crew = record(source.system.crew) ?? {};
  source.system.crew = {
    ...crew,
    members: crewMembers(crew.members),
  };
}

export const addMachineCrewsMigration: Migration = Object.freeze({
  name: "Add persistent vehicle and starship crew rosters",
  updateActor: addMachineCrews,
  version: 15,
});
