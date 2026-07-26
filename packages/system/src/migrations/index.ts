import { MigrationRunner } from "@d6-system-2e/core";
import schemaVersion from "../../../../schema-version.json";
import { initializeSchemaMigration } from "./001-initialize-schema";

export const migrations = Object.freeze([initializeSchemaMigration]);
export const migrationRunner = new MigrationRunner(migrations);

if (migrationRunner.latestVersion !== schemaVersion.latest) {
  throw new Error(
    `Latest migration ${migrationRunner.latestVersion} does not match schema-version.json ${schemaVersion.latest}.`,
  );
}
