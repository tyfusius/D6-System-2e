import { describe, expect, it } from "vitest";
import type { D6FreeD6CreationDraftV1 } from "../contracts/free-d6-creation";
import {
  FREE_D6_CREATION_STRATEGY_ID,
  finalizeFreeD6CreationDraft,
  freeD6AdvancedSkillCreationCost,
  freeD6AttributePipCost,
  freeD6CreationLedger,
  freeD6CreationTransaction,
  freeD6PointUnits,
  freeD6SkillPipCost,
  updateFreeD6CreationDraft,
} from "./free-d6-creation";

function draft(templatePoints = 0): D6FreeD6CreationDraftV1 {
  return Object.freeze({
    baselineAttributeScores: Object.freeze({}),
    baselineSkillScores: Object.freeze({}),
    budgetUnits: freeD6PointUnits(30),
    finalized: false,
    revision: 0,
    strategyId: FREE_D6_CREATION_STRATEGY_ID,
    templateId: "free-d6.template",
    templatePointUnits: freeD6PointUnits(templatePoints),
    transactions: Object.freeze([]),
    version: 1,
  });
}

describe("FreeD6 Creation Point ledger", () => {
  it("uses source costs for Attribute and Skill pips and Advanced Skills", () => {
    expect(freeD6AttributePipCost()).toBe(10);
    expect(freeD6SkillPipCost()).toBe(1);
    expect(freeD6AdvancedSkillCreationCost(3, 9, true)).toBe(3);
    expect(freeD6AdvancedSkillCreationCost(6, 9, false)).toBe(0.5);
    expect(freeD6AdvancedSkillCreationCost(10, 9, false)).toBe(1);
  });

  it("subtracts positive Template Points and adds negative Template Points", () => {
    expect(freeD6CreationLedger(draft(10)).remainingUnits).toBe(
      freeD6PointUnits(20),
    );
    expect(freeD6CreationLedger(draft(-5)).remainingUnits).toBe(
      freeD6PointUnits(35),
    );
  });

  it("tracks Merit debit and Flaw credit as named transactions", () => {
    let current = updateFreeD6CreationDraft(
      draft(5),
      freeD6CreationTransaction({
        id: "merit:1",
        kind: "merit",
        label: "Merit",
        points: 3,
        sourceId: "world/merit",
      }),
      0,
    );
    current = updateFreeD6CreationDraft(
      current,
      freeD6CreationTransaction({
        id: "flaw:1",
        kind: "flaw",
        label: "Flaw",
        points: -2,
        sourceId: "world/flaw",
      }),
      1,
    );
    expect(freeD6CreationLedger(current)).toMatchObject({
      remainingUnits: freeD6PointUnits(24),
      characterPointSeedUnits: freeD6PointUnits(29),
    });
  });

  it("is idempotent for an identical transaction and rejects conflicting reuse", () => {
    const transaction = freeD6CreationTransaction({
      id: "skill:1",
      kind: "skill",
      label: "Skill pip",
      points: 1,
      sourceId: "skill:1",
    });
    const once = updateFreeD6CreationDraft(draft(), transaction, 0);
    expect(updateFreeD6CreationDraft(once, transaction, 1)).toBe(once);
    expect(() =>
      updateFreeD6CreationDraft(
        once,
        { ...transaction, pointUnits: freeD6PointUnits(2) },
        1,
      ),
    ).toThrow("D6E2.Creation.Error.TransactionConflict");
  });

  it("blocks over-budget finalization and accepts a balanced review", () => {
    const overspent = updateFreeD6CreationDraft(
      draft(),
      freeD6CreationTransaction({
        id: "attribute:1",
        kind: "attribute",
        label: "Attribute",
        points: 40,
        sourceId: "agility",
      }),
      0,
    );
    expect(() => finalizeFreeD6CreationDraft(overspent, 1)).toThrow(
      "D6E2.Creation.Error.OverBudget",
    );
    expect(finalizeFreeD6CreationDraft(draft(), 0)).toMatchObject({
      finalized: true,
      revision: 1,
    });
  });
});
