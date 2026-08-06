import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  configuredSecondEditionInitiativeStrategy,
  currentSecondEditionInitiativeStrategy,
} from "./initiative";
import { SECOND_EDITION_OPTION_KEYS } from "./settings-catalog";

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
  });

  it("lets the independent First Edition strategy take precedence", () => {
    vi.stubGlobal("game", {
      settings: {
        get: (_namespace: string, key: string) =>
          key === "useFirstEditionInitiative"
            ? true
            : key === SECOND_EDITION_OPTION_KEYS.initiativeStrategy
              ? "basic"
              : false,
      },
    });
    expect(configuredSecondEditionInitiativeStrategy()).toBe("basic");
    expect(currentSecondEditionInitiativeStrategy()).toBe("standard");
  });
});
