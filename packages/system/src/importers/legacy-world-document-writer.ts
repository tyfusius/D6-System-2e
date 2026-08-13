import type {
  D6LegacyExtraordinaryPowerWriteReportV1,
  D6LegacyFolderSourceV1,
  D6LegacyWorldDocumentWritePlanV1,
  D6LegacyWorldDocumentWriteReportV1,
  ItemSource,
} from "@d6-system-2e/core";
import {
  preflightLegacyExtraordinaryPowerActors,
  writeLegacyExtraordinaryPowerActors,
} from "./legacy-extraordinary-power-writer";

export interface LegacyWorldDocumentWriteRepository {
  createFolder(source: D6LegacyFolderSourceV1): Promise<FoundryFolderDocument>;
  createScene(
    source: Readonly<Record<string, unknown>>,
  ): Promise<FoundrySceneDocument>;
  createStandaloneItem(source: ItemSource): Promise<FoundryItemDocument>;
  existingFolder(id: string): FoundryFolderDocument | undefined;
  existingScene(id: string): FoundrySceneDocument | undefined;
  existingStandaloneItem(id: string): FoundryItemDocument | undefined;
  createWorldDocument(
    documentType: "Cards" | "JournalEntry" | "Macro" | "Playlist" | "RollTable",
    source: Readonly<Record<string, unknown>>,
  ): Promise<FoundryWorldDocument>;
  existingWorldDocument(
    documentType: "Cards" | "JournalEntry" | "Macro" | "Playlist" | "RollTable",
    id: string,
  ): FoundryWorldDocument | undefined;
}

type JsonRecord = Record<string, unknown>;
type WorldDocumentType =
  "Cards" | "JournalEntry" | "Macro" | "Playlist" | "RollTable";

function record(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function sourceUuid(value: unknown): string | undefined {
  const result = record(
    record(record(value)?.flags)?.["d6-system-2e"],
  )?.legacyImport;
  const uuid = record(result)?.sourceUuid;
  return typeof uuid === "string" && uuid.length > 0 ? uuid : undefined;
}

function itemId(item: ItemSource): string {
  if (typeof item._id !== "string" || item._id.length === 0) {
    throw new TypeError(
      "Every standalone Item write requires a preserved _id.",
    );
  }
  return item._id;
}

function sceneId(scene: Readonly<Record<string, unknown>>): string {
  if (typeof scene._id !== "string" || scene._id.length === 0)
    throw new TypeError("Every Scene write requires a preserved _id.");
  return scene._id;
}

function worldDocumentId(source: Readonly<Record<string, unknown>>): string {
  if (typeof source._id !== "string" || source._id.length === 0)
    throw new TypeError("Every world-document write requires a preserved _id.");
  return source._id;
}

function folderDepth(
  folder: D6LegacyFolderSourceV1,
  folders: ReadonlyMap<string, D6LegacyFolderSourceV1>,
): number {
  let depth = 0;
  let current = folder.folder;
  const visited = new Set([folder._id]);
  while (current) {
    if (visited.has(current))
      throw new TypeError(`Folder cycle at ${current}.`);
    visited.add(current);
    const parent = folders.get(current);
    if (!parent) throw new TypeError(`Missing parent Folder ${current}.`);
    depth += 1;
    current = parent.folder;
  }
  return depth;
}

function emptyActorReport(
  status: "complete" | "failed",
  unresolved: readonly string[] = [],
): D6LegacyExtraordinaryPowerWriteReportV1 {
  return Object.freeze({
    createdActors: Object.freeze([]),
    createdItems: 0,
    format: "d6-system-2e.legacy-extraordinary-power-write.v1",
    idempotentSkips: Object.freeze([]),
    rolledBackActors: Object.freeze([]),
    status,
    targetWrites: 0,
    unresolved: Object.freeze([...unresolved]),
  });
}

function defaultRepository(): LegacyWorldDocumentWriteRepository {
  return Object.freeze({
    createFolder: async (source: D6LegacyFolderSourceV1) => {
      const created = await Folder.create({ ...source }, { keepId: true });
      if (!created)
        throw new Error("Foundry did not return the created Folder.");
      return created;
    },
    createScene: async (source: Readonly<Record<string, unknown>>) => {
      const created = await Scene.create({ ...source }, { keepId: true });
      if (!created)
        throw new Error("Foundry did not return the created Scene.");
      return created;
    },
    createStandaloneItem: async (source: ItemSource) => {
      const created = await Item.create(source, {
        d6System2eMigration: true,
        keepId: true,
      });
      if (!created) throw new Error("Foundry did not return the created Item.");
      return created;
    },
    existingFolder: (id: string) => game.folders?.get(id),
    existingScene: (id: string) => game.scenes?.get(id),
    existingStandaloneItem: (id: string) => game.items?.get(id),
    createWorldDocument: async (
      documentType: WorldDocumentType,
      source: Readonly<Record<string, unknown>>,
    ) => {
      const constructors = { Cards, JournalEntry, Macro, Playlist, RollTable };
      const created = await constructors[documentType].create(
        { ...source },
        { keepId: true },
      );
      if (!created)
        throw new Error(`Foundry did not return the created ${documentType}.`);
      return created;
    },
    existingWorldDocument: (documentType: WorldDocumentType, id: string) => {
      const collections = {
        Cards: game.cards,
        JournalEntry: game.journal,
        Macro: game.macros,
        Playlist: game.playlists,
        RollTable: game.tables,
      };
      return collections[documentType]?.get(id);
    },
  });
}

export async function writeLegacyWorldDocuments(
  plan: D6LegacyWorldDocumentWritePlanV1,
  repository: LegacyWorldDocumentWriteRepository = defaultRepository(),
): Promise<D6LegacyWorldDocumentWriteReportV1> {
  if (game.user?.isGM !== true) {
    throw new Error("Only a GM may run a legacy world-document import.");
  }
  const unresolved = [...(plan.unresolved ?? [])];
  unresolved.push(
    ...preflightLegacyExtraordinaryPowerActors(plan.actors).unresolved,
  );
  const folderMap = new Map(plan.folders.map((folder) => [folder._id, folder]));
  const scenes = plan.scenes ?? [];
  const worldDocuments = plan.worldDocuments ?? [];
  if (folderMap.size !== plan.folders.length)
    unresolved.push("duplicate-folder-id");
  const itemIds = plan.standaloneItems.map(itemId);
  if (new Set(itemIds).size !== itemIds.length)
    unresolved.push("duplicate-standalone-item-id");
  const sceneIds = scenes.map(sceneId);
  if (new Set(sceneIds).size !== sceneIds.length)
    unresolved.push("duplicate-scene-id");
  const worldDocumentKeys = worldDocuments.map(
    ({ documentType, source }) => `${documentType}.${worldDocumentId(source)}`,
  );
  if (new Set(worldDocumentKeys).size !== worldDocumentKeys.length)
    unresolved.push("duplicate-world-document-id");
  for (const folder of plan.folders) {
    if (
      ![
        "Actor",
        "Cards",
        "JournalEntry",
        "Macro",
        "Playlist",
        "RollTable",
        "Scene",
      ].includes(folder.type)
    )
      unresolved.push(`unsupported-folder-type:${folder._id}:${folder.type}`);
    try {
      folderDepth(folder, folderMap);
    } catch (error) {
      unresolved.push(error instanceof Error ? error.message : String(error));
    }
  }
  const idempotentFolderSkips: string[] = [];
  const idempotentStandaloneItemSkips: string[] = [];
  const idempotentSceneSkips: string[] = [];
  const idempotentWorldDocumentSkips: string[] = [];
  for (const folder of plan.folders) {
    const existing = repository.existingFolder(folder._id);
    if (!existing) continue;
    if (sourceUuid(existing.toObject()) === `Folder.${folder._id}`)
      idempotentFolderSkips.push(folder._id);
    else unresolved.push(`folder-id-conflict:${folder._id}`);
  }
  for (const item of plan.standaloneItems) {
    const id = itemId(item);
    const existing = repository.existingStandaloneItem(id);
    if (!existing) continue;
    if (sourceUuid(existing.toObject()) === `Item.${id}`)
      idempotentStandaloneItemSkips.push(id);
    else unresolved.push(`standalone-item-id-conflict:${id}`);
  }
  for (const scene of scenes) {
    const id = sceneId(scene);
    const existing = repository.existingScene(id);
    if (!existing) continue;
    if (existing.toObject && sourceUuid(existing.toObject()) === `Scene.${id}`)
      idempotentSceneSkips.push(id);
    else unresolved.push(`scene-id-conflict:${id}`);
  }
  for (const { documentType, source } of worldDocuments) {
    const id = worldDocumentId(source);
    const existing = repository.existingWorldDocument(documentType, id);
    if (!existing) continue;
    if (sourceUuid(existing.toObject()) === `${documentType}.${id}`)
      idempotentWorldDocumentSkips.push(`${documentType}.${id}`);
    else unresolved.push(`world-document-id-conflict:${documentType}.${id}`);
  }
  if (unresolved.length > 0) {
    return Object.freeze({
      actorReport: emptyActorReport("failed", unresolved),
      createdFolders: Object.freeze([]),
      createdScenes: Object.freeze([]),
      createdStandaloneItems: Object.freeze([]),
      createdWorldDocuments: Object.freeze([]),
      format: "d6-system-2e.legacy-world-document-write.v1",
      idempotentFolderSkips: Object.freeze(idempotentFolderSkips),
      idempotentSceneSkips: Object.freeze(idempotentSceneSkips),
      idempotentStandaloneItemSkips: Object.freeze(
        idempotentStandaloneItemSkips,
      ),
      idempotentWorldDocumentSkips: Object.freeze(idempotentWorldDocumentSkips),
      rolledBackFolders: Object.freeze([]),
      rolledBackScenes: Object.freeze([]),
      rolledBackStandaloneItems: Object.freeze([]),
      rolledBackWorldDocuments: Object.freeze([]),
      status: "failed",
      targetWrites: 0,
      unresolved: Object.freeze(unresolved.sort()),
      warnings: Object.freeze([...(plan.warnings ?? [])].sort()),
    });
  }

  const createdFolders: FoundryFolderDocument[] = [];
  const createdItems: FoundryItemDocument[] = [];
  const createdScenes: FoundrySceneDocument[] = [];
  const createdWorldDocuments: {
    readonly document: FoundryWorldDocument;
    readonly documentType: string;
  }[] = [];
  let actorReport = emptyActorReport("complete");
  try {
    const orderedFolders = [...plan.folders].sort(
      (left, right) =>
        folderDepth(left, folderMap) - folderDepth(right, folderMap) ||
        left._id.localeCompare(right._id),
    );
    for (const folder of orderedFolders) {
      if (repository.existingFolder(folder._id)) continue;
      const created = await repository.createFolder(folder);
      if (created.id !== folder._id)
        throw new Error(`Folder ID ${folder._id} was not preserved.`);
      createdFolders.push(created);
    }
    for (const item of [...plan.standaloneItems].sort((left, right) =>
      itemId(left).localeCompare(itemId(right)),
    )) {
      if (repository.existingStandaloneItem(itemId(item))) continue;
      const created = await repository.createStandaloneItem(item);
      if (created.id !== itemId(item))
        throw new Error(`Item ID ${itemId(item)} was not preserved.`);
      createdItems.push(created);
    }
    actorReport = await writeLegacyExtraordinaryPowerActors(plan.actors);
    if (actorReport.status !== "complete")
      throw new Error(
        actorReport.unresolved.join("; ") || "Actor import failed.",
      );
    for (const scene of [...scenes].sort((left, right) =>
      sceneId(left).localeCompare(sceneId(right)),
    )) {
      const id = sceneId(scene);
      if (repository.existingScene(id)) continue;
      const created = await repository.createScene(scene);
      if (created.id !== id)
        throw new Error(`Scene ID ${id} was not preserved.`);
      createdScenes.push(created);
    }
    for (const { documentType, source } of [...worldDocuments].sort(
      (left, right) =>
        `${left.documentType}.${worldDocumentId(left.source)}`.localeCompare(
          `${right.documentType}.${worldDocumentId(right.source)}`,
        ),
    )) {
      const id = worldDocumentId(source);
      if (repository.existingWorldDocument(documentType, id)) continue;
      const document = await repository.createWorldDocument(
        documentType,
        source,
      );
      if (document.id !== id)
        throw new Error(`${documentType} ID ${id} was not preserved.`);
      createdWorldDocuments.push({ document, documentType });
    }
    return Object.freeze({
      actorReport,
      createdFolders: Object.freeze(createdFolders.map(({ id }) => id)),
      createdScenes: Object.freeze(createdScenes.map(({ id }) => id)),
      createdStandaloneItems: Object.freeze(createdItems.map(({ id }) => id)),
      createdWorldDocuments: Object.freeze(
        createdWorldDocuments.map(
          ({ document, documentType }) => `${documentType}.${document.id}`,
        ),
      ),
      format: "d6-system-2e.legacy-world-document-write.v1",
      idempotentFolderSkips: Object.freeze(idempotentFolderSkips),
      idempotentSceneSkips: Object.freeze(idempotentSceneSkips),
      idempotentStandaloneItemSkips: Object.freeze(
        idempotentStandaloneItemSkips,
      ),
      idempotentWorldDocumentSkips: Object.freeze(idempotentWorldDocumentSkips),
      rolledBackFolders: Object.freeze([]),
      rolledBackScenes: Object.freeze([]),
      rolledBackStandaloneItems: Object.freeze([]),
      rolledBackWorldDocuments: Object.freeze([]),
      status: "complete",
      targetWrites:
        createdFolders.length +
        createdItems.length +
        createdScenes.length +
        createdWorldDocuments.length +
        actorReport.targetWrites,
      unresolved: Object.freeze([]),
      warnings: Object.freeze([...(plan.warnings ?? [])].sort()),
    });
  } catch (error) {
    const rolledBackItems: string[] = [];
    const rolledBackFolders: string[] = [];
    const rolledBackScenes: string[] = [];
    const rolledBackWorldDocuments: string[] = [];
    for (const { document, documentType } of [
      ...createdWorldDocuments,
    ].reverse()) {
      await document.delete();
      rolledBackWorldDocuments.push(`${documentType}.${document.id}`);
    }
    for (const scene of [...createdScenes].reverse()) {
      if (!scene.delete)
        throw new Error(`Scene ${scene.id} cannot be rolled back.`);
      await scene.delete();
      rolledBackScenes.push(scene.id);
    }
    for (const item of [...createdItems].reverse()) {
      if (!item.delete)
        throw new Error(`Item ${item.id} cannot be rolled back.`);
      await item.delete();
      rolledBackItems.push(item.id);
    }
    for (const folder of [...createdFolders].reverse()) {
      await folder.delete();
      rolledBackFolders.push(folder.id);
    }
    const failure = `write-failed:${error instanceof Error ? error.message : String(error)}`;
    return Object.freeze({
      actorReport,
      createdFolders: Object.freeze([]),
      createdScenes: Object.freeze([]),
      createdStandaloneItems: Object.freeze([]),
      createdWorldDocuments: Object.freeze([]),
      format: "d6-system-2e.legacy-world-document-write.v1",
      idempotentFolderSkips: Object.freeze(idempotentFolderSkips),
      idempotentSceneSkips: Object.freeze(idempotentSceneSkips),
      idempotentStandaloneItemSkips: Object.freeze(
        idempotentStandaloneItemSkips,
      ),
      idempotentWorldDocumentSkips: Object.freeze(idempotentWorldDocumentSkips),
      rolledBackFolders: Object.freeze(rolledBackFolders),
      rolledBackScenes: Object.freeze(rolledBackScenes),
      rolledBackStandaloneItems: Object.freeze(rolledBackItems),
      rolledBackWorldDocuments: Object.freeze(rolledBackWorldDocuments),
      status: "failed",
      targetWrites:
        createdFolders.length +
        createdItems.length +
        createdScenes.length +
        createdWorldDocuments.length +
        actorReport.targetWrites +
        rolledBackFolders.length +
        rolledBackScenes.length +
        rolledBackWorldDocuments.length +
        rolledBackItems.length,
      unresolved: Object.freeze([...actorReport.unresolved, failure]),
      warnings: Object.freeze([...(plan.warnings ?? [])].sort()),
    });
  }
}
