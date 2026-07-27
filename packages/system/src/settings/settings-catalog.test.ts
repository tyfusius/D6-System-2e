import { describe, expect, it } from "vitest";
import { RULES_COMPATIBILITY_KEYS } from "@d6-system-2e/core";
import {
  FIRST_EDITION_SETTINGS,
  SECOND_EDITION_SETTINGS,
  SHARED_SETTINGS,
  SYSTEM_SETTINGS,
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
});
