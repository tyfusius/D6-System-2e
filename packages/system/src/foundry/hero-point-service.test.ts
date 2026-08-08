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
      superheroic: {
        relationships: { nemesisActive: false, nemesisPoints: 0 },
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
      const nemesisPoints =
        changes["system.superheroic.relationships.nemesisPoints"];
      if (typeof nemesisPoints === "number") {
        document.system.superheroic.relationships.nemesisPoints = nemesisPoints;
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
  it("uses the active Nemesis encounter pool through ordinary Hero Point transactions", async () => {
    const nemesis = actor("nemesis", 2, 0);
    nemesis.system.superheroic.relationships = {
      nemesisActive: true,
      nemesisPoints: 7,
    };
    stubGame(
      new Map<string, unknown>([
        [SECOND_EDITION_OPTION_KEYS.heroPointStrategy, "heroic"],
        [SECOND_EDITION_OPTION_KEYS.perksFlawsTalentsModule, true],
        [SECOND_EDITION_OPTION_KEYS.nemesisCompanionsSidekicksModule, true],
      ]),
      [nemesis],
    );
    expect(actorHeroPointBalance(nemesis)).toBe(7);
    await transactActorHeroPoints(nemesis, 2, 0);
    expect(nemesis.system.superheroic.relationships.nemesisPoints).toBe(5);
    expect(nemesis.system.resources.heroPoints.value).toBe(2);
  });
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

  it("fails closed when the active economy is Character and Fate Points", async () => {
    const hero = actor("hero", 3, 0);
    stubGame(
      new Map([
        [
          "worldRulesProfiles",
          { activeProfileId: "open-d6", profiles: {}, version: 1 },
        ],
      ]),
      [hero],
    );
    expect(actorHeroPointBalance(hero)).toBe(0);
    await expect(transactActorHeroPoints(hero, 1, 0)).rejects.toThrow(
      "D6E2.Roll.HeroPoint.SecondEditionRequired",
    );
    expect(hero.system.resources.heroPoints.value).toBe(3);
  });
});
