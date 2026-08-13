import { describe, expect, it } from "vitest";
import {
  currentScaleRuntimeStrategy,
  OPEN_D6_SCALE_STRATEGY_ID,
  scaleRuntimeStrategy,
  SECOND_EDITION_SCALE_STRATEGY_ID,
} from "./scale";

describe("Rules Profile-owned scale runtime", () => {
  it("preserves the verified Second Edition ranked interaction exactly", () => {
    const strategy = currentScaleRuntimeStrategy({
      strategies: { scale: SECOND_EDITION_SCALE_STRATEGY_ID },
    } as never);

    expect(strategy).toMatchObject({
      family: "ranked",
      id: SECOND_EDITION_SCALE_STRATEGY_ID,
      sourcePage: 196,
    });
    expect(strategy.interaction(0, 2)).toEqual({
      attackerAttackBonusScore: 6,
      attackerDamageBonusScore: 0,
      difference: 2,
      targetDodgeBonus: 0,
      targetResistanceBonusScore: 6,
    });
    expect(strategy.interaction(3, 1)).toEqual({
      attackerAttackBonusScore: 0,
      attackerDamageBonusScore: 6,
      difference: 2,
      targetDodgeBonus: 6,
      targetResistanceBonusScore: 0,
    });
  });

  it("preserves exact Open D6 scalar pips and remains inert when unresolved", () => {
    const strategy = scaleRuntimeStrategy(OPEN_D6_SCALE_STRATEGY_ID);
    expect(strategy).toMatchObject({
      family: "scalar",
      id: OPEN_D6_SCALE_STRATEGY_ID,
      sourcePage: 83,
    });
    expect(strategy.interaction(0, 20, "human", "larger")).toEqual({
      attackerAttackBonusScore: 20,
      attackerDamageBonusScore: 0,
      difference: 20,
      targetDodgeBonus: 0,
      targetResistanceBonusScore: 20,
    });
    expect(strategy.interaction(3, 18, "smaller", "larger").difference).toBe(
      21,
    );
    expect(strategy.interaction(0, 183, "human", "unresolved")).toMatchObject({
      difference: 0,
      resolved: false,
    });
    expect(strategy.interaction(3, 0, "human", "human")).toMatchObject({
      difference: 0,
      resolved: false,
    });
  });

  it("falls back safely for legacy or unavailable strategy identifiers", () => {
    expect(scaleRuntimeStrategy(undefined).id).toBe(
      SECOND_EDITION_SCALE_STRATEGY_ID,
    );
    expect(scaleRuntimeStrategy("module.scale.unavailable").id).toBe(
      SECOND_EDITION_SCALE_STRATEGY_ID,
    );
  });
});
