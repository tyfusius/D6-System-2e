import { afterEach, describe, expect, it, vi } from "vitest";
import { SECOND_EDITION_OPTION_KEYS } from "../settings/settings-catalog";
import {
  readActorSecretIdentity,
  relyOnActorSuperpower,
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

function stubWorld(actors: readonly ReturnType<typeof actor>[]) {
  const settings = new Map<string, unknown>([
    [SECOND_EDITION_OPTION_KEYS.superheroicHeroPointsModule, true],
    [SECOND_EDITION_OPTION_KEYS.secretIdentitiesModule, true],
    [SECOND_EDITION_OPTION_KEYS.perksFlawsTalentsModule, true],
    [SECOND_EDITION_OPTION_KEYS.superpowersModule, true],
    [SECOND_EDITION_OPTION_KEYS.heroPointStrategy, "heroic"],
  ]);
  vi.stubGlobal("game", {
    actors: { contents: actors },
    i18n: { format: (key: string) => key, localize: (key: string) => key },
    settings: { get: (_namespace: string, key: string) => settings.get(key) },
    user: { isGM: true },
  });
  const createMessage = vi.fn((message: unknown) => {
    void message;
    return Promise.resolve();
  });
  vi.stubGlobal("ChatMessage", {
    create: createMessage,
    getSpeaker: () => ({}),
  });
  return createMessage;
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

  it("audits declared reliance on an owned non-automatic Superpower", async () => {
    const hero = actor("hero", 2);
    (hero.items.contents as unknown[]).push({
      id: "power-1",
      name: "Custom Power",
      system: {
        cost: 2,
        rank: 2,
        superpower: true,
        superpowerEnhancementCost: 1,
        superpowerLimitationCredit: 2,
      },
      type: "talent",
    });
    const createMessage = stubWorld([hero]);
    await relyOnActorSuperpower(hero, "power-1");
    expect(createMessage).toHaveBeenCalledOnce();
    expect(createMessage.mock.calls[0]?.[0]).toMatchObject({
      flags: {
        "d6-system-2e": {
          kind: "superpowerReliance",
          totalCost: 4,
        },
      },
    });
  });
});
