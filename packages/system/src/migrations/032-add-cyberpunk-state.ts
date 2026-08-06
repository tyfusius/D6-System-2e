import type { ActorSource, ItemSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function whole(value: unknown): number {
  const number = Number(value);
  return Number.isSafeInteger(number) ? Math.max(0, number) : 0;
}

export function addCyberpunkState(source: ActorSource): void {
  if (!["character", "creature", "npc"].includes(source.type)) return;
  const current = record(source.system.cyberpunk);
  const hardening = record(current.hardening);
  source.system.cyberpunk = {
    hardening: {
      combatId:
        typeof hardening.combatId === "string" ? hardening.combatId : "",
      untilRound: whole(hardening.untilRound),
      untilTurn: whole(hardening.untilTurn),
    },
  };
}

export function addCyberneticProfile(source: ItemSource): void {
  if (source.type !== "cybernetic") return;
  const installation = record(source.system.installation);
  const disabled = record(source.system.disabled);
  source.system.augmentationKind =
    source.system.augmentationKind === "bioware" ? "bioware" : "cyberware";
  source.system.linkedTalentId =
    typeof source.system.linkedTalentId === "string"
      ? source.system.linkedTalentId
      : "";
  source.system.rank = Math.max(1, whole(source.system.rank));
  source.system.installed = source.system.installed === true;
  source.system.installation = {
    difficulty: whole(installation.difficulty),
    installerName:
      typeof installation.installerName === "string"
        ? installation.installerName
        : "",
    minutes: whole(installation.minutes),
    previousCount: whole(installation.previousCount),
  };
  source.system.disabled = {
    combatId: typeof disabled.combatId === "string" ? disabled.combatId : "",
    untilRound: whole(disabled.untilRound),
    untilTurn: whole(disabled.untilTurn),
  };
}

export const addCyberpunkStateMigration: Migration = Object.freeze({
  name: "Add Cyberpunk actor and augmentation state",
  updateActor: addCyberpunkState,
  updateItem: addCyberneticProfile,
  version: 32,
});
