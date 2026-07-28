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
      "campaign.profile",
      "combat.command",
      "combat.read",
      "health.condition",
      "rules.capabilities",
      "rules.profile",
      "read.actor",
      "roll.check",
      "roll.double-down",
      "roll.attribute",
      "roll.item",
      "roll.reroll",
      "roll.skill",
      "registry.terminology",
      "registry.theme",
    ]);
    expect(api.capabilities.has("foundation.identity")).toBe(true);
    expect(api.capabilities.has("advancement.command")).toBe(true);
    expect(api.capabilities.has("campaign.profile")).toBe(true);
    expect(api.capabilities.has("combat.command")).toBe(true);
    expect(api.capabilities.has("combat.read")).toBe(true);
    expect(api.campaign.current()).toMatchObject({
      id: "core-default",
      profileVersion: 1,
    });
    expect(api.capabilities.has("read.actor")).toBe(true);
    expect(api.capabilities.has("roll.check")).toBe(true);
    expect(api.capabilities.has("rules.profile")).toBe(true);
    expect(api.capabilities.has("rules.capabilities")).toBe(true);
    expect(api.rules.capabilities()).toMatchObject({
      contractVersion: 1,
      rulesProfileId: "second-edition",
    });
    expect(api.capabilities.has("registry.terminology")).toBe(true);
    expect(api.capabilities.has("registry.theme")).toBe(true);
    expect(api.migrations.latestSchemaVersion).toBe(9);
  });

  it("does not expose mutable capability storage", () => {
    const api = createD6System2eApi();
    const values = api.capabilities.values();
    expect(Object.isFrozen(values)).toBe(true);
  });
});
