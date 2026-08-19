import { readFileSync } from "node:fs";
import type { D6RollResultV1 } from "@d6-system-2e/core";
import { describe, expect, it } from "vitest";
import {
  doublingDownNarrationResult,
  successfulWeaponDamageFollowUp,
} from "./chat-card-actions";

function weaponAttackResult(
  overrides: {
    readonly itemId?: string;
    readonly success?: boolean;
    readonly targetName?: string;
    readonly weaponId?: string;
  } = {},
): D6RollResultV1 {
  const weaponId = overrides.weaponId ?? "weapon-1";
  return {
    success: overrides.success ?? true,
    request: {
      context: {
        weaponAttack: {
          attackKind: "ranged",
          baseDefense: 10,
          coverModifier: 0,
          coverSourcePage: 30,
          defense: 10,
          defenseKind: "dodge",
          targetActorId: "target-1",
          targetName: overrides.targetName ?? "Target",
          targetTokenId: "token-1",
          weaponId,
        },
      },
      kind: "weapon-attack",
      source: {
        actorId: "actor-1",
        actorName: "Attacker",
        attributeId: "agility",
        itemId: overrides.itemId ?? weaponId,
      },
    },
  } as D6RollResultV1;
}

describe("roll chat-card follow-up actions", () => {
  it("renders mutually exclusive Hero Point and Doubling Down commands", () => {
    const template = readFileSync(
      new URL("../../../../../templates/roll/chat-card.hbs", import.meta.url),
      "utf8",
    );
    expect(template).toContain('data-action="heroPointReroll"');
    expect(template).toContain("showHeroPointReroll");
    expect(template).toContain("heroPointReroll");
    expect(template).toContain("D6E2.Roll.HeroPoint.RerollTradeoff");
    expect(template).toContain('data-action="doubleDown"');
    expect(template).toContain("showDoublingDown");
    expect(template).toContain("D6E2.Roll.DoublingDown.Tradeoff");
    expect(template).toContain("showRollFollowUps");
    expect(template).toContain("od6chat-follow-up-copy");
  });

  it("treats the DialogV2 cancel action as cancellation, not narration", () => {
    expect(doublingDownNarrationResult("cancel")).toBeNull();
    expect(doublingDownNarrationResult(null)).toBeNull();
    expect(
      doublingDownNarrationResult({ narration: "Try another route." }),
    ).toBe("Try another route.");
  });

  it("offers damage only for an exact successful personal-weapon hit", () => {
    expect(successfulWeaponDamageFollowUp(weaponAttackResult())).toEqual({
      actorId: "actor-1",
      targetActorId: "target-1",
      targetName: "Target",
      targetTokenId: "token-1",
      weaponId: "weapon-1",
    });
    expect(
      successfulWeaponDamageFollowUp(weaponAttackResult({ success: false })),
    ).toBeNull();
    expect(
      successfulWeaponDamageFollowUp(
        weaponAttackResult({ itemId: "gunnery-skill" }),
      ),
    ).toBeNull();
    expect(
      successfulWeaponDamageFollowUp(weaponAttackResult({ targetName: "" })),
    ).toBeNull();
  });
});
