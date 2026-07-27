export function handleCombatUpdate(_combat: unknown, changes: unknown): void {
  if (
    typeof changes !== "object" ||
    changes === null ||
    !Object.hasOwn(changes, "round")
  ) {
    return;
  }
  for (const actor of game.actors?.contents ?? []) {
    actor.sheet.render(false);
  }
}

export function registerCombatHooks(): void {
  Hooks.on("updateCombat", handleCombatUpdate);
}
