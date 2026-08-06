const lockedActors = new Map<string, string>();

const REACTION_SKILL_KEYS = new Set([
  "brawling",
  "brawling-parry",
  "dodge",
  "melee-combat",
  "melee-parry",
  "parry",
]);

export function lockCombinedActionParticipants(
  groupId: string,
  actorIds: readonly string[],
): void {
  for (const actorId of actorIds) lockedActors.set(actorId, groupId);
}

export function unlockCombinedActionParticipants(groupId: string): void {
  for (const [actorId, lockedGroupId] of lockedActors) {
    if (lockedGroupId === groupId) lockedActors.delete(actorId);
  }
}

export function combinedActionBlocksRoll(
  actor: FoundryActorDocument,
  kind: string,
  itemId?: string,
  authorizedGroupId?: string,
): boolean {
  const groupId = lockedActors.get(actor.id);
  if (!groupId || groupId === authorizedGroupId) return false;
  if (kind === "resistance") return false;
  if (kind !== "skill" || !itemId) return true;
  const item = actor.items.get(itemId);
  const skillKey = item?.system.key;
  return typeof skillKey !== "string" || !REACTION_SKILL_KEYS.has(skillKey);
}

export function resetCombinedActionStateForTests(): void {
  lockedActors.clear();
}
