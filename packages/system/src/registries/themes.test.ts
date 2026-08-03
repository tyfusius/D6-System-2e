import { afterEach, describe, expect, it } from "vitest";
import {
  observeThemeRegistry,
  resetThemeRegistryForTests,
  themeRegistry,
} from "./themes";

afterEach(resetThemeRegistryForTests);

const theme = {
  cssClass: "d6e2-theme-example",
  id: "example",
  label: "Example",
  tokens: {
    accent: "#123456",
    accentBright: "#abcdef",
    background: "#010203",
    muted: "#777777",
    text: "#fefefe",
  },
} as const;

describe("theme registry", () => {
  it("retains the generic theme and accepts owner-scoped contributions", () => {
    themeRegistry.register("example-companion", theme);
    expect(themeRegistry.current().map(({ id }) => id)).toEqual([
      "classic",
      "example",
    ]);
    themeRegistry.unregisterOwner("example-companion");
    expect(themeRegistry.current().map(({ id }) => id)).toEqual(["classic"]);
  });

  it("prevents one module from replacing another module's theme", () => {
    themeRegistry.register("first-owner", theme);
    expect(() => themeRegistry.register("second-owner", theme)).toThrow(
      /already registered/u,
    );
  });

  it("validates semantic colors and Wild Die label count", () => {
    expect(() =>
      themeRegistry.register("example-companion", {
        ...theme,
        tokens: { ...theme.tokens, accent: "blue" },
      }),
    ).toThrow(TypeError);
    expect(() =>
      themeRegistry.register("example-companion", {
        ...theme,
        dice: {
          body: "#000000",
          colorsetId: "example",
          edge: "#111111",
          face: "#ffffff",
          name: "Example",
          systemId: "example",
          wildDieLabels: ["one"],
        },
      }),
    ).toThrow(/six Wild Die labels/u);
  });

  it("accepts owner-scoped pause artwork and rejects foreign module paths", () => {
    themeRegistry.register("example-companion", {
      ...theme,
      pauseIcon: "modules/example-companion/assets/pause.webp",
    });
    expect(themeRegistry.current().at(-1)?.pauseIcon).toBe(
      "modules/example-companion/assets/pause.webp",
    );
    expect(() =>
      themeRegistry.register("example-companion", {
        ...theme,
        pauseIcon: "modules/another-module/assets/pause.webp",
      }),
    ).toThrow(/safe asset path/u);
  });

  it("notifies live settings consumers when contributions change", () => {
    let notifications = 0;
    const stop = observeThemeRegistry(() => {
      notifications += 1;
    });
    themeRegistry.register("example-companion", theme);
    themeRegistry.unregisterOwner("example-companion");
    stop();
    themeRegistry.register("example-companion", theme);
    expect(notifications).toBe(2);
  });
});
