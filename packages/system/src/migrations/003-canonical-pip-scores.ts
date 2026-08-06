import type { ActorSource, ItemSource, Migration } from "@d6-system-2e/core";

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function integer(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && Number(value) >= 0
    ? Number(value)
    : undefined;
}

function convertLegacyDieCode(container: Record<string, unknown>): void {
  if (integer(container.score) !== undefined) return;
  const hasDice = Object.hasOwn(container, "dice");
  const hasPips = Object.hasOwn(container, "pips");
  const dice = integer(container.dice);
  const pips = integer(container.pips);
  if (
    (!hasDice && !hasPips) ||
    (hasDice && dice === undefined) ||
    (hasPips && pips === undefined)
  ) {
    return;
  }

  container.score = (dice ?? 0) * 3 + (pips ?? 0);
  delete container.dice;
  delete container.pips;
}

export function convertLegacyAttributeScores(
  system: Record<string, unknown>,
): void {
  const attributes = record(system.attributes);
  if (!attributes) return;
  for (const attribute of Object.values(attributes)) {
    const value = record(attribute);
    if (value) convertLegacyDieCode(value);
  }
}

export function convertLegacySkillScore(system: Record<string, unknown>): void {
  if (integer(system.score) !== undefined) return;
  const rating = record(system.rating);
  if (!rating) return;

  convertLegacyDieCode(rating);
  const score = integer(rating.score);
  if (score === undefined) return;
  system.score = score;
  delete rating.score;
  if (Object.keys(rating).length === 0) delete system.rating;
}

export const canonicalPipScoresMigration: Migration = Object.freeze({
  name: "Store attributes and skills as canonical integer pip scores",
  updateActor: (source: ActorSource): void => {
    convertLegacyAttributeScores(source.system);
  },
  updateItem: (source: ItemSource): void => {
    if (source.type === "skill") convertLegacySkillScore(source.system);
  },
  version: 3,
});
