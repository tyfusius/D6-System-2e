import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyD6MatchingReward } from "./matching-reward-service";

const mocks = vi.hoisted(() => ({ openD6: false }));
vi.mock("../settings/roll-outcome", () => ({
  currentMetaCurrencyRuntimeStrategy: () =>
    mocks.openD6
      ? { primaryResource: "characterPoints", secondaryResource: "fatePoints" }
      : { primaryResource: "heroPoints", secondaryResource: null },
}));
vi.mock("./mechanical-edit-guard", () => ({
  withAuthorizedOpenD6ResourceUpdate: (
    _actor: object,
    update: () => Promise<unknown>,
  ) => update(),
}));

const plan = Object.freeze({
  characterPoints: 2,
  evaluatorId: "d6-nexus.matches-v1",
  metaCurrency: 1,
  operationId: "reward-op",
  patternId: "full-house",
  patternLabel: "Full house",
  detectorId: "d6-nexus.matching-detector.matches-v1",
  version: 1 as const,
});

function actor(fail = false) {
  let ledger: string[] = [];
  const document = {
    id: "actor-1",
    system: {
      resources: {
        characterPoints: { value: 3 },
        fatePoints: { value: 4 },
        heroPoints: { value: 5 },
      },
    },
    getFlag: () => ledger,
    update: vi.fn((changes: Record<string, unknown>) => {
      if (fail) return Promise.reject(new Error("rollback"));
      ledger = changes[
        "flags.d6-system-2e.matchingRewardOperations"
      ] as string[];
      for (const [path, value] of Object.entries(changes)) {
        const match = /^system\.resources\.([^.]+)\.value$/u.exec(path);
        if (match) {
          const resourceKey = match[1];
          const resource =
            resourceKey === undefined
              ? undefined
              : (
                  document.system.resources as Record<string, { value: number }>
                )[resourceKey];
          if (resource) resource.value = Number(value);
        }
      }
      return Promise.resolve();
    }),
  };
  return document;
}

describe("matching reward service", () => {
  beforeEach(() => {
    mocks.openD6 = false;
  });

  it("atomically grants both currencies exactly once across duplicate delivery", async () => {
    const target = actor();
    const [first, second] = await Promise.all([
      applyD6MatchingReward(target as never, plan),
      applyD6MatchingReward(target as never, plan),
    ]);
    expect(first.status).toBe("granted");
    expect(second.status).toBe("granted");
    expect(target.system.resources.heroPoints.value).toBe(6);
    expect(target.system.resources.characterPoints.value).toBe(5);
    expect(target.update).toHaveBeenCalledTimes(1);
  });

  it("uses Fate Points for OpenD6 and leaves no partial mutation on failure", async () => {
    mocks.openD6 = true;
    const target = actor(true);
    const result = await applyD6MatchingReward(target as never, plan);
    expect(result).toMatchObject({
      metaCurrencyResource: "fatePoints",
      status: "failed",
    });
    expect(target.system.resources).toEqual({
      characterPoints: { value: 3 },
      fatePoints: { value: 4 },
      heroPoints: { value: 5 },
    });
  });
});
