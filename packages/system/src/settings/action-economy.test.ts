import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  actionEconomyRuntimeStrategy,
  currentActionEconomyRuntimeStrategy,
} from "./action-economy";
import { WORLD_RULES_PROFILES_SETTING } from "./rules-profile-library";

beforeEach(() => {
  vi.stubGlobal("game", {
    settings: { get: () => false },
  });
});

describe("action economy runtime strategy", () => {
  it("resolves the complete Second Edition runtime contract", () => {
    expect(
      actionEconomyRuntimeStrategy("d6e2.action-economy.segmented"),
    ).toEqual({
      actionCountLabel: "actions",
      declaration: "ordered-actions",
      family: "segmented",
      freshWound: "forfeit-remaining",
      id: "d6e2.action-economy.segmented",
      penalty: "declared-actions-minus-one",
      reaction: "declared-only",
      roundTransition: "reset-round-state",
      turnScheduling: "combatant-action-order",
    });
  });

  it("refines Open D6 scheduling without changing its action contract", () => {
    expect(
      actionEconomyRuntimeStrategy("open-d6.action-economy.flexible"),
    ).toMatchObject({
      declaration: "action-commitment",
      id: "open-d6.action-economy.flexible",
      penalty: "planned-actions-minus-allotment",
      turnScheduling: "free-commitment",
    });
    expect(
      actionEconomyRuntimeStrategy("open-d6.action-economy.flexible", true),
    ).toMatchObject({
      declaration: "action-commitment",
      id: "open-d6.action-economy.segmented",
      penalty: "planned-actions-minus-allotment",
      turnScheduling: "round-robin-segments",
    });
  });

  it("lets the active Open D6 profile and optional scheduler select one runtime", () => {
    vi.stubGlobal("game", {
      settings: {
        get: (_namespace: string, key: string) =>
          key === WORLD_RULES_PROFILES_SETTING
            ? { activeProfileId: "open-d6", profiles: {}, version: 1 }
            : key === "tyfusiusFirstEditionSegmentedActions"
              ? true
              : false,
      },
    });
    expect(currentActionEconomyRuntimeStrategy()).toMatchObject({
      id: "open-d6.action-economy.segmented",
      reaction: "triggered-interrupt",
      turnScheduling: "round-robin-segments",
    });
  });

  it("resolves an imported Open D6 action economy only at the boundary", () => {
    vi.stubGlobal("game", {
      settings: {
        get: (_namespace: string, key: string) =>
          key === WORLD_RULES_PROFILES_SETTING
            ? {
                activeProfileId: "table-rules",
                profiles: {
                  "table-rules": {
                    id: "table-rules",
                    source: { kind: "world" },
                    strategies: {
                      actionEconomy: "open-d6.action-economy.flexible",
                    },
                  },
                },
                version: 1,
              }
            : false,
      },
    });
    expect(currentActionEconomyRuntimeStrategy()).toMatchObject({
      id: "open-d6.action-economy.flexible",
      freshWound: "preserve-actions",
    });
  });

  it("falls back safely for an unknown contributed strategy", () => {
    expect(actionEconomyRuntimeStrategy("contributed.unknown")).toBe(
      actionEconomyRuntimeStrategy("d6e2.action-economy.segmented"),
    );
  });
});
