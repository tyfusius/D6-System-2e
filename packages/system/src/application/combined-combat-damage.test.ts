import { describe, expect, it } from "vitest";
import {
  claimCombinedRootStep,
  parseCombinedActionRoot,
} from "./combined-action-root";
import {
  bindCombinedCombatDamage,
  combinedCombatDamageInvocation,
} from "./combined-combat-damage";
import { composeCombinedCombatResults } from "./combined-combat-results";
import { fixture, compositionFixture } from "./combined-combat.test-fixtures";

describe("Combined ordinary Damage allocation binding preparation", () => {
  it("composes parent and continuation histories without replacing either request identity", () => {
    const { root, thread } = compositionFixture();
    const ledger = composeCombinedCombatResults(root, thread, root.results);
    expect(ledger.requestId).toBe("group");
    expect(ledger.entries.map((entry) => entry.appendId)).toEqual([
      "command",
      "attack",
      "ordinary:root:damage",
    ]);
    expect(root.results.entries).toHaveLength(3);
    expect(thread.results.requestId).toBe("ordinary:root");
    expect(thread.results.entries).toHaveLength(1);
    expect(composeCombinedCombatResults(root, thread, ledger)).toBe(ledger);
    expect(parseCombinedActionRoot(root)).toEqual(root);
  });

  it("fails closed on an unrelated continuation, conflicting ledger, or forged plan", () => {
    const { root, thread } = compositionFixture();
    for (const invalid of [
      { ...thread, requestId: "other" },
      { ...thread, actorId: "other" },
      { ...thread, weaponId: "other" },
      { ...thread, target: { ...thread.target, targetActorId: "other" } },
      {
        ...thread,
        damage: {
          ...thread.damage,
          plan: { ...thread.damage.plan, score: 30 },
        },
      },
    ])
      expect(() => composeCombinedCombatResults(root, invalid)).toThrow();
    expect(() =>
      composeCombinedCombatResults(root, thread, {
        ...root.results,
        requestId: "unrelated",
      }),
    ).toThrow();
    expect(() =>
      composeCombinedCombatResults(root, thread, {
        ...root.results,
        entries: root.results.entries.map((entry) => ({
          ...entry,
          details: { total: 99 },
        })),
      }),
    ).toThrow("ResultConflict");
  });

  it("creates V2 combat state and captures its Damage binding in the attack claim", () => {
    const { root, attack } = fixture();
    expect(root.version).toBe(2);
    expect(parseCombinedActionRoot(root)).toEqual(root);
    const claimed = claimCombinedRootStep(root, "attack", "owner", attack, {
      profileId: "second-edition",
      successEvaluator: "second-edition-strict",
      wildPolicy: "second-edition",
    });
    expect(claimed.combatDamage?.options.bonusScore).toBe(3);
    expect(parseCombinedActionRoot(claimed)).toEqual(claimed);
    expect(parseCombinedActionRoot(parseCombinedActionRoot(claimed))).toEqual(
      claimed,
    );
    expect(
      parseCombinedActionRoot({ ...claimed, combatDamageBonusScore: 4 }),
    ).toBeNull();
    expect(parseCombinedActionRoot({ ...claimed, version: 1 })).toBeNull();
    expect(parseCombinedActionRoot({ ...claimed, version: 3 })).toBeNull();
    expect(
      parseCombinedActionRoot({ ...claimed, cancelled: true }),
    ).not.toBeNull();
  });
  it("rejects malformed pending allocations and detached Damage receipts on reload", () => {
    const { root } = fixture();
    const attack = required(root.steps[1]);
    const damage = required(root.steps[2]);
    for (const invalid of [
      {
        ...root,
        combatIntent: { ...required(root.combatIntent), weaponId: "other" },
      },
      {
        ...root,
        steps: [root.steps[0], attack, { ...damage, actorId: "leader" }],
      },
      {
        ...root,
        steps: [
          root.steps[0],
          attack,
          { ...damage, options: { ...damage.options, bonusScore: 4 } },
        ],
      },
      {
        ...root,
        steps: [root.steps[0], attack, { ...damage, status: "skipped" }],
      },
    ])
      expect(parseCombinedActionRoot(invalid)).toBeNull();
    const composed = compositionFixture();
    expect(() =>
      composeCombinedCombatResults(composed.attackRoot, composed.thread),
    ).toThrow("ResultConflict");
    expect(() =>
      composeCombinedCombatResults(composed.root, {
        ...composed.thread,
        damage: {
          ...composed.thread.damage,
          result: { ...composed.damageResult, total: 99 },
        },
      }),
    ).toThrow("ResultConflict");
  });
  it("reserves the remaining 3 of 6 pips for the same attack's 4D Damage", () => {
    const { root, step, attack, result, plan } = fixture();
    const bound = bindCombinedCombatDamage(root, step, attack, 3);
    const options = combinedCombatDamageInvocation(bound, result);
    expect(result.request.score).toBe(15); // 4D attack + 1D allocation.
    expect(bound.plan).toEqual(plan); // Base, scale, provenance and autofire stay locked.
    expect(bound.plan.score + options.bonusScore).toBe(15); // 4D Damage + 1D allocation.
    expect(options.context).toMatchObject({
      groupId: "group",
      stage: "task",
      allocatedBonusScore: 3,
    });
    expect(bound.plan).not.toBe(plan);
    expect(bound.attackRequest).not.toBe(attack);
    expect(
      combinedCombatDamageInvocation(
        structuredClone(bound),
        structuredClone(result),
      ),
    ).toEqual(options);
  });

  it("never authorizes allocated Damage on a miss or a replacement attack", () => {
    const { root, step, attack, result } = fixture();
    const bound = bindCombinedCombatDamage(root, step, attack, 3);
    for (const invalid of [
      { ...result, success: false },
      { ...result, request: { ...result.request, difficulty: 1 } },
      {
        ...result,
        request: {
          ...result.request,
          source: { ...result.request.source, itemId: "other" },
        },
      },
    ])
      expect(() => combinedCombatDamageInvocation(bound, invalid)).toThrow(
        "SuccessfulHitRequired",
      );
  });

  it("rejects a replaced target or changed captured plan", () => {
    const { root, step, attack, result } = fixture();
    const bound = bindCombinedCombatDamage(root, step, attack, 3);
    expect(() =>
      combinedCombatDamageInvocation(
        { ...bound, plan: { ...bound.plan, score: 21 } },
        result,
      ),
    ).toThrow();
    expect(() =>
      bindCombinedCombatDamage(
        root,
        step,
        {
          ...attack,
          context: {
            ...attack.context,
            weaponDamageContinuation: {
              ...bound.plan,
              scale: { ...bound.plan.scale, targetActorId: "different" },
            },
          },
        },
        3,
      ),
    ).toThrow();
  });

  it("rejects overspending, lost pips, stale requests and cancelled roots", () => {
    const { root, step, attack } = fixture();
    for (const score of [-1, 2, 4, 3.5, NaN])
      expect(() =>
        bindCombinedCombatDamage(root, step, attack, score),
      ).toThrow();
    expect(() =>
      bindCombinedCombatDamage({ ...root, cancelled: true }, step, attack, 3),
    ).toThrow();
    expect(() =>
      bindCombinedCombatDamage(
        root,
        step,
        { ...attack, context: { combinedAction: step.options.context } },
        3,
      ),
    ).toThrow();
  });
});

function required<T>(value: T | null | undefined): T {
  if (value === undefined || value === null)
    throw new Error("Missing test fixture value");
  return value;
}
