export const D6_SYSTEM_2E_API_VERSION = 1 as const;

export type D6System2eCapability =
  | "foundation.identity"
  | "read.actor"
  | "roll.check"
  | "roll.attribute"
  | "roll.skill"
  | "registry.terminology"
  | "registry.theme"
  | "registry.discipline"
  | "combat.read"
  | "combat.command";

export interface D6System2eCapabilitySet {
  has(capability: D6System2eCapability): boolean;
  values(): readonly D6System2eCapability[];
}

export interface D6System2eApiV1 {
  readonly apiVersion: typeof D6_SYSTEM_2E_API_VERSION;
  readonly capabilities: D6System2eCapabilitySet;
  readonly migrations: {
    readonly latestSchemaVersion: number;
  };
  readonly systemId: "d6-system-2e";
}

export function isD6System2eApiV1(value: unknown): value is D6System2eApiV1 {
  return (
    typeof value === "object" &&
    value !== null &&
    "apiVersion" in value &&
    value.apiVersion === D6_SYSTEM_2E_API_VERSION &&
    "systemId" in value &&
    value.systemId === "d6-system-2e"
  );
}
