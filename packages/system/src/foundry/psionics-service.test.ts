import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  psionicPowerRegistry,
  resetPsionicPowerRegistryForTests,
} from "../registries/psionics";
import { readActorPsionics } from "./psionics-service";

describe("Psionics actor state", () => {
  beforeEach(() => {
    Object.assign(globalThis, { game: { time: { worldTime: 100_000 } } });
    resetPsionicPowerRegistryForTests();
    psionicPowerRegistry.register("test-companion", {
      catalogVersion: 1,
      id: "test.psionics",
      powers: [
        {
          baseDifficulty: 12,
          disciplines: ["kinesis", "perceive"],
          id: "test.combined-power",
          label: "Combined test power",
          scalingDifficultyPerAttempt: 2,
          source: { book: "Authorized Test Companion", page: 7 },
        },
      ],
    });
  });

  afterEach(resetPsionicPowerRegistryForTests);

  it("adds complete discipline pools and counts only recent attempts", () => {
    const item = (id: string, key: string, score: number) => ({
      id,
      system: { key, psionicTraining: "teacher", score, training: "psionic" },
      type: "skill",
    });
    const state = readActorPsionics({
      items: {
        contents: [
          item("k", "psionics-kinesis", 6),
          item("p", "psionics-perceive", 4),
          item("r", "psionics-reform", 0),
        ],
      },
      system: {
        psionics: {
          attempts: [
            { powerId: "test.combined-power", worldTime: 99_999 },
            { powerId: "test.combined-power", worldTime: 1 },
          ],
        },
      },
    });

    expect(state.disciplines.map(({ id, trained }) => [id, trained])).toEqual([
      ["kinesis", true],
      ["perceive", true],
      ["reform", false],
    ]);
    expect(state.powers[0]).toMatchObject({
      available: true,
      poolScore: 9,
      recentAttempts: 1,
    });
  });
});
