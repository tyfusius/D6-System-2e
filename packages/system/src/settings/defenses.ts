import { booleanSetting } from "./setting-values";
import { currentConfiguredRulesProfile } from "./rules-profile-library";
import { SECOND_EDITION_OPTION_KEYS } from "./settings-catalog";

export type D6DefenseRuntimeStrategyId =
  | "d6e2.defenses.static"
  | "d6e2.defenses.no-dodge"
  | "d6mv.defenses.srp"
  | "open-d6.defenses.active";

export interface D6DefenseRuntimeStrategy {
  readonly activeDefense: "committed-roll" | "unsupported";
  readonly family: "active" | "range" | "srp" | "static";
  readonly feint: "second-edition-penalty" | "unsupported";
  readonly fullDefense:
    | "d6mv-resistance-skill-bonus"
    | "open-d6-plus-ten"
    | "second-edition-skill-bonus";
  readonly id: D6DefenseRuntimeStrategyId;
  readonly machineDefense: "manual" | "static-hull";
  readonly melee: "active-reaction" | "static-parry";
  readonly partialDefense: "open-d6-roll" | "unsupported";
  readonly ranged: "active-reaction" | "fixed-range" | "static-dodge";
  readonly reaction: "declared-only" | "triggered-interrupt";
  readonly targeting: "actor-static" | "fixed-range" | "manual";
}

const DEFENSE_RUNTIME_STRATEGIES = Object.freeze({
  "d6e2.defenses.static": Object.freeze({
    activeDefense: "unsupported",
    family: "static",
    feint: "second-edition-penalty",
    fullDefense: "second-edition-skill-bonus",
    id: "d6e2.defenses.static",
    machineDefense: "static-hull",
    melee: "static-parry",
    partialDefense: "unsupported",
    ranged: "static-dodge",
    reaction: "declared-only",
    targeting: "actor-static",
  }),
  "d6e2.defenses.no-dodge": Object.freeze({
    activeDefense: "unsupported",
    family: "range",
    feint: "second-edition-penalty",
    fullDefense: "second-edition-skill-bonus",
    id: "d6e2.defenses.no-dodge",
    machineDefense: "static-hull",
    melee: "static-parry",
    partialDefense: "unsupported",
    ranged: "fixed-range",
    reaction: "declared-only",
    targeting: "fixed-range",
  }),
  "open-d6.defenses.active": Object.freeze({
    activeDefense: "committed-roll",
    family: "active",
    feint: "unsupported",
    fullDefense: "open-d6-plus-ten",
    id: "open-d6.defenses.active",
    machineDefense: "manual",
    melee: "active-reaction",
    partialDefense: "open-d6-roll",
    ranged: "active-reaction",
    reaction: "triggered-interrupt",
    targeting: "manual",
  }),
  "d6mv.defenses.srp": Object.freeze({
    activeDefense: "unsupported",
    family: "srp",
    feint: "unsupported",
    fullDefense: "d6mv-resistance-skill-bonus",
    id: "d6mv.defenses.srp",
    machineDefense: "manual",
    melee: "static-parry",
    partialDefense: "unsupported",
    ranged: "static-dodge",
    reaction: "declared-only",
    targeting: "actor-static",
  }),
} as const satisfies Readonly<
  Record<D6DefenseRuntimeStrategyId, D6DefenseRuntimeStrategy>
>);

export function defenseRuntimeStrategy(
  strategyId: string,
): D6DefenseRuntimeStrategy {
  return (
    Object.values(DEFENSE_RUNTIME_STRATEGIES).find(
      ({ id }) => id === strategyId,
    ) ?? DEFENSE_RUNTIME_STRATEGIES["d6e2.defenses.static"]
  );
}

export function currentDefenseRuntimeStrategy(): D6DefenseRuntimeStrategy {
  const configured = currentConfiguredRulesProfile().strategies.activeDefenses;
  const concrete =
    configured === "d6e2.defenses.static" &&
    booleanSetting(SECOND_EDITION_OPTION_KEYS.noDodgeDefenseModule, false)
      ? "d6e2.defenses.no-dodge"
      : configured;
  return defenseRuntimeStrategy(concrete);
}
