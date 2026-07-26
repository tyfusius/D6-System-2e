import { MigrationRunner } from "@d6-system-2e/core";
import schemaVersion from "../../../../schema-version.json";
import { initializeSchemaMigration } from "./001-initialize-schema";
import { addCharacterSheetModeMigration } from "./002-add-character-sheet-mode";
import { canonicalPipScoresMigration } from "./003-canonical-pip-scores";
import { addFirstEditionResourcesMigration } from "./004-add-first-edition-resources";

export const migrations = Object.freeze([
  initializeSchemaMigration,
  addCharacterSheetModeMigration,
  canonicalPipScoresMigration,
  addFirstEditionResourcesMigration,
]);
export const migrationRunner = new MigrationRunner(migrations);

if (migrationRunner.latestVersion !== schemaVersion.latest) {
  throw new Error(
    `Latest migration ${migrationRunner.latestVersion} does not match schema-version.json ${schemaVersion.latest}.`,
  );
}
