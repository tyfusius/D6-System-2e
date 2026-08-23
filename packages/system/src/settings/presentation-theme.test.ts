import { describe, expect, it } from "vitest";
import type { D6System2eThemeDefinition } from "@d6-system-2e/core";
import { D6_SYSTEM_2E_NEUTRAL_PAUSE_ICON } from "../registries/themes";
import {
  isNeutralPauseIcon,
  resolvePauseIcon,
  resolveSelectedTheme,
  resolveSettingLogo,
} from "./presentation-theme";

const classic = {
  cssClass: "classic",
  id: "classic",
  label: "Classic",
  pauseIcon: "systems/d6-system-2e/classic.png",
  tokens: {},
} as unknown as D6System2eThemeDefinition;
const echo = {
  cssClass: "echo",
  id: "echo",
  label: "Echo",
  pauseIcon: "modules/echo/echo.png",
  tokens: {},
} as unknown as D6System2eThemeDefinition;

describe("Setting Profile presentation theme", () => {
  it("binds a customized profile to the theme owning its retained logo", () => {
    expect(
      resolveSelectedTheme(
        [classic, echo],
        { id: "echo-customized", logo: "modules/echo/echo.png" },
        "inherit",
      )?.id,
    ).toBe("echo");
  });

  it("allows a valid personal override without changing the profile", () => {
    expect(
      resolveSelectedTheme(
        [classic, echo],
        { id: "echo-d6", logo: "modules/echo/echo.png" },
        "classic",
      )?.id,
    ).toBe("classic");
  });

  it("ignores a stale personal choice and returns to the active profile", () => {
    expect(
      resolveSelectedTheme(
        [classic, echo],
        { id: "echo-d6", logo: "modules/echo/echo.png" },
        "missing-theme",
      )?.id,
    ).toBe("echo");
  });

  it("keeps the shared Setting Profile logo when a player overrides the palette", () => {
    expect(resolvePauseIcon({ logo: "modules/echo/echo.png" }, classic)).toBe(
      "modules/echo/echo.png",
    );
  });

  it("uses the recolorable mark only for the vanilla neutral presentation", () => {
    const neutral = {
      ...classic,
      id: "classic",
      pauseIcon: D6_SYSTEM_2E_NEUTRAL_PAUSE_ICON,
    } as D6System2eThemeDefinition;
    const legacyNeutralLogo =
      "systems/d6-system-2e/assets/ui/d6-pause-cube.png";

    expect(resolvePauseIcon({ logo: legacyNeutralLogo }, neutral)).toBe(
      D6_SYSTEM_2E_NEUTRAL_PAUSE_ICON,
    );
    expect(resolveSettingLogo(legacyNeutralLogo)).toBe(
      D6_SYSTEM_2E_NEUTRAL_PAUSE_ICON,
    );
    expect(isNeutralPauseIcon(D6_SYSTEM_2E_NEUTRAL_PAUSE_ICON)).toBe(true);
  });

  it("leaves every setting- and companion-specific pause asset unchanged", () => {
    const contributedAssets = [
      "modules/starwarsd6-companion-d6-system-2e/art/branding/star-wars-outline.svg",
      "modules/echod6-companion-d6-system-2e/art/branding/echo-logo.png",
      "modules/example-setting/art/branding/example-mark.webp",
    ] as const;

    for (const logo of contributedAssets) {
      expect(resolvePauseIcon({ logo }, classic)).toBe(logo);
      expect(resolvePauseIcon({ logo }, echo)).toBe(logo);
      expect(isNeutralPauseIcon(logo)).toBe(false);
      expect(resolveSettingLogo(logo)).toBe(logo);
    }
  });
});
