import {
  D6_SYSTEM_2E_API_VERSION,
  type D6CampaignPackageManifestV1,
  type D6System2eCampaignPackageRegistry,
  type D6System2eApiV1,
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
import { hideoutFeatureRegistry } from "../registries/hideout-features";
import { campaignPackageRegistry } from "../registries/campaign-packages";
import { firstEditionGenreProfileRegistry } from "../registries/first-edition-genre-profiles";
import {
  applyFeatureDefinition,
  previewFeatureDefinition,
} from "../foundry/feature-catalog-service";
import {
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
import {
  applyRulesPreset,
  currentRulesProfile,
} from "../settings/rules-compatibility";
import { currentSecondEditionCampaignProfile } from "../settings/campaign-profile";
import { currentFirstEditionCampaignPackages } from "../settings/campaign-packages";
import { currentEditionCapabilityProfile } from "../settings/edition-capabilities";
import {
  setActorCondition,
  setActorFirstEditionWound,
  setActorPosture,
} from "../foundry/condition-service";
import { setActorFirstEditionBodyPoints } from "../foundry/first-edition-body-point-service";
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

export function createD6System2eApi(): D6System2eApiV1 {
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
      create: createBestiaryCreature,
      preview: previewBestiaryEntry,
    }),
    bestiaryRegistry,
    campaign: Object.freeze({
      current: currentSecondEditionCampaignProfile,
    }),
    campaignPackages,
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
    hideoutFeatureRegistry,
    capabilities: capabilitySet([
      "foundation.identity",
      "magic.freeform",
      "magic.points",
      "advancement.command",
      "campaign.profile",
      "creation.template",
      "chase.command",
      "chase.read",
      "combat.command",
      "combat.read",
      "health.condition",
      "health.wound",
      "feature.command",
      "feature.read",
      "rules.capabilities",
      "rules.profile",
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
      "registry.discipline",
      "registry.hideout-features",
      "registry.campaign-packages",
      "registry.first-edition-genre-profiles",
    ]),
    migrations: Object.freeze({
      latestSchemaVersion: migrationRunner.latestVersion,
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
      posture: setActorPosture,
      wound: setActorFirstEditionWound,
    }),
    read: Object.freeze({
      actor: actorReadModel,
    }),
    rules: Object.freeze({
      applyPreset: applyRulesPreset,
      capabilities: currentEditionCapabilityProfile,
      current: currentRulesProfile,
    }),
    roll: Object.freeze({
      attribute: rollAttribute,
      doubleDown: doubleDownFailedRoll,
      defense: rollFirstEditionDefense,
      item: rollItem,
      resistance: rollResistance,
      reroll: rerollFailedRoll,
      skill: rollSkill,
    }),
    systemId: SYSTEM_ID,
    terminology: terminologyRegistry,
    themes: themeRegistry,
    equipment: equipmentCatalogRegistry,
    templates: characterTemplateRegistry,
  });
}
