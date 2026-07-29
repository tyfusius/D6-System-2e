import { describe, expect, it, vi } from "vitest";

vi.mock("../settings/campaign-profile", () => ({
  campaignOptionalAttributeIds: () => [],
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
  createCreationAdvancedSkill,
  createCreationSpecialization,
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
  };
  const contents: EmbeddedSource[] = [parent];
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
    system: { creation: { active: true } },
    type: "character",
  };
  return { actor, contents, parent };
}

describe("Second Edition creation Skill module services", () => {
  it("creates a named, linked Specialization with a distinct stable key", async () => {
    const { actor, contents, parent } = actorFixture();

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

  it("requires and preserves the actual Advanced Skill name", async () => {
    const { actor, contents } = actorFixture();

    await createCreationAdvancedSkill(
      actor as unknown as FoundryActorDocument,
      " Nuclear Engineering ",
    );

    expect(contents.at(-1)).toMatchObject({
      name: "Nuclear Engineering",
      system: {
        key: "advanced-nuclear-engineering",
        prerequisiteSkillKeys: [],
        score: 0,
        training: "advanced",
      },
      type: "skill",
    });
    await expect(
      createCreationAdvancedSkill(
        actor as unknown as FoundryActorDocument,
        "nuclear engineering",
      ),
    ).rejects.toThrow("D6E2.Creation.AdvancedSkillExists");
  });
});
