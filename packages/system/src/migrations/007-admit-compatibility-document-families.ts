import type { Migration } from "@d6-system-2e/core";

export const admitCompatibilityDocumentFamiliesMigration: Migration =
  Object.freeze({
    name: "Admit NPC, creature, and OpenD6-compatible Item families",
    version: 7,
  });
