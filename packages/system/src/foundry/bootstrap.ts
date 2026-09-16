import { registerBodyPointRootLifecycle } from "./first-edition-body-point-root";
import { registerBodyPointRootSocket } from "./first-edition-body-point-authority";
import { registerWoundRootSocket } from "./first-edition-wound-authority";
import { registerMovementMessageVisibility } from "./first-edition-movement-visibility";
import { registerWoundRootLifecycle } from "./first-edition-wound-root";
import { registerMedicalConsumableLifecycle } from "./medical-consumable-root";
import { registerMedicalConsumableSocket } from "./medical-consumable-authority";
import { registerMedicalConsumableHooks } from "./medical-consumable-hooks";
import { registerRelativeMovementLifecycle } from "./first-edition-relative-movement";
import { registerDestinyPending } from "./destiny-pending";
import { registerDestinyService } from "./destiny-service";
import { registerDestinyUI } from "./destiny-ui";
import { createD6System2eApi } from "../api/create-api";
import { SYSTEM_NAME } from "../constants";
import {
  applySelectedTheme,
  logSettingsProfile,
  registerSystemSettings,
} from "../settings/system-settings";
import { registerActorCreationDefaults } from "./actor-defaults";
import { registerActorPortraitPermissions } from "./actor-portrait-permissions";
import { registerD6System2eDataModels } from "./data-models/register";
import { registerMigrationMetadataHooks } from "./migration-metadata";
import { migrateD6System2eWorld } from "./migrate-world";
import { registerMechanicalEditGuards } from "./mechanical-edit-guard";
import { registerD6System2eSheets } from "./sheets/register";
import { registerRollChatCardActions } from "./rolls/chat-card-actions";
import { registerD6OrdinaryAttackThreadLifecycle } from "./rolls/ordinary-attack-thread";
import { registerDamageResolutionChatActions } from "./rolls/damage-resolution";
import { registerRollAuthoritySocket } from "./rolls/roll-authority";
import { registerCombatHooks } from "./combat-hooks";
import { registerCombatRoundGrid } from "./combat-round-grid";
import { registerSuperheroicRelationshipHooks } from "./superheroic-relationships-service";
import {
  registerAlternateInitiativeSocket,
  registerD6CombatDocuments,
} from "./combat-documents";
import { registerD6System2eDiceTerms } from "./dice-terms";
import { registerDiceSoNiceIntegration } from "./dice-so-nice";
import { registerManualRollPresentation } from "./manual-roll-presentation";
import { registerD6System2eQuickbars } from "./quickbars";
import { registerD6ChaseSocket } from "./chase-service";
import { registerEconomySocket } from "./economy-service";
import { registerD6ChaseTracker } from "./chase-tracker";
import { registerD6EnvironmentManager } from "./environment-manager";
import { registerEquipmentDefaults } from "./equipment-defaults";
import { registerBaseEquipmentCatalog } from "../registries/equipment";
import { registerBaseCharacterTemplateCatalog } from "../registries/character-templates";
import { registerBaseBestiaryCatalog } from "../registries/bestiary";
import { registerBasePsionicPowerCatalog } from "../registries/psionics";
import { registerBaseFeatureCatalog } from "../registries/feature-catalogs";
import { registerD6BestiaryBrowser } from "./bestiary-browser";
import { registerBaseHideoutFeatureCatalog } from "../registries/hideout-features";
import {
  refreshExistingDocumentDefaultImages,
  registerDocumentDefaultImages,
} from "./document-default-images";
import {
  detonateD6ExplosiveRegion,
  presentD6ExplosiveDeviation,
  registerD6ExplosiveLifecycle,
} from "./explosives/explosive-service";
import { registerD6ExplosiveRegionSocket } from "./explosives/explosive-region";
import { registerGridStorageState } from "./grid-storage-state";
import { registerGridStorageSocket } from "./grid-storage-authority";
import {
  recoverGridStorageOperations,
  registerGridStorageOperationService,
} from "./grid-storage-operation-service";
import { registerGridStorageMutationGuards } from "./grid-storage-mutation-guard";
import { registerGridStorageViewRefresh } from "./grid-storage-application";

let initialized = false;

export function initializeD6System2e(): void {
  if (initialized) return;
  registerMovementMessageVisibility();
  registerD6System2eDataModels();
  registerD6System2eDiceTerms();
  registerDiceSoNiceIntegration();
  registerD6System2eQuickbars();
  registerD6ChaseTracker();
  registerD6EnvironmentManager();
  registerD6BestiaryBrowser();
  registerSystemSettings();
  registerDestinyService();
  registerDestinyUI();
  registerDestinyPending();
  registerActorPortraitPermissions();
  registerActorCreationDefaults();
  registerDocumentDefaultImages();
  registerMigrationMetadataHooks();
  registerEquipmentDefaults();
  registerBaseEquipmentCatalog();
  registerBaseCharacterTemplateCatalog();
  registerBaseBestiaryCatalog();
  registerBasePsionicPowerCatalog();
  registerBaseFeatureCatalog();
  registerBaseHideoutFeatureCatalog();
  registerMechanicalEditGuards();
  registerD6CombatDocuments();
  registerCombatHooks();
  registerCombatRoundGrid();
  registerSuperheroicRelationshipHooks();
  registerD6ExplosiveLifecycle();
  registerRelativeMovementLifecycle();
  registerWoundRootLifecycle();
  registerBodyPointRootLifecycle();
  registerMedicalConsumableLifecycle();
  registerMedicalConsumableHooks();
  registerGridStorageState();
  registerGridStorageOperationService();
  registerGridStorageMutationGuards();
  registerGridStorageViewRefresh();
  registerManualRollPresentation();
  registerRollChatCardActions();
  registerD6OrdinaryAttackThreadLifecycle();
  registerDamageResolutionChatActions();
  Hooks.once("ready", () => {
    registerRollAuthoritySocket();
    registerWoundRootSocket();
    registerBodyPointRootSocket();
    registerMedicalConsumableSocket();
    registerGridStorageSocket();
    void recoverGridStorageOperations();
    registerD6ChaseSocket();
    registerEconomySocket();
    registerAlternateInitiativeSocket();
    registerD6ExplosiveRegionSocket(
      detonateD6ExplosiveRegion,
      presentD6ExplosiveDeviation,
    );
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
  await refreshExistingDocumentDefaultImages();
  applySelectedTheme();
  logSettingsProfile();
  console.info(`${SYSTEM_NAME} | Ready`);
}
