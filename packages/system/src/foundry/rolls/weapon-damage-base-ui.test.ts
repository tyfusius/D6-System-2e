import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("configurable Weapon damage authoring and audit UI", () => {
  const itemTemplate = readFileSync("templates/item/item-sheet.hbs", "utf8");
  const chatTemplate = readFileSync("templates/roll/chat-card.hbs", "utf8");
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
  });

  it("passes and renders portable damage-pool provenance", () => {
    expect(rollSource).toContain("weaponDamage,");
    expect(rollSource).toContain("attributeId: weaponDamage.attributeId");
    expect(chatTemplate).toContain("hasWeaponDamageContext");
    expect(chatTemplate).toContain("weaponDamageContext.baseKindLabel");
    expect(chatTemplate).toContain(
      "weaponDamageContext.listedDamageScoreLabel",
    );
    expect(chatTemplate).toContain("D6E2.Roll.WeaponDamage.StaleSkillFallback");
  });
});
