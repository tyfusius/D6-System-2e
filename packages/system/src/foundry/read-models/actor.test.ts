import { beforeEach, describe, expect, it, vi } from "vitest";
import { actorReadModel } from "./actor";

describe("public Actor read model", () => {
  beforeEach(() => {
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: { get: () => false },
    });
  });

  it("projects stable IDs and derived skill scores without document references", () => {
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
      code: { dice: 3, pips: 1 },
      id: "agility",
      score: 10,
    });
    expect(model.skills[0]).toMatchObject({
      attributeId: "agility",
      bonusScore: 6,
      code: { dice: 5, pips: 1 },
      score: 16,
    });
    expect(model.resources.heroPoints).toBe(2);
    expect(Object.isFrozen(model)).toBe(true);
    expect("system" in model).toBe(false);
  });
});
