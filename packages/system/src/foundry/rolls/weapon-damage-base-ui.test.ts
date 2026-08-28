import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("configurable Weapon damage authoring and audit UI", () => {
  const itemTemplate = readFileSync("templates/item/item-sheet.hbs", "utf8");
  const chatTemplate = readFileSync("templates/roll/chat-card.hbs", "utf8");
  const dialogTemplate = readFileSync("templates/roll/dialog.hbs", "utf8");
  const sheetSource = readFileSync(
    "packages/system/src/foundry/sheets/item-sheet.ts",
    "utf8",
  );
  const rollSource = readFileSync(
    "packages/system/src/foundry/rolls/roll-service.ts",
    "utf8",
  );

  it("offers the personal-Weapon basis, Attribute, and open Skill key", () => {
    expect(itemTemplate).toContain('name="system.damageBasis"');
    expect(itemTemplate).toContain('name="system.damageAttributeId"');
    expect(itemTemplate).toContain('name="system.damageSkillKey"');
    expect(itemTemplate).toContain("selected=selectedDamageAttributeId");
    expect(sheetSource).toContain('currentAttributeRole("strength")');
    expect(sheetSource).toContain('=== "attribute-skill"');
    expect(sheetSource).toContain("equipmentFieldUpdate(input.name, value)");
  });

  it("passes and renders portable damage-pool provenance", () => {
    expect(rollSource).toContain("weaponDamage,");
    expect(rollSource).toContain("d6WeaponDamageBaseForContinuation(");
    expect(rollSource).toContain(
      "if (plan) return { score: plan.score, weaponDamage: plan.weaponDamage }",
    );
    expect(chatTemplate).toContain("hasWeaponDamageContext");
    expect(chatTemplate).toContain("weaponDamageContext.baseKindLabel");
    expect(chatTemplate).toContain(
      "weaponDamageContext.listedDamageScoreLabel",
    );
    expect(chatTemplate).toContain("D6E2.Roll.WeaponDamage.StaleSkillFallback");
  });

  it("carries attack-bound Damage scale and attributes autofire in the prompt", () => {
    expect(dialogTemplate).toContain(
      'data-damage-scale-application="{{target.damageScale.application}}"',
    );
    expect(dialogTemplate).toContain(
      'data-damage-scale-modifier="{{target.damageScale.modifierScore}}"',
    );
    expect(dialogTemplate).toContain("automaticResultModifierLabel");
    expect(rollSource).toContain(
      "D6E2.Combat.ActiveResponsive.AutofireDamageBonus",
    );
    expect(rollSource).toContain("d6PendingAutofireForAttack(");
  });
});
