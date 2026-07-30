import { describe, expect, it, vi } from "vitest";

vi.mock("../settings/campaign-profile", () => ({
  campaignOptionalAttributeIds: () => new Set(),
  currentSecondEditionCampaignProfile: () => ({
    additionalSkillModuleCount: 0,
    skillSpecializationAdvancedSkills: true,
  }),
}));

vi.mock("./mechanical-edit-guard", () => ({
  withAuthorizedCreationUpdate: (
    _document: unknown,
    callback: () => Promise<unknown>,
  ) => callback(),
}));

vi.mock("../settings/pip-rules", () => ({
  currentEffectivePipScore: (score: number) => score,
  currentPipsEnabled: () => false,
}));

import {
  adjustCreationSkill,
  createCreationAdvancedSkill,
  createCreationSpecialization,
  setCreationSpecializationAllocation,
} from "./character-creation-service";

interface EmbeddedSource {
  id?: string;
  name?: string;
  system?: Record<string, unknown>;
  type?: string;
  [key: string]: unknown;
}

function actorFixture() {
  const parent = {
    id: "acrobatics-id",
    name: "Acrobatics",
    system: {
      attributeId: "agility",
      key: "acrobatics",
      score: 3,
      training: "standard",
    },
    type: "skill",
    update: vi.fn((changes: Record<string, unknown>) => {
      if (typeof changes["system.score"] === "number") {
        parent.system.score = changes["system.score"];
      }
      return Promise.resolve(parent);
    }),
  };
  const medicine = {
    id: "medicine-id",
    name: "Medicine",
    system: {
      attributeId: "knowledge",
      key: "medicine",
      score: 3,
      training: "standard",
    },
    type: "skill",
  };
  const sciences = {
    id: "sciences-id",
    name: "Sciences",
    system: {
      attributeId: "knowledge",
      key: "sciences",
      score: 3,
      training: "standard",
    },
    type: "skill",
  };
  const contents: EmbeddedSource[] = [parent, medicine, sciences];
  const actor = {
    createEmbeddedDocuments: vi.fn(
      (_type: string, sources: EmbeddedSource[]) => {
        const created = {
          ...sources[0],
          id: `created-${contents.length}`,
        };
        contents.push(created);
        return Promise.resolve([created]);
      },
    ),
    id: "actor-id",
    isOwner: true,
    items: {
      contents,
      get: (id: string) => contents.find((item) => item.id === id),
    },
    name: "Test Character",
    system: {
      attributes: {
        agility: { score: 9 },
        brawn: { score: 9 },
        knowledge: { score: 9 },
        perception: { score: 9 },
      },
      creation: { active: true, specializationSlots: 0 },
    },
    type: "character",
    update: vi.fn((changes: Record<string, unknown>) => {
      if (typeof changes["system.creation.specializationSlots"] === "number") {
        actor.system.creation.specializationSlots =
          changes["system.creation.specializationSlots"];
      }
      return Promise.resolve(actor);
    }),
  };
  return { actor, contents, parent };
}

describe("Second Edition creation Skill module services", () => {
  it("converts one unspent Skill die into three Specialization slots and back", async () => {
    const { actor } = actorFixture();

    await setCreationSpecializationAllocation(
      actor as unknown as FoundryActorDocument,
      true,
    );
    expect(actor.system.creation.specializationSlots).toBe(3);

    await setCreationSpecializationAllocation(
      actor as unknown as FoundryActorDocument,
      false,
    );
    expect(actor.system.creation.specializationSlots).toBe(0);
  });

  it("prohibits Skill overspending and allocation without a free Skill die", async () => {
    const { actor, contents } = actorFixture();
    for (let index = 0; index < 3; index += 1) {
      contents.push({
        id: `spent-${index}`,
        name: `Spent ${index}`,
        system: {
          attributeId: "agility",
          key: `spent-${index}`,
          score: 6,
          training: "standard",
        },
        type: "skill",
      });
    }

    await expect(
      adjustCreationSkill(
        actor as unknown as FoundryActorDocument,
        "acrobatics-id",
        1,
      ),
    ).rejects.toThrow("D6E2.Creation.SkillBudgetExceeded");
    await expect(
      setCreationSpecializationAllocation(
        actor as unknown as FoundryActorDocument,
        true,
      ),
    ).rejects.toThrow("D6E2.Creation.SkillBudgetConversionRequired");
  });

  it("creates a named, linked Specialization with a distinct stable key", async () => {
    const { actor, contents, parent } = actorFixture();

    await setCreationSpecializationAllocation(
      actor as unknown as FoundryActorDocument,
      true,
    );
    await createCreationSpecialization(
      actor as unknown as FoundryActorDocument,
      parent.id,
      " Parkour ",
    );

    expect(contents.at(-1)).toMatchObject({
      name: "Parkour",
      system: {
        key: "specialization-acrobatics-parkour",
        parentSkillId: parent.id,
        parentSkillKey: "acrobatics",
        score: 3,
      },
      type: "specialization",
    });
    await expect(
      createCreationSpecialization(
        actor as unknown as FoundryActorDocument,
        parent.id,
        "parkour",
      ),
    ).rejects.toThrow("D6E2.Creation.SpecializationExists");
  });

  it("requires the Skill-die conversion before creating a Specialization", async () => {
    const { actor, parent } = actorFixture();
    await expect(
      createCreationSpecialization(
        actor as unknown as FoundryActorDocument,
        parent.id,
        "Parkour",
      ),
    ).rejects.toThrow("D6E2.Creation.SpecializationAllocationRequired");
  });

  it("requires and preserves the actual Advanced Skill name", async () => {
    const { actor, contents } = actorFixture();

    await createCreationAdvancedSkill(
      actor as unknown as FoundryActorDocument,
      " Nuclear Engineering ",
      ["medicine", "sciences"],
    );

    expect(contents.at(-1)).toMatchObject({
      name: "Nuclear Engineering",
      system: {
        key: "advanced-nuclear-engineering",
        prerequisiteSkillKeys: ["medicine", "sciences"],
        score: 0,
        training: "advanced",
      },
      type: "skill",
    });
    await expect(
      createCreationAdvancedSkill(
        actor as unknown as FoundryActorDocument,
        "nuclear engineering",
        ["medicine", "sciences"],
      ),
    ).rejects.toThrow("D6E2.Creation.AdvancedSkillExists");
  });

  it("requires at least two valid standard Skill attachments", async () => {
    const { actor } = actorFixture();

    await expect(
      createCreationAdvancedSkill(
        actor as unknown as FoundryActorDocument,
        "Surgery",
        ["medicine"],
      ),
    ).rejects.toThrow("D6E2.Creation.AdvancedSkillPrerequisiteCount");
    await expect(
      createCreationAdvancedSkill(
        actor as unknown as FoundryActorDocument,
        "Surgery",
        ["medicine", "missing-skill"],
      ),
    ).rejects.toThrow("D6E2.Creation.AdvancedSkillPrerequisiteInvalid");
  });
});
