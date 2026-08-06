import type { ActorSource, Migration } from "@d6-system-2e/core";

function addCharacterSheetMode(source: ActorSource): void {
  if (source.type !== "character" || source.system.sheetMode !== undefined) {
    return;
  }
  source.system.sheetMode = { value: "normal" };
}

export const addCharacterSheetModeMigration: Migration = Object.freeze({
  name: "Add the persistent character sheet mode",
  updateActor: addCharacterSheetMode,
  version: 2,
});
