import type { AdvancementCostMultipliers } from "@d6-system-2e/core";
import { currentConfiguredRulesProfile } from "./rules-profile-library";
import {
  FIRST_EDITION_OPTION_KEYS,
  SECOND_EDITION_OPTION_KEYS,
} from "./settings-catalog";
import { numberSetting, stringSetting } from "./setting-values";

export type D6AdvancementRuntimeStrategyId =
  | "d6e2.advancement.unselected"
  | "d6e2.advancement.experience-points"
  | "d6e2.advancement.milestone"
  | "d6e2.advancement.narrative"
  | "d6mv.advancement.skill-and-hero-points"
  | "open-d6.advancement.character-points";

export interface D6AdvancementRuntimeStrategy {
  readonly awards:
    | "gm-adjudicated-character-points"
    | "gm-milestone-bundle"
    | "narrative-arc-completion"
    | "session-experience-points"
    | "unsupported";
  readonly cost:
    | "configured-character-point-multipliers"
    | "milestone-pools"
    | "narrative-target"
    | "d6mv-split-resources"
    | "second-edition-rating"
    | "unsupported";
  readonly family:
    | "character-points"
    | "d6mv"
    | "experience-points"
    | "milestone"
    | "narrative"
    | "unavailable";
  readonly id: D6AdvancementRuntimeStrategyId;
  readonly progression:
    "direct-spend" | "milestone-pools" | "narrative-arcs" | "unavailable";
  readonly specialization:
    "direct-spend" | "experience-acquisition-only" | "unsupported";
  readonly step: "one-pip" | "pips-aware" | "story-target" | "unavailable";
}

const ADVANCEMENT_RUNTIME_STRATEGIES = Object.freeze({
  "d6e2.advancement.unselected": Object.freeze({
    awards: "unsupported",
    cost: "unsupported",
    family: "unavailable",
    id: "d6e2.advancement.unselected",
    progression: "unavailable",
    specialization: "unsupported",
    step: "unavailable",
  }),
  "d6e2.advancement.experience-points": Object.freeze({
    awards: "session-experience-points",
    cost: "second-edition-rating",
    family: "experience-points",
    id: "d6e2.advancement.experience-points",
    progression: "direct-spend",
    specialization: "experience-acquisition-only",
    step: "pips-aware",
  }),
  "d6e2.advancement.milestone": Object.freeze({
    awards: "gm-milestone-bundle",
    cost: "milestone-pools",
    family: "milestone",
    id: "d6e2.advancement.milestone",
    progression: "milestone-pools",
    specialization: "unsupported",
    step: "pips-aware",
  }),
  "d6e2.advancement.narrative": Object.freeze({
    awards: "narrative-arc-completion",
    cost: "narrative-target",
    family: "narrative",
    id: "d6e2.advancement.narrative",
    progression: "narrative-arcs",
    specialization: "unsupported",
    step: "story-target",
  }),
  "open-d6.advancement.character-points": Object.freeze({
    awards: "gm-adjudicated-character-points",
    cost: "configured-character-point-multipliers",
    family: "character-points",
    id: "open-d6.advancement.character-points",
    progression: "direct-spend",
    specialization: "direct-spend",
    step: "one-pip",
  }),
  "d6mv.advancement.skill-and-hero-points": Object.freeze({
    awards: "session-experience-points",
    cost: "d6mv-split-resources",
    family: "d6mv",
    id: "d6mv.advancement.skill-and-hero-points",
    progression: "direct-spend",
    specialization: "unsupported",
    step: "one-pip",
  }),
} as const satisfies Readonly<
  Record<D6AdvancementRuntimeStrategyId, D6AdvancementRuntimeStrategy>
>);

export function advancementRuntimeStrategy(
  strategyId: string,
): D6AdvancementRuntimeStrategy {
  return (
    Object.values(ADVANCEMENT_RUNTIME_STRATEGIES).find(
      ({ id }) => id === strategyId,
    ) ?? ADVANCEMENT_RUNTIME_STRATEGIES["d6e2.advancement.unselected"]
  );
}

function configuredSecondEditionStrategy(): D6AdvancementRuntimeStrategyId {
  const selected = stringSetting(
    SECOND_EDITION_OPTION_KEYS.advancementStrategy,
    "unselected",
  );
  return advancementRuntimeStrategy(`d6e2.advancement.${selected}`).id;
}

export function currentAdvancementRuntimeStrategy(): D6AdvancementRuntimeStrategy {
  const configured = currentConfiguredRulesProfile().strategies.advancement;
  if (configured === "d6e2.advancement.configured") {
    return advancementRuntimeStrategy(configuredSecondEditionStrategy());
  }
  return advancementRuntimeStrategy(configured);
}

export function currentAdvancementCostMultipliers(): AdvancementCostMultipliers {
  return Object.freeze({
    attribute: numberSetting(
      FIRST_EDITION_OPTION_KEYS.advanceCostAttribute,
      10,
    ),
    skill: numberSetting(FIRST_EDITION_OPTION_KEYS.advanceCostSkill, 1),
    specialization: numberSetting(
      FIRST_EDITION_OPTION_KEYS.advanceCostSpecialization,
      0.5,
    ),
  });
}
