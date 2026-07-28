import { beforeEach, describe, expect, it, vi } from "vitest";
import { actorReadModel } from "./actor";

describe("public Actor read model", () => {
  beforeEach(() => {
    vi.stubGlobal("game", {
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
    expect(Object.isFrozen(model)).toBe(true);
    expect("system" in model).toBe(false);
  });

  it("projects vehicle systems and derived rules without character attributes", () => {
    const actor = {
      id: "vehicle-1",
      img: "vehicle.webp",
      isOwner: true,
      items: { contents: [] },
      name: "Test Vehicle",
      system: {
        armor: { score: 3 },
        attributes: {
          hull: { score: 9 },
          maneuverability: { score: 12 },
        },
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
      defense: 15,
      kind: "vehicle",
      protectionScore: 3,
      resistanceScore: 12,
    });
    expect(model.skills).toEqual([]);
  });
});
