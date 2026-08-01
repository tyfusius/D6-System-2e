import { afterEach, describe, expect, it, vi } from "vitest";
import {
  actorHeroPointBalance,
  refreshHeroicHeroPointsForNewSession,
  transactActorHeroPoints,
} from "./hero-point-service";
import { SECOND_EDITION_OPTION_KEYS } from "../settings/settings-catalog";

afterEach(() => vi.unstubAllGlobals());

function actor(id: string, heroPoints: number, experiencePoints: number) {
  const document = {
    id,
    system: {
      resources: {
        experiencePoints: { value: experiencePoints },
        heroPoints: { value: heroPoints },
      },
    },
    type: "character",
    update: vi.fn((changes: Record<string, unknown>) => {
      for (const resourceId of ["experiencePoints", "heroPoints"] as const) {
        const value = changes[`system.resources.${resourceId}.value`];
        if (typeof value === "number") {
          document.system.resources[resourceId].value = value;
        }
      }
      return Promise.resolve();
    }),
  };
  return document;
}

function stubGame(
  values: ReadonlyMap<string, unknown>,
  actors: readonly ReturnType<typeof actor>[],
): void {
  vi.stubGlobal("game", {
    actors: { contents: actors },
    settings: { get: (_namespace: string, key: string) => values.get(key) },
    user: { isGM: true },
  });
}

describe("Hero Point resource service", () => {
  it("uses Experience Points as the single Classic balance", async () => {
    const hero = actor("hero", 9, 4);
    stubGame(
      new Map<string, unknown>([
        [SECOND_EDITION_OPTION_KEYS.heroPointStrategy, "classic"],
        [SECOND_EDITION_OPTION_KEYS.wildDieStrategy, "classic"],
        [SECOND_EDITION_OPTION_KEYS.advancementStrategy, "experience-points"],
      ]),
      [hero],
    );
    expect(actorHeroPointBalance(hero)).toBe(4);
    await transactActorHeroPoints(hero, 2, 1);
    expect(hero.system.resources.experiencePoints.value).toBe(3);
    expect(hero.system.resources.heroPoints.value).toBe(9);
  });

  it("refreshes every personal Actor at a new non-carrying Heroic session", async () => {
    const first = actor("first", 7, 0);
    const second = actor("second", 0, 0);
    stubGame(
      new Map<string, unknown>([
        [SECOND_EDITION_OPTION_KEYS.heroPointStrategy, "heroic"],
        [SECOND_EDITION_OPTION_KEYS.heroicHeroPointsCarryOver, false],
        [SECOND_EDITION_OPTION_KEYS.startingHeroPoints, 2],
      ]),
      [first, second],
    );
    await expect(refreshHeroicHeroPointsForNewSession()).resolves.toBe(2);
    expect(first.system.resources.heroPoints.value).toBe(2);
    expect(second.system.resources.heroPoints.value).toBe(2);
  });
});
