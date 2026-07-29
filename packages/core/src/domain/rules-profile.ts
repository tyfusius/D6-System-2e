export const RULES_COMPATIBILITY_KEYS = Object.freeze([
  "firstEditionSuccessEvaluator",
  "firstEditionInitiative",
  "firstEditionWildDie",
  "firstEditionMetaCurrency",
  "firstEditionActiveDefenses",
  "firstEditionDamage",
  "firstEditionAdvancement",
  "firstEditionAttributes",
  "firstEditionPips",
  "firstEditionRetries",
] as const);

export type RulesCompatibilityKey = (typeof RULES_COMPATIBILITY_KEYS)[number];

export interface RulesCompatibility {
  readonly firstEditionActiveDefenses: boolean;
  readonly firstEditionAdvancement: boolean;
  readonly firstEditionAttributes: boolean;
  readonly firstEditionDamage: boolean;
  readonly firstEditionInitiative: boolean;
  readonly firstEditionMetaCurrency: boolean;
  readonly firstEditionPips: boolean;
  readonly firstEditionRetries: boolean;
  readonly firstEditionSuccessEvaluator: boolean;
  readonly firstEditionWildDie: boolean;
}

export type RulesProfileId = "second-edition" | "open-d6" | "custom";

export interface RulesProfile {
  readonly compatibility: RulesCompatibility;
  readonly id: RulesProfileId;
}

export const SECOND_EDITION_COMPATIBILITY: RulesCompatibility = Object.freeze({
  firstEditionActiveDefenses: false,
  firstEditionAdvancement: false,
  firstEditionAttributes: false,
  firstEditionDamage: false,
  firstEditionInitiative: false,
  firstEditionMetaCurrency: false,
  firstEditionPips: false,
  firstEditionRetries: false,
  firstEditionSuccessEvaluator: false,
  firstEditionWildDie: false,
});

export const OPEN_D6_COMPATIBILITY: RulesCompatibility = Object.freeze({
  firstEditionActiveDefenses: true,
  firstEditionAdvancement: true,
  firstEditionAttributes: true,
  firstEditionDamage: true,
  firstEditionInitiative: true,
  firstEditionMetaCurrency: true,
  firstEditionPips: true,
  firstEditionRetries: true,
  firstEditionSuccessEvaluator: true,
  firstEditionWildDie: true,
});

export function compatibilityPreset(
  profileId: Exclude<RulesProfileId, "custom">,
): RulesCompatibility {
  return profileId === "open-d6"
    ? OPEN_D6_COMPATIBILITY
    : SECOND_EDITION_COMPATIBILITY;
}

export function resolveRulesProfile(
  compatibility: RulesCompatibility,
): RulesProfile {
  const values = RULES_COMPATIBILITY_KEYS.map((key) => compatibility[key]);
  const id: RulesProfileId = values.every(Boolean)
    ? "open-d6"
    : values.every((value) => !value)
      ? "second-edition"
      : "custom";
  return Object.freeze({
    compatibility: Object.freeze({ ...compatibility }),
    id,
  });
}
