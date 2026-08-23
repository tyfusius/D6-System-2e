import {
  D6_ROLL_CONTRACT_VERSION,
  type D6RollResultV1,
} from "@d6-system-2e/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  damageConditionLabel,
  damageConditionSeverity,
  damageOutcomeLabel,
  damageResolutionResistanceRoll,
  damageResolutionStatus,
  damageScaleContext,
  skipsFirstEditionBodyPointResistanceRoll,
} from "./damage-resolution";
import {
  resetTerminologyRegistryForTests,
  setSettingProfileTerminology,
} from "../../registries/terminology";
import en from "../../../../../lang/en.json";

afterEach(() => {
  resetTerminologyRegistryForTests();
  vi.unstubAllGlobals();
});

function rollResult(
  kind: D6RollResultV1["request"]["kind"],
  application: "attack" | "damage" | "resistance",
): D6RollResultV1 {
  return {
    baseFaces: [4],
    contractVersion: D6_ROLL_CONTRACT_VERSION,
    heroPointAward: 0,
    heroPointSpent: 0,
    pendingChoices: [],
    pool: {
      baseDice: 1,
      bonusOrdinaryDice: 0,
      bonusWildDice: 0,
      code: { dice: 2, pips: 0 },
      resultModifier: 0,
      wildDice: 1,
    },
    profileId: "second-edition",
    request: {
      context: {
        scale: {
          application,
          modifierScore: 0,
          sourceActorId: "attacker",
          sourceName: "Attacker",
          sourcePage: 196,
          sourceRank: 0,
          sourceTokenId: "attacker-token",
          targetActorId: "target",
          targetName: "Target",
          targetRank: 0,
          targetTokenId: "target-token",
        },
      },
      contractVersion: D6_ROLL_CONTRACT_VERSION,
      heroPointUse: "none",
      kind,
      label: "Damage",
      resultModifier: 0,
      rollMode: "publicroll",
      score: 6,
      source: {
        actorId: "attacker",
        actorName: "Attacker",
        attributeId: "agility",
      },
    },
    requiresWildExplosion: false,
    total: 7,
    wildFaces: [3],
    wildPolicy: "second-edition",
    wildOutcome: "normal",
  };
}

describe("Second Edition damage chat workflow", () => {
  it("projects customized incoming and prevented Conditions in Second Edition only", () => {
    vi.stubGlobal("game", {
      i18n: {
        localize: (key: string) => `stock:${key}`,
      },
    });
    setSettingProfileTerminology({
      conditions: {
        states: { stunned: "Shaken", wounded: "Hurt" },
      },
    });

    expect(damageOutcomeLabel("second-edition-conditions", "wounded")).toBe(
      "Hurt",
    );
    expect(damageConditionLabel("second-edition-conditions", "stunned")).toBe(
      "Shaken",
    );
    expect(
      damageOutcomeLabel("second-edition-machine-conditions", "wounded"),
    ).toBe("Hurt");
  });

  it("projects customized First Edition wound labels without affecting Second Edition", () => {
    vi.stubGlobal("game", {
      i18n: {
        localize: (key: string) => `stock:${key}`,
      },
    });
    setSettingProfileTerminology({
      conditions: {
        states: { stunned: "Shaken", wounded: "Hurt" },
      },
      wounds: {
        states: {
          severelyWounded: "Gravely Hurt",
          stunned: "Rattled",
          wounded: "Injured",
        },
      },
    });

    expect(damageOutcomeLabel("open-d6-wound-levels", "wounded")).toBe(
      "Injured",
    );
    expect(damageConditionLabel("open-d6-stun-only", "stunned")).toBe(
      "Rattled",
    );
    expect(
      damageConditionLabel(
        "open-d6-body-points-with-wounds",
        "severely-wounded",
      ),
    ).toBe("Gravely Hurt");
    expect(damageConditionLabel("second-edition-conditions", "wounded")).toBe(
      "Hurt",
    );
  });

  it("parameterizes the prevented-condition prose", () => {
    expect(en["D6E2.Combat.Damage.PreventedSummary"]).toBe(
      "{incoming} would cause {prevented}, but a Hero Point prevented the transition; condition remains {condition}.",
    );
  });

  it("maps applied Conditions to distinct visual severity bands", () => {
    expect(damageConditionSeverity("healthy")).toBe("safe");
    expect(damageConditionSeverity("stunned")).toBe("minor");
    expect(damageConditionSeverity("wounded")).toBe("wounded");
    expect(damageConditionSeverity("severely-wounded")).toBe("wounded");
    expect(damageConditionSeverity("incapacitated")).toBe("critical");
    expect(damageConditionSeverity("mortally-wounded")).toBe("fatal");
    expect(damageConditionSeverity("dead")).toBe("fatal");
  });

  it("projects compact resistance evidence for the original damage card", () => {
    expect(
      damageResolutionResistanceRoll(
        {
          baseFaces: [4, 6, 4],
          characterPointFaces: [],
          difficulty: 27,
          pool: { dice: 4, pips: 0 },
          resultModifier: 0,
          total: 19,
          wildFaces: [5],
          wildOutcome: "normal",
          wildPolicy: "second-edition-classic",
        },
        {
          armorContributors: [
            { itemId: "armor-1", label: "Blast Vest", score: 3 },
          ],
          armorScore: 3,
          baseLabel: "Brawn",
          brawnScore: 9,
          kind: "personal",
          protectionLabel: "Armor",
          sourcePage: 34,
          strategy: "second-edition-conditions",
        },
      ),
    ).toMatchObject({
      armorContributors: [{ label: "Blast Vest", scoreLabel: "1D" }],
      baseLabel: "Brawn",
      baseScoreLabel: "3D",
      difficulty: 27,
      protectionLabel: "Armor",
      protectionScoreLabel: "1D",
      total: 19,
    });
  });
  it("accepts only damage rolls with damage-scale target context", () => {
    expect(damageScaleContext(rollResult("damage", "damage"))).toMatchObject({
      application: "damage",
      targetActorId: "target",
      targetTokenId: "target-token",
    });
    expect(damageScaleContext(rollResult("damage", "attack"))).toBeNull();
    expect(
      damageScaleContext(rollResult("weapon-attack", "damage")),
    ).toBeNull();
  });

  it("recognizes only versioned resolving and applied claims", () => {
    expect(damageResolutionStatus({ status: "resolving", version: 1 })).toBe(
      "resolving",
    );
    expect(damageResolutionStatus({ status: "applied", version: 1 })).toBe(
      "applied",
    );
    expect(
      damageResolutionStatus({ status: "applied", version: 2 }),
    ).toBeNull();
    expect(damageResolutionStatus(null)).toBeNull();
  });

  it("skips an impossible 0D armor roll for unarmored Body Point targets", () => {
    expect(
      skipsFirstEditionBodyPointResistanceRoll("open-d6.damage.body-points", 0),
    ).toBe(true);
    expect(
      skipsFirstEditionBodyPointResistanceRoll(
        "open-d6.damage.body-points-with-wounds",
        0,
      ),
    ).toBe(true);
    expect(
      skipsFirstEditionBodyPointResistanceRoll("open-d6.damage.wounds", 0),
    ).toBe(false);
    expect(
      skipsFirstEditionBodyPointResistanceRoll("open-d6.damage.body-points", 3),
    ).toBe(false);
  });
});
