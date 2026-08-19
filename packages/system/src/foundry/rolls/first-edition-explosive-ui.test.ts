import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rollService = readFileSync(
  new URL("./roll-service.ts", import.meta.url),
  "utf8",
);
const itemModel = readFileSync(
  new URL("../data-models/item-types.ts", import.meta.url),
  "utf8",
);
const itemTemplate = readFileSync(
  new URL("../../../../../templates/item/item-sheet.hbs", import.meta.url),
  "utf8",
);

describe("First Edition thrown-explosive UI contract", () => {
  it("authors an explicit thrown-explosive profile and Short minimum", () => {
    expect(itemModel).toContain('choices: ["standard", "thrown-explosive"]');
    expect(itemModel).toContain("shortMinimum: new NumberField");
    expect(itemTemplate).toContain('name="system.weaponKind"');
    expect(itemTemplate).toContain('name="system.range.shortMinimum"');
  });

  it("uses Strength-adjusted ranges only for the opted-in First Edition profile", () => {
    expect(rollService).toContain('defenseStrategy.family === "active"');
    expect(rollService).toContain(
      'stringValue(weapon.system.weaponKind) === "thrown-explosive"',
    );
    expect(rollService).toContain("firstEditionStrengthAdjustedThrowRanges");
    expect(rollService).toContain(
      "TYFUSIUS_HOMEBREW_SETTING_KEYS.firstEditionStrengthGrenadeRanges",
    );
  });

  it("audits grenade range and fixed targeting difficulty without active defense", () => {
    expect(rollService).toContain('"grenade-targeting"');
    expect(rollService).toContain("firstEditionGrenadeTargetingDifficulty");
    expect(rollService).toContain("defenseSourcePage: firstEditionRangePlan");
    expect(rollService).toContain("? 111");
    expect(rollService).toContain("noDodgeTarget || grenadeTarget");
    expect(rollService).toContain("RangeDifficultyOutOfRange");
  });
});
