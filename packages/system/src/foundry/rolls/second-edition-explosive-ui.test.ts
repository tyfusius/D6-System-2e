import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rollService = readFileSync(
  new URL("./roll-service.ts", import.meta.url),
  "utf8",
);
const settingsTemplate = readFileSync(
  new URL(
    "../../../../../templates/settings/edition-settings.hbs",
    import.meta.url,
  ),
  "utf8",
);

describe("Second Edition thrown-explosive UI contract", () => {
  it("adjusts only typed explosives under the independent Second Edition option", () => {
    expect(rollService).toContain(
      'stringValue(weapon.system.weaponKind) === "thrown-explosive"',
    );
    expect(rollService).toContain("secondEditionBrawnAdjustedThrowRanges");
    expect(rollService).toContain("secondEditionExplosiveRangeForDistance");
    expect(rollService).toContain(
      "TYFUSIUS_HOMEBREW_SETTING_KEYS.secondEditionBrawnGrenadeRanges",
    );
    expect(rollService).toContain('defenseStrategy.family === "static"');
    expect(rollService).toContain('defenseStrategy.family === "range"');
  });

  it("keeps Second Edition attacks on native defense strategies", () => {
    expect(rollService).toContain("const grenadeTarget = firstEditionGrenade");
    expect(rollService).toContain(
      'attackKind === "ranged"\n                        ? "static-dodge"',
    );
    expect(rollService).toContain(
      'noDodgeTarget\n                    ? "fixed-range"',
    );
  });

  it("presents the rule inside the single Tyfusius card", () => {
    expect(settingsTemplate).toContain("homebrewSecondEditionSettings");
    expect(settingsTemplate).toContain(
      "D6E2.Settings.TyfusiusHomebrew.Heading",
    );
    expect(settingsTemplate).not.toContain(
      "D6E2.Settings.TyfusiusHomebrew.SecondEditionHeading",
    );
    expect(settingsTemplate).toContain(
      "D6E2.Settings.TyfusiusHomebrew.SecondEditionGrenades.Explanation",
    );
  });
});
