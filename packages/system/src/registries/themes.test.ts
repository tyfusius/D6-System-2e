import { afterEach, describe, expect, it } from "vitest";
import {
  observeThemeRegistry,
  resetThemeRegistryForTests,
  themeRegistry,
  themePresentationProperties,
  themeWildDieChatProperties,
  themeWildDieLabels,
  themeWildDieMark,
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
    expect(themeRegistry.current()[0]?.dice).toEqual({
      body: "#090a0c",
      colorsetId: "d6-system-2e-standard",
      edge: "#c89b45",
      face: "#f0c96c",
      name: "D6 System Second Edition dice",
      systemId: "d6-system-2e",
    });
  });

  it("resolves the chat mark from the same Wild Die labels as Dice So Nice", () => {
    const classic = themeRegistry.current()[0];
    if (!classic) throw new Error("Classic theme was not registered.");
    expect(themeWildDieLabels(classic)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "systems/d6-system-2e/assets/dice/wild-six.png",
    ]);
    expect(themeWildDieMark(classic)).toEqual({
      kind: "image",
      value: "systems/d6-system-2e/assets/dice/wild-six.png",
    });
    expect(
      themeWildDieChatProperties(classic, (path) => `/dev/${path}`),
    ).toEqual({
      image: 'url("/dev/systems/d6-system-2e/assets/dice/wild-six.png")',
      text: '""',
    });

    themeRegistry.register("example-companion", {
      ...theme,
      dice: {
        body: "#000000",
        colorsetId: "example",
        edge: "#111111",
        face: "#ffffff",
        name: "Example",
        systemId: "example",
        wildDieLabels: ["1", "2", "3", "4", "5", "★"],
      },
    });
    const contributed = themeRegistry.current().at(-1);
    if (!contributed) throw new Error("Contributed theme was not registered.");
    expect(themeWildDieMark(contributed)).toEqual({
      kind: "text",
      value: "★",
    });
    expect(themeWildDieChatProperties(contributed, (path) => path)).toEqual({
      image: "none",
      text: '"★"',
    });
  });

  it("maps themes onto both current and legacy sheet presentation tokens", () => {
    expect(themePresentationProperties(theme)).toMatchObject({
      "--d6e2-accent": "#123456",
      "--d6e2-accent-bright": "#abcdef",
      "--d6e2-accent-rgb": "18 52 86",
      "--d6e2-dim": "color-mix(in srgb, #777777 66%, black)",
      "--d6e2-line": "rgb(18 52 86 / 26%)",
      "--d6e2-muted": "#777777",
      "--d6e2-text": "#fefefe",
      "--od6-accent": "#123456",
      "--od6-accent-bright-rgb": "171 205 239",
      "--od6-accent-rgb": "18 52 86",
      "--od6-accent-soft": "rgb(18 52 86 / 16%)",
      "--od6-amber": "#abcdef",
      "--od6-bg": "#010203",
      "--od6-muted": "#777777",
      "--od6-cyan": "#123456",
      "--od6-resource-gold": "#123456",
      "--od6-text": "#fefefe",
    });
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
    expect(() =>
      themeRegistry.register("example-companion", {
        ...theme,
        dice: {
          body: "#000000",
          colorsetId: "Invalid colorset",
          edge: "#111111",
          face: "#ffffff",
          name: "Example",
          systemId: "example",
        },
      }),
    ).toThrow(/colorset id/u);
    expect(() =>
      themeRegistry.register("example-companion", {
        ...theme,
        dice: {
          body: "#000000",
          colorsetId: "example",
          edge: "#111111",
          face: "#ffffff",
          name: "   ",
          systemId: "example",
        },
      }),
    ).toThrow(/dice name/u);
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
          wildDieLabels: [
            "1",
            "2",
            "3",
            "4",
            "5",
            "modules/another-module/assets/six.png",
          ],
        },
      }),
    ).toThrow(/dice\.wildDieLabels/u);
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
