import { describe, expect, it } from "vitest";
import type { D6System2eThemeDefinition } from "@d6-system-2e/core";
import { D6_SYSTEM_2E_NEUTRAL_PAUSE_ICON } from "../registries/themes";
import {
  isNeutralPauseIcon,
  replaceAppliedThemePresentation,
  resolvePauseIcon,
  resolvePersonalThemeSelection,
  resolveSettingProfilePauseIcon,
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

  it("resolves independent client choices without changing shared presentation", () => {
    const profile = { id: "echo-d6", logo: "modules/echo/echo.png" };
    const firstClient = resolvePersonalThemeSelection(
      [classic, echo],
      profile,
      "classic",
    );
    const secondClient = resolvePersonalThemeSelection(
      [classic, echo],
      profile,
      "echo",
    );

    expect(firstClient.effectiveTheme?.id).toBe("classic");
    expect(secondClient.effectiveTheme?.id).toBe("echo");
    expect(profile).toEqual({
      id: "echo-d6",
      logo: "modules/echo/echo.png",
    });
  });

  it("preserves an unavailable personal choice while displaying Classic", () => {
    expect(
      resolvePersonalThemeSelection(
        [classic, echo],
        { id: "echo-d6", logo: "modules/echo/echo.png" },
        "missing-theme",
      ),
    ).toMatchObject({
      available: false,
      effectiveTheme: { id: "classic" },
      inherits: false,
      requestedId: "missing-theme",
    });
    expect(
      resolveSelectedTheme(
        [classic, echo],
        { id: "echo-d6", logo: "modules/echo/echo.png" },
        "missing-theme",
      )?.id,
    ).toBe("classic");
  });

  it("restores a still-saved personal choice when its provider returns", () => {
    const profile = { id: "classic", logo: classic.pauseIcon ?? "" };
    expect(
      resolvePersonalThemeSelection([classic], profile, "echo"),
    ).toMatchObject({
      available: false,
      effectiveTheme: { id: "classic" },
      requestedId: "echo",
    });
    expect(
      resolvePersonalThemeSelection([classic, echo], profile, "echo"),
    ).toMatchObject({
      available: true,
      effectiveTheme: { id: "echo" },
      requestedId: "echo",
    });
  });

  it("removes the exact previous class and properties before applying a replacement", () => {
    const classes = new Set(["foundry-owned", "theme-old"]);
    const properties = new Map([
      ["--theme-old", "old"],
      ["--unrelated", "preserved"],
    ]);
    const root = {
      classList: {
        add: (value: string) => classes.add(value),
        remove: (value: string) => classes.delete(value),
      },
      dataset: {
        d6System2eThemeClass: "theme-old",
        d6System2eThemeProperties: "--theme-old",
        d6System2eThemeSignature: "old-signature",
      } as Record<string, string>,
      style: {
        removeProperty: (name: string) => {
          properties.delete(name);
          return "";
        },
        setProperty: (name: string, value: string) => {
          properties.set(name, value);
        },
      },
    };

    expect(
      replaceAppliedThemePresentation(root, echo, {
        "--theme-new": "new",
      }),
    ).toBe(true);
    expect(classes).toEqual(new Set(["foundry-owned", "echo"]));
    expect(properties).toEqual(
      new Map([
        ["--unrelated", "preserved"],
        ["--theme-new", "new"],
      ]),
    );
    expect(root.dataset.d6System2eThemeClass).toBe("echo");
    expect(root.dataset.d6System2eThemeProperties).toBe("--theme-new");
    expect(
      replaceAppliedThemePresentation(root, echo, {
        "--theme-new": "new",
      }),
    ).toBe(false);
  });

  it("keeps the shared Setting Profile logo when a player overrides the palette", () => {
    expect(resolvePauseIcon({ logo: "modules/echo/echo.png" }, classic)).toBe(
      "modules/echo/echo.png",
    );
  });

  it("keeps shared pause branding on the inherited theme when the profile logo is blank", () => {
    expect(
      resolveSettingProfilePauseIcon([classic, echo], {
        id: "classic",
        logo: "",
      }),
    ).toBe(classic.pauseIcon);
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
