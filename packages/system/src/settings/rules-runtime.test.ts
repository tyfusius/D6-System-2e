import { beforeEach, describe, expect, it, vi } from "vitest";

const values = new Map<string, unknown>();
vi.stubGlobal("game", {
  settings: { get: (_system: string, key: string) => values.get(key) },
});

import { currentRulesRuntime } from "./rules-runtime";

describe("neutral rules runtime snapshot", () => {
  beforeEach(() => {
    values.clear();
  });

  it("projects the authoritative concrete strategies as one immutable contract", () => {
    const runtime = currentRulesRuntime();

    expect(runtime).toMatchObject({
      actionEconomy: {
        owner: "second-edition",
        strategy: "d6e2.action-economy.segmented",
      },
      attributes: { strategy: "d6e2.attributes.campaign-profile" },
      contractVersion: 1,
      damage: { strategy: "d6e2.damage.conditions" },
      rulesProfileId: "second-edition",
      scale: {
        owner: "second-edition",
        strategy: "d6e2.scale.ranked",
      },
      wildDie: {
        strategy: "d6e2.wild-die.advantage-complication",
      },
    });
    expect(Object.isFrozen(runtime)).toBe(true);
    expect(Object.isFrozen(runtime.decisions)).toBe(true);
    expect(runtime.decisions.every(Object.isFrozen)).toBe(true);
  });

  it("reports independently imported mechanics from their concrete owner", () => {
    values.set("worldRulesProfiles", {
      activeProfileId: "table-rules",
      profiles: {
        "table-rules": {
          id: "table-rules",
          source: { kind: "world" },
          strategies: {
            movement: "open-d6.movement.relative",
            wildDie: "open-d6.wild-die.critical-one",
          },
        },
      },
      version: 1,
    });

    const runtime = currentRulesRuntime();

    expect(runtime.movement).toMatchObject({
      owner: "open-d6",
      strategy: "open-d6.movement.relative",
    });
    expect(runtime.wildDie).toMatchObject({
      owner: "open-d6",
      strategy: "open-d6.wild-die.critical-one",
    });
    expect(runtime.actionEconomy.owner).toBe("second-edition");
  });

  it("preserves inactive optional data and exposes unmet dependencies", () => {
    values.set("secondEditionPerksFlawsTalentsModule", true);

    const runtime = currentRulesRuntime();

    expect(runtime.rankedFeatures).toMatchObject({
      blockedBy: ["active-pips"],
      state: "inactive-preserved",
      strategy: "stored-inactive",
    });
  });
});
