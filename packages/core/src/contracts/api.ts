import type { RulesProfile, RulesProfileId } from "../domain/rules-profile";
import type { D6System2eAdvancementApi } from "./advancement";
import type {
  D6System2eTerminologyRegistry,
  D6System2eThemeRegistry,
} from "./contributions";
import type { D6System2eRollApi } from "./roll";
import type { D6System2eReadApi } from "./actor-read-model";

export const D6_SYSTEM_2E_API_VERSION = 1 as const;

export type D6System2eCapability =
  | "foundation.identity"
  | "advancement.command"
  | "rules.profile"
  | "read.actor"
  | "roll.check"
  | "roll.attribute"
  | "roll.item"
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

export interface D6System2eRulesPresetResult {
  readonly applied: readonly string[];
  readonly failed: readonly { readonly error: string; readonly key: string }[];
  readonly profile: RulesProfile;
  readonly unchanged: readonly string[];
}

export interface D6System2eApiV1 {
  readonly advancement: D6System2eAdvancementApi;
  readonly apiVersion: typeof D6_SYSTEM_2E_API_VERSION;
  readonly capabilities: D6System2eCapabilitySet;
  readonly migrations: {
    readonly latestSchemaVersion: number;
  };
  readonly read: D6System2eReadApi;
  readonly rules: {
    applyPreset(
      profileId: Exclude<RulesProfileId, "custom">,
    ): Promise<D6System2eRulesPresetResult>;
    current(): RulesProfile;
  };
  readonly roll: D6System2eRollApi;
  readonly terminology: D6System2eTerminologyRegistry;
  readonly themes: D6System2eThemeRegistry;
  readonly systemId: "d6-system-2e";
}

export function isD6System2eApiV1(value: unknown): value is D6System2eApiV1 {
  return (
    typeof value === "object" &&
    value !== null &&
    "apiVersion" in value &&
    value.apiVersion === D6_SYSTEM_2E_API_VERSION &&
    "advancement" in value &&
    typeof value.advancement === "object" &&
    value.advancement !== null &&
    "attribute" in value.advancement &&
    typeof value.advancement.attribute === "function" &&
    "item" in value.advancement &&
    typeof value.advancement.item === "function" &&
    "systemId" in value &&
    value.systemId === "d6-system-2e" &&
    "rules" in value &&
    typeof value.rules === "object" &&
    value.rules !== null &&
    "applyPreset" in value.rules &&
    typeof value.rules.applyPreset === "function" &&
    "current" in value.rules &&
    typeof value.rules.current === "function" &&
    "roll" in value &&
    typeof value.roll === "object" &&
    value.roll !== null &&
    "attribute" in value.roll &&
    typeof value.roll.attribute === "function" &&
    "skill" in value.roll &&
    typeof value.roll.skill === "function" &&
    "item" in value.roll &&
    typeof value.roll.item === "function" &&
    "read" in value &&
    typeof value.read === "object" &&
    value.read !== null &&
    "actor" in value.read &&
    typeof value.read.actor === "function" &&
    "terminology" in value &&
    typeof value.terminology === "object" &&
    value.terminology !== null &&
    "register" in value.terminology &&
    typeof value.terminology.register === "function" &&
    "themes" in value &&
    typeof value.themes === "object" &&
    value.themes !== null &&
    "register" in value.themes &&
    typeof value.themes.register === "function"
  );
}
