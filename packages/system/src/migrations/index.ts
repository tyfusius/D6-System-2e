import { MigrationRunner } from "@d6-system-2e/core";
import schemaVersion from "../../../../schema-version.json";
import { initializeSchemaMigration } from "./001-initialize-schema";
import { addCharacterSheetModeMigration } from "./002-add-character-sheet-mode";
import { canonicalPipScoresMigration } from "./003-canonical-pip-scores";
import { addFirstEditionResourcesMigration } from "./004-add-first-edition-resources";
import { admitCoreItemFamiliesMigration } from "./005-admit-core-item-families";
import { addSecondEditionCombatStateMigration } from "./006-add-second-edition-combat-state";
import { admitCompatibilityDocumentFamiliesMigration } from "./007-admit-compatibility-document-families";
import { addCharacterCreationAndSkillLinksMigration } from "./008-add-character-creation-and-skill-links";
import { addSecondEditionAdvancementMigration } from "./009-add-second-edition-advancement";
import { addMachineActorsMigration } from "./010-add-machine-actors";
import { addSecondEditionFeaturesMigration } from "./011-add-second-edition-features";
import { addSpecializationAllocationMigration } from "./012-add-specialization-allocation";
import { addSecondEditionAdvancementWorkflowsMigration } from "./013-add-second-edition-advancement-workflows";
import { addMovementAndScaleMigration } from "./014-add-movement-and-scale";
import { addMachineCrewsMigration } from "./015-add-machine-crews";
import { addBaseMoveMigration } from "./016-add-base-move";
import { addFirstEditionWoundsMigration } from "./017-add-first-edition-wounds";
import { addFirstEditionInjuryStateMigration } from "./018-add-first-edition-injury-state";
import { addFirstEditionMortalityClockMigration } from "./019-add-first-edition-mortality-clock";
import { addEnvironmentEffectsMigration } from "./020-add-environment-effects";
import { addEquipmentProvenanceMigration } from "./021-add-equipment-provenance";
import { admitNarrativePerkRewardsMigration } from "./022-admit-narrative-perk-rewards";
import { addFirstEditionBodyPointsMigration } from "./023-add-first-edition-body-points";
import { addFirstEditionAccumulatingStunsMigration } from "./024-add-first-edition-accumulating-stuns";
import { addCharacterTemplateStateMigration } from "./025-add-character-template-state";
import { addFreeformMagicDesignMigration } from "./026-add-freeform-magic-design";
import { addMagicPointsAndAutofireMigration } from "./027-add-magic-points-and-autofire";
import { addBestiaryProvenanceMigration } from "./028-add-bestiary-provenance";
import { addDodgeBasisMigration } from "./029-add-dodge-basis";
import { addThrownExplosiveProfileMigration } from "./030-add-thrown-explosive-profile";

export const migrations = Object.freeze([
  initializeSchemaMigration,
  addCharacterSheetModeMigration,
  canonicalPipScoresMigration,
  addFirstEditionResourcesMigration,
  admitCoreItemFamiliesMigration,
  addSecondEditionCombatStateMigration,
  admitCompatibilityDocumentFamiliesMigration,
  addCharacterCreationAndSkillLinksMigration,
  addSecondEditionAdvancementMigration,
  addMachineActorsMigration,
  addSecondEditionFeaturesMigration,
  addSpecializationAllocationMigration,
  addSecondEditionAdvancementWorkflowsMigration,
  addMovementAndScaleMigration,
  addMachineCrewsMigration,
  addBaseMoveMigration,
  addFirstEditionWoundsMigration,
  addFirstEditionInjuryStateMigration,
  addFirstEditionMortalityClockMigration,
  addEnvironmentEffectsMigration,
  addEquipmentProvenanceMigration,
  admitNarrativePerkRewardsMigration,
  addFirstEditionBodyPointsMigration,
  addFirstEditionAccumulatingStunsMigration,
  addCharacterTemplateStateMigration,
  addFreeformMagicDesignMigration,
  addMagicPointsAndAutofireMigration,
  addBestiaryProvenanceMigration,
  addDodgeBasisMigration,
  addThrownExplosiveProfileMigration,
]);
export const migrationRunner = new MigrationRunner(migrations);

if (migrationRunner.latestVersion !== schemaVersion.latest) {
  throw new Error(
    `Latest migration ${migrationRunner.latestVersion} does not match schema-version.json ${schemaVersion.latest}.`,
  );
}
