import { describe, expect, it } from "vitest";
import { isD6System2eApiV1 } from "@d6-system-2e/core";
import { createD6System2eApi } from "./create-api";

describe("foundation API", () => {
  it("publishes only working capabilities", () => {
    const api = createD6System2eApi();
    expect(isD6System2eApiV1(api)).toBe(true);
    expect(api.capabilities.values()).toEqual([
      "foundation.identity",
      "advancement.command",
      "rules.profile",
      "read.actor",
      "roll.check",
      "roll.attribute",
      "roll.skill",
      "registry.terminology",
      "registry.theme",
    ]);
    expect(api.capabilities.has("foundation.identity")).toBe(true);
    expect(api.capabilities.has("advancement.command")).toBe(true);
    expect(api.capabilities.has("read.actor")).toBe(true);
    expect(api.capabilities.has("roll.check")).toBe(true);
    expect(api.capabilities.has("rules.profile")).toBe(true);
    expect(api.capabilities.has("registry.terminology")).toBe(true);
    expect(api.capabilities.has("registry.theme")).toBe(true);
    expect(api.migrations.latestSchemaVersion).toBe(5);
  });

  it("does not expose mutable capability storage", () => {
    const api = createD6System2eApi();
    const values = api.capabilities.values();
    expect(Object.isFrozen(values)).toBe(true);
  });
});
