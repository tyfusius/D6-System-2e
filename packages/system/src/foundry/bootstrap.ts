import { createD6System2eApi } from "../api/create-api";
import { SYSTEM_NAME } from "../constants";
import {
  applySelectedTheme,
  logSettingsProfile,
  registerSystemSettings,
} from "../settings/system-settings";
import { registerActorCreationDefaults } from "./actor-defaults";
import { registerD6System2eDataModels } from "./data-models/register";
import { registerMigrationMetadataHooks } from "./migration-metadata";
import { migrateD6System2eWorld } from "./migrate-world";
import { registerMechanicalEditGuards } from "./mechanical-edit-guard";
import { registerD6System2eSheets } from "./sheets/register";
import { registerRollChatCardActions } from "./rolls/chat-card-actions";
import { registerDamageResolutionChatActions } from "./rolls/damage-resolution";
import { registerRollAuthoritySocket } from "./rolls/roll-authority";
import { registerCombatHooks } from "./combat-hooks";
import { registerD6CombatDocuments } from "./combat-documents";
import { registerD6System2eDiceTerms } from "./dice-terms";
import { registerDiceSoNiceIntegration } from "./dice-so-nice";
import { registerD6System2eQuickbars } from "./quickbars";
import { registerD6ChaseSocket } from "./chase-service";
import { registerD6ChaseTracker } from "./chase-tracker";
import { registerD6EnvironmentManager } from "./environment-manager";

let initialized = false;

export function initializeD6System2e(): void {
  if (initialized) return;
  registerD6System2eDataModels();
  registerD6System2eDiceTerms();
  registerDiceSoNiceIntegration();
  registerD6System2eQuickbars();
  registerD6ChaseTracker();
  registerD6EnvironmentManager();
  registerSystemSettings();
  registerActorCreationDefaults();
  registerMigrationMetadataHooks();
  registerMechanicalEditGuards();
  registerD6CombatDocuments();
  registerCombatHooks();
  registerRollChatCardActions();
  registerDamageResolutionChatActions();
  Hooks.once("ready", () => {
    registerRollAuthoritySocket();
    registerD6ChaseSocket();
  });
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
  applySelectedTheme();
  logSettingsProfile();
  console.info(`${SYSTEM_NAME} | Ready`);
}
