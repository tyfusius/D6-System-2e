import {
  D6_SYSTEM_2E_API_VERSION,
  type D6CampaignPackageManifestV1,
  type D6System2eCampaignPackageRegistry,
  type D6ContentPackageManifestV1,
  type D6System2eContentPackageRegistry,
  type D6System2eApiV2,
  type D6System2eCapability,
  type D6System2eCapabilitySet,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { migrationRunner } from "../migrations";
import { terminologyRegistry } from "../registries/terminology";
import { themeRegistry } from "../registries/themes";
import { equipmentCatalogRegistry } from "../registries/equipment";
import { characterTemplateRegistry } from "../registries/character-templates";
import { bestiaryRegistry } from "../registries/bestiary";
import { featureCatalogRegistry } from "../registries/feature-catalogs";
import { psionicPowerRegistry } from "../registries/psionics";
import { extraordinaryPowerFrameworkRegistry } from "../registries/extraordinary-powers";
import {
  activateExtraordinaryPower,
  bindExtraordinaryPowerItem,
  bindExtraordinaryPowerSkill,
  deactivateExtraordinaryPower,
  executeExtraordinaryPowerRollPlan,
  readActorExtraordinaryPowers,
  setExtraordinaryPowerConsequence,
  unbindExtraordinaryPowerItem,
  unbindExtraordinaryPowerSkill,
} from "../foundry/extraordinary-power-service";
import { hideoutFeatureRegistry } from "../registries/hideout-features";
import { campaignPackageRegistry } from "../registries/campaign-packages";
import { contentPackageRegistry } from "../registries/content-packages";
import { firstEditionGenreProfileRegistry } from "../registries/first-edition-genre-profiles";
import {
  applyFeatureDefinition,
  previewFeatureDefinition,
} from "../foundry/feature-catalog-service";
import {
  activateBestiaryProfiles,
  activateBestiaryRulesProfile,
  createBestiaryCreature,
  previewBestiaryEntry,
} from "../foundry/bestiary-service";
import {
  applyCharacterTemplate,
  previewCharacterTemplate,
} from "../foundry/character-template-service";
import {
  doubleDownFailedRoll,
  rerollFailedRoll,
  rollAttribute,
  castFreeformMagic,
  actorMagicPointPool,
  recoverActorMagicPoints,
  rollFirstEditionDefense,
  rollItem,
  rollResistance,
  rollSkill,
  rollPsionicPower,
} from "../foundry/rolls/roll-service";
import {
  readActorPsionics,
  trainPsionicDiscipline,
} from "../foundry/psionics-service";
import { freeformMagicDifficulty } from "@d6-system-2e/core";
import { actorReadModel } from "../foundry/read-models/actor";
import {
  acquireSpecialization,
  advanceAttribute,
  advanceItem,
} from "../foundry/advancement-service";
import {
  approveNarrativeArc,
  awardMilestone,
  completeNarrativeArc,
  exchangeMilestoneForPerk,
  proposeNarrativeArc,
  readMilestoneBalance,
  readNarrativeArcs,
  removeNarrativeArc,
  toggleNarrativeArcStep,
} from "../foundry/second-edition-advancement-service";
import { currentSecondEditionCampaignProfile } from "../settings/campaign-profile";
import { currentFirstEditionCampaignPackages } from "../settings/campaign-packages";
import { currentRulesRuntime } from "../settings/rules-runtime";
import { currentRulesSelection } from "../settings/rules-selection";
import {
  currentConfiguredRulesProfile,
  rulesProfileRegistry,
  selectRulesProfile,
} from "../settings/rules-profile-library";
import { healthModelRegistry } from "../settings/health-model-library";
import {
  currentResolvedSettingProfile,
  currentSettingProfileSelection,
  settingProfileRegistry,
} from "../settings/setting-profile";
import { activateSettingProfile } from "../foundry/setting-profile-service";
import { profilePresetApi } from "../foundry/profile-preset-service";
import { profilePresetRegistry } from "../registries/profile-presets";
import {
  setActorCondition,
  setActorFirstEditionWound,
  setActorPosture,
} from "../foundry/condition-service";
import { setActorFirstEditionBodyPoints } from "../foundry/first-edition-body-point-service";
import {
  damageActorHealthPool,
  healActorHealthPool,
  readActorHealth,
  setActorHealthPool,
  setActorHealthTrack,
} from "../foundry/health-runtime";
import {
  commitFirstEditionCombatantActions,
  completeNextCombatantAction,
  declareCombatantActions,
  readCombatantRound,
  recordFirstEditionCombatantDefense,
  resetCombatantActions,
  spendFirstEditionCombatantAction,
  enterSecondEditionCombatantFullDefense,
  recordSecondEditionCombatantFeint,
} from "../foundry/combat-service";
import {
  invokeNarrativeFeature,
  readFeatureSession,
  resetFeatureSession,
} from "../foundry/feature-service";
import {
  endD6Chase,
  readD6Chase,
  resolveD6Chase,
  rollD6ChaseSide,
  startD6Chase,
} from "../foundry/chase-service";
import { openActorSheet } from "../foundry/actor-sheet-service";
import { writeLegacyExtraordinaryPowerActors } from "../importers/legacy-extraordinary-power-writer";
import {
  previewLegacyWorldDocuments,
  writeLegacyWorldDocuments,
} from "../importers/legacy-world-document-writer";

function capabilitySet(
  values: readonly D6System2eCapability[],
): D6System2eCapabilitySet {
  const capabilities = new Set(values);
  const snapshot = Object.freeze([...capabilities]);
  return Object.freeze({
    has: (capability: D6System2eCapability): boolean =>
      capabilities.has(capability),
    values: (): readonly D6System2eCapability[] => snapshot,
  });
}

export function createD6System2eApi(): D6System2eApiV2 {
  const campaignPackages: D6System2eCampaignPackageRegistry = Object.freeze({
    current: () => campaignPackageRegistry.current(),
    register: (ownerId: string, manifest: D6CampaignPackageManifestV1) =>
      campaignPackageRegistry.register(ownerId, manifest),
    resolve: (selection: {
      readonly companionId?: string;
      readonly genreId?: string;
    }) => campaignPackageRegistry.resolve(selection),
    selection: currentFirstEditionCampaignPackages,
    unregisterOwner: (ownerId: string) =>
      campaignPackageRegistry.unregisterOwner(ownerId),
  });
  const contentPackages: D6System2eContentPackageRegistry = Object.freeze({
    current: () => contentPackageRegistry.current(),
    register: (ownerId: string, manifest: D6ContentPackageManifestV1) =>
      contentPackageRegistry.register(ownerId, manifest),
    unregisterOwner: (ownerId: string) =>
      contentPackageRegistry.unregisterOwner(ownerId),
  });

  return Object.freeze({
    advancement: Object.freeze({
      attribute: advanceAttribute,
      item: advanceItem,
      milestone: Object.freeze({
        award: awardMilestone,
        exchangeForPerk: exchangeMilestoneForPerk,
        read: readMilestoneBalance,
      }),
      narrative: Object.freeze({
        approve: approveNarrativeArc,
        complete: completeNarrativeArc,
        propose: proposeNarrativeArc,
        read: readNarrativeArcs,
        remove: removeNarrativeArc,
        toggleStep: toggleNarrativeArcStep,
      }),
      specialization: acquireSpecialization,
    }),
    apiVersion: D6_SYSTEM_2E_API_VERSION,
    bestiary: Object.freeze({
      activateProfiles: activateBestiaryProfiles,
      activateRulesProfile: activateBestiaryRulesProfile,
      create: createBestiaryCreature,
      preview: previewBestiaryEntry,
    }),
    bestiaryRegistry,
    campaign: Object.freeze({
      current: currentSecondEditionCampaignProfile,
    }),
    campaignPackages,
    contentPackages,
    firstEditionGenreProfiles: firstEditionGenreProfileRegistry,
    characterTemplates: Object.freeze({
      apply: applyCharacterTemplate,
      preview: previewCharacterTemplate,
    }),
    chase: Object.freeze({
      end: endD6Chase,
      read: readD6Chase,
      resolve: resolveD6Chase,
      roll: rollD6ChaseSide,
      start: startD6Chase,
    }),
    combat: Object.freeze({
      commitFirstEdition: commitFirstEditionCombatantActions,
      completeNext: completeNextCombatantAction,
      declare: declareCombatantActions,
      feint: recordSecondEditionCombatantFeint,
      fullDefense: enterSecondEditionCombatantFullDefense,
      read: readCombatantRound,
      recordFirstEditionDefense: recordFirstEditionCombatantDefense,
      reset: resetCombatantActions,
      spendFirstEdition: spendFirstEditionCombatantAction,
    }),
    features: Object.freeze({
      invoke: invokeNarrativeFeature,
      read: readFeatureSession,
      reset: resetFeatureSession,
    }),
    featureCatalogs: Object.freeze({
      apply: applyFeatureDefinition,
      preview: previewFeatureDefinition,
    }),
    featureCatalogRegistry,
    extraordinaryPowerFrameworkRegistry,
    extraordinaryPowers: Object.freeze({
      activate: activateExtraordinaryPower,
      bindPower: bindExtraordinaryPowerItem,
      bindSkill: bindExtraordinaryPowerSkill,
      deactivate: deactivateExtraordinaryPower,
      execute: executeExtraordinaryPowerRollPlan,
      read: readActorExtraordinaryPowers,
      setConsequence: setExtraordinaryPowerConsequence,
      unbindPower: unbindExtraordinaryPowerItem,
      unbindSkill: unbindExtraordinaryPowerSkill,
    }),
    hideoutFeatureRegistry,
    capabilities: capabilitySet([
      "foundation.identity",
      "magic.freeform",
      "magic.points",
      "migration.world-import",
      "advancement.command",
      "campaign.profile",
      "creation.template",
      "chase.command",
      "chase.read",
      "combat.command",
      "combat.read",
      "health.condition",
      "health.body-points",
      "health.command",
      "health.read",
      "health.wound",
      "feature.command",
      "feature.read",
      "extraordinary-power.command",
      "extraordinary-power.read",
      "extraordinary-power.roll-plan",
      "rules.runtime",
      "rules.profile",
      "setting.profile",
      "ui.actor-sheet",
      "profile-preset.transaction",
      "registry.profile-presets",
      "read.actor",
      "roll.check",
      "roll.double-down",
      "roll.defense",
      "roll.attribute",
      "roll.item",
      "roll.resistance",
      "roll.reroll",
      "roll.skill",
      "registry.terminology",
      "registry.theme",
      "registry.equipment",
      "registry.templates",
      "registry.bestiary",
      "registry.features",
      "registry.extraordinary-power-frameworks",
      "registry.discipline",
      "registry.hideout-features",
      "registry.campaign-packages",
      "registry.content-packages",
      "registry.first-edition-genre-profiles",
      "registry.rules-profiles",
      "registry.setting-profiles",
      "registry.health-models",
    ]),
    migrations: Object.freeze({
      importLegacyExtraordinaryPowerActors: writeLegacyExtraordinaryPowerActors,
      importLegacyWorldDocuments: writeLegacyWorldDocuments,
      latestSchemaVersion: migrationRunner.latestVersion,
      previewLegacyWorldDocuments,
    }),
    magic: Object.freeze({
      cast: castFreeformMagic,
      difficulty: freeformMagicDifficulty,
      recover: recoverActorMagicPoints,
      resource: actorMagicPointPool,
    }),
    psionics: Object.freeze({
      read: readActorPsionics,
      roll: rollPsionicPower,
      train: trainPsionicDiscipline,
    }),
    psionicPowerRegistry,
    health: Object.freeze({
      bodyPoints: setActorFirstEditionBodyPoints,
      condition: setActorCondition,
      damagePool: damageActorHealthPool,
      healPool: healActorHealthPool,
      posture: setActorPosture,
      read: readActorHealth,
      setPool: setActorHealthPool,
      setTrack: setActorHealthTrack,
      wound: setActorFirstEditionWound,
    }),
    read: Object.freeze({
      actor: actorReadModel,
    }),
    rules: Object.freeze({
      activate: selectRulesProfile,
      configured: currentConfiguredRulesProfile,
      runtime: currentRulesRuntime,
      selection: currentRulesSelection,
    }),
    rulesProfileRegistry,
    profilePreset: profilePresetApi,
    profilePresetRegistry,
    setting: Object.freeze({
      activate: activateSettingProfile,
      configured: currentResolvedSettingProfile,
      selection: currentSettingProfileSelection,
    }),
    settingProfileRegistry,
    healthModelRegistry,
    roll: Object.freeze({
      attribute: rollAttribute,
      doubleDown: doubleDownFailedRoll,
      defense: rollFirstEditionDefense,
      item: rollItem,
      resistance: rollResistance,
      reroll: rerollFailedRoll,
      skill: rollSkill,
    }),
    ui: Object.freeze({ openActorSheet }),
    systemId: SYSTEM_ID,
    terminology: terminologyRegistry,
    themes: themeRegistry,
    equipment: equipmentCatalogRegistry,
    templates: characterTemplateRegistry,
  });
}
