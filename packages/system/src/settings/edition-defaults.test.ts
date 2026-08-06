import { describe, expect, it } from "vitest";
import {
  COMPATIBILITY_SETTING_KEYS,
  OPEN_D6_MASTER_SETTING,
} from "./rules-compatibility";
import { FIRST_EDITION_GENRE_PACKAGE_SETTING } from "./campaign-packages";
import {
  FIRST_EDITION_OPTION_KEYS,
  SECOND_EDITION_OPTION_KEYS,
  SHARED_SETTING_KEYS,
  TYFUSIUS_HOMEBREW_SETTING_KEYS,
} from "./settings-catalog";
import {
  restoreRecommendedEditionDefaults,
  type EditionDefaultsGateway,
} from "./edition-defaults";

function gateway(initial: Record<string, unknown>): {
  readonly gateway: EditionDefaultsGateway;
  readonly values: Map<string, unknown>;
} {
  const values = new Map(Object.entries(initial));
  return {
    gateway: {
      get: (key) => values.get(key),
      set: (key, value) => {
        values.set(key, value);
        return Promise.resolve(value);
      },
    },
    values,
  };
}

describe("recommended edition defaults", () => {
  it("restores the lightweight Second Edition baseline without presentation or content changes", async () => {
    const state = gateway({
      [COMPATIBILITY_SETTING_KEYS.firstEditionAttributes]: true,
      [FIRST_EDITION_GENRE_PACKAGE_SETTING]: "open-d6-space",
      [SECOND_EDITION_OPTION_KEYS.autoHeroPoints]: false,
      [SECOND_EDITION_OPTION_KEYS.heroPointStrategy]: "classic",
      [SECOND_EDITION_OPTION_KEYS.pipsModule]: true,
      [SECOND_EDITION_OPTION_KEYS.superpowersModule]: true,
      [SHARED_SETTING_KEYS.worldTheme]: "echo",
      [TYFUSIUS_HOMEBREW_SETTING_KEYS.secondEditionBrawnGrenadeRanges]: true,
      [TYFUSIUS_HOMEBREW_SETTING_KEYS.secondEditionCombinedActions]: true,
    });

    const result = await restoreRecommendedEditionDefaults(
      "second-edition",
      state.gateway,
    );

    expect(result.failed).toEqual([]);
    expect(state.values.get(OPEN_D6_MASTER_SETTING)).toBe(false);
    expect(
      Object.values(COMPATIBILITY_SETTING_KEYS).every(
        (key) => state.values.get(key) === false,
      ),
    ).toBe(true);
    expect(state.values.get(SECOND_EDITION_OPTION_KEYS.pipsModule)).toBe(false);
    expect(state.values.get(SECOND_EDITION_OPTION_KEYS.superpowersModule)).toBe(
      false,
    );
    expect(state.values.get(SECOND_EDITION_OPTION_KEYS.heroPointStrategy)).toBe(
      "heroic",
    );
    expect(state.values.get(SECOND_EDITION_OPTION_KEYS.autoHeroPoints)).toBe(
      true,
    );
    expect(
      state.values.get(
        TYFUSIUS_HOMEBREW_SETTING_KEYS.secondEditionBrawnGrenadeRanges,
      ),
    ).toBe(false);
    expect(
      state.values.get(
        TYFUSIUS_HOMEBREW_SETTING_KEYS.secondEditionCombinedActions,
      ),
    ).toBe(false);
    expect(state.values.get(SHARED_SETTING_KEYS.worldTheme)).toBe("echo");
    expect(state.values.get(FIRST_EDITION_GENRE_PACKAGE_SETTING)).toBe(
      "open-d6-space",
    );
  });

  it("restores the complete First Edition baseline and clears optional custom rules", async () => {
    const state = gateway({
      [FIRST_EDITION_OPTION_KEYS.bodyPoints]: "body-points",
      [FIRST_EDITION_OPTION_KEYS.initialCharacterPoints]: 99,
      [FIRST_EDITION_OPTION_KEYS.trackStuns]: true,
      [SHARED_SETTING_KEYS.actionDeclarationAssistance]: "manual",
      [TYFUSIUS_HOMEBREW_SETTING_KEYS.firstEditionSegmentedActions]: true,
    });

    const result = await restoreRecommendedEditionDefaults(
      "first-edition",
      state.gateway,
    );

    expect(result.failed).toEqual([]);
    expect(state.values.get(OPEN_D6_MASTER_SETTING)).toBe(true);
    expect(
      Object.values(COMPATIBILITY_SETTING_KEYS).every(
        (key) => state.values.get(key) === true,
      ),
    ).toBe(true);
    expect(state.values.get(FIRST_EDITION_OPTION_KEYS.bodyPoints)).toBe(
      "wounds",
    );
    expect(
      state.values.get(FIRST_EDITION_OPTION_KEYS.initialCharacterPoints),
    ).toBe(5);
    expect(state.values.get(FIRST_EDITION_OPTION_KEYS.trackStuns)).toBe(false);
    expect(
      state.values.get(
        TYFUSIUS_HOMEBREW_SETTING_KEYS.firstEditionSegmentedActions,
      ),
    ).toBe(false);
    expect(
      state.values.get(SHARED_SETTING_KEYS.actionDeclarationAssistance),
    ).toBe("manual");
  });
});
