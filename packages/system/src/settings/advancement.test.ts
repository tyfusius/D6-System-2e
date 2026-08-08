import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  advancementRuntimeStrategy,
  currentAdvancementCostMultipliers,
  currentAdvancementRuntimeStrategy,
} from "./advancement";

let configured = "d6e2.advancement.configured";
const settings = new Map<string, unknown>();

vi.mock("./rules-profile-library", () => ({
  currentConfiguredRulesProfile: () => ({
    strategies: { advancement: configured },
  }),
}));

beforeEach(() => {
  configured = "d6e2.advancement.configured";
  settings.clear();
  vi.stubGlobal("game", {
    settings: { get: (_namespace: string, key: string) => settings.get(key) },
  });
});

describe("advancement runtime strategies", () => {
  it("publishes immutable cost, award, progression, and specialization contracts", () => {
    expect(
      advancementRuntimeStrategy("d6e2.advancement.experience-points"),
    ).toEqual({
      awards: "session-experience-points",
      cost: "second-edition-rating",
      family: "experience-points",
      id: "d6e2.advancement.experience-points",
      progression: "direct-spend",
      specialization: "experience-acquisition-only",
      step: "pips-aware",
    });
    expect(
      advancementRuntimeStrategy("open-d6.advancement.character-points"),
    ).toMatchObject({
      cost: "configured-character-point-multipliers",
      progression: "direct-spend",
      specialization: "direct-spend",
      step: "one-pip",
    });
    expect(Object.isFrozen(advancementRuntimeStrategy(configured))).toBe(true);
  });

  it("resolves the configured Second Edition workflow at one boundary", () => {
    settings.set("secondEditionAdvancementStrategy", "milestone");
    expect(currentAdvancementRuntimeStrategy()).toMatchObject({
      awards: "gm-milestone-bundle",
      id: "d6e2.advancement.milestone",
    });
  });

  it("honors imported Open D6 advancement and concrete contributed selections", () => {
    configured = "open-d6.advancement.character-points";
    expect(currentAdvancementRuntimeStrategy().id).toBe(
      "open-d6.advancement.character-points",
    );
    configured = "d6e2.advancement.narrative";
    expect(currentAdvancementRuntimeStrategy().progression).toBe(
      "narrative-arcs",
    );
  });

  it("fails closed for an unavailable contributed strategy", () => {
    configured = "community.advancement.unavailable";
    expect(currentAdvancementRuntimeStrategy()).toMatchObject({
      family: "unavailable",
      id: "d6e2.advancement.unselected",
    });
  });

  it("keeps configured Open D6 cost multipliers inside the advancement boundary", () => {
    settings.set("firstEditionAdvanceCostAttribute", 12);
    settings.set("firstEditionAdvanceCostSkill", 2);
    settings.set("firstEditionAdvanceCostSpecialization", 1);
    expect(currentAdvancementCostMultipliers()).toEqual({
      attribute: 12,
      skill: 2,
      specialization: 1,
    });
  });
});
