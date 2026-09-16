import { describe, expect, it } from "vitest";
import {
  advanceModelBStimCampaignClock,
  advanceModelBStimCombatClock,
  enterModelBStimCombat,
  leaveModelBStimCombat,
  medicalTreatmentDifficulty,
  modelBStimAdjustedConditionPenalty,
  modelBStimInitialState,
  modelBStimProjection,
} from "./medical-consumables";

const initial = (durationRoll = 4) =>
  modelBStimInitialState({
    campaignTime: 100,
    combatRound: 7,
    combatUuid: "Combat.c",
    durationRoll,
    rootMessageId: "root",
    sourceActorUuid: "Actor.healer",
    sourceItemName: "Standard stim",
    sourceItemUuid: "Actor.healer.Item.stim",
    useId: "use",
  });

describe("Model B stim timing", () => {
  it("expires at entry to R+N and ignores duplicate/rewound rounds", () => {
    const one = initial(1);
    expect(advanceModelBStimCombatClock(one, "Combat.c", 7)).toBe(one);
    expect(advanceModelBStimCombatClock(one, "Combat.c", 6)).toBe(one);
    expect(advanceModelBStimCombatClock(one, "Combat.other", 8)).toBe(one);
    expect(
      advanceModelBStimCombatClock(one, "Combat.c", 8).remainingSeconds,
    ).toBe(0);
  });

  it("debits forward jumps once and never refunds a rewind", () => {
    const jumped = advanceModelBStimCombatClock(initial(6), "Combat.c", 10);
    expect(jumped.remainingSeconds).toBe(15);
    expect(advanceModelBStimCombatClock(jumped, "Combat.c", 8)).toBe(jumped);
    expect(
      advanceModelBStimCombatClock(jumped, "Combat.c", 11).remainingSeconds,
    ).toBe(10);
  });

  it("uses only campaign progress outside combat and preserves fractional credit", () => {
    const campaign = leaveModelBStimCombat(initial(), {
      campaignTime: 100.5,
      combatUuid: "Combat.c",
      round: 8,
    });
    expect(campaign.remainingSeconds).toBe(15);
    const elapsed = advanceModelBStimCampaignClock(campaign, 103.25);
    expect(elapsed.remainingSeconds).toBe(12.25);
    const entered = enterModelBStimCombat(elapsed, {
      campaignTime: 104.25,
      combatUuid: "Combat.next",
      round: 2,
    });
    expect(entered.remainingSeconds).toBe(11.25);
    expect(
      advanceModelBStimCombatClock(entered, "Combat.next", 5).remainingSeconds,
    ).toBe(0);
  });

  it("preserves campaign high-water credit across rewound combat handoffs", () => {
    const campaign = leaveModelBStimCombat(initial(6), {
      campaignTime: 110,
      combatUuid: "Combat.c",
      round: 8,
    });
    const entered = enterModelBStimCombat(campaign, {
      campaignTime: 90,
      combatUuid: "Combat.next",
      round: 1,
    });
    const left = leaveModelBStimCombat(entered, {
      campaignTime: 90,
      combatUuid: "Combat.next",
      round: 1,
    });
    expect(left.clock.campaignHighWater).toBe(110);
    expect(advanceModelBStimCampaignClock(left, 95)).toBe(left);
  });

  it("never uses wall time when campaign time is unavailable", () => {
    const state = modelBStimInitialState({
      campaignTime: null,
      combatRound: null,
      combatUuid: null,
      durationRoll: 6,
      rootMessageId: "root",
      sourceActorUuid: "Actor.a",
      sourceItemName: "Stim",
      sourceItemUuid: "Actor.s.Item.i",
      useId: "use",
    });
    expect(state.clock).toMatchObject({
      mode: "unresolved",
      unresolvedReason: "invalid-world-time",
    });
    expect(state.remainingSeconds).toBe(30);
  });

  it("does not silently repair an unresolved clock through combat hooks", () => {
    const unresolved = modelBStimInitialState({
      campaignTime: null,
      combatRound: null,
      combatUuid: null,
      durationRoll: 4,
      rootMessageId: "root",
      sourceActorUuid: "Actor.patient",
      sourceItemName: "Model B Stim",
      sourceItemUuid: "Actor.admin.Item.stim",
      useId: "use",
    });
    expect(
      enterModelBStimCombat(unresolved, {
        campaignTime: 100,
        combatUuid: "Combat.one",
        round: 2,
      }),
    ).toBe(unresolved);
    expect(
      leaveModelBStimCombat(unresolved, {
        campaignTime: 100,
        combatUuid: "Combat.one",
        round: 2,
      }),
    ).toBe(unresolved);
  });
});

describe("Model B suppression and self-treatment", () => {
  it("suppresses only eligible wound penalties while enabled", () => {
    expect(
      modelBStimProjection(initial(), "wounded", 3, true)
        .suppressedPenaltyScore,
    ).toBe(3);
    expect(
      modelBStimProjection(initial(), "incapacitated", 9, true)
        .suppressedPenaltyScore,
    ).toBe(0);
    expect(
      modelBStimProjection(initial(), "wounded", 3, false)
        .suppressedPenaltyScore,
    ).toBe(0);
    expect(
      modelBStimProjection(initial(), "wounded", 3, true, false)
        .suppressedPenaltyScore,
    ).toBe(0);
    const unresolved = modelBStimInitialState({
      campaignTime: null,
      combatRound: null,
      combatUuid: null,
      durationRoll: 1,
      rootMessageId: "root",
      sourceActorUuid: "Actor.a",
      sourceItemName: "Stim",
      sourceItemUuid: "Actor.a.Item.i",
      useId: "unresolved",
    });
    expect(
      modelBStimProjection(unresolved, "wounded", 3, true).applicable,
    ).toBe(false);
  });

  it("subtracts only the wound term and leaves stun, action, and environment penalties additive", () => {
    const condition = modelBStimAdjustedConditionPenalty({
      woundPenaltyScore: 3,
      suppressedWoundPenaltyScore: 3,
      stunPenaltyScore: 6,
    });
    expect(condition).toBe(6);
    expect(condition + 3 + 6).toBe(15);
    expect(
      modelBStimAdjustedConditionPenalty({
        woundPenaltyScore: 3,
        suppressedWoundPenaltyScore: 0,
        stunPenaltyScore: 6,
      }),
    ).toBe(9);
  });

  it("raises self-treatment by category using the configured ladder", () => {
    const ladder = [
      { id: "very-easy", label: "Routine", value: 4 },
      { id: "easy", label: "Easy", value: 9 },
      { id: "moderate", label: "Moderate", value: 14 },
      { id: "difficult", label: "Difficult", value: 23 },
      { id: "very-difficult", label: "Very Difficult", value: 31 },
      { id: "heroic", label: "Heroic", value: 47 },
    ] as const;
    expect(
      medicalTreatmentDifficulty({
        family: "open-d6-space",
        ladder,
        printedBaseValue: 15,
        selfTreatment: true,
        wound: "wounded",
      }),
    ).toEqual({
      baseCategory: "moderate",
      baseValue: 15,
      finalCategory: "difficult",
      finalValue: 23,
      selfTreatment: true,
      treatmentFamily: "open-d6-space",
    });
    expect(
      medicalTreatmentDifficulty({
        family: "reup-medpac",
        ladder,
        printedBaseValue: 10,
        selfTreatment: false,
        wound: "wounded",
      }).finalValue,
    ).toBe(10);
    expect(
      medicalTreatmentDifficulty({
        family: "open-d6-space",
        ladder: [
          ladder[0],
          ladder[1],
          ladder[2],
          { id: "challenging", label: "Challenging", value: 19 },
          ladder[3],
          ladder[4],
          ladder[5],
        ],
        printedBaseValue: 15,
        selfTreatment: true,
        wound: "wounded",
      }),
    ).toMatchObject({ finalCategory: "challenging", finalValue: 19 });
  });

  it("fails closed when self-treatment has no valid strictly higher category", () => {
    const ladder = [
      { id: "very-easy", label: "Very Easy", value: 5 },
      { id: "easy", label: "Easy", value: 10 },
      { id: "moderate", label: "Moderate", value: 15 },
      { id: "difficult", label: "Difficult", value: 20 },
      { id: "very-difficult", label: "Very Difficult", value: 30 },
      { id: "heroic", label: "Heroic", value: 35 },
    ] as const;
    expect(() =>
      medicalTreatmentDifficulty({
        family: "open-d6-space",
        ladder,
        printedBaseValue: 25,
        selfTreatment: true,
        wound: "dead",
      }),
    ).toThrow(/strictly higher/u);
    expect(() =>
      medicalTreatmentDifficulty({
        family: "open-d6-space",
        ladder: ladder.filter(({ id }) => id !== "moderate"),
        printedBaseValue: 15,
        selfTreatment: true,
        wound: "wounded",
      }),
    ).toThrow(/unavailable or invalid/u);
  });
});
