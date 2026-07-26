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
import { rollAttribute, rollSkill } from "../foundry/rolls/roll-service";
import { actorReadModel } from "../foundry/read-models/actor";
import { advanceAttribute, advanceItem } from "../foundry/advancement-service";
import {
  applyRulesPreset,
  currentRulesProfile,
} from "../settings/rules-compatibility";

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
    }),
    apiVersion: D6_SYSTEM_2E_API_VERSION,
    capabilities: capabilitySet([
      "foundation.identity",
      "advancement.command",
      "rules.profile",
      "read.actor",
      "roll.check",
      "roll.attribute",
      "roll.skill",
      "registry.terminology",
      "registry.theme",
    ]),
    migrations: Object.freeze({
      latestSchemaVersion: migrationRunner.latestVersion,
    }),
    read: Object.freeze({
      actor: actorReadModel,
    }),
    rules: Object.freeze({
      applyPreset: applyRulesPreset,
      current: currentRulesProfile,
    }),
    roll: Object.freeze({
      attribute: rollAttribute,
      skill: rollSkill,
    }),
    systemId: SYSTEM_ID,
    terminology: terminologyRegistry,
    themes: themeRegistry,
  });
}
