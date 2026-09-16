import { requireDestinyValue as required } from "@d6-system-2e/core";
import { describe, expect, it } from "vitest";
import { resolveD6Roll, type D6RollRequestV1 } from "@d6-system-2e/core";
import {
  advanceFirstEditionBodyPointRoot,
  bodyPointTreatmentOutcome,
  createFirstEditionBodyPointRoot,
  parseFirstEditionBodyPointRoot,
  type FirstEditionBodyPointRoot,
} from "./first-edition-body-point-root";
import {
  claimFirstEditionActionStage,
  recordFirstEditionActionStage,
} from "./first-edition-action-root";
function root(
  minutes = 5,
  current = 0,
  maximum = 20,
  operation: "natural" | "assisted" = "assisted",
) {
  return createFirstEditionBodyPointRoot({
    rootMessageId: "abcdefghijklmnop",
    initiatorUserId: "owner",
    patientControllerUserId: "patient-owner",
    coordinatorUserId: "gm",
    patient: { actorId: "patient", actorUuid: "Actor.patient" },
    ...(operation === "assisted"
      ? { healer: { actorId: "healer", actorUuid: "Actor.healer" } }
      : {}),
    operation,
    before: { current, maximum },
    minutes,
    restModifierScore: 0,
    source: {
      attributeId: "brawn",
      ...(operation === "assisted" ? { itemId: "medicine" } : {}),
    },
    survivalSource: { attributeId: "brawn", itemId: "stamina" },
    runtime: {
      profileId: "open-d6",
      healthModelId: "open-d6.health.body-points",
      damageStrategyId: "open-d6.damage.body-points",
    },
  });
}
function record(
  value: FirstEditionBodyPointRoot,
  total = 5,
): FirstEditionBodyPointRoot {
  const stage = value.action.stages.find((s) => s.state !== "recorded");
  if (!stage) throw Error("stage");
  if (stage.spec.kind === "effect") {
    const action = claimFirstEditionActionStage(
      value.action,
      stage.id,
      stage.spec.controllerUserId,
      { kind: "effect" },
    );
    return {
      ...value,
      action: recordFirstEditionActionStage(action, stage.id, {
        kind: "effect",
        plan: stage.spec.plan,
        receiptKey: `${stage.id}:effect`,
        authorityReceiptId: "proof",
        outcome: "applied",
      }),
    };
  }
  if (stage.spec.kind === "plain-d6") {
    const action = claimFirstEditionActionStage(
      value.action,
      stage.id,
      stage.spec.controllerUserId,
      { kind: "plain-d6", dice: stage.spec.dice, rollMode: "selfroll" },
    );
    const dice = stage.spec.dice;
    const faces = Array.from({ length: dice }, () => total / dice);
    return {
      ...value,
      action: recordFirstEditionActionStage(action, stage.id, {
        kind: "plain-d6",
        total,
        faces,
        artifacts: [
          {
            version: 1,
            serialized: "amount",
            evidence: {
              faces,
              total,
              formula: `${stage.spec.dice}d6`,
              fingerprint: "a".repeat(64),
            },
          },
        ],
      }),
    };
  }
  const request: D6RollRequestV1 = {
    contractVersion: 2,
    kind: stage.spec.source.itemId ? "skill" : "attribute",
    label: "Check",
    score: 6,
    resultModifier: total - 6,
    heroPointUse: "none",
    rollMode: "selfroll",
    source: { ...stage.spec.subject, ...stage.spec.source, actorName: "Actor" },
    ...(stage.spec.fixedDifficulty === undefined
      ? {}
      : { difficulty: stage.spec.fixedDifficulty }),
  };
  const runtime = {
    profileId: "open-d6",
    successEvaluator: "first-edition-meets" as const,
    wildPolicy: "first-edition" as const,
  };
  const action = claimFirstEditionActionStage(
    value.action,
    stage.id,
    stage.spec.controllerUserId,
    { kind: "d6-roll", request, runtime },
  );
  return {
    ...value,
    action: recordFirstEditionActionStage(action, stage.id, {
      kind: "d6-roll",
      result: resolveD6Roll({
        ...runtime,
        request,
        baseFaces: [4],
        wildFaces: [2],
      }),
      artifacts: [
        {
          version: 1,
          serialized: "check",
          evidence: {
            faces: [4, 2],
            total: 6,
            formula: "2d6",
            fingerprint: "a".repeat(64),
          },
        },
      ],
    }),
  };
}
const next = (v: FirstEditionBodyPointRoot, total = 5) =>
  advanceFirstEditionBodyPointRoot(record(v, total));
describe("Body Point root source ordering and validation", () => {
  it.each([
    [4, 0],
    [5, 1],
    [10, 1],
    [11, 2],
    [15, 2],
    [16, 0],
  ] as const)("preserves %i-minute rescue and %iD loss", (minutes, loss) => {
    let value = next(root(minutes));
    expect(parseFirstEditionBodyPointRoot(value)).toEqual(value);
    expect(value.fixedAmount?.points).toBe(2);
    if (minutes > 4 && minutes <= 15) {
      expect(bodyPointTreatmentOutcome(value)).toBeNull();
      expect(value.action.stages.at(-1)?.spec).toMatchObject({
        purpose: "survival",
        controllerUserId: "patient-owner",
        source: { itemId: "stamina" },
        fixedDifficulty: minutes,
      });
      value = next(value, minutes);
    }
    expect(bodyPointTreatmentOutcome(value)).toMatchObject({
      rescue: minutes > 15 ? "dead" : "rescued",
      skillLossDice: loss,
    });
    value = next(value);
    if (loss) {
      expect(value.action.status).toBe("open");
      expect(value.action.stages.at(-1)?.spec).toMatchObject({
        kind: "effect",
        plan: { kind: "body-point-skill-loss", lossScore: loss * 3 },
      });
      value = next(value);
    }
    expect(value.action.status).toBe("complete");
    expect(parseFirstEditionBodyPointRoot(value)).toEqual(value);
  });
  it("separates failed survival from unresolved rescue and omits Skill loss on failure", () => {
    let value = next(root());
    expect(bodyPointTreatmentOutcome(value)).toBeNull();
    value = next(value, 4);
    expect(bodyPointTreatmentOutcome(value)).toMatchObject({
      rescue: "dead",
      gain: 0,
      current: -20,
      skillLossDice: 0,
    });
    value = next(value);
    expect(value.action.status).toBe("complete");
    expect(value.action.stages).toHaveLength(3);
  });
  it("preserves plain amount vs capped gain without ordinary D6 semantics", () => {
    let value = next(root(0, 19, 20), 15);
    expect(value.action.stages.at(-1)?.spec).toMatchObject({
      kind: "plain-d6",
      dice: 2,
      purpose: "body-point-amount",
    });
    value = next(value, 12);
    expect(bodyPointTreatmentOutcome(value)).toMatchObject({
      amount: 12,
      gain: 1,
      current: 20,
    });
    expect(value.fixedAmount).toBeUndefined();
    expect(parseFirstEditionBodyPointRoot(value)).toEqual(value);
  });
  it("does not run assisted survival branches for natural healing", () => {
    const value = next(root(15, 0, 20, "natural"));
    expect(value.action.stages.at(-1)?.spec.kind).toBe("effect");
    expect(bodyPointTreatmentOutcome(value)).toMatchObject({
      rescue: "not-needed",
      skillLossDice: 0,
    });
  });
  it("retains zero recovery as a fixed result without dice", () => {
    const value = next(root(0), 0);
    expect(value.fixedAmount?.points).toBe(0);
    expect(value.action.stages).toHaveLength(2);
    expect(bodyPointTreatmentOutcome(value)?.gain).toBe(0);
  });
  it("rejects forged amount, premature success and a wrong survival subject", () => {
    const value = next(root());
    expect(
      parseFirstEditionBodyPointRoot({
        ...value,
        fixedAmount: { ...value.fixedAmount, points: 200 },
      }),
    ).toBeNull();
    expect(
      parseFirstEditionBodyPointRoot({
        ...value,
        action: { ...value.action, status: "complete" },
      }),
    ).toBeNull();
    const stages = structuredClone(value.action.stages);
    const last = required(stages.at(-1));
    Object.assign(last.spec, {
      subject: { actorId: "healer", actorUuid: "Actor.healer" },
    });
    expect(
      parseFirstEditionBodyPointRoot({
        ...value,
        action: { ...value.action, stages },
      }),
    ).toBeNull();
  });
});
