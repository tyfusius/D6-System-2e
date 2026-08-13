import { beforeEach, describe, expect, it, vi } from "vitest";
import type { D6RollResultV1 } from "@d6-system-2e/core";
import { applyWildTriumphRewards } from "./wild-triumph-reward-service";

const mocks = vi.hoisted(() => {
  const strategy: { heroPointStrategy: string | null; id: string } = {
    heroPointStrategy: "heroic",
    id: "second-edition.meta-currency.hero-points",
  };
  return {
    awardOpenD6: vi.fn(),
    strategy,
    transactHero: vi.fn(),
  };
});

vi.mock("../settings/roll-outcome", () => ({
  currentMetaCurrencyRuntimeStrategy: () => mocks.strategy,
}));
vi.mock("./hero-point-service", () => ({
  transactActorHeroPoints: mocks.transactHero,
}));
vi.mock("./open-d6-roll-resource-service", () => ({
  awardOpenD6RollResources: mocks.awardOpenD6,
}));

function actor() {
  const document = {
    id: "actor-1",
    system: { resources: { characterPoints: { value: 4 } } },
    update: vi.fn((changes: Record<string, unknown>) => {
      const value = changes["system.resources.characterPoints.value"];
      if (typeof value === "number") {
        document.system.resources.characterPoints.value = value;
      }
      return Promise.resolve(document);
    }),
  };
  return document;
}

function result(triggered = true): D6RollResultV1 {
  return {
    wildTriumph: {
      automaticSuccessApplied: false,
      characterPointAward: 2,
      consecutiveSixes: 3,
      metaCurrencyAward: 1,
      successful: true,
      threshold: 3,
      triggered,
    },
  } as D6RollResultV1;
}

describe("Wild Triumph reward service", () => {
  beforeEach(() => {
    mocks.awardOpenD6.mockReset();
    mocks.transactHero.mockReset();
    mocks.strategy.id = "second-edition.meta-currency.hero-points";
    mocks.strategy.heroPointStrategy = "heroic";
  });

  it("awards active Hero Points and latent Character Points in Second Edition", async () => {
    const hero = actor();
    await applyWildTriumphRewards(hero, result());
    expect(mocks.transactHero).toHaveBeenCalledWith(hero, 0, 1);
    expect(hero.system.resources.characterPoints.value).toBe(6);
  });

  it("awards Fate/Force and Character Points together under Open D6", async () => {
    const hero = actor();
    mocks.strategy.id = "open-d6.meta-currency.character-and-fate-points";
    mocks.strategy.heroPointStrategy = null;
    await applyWildTriumphRewards(hero, result());
    expect(mocks.awardOpenD6).toHaveBeenCalledWith(hero, 2, 1);
    expect(mocks.transactHero).not.toHaveBeenCalled();
    expect(hero.update).not.toHaveBeenCalled();
  });

  it("does not award configured values until Wild Triumph triggers", async () => {
    const hero = actor();
    await applyWildTriumphRewards(hero, result(false));
    expect(mocks.transactHero).not.toHaveBeenCalled();
    expect(mocks.awardOpenD6).not.toHaveBeenCalled();
    expect(hero.update).not.toHaveBeenCalled();
  });
});
