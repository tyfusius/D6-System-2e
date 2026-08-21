import { describe, expect, it } from "vitest";
import { isD6System2eApiV2 } from "@d6-system-2e/core";
import { createD6System2eApi } from "./create-api";

describe("foundation API", () => {
  it("publishes only working capabilities", () => {
    const api = createD6System2eApi();
    expect(isD6System2eApiV2(api)).toBe(true);
    expect(api.apiVersion).toBe(2);
    expect(api.capabilities.values()).toEqual([
      "foundation.identity",
      "magic.freeform",
      "magic.points",
      "migration.world-import",
      "advancement.command",
      "campaign.profile",
      "creation.template",
      "chase.command",
      "chase.read",
      "combat.command",
      "combat.read",
      "health.condition",
      "health.body-points",
      "health.command",
      "health.read",
      "health.wound",
      "feature.command",
      "feature.read",
      "extraordinary-power.command",
      "extraordinary-power.read",
      "extraordinary-power.roll-plan",
      "rules.runtime",
      "rules.profile",
      "setting.profile",
      "ui.actor-sheet",
      "profile-preset.transaction",
      "registry.profile-presets",
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
      "registry.extraordinary-power-frameworks",
      "registry.discipline",
      "registry.hideout-features",
      "registry.campaign-packages",
      "registry.content-packages",
      "registry.first-edition-genre-profiles",
      "registry.rules-profiles",
      "registry.setting-profiles",
      "registry.health-models",
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
    expect(typeof api.campaignPackages.selection).toBe("function");
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
    expect(api.capabilities.has("health.read")).toBe(true);
    expect(api.capabilities.has("health.command")).toBe(true);
    expect(typeof api.health.read).toBe("function");
    expect(typeof api.health.setTrack).toBe("function");
    expect(typeof api.health.setPool).toBe("function");
    expect(typeof api.health.damagePool).toBe("function");
    expect(typeof api.health.healPool).toBe("function");
    expect(api.capabilities.has("roll.check")).toBe(true);
    expect(api.capabilities.has("roll.defense")).toBe(true);
    expect(typeof api.roll.defense).toBe("function");
    expect(api.capabilities.has("roll.resistance")).toBe(true);
    expect(typeof api.roll.resistance).toBe("function");
    expect(api.capabilities.has("rules.profile")).toBe(true);
    expect(api.capabilities.has("rules.runtime")).toBe(true);
    expect(api.rules.configured()).toMatchObject({
      id: "second-edition",
      version: 3,
    });
    expect(api.capabilities.has("registry.rules-profiles")).toBe(true);
    expect(typeof api.rulesProfileRegistry.register).toBe("function");
    expect(api.capabilities.has("setting.profile")).toBe(true);
    expect(api.capabilities.has("ui.actor-sheet")).toBe(true);
    expect(typeof api.ui?.openActorSheet).toBe("function");
    expect(api.capabilities.has("profile-preset.transaction")).toBe(true);
    expect(typeof api.profilePreset.preview).toBe("function");
    expect(typeof api.profilePreset.activate).toBe("function");
    expect(api.capabilities.has("registry.profile-presets")).toBe(true);
    expect(typeof api.profilePresetRegistry.register).toBe("function");
    expect(api.setting.configured()).toMatchObject({
      ownerId: "d6-system-2e",
      profile: { id: "d6-system-second-edition", version: 5 },
      source: "bundled",
    });
    expect(api.setting.selection()).toMatchObject({
      activeProfileId: "d6-system-second-edition",
      available: true,
    });
    expect(api.capabilities.has("registry.setting-profiles")).toBe(true);
    expect(typeof api.settingProfileRegistry.register).toBe("function");
    expect(api.capabilities.has("registry.health-models")).toBe(true);
    expect(api.healthModelRegistry.current()).toHaveLength(4);
    expect(api.rules.runtime()).toMatchObject({
      contractVersion: 1,
      rulesProfileId: "second-edition",
    });
    expect("capabilities" in api.rules).toBe(false);
    expect("current" in api.rules).toBe(false);
    expect("applyPreset" in api.rules).toBe(false);
    expect(api.capabilities.has("registry.terminology")).toBe(true);
    expect(api.capabilities.has("registry.theme")).toBe(true);
    expect(api.capabilities.has("registry.equipment")).toBe(true);
    expect(api.capabilities.has("registry.templates")).toBe(true);
    expect(api.capabilities.has("registry.bestiary")).toBe(true);
    expect(api.capabilities.has("registry.features")).toBe(true);
    expect(
      api.capabilities.has("registry.extraordinary-power-frameworks"),
    ).toBe(true);
    expect(typeof api.extraordinaryPowerFrameworkRegistry.register).toBe(
      "function",
    );
    expect(typeof api.extraordinaryPowers.read).toBe("function");
    expect(typeof api.extraordinaryPowers.activate).toBe("function");
    expect(typeof api.extraordinaryPowers.execute).toBe("function");
    expect(typeof api.bestiary.preview).toBe("function");
    expect(typeof api.bestiary.activateProfiles).toBe("function");
    expect(typeof api.characterTemplates.preview).toBe("function");
    expect(api.migrations.latestSchemaVersion).toBe(53);
    expect(typeof api.migrations.importLegacyExtraordinaryPowerActors).toBe(
      "function",
    );
    expect(typeof api.migrations.importLegacyWorldDocuments).toBe("function");
    expect(typeof api.migrations.previewLegacyWorldDocuments).toBe("function");
  });

  it("does not expose mutable capability storage", () => {
    const api = createD6System2eApi();
    const values = api.capabilities.values();
    expect(Object.isFrozen(values)).toBe(true);
  });
});
