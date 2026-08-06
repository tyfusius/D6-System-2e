import { afterEach, describe, expect, it, vi } from "vitest";
import { currentSecondEditionHyperLethalProfile } from "./hyper-lethal";
import { SECOND_EDITION_OPTION_KEYS } from "./settings-catalog";

afterEach(() => vi.unstubAllGlobals());

describe("Second Edition Hyper-lethal settings adapter", () => {
  it("keeps all four options independently selectable", () => {
    const values = new Map<string, unknown>([
      [SECOND_EDITION_OPTION_KEYS.hyperLethalKillingBlows, true],
      [SECOND_EDITION_OPTION_KEYS.hyperLethalMaximumArmor, true],
      [SECOND_EDITION_OPTION_KEYS.hyperLethalRemoveStunned, false],
      [SECOND_EDITION_OPTION_KEYS.hyperLethalRemoveWounded, true],
    ]);
    vi.stubGlobal("game", {
      settings: {
        get: (_namespace: string, key: string) => values.get(key),
      },
    });
    expect(currentSecondEditionHyperLethalProfile()).toEqual({
      killingBlows: true,
      maximumResistanceScore: 18,
      removeStunned: false,
      removeWounded: true,
    });
  });
});
