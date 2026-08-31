import {
  D6_RULE_STRATEGY_SLOTS,
  type D6RulesProfileV4,
  type D6RulesStrategySelectionV1,
} from "@d6-system-2e/core";

export const RULES_PROFILE_EDITABLE_MECHANIC_SLOTS = Object.freeze([
  ...D6_RULE_STRATEGY_SLOTS,
  "scale",
] as const);

export interface D6RulesProfileEditorFields {
  readonly description: string;
  readonly label: string;
  readonly strategies: D6RulesStrategySelectionV1;
  readonly tyfusiusD8ExplosiveDeviation: boolean;
}

/**
 * Applies only fields owned by the ordinary Rules Profile forms. Provider
 * metadata, embedded definitions, terminology, constraints, and unrelated
 * Homebrew policies remain byte-for-byte values from the draft.
 */
export function applyRulesProfileEditorFields(
  profile: D6RulesProfileV4,
  fields: D6RulesProfileEditorFields,
): D6RulesProfileV4 {
  return {
    ...profile,
    description: fields.description,
    homebrew: Object.freeze({
      ...profile.homebrew,
      tyfusiusD8ExplosiveDeviation: fields.tyfusiusD8ExplosiveDeviation,
    }),
    label: fields.label,
    strategies: Object.freeze({ ...fields.strategies }),
  };
}
