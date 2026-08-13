import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  D6LegacyWorldDocumentWritePlanV1,
  ItemSource,
} from "@d6-system-2e/core";
vi.mock("./legacy-extraordinary-power-writer", () => ({
  preflightLegacyExtraordinaryPowerActors: vi.fn(() => ({
    idempotentSkips: [],
    unresolved: [],
  })),
  writeLegacyExtraordinaryPowerActors: vi.fn(() =>
    Promise.resolve({
      createdActors: [],
      createdItems: 0,
      format: "d6-system-2e.legacy-extraordinary-power-write.v1",
      idempotentSkips: [],
      rolledBackActors: [],
      status: "complete",
      targetWrites: 0,
      unresolved: [],
    }),
  ),
}));
import {
  preflightLegacyExtraordinaryPowerActors,
  writeLegacyExtraordinaryPowerActors,
} from "./legacy-extraordinary-power-writer";
import { writeLegacyWorldDocuments } from "./legacy-world-document-writer";

const noWorldDocuments = {
  createWorldDocument: vi.fn(),
  existingWorldDocument: vi.fn(() => undefined),
};

const item: ItemSource = {
  _id: "TemplateItem0001",
  flags: {
    "d6-system-2e": {
      legacyImport: { sourceUuid: "Item.TemplateItem0001" },
    },
  },
  system: {},
  type: "character-template",
};

const plan: D6LegacyWorldDocumentWritePlanV1 = {
  actors: [],
  folders: [
    {
      _id: "ChildFolder00001",
      flags: {
        "d6-system-2e": {
          legacyImport: { sourceUuid: "Folder.ChildFolder00001" },
        },
      },
      folder: "RootFolder000001",
      name: "Child",
      sort: 20,
      sorting: "m",
      type: "Actor",
    },
    {
      _id: "RootFolder000001",
      flags: {
        "d6-system-2e": {
          legacyImport: { sourceUuid: "Folder.RootFolder000001" },
        },
      },
      folder: null,
      name: "Root",
      sort: 10,
      sorting: "m",
      type: "Actor",
    },
  ],
  standaloneItems: [item],
};

function scene(id: string) {
  return {
    delete: vi.fn(() => Promise.resolve()),
    getFlag: vi.fn(),
    id,
    setFlag: vi.fn(),
    toObject: () => ({
      flags: {
        "d6-system-2e": { legacyImport: { sourceUuid: `Scene.${id}` } },
      },
    }),
    unsetFlag: vi.fn(),
  } as unknown as FoundrySceneDocument;
}

function folder(id: string) {
  return {
    delete: vi.fn(() => Promise.resolve()),
    id,
    toObject: () => ({
      flags: {
        "d6-system-2e": { legacyImport: { sourceUuid: `Folder.${id}` } },
      },
    }),
  } as FoundryFolderDocument;
}

function standalone(id: string) {
  return {
    delete: vi.fn(() => Promise.resolve()),
    id,
    toObject: () => ({
      flags: {
        "d6-system-2e": { legacyImport: { sourceUuid: `Item.${id}` } },
      },
    }),
  } as unknown as FoundryItemDocument;
}

function worldDocument(id: string, documentType: string) {
  return {
    delete: vi.fn(() => Promise.resolve()),
    id,
    toObject: () => ({
      flags: {
        "d6-system-2e": {
          legacyImport: { sourceUuid: `${documentType}.${id}` },
        },
      },
    }),
  } as FoundryWorldDocument;
}

describe("legacy world-document writer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(preflightLegacyExtraordinaryPowerActors).mockReturnValue({
      idempotentSkips: [],
      unresolved: [],
    });
    vi.mocked(writeLegacyExtraordinaryPowerActors).mockResolvedValue({
      createdActors: [],
      createdItems: 0,
      format: "d6-system-2e.legacy-extraordinary-power-write.v1",
      idempotentSkips: [],
      rolledBackActors: [],
      status: "complete",
      targetWrites: 0,
      unresolved: [],
    });
    vi.stubGlobal("game", { user: { isGM: true } });
  });

  it("creates parent folders first and reports a repeat as zero-write skips", async () => {
    const folders = new Map<string, FoundryFolderDocument>();
    const items = new Map<string, FoundryItemDocument>();
    const scenes = new Map<string, FoundrySceneDocument>();
    const createFolder = vi.fn((source: { _id: string }) => {
      const created = folder(source._id);
      folders.set(source._id, created);
      return Promise.resolve(created);
    });
    const repository = {
      ...noWorldDocuments,
      createFolder,
      createScene: vi.fn((source: Readonly<Record<string, unknown>>) => {
        const created = scene(String(source._id));
        scenes.set(created.id, created);
        return Promise.resolve(created);
      }),
      createStandaloneItem: vi.fn((source: ItemSource) => {
        const created = standalone(String(source._id));
        items.set(created.id, created);
        return Promise.resolve(created);
      }),
      existingFolder: (id: string) => folders.get(id),
      existingScene: (id: string) => scenes.get(id),
      existingStandaloneItem: (id: string) => items.get(id),
    };
    const first = await writeLegacyWorldDocuments(plan, repository);
    const second = await writeLegacyWorldDocuments(plan, repository);
    expect(createFolder.mock.calls.map(([source]) => source._id)).toEqual([
      "RootFolder000001",
      "ChildFolder00001",
    ]);
    expect(first).toMatchObject({
      createdFolders: ["RootFolder000001", "ChildFolder00001"],
      createdStandaloneItems: ["TemplateItem0001"],
      status: "complete",
      targetWrites: 3,
    });
    expect(second).toMatchObject({
      idempotentFolderSkips: ["ChildFolder00001", "RootFolder000001"],
      idempotentStandaloneItemSkips: ["TemplateItem0001"],
      status: "complete",
      targetWrites: 0,
    });
  });

  it("rolls back standalone Items and child-first folders after an Actor failure", async () => {
    vi.mocked(writeLegacyExtraordinaryPowerActors).mockResolvedValueOnce({
      createdActors: [],
      createdItems: 0,
      format: "d6-system-2e.legacy-extraordinary-power-write.v1",
      idempotentSkips: [],
      rolledBackActors: ["ActorFixture001"],
      status: "failed",
      targetWrites: 2,
      unresolved: ["write-failed:fixture"],
    });
    const createdFolders: FoundryFolderDocument[] = [];
    const createdItem = standalone("TemplateItem0001");
    const report = await writeLegacyWorldDocuments(plan, {
      ...noWorldDocuments,
      createFolder: ({ _id }) => {
        const created = folder(_id);
        createdFolders.push(created);
        return Promise.resolve(created);
      },
      createScene: vi.fn(),
      createStandaloneItem: () => Promise.resolve(createdItem),
      existingFolder: () => undefined,
      existingScene: () => undefined,
      existingStandaloneItem: () => undefined,
    });
    expect(report).toMatchObject({
      rolledBackFolders: ["ChildFolder00001", "RootFolder000001"],
      rolledBackStandaloneItems: ["TemplateItem0001"],
      status: "failed",
    });
    expect("delete" in createdItem).toBe(true);
  });

  it("preflights missing parents before creating anything", async () => {
    const repository = {
      ...noWorldDocuments,
      createFolder: vi.fn(),
      createScene: vi.fn(),
      createStandaloneItem: vi.fn(),
      existingFolder: vi.fn(),
      existingScene: vi.fn(),
      existingStandaloneItem: vi.fn(),
    };
    const report = await writeLegacyWorldDocuments(
      { ...plan, folders: plan.folders.slice(0, 1) },
      repository,
    );
    expect(report).toMatchObject({ status: "failed", targetWrites: 0 });
    expect(report.unresolved).toContain(
      "Missing parent Folder RootFolder000001.",
    );
    expect(repository.createFolder).not.toHaveBeenCalled();
  });

  it("creates Scenes with preserved IDs, skips repeats, and reports warnings", async () => {
    const scenes = new Map<string, FoundrySceneDocument>();
    const scenePlan = {
      ...plan,
      actors: [],
      folders: [],
      scenes: [
        {
          _id: "SceneFixture001",
          flags: {
            "d6-system-2e": {
              legacyImport: { sourceUuid: "Scene.SceneFixture001" },
            },
          },
          name: "Fixture Scene",
          tokens: [],
        },
      ],
      standaloneItems: [],
      warnings: ["missing-token-actor:fixture"],
    } satisfies D6LegacyWorldDocumentWritePlanV1;
    const repository = {
      ...noWorldDocuments,
      createFolder: vi.fn(),
      createScene: vi.fn((source: Readonly<Record<string, unknown>>) => {
        const created = scene(String(source._id));
        scenes.set(created.id, created);
        return Promise.resolve(created);
      }),
      createStandaloneItem: vi.fn(),
      existingFolder: vi.fn(),
      existingScene: (id: string) => scenes.get(id),
      existingStandaloneItem: vi.fn(),
    };
    const first = await writeLegacyWorldDocuments(scenePlan, repository);
    const second = await writeLegacyWorldDocuments(scenePlan, repository);
    expect(first).toMatchObject({
      createdScenes: ["SceneFixture001"],
      status: "complete",
      targetWrites: 1,
      warnings: ["missing-token-actor:fixture"],
    });
    expect(second).toMatchObject({
      idempotentSceneSkips: ["SceneFixture001"],
      status: "complete",
      targetWrites: 0,
    });
  });

  it("rolls back earlier Scenes when a later Scene creation fails", async () => {
    const first = scene("SceneFixture001");
    const report = await writeLegacyWorldDocuments(
      {
        ...noWorldDocuments,
        actors: [],
        folders: [],
        scenes: [{ _id: "SceneFixture001" }, { _id: "SceneFixture002" }],
        standaloneItems: [],
      },
      {
        ...noWorldDocuments,
        createFolder: vi.fn(),
        createScene: vi
          .fn()
          .mockResolvedValueOnce(first)
          .mockRejectedValueOnce(new Error("fixture scene failure")),
        createStandaloneItem: vi.fn(),
        existingFolder: vi.fn(),
        existingScene: vi.fn(),
        existingStandaloneItem: vi.fn(),
      },
    );
    expect(report).toMatchObject({
      rolledBackScenes: ["SceneFixture001"],
      status: "failed",
      targetWrites: 2,
    });
  });

  it("creates structured world documents and skips provenance-complete repeats", async () => {
    const documents = new Map<string, FoundryWorldDocument>();
    const documentPlan: D6LegacyWorldDocumentWritePlanV1 = {
      actors: [],
      folders: [],
      standaloneItems: [],
      worldDocuments: [
        {
          documentType: "JournalEntry",
          source: { _id: "JournalFixture01", name: "Journal", pages: [] },
        },
      ],
    };
    const repository = {
      ...noWorldDocuments,
      createFolder: vi.fn(),
      createScene: vi.fn(),
      createStandaloneItem: vi.fn(),
      createWorldDocument: vi.fn(
        (documentType: string, source: Record<string, unknown>) => {
          const created = worldDocument(String(source._id), documentType);
          documents.set(`${documentType}.${created.id}`, created);
          return Promise.resolve(created);
        },
      ),
      existingFolder: vi.fn(),
      existingScene: vi.fn(),
      existingStandaloneItem: vi.fn(),
      existingWorldDocument: (documentType: string, id: string) =>
        documents.get(`${documentType}.${id}`),
    };
    const first = await writeLegacyWorldDocuments(documentPlan, repository);
    const repeat = await writeLegacyWorldDocuments(documentPlan, repository);
    expect(first).toMatchObject({
      createdWorldDocuments: ["JournalEntry.JournalFixture01"],
      status: "complete",
      targetWrites: 1,
    });
    expect(repeat).toMatchObject({
      idempotentWorldDocumentSkips: ["JournalEntry.JournalFixture01"],
      status: "complete",
      targetWrites: 0,
    });
  });

  it("rolls back structured world documents when a later creation fails", async () => {
    const first = worldDocument("JournalFixture01", "JournalEntry");
    const report = await writeLegacyWorldDocuments(
      {
        actors: [],
        folders: [],
        standaloneItems: [],
        worldDocuments: [
          {
            documentType: "JournalEntry",
            source: { _id: "JournalFixture01", pages: [] },
          },
          {
            documentType: "RollTable",
            source: { _id: "TableFixture0001", results: [] },
          },
        ],
      },
      {
        createFolder: vi.fn(),
        createScene: vi.fn(),
        createStandaloneItem: vi.fn(),
        createWorldDocument: vi
          .fn()
          .mockResolvedValueOnce(first)
          .mockRejectedValueOnce(new Error("fixture document failure")),
        existingFolder: vi.fn(),
        existingScene: vi.fn(),
        existingStandaloneItem: vi.fn(),
        existingWorldDocument: vi.fn(),
      },
    );
    expect(report).toMatchObject({
      rolledBackWorldDocuments: ["JournalEntry.JournalFixture01"],
      status: "failed",
      targetWrites: 2,
    });
  });
});
