import { beforeEach, describe, expect, it, vi } from "vitest";

const campaignState = vi.hoisted(() => ({
  value: {
    activeAttributeIds: ["agility", "brawn", "knowledge", "perception"],
    fantasySkills: false,
    freeformSkillBasedMagic: false,
    magicPointsCasting: false,
  },
}));

vi.mock("../settings/campaign-profile", () => ({
  campaignOptionalAttributeIds: (profile: { activeAttributeIds: string[] }) =>
    new Set(profile.activeAttributeIds.slice(4)),
  currentSecondEditionCampaignProfile: () => campaignState.value,
}));
vi.mock("../settings/rules-compatibility", () => ({
  currentRulesProfile: () => ({
    compatibility: { firstEditionAttributes: false },
  }),
}));

import {
  createBestiaryCreature,
  previewBestiaryEntry,
} from "./bestiary-service";
import {
  bestiaryRegistry,
  resetBestiaryRegistryForTests,
} from "../registries/bestiary";

const create = vi.fn();
const remove = vi.fn();
const update = vi.fn();

beforeEach(() => {
  resetBestiaryRegistryForTests();
  campaignState.value = {
    activeAttributeIds: ["agility", "brawn", "knowledge", "perception"],
    fantasySkills: false,
    freeformSkillBasedMagic: false,
    magicPointsCasting: false,
  };
  vi.stubGlobal("game", { user: { isGM: true } });
  vi.stubGlobal("Actor", { create });
  create.mockReset();
  remove.mockReset();
  remove.mockResolvedValue(undefined);
  update.mockReset();
  update.mockResolvedValue(undefined);
  create.mockResolvedValue({ delete: remove, id: "creature-1", update });
  bestiaryRegistry.register("licensed-module", {
    entries: [
      {
        attributeScores: {
          agility: 12,
          brawn: 27,
          knowledge: 6,
          perception: 9,
        },
        defenseOverrides: { dodge: 10, parry: 15 },
        id: "licensed-large-creature",
        items: [
          {
            name: "Natural attack",
            system: { damage: 9 },
            type: "weapon",
          },
        ],
        label: "Licensed large creature",
        scale: 3,
        source: { book: "Licensed source", page: 40 },
        version: 1,
      },
    ],
    id: "licensed.bestiary",
    label: "Licensed bestiary",
    version: 1,
  });
});

describe("bestiary creature creation", () => {
  it("previews and atomically creates a complete high-Die-Code Creature", async () => {
    expect(previewBestiaryEntry("licensed-large-creature")).toMatchObject({
      canCreate: true,
      defenseOverrides: { dodge: 10, parry: 15 },
      itemAdditions: [{ name: "Natural attack", type: "weapon" }],
      scale: 3,
    });
    const result = await createBestiaryCreature("licensed-large-creature");
    expect(result.actorId).toBe("creature-1");
    expect(create).toHaveBeenCalledOnce();
    const source = create.mock.calls[0]?.[0] as unknown as {
      items: { type: string }[];
      name: string;
      system: {
        attributes: { brawn: { score: number } };
        bestiary: { catalogId: string; entryId: string };
        defenses: { dodgeOverride: number; parryOverride: number };
        scale: number;
      };
      type: string;
    };
    expect(source.name).toBe("Licensed large creature");
    expect(source.type).toBe("creature");
    expect(source.system.attributes.brawn.score).toBe(27);
    expect(source.system.bestiary).toMatchObject({
      catalogId: "licensed.bestiary",
      entryId: "licensed-large-creature",
    });
    expect(source.system.defenses).toEqual({
      dodgeOverride: 10,
      parryOverride: 15,
    });
    expect(source.system.scale).toBe(3);
    expect(source.items.some((item) => item.type === "skill")).toBe(true);
    expect(source.items.some((item) => item.type === "weapon")).toBe(true);
    expect(update).toHaveBeenCalledOnce();
    const persisted = update.mock.calls[0]?.[0] as unknown as {
      "system.bestiary": Record<string, unknown>;
      "system.scale": number;
    };
    expect(persisted).toMatchObject({
      "system.bestiary": {
        catalogId: "licensed.bestiary",
        entryId: "licensed-large-creature",
        sourceBook: "Licensed source",
        sourcePage: 40,
      },
      "system.scale": 3,
    });
  });

  it("fails closed for role, campaign Attribute, and Magic Point dependencies", () => {
    vi.stubGlobal("game", { user: { isGM: false } });
    expect(previewBestiaryEntry("licensed-large-creature").issues).toContain(
      "gm-required",
    );
    vi.stubGlobal("game", { user: { isGM: true } });
    campaignState.value.activeAttributeIds = ["agility", "knowledge"];
    expect(previewBestiaryEntry("licensed-large-creature").issues).toContain(
      "attribute-inactive",
    );
    bestiaryRegistry.register("magic-module", {
      entries: [
        {
          attributeScores: { agility: 3 },
          defenseOverrides: { dodge: 5, parry: 5 },
          id: "licensed-magic-creature",
          label: "Licensed magic creature",
          magicPoints: 10,
          source: { book: "Licensed source", page: 41 },
          version: 1,
        },
      ],
      id: "magic.bestiary",
      label: "Magic bestiary",
      version: 1,
    });
    campaignState.value.activeAttributeIds = [
      "agility",
      "brawn",
      "knowledge",
      "perception",
    ];
    expect(previewBestiaryEntry("licensed-magic-creature").issues).toContain(
      "magic-points-inactive",
    );
  });

  it("removes the created Actor when final persistence fails", async () => {
    update.mockRejectedValueOnce(new Error("persistence failed"));
    await expect(
      createBestiaryCreature("licensed-large-creature"),
    ).rejects.toThrow("persistence failed");
    expect(remove).toHaveBeenCalledOnce();
  });
});
