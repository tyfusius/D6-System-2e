import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rollService = readFileSync(
  new URL("./roll-service.ts", import.meta.url),
  "utf8",
);
const dialog = readFileSync(
  new URL("../../../../../templates/roll/dialog.hbs", import.meta.url),
  "utf8",
);
const chatCard = readFileSync(
  new URL("../../../../../templates/roll/chat-card.hbs", import.meta.url),
  "utf8",
);
const characterSheet = readFileSync(
  new URL("../sheets/character-sheet.ts", import.meta.url),
  "utf8",
);
const combatTemplate = readFileSync(
  new URL(
    "../../../../../templates/actor/character/combat.hbs",
    import.meta.url,
  ),
  "utf8",
);
const itemTemplate = readFileSync(
  new URL("../../../../../templates/item/item-sheet.hbs", import.meta.url),
  "utf8",
);

describe("Second Edition combat UI contracts", () => {
  it("carries a selected scene target and its static defense into the roll", () => {
    expect(dialog).toContain('select name="targetId"');
    expect(dialog).toContain('data-defense="{{target.defense}}"');
    expect(dialog).toContain('data-range-band="{{target.rangeBand}}"');
    expect(dialog).toContain('data-out-of-range="{{target.outOfRange}}"');
    expect(rollService).toContain("buildWeaponAttackTargetContext");
    expect(rollService).toContain("TargetOutOfRange");
    expect(rollService).toContain("weaponAttack:");
  });

  it("preserves target, range, and defense as visible chat audit data", () => {
    expect(chatCard).toContain("hasWeaponAttackContext");
    expect(chatCard).toContain("weaponAttackContext.targetName");
    expect(chatCard).toContain("weaponAttackContext.rangeLabel");
    expect(chatCard).toContain("weaponAttackContext.defense");
    expect(rollService).toContain("targetActorId:");
    expect(rollService).toContain("targetTokenId:");
  });

  it("offers a resistance roll that is independent of action penalties", () => {
    expect(characterSheet).toContain("actorResistancePlan(this.actor)");
    expect(characterSheet).toContain("roll.resistance(this.actor)");
    expect(combatTemplate).toContain('data-action="rollResistance"');
    expect(combatTemplate).toContain("combat.resistance.scoreLabel");
    expect(rollService).toContain(
      '["attribute", "skill", "weapon-attack"].includes',
    );
    expect(rollService).toContain('kind !== "resistance"');
    expect(rollService).toContain(
      'kind === "resistance" || targetContext?.hasTargets === true',
    );
    expect(chatCard).toContain("hasResistanceContext");
    expect(chatCard).toContain("resistanceContext.armorContributors");
  });

  it("makes the only permitted armor stacking case explicit", () => {
    expect(itemTemplate).toContain("armorStackingOptions");
    expect(itemTemplate).toContain("selected=item.system.stackingTag");
  });
});
