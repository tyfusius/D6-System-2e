import { describe, expect, it } from "vitest";
import { firstEditionSegmentMovementPlan } from "@d6-system-2e/core";
import { parseRunningBinding } from "./first-edition-segmented-running";
import {
  createFirstEditionRelativeMovement,
  parseFirstEditionRelativeMovement,
} from "./first-edition-relative-movement";
const binding = () => ({
  round: 2,
  actionId: "run",
  spentActionCount: 1,
  plannedActionCount: 3,
  effectiveScores: [9, 12, 12],
  reactive: false,
  plan: firstEditionSegmentMovementPlan({
    baseMove: 10,
    plannedActionCount: 3,
    effectiveScores: [9, 12, 12],
    running: true,
  }),
});
function fixture() {
  return createFirstEditionRelativeMovement({
    rootMessageId: "root",
    operationId: "root",
    controllerUserId: "owner",
    coordinatorUserId: "gm",
    subject: {
      actorId: "actor",
      actorUuid: "Actor.actor",
      sceneId: "scene",
      tokenUuid: "Scene.scene.Token.token",
    },
    runtime: {
      profileId: "first",
      movementStrategyId: "open-d6.movement.segmented",
      actionEconomyStrategyId: "economy",
    },
    combat: {
      uuid: "Combat.combat",
      combatantUuid: "Combat.combat.Combatant.c",
      revision: 2,
    },
    planInput: { baseMove: 10, distance: 3, type: "land" },
    source: { attributeId: "agility" },
    segment: binding(),
    spend: {
      kind: "segment-movement",
      actorUuid: "Actor.actor",
      combatUuid: "Combat.combat",
      combatantUuid: "Combat.combat.Combatant.c",
      expectedRevision: 2,
      actions: { value: 1, unit: "actions" },
      distance: { value: 3, unit: "meters" },
    },
    translation: {
      kind: "token-translation",
      actorUuid: "Actor.actor",
      sceneId: "scene",
      tokenUuid: "Scene.scene.Token.token",
      from: { x: 0, y: 0, unit: "pixels" },
      to: { x: 300, y: 0, unit: "pixels" },
      distance: { value: 3, unit: "meters" },
      measurement: { sceneUnits: "m", gridSize: 100, gridDistance: 1 },
    },
  });
}
describe("versioned Running payload", () => {
  it("keeps planned-count difficulty and bound source separate from queue distance, with idempotent cloning", () => {
    const root = fixture();
    expect(root.version).toBe(2);
    expect(root.plan).toMatchObject({
      difficulty: 15,
      distance: 3,
      rollRequired: true,
      maximumDistance: 6,
    });
    expect(root.action.stages[0]?.spec).toMatchObject({
      kind: "d6-roll",
      purpose: "segment-running",
      source: { attributeId: "agility" },
    });
    const parsed = parseFirstEditionRelativeMovement(root);
    expect(parsed).toEqual(root);
    expect(parsed).not.toBe(root);
    expect(parseFirstEditionRelativeMovement(parsed)).toEqual(root);
  });
  it.each(["3", true, false, 0, -1, 1.5, NaN, Infinity, null])(
    "rejects nonpositive or nonnumeric planned count %s",
    (count) => {
      expect(
        parseRunningBinding({ ...binding(), plannedActionCount: count }, 10),
      ).toBeNull();
    },
  );
  it.each(["2", true, -1, 1.5])(
    "rejects malformed round/spent count %s",
    (value) => {
      expect(
        parseRunningBinding({ ...binding(), round: value }, 10),
      ).toBeNull();
      expect(
        parseRunningBinding({ ...binding(), spentActionCount: value }, 10),
      ).toBeNull();
    },
  );
  it("rejects missing/exhausted source pools and preserves fractional movement", () => {
    expect(
      parseRunningBinding({ ...binding(), effectiveScores: [] }, 10),
    ).toBeNull();
    expect(
      parseRunningBinding({ ...binding(), effectiveScores: [2] }, 10),
    ).toBeNull();
    const fractional = {
      ...binding(),
      plan: firstEditionSegmentMovementPlan({
        baseMove: 5,
        plannedActionCount: 3,
        effectiveScores: [9, 12, 12],
        running: true,
      }),
    };
    expect(parseRunningBinding(fractional, 5)?.plan.normalDistance).toBe(5 / 3);
  });
  it("rejects version confusion, forged distance/cost/source role and premature completion", () => {
    const value = fixture();
    for (const version of [1, 3, "2"])
      expect(
        parseFirstEditionRelativeMovement({ ...value, version }),
      ).toBeNull();
    for (const edit of [
      { segment: undefined },
      {
        segment: {
          ...binding(),
          plan: { ...binding().plan, runningDifficulty: 10 },
        },
      },
      { planInput: { ...value.planInput, type: "swim" } },
      { plan: { ...value.plan, rollRequired: false } },
      { spend: { ...value.spend, kind: "action-spend" } },
      { spend: { ...value.spend, actions: { value: 2, unit: "actions" } } },
      {
        translation: {
          ...value.translation,
          distance: { value: 4, unit: "meters" },
        },
      },
      { action: { ...value.action, status: "complete" } },
    ])
      expect(
        parseFirstEditionRelativeMovement({ ...value, ...edit }),
      ).toBeNull();
  });
});
