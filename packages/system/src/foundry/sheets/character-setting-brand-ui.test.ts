import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../../../../../", import.meta.url);

describe("Character Setting Profile branding", () => {
  it("centers the active setting logo without replacing the game-mode label", async () => {
    const [header, controls, sheet, settings, styles, echoBranding] =
      await Promise.all([
        readFile(new URL("templates/actor/character/header.hbs", root), "utf8"),
        readFile(
          new URL("templates/actor/character/controls.hbs", root),
          "utf8",
        ),
        readFile(
          new URL(
            "packages/system/src/foundry/sheets/character-sheet.ts",
            root,
          ),
          "utf8",
        ),
        readFile(
          new URL("packages/system/src/settings/system-settings.ts", root),
          "utf8",
        ),
        readFile(new URL("styles/d6-system-2e.css", root), "utf8"),
        readFile(
          new URL(
            "packages/echod6-companion-d6-system-2e/src/branding.ts",
            root,
          ),
          "utf8",
        ),
      ]);

    expect(header).toContain("<span>{{systemLabel}}</span>");
    expect(header).not.toContain("{{#if settingLogo}}");
    expect(controls).toContain("{{settingLogoClass}}");
    expect(controls).not.toContain("background-image: url('{{settingLogo}}')");
    expect(controls).toContain('aria-label="{{settingLabel}}"');
    expect(sheet).toContain("settingLabel: currentSettingProfile().label");
    expect(sheet).toContain(
      "settingLogo: resolveSettingLogo(currentSettingProfile().logo)",
    );
    expect(sheet).toContain(
      "settingLogoAsWatermark: currentSettingProfile().logoAsWatermark",
    );
    expect(sheet).toMatch(
      /settingLogoClass: currentSettingProfile\(\)\.logoAsWatermark\s+\? "is-watermark"\s+: "is-row-logo"/,
    );
    expect(settings).not.toContain("systemLabel: profile.label");

    expect(styles).toMatch(
      /\.d6e2-setting-brand\s*\{[^}]*position: absolute;[^}]*top: 50%;[^}]*left: 50%;[^}]*height: 52px;[^}]*opacity: 0\.94;[^}]*transform: translate\(-50%, -50%\);/s,
    );
    expect(styles).toMatch(
      /data-d6-system2e-setting-branding="mask"[\s\S]*?\.d6e2-setting-brand-logo\s*\{[^}]*background-color: var\(--d6e2-setting-logo-color, var\(--od6-accent\)\);[^}]*mask: var\(--d6e2-setting-logo-image\)/s,
    );
    expect(styles).toMatch(
      /data-d6-system2e-setting-brand="open-d6"[\s\S]*?\.d6e2-setting-brand\.is-row-logo\s*\{[^}]*width: 52px;[^}]*height: 52px;/s,
    );
    expect(styles).toMatch(
      /data-d6-system2e-setting-brand="open-d6"[\s\S]*?\.d6e2-setting-brand\.is-watermark\s*\{[^}]*width: clamp\(128px, 20cqi, 176px\);[^}]*height: clamp\(128px, 20cqi, 176px\);/s,
    );
    expect(styles).toMatch(
      /\.d6e2-setting-brand\.is-watermark\s*\{[^}]*top: calc\(100% \+ 4px\);[^}]*height: clamp\(150px, 20cqi, 220px\);[^}]*opacity: 0\.1;/s,
    );
    expect(styles).toMatch(
      /\.od6v2-sheet-utilities\s*\{[^}]*overflow: visible;/s,
    );
    expect(styles).toMatch(
      /\.od6v2-sheet-utilities\s*>\s*\.od6v2-theme-control\s*\{[^}]*grid-column: 2;[^}]*z-index: 3;/s,
    );
    expect(echoBranding).not.toContain(
      'element.classList.contains("od6s-character-v2")',
    );
  });
});
