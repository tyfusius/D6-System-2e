import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultHudLayout } from "./default-layout";

afterEach(() => vi.unstubAllGlobals());

describe("combat HUD default layout", () => {
  it("registers stable identities for the three compact groups", () => {
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
    });

    const defaults = defaultHudLayout();

    expect(defaults.groups.map(({ id }) => id)).toEqual([
      "round",
      "weapons",
      "abilities",
    ]);
    expect(defaults.layout.map(({ id }) => id)).toEqual(
      defaults.groups.map(({ id }) => id),
    );
  });
});
