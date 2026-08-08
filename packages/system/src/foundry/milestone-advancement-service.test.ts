import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ pips: false }));

vi.mock("../settings/advancement", () => ({
  currentAdvancementCostMultipliers: () => ({
    attribute: 10,
    skill: 1,
    specialization: 0.5,
  }),
  currentAdvancementRuntimeStrategy: () => ({
    family: "milestone",
    id: "d6e2.advancement.milestone",
    progression: "milestone-pools",
    specialization: "unsupported",
  }),
}));

vi.mock("../settings/campaign-profile", () => ({
  currentSecondEditionCampaignProfile: () => ({
    skillSpecializationAdvancedSkills: true,
  }),
}));

vi.mock("../settings/pip-rules", () => ({
  currentCombinedPipScore: (...scores: number[]) =>
    scores.reduce((total, score) => total + score, 0),
  currentEffectivePipScore: (score: number) => score,
  currentPipsEnabled: () => state.pips,
}));

import {
  advanceAttribute,
  advanceItem,
  attributeAdvancementPlan,
  itemAdvancementPlan,
} from "./advancement-service";

function actorFixture() {
  const skill = {
    id: "shooting",
    name: "Shooting",
    system: {
      attributeId: "agility",
      key: "shooting",
      score: 3,
      training: "standard",
    },
    type: "skill",
    update: vi.fn((changes: Record<string, unknown>) => {
      const score = changes["system.score"];
      if (typeof score === "number") skill.system.score = score;
      return Promise.resolve();
    }),
  };
  const actor = {
    id: "actor-1",
    isOwner: true,
    items: {
      contents: [skill],
      get: (id: string) => (id === skill.id ? skill : undefined),
    },
    name: "Test Character",
    system: {
      advancement: {
        milestone: { attributeDice: 1, skillPips: 9 },
        narrativeArcs: [],
      },
      attributes: { agility: { score: 9 } },
      resources: {
        characterPoints: { value: 0 },
        experiencePoints: { value: 0 },
      },
      sheetMode: { value: "advance" },
    },
    update: vi.fn((changes: Record<string, unknown>) => {
      if (!Object.isExtensible(changes)) {
        return Promise.reject(new Error("Foundry update payload is frozen"));
      }
      const milestone = changes["system.advancement.milestone"];
      if (milestone && typeof milestone === "object") {
        actor.system.advancement.milestone = milestone as {
          attributeDice: number;
          skillPips: number;
        };
      }
      const attributeDice =
        changes["system.advancement.milestone.attributeDice"];
      if (typeof attributeDice === "number") {
        actor.system.advancement.milestone.attributeDice = attributeDice;
      }
      const skillPips = changes["system.advancement.milestone.skillPips"];
      if (typeof skillPips === "number") {
        actor.system.advancement.milestone.skillPips = skillPips;
      }
      const agility = changes["system.attributes.agility.score"];
      if (typeof agility === "number")
        actor.system.attributes.agility.score = agility;
      return Promise.resolve();
    }),
  };
  return { actor, skill };
}

describe("Milestone score advancement", () => {
  beforeEach(() => {
    state.pips = false;
    vi.stubGlobal("game", { user: { isGM: false } });
  });

  it("spends separate Attribute and Skill reward balances", async () => {
    const { actor, skill } = actorFixture();
    expect(
      attributeAdvancementPlan(
        actor as unknown as FoundryActorDocument,
        "agility",
      ),
    ).toMatchObject({
      affordable: true,
      cost: 1,
      resource: "milestone-attribute-dice",
      strategy: "second-edition-milestone",
    });
    await advanceAttribute(actor, "agility");
    expect(actor.system.attributes.agility.score).toBe(12);
    expect(actor.system.advancement.milestone.attributeDice).toBe(0);
    expect(actor.system.advancement.milestone.skillPips).toBe(9);

    expect(
      itemAdvancementPlan(
        actor as unknown as FoundryActorDocument,
        skill as unknown as FoundryItemDocument,
      ),
    ).toMatchObject({
      affordable: true,
      cost: 3,
      resource: "milestone-skill-pips",
    });
    await advanceItem(actor, skill.id);
    expect(skill.system.score).toBe(6);
    expect(actor.system.advancement.milestone.skillPips).toBe(6);
  });

  it("spends and raises a single Skill pip when Pips are active", async () => {
    state.pips = true;
    const { actor, skill } = actorFixture();
    await advanceItem(actor, skill.id);
    expect(skill.system.score).toBe(4);
    expect(actor.system.advancement.milestone.skillPips).toBe(8);
  });
});
