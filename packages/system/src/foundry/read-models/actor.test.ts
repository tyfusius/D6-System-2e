import { beforeEach, describe, expect, it, vi } from "vitest";
import { actorReadModel } from "./actor";

describe("public Actor read model", () => {
  beforeEach(() => {
    vi.stubGlobal("game", {
      actors: {
        get: (id: string) => (id === "gunner-1" ? { id } : undefined),
      },
      i18n: { localize: (key: string) => key },
      settings: { get: () => false },
    });
  });

  it("projects core Second Edition scores as whole dice", () => {
    const actor = {
      id: "actor-1",
      img: "actor.webp",
      isOwner: true,
      items: {
        contents: [
          {
            id: "skill-1",
            name: "Climbing",
            system: { attributeId: "agility", score: 6 },
            type: "skill",
          },
          {
            id: "perk-1",
            img: "perk.webp",
            name: "Focused Perk",
            system: { cost: 0, focus: "Piloting", rank: 2 },
            type: "perk",
          },
          {
            id: "trouble-1",
            img: "trouble.webp",
            name: "Recurring Trouble",
            system: { trigger: "When the past catches up" },
            type: "trouble",
          },
          {
            id: "weapon-1",
            img: "weapon.webp",
            name: "Service Pistol",
            system: { damage: 12, equipped: true },
            type: "weapon",
          },
        ],
      },
      name: "Test Character",
      system: {
        attributes: {
          agility: { score: 10 },
          brawn: { score: 3 },
          knowledge: { score: 3 },
          perception: { score: 3 },
        },
        resources: {
          characterPoints: { value: 5 },
          fatePoints: { value: 1 },
          heroPoints: { value: 2 },
        },
      },
      type: "character",
    };
    const model = actorReadModel(actor);
    expect(model.advancement).toEqual({
      awards: "unsupported",
      family: "unavailable",
      progression: "unavailable",
      strategyId: "d6e2.advancement.unselected",
    });
    expect(model.attributeRuntime).toEqual({
      family: "second-edition",
      strategyId: "d6e2.attributes.campaign-profile",
      visibility: "active-setting-profile",
    });
    expect(model.scoreModel).toEqual({
      effectiveScore: "whole-die-component",
      progressionStepScore: 3,
      strategyId: "d6e2.pips.whole-dice",
    });
    expect(model.rollOutcome).toEqual({
      metaCurrencyStrategyId: "d6e2.meta-currency.heroic-hero-points",
      retryStrategyId: "d6e2.retries.doubling-down",
      successStrategyId: "d6e2.success.strictly-greater",
      wildDieStrategyId: "d6e2.wild-die.advantage-complication",
    });
    expect(model.attributes[0]).toMatchObject({
      code: { dice: 3, pips: 0 },
      id: "agility",
      score: 9,
    });
    expect(model.skills[0]).toMatchObject({
      attributeId: "agility",
      bonusScore: 6,
      code: { dice: 5, pips: 0 },
      score: 15,
    });
    expect(model.resources.heroPoints).toBe(2);
    expect(model.health.firstEditionStuns).toMatchObject({
      total: 0,
      penaltyDice: 0,
      roundsRemaining: 0,
    });
    expect(model.health.firstEditionStunsActive).toBe(false);
    expect(model.health.active).toMatchObject({
      contractVersion: 2,
      kind: "track",
      modelId: "d6e2.health.condition-track",
      modelLabel: "D6E2.Settings.HealthModel.SecondEdition.Label",
      track: { currentStateId: "healthy" },
    });
    expect("damageTransitions" in model.health.active).toBe(false);
    expect(model.items).toEqual([
      {
        damageCode: { dice: 4, pips: 0 },
        equipped: true,
        id: "weapon-1",
        image: "weapon.webp",
        invocation: "ordinary",
        modes: ["attack", "damage"],
        name: "Service Pistol",
        type: "weapon",
      },
    ]);
    expect(model.features).toEqual([
      {
        catalogId: "",
        capabilityState: "inactive-preserved",
        cost: 0,
        creationSkillCostScore: 6,
        definitionId: "",
        focus: "Piloting",
        id: "perk-1",
        image: "perk.webp",
        mechanics: [],
        name: "Focused Perk",
        ownerId: "",
        rank: 2,
        repeatable: false,
        sessionMaximum: 0,
        sessionUses: 0,
        trigger: "",
        type: "perk",
      },
      {
        catalogId: "",
        capabilityState: "inactive-preserved",
        cost: 0,
        creationSkillCostScore: 0,
        definitionId: "",
        focus: "",
        id: "trouble-1",
        image: "trouble.webp",
        mechanics: [],
        name: "Recurring Trouble",
        ownerId: "",
        rank: 0,
        repeatable: false,
        sessionMaximum: 0,
        sessionUses: 0,
        trigger: "When the past catches up",
        type: "trouble",
      },
    ]);
    expect(Object.isFrozen(model)).toBe(true);
    expect("system" in model).toBe(false);
  });

  it("projects vehicle systems and derived rules without character attributes", () => {
    const actor = {
      id: "vehicle-1",
      img: "vehicle.webp",
      isOwner: true,
      items: {
        contents: [
          {
            id: "weapon-1",
            img: "cannon.webp",
            name: "Mounted Cannon",
            system: { damage: 15, equipped: true },
            type: "vehicle-weapon",
          },
        ],
      },
      name: "Test Vehicle",
      system: {
        armor: { score: 3 },
        attributes: {
          hull: { score: 9 },
          maneuverability: { score: 12 },
        },
        crew: { members: [{ actorId: "gunner-1", name: "Gunner" }] },
        health: { condition: "wounded" },
        passengers: 4,
      },
      type: "vehicle",
    };
    const model = actorReadModel(actor);
    expect(model.attributes.map(({ id }) => id)).toEqual([
      "maneuverability",
      "hull",
    ]);
    expect(model.machine).toEqual({
      capacity: { kind: "passengers", value: 4 },
      condition: "wounded",
      crew: { assigned: 1, missing: 0 },
      defense: 15,
      kind: "vehicle",
      protectionScore: 3,
      resistanceScore: 12,
    });
    expect(model.skills).toEqual([]);
    expect(model.features).toEqual([]);
    expect(model.items).toEqual([
      {
        damageCode: { dice: 5, pips: 0 },
        equipped: true,
        id: "weapon-1",
        image: "cannon.webp",
        invocation: "ordinary",
        modes: ["attack", "damage"],
        name: "Mounted Cannon",
        type: "vehicle-weapon",
      },
    ]);
  });
});
