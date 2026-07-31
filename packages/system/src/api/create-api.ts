import {
  D6_SYSTEM_2E_API_VERSION,
  type D6System2eApiV1,
  type D6System2eCapability,
  type D6System2eCapabilitySet,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { migrationRunner } from "../migrations";
import { terminologyRegistry } from "../registries/terminology";
import { themeRegistry } from "../registries/themes";
import {
  doubleDownFailedRoll,
  rerollFailedRoll,
  rollAttribute,
  rollFirstEditionDefense,
  rollItem,
  rollResistance,
  rollSkill,
} from "../foundry/rolls/roll-service";
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
import { currentEditionCapabilityProfile } from "../settings/edition-capabilities";
import {
  setActorCondition,
  setActorFirstEditionWound,
  setActorPosture,
} from "../foundry/condition-service";
import {
  commitFirstEditionCombatantActions,
  completeNextCombatantAction,
  declareCombatantActions,
  readCombatantRound,
  recordFirstEditionCombatantDefense,
  resetCombatantActions,
  spendFirstEditionCombatantAction,
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
    campaign: Object.freeze({
      current: currentSecondEditionCampaignProfile,
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
    capabilities: capabilitySet([
      "foundation.identity",
      "advancement.command",
      "campaign.profile",
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
    ]),
    migrations: Object.freeze({
      latestSchemaVersion: migrationRunner.latestVersion,
    }),
    health: Object.freeze({
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
  });
}
