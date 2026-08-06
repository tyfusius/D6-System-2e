import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configuredSecondEditionHeroPointStrategy,
  currentSecondEditionHeroPointStrategy,
  heroicHeroPointsCarryOver,
} from "./hero-points";
import { SECOND_EDITION_OPTION_KEYS } from "./settings-catalog";

afterEach(() => vi.unstubAllGlobals());

function stubSettings(values: ReadonlyMap<string, unknown>): void {
  vi.stubGlobal("game", {
    settings: {
      get: (_namespace: string, key: string) => values.get(key),
    },
  });
}

describe("Second Edition Hero Point settings adapter", () => {
  it("resolves Heroic and Basic directly", () => {
    stubSettings(
      new Map([[SECOND_EDITION_OPTION_KEYS.heroPointStrategy, "basic"]]),
    );
    expect(configuredSecondEditionHeroPointStrategy()).toBe("basic");
    expect(currentSecondEditionHeroPointStrategy()).toBe("basic");
  });

  it("fails closed to Heroic until both Classic dependencies are active", () => {
    const values = new Map<string, unknown>([
      [SECOND_EDITION_OPTION_KEYS.heroPointStrategy, "classic"],
      [SECOND_EDITION_OPTION_KEYS.wildDieStrategy, "classic"],
      [SECOND_EDITION_OPTION_KEYS.advancementStrategy, "milestone"],
    ]);
    stubSettings(values);
    expect(configuredSecondEditionHeroPointStrategy()).toBe("classic");
    expect(currentSecondEditionHeroPointStrategy()).toBe("heroic");
    values.set(
      SECOND_EDITION_OPTION_KEYS.advancementStrategy,
      "experience-points",
    );
    expect(currentSecondEditionHeroPointStrategy()).toBe("classic");
  });

  it("reads the optional Heroic carry-over boundary", () => {
    stubSettings(
      new Map([[SECOND_EDITION_OPTION_KEYS.heroicHeroPointsCarryOver, true]]),
    );
    expect(heroicHeroPointsCarryOver()).toBe(true);
  });
});
