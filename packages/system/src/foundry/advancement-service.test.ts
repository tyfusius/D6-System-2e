import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  family: "experience-points",
  progression: "direct-spend",
  specialization: "experience-acquisition-only",
}));
const settingsGet = vi.hoisted(() => vi.fn(() => 0));

vi.mock("../settings/advancement", () => ({
  currentAdvancementCostMultipliers: () => ({
    attribute: 10,
    skill: 1,
    specialization: 0.5,
  }),
  currentAdvancementRuntimeStrategy: () => runtime,
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
  advanceAttribute,
  advanceItem,
  itemAdvancementPlan,
  specializationAcquisitionPlan,
} from "./advancement-service";
import { configuredSpecializationsPerSkillLimit } from "../settings/specialization-rules";

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
        heroPoints: { value: 20 },
      },
      sheetMode: { value: "advance" },
    },
    update: vi.fn((changes: Record<string, unknown>) => {
      const characterPoints = changes["system.resources.characterPoints.value"];
      if (typeof characterPoints === "number") {
        actor.system.resources.characterPoints.value = characterPoints;
      }
      const points = changes["system.resources.experiencePoints.value"];
      if (typeof points === "number") {
        actor.system.resources.experiencePoints.value = points;
      }
      const heroPoints = changes["system.resources.heroPoints.value"];
      if (typeof heroPoints === "number") {
        actor.system.resources.heroPoints.value = heroPoints;
      }
      return Promise.resolve();
    }),
  };
  return { actor, contents, parent };
}

describe("Second Edition specialization acquisition service", () => {
  beforeEach(() => {
    runtime.family = "experience-points";
    runtime.progression = "direct-spend";
    runtime.specialization = "experience-acquisition-only";
    settingsGet.mockReturnValue(0);
    vi.stubGlobal("game", {
      settings: { get: settingsGet },
      user: { isGM: false },
    });
  });

  it("plans Open D6 Character Point steps from the selected runtime strategy", () => {
    runtime.family = "character-points";
    runtime.specialization = "direct-spend";
    const { actor, parent } = actorFixture();

    expect(
      itemAdvancementPlan(
        actor as unknown as FoundryActorDocument,
        parent as unknown as FoundryItemDocument,
      ),
    ).toMatchObject({
      active: true,
      affordable: true,
      cost: 5,
      nextResource: 0,
      nextScore: 16,
      resource: "character-points",
      strategy: "open-d6-character-points",
    });
  });

  it("uses Skill Points for D6MV skills and Hero Points for Attributes", async () => {
    runtime.family = "d6mv";
    runtime.specialization = "unavailable";
    const { actor, parent } = actorFixture();

    expect(
      itemAdvancementPlan(
        actor as unknown as FoundryActorDocument,
        parent as unknown as FoundryItemDocument,
      ),
    ).toMatchObject({
      cost: 2,
      nextResource: 3,
      nextScore: 16,
      resource: "experience-points",
      strategy: "d6mv-split-resources",
    });
    await expect(
      advanceAttribute(actor as unknown as FoundryActorDocument, "agility"),
    ).resolves.toMatchObject({
      cost: 18,
      remaining: 2,
      resource: "hero-points",
      strategy: "d6mv-split-resources",
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

  it("uses Character Points when that is the configured advancement strategy", async () => {
    runtime.family = "character-points";
    runtime.specialization = "direct-spend";
    const { actor, parent } = actorFixture();

    const plan = specializationAcquisitionPlan(
      actor as unknown as FoundryActorDocument,
      parent as unknown as FoundryItemDocument,
    );
    expect(plan).toMatchObject({
      affordable: true,
      cost: 3,
      currentResource: 5,
      nextResource: 2,
      resource: "character-points",
    });

    const result = await acquireSpecialization(actor, parent.id, "Rifles");

    expect(result).toMatchObject({
      remaining: 2,
      remainingCharacterPoints: 2,
      resource: "character-points",
      strategy: "open-d6-character-points",
    });
    expect(actor.system.resources.characterPoints.value).toBe(2);
    expect(actor.system.resources.experiencePoints.value).toBe(5);
  });

  it("restores XP if embedded Item creation fails", async () => {
    const { actor, parent } = actorFixture({ createFails: true });
    await expect(
      acquireSpecialization(actor, parent.id, "Rifles"),
    ).rejects.toThrow("creation failed");
    expect(actor.system.resources.experiencePoints.value).toBe(5);
  });

  it("restores Character Points if embedded Item creation fails", async () => {
    runtime.family = "character-points";
    runtime.specialization = "direct-spend";
    const { actor, parent } = actorFixture({ createFails: true });
    await expect(
      acquireSpecialization(actor, parent.id, "Rifles"),
    ).rejects.toThrow("creation failed");
    expect(actor.system.resources.characterPoints.value).toBe(5);
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

  it("uses the configured fixed per-Skill limit for planning and acquisition", async () => {
    settingsGet.mockReturnValue(1);
    expect(configuredSpecializationsPerSkillLimit()).toBe(1);
    const { actor, parent } = actorFixture();
    expect(
      specializationAcquisitionPlan(
        actor as unknown as FoundryActorDocument,
        parent as unknown as FoundryItemDocument,
      ),
    ).toMatchObject({ atLimit: true, maximumSpecializations: 1 });
    await expect(
      acquireSpecialization(actor, parent.id, "Rifles"),
    ).rejects.toThrow("D6E2.Advancement.SpecializationLimit");
  });
});

function advancedActorFixture({
  experiencePoints = 20,
  prerequisiteScore = 9,
  surgeryScore = 3,
}: {
  readonly experiencePoints?: number;
  readonly prerequisiteScore?: number;
  readonly surgeryScore?: number;
} = {}) {
  const medicine = {
    id: "medicine",
    name: "Medicine",
    system: {
      attributeId: "knowledge",
      key: "medicine",
      score: prerequisiteScore,
      training: "standard",
    },
    type: "skill",
  };
  const sciences = {
    id: "sciences",
    name: "Sciences",
    system: {
      attributeId: "knowledge",
      key: "sciences",
      score: prerequisiteScore,
      training: "standard",
    },
    type: "skill",
  };
  const surgery = {
    id: "surgery",
    name: "Surgery",
    system: {
      attributeId: "knowledge",
      key: "surgery",
      prerequisiteSkillKeys: ["medicine", "sciences"],
      score: surgeryScore,
      training: "advanced",
    },
    type: "skill",
    update: vi.fn((changes: Record<string, unknown>) => {
      const score = changes["system.score"];
      if (typeof score === "number") surgery.system.score = score;
      return Promise.resolve();
    }),
  };
  const contents = [medicine, sciences, surgery];
  const actor = {
    id: "actor-advanced",
    isOwner: true,
    items: {
      contents,
      get: (id: string) => contents.find((item) => item.id === id),
    },
    name: "Advanced Test",
    system: {
      attributes: { knowledge: { score: 15 } },
      resources: {
        characterPoints: { value: 0 },
        experiencePoints: { value: experiencePoints },
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
  return { actor, medicine, sciences, surgery };
}

describe("Second Edition Advanced Skill advancement", () => {
  beforeEach(() => {
    vi.stubGlobal("game", {
      user: { isGM: false },
    });
  });

  it("uses prerequisite Skill ratings without adding their Attributes", () => {
    const { actor, surgery } = advancedActorFixture({
      prerequisiteScore: 3,
      surgeryScore: 0,
    });

    expect(
      itemAdvancementPlan(
        actor as unknown as FoundryActorDocument,
        surgery as unknown as FoundryItemDocument,
      ),
    ).toMatchObject({
      affordable: false,
      blockedReason: "advanced-skill-prerequisite",
      cost: 2,
      nextScore: 3,
    });
  });

  it("spends twice the regular Skill cost and advances one whole die", async () => {
    const { actor, surgery } = advancedActorFixture();

    expect(
      itemAdvancementPlan(
        actor as unknown as FoundryActorDocument,
        surgery as unknown as FoundryItemDocument,
      ),
    ).toMatchObject({
      affordable: true,
      cost: 2,
      currentResource: 20,
      nextResource: 18,
      nextScore: 6,
    });

    await expect(advanceItem(actor, surgery.id)).resolves.toMatchObject({
      cost: 2,
      remaining: 18,
      resource: "experience-points",
      score: 6,
    });
    expect(actor.system.resources.experiencePoints.value).toBe(18);
    expect(surgery.system.score).toBe(6);
  });

  it("rejects the prerequisite cap before spending XP or changing the rating", async () => {
    const { actor, surgery } = advancedActorFixture({
      prerequisiteScore: 6,
      surgeryScore: 6,
    });

    expect(
      itemAdvancementPlan(
        actor as unknown as FoundryActorDocument,
        surgery as unknown as FoundryItemDocument,
      ),
    ).toMatchObject({
      affordable: false,
      blockedReason: "advanced-skill-prerequisite",
      cost: 4,
      currentResource: 20,
      nextScore: 9,
    });

    await expect(advanceItem(actor, surgery.id)).rejects.toThrow(
      "D6E2.Advancement.AdvancedSkillPrerequisite",
    );
    expect(actor.system.resources.experiencePoints.value).toBe(20);
    expect(surgery.system.score).toBe(6);
    expect(actor.update).not.toHaveBeenCalled();
    expect(surgery.update).not.toHaveBeenCalled();
  });
});

describe("owning-player direct advancement authority", () => {
  beforeEach(() => {
    runtime.family = "experience-points";
    runtime.progression = "direct-spend";
    runtime.specialization = "experience-acquisition-only";
    vi.stubGlobal("game", {
      user: { isGM: false },
    });
  });

  it("lets an owning player spend Experience Points in Advance mode", async () => {
    const { actor } = advancedActorFixture({ experiencePoints: 40 });
    actor.system.attributes.knowledge.score = 9;

    await expect(
      advanceAttribute(actor as unknown as FoundryActorDocument, "knowledge"),
    ).resolves.toMatchObject({
      cost: 30,
      remaining: 10,
      resource: "experience-points",
      score: 12,
    });
    expect(actor.system.resources.experiencePoints.value).toBe(10);
    expect(actor.update).toHaveBeenCalledWith({
      "system.attributes.knowledge.score": 12,
      "system.resources.experiencePoints.value": 10,
    });
  });

  it("rejects a non-owner and an owner outside Advance mode", async () => {
    const { actor } = advancedActorFixture({ experiencePoints: 20 });
    actor.isOwner = false;
    await expect(
      advanceAttribute(actor as unknown as FoundryActorDocument, "knowledge"),
    ).rejects.toThrow("D6E2.Advancement.OwnerRequired");

    actor.isOwner = true;
    actor.system.sheetMode.value = "normal";
    await expect(
      advanceAttribute(actor as unknown as FoundryActorDocument, "knowledge"),
    ).rejects.toThrow("D6E2.Advancement.AdvanceModeRequired");
    expect(actor.update).not.toHaveBeenCalled();
  });
});
