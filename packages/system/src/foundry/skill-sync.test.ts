import { beforeEach, describe, expect, it, vi } from "vitest";

const profile = vi.hoisted(() => ({
  strategies: {
    actionEconomy: "open-d6.action-economy.flexible",
    activeDefenses: "open-d6.defenses.active",
    advancement: "open-d6.advancement.character-points",
    attributes: "d6e2.attributes.campaign-profile",
    health: "open-d6.health.wounds-or-body-points",
    initiative: "open-d6.initiative.perception",
    movement: "open-d6.movement.relative",
    metaCurrency: "open-d6.meta-currency.character-and-fate-points",
    pips: "open-d6.pips.classic",
    retries: "open-d6.retries.no-general-reroll",
    scale: "open-d6.scale.scalar",
    successEvaluator: "open-d6.success.meets-or-exceeds",
    wildDie: "open-d6.wild-die.critical-one",
  },
}));

vi.mock("../settings/rules-profile-library", () => ({
  currentConfiguredRulesProfile: () => profile,
}));
vi.mock("../settings/campaign-profile", () => ({
  campaignOptionalAttributeIds: () => new Set<string>(),
  currentSecondEditionCampaignProfile: () => ({
    fantasySkills: false,
    freeformSkillBasedMagic: false,
    magicPointsCasting: false,
    psionics: false,
    scienceFictionSkills: false,
    superheroicSkills: false,
  }),
}));
vi.mock("../settings/attributes", () => ({
  currentAttributeRuntimeStrategy: () => ({ family: "second-edition" }),
}));

import { synchronizeActorSkills } from "./skill-sync";

describe("FreeD6 Actor skill synchronization", () => {
  beforeEach(() => {
    vi.stubGlobal("game", { user: { isGM: true } });
  });

  it("adds the complete source catalog without duplicating an existing skill", async () => {
    const createEmbeddedDocuments = vi.fn().mockResolvedValue([]);
    const actor = {
      createEmbeddedDocuments,
      items: {
        contents: [
          {
            system: { key: "firearms" },
            type: "skill",
          },
        ],
      },
      type: "character",
    } as unknown as FoundryActorDocument;

    await expect(synchronizeActorSkills(actor)).resolves.toBe(106);
    expect(createEmbeddedDocuments).toHaveBeenCalledOnce();
    const [documentType, sources, options] = createEmbeddedDocuments.mock
      .calls[0] as [string, Record<string, unknown>[], Record<string, unknown>];
    expect(documentType).toBe("Item");
    expect(options).toEqual({ d6System2eCatalogSync: true });
    expect(sources).toHaveLength(106);
    expect(sources.some(({ name }) => name === "Firearms")).toBe(false);
    expect(sources.find(({ name }) => name === "First Aid")).toMatchObject({
      system: {
        attributeId: "technical",
        source: {
          book: "FreeD6 Player Book and GM Guide",
          module: "free-d6",
          page: 17,
        },
      },
      type: "skill",
    });
  });

  it("does not mutate an Actor without GM authority", async () => {
    vi.stubGlobal("game", { user: { isGM: false } });
    const createEmbeddedDocuments = vi.fn();
    const actor = {
      createEmbeddedDocuments,
      items: { contents: [] },
      type: "character",
    } as unknown as FoundryActorDocument;

    await expect(synchronizeActorSkills(actor)).resolves.toBe(0);
    expect(createEmbeddedDocuments).not.toHaveBeenCalled();
  });
});
