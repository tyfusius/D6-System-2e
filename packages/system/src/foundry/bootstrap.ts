import { createD6System2eApi } from "../api/create-api";
import { SYSTEM_NAME } from "../constants";
import { registerRulesCompatibilitySettings } from "../settings/rules-compatibility";
import { registerD6System2eDataModels } from "./data-models/register";
import { registerMigrationMetadataHooks } from "./migration-metadata";
import { migrateD6System2eWorld } from "./migrate-world";
import { registerMechanicalEditGuards } from "./mechanical-edit-guard";
import { registerD6System2eSheets } from "./sheets/register";

let initialized = false;

export function initializeD6System2e(): void {
  if (initialized) return;
  registerD6System2eDataModels();
  registerRulesCompatibilitySettings();
  registerMigrationMetadataHooks();
  registerMechanicalEditGuards();
  registerD6System2eSheets();
  const api = createD6System2eApi();
  game.system.api = api;
  console.info(
    `${SYSTEM_NAME} | Initialized foundation API v${api.apiVersion}; schema ${api.migrations.latestSchemaVersion}`,
  );
  initialized = true;
}

export async function readyD6System2e(): Promise<void> {
  initializeD6System2e();
  await migrateD6System2eWorld();
  console.info(`${SYSTEM_NAME} | Ready`);
}
