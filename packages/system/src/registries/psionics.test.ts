import { beforeEach, describe, expect, it } from "vitest";
import {
  psionicPowerRegistry,
  resetPsionicPowerRegistryForTests,
} from "./psionics";

describe("Psionic power registry", () => {
  beforeEach(resetPsionicPowerRegistryForTests);

  it("accepts bounded original powers and rejects collisions", () => {
    const catalog = {
      catalogVersion: 1 as const,
      id: "original.psionics",
      powers: [
        {
          baseDifficulty: 10,
          disciplines: ["kinesis", "reform"] as const,
          id: "original-burst",
          label: "Original Burst",
          scalingDifficultyPerAttempt: 5,
          source: { book: "Original companion", page: 1 },
        },
      ],
    };
    psionicPowerRegistry.register("companion", catalog);
    expect(psionicPowerRegistry.current()[0]?.powers[0]).toMatchObject({
      id: "original-burst",
      scalingDifficultyPerAttempt: 5,
    });
    expect(() => psionicPowerRegistry.register("other", catalog)).toThrow(
      /already exists/u,
    );
  });
});
