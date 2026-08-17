import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  D6LegacyExtraordinaryPowerActorWritePlanV1,
  D6LegacyExtraordinaryPowerWriteReportV1,
  D6LegacyFolderSourceV1,
  D6LegacyWorldDocumentWritePlanV1,
  ItemSource,
} from "@d6-system-2e/core";

vi.mock("./legacy-extraordinary-power-writer", () => ({
  executeLegacyExtraordinaryPowerActorWrite: vi.fn(),
  preflightLegacyExtraordinaryPowerActors: vi.fn(),
}));

import {
  executeLegacyExtraordinaryPowerActorWrite,
  preflightLegacyExtraordinaryPowerActors,
} from "./legacy-extraordinary-power-writer";
import {
  previewLegacyWorldDocuments,
  writeLegacyWorldDocuments,
  type LegacyWorldDocumentWriteRepository,
} from "./legacy-world-document-writer";

type WorldDocumentType =
  "Cards" | "JournalEntry" | "Macro" | "Playlist" | "RollTable";

const version = "1.0.7";

function flags(sourceUuid: string, sourceVersion = version) {
  return {
    "d6-system-2e": {
      legacyImport: { sourceUuid, sourceVersion },
      preservedExtension: "opaque",
    },
    "legacy-module": { preserved: true },
  };
}

function actorPlan(
  id = "ActorFixture001",
): D6LegacyExtraordinaryPowerActorWritePlanV1 {
  return {
    actor: {
      _id: id,
      flags: flags(`Actor.${id}`),
      items: [],
      name: "Actor fixture",
      ownership: { default: 0, PlayerFixture001: 3 },
      system: { unknownLegacyField: "preserved" },
      type: "character",
    },
    items: [
      {
        _id: "EmbeddedItem001",
        flags: flags("Item.EmbeddedItem001"),
        system: { unknownLegacyField: true },
        type: "skill",
      },
    ],
    source: { system: "od6s", uuid: `Actor.${id}`, version },
  };
}

function folder(
  id: string,
  type: string,
  parent: string | null = null,
): D6LegacyFolderSourceV1 {
  return {
    _id: id,
    flags: flags(`Folder.${id}`),
    folder: parent,
    name: `${type} folder`,
    sort: 0,
    sorting: "m",
    type,
  };
}

function item(id = "StandaloneItem01"): ItemSource {
  return {
    _id: id,
    flags: flags(`Item.${id}`),
    folder: "ItemFolder000001",
    name: "Standalone fixture",
    ownership: { default: 0, PlayerFixture001: 3 },
    system: { unknownLegacyField: "preserved" },
    type: "character-template",
  };
}

function sceneSource(id = "SceneFixture001") {
  return {
    _id: id,
    flags: flags(`Scene.${id}`),
    name: "Scene fixture",
    tokens: [],
    unknownLegacyField: { preserved: true },
  };
}

function worldSource(documentType: WorldDocumentType, id: string) {
  return {
    _id: id,
    flags: flags(`${documentType}.${id}`),
    name: `${documentType} fixture`,
    ownership: { default: 0, PlayerFixture001: 2 },
    unknownLegacyField: "preserved",
  };
}

function actorReport(
  overrides: Partial<D6LegacyExtraordinaryPowerWriteReportV1> = {},
): D6LegacyExtraordinaryPowerWriteReportV1 {
  return {
    createdActors: [],
    createdItems: 0,
    format: "d6-system-2e.legacy-extraordinary-power-write.v1",
    idempotentSkips: [],
    rolledBackActors: [],
    rollbackFailures: [],
    status: "complete",
    targetWrites: 0,
    unresolved: [],
    ...overrides,
  };
}

function actorDocument(id: string, deletion = vi.fn(() => Promise.resolve())) {
  return { delete: deletion, id } as unknown as FoundryActorDocument;
}

function repositoryFixture() {
  const folders = new Map<string, FoundryFolderDocument>();
  const items = new Map<string, FoundryItemDocument>();
  const scenes = new Map<string, FoundrySceneDocument>();
  const worldDocuments = new Map<string, FoundryWorldDocument>();
  const repository: LegacyWorldDocumentWriteRepository = {
    createActor: vi.fn(),
    createFolder: vi.fn((source: D6LegacyFolderSourceV1) => {
      const document = {
        delete: vi.fn(() => Promise.resolve(folders.delete(source._id))),
        id: source._id,
        toObject: () => structuredClone(source),
      } as unknown as FoundryFolderDocument;
      folders.set(source._id, document);
      return Promise.resolve(document);
    }),
    createScene: vi.fn((source: Readonly<Record<string, unknown>>) => {
      const id = String(source._id);
      const document = {
        delete: vi.fn(() => Promise.resolve(scenes.delete(id))),
        id,
        toObject: () => structuredClone(source),
      } as unknown as FoundrySceneDocument;
      scenes.set(id, document);
      return Promise.resolve(document);
    }),
    createStandaloneItem: vi.fn((source: ItemSource) => {
      const id = String(source._id);
      const document = {
        delete: vi.fn(() => Promise.resolve(items.delete(id))),
        id,
        toObject: () => structuredClone(source),
      } as unknown as FoundryItemDocument;
      items.set(id, document);
      return Promise.resolve(document);
    }),
    createWorldDocument: vi.fn(
      (
        documentType: WorldDocumentType,
        source: Readonly<Record<string, unknown>>,
      ) => {
        const id = String(source._id);
        const key = `${documentType}.${id}`;
        const document = {
          delete: vi.fn(() => Promise.resolve(worldDocuments.delete(key))),
          id,
          toObject: () => structuredClone(source),
        } as FoundryWorldDocument;
        worldDocuments.set(key, document);
        return Promise.resolve(document);
      },
    ),
    existingActor: vi.fn(() => undefined),
    existingFolder: (id) => folders.get(id),
    existingScene: (id) => scenes.get(id),
    existingStandaloneItem: (id) => items.get(id),
    existingWorldDocument: (documentType, id) =>
      worldDocuments.get(`${documentType}.${id}`),
  };
  return {
    repository,
    stores: { folders, items, scenes, worldDocuments },
  };
}

function completePlan(): D6LegacyWorldDocumentWritePlanV1 {
  const documentTypes: readonly WorldDocumentType[] = [
    "Cards",
    "JournalEntry",
    "Macro",
    "Playlist",
    "RollTable",
  ];
  const folderTypes = [
    "Actor",
    "Cards",
    "Item",
    "JournalEntry",
    "Macro",
    "Playlist",
    "RollTable",
    "Scene",
  ];
  return {
    actors: [actorPlan()],
    folders: folderTypes.map((type, index) =>
      folder(
        type === "Item"
          ? "ItemFolder000001"
          : `${type}Folder${String(index).padStart(8, "0")}`,
        type,
      ),
    ),
    scenes: [sceneSource()],
    standaloneItems: [item()],
    warnings: ["missing-token-actor:fixture"],
    worldDocuments: documentTypes.map((documentType, index) => ({
      documentType,
      source: worldSource(
        documentType,
        `${documentType}Doc${String(index).padStart(8, "0")}`,
      ),
    })),
  };
}

describe("legacy world-document import integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("game", { user: { isGM: true } });
    vi.mocked(preflightLegacyExtraordinaryPowerActors).mockReturnValue({
      idempotentSkips: [],
      unresolved: [],
    });
    vi.mocked(executeLegacyExtraordinaryPowerActorWrite).mockResolvedValue({
      createdActors: [],
      report: actorReport(),
    });
  });

  it("previews every supported folder and document family with zero writes", () => {
    const fixture = repositoryFixture();
    const preview = previewLegacyWorldDocuments(
      completePlan(),
      fixture.repository,
    );
    expect(preview).toMatchObject({
      conflicts: [],
      plannedActors: ["ActorFixture001"],
      plannedEmbeddedItems: 1,
      plannedScenes: ["SceneFixture001"],
      plannedStandaloneItems: ["StandaloneItem01"],
      status: "ready",
      targetWrites: 0,
      warnings: ["missing-token-actor:fixture"],
    });
    expect(preview.plannedFolders).toHaveLength(8);
    expect(preview.plannedWorldDocuments).toHaveLength(5);
    expect(fixture.repository.createFolder).not.toHaveBeenCalled();
    expect(fixture.repository.createStandaloneItem).not.toHaveBeenCalled();
    expect(fixture.repository.createScene).not.toHaveBeenCalled();
    expect(fixture.repository.createWorldDocument).not.toHaveBeenCalled();
    expect(executeLegacyExtraordinaryPowerActorWrite).not.toHaveBeenCalled();
  });

  it("supports Item folders and exact zero-write repeats while preserving source data", async () => {
    const fixture = repositoryFixture();
    const importPlan: D6LegacyWorldDocumentWritePlanV1 = {
      actors: [],
      folders: [folder("ItemFolder000001", "Item")],
      scenes: [sceneSource()],
      standaloneItems: [item()],
      worldDocuments: [
        {
          documentType: "JournalEntry",
          source: worldSource("JournalEntry", "JournalFixture01"),
        },
      ],
    };
    const preview = previewLegacyWorldDocuments(importPlan, fixture.repository);
    const first = await writeLegacyWorldDocuments(
      importPlan,
      fixture.repository,
    );
    const repeatPreview = previewLegacyWorldDocuments(
      importPlan,
      fixture.repository,
    );
    const repeat = await writeLegacyWorldDocuments(
      importPlan,
      fixture.repository,
    );
    expect(first).toMatchObject({ status: "complete", targetWrites: 4 });
    expect(first.createdFolders).toEqual(preview.plannedFolders);
    expect(first.createdStandaloneItems).toEqual(
      preview.plannedStandaloneItems,
    );
    expect(first.createdScenes).toEqual(preview.plannedScenes);
    expect(first.createdWorldDocuments).toEqual(preview.plannedWorldDocuments);
    expect(repeatPreview).toMatchObject({
      idempotentFolderSkips: ["ItemFolder000001"],
      idempotentSceneSkips: ["SceneFixture001"],
      idempotentStandaloneItemSkips: ["StandaloneItem01"],
      idempotentWorldDocumentSkips: ["JournalEntry.JournalFixture01"],
      status: "ready",
      targetWrites: 0,
    });
    expect(repeat).toMatchObject({ status: "complete", targetWrites: 0 });
    expect(
      fixture.stores.items.get("StandaloneItem01")?.toObject(),
    ).toMatchObject({
      _id: "StandaloneItem01",
      flags: {
        "d6-system-2e": { preservedExtension: "opaque" },
        "legacy-module": { preserved: true },
      },
      ownership: { default: 0, PlayerFixture001: 3 },
      system: { unknownLegacyField: "preserved" },
    });
    expect(
      fixture.stores.scenes.get("SceneFixture001")?.toObject?.(),
    ).toMatchObject({
      _id: "SceneFixture001",
      unknownLegacyField: { preserved: true },
    });
    expect(
      fixture.stores.worldDocuments
        .get("JournalEntry.JournalFixture01")
        ?.toObject(),
    ).toMatchObject({
      _id: "JournalFixture01",
      ownership: { default: 0, PlayerFixture001: 2 },
      unknownLegacyField: "preserved",
    });
  });

  it("blocks duplicates, missing parents, and unrelated collisions before the first write", async () => {
    const fixture = repositoryFixture();
    fixture.stores.items.set("StandaloneItem01", {
      id: "StandaloneItem01",
      toObject: () => ({
        _id: "StandaloneItem01",
        flags: flags("Item.SomeoneElse"),
      }),
    } as unknown as FoundryItemDocument);
    const brokenPlan: D6LegacyWorldDocumentWritePlanV1 = {
      actors: [],
      folders: [
        folder("ChildFolder00001", "Item", "MissingFolder001"),
        folder("ChildFolder00001", "Item", "MissingFolder001"),
      ],
      scenes: [sceneSource(), sceneSource()],
      standaloneItems: [item(), item()],
    };
    const preview = previewLegacyWorldDocuments(brokenPlan, fixture.repository);
    const report = await writeLegacyWorldDocuments(
      brokenPlan,
      fixture.repository,
    );
    expect(preview.status).toBe("blocked");
    expect(preview.conflicts).toEqual(
      expect.arrayContaining([
        "duplicate-folder-id",
        "duplicate-scene-id",
        "duplicate-standalone-item-id",
        "Missing parent Folder MissingFolder001.",
        "missing-document-folder:Item.StandaloneItem01:ItemFolder000001",
        "standalone-item:StandaloneItem01-id-conflict",
      ]),
    );
    expect(report).toMatchObject({ status: "failed", targetWrites: 0 });
    expect(fixture.repository.createFolder).not.toHaveBeenCalled();
    expect(fixture.repository.createStandaloneItem).not.toHaveBeenCalled();
    expect(fixture.repository.createScene).not.toHaveBeenCalled();
  });

  it("distinguishes changed fingerprints and source versions", async () => {
    const fixture = repositoryFixture();
    const importPlan: D6LegacyWorldDocumentWritePlanV1 = {
      actors: [],
      folders: [folder("ItemFolder000001", "Item")],
      standaloneItems: [item()],
    };
    await writeLegacyWorldDocuments(importPlan, fixture.repository);
    const changedFingerprint = previewLegacyWorldDocuments(
      { ...importPlan, standaloneItems: [{ ...item(), name: "Changed" }] },
      fixture.repository,
    );
    const changedVersion = previewLegacyWorldDocuments(
      {
        ...importPlan,
        standaloneItems: [
          { ...item(), flags: flags("Item.StandaloneItem01", "1.0.8") },
        ],
      },
      fixture.repository,
    );
    expect(changedFingerprint.conflicts).toContain(
      "standalone-item:StandaloneItem01-fingerprint-conflict",
    );
    expect(changedVersion.conflicts).toContain(
      "standalone-item:StandaloneItem01-source-version-conflict",
    );
  });

  it.each(["folder", "item", "actor", "scene", "world"] as const)(
    "rolls back all earlier phases when the %s phase fails",
    async (phase) => {
      const fixture = repositoryFixture();
      const createdActor = actorDocument("ActorFixture001");
      const importPlan: D6LegacyWorldDocumentWritePlanV1 = {
        actors: [actorPlan()],
        folders: [
          folder("ItemFolder000001", "Item"),
          folder("ItemFolder000002", "Item"),
        ],
        scenes: [
          sceneSource("SceneFixture001"),
          sceneSource("SceneFixture002"),
        ],
        standaloneItems: [item("StandaloneItem01"), item("StandaloneItem02")],
        worldDocuments: [
          {
            documentType: "JournalEntry",
            source: worldSource("JournalEntry", "JournalFixture01"),
          },
          {
            documentType: "RollTable",
            source: worldSource("RollTable", "TableFixture0001"),
          },
        ],
      };
      if (phase === "folder")
        vi.mocked(fixture.repository.createFolder)
          .mockResolvedValueOnce({
            delete: vi.fn(() => Promise.resolve()),
            id: "ItemFolder000001",
            toObject: vi.fn(),
          })
          .mockRejectedValueOnce(new Error("fixture folder failure"));
      if (phase === "item")
        vi.mocked(fixture.repository.createStandaloneItem)
          .mockImplementationOnce((source) =>
            Promise.resolve({
              delete: vi.fn(() => Promise.resolve()),
              id: String(source._id),
            } as unknown as FoundryItemDocument),
          )
          .mockRejectedValueOnce(new Error("fixture item failure"));
      if (phase === "actor")
        vi.mocked(
          executeLegacyExtraordinaryPowerActorWrite,
        ).mockResolvedValueOnce({
          createdActors: [],
          report: actorReport({
            rolledBackActors: ["ActorFixture001"],
            status: "failed",
            targetWrites: 2,
            unresolved: ["write-failed:fixture actor failure"],
          }),
        });
      if (phase === "scene" || phase === "world")
        vi.mocked(
          executeLegacyExtraordinaryPowerActorWrite,
        ).mockResolvedValueOnce({
          createdActors: [createdActor],
          report: actorReport({
            createdActors: [createdActor.id],
            createdItems: 1,
            targetWrites: 2,
          }),
        });
      if (phase === "scene")
        vi.mocked(fixture.repository.createScene)
          .mockImplementationOnce((source) =>
            Promise.resolve({
              delete: vi.fn(() => Promise.resolve()),
              id: String(source._id),
            } as unknown as FoundrySceneDocument),
          )
          .mockRejectedValueOnce(new Error("fixture scene failure"));
      if (phase === "world")
        vi.mocked(fixture.repository.createWorldDocument)
          .mockImplementationOnce((_type, source) =>
            Promise.resolve({
              delete: vi.fn(() => Promise.resolve()),
              id: String(source._id),
              toObject: vi.fn(),
            }),
          )
          .mockRejectedValueOnce(new Error("fixture world failure"));
      const report = await writeLegacyWorldDocuments(
        importPlan,
        fixture.repository,
      );
      expect(report.status).toBe("failed");
      if (phase === "folder")
        expect(report.rolledBackFolders).toEqual(["ItemFolder000001"]);
      else
        expect(report.rolledBackFolders).toEqual([
          "ItemFolder000002",
          "ItemFolder000001",
        ]);
      if (phase === "item")
        expect(report.rolledBackStandaloneItems).toEqual(["StandaloneItem01"]);
      if (["actor", "scene", "world"].includes(phase))
        expect(report.rolledBackStandaloneItems).toEqual([
          "StandaloneItem02",
          "StandaloneItem01",
        ]);
      if (phase === "scene")
        expect(report.rolledBackScenes).toEqual(["SceneFixture001"]);
      if (phase === "scene" || phase === "world")
        expect(report.actorReport.rolledBackActors).toContain(
          "ActorFixture001",
        );
      if (phase === "world")
        expect(report.rolledBackScenes).toEqual([
          "SceneFixture002",
          "SceneFixture001",
        ]);
      if (phase === "world")
        expect(report.rolledBackWorldDocuments).toEqual([
          "JournalEntry.JournalFixture01",
        ]);
    },
  );

  it("preserves the write failure and aggregates rollback deletion failures", async () => {
    const fixture = repositoryFixture();
    const deletion = vi.fn(() =>
      Promise.reject(new Error("actor delete failed")),
    );
    const createdActor = actorDocument("ActorFixture001", deletion);
    vi.mocked(executeLegacyExtraordinaryPowerActorWrite).mockResolvedValueOnce({
      createdActors: [createdActor],
      report: actorReport({
        createdActors: [createdActor.id],
        createdItems: 1,
        targetWrites: 2,
      }),
    });
    vi.mocked(fixture.repository.createScene).mockRejectedValueOnce(
      new Error("original scene failure"),
    );
    const report = await writeLegacyWorldDocuments(
      {
        actors: [actorPlan()],
        folders: [],
        scenes: [sceneSource()],
        standaloneItems: [],
      },
      fixture.repository,
    );
    expect(report.unresolved[0]).toBe("write-failed:original scene failure");
    expect(report.rollbackFailures).toEqual([
      "rollback-failed:Actor.ActorFixture001:actor delete failed",
    ]);
    expect(report.unresolved).toContain(report.rollbackFailures[0]);
    expect(report.actorReport.createdActors).toEqual(["ActorFixture001"]);
  });

  it("rejects non-GMs and ignores report-only inputs outside the public plan", async () => {
    const fixture = repositoryFixture();
    vi.stubGlobal("game", { user: { isGM: false } });
    expect(() =>
      previewLegacyWorldDocuments(completePlan(), fixture.repository),
    ).toThrow("Only a GM");
    await expect(
      writeLegacyWorldDocuments(completePlan(), fixture.repository),
    ).rejects.toThrow("Only a GM");

    vi.stubGlobal("game", { user: { isGM: true } });
    const quarantined = {
      actors: [],
      activeEffects: [{ _id: "EffectFixture001" }],
      folders: [],
      quarantinedMacros: [{ _id: "MacroFixture001" }],
      settings: [{ key: "fixture", value: true }],
      standaloneItems: [],
    } as unknown as D6LegacyWorldDocumentWritePlanV1;
    const preview = previewLegacyWorldDocuments(
      quarantined,
      fixture.repository,
    );
    const report = await writeLegacyWorldDocuments(
      quarantined,
      fixture.repository,
    );
    expect(preview).toMatchObject({ status: "ready", targetWrites: 0 });
    expect(report).toMatchObject({ status: "complete", targetWrites: 0 });
    expect(fixture.repository.createWorldDocument).not.toHaveBeenCalled();
  });
});
