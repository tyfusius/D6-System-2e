import type {
  D6WildDiePolicy,
  SecondEditionHeroPointStrategy,
  SuccessEvaluator,
} from "@d6-system-2e/core";
import { currentAdvancementRuntimeStrategy } from "./advancement";
import { currentConfiguredRulesProfile } from "./rules-profile-library";
import { SECOND_EDITION_OPTION_KEYS } from "./settings-catalog";
import { stringSetting } from "./setting-values";

export type D6SuccessRuntimeStrategyId =
  | "d6e2.success.strictly-greater"
  | "d6mv.success.six-degrees"
  | "open-d6.success.meets-or-exceeds";

export interface D6SuccessRuntimeStrategy {
  readonly evaluator: SuccessEvaluator;
  readonly id: D6SuccessRuntimeStrategyId;
  readonly threshold: "meets" | "six-degrees" | "strictly-exceeds";
}

export type D6WildDieRuntimeStrategyId =
  | "d6e2.wild-die.advantage-complication"
  | "d6e2.wild-die.basic"
  | "d6e2.wild-die.classic"
  | "d6e2.wild-die.simple"
  | "d6mv.wild-die.advantage-complication"
  | "open-d6.wild-die.critical-one";

export interface D6WildDieRuntimeStrategy {
  readonly choiceAuthority:
    | "gm-for-complication-and-blind-advantage"
    | "gm-for-critical-one"
    | "gm-for-mishap"
    | "none"
    | "split-d6mv"
    | "table-choice";
  readonly explosion: "conditional-after-evaluation" | "every-six";
  readonly id: D6WildDieRuntimeStrategyId;
  readonly policy: D6WildDiePolicy;
}

export type D6RetryRuntimeStrategyId =
  | "d6e2.retries.doubling-down"
  | "d6mv.retries.hero-reroll"
  | "open-d6.retries.no-general-reroll";

export interface D6RetryRuntimeStrategy {
  readonly followUp: "doubling-down" | "hero-reroll" | "none";
  readonly id: D6RetryRuntimeStrategyId;
  readonly sharedClaim: "required" | "unavailable";
}

export type D6MetaCurrencyRuntimeStrategyId =
  | "d6e2.meta-currency.heroic-hero-points"
  | "d6e2.meta-currency.basic-hero-points"
  | "d6e2.meta-currency.classic-hero-points"
  | "d6mv.meta-currency.hero-and-skill-points"
  | "open-d6.meta-currency.character-and-fate-points";

export interface D6MetaCurrencyRuntimeStrategy {
  readonly automaticRollTransactions: "configurable" | "none" | "open-d6";
  readonly failedRollReroll: boolean;
  readonly heroPointStrategy: SecondEditionHeroPointStrategy | null;
  readonly id: D6MetaCurrencyRuntimeStrategyId;
  readonly preventStunned: boolean;
  readonly primaryResource:
    "characterPoints" | "experiencePoints" | "heroPoints";
  readonly rollSpend:
    | "bonus-ordinary-dice"
    | "bonus-wild-dice"
    | "character-and-fate-points"
    | "double-die-code"
    | "none";
  readonly secondaryResource: "fatePoints" | null;
  readonly surviveKillingBlow: boolean;
}

const SUCCESS_STRATEGIES = Object.freeze({
  "d6e2.success.strictly-greater": Object.freeze({
    evaluator: "second-edition-strict",
    id: "d6e2.success.strictly-greater",
    threshold: "strictly-exceeds",
  }),
  "open-d6.success.meets-or-exceeds": Object.freeze({
    evaluator: "first-edition-meets",
    id: "open-d6.success.meets-or-exceeds",
    threshold: "meets",
  }),
  "d6mv.success.six-degrees": Object.freeze({
    evaluator: "first-edition-meets",
    id: "d6mv.success.six-degrees",
    threshold: "six-degrees",
  }),
} as const satisfies Readonly<
  Record<D6SuccessRuntimeStrategyId, D6SuccessRuntimeStrategy>
>);

const WILD_DIE_STRATEGIES = Object.freeze({
  "d6e2.wild-die.advantage-complication": Object.freeze({
    choiceAuthority: "gm-for-complication-and-blind-advantage",
    explosion: "conditional-after-evaluation",
    id: "d6e2.wild-die.advantage-complication",
    policy: "second-edition",
  }),
  "d6e2.wild-die.basic": Object.freeze({
    choiceAuthority: "none",
    explosion: "every-six",
    id: "d6e2.wild-die.basic",
    policy: "second-edition-basic",
  }),
  "d6e2.wild-die.classic": Object.freeze({
    choiceAuthority: "gm-for-mishap",
    explosion: "every-six",
    id: "d6e2.wild-die.classic",
    policy: "second-edition-classic",
  }),
  "d6e2.wild-die.simple": Object.freeze({
    choiceAuthority: "none",
    explosion: "every-six",
    id: "d6e2.wild-die.simple",
    policy: "second-edition-simple",
  }),
  "open-d6.wild-die.critical-one": Object.freeze({
    choiceAuthority: "gm-for-critical-one",
    explosion: "every-six",
    id: "open-d6.wild-die.critical-one",
    policy: "first-edition",
  }),
  "d6mv.wild-die.advantage-complication": Object.freeze({
    choiceAuthority: "split-d6mv",
    explosion: "conditional-after-evaluation",
    id: "d6mv.wild-die.advantage-complication",
    policy: "d6mv",
  }),
} as const satisfies Readonly<
  Record<D6WildDieRuntimeStrategyId, D6WildDieRuntimeStrategy>
>);

const RETRY_STRATEGIES = Object.freeze({
  "d6e2.retries.doubling-down": Object.freeze({
    followUp: "doubling-down",
    id: "d6e2.retries.doubling-down",
    sharedClaim: "required",
  }),
  "open-d6.retries.no-general-reroll": Object.freeze({
    followUp: "none",
    id: "open-d6.retries.no-general-reroll",
    sharedClaim: "unavailable",
  }),
  "d6mv.retries.hero-reroll": Object.freeze({
    followUp: "hero-reroll",
    id: "d6mv.retries.hero-reroll",
    sharedClaim: "required",
  }),
} as const satisfies Readonly<
  Record<D6RetryRuntimeStrategyId, D6RetryRuntimeStrategy>
>);

const META_CURRENCY_STRATEGIES = Object.freeze({
  "d6e2.meta-currency.heroic-hero-points": Object.freeze({
    automaticRollTransactions: "configurable",
    failedRollReroll: true,
    heroPointStrategy: "heroic",
    id: "d6e2.meta-currency.heroic-hero-points",
    preventStunned: true,
    primaryResource: "heroPoints",
    rollSpend: "double-die-code",
    secondaryResource: null,
    surviveKillingBlow: true,
  }),
  "d6e2.meta-currency.basic-hero-points": Object.freeze({
    automaticRollTransactions: "configurable",
    failedRollReroll: false,
    heroPointStrategy: "basic",
    id: "d6e2.meta-currency.basic-hero-points",
    preventStunned: false,
    primaryResource: "heroPoints",
    rollSpend: "bonus-ordinary-dice",
    secondaryResource: null,
    surviveKillingBlow: false,
  }),
  "d6e2.meta-currency.classic-hero-points": Object.freeze({
    automaticRollTransactions: "configurable",
    failedRollReroll: false,
    heroPointStrategy: "classic",
    id: "d6e2.meta-currency.classic-hero-points",
    preventStunned: false,
    primaryResource: "experiencePoints",
    rollSpend: "bonus-wild-dice",
    secondaryResource: null,
    surviveKillingBlow: false,
  }),
  "open-d6.meta-currency.character-and-fate-points": Object.freeze({
    automaticRollTransactions: "open-d6",
    failedRollReroll: false,
    heroPointStrategy: null,
    id: "open-d6.meta-currency.character-and-fate-points",
    preventStunned: false,
    primaryResource: "characterPoints",
    rollSpend: "character-and-fate-points",
    secondaryResource: "fatePoints",
    surviveKillingBlow: false,
  }),
  "d6mv.meta-currency.hero-and-skill-points": Object.freeze({
    automaticRollTransactions: "configurable",
    failedRollReroll: true,
    heroPointStrategy: "heroic",
    id: "d6mv.meta-currency.hero-and-skill-points",
    preventStunned: true,
    primaryResource: "heroPoints",
    rollSpend: "double-die-code",
    secondaryResource: null,
    surviveKillingBlow: false,
  }),
} as const satisfies Readonly<
  Record<D6MetaCurrencyRuntimeStrategyId, D6MetaCurrencyRuntimeStrategy>
>);

export function successRuntimeStrategy(id: string): D6SuccessRuntimeStrategy {
  return (
    Object.values(SUCCESS_STRATEGIES).find((entry) => entry.id === id) ??
    SUCCESS_STRATEGIES["d6e2.success.strictly-greater"]
  );
}

export function currentSuccessRuntimeStrategy(): D6SuccessRuntimeStrategy {
  const configured =
    currentConfiguredRulesProfile().strategies.successEvaluator;
  return successRuntimeStrategy(configured);
}

export function wildDieRuntimeStrategy(id: string): D6WildDieRuntimeStrategy {
  return (
    Object.values(WILD_DIE_STRATEGIES).find((entry) => entry.id === id) ??
    WILD_DIE_STRATEGIES["d6e2.wild-die.advantage-complication"]
  );
}

export function currentWildDieRuntimeStrategy(): D6WildDieRuntimeStrategy {
  const configured = currentConfiguredRulesProfile().strategies.wildDie;
  if (configured === "d6e2.wild-die.advantage-complication") {
    const selected = stringSetting(
      SECOND_EDITION_OPTION_KEYS.wildDieStrategy,
      "core",
    );
    return wildDieRuntimeStrategy(
      selected === "core" ? configured : `d6e2.wild-die.${selected}`,
    );
  }
  return wildDieRuntimeStrategy(configured);
}

export function retryRuntimeStrategy(id: string): D6RetryRuntimeStrategy {
  return (
    Object.values(RETRY_STRATEGIES).find((entry) => entry.id === id) ??
    RETRY_STRATEGIES["d6e2.retries.doubling-down"]
  );
}

export function currentRetryRuntimeStrategy(): D6RetryRuntimeStrategy {
  const configured = currentConfiguredRulesProfile().strategies.retries;
  return retryRuntimeStrategy(configured);
}

export function metaCurrencyRuntimeStrategy(
  id: string,
): D6MetaCurrencyRuntimeStrategy {
  return (
    Object.values(META_CURRENCY_STRATEGIES).find((entry) => entry.id === id) ??
    META_CURRENCY_STRATEGIES["d6e2.meta-currency.heroic-hero-points"]
  );
}

function configuredHeroPointStrategy(): SecondEditionHeroPointStrategy {
  const selected = stringSetting(
    SECOND_EDITION_OPTION_KEYS.heroPointStrategy,
    "heroic",
  );
  if (selected !== "classic") return selected === "basic" ? "basic" : "heroic";
  const classicWildDie =
    currentWildDieRuntimeStrategy().id === "d6e2.wild-die.classic";
  const experiencePoints =
    currentAdvancementRuntimeStrategy().family === "experience-points";
  return classicWildDie && experiencePoints ? "classic" : "heroic";
}

export function currentMetaCurrencyRuntimeStrategy(): D6MetaCurrencyRuntimeStrategy {
  const configured = currentConfiguredRulesProfile().strategies.metaCurrency;
  if (configured === "d6e2.meta-currency.hero-points") {
    return META_CURRENCY_STRATEGIES[
      `d6e2.meta-currency.${configuredHeroPointStrategy()}-hero-points`
    ];
  }
  return metaCurrencyRuntimeStrategy(configured);
}
