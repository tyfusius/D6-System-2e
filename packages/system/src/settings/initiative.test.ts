import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  configuredSecondEditionInitiativeStrategy,
  currentInitiativeRuntimeStrategy,
  currentSecondEditionInitiativeStrategy,
  initiativeRuntimeStrategy,
} from "./initiative";
import { SECOND_EDITION_OPTION_KEYS } from "./settings-catalog";
import { WORLD_RULES_PROFILES_SETTING } from "./rules-profile-library";

beforeEach(() => {
  vi.stubGlobal("game", {
    settings: {
      get: (_namespace: string, key: string) =>
        key === SECOND_EDITION_OPTION_KEYS.initiativeStrategy
          ? "narrative"
          : false,
    },
  });
});

describe("Second Edition initiative setting", () => {
  it("reads the selected native strategy", () => {
    expect(configuredSecondEditionInitiativeStrategy()).toBe("narrative");
    expect(currentSecondEditionInitiativeStrategy()).toBe("narrative");
    expect(currentInitiativeRuntimeStrategy()).toMatchObject({
      id: "d6e2.initiative.narrative",
      ordering: "manual",
      roll: "system-attribute",
      roundTransition: "rotate-narrative-order",
      tracker: "narrative",
    });
  });

  it("lets the active Open D6 Rules Profile select Perception initiative", () => {
    vi.stubGlobal("game", {
      settings: {
        get: (_namespace: string, key: string) =>
          key === WORLD_RULES_PROFILES_SETTING
            ? { activeProfileId: "open-d6", profiles: {}, version: 1 }
            : key === SECOND_EDITION_OPTION_KEYS.initiativeStrategy
              ? "basic"
              : false,
      },
    });
    expect(configuredSecondEditionInitiativeStrategy()).toBe("basic");
    expect(currentSecondEditionInitiativeStrategy()).toBe("standard");
    expect(currentInitiativeRuntimeStrategy()).toMatchObject({
      family: "perception",
      id: "open-d6.initiative.perception",
      ordering: "rolled-descending",
      roll: "foundry-formula",
      roundTransition: "preserve",
      tracker: "foundry",
    });
  });

  it("resolves an imported Open D6 substitution once at the strategy boundary", () => {
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
                    strategies: { initiative: "open-d6.initiative.perception" },
                  },
                },
                version: 1,
              }
            : key === SECOND_EDITION_OPTION_KEYS.initiativeStrategy
              ? "basic"
              : false,
      },
    });

    expect(currentInitiativeRuntimeStrategy()).toMatchObject({
      id: "open-d6.initiative.perception",
      roll: "foundry-formula",
      tracker: "foundry",
    });
  });

  it("resolves every concrete strategy without an edition alias", () => {
    expect(
      initiativeRuntimeStrategy("d6e2.initiative.contextual", "standard"),
    ).toMatchObject({ family: "contextual", roll: "none" });
    expect(
      initiativeRuntimeStrategy("d6e2.initiative.contextual", "simple"),
    ).toMatchObject({ family: "simple", tracker: "manual" });
    expect(initiativeRuntimeStrategy("d6e2.initiative.basic")).toMatchObject({
      family: "basic",
      ordering: "rolled-descending",
    });
    expect(
      initiativeRuntimeStrategy("d6e2.initiative.narrative"),
    ).toMatchObject({
      family: "narrative",
      roundTransition: "rotate-narrative-order",
    });
    expect(
      initiativeRuntimeStrategy("open-d6.initiative.perception"),
    ).toMatchObject({ family: "perception", roll: "foundry-formula" });
    expect(initiativeRuntimeStrategy("contributed.unknown", "basic")).toBe(
      initiativeRuntimeStrategy("d6e2.initiative.basic"),
    );
  });
});
