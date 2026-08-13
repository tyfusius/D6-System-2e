import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { D6_ROLL_CONTRACT_VERSION, resolveD6Roll } from "@d6-system-2e/core";
import {
  awardOpenD6RollResources,
  clearExpiredOpenD6FatePointEffects,
  OPEN_D6_FATE_POINT_EFFECT_FLAG,
  openD6CharacterPointSpendLimit,
  openD6FatePointActive,
  transactOpenD6RollResources,
  validateOpenD6RollResourceRequest,
} from "./open-d6-roll-resource-service";
import { SYSTEM_ID } from "../constants";

vi.mock("../settings/roll-outcome", () => ({
  currentMetaCurrencyRuntimeStrategy: () => ({
    id: "open-d6.meta-currency.character-and-fate-points",
  }),
}));
vi.mock("../settings/attributes", () => ({
  currentAttributeRole: () => "perception",
}));

const combatState = vi.hoisted(() => ({ round: 3 }));
vi.mock("./combat-service", () => ({
  readCombatantRound: () => ({
    combatantId: "combatant-1",
    round: combatState.round,
  }),
}));

afterEach(() => vi.unstubAllGlobals());

function actor(characterPoints = 4, fatePoints = 2) {
  const flags = new Map<string, unknown>();
  const document = {
    getFlag: (_namespace: string, key: string) => flags.get(key),
    id: "actor-1",
    items: new Map<string, { type: string }>(),
    system: {
      resources: {
        characterPoints: { value: characterPoints },
        fatePoints: { value: fatePoints },
      },
    },
    update: vi.fn((changes: Record<string, unknown>) => {
      for (const key of ["characterPoints", "fatePoints"] as const) {
        const value = changes[`system.resources.${key}.value`];
        if (typeof value === "number") {
          document.system.resources[key].value = value;
        }
      }
      const effect =
        changes[`flags.${SYSTEM_ID}.${OPEN_D6_FATE_POINT_EFFECT_FLAG}`];
      if (effect !== undefined)
        flags.set(OPEN_D6_FATE_POINT_EFFECT_FLAG, effect);
      if (
        Object.hasOwn(
          changes,
          `flags.${SYSTEM_ID}.-=${OPEN_D6_FATE_POINT_EFFECT_FLAG}`,
        )
      ) {
        flags.delete(OPEN_D6_FATE_POINT_EFFECT_FLAG);
      }
      return Promise.resolve(document);
    }),
  };
  return document;
}

function result(characterPointSpend: number, fatePoint: "none" | "spend") {
  return resolveD6Roll({
    baseFaces: Array.from({ length: fatePoint === "spend" ? 5 : 2 }, () => 2),
    characterPointFaceGroups: Array.from(
      { length: characterPointSpend },
      () => [3],
    ),
    profileId: "open-d6",
    request: {
      contractVersion: D6_ROLL_CONTRACT_VERSION,
      heroPointUse: "none",
      kind: "skill",
      label: "Blaster",
      openD6Resources: { characterPointSpend, fatePoint },
      resultModifier: 0,
      rollMode: "publicroll",
      score: 10,
      source: {
        actorId: "actor-1",
        actorName: "Test Character",
        attributeId: "dexterity",
      },
    },
    successEvaluator: "first-edition-meets",
    wildFaces: [4],
    wildPolicy: "first-edition",
  });
}

describe("Open D6 roll resource transactions", () => {
  let hero: ReturnType<typeof actor>;

  beforeEach(() => {
    hero = actor();
    combatState.round = 3;
    vi.stubGlobal("game", {
      user: { isGM: true },
    });
  });

  it("uses the legacy 2-point ordinary and 5-point defensive limits", () => {
    expect(openD6CharacterPointSpendLimit(hero, "skill")).toBe(2);
    expect(openD6CharacterPointSpendLimit(hero, "resistance")).toBe(5);
    expect(
      openD6CharacterPointSpendLimit(
        hero,
        "attribute",
        undefined,
        undefined,
        "perception",
      ),
    ).toBe(5);
    expect(
      openD6CharacterPointSpendLimit(hero, "skill", {
        firstEditionActiveDefense: {
          kind: "dodge",
          mode: "partial",
          resultModifier: 0,
          sourcePage: 73,
        },
      }),
    ).toBe(5);
  });

  it("atomically spends both resources and activates Fate for the round", async () => {
    await transactOpenD6RollResources(hero, result(2, "spend"));
    expect(hero.system.resources.characterPoints.value).toBe(2);
    expect(hero.system.resources.fatePoints.value).toBe(1);
    expect(openD6FatePointActive(hero)).toBe(true);
    expect(hero.update).toHaveBeenCalledOnce();
  });

  it("atomically awards Character and Fate Points", async () => {
    await expect(awardOpenD6RollResources(hero, 3, 1)).resolves.toMatchObject({
      characterPoints: 7,
      fatePoints: 3,
    });
    expect(hero.system.resources.characterPoints.value).toBe(7);
    expect(hero.system.resources.fatePoints.value).toBe(3);
    expect(hero.update).toHaveBeenCalledOnce();
  });

  it("rejects a spend above the contextual limit without changing balances", async () => {
    await expect(
      transactOpenD6RollResources(hero, result(3, "none")),
    ).rejects.toThrow("D6E2.Roll.OpenD6Resource.CharacterPointLimit");
    expect(hero.system.resources.characterPoints.value).toBe(4);
  });

  it("rejects a request that merely claims an inactive Fate effect", () => {
    const forged = result(0, "none").request;
    expect(() =>
      validateOpenD6RollResourceRequest(hero, {
        ...forged,
        openD6Resources: {
          characterPointSpend: 0,
          fatePoint: "active",
        },
      }),
    ).toThrow("D6E2.Roll.OpenD6Resource.FatePointInactive");
  });

  it("clears the Fate effect after its combat round", async () => {
    await transactOpenD6RollResources(hero, result(0, "spend"));
    combatState.round = 4;
    await expect(
      clearExpiredOpenD6FatePointEffects([
        hero as unknown as FoundryActorDocument,
      ]),
    ).resolves.toBe(1);
    expect(openD6FatePointActive(hero)).toBe(false);
  });
});
