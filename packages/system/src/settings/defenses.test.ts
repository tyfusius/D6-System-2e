import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  currentDefenseRuntimeStrategy,
  defenseRuntimeStrategy,
} from "./defenses";

let configured = "d6e2.defenses.static";
const settings = new Map<string, unknown>();

vi.mock("./rules-profile-library", () => ({
  currentConfiguredRulesProfile: () => ({
    strategies: { activeDefenses: configured },
  }),
}));

beforeEach(() => {
  configured = "d6e2.defenses.static";
  settings.clear();
  vi.stubGlobal("game", {
    settings: { get: (_namespace: string, key: string) => settings.get(key) },
  });
});

describe("defense runtime strategies", () => {
  it("publishes immutable static, range, and active contracts", () => {
    expect(defenseRuntimeStrategy("d6e2.defenses.static")).toMatchObject({
      family: "static",
      fullDefense: "second-edition-skill-bonus",
      ranged: "static-dodge",
      targeting: "actor-static",
    });
    expect(defenseRuntimeStrategy("d6e2.defenses.no-dodge")).toMatchObject({
      family: "range",
      ranged: "fixed-range",
      targeting: "fixed-range",
    });
    expect(defenseRuntimeStrategy("open-d6.defenses.active")).toMatchObject({
      activeDefense: "committed-roll",
      family: "active",
      partialDefense: "open-d6-roll",
      reaction: "triggered-interrupt",
      targeting: "manual",
    });
    expect(Object.isFrozen(defenseRuntimeStrategy(configured))).toBe(true);
  });

  it("refines the bundled static strategy through the No Dodge module", () => {
    settings.set("secondEditionNoDodgeDefenseModule", true);
    expect(currentDefenseRuntimeStrategy().id).toBe("d6e2.defenses.no-dodge");
  });

  it("honors an imported active strategy selected by the Rules Profile", () => {
    configured = "open-d6.defenses.active";
    expect(currentDefenseRuntimeStrategy().id).toBe("open-d6.defenses.active");
  });

  it("falls back safely when a contribution names an unknown strategy", () => {
    configured = "community.defenses.unavailable";
    expect(currentDefenseRuntimeStrategy().id).toBe("d6e2.defenses.static");
  });
});
