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
import { addPsionicsStateMigration } from "./031-add-psionics-state";
import { addCyberpunkStateMigration } from "./032-add-cyberpunk-state";
import { addSuperheroicStateMigration } from "./033-add-superheroic-state";
import { addSuperpowerTalentsMigration } from "./034-add-superpower-talents";
import { addSuperheroicEquipmentMigration } from "./035-add-superheroic-equipment";
import { addHideoutActorsMigration } from "./036-add-hideout-actors";
import { addSuperheroicRelationshipsMigration } from "./037-add-superheroic-relationships";
import { addSuperheroicTemplateProvenanceMigration } from "./038-add-superheroic-template-provenance";
import { addEditionAwareTemplateProvenanceMigration } from "./039-add-edition-aware-template-provenance";
import { addTemplateContainerContractsMigration } from "./040-add-template-container-contracts";
import { addFirstEditionGenreAttributesMigration } from "./041-add-first-edition-genre-attributes";
import { addFirstEditionFantasyMagicAndStrengthDamageMigration } from "./042-add-first-edition-fantasy-magic-and-strength-damage";
import { addCompanionProfileFieldsMigration } from "./043-add-companion-profile-fields";
import { aliasExtractedCoreContentUuidsMigration } from "./044-alias-extracted-core-content-uuids";
import { aliasExtractedSecondEditionFantasyUuidsMigration } from "./045-alias-extracted-second-edition-fantasy-uuids";
import { aliasExtractedFirstEditionCoreUuidsMigration } from "./046-alias-extracted-first-edition-core-uuids";

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
  addPsionicsStateMigration,
  addCyberpunkStateMigration,
  addSuperheroicStateMigration,
  addSuperpowerTalentsMigration,
  addSuperheroicEquipmentMigration,
  addHideoutActorsMigration,
  addSuperheroicRelationshipsMigration,
  addSuperheroicTemplateProvenanceMigration,
  addEditionAwareTemplateProvenanceMigration,
  addTemplateContainerContractsMigration,
  addFirstEditionGenreAttributesMigration,
  addFirstEditionFantasyMagicAndStrengthDamageMigration,
  addCompanionProfileFieldsMigration,
  aliasExtractedCoreContentUuidsMigration,
  aliasExtractedSecondEditionFantasyUuidsMigration,
  aliasExtractedFirstEditionCoreUuidsMigration,
]);
export const migrationRunner = new MigrationRunner(migrations);

if (migrationRunner.latestVersion !== schemaVersion.latest) {
  throw new Error(
    `Latest migration ${migrationRunner.latestVersion} does not match schema-version.json ${schemaVersion.latest}.`,
  );
}
