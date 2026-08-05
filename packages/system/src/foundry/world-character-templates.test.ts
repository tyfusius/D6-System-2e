import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../settings/campaign-profile", () => ({
  campaignOptionalAttributeIds: () => new Set<string>(),
  currentSecondEditionCampaignProfile: () => ({}),
}));
vi.mock("../settings/rules-compatibility", () => ({
  currentRulesProfile: () => ({
    compatibility: { firstEditionAttributes: false },
  }),
}));

import { createCharacterTemplateFromActor } from "./world-character-templates";

beforeEach(() => {
  vi.stubGlobal("game", {
    items: { contents: [] },
    user: { isGM: true },
  });
});

describe("world Character Templates", () => {
  it("passes mutable nested Item snapshots to Foundry document creation", async () => {
    const create = vi.fn((source: Record<string, unknown>) => {
      const system = source.system as {
        items: { img: string }[];
      };
      expect(Object.isFrozen(system.items[0])).toBe(false);
      const firstItem = system.items[0];
      if (firstItem) firstItem.img = "icons/svg/upgrade.svg";
      return Promise.resolve({ id: "template-1", ...source });
    });
    vi.stubGlobal("Item", { create });
    const actor = {
      id: "actor-1",
      img: "icons/svg/mystery-man.svg",
      isOwner: true,
      items: {
        contents: [
          {
            id: "gear-1",
            img: "icons/svg/item-bag.svg",
            name: "Field Kit",
            system: { key: "field-kit" },
            toObject: () => ({ system: { key: "field-kit" } }),
            type: "gear",
            uuid: "Actor.actor-1.Item.gear-1",
          },
        ],
      },
      name: "Template Source",
      system: {
        attributes: {
          agility: { score: 9 },
          brawn: { score: 9 },
          knowledge: { score: 9 },
          perception: { score: 9 },
        },
        biography: "",
        movement: { base: 10 },
        resources: {
          characterPoints: { value: 0 },
          fatePoints: { value: 0 },
        },
      },
      type: "character",
    };

    await createCharacterTemplateFromActor(
      actor as unknown as FoundryActorDocument,
    );

    expect(create).toHaveBeenCalledOnce();
  });
});
