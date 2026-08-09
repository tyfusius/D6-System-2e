import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../registries/bestiary", () => ({
  resolvedBestiaryEntry: (entryId: string) =>
    entryId === "bundled-dragon"
      ? {
          entry: {
            attributeScores: { agility: 12, brawn: 18 },
            source: { book: "Bundled Book", page: 12 },
          },
        }
      : null,
}));
vi.mock("../settings/attributes", () => ({
  currentActiveAttributeDefinitions: () => [{ id: "agility" }, { id: "brawn" }],
}));
vi.mock("../settings/rules-profile-library", () => ({
  currentConfiguredRulesProfile: () => ({ id: "second-edition" }),
  strategyUsesOpenD6: () => false,
}));
vi.mock("../settings/setting-profile", () => ({
  currentResolvedSettingProfile: () => ({
    profile: { id: "world-setting" },
  }),
}));

import {
  bestiaryDocumentAccess,
  currentWorldBestiaryCatalog,
  deleteBestiaryDocument,
  duplicateBestiaryDocument,
  refreshBestiaryDocuments,
  removeBestiaryDocument,
  restoreBestiaryDocument,
} from "./bestiary-document-repository";

const update = vi.fn();
const remove = vi.fn();
const create = vi.fn();
const callAll = vi.fn();

function creature(
  id: string,
  name: string,
  entryId: string,
  options: { readonly listed?: boolean; readonly bundled?: boolean } = {},
) {
  const catalogFlag = options.bundled
    ? {}
    : {
        attributeIds: ["agility", "brawn"],
        entryId,
        listed: options.listed ?? true,
        rulesFamily: "d6-system-second-edition",
        sourceBook: "World Creature Catalog",
        sourcePage: 1,
      };
  return {
    delete: remove,
    getFlag: (_namespace: string, key: string) =>
      key === "creatureCatalog" ? catalogFlag : undefined,
    id,
    name,
    sheet: { render: vi.fn() },
    system: {
      bestiary: options.bundled
        ? { entryId, sourceBook: "Bundled Book", sourcePage: 12 }
        : {},
    },
    toObject: () => ({
      _id: id,
      flags: {},
      img: "icons/svg/mystery-man.svg",
      items: [
        {
          name: "Athletics",
          type: "skill",
          system: { attributeId: "brawn", key: "athletics", score: 3 },
        },
        {
          name: "Claws",
          type: "weapon",
          system: { damage: 9 },
        },
      ],
      name,
      system: {
        attributes: { agility: { score: 6 }, brawn: { score: 12 } },
        bestiary: options.bundled
          ? { entryId, sourceBook: "Bundled Book", sourcePage: 12 }
          : {},
        biography: "A test creature.",
        defenses: { dodgeOverride: 8, parryOverride: 9 },
        resources: { magicPoints: { value: 2 } },
        scale: 1,
      },
      type: "creature",
    }),
    type: "creature",
    update,
    uuid: `Compendium.test.Actor.${id}`,
  };
}

beforeEach(() => {
  update.mockReset().mockResolvedValue(undefined);
  remove.mockReset().mockResolvedValue(undefined);
  create.mockReset();
  callAll.mockReset();
  vi.stubGlobal("Hooks", { callAll });
  vi.stubGlobal("Actor", { create });
  vi.stubGlobal("game", {
    i18n: {
      format: (key: string, data: { name: string }) =>
        key === "D6E2.Bestiary.CopyName" ? `Copy of ${data.name}` : key,
      localize: (key: string) => key,
    },
    packs: {
      contents: [],
      get: vi.fn(),
    },
  });
});

describe("document-backed Creature Catalog", () => {
  it("indexes protected package sources and editable world Actor sources", async () => {
    const bundled = creature("bundle1", "Dragon", "bundled-dragon", {
      bundled: true,
    });
    const custom = creature("world1", "Custom Beast", "world.custom-beast");
    const packagePack = {
      collection: "module.creatures",
      documentName: "Actor",
      getDocuments: vi.fn().mockResolvedValue([bundled]),
      locked: true,
      metadata: { label: "Bundled Creatures", packageType: "module" },
    };
    const worldPack = {
      collection: "world.d6-creature-catalog",
      documentName: "Actor",
      getDocuments: vi.fn().mockResolvedValue([custom]),
      locked: false,
      metadata: { label: "World Creature Catalog", packageType: "world" },
    };
    vi.stubGlobal("game", {
      ...(game as object),
      packs: { contents: [packagePack, worldPack], get: vi.fn() },
    });

    await refreshBestiaryDocuments();

    expect(bestiaryDocumentAccess("bundled-dragon")).toMatchObject({
      editable: false,
      worldOwned: false,
    });
    expect(bestiaryDocumentAccess("world.custom-beast")).toMatchObject({
      editable: true,
      worldOwned: true,
    });
    expect(currentWorldBestiaryCatalog()?.entries[0]).toMatchObject({
      attributeScores: { agility: 6, brawn: 12 },
      defenseOverrides: { dodge: 8, parry: 9 },
      id: "world.custom-beast",
      label: "Custom Beast",
      magicPoints: 2,
      skillScores: { athletics: 15 },
    });
  });

  it("separates non-destructive removal from permanent deletion", async () => {
    const custom = creature("world2", "Catalog Beast", "world.catalog-beast");
    const worldPack = {
      collection: "world.d6-creature-catalog",
      documentName: "Actor",
      getDocuments: vi.fn().mockResolvedValue([custom]),
      locked: false,
      metadata: { label: "World Creature Catalog", packageType: "world" },
    };
    vi.stubGlobal("game", {
      ...(game as object),
      packs: { contents: [worldPack], get: vi.fn() },
    });
    await refreshBestiaryDocuments();

    await removeBestiaryDocument("world.catalog-beast");
    expect(update).toHaveBeenCalledWith({
      "flags.d6-system-2e.creatureCatalog.listed": false,
    });
    expect(remove).not.toHaveBeenCalled();

    update.mockClear();
    await restoreBestiaryDocument("world.catalog-beast");
    expect(update).toHaveBeenCalledWith({
      "flags.d6-system-2e.creatureCatalog.listed": true,
    });

    await refreshBestiaryDocuments();
    await deleteBestiaryDocument("world.catalog-beast");
    expect(remove).toHaveBeenCalledOnce();
  });

  it("creates an editable current-profile copy without changing the source", async () => {
    const bundled = creature("bundle2", "Dragon", "bundled-dragon", {
      bundled: true,
    });
    const packagePack = {
      collection: "module.creatures",
      documentName: "Actor",
      getDocuments: vi.fn().mockResolvedValue([bundled]),
      locked: true,
      metadata: { label: "Bundled Creatures", packageType: "module" },
    };
    const worldPack = {
      collection: "world.d6-creature-catalog",
      documentName: "Actor",
      getDocuments: vi.fn().mockResolvedValue([]),
      locked: false,
      metadata: { label: "World Creature Catalog", packageType: "world" },
    };
    const created = creature("copy1", "Copy of Dragon", "world.copy");
    create.mockResolvedValue(created);
    vi.stubGlobal("game", {
      ...(game as object),
      packs: {
        contents: [packagePack, worldPack],
        get: vi.fn().mockReturnValue(worldPack),
      },
    });
    await refreshBestiaryDocuments();

    await duplicateBestiaryDocument("bundled-dragon", true);

    expect(create).toHaveBeenCalledOnce();
    const [source, options] = create.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(options).toEqual({ pack: "world.d6-creature-catalog" });
    expect(source).not.toHaveProperty("_id");
    expect(source).toMatchObject({
      name: "Copy of Dragon",
      flags: {
        "d6-system-2e": {
          creatureCatalog: {
            attributeIds: ["agility", "brawn"],
            listed: true,
            rulesProfileId: "second-edition",
            settingProfileId: "world-setting",
            sourceBook: "Bundled Book",
            sourcePage: 12,
          },
        },
      },
    });
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});
