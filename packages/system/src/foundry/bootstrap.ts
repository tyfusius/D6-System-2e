import { createD6System2eApi } from "../api/create-api";
import { SYSTEM_NAME } from "../constants";
import { registerD6System2eDataModels } from "./data-models/register";
import { registerMigrationMetadataHooks } from "./migration-metadata";
import { registerD6System2eSheets } from "./sheets/register";

let initialized = false;

export function initializeD6System2e(): void {
  if (initialized) return;
  registerD6System2eDataModels();
  registerMigrationMetadataHooks();
  registerD6System2eSheets();
  const api = createD6System2eApi();
  game.system.api = api;
  console.info(
    `${SYSTEM_NAME} | Initialized foundation API v${api.apiVersion}; schema ${api.migrations.latestSchemaVersion}`,
  );
  initialized = true;
}

export function readyD6System2e(): void {
  initializeD6System2e();
  console.info(`${SYSTEM_NAME} | Ready`);
}
