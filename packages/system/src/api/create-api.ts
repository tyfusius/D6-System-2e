import {
  D6_SYSTEM_2E_API_VERSION,
  type D6System2eApiV1,
  type D6System2eCapability,
  type D6System2eCapabilitySet,
} from "@d6-system-2e/core";
import { SYSTEM_ID } from "../constants";
import { migrationRunner } from "../migrations";

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
    apiVersion: D6_SYSTEM_2E_API_VERSION,
    capabilities: capabilitySet(["foundation.identity"]),
    migrations: Object.freeze({
      latestSchemaVersion: migrationRunner.latestVersion,
    }),
    systemId: SYSTEM_ID,
  });
}
