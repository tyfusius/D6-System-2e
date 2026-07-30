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
const combatDeclarationTemplate = readFileSync(
  new URL(
    "../../../../../templates/actor/character/combat-declaration.hbs",
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
    expect(dialog).toContain('name="targetId"');
    expect(dialog).toContain('data-defense="{{target.defense}}"');
    expect(dialog).toContain('data-range-band="{{target.rangeBand}}"');
    expect(dialog).toContain('data-out-of-range="{{target.outOfRange}}"');
    expect(rollService).toContain("buildWeaponAttackTargetContext");
    expect(rollService).toContain("TargetOutOfRange");
    expect(rollService).toContain("weaponAttack:");
  });

  it("applies and audits relative scale for attack, damage, and resistance", () => {
    expect(dialog).toContain(
      'data-scale-modifier="{{target.scale.modifierScore}}"',
    );
    expect(dialog).toContain(
      'data-scale-source-actor-id="{{target.scale.sourceActorId}}"',
    );
    expect(dialog).toContain(
      'data-scale-target-actor-id="{{target.scale.targetActorId}}"',
    );
    expect(dialog).toContain("data-roll-doubled-score");
    expect(chatCard).toContain("hasScaleContext");
    expect(chatCard).toContain("scaleContext.modifierLabel");
    expect(rollService).toContain("secondEditionScaleInteraction");
    expect(rollService).toContain(
      'buildWeaponAttackTargetContext(actor, item, "damage")',
    );
    expect(rollService).toContain("buildResistanceSourceContext(actor)");
  });

  it("offers the page-32 finish-prone movement choice", () => {
    expect(combatDeclarationTemplate).toContain('name="endProne"');
    expect(combatDeclarationTemplate).toContain("Movement.EndProne");
    expect(characterSheet).toContain("endProne.disabled");
    expect(characterSheet).toContain("D6E2.Combat.Movement.EndProne");
  });

  it("preserves target, range, and defense as visible chat audit data", () => {
    expect(chatCard).toContain("hasWeaponAttackContext");
    expect(chatCard).toContain("weaponAttackContext.targetName");
    expect(chatCard).toContain("weaponAttackContext.rangeLabel");
    expect(chatCard).toContain("weaponAttackContext.defense");
    expect(rollService).toContain("targetActorId:");
    expect(rollService).toContain("targetTokenId:");
  });

  it("preserves crew Gunnery, machine, bonus, and shortfall as chat audit data", () => {
    expect(rollService).toContain("secondEditionMachineWeaponAttackPlan");
    expect(rollService).toContain("machineCrew:");
    expect(chatCard).toContain("hasMachineCrewContext");
    expect(chatCard).toContain("machineCrewContext.crewName");
    expect(chatCard).toContain("machineCrewContext.machineName");
    expect(chatCard).toContain("machineCrewContext.missingCrewCount");
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
