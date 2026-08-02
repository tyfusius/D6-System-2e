import { describe, expect, it } from "vitest";
import { firstEditionSegmentPlan } from "./first-edition-action-segments";

describe("First Edition interleaved action segments", () => {
  it("waits until every initiative participant has declared", () => {
    expect(
      firstEditionSegmentPlan([
        {
          actionCount: 2,
          combatantId: "fast",
          declared: true,
          label: "Fast",
          spentActionCount: 0,
        },
        {
          actionCount: 0,
          combatantId: "slow",
          declared: false,
          label: "Slow",
          spentActionCount: 0,
        },
      ]),
    ).toMatchObject({
      ready: false,
      waitingCombatantIds: ["slow"],
      waitingLabels: ["Slow"],
    });
  });

  it("resolves each segment through initiative order before the next", () => {
    const participants = [
      {
        actionCount: 3,
        combatantId: "fast",
        declared: true,
        label: "Fast",
        spentActionCount: 1,
      },
      {
        actionCount: 2,
        combatantId: "middle",
        declared: true,
        label: "Middle",
        spentActionCount: 0,
      },
      {
        actionCount: 1,
        combatantId: "slow",
        declared: true,
        label: "Slow",
        spentActionCount: 0,
      },
    ] as const;

    expect(firstEditionSegmentPlan(participants)).toMatchObject({
      currentSegment: 1,
      nextCombatantId: "middle",
    });
    expect(
      firstEditionSegmentPlan([
        participants[0],
        { ...participants[1], spentActionCount: 1 },
        { ...participants[2], spentActionCount: 1 },
      ]),
    ).toMatchObject({ currentSegment: 2, nextCombatantId: "fast" });
  });

  it("lets a pre-turn reaction spend only the reacting actor's segment", () => {
    expect(
      firstEditionSegmentPlan([
        {
          actionCount: 4,
          combatantId: "attacker",
          declared: true,
          label: "Attacker",
          spentActionCount: 0,
        },
        {
          actionCount: 2,
          combatantId: "reactor",
          declared: true,
          label: "Reactor",
          spentActionCount: 1,
        },
      ]),
    ).toMatchObject({
      currentSegment: 1,
      nextCombatantId: "attacker",
    });
  });

  it("reports completion after every declared action is spent", () => {
    expect(
      firstEditionSegmentPlan([
        {
          actionCount: 2,
          combatantId: "one",
          declared: true,
          label: "One",
          spentActionCount: 2,
        },
        {
          actionCount: 1,
          combatantId: "two",
          declared: true,
          label: "Two",
          spentActionCount: 1,
        },
      ]),
    ).toMatchObject({ complete: true, currentSegment: 2, ready: true });
  });
});
