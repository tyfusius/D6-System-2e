import { describe, expect, it } from "vitest";
import { requireDestinyValue as required } from "@d6-system-2e/core";
import {
  claimFirstEditionActionStage,
  recordFirstEditionActionStage,
} from "./first-edition-action-root";
import {
  advanceMedicalConsumableRoot,
  createMedicalConsumableRoot,
  medicalConsumableRootCanCancel,
  parseMedicalConsumableRoot,
} from "./medical-consumable-root";

function root() {
  return createMedicalConsumableRoot({
    rootMessageId: "medicalroot00001",
    useId: "medicaluse000001",
    initiatorUserId: "owner",
    coordinatorUserId: "gm",
    controllerUserId: "owner",
    administrator: { actorId: "a", actorUuid: "Actor.a" },
    patient: { actorId: "p", actorUuid: "Actor.p" },
    item: {
      actorUuid: "Actor.a",
      itemId: "stim",
      itemUuid: "Actor.a.Item.stim",
      beforeQuantity: 3,
    },
    injury: "wounded",
    rollMode: "blindroll",
    runtime: {
      profileId: "open-d6",
      healthModelId: "open-d6.health.wound-track",
      damageStrategyId: "open-d6.damage.wounds",
      actionEconomyStrategyId: "open-d6.action-economy.flexible",
    },
  });
}

describe("medical consumable initiating root", () => {
  it("records duration before deriving the fixed effect plan", () => {
    let value = root();
    expect(medicalConsumableRootCanCancel(value)).toBe(true);
    const stage = required(value.action.stages[0]);
    value = {
      ...value,
      action: claimFirstEditionActionStage(value.action, stage.id, "owner", {
        kind: "plain-d6",
        dice: 1,
        rollMode: "blindroll",
      }),
    };
    expect(medicalConsumableRootCanCancel(value)).toBe(false);
    value = {
      ...value,
      action: recordFirstEditionActionStage(value.action, stage.id, {
        kind: "plain-d6",
        total: 4,
        faces: [4],
        artifacts: [
          {
            version: 1,
            serialized: "{}",
            evidence: {
              formula: "1d6",
              faces: [4],
              total: 4,
              fingerprint: "a".repeat(64),
            },
          },
        ],
      }),
    };
    expect(medicalConsumableRootCanCancel(value)).toBe(false);
    value = advanceMedicalConsumableRoot(value);
    expect(value.action.stages[1]?.spec).toMatchObject({
      kind: "effect",
      plan: {
        kind: "medical-consumable-use",
        durationRoll: 4,
        durationSeconds: 20,
        beforeQuantity: { value: 3, unit: "doses" },
      },
    });
    expect(parseMedicalConsumableRoot(value)).toEqual(value);
    expect(value.action.stages[0]?.receipt).toMatchObject({
      kind: "plain-d6",
      faces: [4],
      total: 4,
    });
  });

  it("rejects unsupported health bindings before a root exists", () => {
    const current = root();
    expect(() =>
      createMedicalConsumableRoot({
        rootMessageId: "medicalroot00002",
        useId: "medicaluse000002",
        initiatorUserId: "owner",
        coordinatorUserId: "gm",
        controllerUserId: "owner",
        administrator: { actorId: "a", actorUuid: "Actor.a" },
        patient: { actorId: "p", actorUuid: "Actor.p" },
        item: current.item,
        injury: "wounded",
        rollMode: "blindroll",
        runtime: {
          ...current.action.runtime,
          damageStrategyId: "open-d6.damage.body-points",
        },
      }),
    ).toThrow(/invalid/u);
  });
});
