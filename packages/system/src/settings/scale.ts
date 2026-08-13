import {
  openD6ScaleInteraction,
  secondEditionScaleInteraction,
  type OpenD6ScaleSide,
  type SecondEditionScaleInteraction,
  type D6RulesProfileV1,
} from "@d6-system-2e/core";
import { currentConfiguredRulesProfile } from "./rules-profile-library";
import {
  OPEN_D6_SCALE_STRATEGY_ID,
  SECOND_EDITION_SCALE_STRATEGY_ID,
} from "./scale-strategy-ids";

export {
  OPEN_D6_SCALE_STRATEGY_ID,
  SECOND_EDITION_SCALE_STRATEGY_ID,
} from "./scale-strategy-ids";

export type ScaleRuntimeSide = OpenD6ScaleSide | "unresolved";

export interface ScaleRuntimeInteraction extends SecondEditionScaleInteraction {
  readonly resolved?: boolean;
}

export interface ScaleRuntimeStrategy {
  readonly family: "ranked" | "scalar";
  readonly id: string;
  readonly sourcePage: number;
  interaction(
    sourceValue: number,
    targetValue: number,
    sourceSide?: ScaleRuntimeSide,
    targetSide?: ScaleRuntimeSide,
  ): ScaleRuntimeInteraction;
}

const SECOND_EDITION_SCALE_STRATEGY: ScaleRuntimeStrategy = Object.freeze({
  family: "ranked" as const,
  id: SECOND_EDITION_SCALE_STRATEGY_ID,
  interaction: secondEditionScaleInteraction,
  sourcePage: 196,
});

const UNRESOLVED_SCALE_INTERACTION: ScaleRuntimeInteraction = Object.freeze({
  attackerAttackBonusScore: 0,
  attackerDamageBonusScore: 0,
  difference: 0,
  resolved: false,
  targetDodgeBonus: 0,
  targetResistanceBonusScore: 0,
});

const OPEN_D6_SCALE_STRATEGY: ScaleRuntimeStrategy = Object.freeze({
  family: "scalar" as const,
  id: OPEN_D6_SCALE_STRATEGY_ID,
  interaction(
    sourceValue: number,
    targetValue: number,
    sourceSide?: ScaleRuntimeSide,
    targetSide?: ScaleRuntimeSide,
  ) {
    if (
      sourceSide === undefined ||
      targetSide === undefined ||
      sourceSide === "unresolved" ||
      targetSide === "unresolved"
    ) {
      return UNRESOLVED_SCALE_INTERACTION;
    }
    try {
      return openD6ScaleInteraction(
        { magnitude: sourceValue, side: sourceSide },
        { magnitude: targetValue, side: targetSide },
      );
    } catch {
      return UNRESOLVED_SCALE_INTERACTION;
    }
  },
  sourcePage: 83,
});

export function scaleRuntimeStrategy(
  id: string | undefined,
): ScaleRuntimeStrategy {
  if (id === SECOND_EDITION_SCALE_STRATEGY_ID) {
    return SECOND_EDITION_SCALE_STRATEGY;
  }
  if (id === OPEN_D6_SCALE_STRATEGY_ID) return OPEN_D6_SCALE_STRATEGY;
  return SECOND_EDITION_SCALE_STRATEGY;
}

export function currentScaleRuntimeStrategy(
  profile: D6RulesProfileV1 = currentConfiguredRulesProfile(),
): ScaleRuntimeStrategy {
  return scaleRuntimeStrategy(profile.strategies.scale);
}
