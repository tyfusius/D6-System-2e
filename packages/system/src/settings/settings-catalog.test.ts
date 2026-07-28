import { describe, expect, it } from "vitest";
import { RULES_COMPATIBILITY_KEYS } from "@d6-system-2e/core";
import {
  FIRST_EDITION_SETTINGS,
  SECOND_EDITION_SETTING_GROUPS,
  SECOND_EDITION_SETTINGS,
  SHARED_SETTINGS,
  SYSTEM_SETTINGS,
  secondEditionSettingsByGroup,
} from "./settings-catalog";

describe("system settings catalog", () => {
  it("has stable unique keys", () => {
    const keys = SYSTEM_SETTINGS.map(({ key }) => key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("separates shared and edition-specific settings", () => {
    expect(SHARED_SETTINGS.every(({ category }) => category === "shared")).toBe(
      true,
    );
    expect(
      FIRST_EDITION_SETTINGS.every(
        ({ category }) => category === "first-edition",
      ),
    ).toBe(true);
    expect(
      SECOND_EDITION_SETTINGS.every(
        ({ category }) => category === "second-edition",
      ),
    ).toBe(true);
  });

  it("keeps the complete compatibility preset in the First Edition menu", () => {
    expect(
      FIRST_EDITION_SETTINGS.filter(({ key }) =>
        key.startsWith("useFirstEdition"),
      ),
    ).toHaveLength(RULES_COMPATIBILITY_KEYS.length);
    expect(
      FIRST_EDITION_SETTINGS.some(({ key }) => key === "useOpenD6Rules"),
    ).toBe(true);
  });

  it("organizes every Second Edition setting exactly once by rulebook module", () => {
    const groupedKeys = SECOND_EDITION_SETTING_GROUPS.flatMap(
      ({ settingKeys }) => settingKeys,
    );
    expect(groupedKeys).toHaveLength(SECOND_EDITION_SETTINGS.length);
    expect(new Set(groupedKeys).size).toBe(groupedKeys.length);
    expect(new Set(groupedKeys)).toEqual(
      new Set(SECOND_EDITION_SETTINGS.map(({ key }) => key)),
    );
  });

  it("keeps rulebook names and printed-page references in source order", () => {
    expect(
      SECOND_EDITION_SETTING_GROUPS.map(
        ({ id, kind, pageReference }) => `${kind}:${id}:${pageReference}`,
      ),
    ).toEqual([
      "core:core-campaign:pp. 20, 28",
      "module:additional-attributes:pp. 62-68",
      "module:advancement:pp. 86-93",
      "module:pips:pp. 94-95",
      "module:skill-specializations-advanced-skills:pp. 96-100",
    ]);
    expect(
      SECOND_EDITION_SETTING_GROUPS.every(({ name }) =>
        name.startsWith("D6E2.Settings.SecondEdition.Groups."),
      ),
    ).toBe(true);
  });

  it("resolves module groups to stable setting definitions", () => {
    expect(
      secondEditionSettingsByGroup().flatMap(({ settings }) =>
        settings.map(({ key }) => key),
      ),
    ).toEqual(
      SECOND_EDITION_SETTING_GROUPS.flatMap(({ settingKeys }) => settingKeys),
    );
  });
});
