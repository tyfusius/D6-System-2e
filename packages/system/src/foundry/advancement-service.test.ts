import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../settings/edition-capabilities", () => ({
  currentEditionCapabilityProfile: () => ({
    advancement: {
      state: "active",
      strategy: "second-edition-experience-points",
    },
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
  currentPipsEnabled: () => false,
}));

import {
  acquireSpecialization,
  specializationAcquisitionPlan,
} from "./advancement-service";

function actorFixture(options: { createFails?: boolean } = {}) {
  const parent = {
    id: "skill-1",
    name: "Shooting",
    system: {
      attributeId: "agility",
      key: "shooting",
      score: 6,
      training: "standard",
    },
    type: "skill",
  };
  const existing = {
    id: "specialization-1",
    name: "Pistols",
    system: {
      parentSkillId: parent.id,
      parentSkillKey: parent.system.key,
      score: 3,
    },
    type: "specialization",
  };
  const contents = [parent, existing];
  const actor = {
    createEmbeddedDocuments: vi.fn(
      (_type: string, sources: Record<string, unknown>[]) => {
        if (options.createFails) {
          return Promise.reject(new Error("creation failed"));
        }
        const created = {
          ...(sources[0] ?? {}),
          id: "specialization-2",
        };
        contents.push(created as typeof existing);
        return Promise.resolve([created]);
      },
    ),
    id: "actor-1",
    isOwner: true,
    items: {
      contents,
      get: (id: string) => contents.find((item) => item.id === id),
    },
    name: "Test Character",
    system: {
      attributes: { agility: { score: 9 } },
      resources: {
        characterPoints: { value: 5 },
        experiencePoints: { value: 5 },
      },
      sheetMode: { value: "advance" },
    },
    update: vi.fn((changes: Record<string, unknown>) => {
      const points = changes["system.resources.experiencePoints.value"];
      if (typeof points === "number") {
        actor.system.resources.experiencePoints.value = points;
      }
      return Promise.resolve();
    }),
  };
  return { actor, contents, parent };
}

describe("Second Edition specialization acquisition service", () => {
  beforeEach(() => {
    vi.stubGlobal("game", {
      user: { isGM: false },
    });
  });

  it("deducts XP and creates a fixed +1D linked specialization", async () => {
    const { actor, contents, parent } = actorFixture();
    expect(
      specializationAcquisitionPlan(
        actor as unknown as FoundryActorDocument,
        parent as unknown as FoundryItemDocument,
      ),
    ).toMatchObject({
      affordable: true,
      atLimit: false,
      cost: 3,
      currentSpecializations: 1,
      maximumSpecializations: 2,
    });

    const result = await acquireSpecialization(actor, parent.id, "Rifles");

    expect(result).toMatchObject({
      cost: 3,
      kind: "specialization",
      remaining: 2,
      resource: "experience-points",
      score: 3,
    });
    expect(actor.system.resources.experiencePoints.value).toBe(2);
    expect(contents.at(-1)).toMatchObject({
      name: "Rifles",
      system: {
        parentSkillId: parent.id,
        parentSkillKey: "shooting",
        score: 3,
        source: { page: 99 },
      },
      type: "specialization",
    });
  });

  it("restores XP if embedded Item creation fails", async () => {
    const { actor, parent } = actorFixture({ createFails: true });
    await expect(
      acquireSpecialization(actor, parent.id, "Rifles"),
    ).rejects.toThrow("creation failed");
    expect(actor.system.resources.experiencePoints.value).toBe(5);
  });

  it("rejects duplicate names and the per-Skill rating limit", async () => {
    const { actor, parent } = actorFixture();
    await expect(
      acquireSpecialization(actor, parent.id, "pistols"),
    ).rejects.toThrow("D6E2.Advancement.SpecializationExists");

    parent.system.score = 3;
    await expect(
      acquireSpecialization(actor, parent.id, "Rifles"),
    ).rejects.toThrow("D6E2.Advancement.SpecializationLimit");
  });
});
