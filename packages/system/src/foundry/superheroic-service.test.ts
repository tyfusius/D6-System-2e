import { afterEach, describe, expect, it, vi } from "vitest";
import { SECOND_EDITION_OPTION_KEYS } from "../settings/settings-catalog";
import {
  readActorSecretIdentity,
  reinforceActorSecretIdentity,
  transferSuperheroicHeroPoint,
} from "./superheroic-service";

afterEach(() => vi.unstubAllGlobals());

function actor(id: string, heroPoints: number) {
  const document = {
    id,
    isOwner: true,
    items: { contents: [], get: () => undefined },
    name: id,
    system: {
      resources: {
        experiencePoints: { value: 0 },
        heroPoints: { value: heroPoints },
      },
      superheroic: {
        secretIdentity: {
          heroicIdentity: "The Mask",
          heroPoints: 1,
          secretIdentity: "Casey",
          status: "active",
          suspicion: 0,
        },
      },
    },
    type: "character",
    update: vi.fn((changes: Record<string, unknown>) => {
      const identity = changes["system.superheroic.secretIdentity"];
      if (identity) {
        document.system.superheroic.secretIdentity =
          identity as typeof document.system.superheroic.secretIdentity;
      }
      const next = changes["system.resources.heroPoints.value"];
      if (typeof next === "number") {
        document.system.resources.heroPoints.value = next;
      }
      return Promise.resolve();
    }),
  };
  return document;
}

function stubWorld(actors: readonly ReturnType<typeof actor>[]): void {
  const settings = new Map<string, unknown>([
    [SECOND_EDITION_OPTION_KEYS.superheroicHeroPointsModule, true],
    [SECOND_EDITION_OPTION_KEYS.secretIdentitiesModule, true],
    [SECOND_EDITION_OPTION_KEYS.heroPointStrategy, "heroic"],
  ]);
  vi.stubGlobal("game", {
    actors: { contents: actors },
    i18n: { format: (key: string) => key, localize: (key: string) => key },
    settings: { get: (_namespace: string, key: string) => settings.get(key) },
    user: { isGM: true },
  });
  vi.stubGlobal("ChatMessage", {
    create: vi.fn(() => Promise.resolve()),
    getSpeaker: () => ({}),
  });
}

describe("superheroic actor service", () => {
  it("protects and persists a GM-approved identity reinforcement", async () => {
    const hero = actor("hero", 3);
    stubWorld([hero]);
    await reinforceActorSecretIdentity(hero);
    expect(readActorSecretIdentity(hero).heroPoints).toBe(2);
    expect(hero.update).toHaveBeenCalledOnce();
  });

  it("atomically moves one Hero Point to an ally below three", async () => {
    const hero = actor("hero", 2);
    const ally = actor("ally", 2);
    stubWorld([hero, ally]);
    await transferSuperheroicHeroPoint(hero, ally);
    expect(hero.system.resources.heroPoints.value).toBe(1);
    expect(ally.system.resources.heroPoints.value).toBe(3);
  });
});
