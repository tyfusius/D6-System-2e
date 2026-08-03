import { describe, expect, it } from "vitest";
import { isD6System2eApiV1 } from "@d6-system-2e/core";
import { createD6System2eApi } from "./create-api";

describe("foundation API", () => {
  it("publishes only working capabilities", () => {
    const api = createD6System2eApi();
    expect(isD6System2eApiV1(api)).toBe(true);
    expect(api.capabilities.values()).toEqual([
      "foundation.identity",
      "magic.freeform",
      "magic.points",
      "advancement.command",
      "campaign.profile",
      "creation.template",
      "chase.command",
      "chase.read",
      "combat.command",
      "combat.read",
      "health.condition",
      "health.wound",
      "feature.command",
      "feature.read",
      "rules.capabilities",
      "rules.profile",
      "read.actor",
      "roll.check",
      "roll.double-down",
      "roll.defense",
      "roll.attribute",
      "roll.item",
      "roll.resistance",
      "roll.reroll",
      "roll.skill",
      "registry.terminology",
      "registry.theme",
      "registry.equipment",
      "registry.templates",
      "registry.bestiary",
      "registry.features",
      "registry.discipline",
      "registry.hideout-features",
    ]);
    expect(api.capabilities.has("foundation.identity")).toBe(true);
    expect(api.capabilities.has("advancement.command")).toBe(true);
    expect(typeof api.advancement.specialization).toBe("function");
    expect(typeof api.advancement.milestone.award).toBe("function");
    expect(typeof api.advancement.milestone.exchangeForPerk).toBe("function");
    expect(typeof api.advancement.narrative.propose).toBe("function");
    expect(typeof api.advancement.narrative.approve).toBe("function");
    expect(typeof api.advancement.narrative.complete).toBe("function");
    expect(api.capabilities.has("campaign.profile")).toBe(true);
    expect(api.capabilities.has("magic.freeform")).toBe(true);
    expect(typeof api.magic.cast).toBe("function");
    expect(api.capabilities.has("registry.discipline")).toBe(true);
    expect(api.capabilities.has("registry.hideout-features")).toBe(true);
    expect(typeof api.hideoutFeatureRegistry.register).toBe("function");
    expect(typeof api.psionics.roll).toBe("function");
    expect(api.capabilities.has("chase.command")).toBe(true);
    expect(typeof api.chase.start).toBe("function");
    expect(api.capabilities.has("combat.command")).toBe(true);
    expect(api.capabilities.has("combat.read")).toBe(true);
    expect(api.campaign.current()).toMatchObject({
      id: "core-default",
      profileVersion: 1,
    });
    expect(api.capabilities.has("read.actor")).toBe(true);
    expect(api.capabilities.has("roll.check")).toBe(true);
    expect(api.capabilities.has("roll.defense")).toBe(true);
    expect(typeof api.roll.defense).toBe("function");
    expect(api.capabilities.has("roll.resistance")).toBe(true);
    expect(typeof api.roll.resistance).toBe("function");
    expect(api.capabilities.has("rules.profile")).toBe(true);
    expect(api.capabilities.has("rules.capabilities")).toBe(true);
    expect(api.rules.capabilities()).toMatchObject({
      contractVersion: 1,
      rulesProfileId: "second-edition",
    });
    expect(api.capabilities.has("registry.terminology")).toBe(true);
    expect(api.capabilities.has("registry.theme")).toBe(true);
    expect(api.capabilities.has("registry.equipment")).toBe(true);
    expect(api.capabilities.has("registry.templates")).toBe(true);
    expect(api.capabilities.has("registry.bestiary")).toBe(true);
    expect(api.capabilities.has("registry.features")).toBe(true);
    expect(typeof api.bestiary.preview).toBe("function");
    expect(typeof api.characterTemplates.preview).toBe("function");
    expect(api.migrations.latestSchemaVersion).toBe(38);
  });

  it("does not expose mutable capability storage", () => {
    const api = createD6System2eApi();
    const values = api.capabilities.values();
    expect(Object.isFrozen(values)).toBe(true);
  });
});
