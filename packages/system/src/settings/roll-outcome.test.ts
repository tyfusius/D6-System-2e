import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  currentMetaCurrencyRuntimeStrategy,
  currentRetryRuntimeStrategy,
  currentSuccessRuntimeStrategy,
  currentWildDieRuntimeStrategy,
  metaCurrencyRuntimeStrategy,
  retryRuntimeStrategy,
  successRuntimeStrategy,
  wildDieRuntimeStrategy,
} from "./roll-outcome";

const settings = new Map<string, unknown>();
let advancementFamily = "unavailable";
let strategies = {
  advancement: "d6e2.advancement.configured",
  metaCurrency: "d6e2.meta-currency.hero-points",
  retries: "d6e2.retries.doubling-down",
  successEvaluator: "d6e2.success.strictly-greater",
  wildDie: "d6e2.wild-die.advantage-complication",
};

vi.mock("./rules-profile-library", () => ({
  currentConfiguredRulesProfile: () => ({ strategies }),
}));

vi.mock("./advancement", () => ({
  currentAdvancementRuntimeStrategy: () => ({ family: advancementFamily }),
}));

beforeEach(() => {
  settings.clear();
  advancementFamily = "unavailable";
  strategies = {
    advancement: "d6e2.advancement.configured",
    metaCurrency: "d6e2.meta-currency.hero-points",
    retries: "d6e2.retries.doubling-down",
    successEvaluator: "d6e2.success.strictly-greater",
    wildDie: "d6e2.wild-die.advantage-complication",
  };
  vi.stubGlobal("game", {
    settings: { get: (_namespace: string, key: string) => settings.get(key) },
  });
});

describe("roll outcome runtime strategies", () => {
  it("publishes immutable success, Wild Die, retry, and meta-currency contracts", () => {
    expect(successRuntimeStrategy("open-d6.success.meets-or-exceeds")).toEqual({
      evaluator: "first-edition-meets",
      id: "open-d6.success.meets-or-exceeds",
      threshold: "meets",
    });
    expect(wildDieRuntimeStrategy("d6e2.wild-die.classic")).toMatchObject({
      choiceAuthority: "gm-for-mishap",
      explosion: "every-six",
      policy: "second-edition-classic",
    });
    expect(
      wildDieRuntimeStrategy("open-d6.wild-die.critical-one"),
    ).toMatchObject({
      choiceAuthority: "gm-for-critical-one",
      explosion: "every-six",
      policy: "first-edition",
    });
    expect(retryRuntimeStrategy("open-d6.retries.no-general-reroll")).toEqual({
      followUp: "none",
      id: "open-d6.retries.no-general-reroll",
      sharedClaim: "unavailable",
    });
    expect(
      metaCurrencyRuntimeStrategy(
        "open-d6.meta-currency.character-and-fate-points",
      ),
    ).toMatchObject({
      failedRollReroll: false,
      primaryResource: "characterPoints",
      secondaryResource: "fatePoints",
    });
    expect(Object.isFrozen(currentWildDieRuntimeStrategy())).toBe(true);
  });

  it("fails unknown contributed IDs closed to the native Second Edition baseline", () => {
    strategies = {
      ...strategies,
      metaCurrency: "community.meta.unknown",
      retries: "community.retries.unknown",
      successEvaluator: "community.success.unknown",
      wildDie: "community.wild.unknown",
    };
    expect(currentSuccessRuntimeStrategy().id).toBe(
      "d6e2.success.strictly-greater",
    );
    expect(currentWildDieRuntimeStrategy().id).toBe(
      "d6e2.wild-die.advantage-complication",
    );
    expect(currentRetryRuntimeStrategy().id).toBe("d6e2.retries.doubling-down");
    expect(currentMetaCurrencyRuntimeStrategy().id).toBe(
      "d6e2.meta-currency.heroic-hero-points",
    );
  });

  it("refines Second Edition Wild Die and Hero Point selections at their boundaries", () => {
    settings.set("secondEditionWildDieStrategy", "basic");
    settings.set("secondEditionHeroPointStrategy", "basic");
    expect(currentWildDieRuntimeStrategy().id).toBe("d6e2.wild-die.basic");
    expect(currentMetaCurrencyRuntimeStrategy()).toMatchObject({
      id: "d6e2.meta-currency.basic-hero-points",
      rollSpend: "bonus-ordinary-dice",
    });
  });

  it("enforces the Classic Hero Point dependency contract", () => {
    settings.set("secondEditionHeroPointStrategy", "classic");
    settings.set("secondEditionWildDieStrategy", "classic");
    expect(currentMetaCurrencyRuntimeStrategy().id).toBe(
      "d6e2.meta-currency.heroic-hero-points",
    );
    advancementFamily = "experience-points";
    expect(currentMetaCurrencyRuntimeStrategy()).toMatchObject({
      id: "d6e2.meta-currency.classic-hero-points",
      primaryResource: "experiencePoints",
      rollSpend: "bonus-wild-dice",
    });
  });

  it("composes imported Open D6 strategies independently", () => {
    strategies = {
      ...strategies,
      metaCurrency: "open-d6.meta-currency.character-and-fate-points",
      retries: "open-d6.retries.no-general-reroll",
      successEvaluator: "open-d6.success.meets-or-exceeds",
      wildDie: "open-d6.wild-die.critical-one",
    };
    expect(currentSuccessRuntimeStrategy().threshold).toBe("meets");
    expect(currentWildDieRuntimeStrategy().policy).toBe("first-edition");
    expect(currentRetryRuntimeStrategy().followUp).toBe("none");
    expect(currentMetaCurrencyRuntimeStrategy()).toMatchObject({
      automaticRollTransactions: "open-d6",
      heroPointStrategy: null,
      primaryResource: "characterPoints",
      rollSpend: "character-and-fate-points",
    });
  });
});
