import { describe, expect, it } from "vitest";
import { RULES_COMPATIBILITY_KEYS } from "@d6-system-2e/core";
import { readFileSync } from "node:fs";
import {
  FIRST_EDITION_SETTINGS,
  SECOND_EDITION_MODULE_CATALOG,
  SECOND_EDITION_SETTING_GROUPS,
  SECOND_EDITION_SETTINGS,
  SHARED_SETTINGS,
  SHARED_SETTING_KEYS,
  SYSTEM_SETTINGS,
  secondEditionSettingsByGroup,
} from "./settings-catalog";

describe("system setting visibility", () => {
  it("uses world scope so Foundry shows GM workspace settings only to GMs", () => {
    const byKey = new Map(
      SHARED_SETTINGS.map((definition) => [definition.key, definition]),
    );
    expect(byKey.get(SHARED_SETTING_KEYS.showPcQuickbar)?.scope).toBe("world");
    expect(byKey.get(SHARED_SETTING_KEYS.showActiveTasksQuickbar)?.scope).toBe(
      "world",
    );
    expect(byKey.get(SHARED_SETTING_KEYS.userTheme)?.scope).toBe("client");
    expect(
      byKey.get(SHARED_SETTING_KEYS.actionDeclarationAssistance),
    ).toMatchObject({
      default: "optional",
      scope: "world",
      type: "string",
    });
  });

  it("keeps action workflow assistance in edition menus and the native GM fallback", () => {
    const registration = readFileSync(
      "packages/system/src/settings/system-settings.ts",
      "utf8",
    );
    const application = readFileSync(
      "packages/system/src/settings/settings-application.ts",
      "utf8",
    );
    const template = readFileSync(
      "templates/settings/edition-settings.hbs",
      "utf8",
    );
    expect(registration).toContain("registerDefinition(definition, true)");
    expect(application).toContain("actionDeclarationAssistance");
    expect(template).toContain('name="{{actionDeclarationAssistance.key}}"');
  });
});

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
      "module:alternate-wild-die:pp. 71-73",
      "module:chases:pp. 73-74",
      "module:environments:pp. 77-78",
      "module:equipment-by-genre-era:pp. 79-85",
      "module:advancement:pp. 86-93",
      "module:pips:pp. 94-95",
      "module:skill-specializations-advanced-skills:pp. 96-100",
      "module:character-features:pp. 101-131",
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

  it("catalogs every printed module across all four rulebook families", () => {
    const ids = SECOND_EDITION_MODULE_CATALOG.map(({ id }) => id);
    expect(ids).toHaveLength(41);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      Object.fromEntries(
        ["core", "fantasy", "science-fiction", "superheroic"].map((genre) => [
          genre,
          SECOND_EDITION_MODULE_CATALOG.filter((entry) => entry.genre === genre)
            .length,
        ]),
      ),
    ).toEqual({
      core: 18,
      fantasy: 6,
      "science-fiction": 8,
      superheroic: 9,
    });
  });

  it("includes modules omitted from the shortened printed worksheet", () => {
    const ids = new Set(SECOND_EDITION_MODULE_CATALOG.map(({ id }) => id));
    for (const omittedWorksheetId of [
      "general-foes-bestiary",
      "templates",
      "fantasy-bestiary",
      "fantasy-templates",
      "scale",
      "science-fiction-bestiary",
      "science-fiction-templates",
      "superheroic-hero-points",
      "capping-die-codes",
      "secret-identities",
      "superheroic-templates",
    ]) {
      expect(ids.has(omittedWorksheetId)).toBe(true);
    }
  });

  it("keeps module relationships valid and configurable links resolvable", () => {
    const ids = new Set(SECOND_EDITION_MODULE_CATALOG.map(({ id }) => id));
    const groupIds = new Set<string>(
      SECOND_EDITION_SETTING_GROUPS.map(({ id }) => id),
    );
    for (const entry of SECOND_EDITION_MODULE_CATALOG) {
      expect(entry.pageReference).toMatch(/^p{1,2}\. /);
      expect(entry.dependencyIds ?? []).not.toContain(entry.id);
      for (const dependencyId of entry.dependencyIds ?? []) {
        expect(ids.has(dependencyId)).toBe(true);
      }
      if (entry.settingGroupId) {
        expect(groupIds.has(entry.settingGroupId)).toBe(true);
        expect(entry.support).not.toBe("planned");
      }
    }
  });

  it("localizes every complete-catalog title, summary, and support state", () => {
    const translations = JSON.parse(
      readFileSync("lang/en.json", "utf8"),
    ) as Record<string, string>;
    for (const entry of SECOND_EDITION_MODULE_CATALOG) {
      expect(translations[entry.name]).toBeTypeOf("string");
      expect(translations[entry.hint]).toBeTypeOf("string");
      expect(
        translations[
          `D6E2.Settings.SecondEdition.ModuleCatalog.State.${entry.support}`
        ],
      ).toBeTypeOf("string");
    }
  });

  it("routes catalog configuration buttons through the ApplicationV2 scroll action", () => {
    const template = readFileSync(
      "templates/settings/edition-settings.hbs",
      "utf8",
    );
    const application = readFileSync(
      "packages/system/src/settings/settings-application.ts",
      "utf8",
    );
    expect(template).toContain('data-action="scrollToModuleSettings"');
    expect(template).toContain(
      'data-setting-group-id="{{entry.settingGroupId}}"',
    );
    expect(template).not.toContain('href="#d6e2-module-');
    expect(application).toContain("scrollIntoView");
  });
});
