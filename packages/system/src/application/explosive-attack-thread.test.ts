import { describe, expect, it } from "vitest";
import {
  D6_ROLL_CONTRACT_VERSION,
  type D6RollResultV1,
} from "@d6-system-2e/core";
import {
  claimD6ExplosiveZoneDamage,
  completeD6ExplosiveTarget,
  completeD6ExplosiveZoneDamage,
  createD6ExplosiveAttackThread,
  d6ExplosiveAttackThreadComplete,
  parseD6ExplosiveAttackThread,
  recoverD6ExplosiveAttackThread,
  releaseD6ExplosiveZoneDamage,
  setD6ExplosiveTargetStage,
} from "./explosive-attack-thread";

function result(total = 12): D6RollResultV1 {
  return {
    baseFaces: [4, 3],
    contractVersion: D6_ROLL_CONTRACT_VERSION,
    heroPointAward: 0,
    heroPointSpent: 0,
    pendingChoices: [],
    pool: {
      baseDice: 2,
      bonusOrdinaryDice: 0,
      bonusWildDice: 0,
      code: { dice: 3, pips: 0 },
      resultModifier: 0,
      wildDice: 1,
    },
    profileId: "second-edition",
    request: {
      contractVersion: D6_ROLL_CONTRACT_VERSION,
      heroPointUse: "none",
      kind: "damage",
      label: "Zone damage",
      resultModifier: 0,
      rollMode: "publicroll",
      score: 9,
      source: { actorId: "thrower", actorName: "Thrower", attributeId: "" },
    },
    requiresWildExplosion: false,
    total,
    wildFaces: [5],
    wildPolicy: "second-edition",
    wildOutcome: "normal",
  };
}

function thread() {
  return createD6ExplosiveAttackThread({
    aimedPoint: { x: 100, y: 100 },
    attackHit: false,
    attackMessageId: "attack-message",
    damageKind: "physical",
    regionId: "region",
    requestId: "request",
    resolvedPoint: { x: 120, y: 90 },
    rollMode: "publicroll",
    sceneId: "scene",
    targets: [
      {
        actorId: "visible-actor",
        actorImg: "visible.webp",
        actorName: "Visible Target",
        targetKey: "visible-key",
        tokenId: "visible-token",
        visible: true,
        zone: 1,
      },
      { targetKey: "hidden-key", visible: false, zone: 2 },
      {
        actorId: "safe-actor",
        actorName: "Outside Damage",
        targetKey: "safe-key",
        tokenId: "safe-token",
        visible: true,
        zone: 3,
      },
    ],
    zoneDamageScores: { 1: 12, 2: 9, 3: 0 },
  });
}

describe("typed explosive attack thread", () => {
  it("creates one pending zone stage per occupied damaging zone and redacts hidden refs", () => {
    const created = thread();
    expect(created.zones).toMatchObject([
      { damageScore: 12, stage: "pending", zone: 1 },
      { damageScore: 9, stage: "pending", zone: 2 },
    ]);
    expect(created.targets[1]).toEqual({
      stage: "awaiting-damage",
      targetKey: "hidden-key",
      visible: false,
      zone: 2,
    });
    expect(created.targets[2]?.stage).toBe("no-damage");
    expect(parseD6ExplosiveAttackThread(structuredClone(created))).toEqual(
      created,
    );
  });

  it("claims once, restores cancellation, and advances to resistance only after damage rolls", () => {
    const claimed = claimD6ExplosiveZoneDamage(thread(), 1);
    expect(claimed.zones[0]?.stage).toBe("rolling");
    expect(() => claimD6ExplosiveZoneDamage(claimed, 1)).toThrow();
    expect(releaseD6ExplosiveZoneDamage(claimed, 1).zones[0]?.stage).toBe(
      "pending",
    );

    const rolled = completeD6ExplosiveZoneDamage(claimed, 1, result());
    expect(rolled.zones[0]).toMatchObject({
      stage: "rolled",
      result: { total: 12 },
    });
    expect(rolled.targets[0]).toMatchObject({
      damageTotal: 12,
      stage: "pending-resistance",
    });
  });

  it("completes only after every damage zone and target reaches a terminal stage", () => {
    let current = thread();
    current = completeD6ExplosiveZoneDamage(
      claimD6ExplosiveZoneDamage(current, 1),
      1,
      result(12),
    );
    current = setD6ExplosiveTargetStage(current, "visible-key", "resolving");
    current = completeD6ExplosiveTarget(current, "visible-key", {
      conditionLabel: "Wounded",
      healthStateId: "wounded",
      resistanceRoll: {
        baseFaces: [4, 3],
        pool: { dice: 3, pips: 0 },
        resultModifier: 0,
        wildFaces: [5],
        wildOutcome: "normal",
      },
      resistanceTotal: 7,
    });
    expect(current.targets[0]?.resistanceRoll?.wildOutcome).toBe("normal");
    expect(current.targets[0]?.healthStateId).toBe("wounded");
    expect(d6ExplosiveAttackThreadComplete(current)).toBe(false);
    current = completeD6ExplosiveZoneDamage(
      claimD6ExplosiveZoneDamage(current, 2),
      2,
      result(8),
    );
    current = setD6ExplosiveTargetStage(current, "hidden-key", "resolving");
    current = completeD6ExplosiveTarget(current, "hidden-key", {
      conditionLabel: "Stunned",
      healthStateId: "stunned",
      resistanceTotal: 6,
    });
    expect(current.targets[1]).not.toHaveProperty("conditionLabel");
    expect(current.targets[1]).not.toHaveProperty("healthStateId");
    expect(d6ExplosiveAttackThreadComplete(current)).toBe(true);
  });

  it("recovers only uncommitted dialog stages after reload", () => {
    const rolling = claimD6ExplosiveZoneDamage(thread(), 1);
    const recovered = recoverD6ExplosiveAttackThread(rolling);
    expect(recovered.zones[0]?.stage).toBe("pending");
    const rolled = completeD6ExplosiveZoneDamage(
      claimD6ExplosiveZoneDamage(recovered, 1),
      1,
      result(),
    );
    expect(recoverD6ExplosiveAttackThread(rolled).zones[0]?.stage).toBe(
      "rolled",
    );
  });

  it("compatibility-normalizes a v1 thread without result evidence but rejects malformed evidence", () => {
    const legacy: Record<string, unknown> = { ...structuredClone(thread()) };
    Reflect.deleteProperty(legacy, "results");
    expect(parseD6ExplosiveAttackThread(legacy)?.results.entries).toEqual([]);
    expect(
      parseD6ExplosiveAttackThread({ ...thread(), results: { version: 1 } }),
    ).toBeNull();
  });
});
