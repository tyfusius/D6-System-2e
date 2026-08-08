import { describe, expect, it } from "vitest";
import type { D6System2eThemeDefinition } from "@d6-system-2e/core";
import { resolvePauseIcon, resolveSelectedTheme } from "./presentation-theme";

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
});
