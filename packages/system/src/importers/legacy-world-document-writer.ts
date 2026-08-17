import type {
  D6LegacyExtraordinaryPowerWriteReportV1,
  D6LegacyFolderSourceV1,
  D6LegacyWorldDocumentPreviewV1,
  D6LegacyWorldDocumentWritePlanV1,
  D6LegacyWorldDocumentWriteReportV1,
  ItemSource,
} from "@d6-system-2e/core";
import {
  executeLegacyExtraordinaryPowerActorWrite,
  preflightLegacyExtraordinaryPowerActors,
  type LegacyExtraordinaryPowerWriteRepository,
} from "./legacy-extraordinary-power-writer";
import {
  legacyImportIntegrityConflict,
  legacyImportProvenance,
  legacyImportSourceFingerprint,
  withLegacyImportIntegrity,
} from "./legacy-import-integrity";

type JsonRecord = Record<string, unknown>;
type WorldDocumentType =
  "Cards" | "JournalEntry" | "Macro" | "Playlist" | "RollTable";

export interface LegacyWorldDocumentWriteRepository extends LegacyExtraordinaryPowerWriteRepository {
  readonly createFolder: (
    source: D6LegacyFolderSourceV1,
  ) => Promise<FoundryFolderDocument>;
  readonly createScene: (
    source: Readonly<JsonRecord>,
  ) => Promise<FoundrySceneDocument>;
  readonly createStandaloneItem: (
    source: ItemSource,
  ) => Promise<FoundryItemDocument>;
  readonly existingFolder: (id: string) => FoundryFolderDocument | undefined;
  readonly existingScene: (id: string) => FoundrySceneDocument | undefined;
  readonly existingStandaloneItem: (
    id: string,
  ) => FoundryItemDocument | undefined;
  readonly createWorldDocument: (
    documentType: WorldDocumentType,
    source: Readonly<JsonRecord>,
  ) => Promise<FoundryWorldDocument>;
  readonly existingWorldDocument: (
    documentType: WorldDocumentType,
    id: string,
  ) => FoundryWorldDocument | undefined;
}

function requiredId(source: Readonly<JsonRecord>, kind: string): string {
  if (typeof source._id !== "string" || source._id.length === 0)
    throw new TypeError(`Every ${kind} write requires a preserved _id.`);
  return source._id;
}

function itemId(item: ItemSource): string {
  return requiredId(item, "standalone Item");
}

function sceneId(scene: Readonly<JsonRecord>): string {
  return requiredId(scene, "Scene");
}

function worldDocumentId(source: Readonly<JsonRecord>): string {
  return requiredId(source, "world-document");
}

function actorId(
  actor: D6LegacyWorldDocumentWritePlanV1["actors"][number],
): string {
  return requiredId(actor.actor, "Actor");
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
    if (parent.type !== folder.type)
      throw new TypeError(
        `Folder parent type mismatch at ${folder._id}:${parent.type}.`,
      );
    depth += 1;
    current = parent.folder;
  }
  return depth;
}

function documentFolderConflict(
  source: object,
  expectedType: string,
  label: string,
  folders: ReadonlyMap<string, D6LegacyFolderSourceV1>,
  repository: LegacyWorldDocumentWriteRepository,
): string | undefined {
  const folder = (source as { readonly folder?: unknown }).folder;
  if (folder === undefined || folder === null || folder === "")
    return undefined;
  if (typeof folder !== "string") return `invalid-document-folder:${label}`;
  const planned = folders.get(folder);
  const existing = repository.existingFolder(folder);
  if (!planned && !existing)
    return `missing-document-folder:${label}:${folder}`;
  const actualType =
    planned?.type ??
    (existing?.toObject() as { readonly type?: unknown } | undefined)?.type;
  return actualType === expectedType
    ? undefined
    : `document-folder-type-conflict:${label}:${folder}:${String(actualType)}`;
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
    rollbackFailures: Object.freeze([]),
    status,
    targetWrites: 0,
    unresolved: Object.freeze([...unresolved]),
  });
}

function defaultRepository(): LegacyWorldDocumentWriteRepository {
  const repository: LegacyWorldDocumentWriteRepository = {
    createActor: async (source) => {
      const created = await Actor.create(source, { keepId: true });
      if (!created)
        throw new Error("Foundry did not return the created Actor.");
      return created;
    },
    createFolder: async (source) => {
      const created = await Folder.create({ ...source }, { keepId: true });
      if (!created)
        throw new Error("Foundry did not return the created Folder.");
      return created;
    },
    createScene: async (source) => {
      const created = await Scene.create({ ...source }, { keepId: true });
      if (!created)
        throw new Error("Foundry did not return the created Scene.");
      return created;
    },
    createStandaloneItem: async (source) => {
      const created = await Item.create(source, {
        d6System2eMigration: true,
        keepId: true,
      });
      if (!created) throw new Error("Foundry did not return the created Item.");
      return created;
    },
    existingActor: (id) => game.actors?.get(id),
    existingFolder: (id) => game.folders?.get(id),
    existingScene: (id) => game.scenes?.get(id),
    existingStandaloneItem: (id) => game.items?.get(id),
    createWorldDocument: async (documentType, source) => {
      const constructors = { Cards, JournalEntry, Macro, Playlist, RollTable };
      const created = await constructors[documentType].create(
        { ...source },
        { keepId: true },
      );
      if (!created)
        throw new Error(`Foundry did not return the created ${documentType}.`);
      return created;
    },
    existingWorldDocument: (documentType, id) => {
      const collections = {
        Cards: game.cards,
        JournalEntry: game.journal,
        Macro: game.macros,
        Playlist: game.playlists,
        RollTable: game.tables,
      };
      return collections[documentType]?.get(id);
    },
  };
  return Object.freeze(repository);
}

function integrityConflict(
  existing: { toObject?(): unknown },
  source: object,
  expectedUuid: string,
  label: string,
): string | undefined {
  const sourceVersion = legacyImportProvenance(source).sourceVersion;
  if (!sourceVersion) return `missing-source-version:${label}`;
  const conflict = legacyImportIntegrityConflict(existing.toObject?.() ?? {}, {
    fingerprint: legacyImportSourceFingerprint(source),
    sourceUuid: expectedUuid,
    sourceVersion,
  });
  if (!conflict) return undefined;
  return conflict === "source-uuid"
    ? `${label}-id-conflict`
    : `${label}-${conflict}-conflict`;
}

function plannedSource<T extends object>(source: T): T {
  return withLegacyImportIntegrity(
    source,
    legacyImportSourceFingerprint(source),
  );
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

export function previewLegacyWorldDocuments(
  plan: D6LegacyWorldDocumentWritePlanV1,
  repository: LegacyWorldDocumentWriteRepository = defaultRepository(),
): D6LegacyWorldDocumentPreviewV1 {
  if (game.user?.isGM !== true)
    throw new Error("Only a GM may preview a legacy world-document import.");

  const conflicts = [...(plan.unresolved ?? [])];
  const idempotentFolderSkips: string[] = [];
  const idempotentStandaloneItemSkips: string[] = [];
  const idempotentSceneSkips: string[] = [];
  const idempotentWorldDocumentSkips: string[] = [];
  const plannedFolders: string[] = [];
  const plannedStandaloneItems: string[] = [];
  const plannedScenes: string[] = [];
  const plannedWorldDocuments: string[] = [];
  const folderMap = new Map(plan.folders.map((folder) => [folder._id, folder]));
  const scenes = plan.scenes ?? [];
  const worldDocuments = plan.worldDocuments ?? [];

  if (folderMap.size !== plan.folders.length)
    conflicts.push("duplicate-folder-id");
  try {
    const itemIds = plan.standaloneItems.map(itemId);
    if (new Set(itemIds).size !== itemIds.length)
      conflicts.push("duplicate-standalone-item-id");
    const sceneIds = scenes.map(sceneId);
    if (new Set(sceneIds).size !== sceneIds.length)
      conflicts.push("duplicate-scene-id");
    const worldDocumentKeys = worldDocuments.map(
      ({ documentType, source }) =>
        `${documentType}.${worldDocumentId(source)}`,
    );
    if (new Set(worldDocumentKeys).size !== worldDocumentKeys.length)
      conflicts.push("duplicate-world-document-id");
  } catch (error) {
    conflicts.push(error instanceof Error ? error.message : String(error));
  }

  for (const folder of plan.folders) {
    if (
      ![
        "Actor",
        "Cards",
        "Item",
        "JournalEntry",
        "Macro",
        "Playlist",
        "RollTable",
        "Scene",
      ].includes(folder.type)
    )
      conflicts.push(`unsupported-folder-type:${folder._id}:${folder.type}`);
    try {
      folderDepth(folder, folderMap);
    } catch (error) {
      conflicts.push(error instanceof Error ? error.message : String(error));
    }
    const existing = repository.existingFolder(folder._id);
    if (!existing) plannedFolders.push(folder._id);
    else {
      const conflict = integrityConflict(
        existing,
        folder,
        `Folder.${folder._id}`,
        `folder:${folder._id}`,
      );
      if (conflict) conflicts.push(conflict);
      else idempotentFolderSkips.push(folder._id);
    }
  }

  for (const item of plan.standaloneItems) {
    let id: string;
    try {
      id = itemId(item);
    } catch (error) {
      conflicts.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    const folderConflict = documentFolderConflict(
      item,
      "Item",
      `Item.${id}`,
      folderMap,
      repository,
    );
    if (folderConflict) conflicts.push(folderConflict);
    const existing = repository.existingStandaloneItem(id);
    if (!existing) plannedStandaloneItems.push(id);
    else {
      const conflict = integrityConflict(
        existing,
        item,
        `Item.${id}`,
        `standalone-item:${id}`,
      );
      if (conflict) conflicts.push(conflict);
      else idempotentStandaloneItemSkips.push(id);
    }
  }

  for (const scene of scenes) {
    let id: string;
    try {
      id = sceneId(scene);
    } catch (error) {
      conflicts.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    const folderConflict = documentFolderConflict(
      scene,
      "Scene",
      `Scene.${id}`,
      folderMap,
      repository,
    );
    if (folderConflict) conflicts.push(folderConflict);
    const existing = repository.existingScene(id);
    if (!existing) plannedScenes.push(id);
    else {
      const conflict = integrityConflict(
        existing,
        scene,
        `Scene.${id}`,
        `scene:${id}`,
      );
      if (conflict) conflicts.push(conflict);
      else idempotentSceneSkips.push(id);
    }
  }

  for (const { documentType, source } of worldDocuments) {
    let id: string;
    try {
      id = worldDocumentId(source);
    } catch (error) {
      conflicts.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    const key = `${documentType}.${id}`;
    const folderConflict = documentFolderConflict(
      source,
      documentType,
      key,
      folderMap,
      repository,
    );
    if (folderConflict) conflicts.push(folderConflict);
    const existing = repository.existingWorldDocument(documentType, id);
    if (!existing) plannedWorldDocuments.push(key);
    else {
      const conflict = integrityConflict(
        existing,
        source,
        key,
        `world-document:${key}`,
      );
      if (conflict) conflicts.push(conflict);
      else idempotentWorldDocumentSkips.push(key);
    }
  }

  let actorPreflight: ReturnType<
    typeof preflightLegacyExtraordinaryPowerActors
  > = { idempotentSkips: [], unresolved: [] };
  try {
    actorPreflight = preflightLegacyExtraordinaryPowerActors(
      plan.actors,
      repository,
    );
    conflicts.push(...actorPreflight.unresolved);
  } catch (error) {
    conflicts.push(error instanceof Error ? error.message : String(error));
  }
  for (const actor of plan.actors) {
    let id: string;
    try {
      id = actorId(actor);
    } catch {
      continue;
    }
    const folderConflict = documentFolderConflict(
      actor.actor,
      "Actor",
      `Actor.${id}`,
      folderMap,
      repository,
    );
    if (folderConflict) conflicts.push(folderConflict);
  }
  const skippedActorIds = new Set(actorPreflight.idempotentSkips);
  const actorIds: string[] = [];
  for (const actor of plan.actors) {
    try {
      actorIds.push(actorId(actor));
    } catch (error) {
      conflicts.push(error instanceof Error ? error.message : String(error));
    }
  }
  const plannedActors = actorIds
    .filter((id) => !skippedActorIds.has(id))
    .sort();
  const plannedActorIds = new Set(plannedActors);
  const plannedEmbeddedItems = plan.actors
    .filter((actor) => {
      try {
        return plannedActorIds.has(actorId(actor));
      } catch {
        return false;
      }
    })
    .reduce((total, actor) => total + actor.items.length, 0);
  const exactConflicts = sortedUnique(conflicts);
  return Object.freeze({
    conflicts: exactConflicts,
    format: "d6-system-2e.legacy-world-document-preview.v1",
    idempotentActorSkips: sortedUnique(actorPreflight.idempotentSkips),
    idempotentFolderSkips: sortedUnique(idempotentFolderSkips),
    idempotentSceneSkips: sortedUnique(idempotentSceneSkips),
    idempotentStandaloneItemSkips: sortedUnique(idempotentStandaloneItemSkips),
    idempotentWorldDocumentSkips: sortedUnique(idempotentWorldDocumentSkips),
    plannedActors: Object.freeze(plannedActors),
    plannedEmbeddedItems,
    plannedFolders: sortedUnique(plannedFolders),
    plannedScenes: sortedUnique(plannedScenes),
    plannedStandaloneItems: sortedUnique(plannedStandaloneItems),
    plannedWorldDocuments: sortedUnique(plannedWorldDocuments),
    status: exactConflicts.length === 0 ? "ready" : "blocked",
    targetWrites: 0,
    warnings: sortedUnique(plan.warnings ?? []),
  });
}

async function rollbackDocument(
  kind: string,
  id: string,
  remove: () => Promise<unknown>,
  rolledBack: string[],
  failures: string[],
  reportId = id,
): Promise<void> {
  try {
    await remove();
    rolledBack.push(reportId);
  } catch (error) {
    failures.push(
      `rollback-failed:${kind}.${id}:${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function writeLegacyWorldDocuments(
  plan: D6LegacyWorldDocumentWritePlanV1,
  repository: LegacyWorldDocumentWriteRepository = defaultRepository(),
): Promise<D6LegacyWorldDocumentWriteReportV1> {
  if (game.user?.isGM !== true)
    throw new Error("Only a GM may run a legacy world-document import.");
  const preview = previewLegacyWorldDocuments(plan, repository);
  if (preview.status === "blocked") {
    return Object.freeze({
      actorReport: emptyActorReport("failed", preview.conflicts),
      createdFolders: Object.freeze([]),
      createdScenes: Object.freeze([]),
      createdStandaloneItems: Object.freeze([]),
      createdWorldDocuments: Object.freeze([]),
      format: "d6-system-2e.legacy-world-document-write.v1",
      idempotentFolderSkips: preview.idempotentFolderSkips,
      idempotentSceneSkips: preview.idempotentSceneSkips,
      idempotentStandaloneItemSkips: preview.idempotentStandaloneItemSkips,
      idempotentWorldDocumentSkips: preview.idempotentWorldDocumentSkips,
      rolledBackFolders: Object.freeze([]),
      rolledBackScenes: Object.freeze([]),
      rolledBackStandaloneItems: Object.freeze([]),
      rolledBackWorldDocuments: Object.freeze([]),
      rollbackFailures: Object.freeze([]),
      status: "failed",
      targetWrites: 0,
      unresolved: preview.conflicts,
      warnings: preview.warnings,
    });
  }

  const folderMap = new Map(plan.folders.map((folder) => [folder._id, folder]));
  const createdFolders: FoundryFolderDocument[] = [];
  const createdItems: FoundryItemDocument[] = [];
  const createdActors: FoundryActorDocument[] = [];
  const createdScenes: FoundrySceneDocument[] = [];
  const createdWorldDocuments: {
    readonly document: FoundryWorldDocument;
    readonly documentType: WorldDocumentType;
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
      const created = await repository.createFolder(plannedSource(folder));
      if (created.id !== folder._id)
        throw new Error(`Folder ID ${folder._id} was not preserved.`);
      createdFolders.push(created);
    }
    for (const item of [...plan.standaloneItems].sort((left, right) =>
      itemId(left).localeCompare(itemId(right)),
    )) {
      if (repository.existingStandaloneItem(itemId(item))) continue;
      const created = await repository.createStandaloneItem(
        plannedSource(item),
      );
      if (created.id !== itemId(item))
        throw new Error(`Item ID ${itemId(item)} was not preserved.`);
      createdItems.push(created);
    }
    const actorTransaction = await executeLegacyExtraordinaryPowerActorWrite(
      plan.actors,
      repository,
    );
    actorReport = actorTransaction.report;
    createdActors.push(...actorTransaction.createdActors);
    if (actorReport.status !== "complete")
      throw new Error(
        actorReport.unresolved.join("; ") || "Actor import failed.",
      );
    for (const scene of [...(plan.scenes ?? [])].sort((left, right) =>
      sceneId(left).localeCompare(sceneId(right)),
    )) {
      const id = sceneId(scene);
      if (repository.existingScene(id)) continue;
      const created = await repository.createScene(plannedSource(scene));
      if (created.id !== id)
        throw new Error(`Scene ID ${id} was not preserved.`);
      createdScenes.push(created);
    }
    for (const { documentType, source } of [
      ...(plan.worldDocuments ?? []),
    ].sort((left, right) =>
      `${left.documentType}.${worldDocumentId(left.source)}`.localeCompare(
        `${right.documentType}.${worldDocumentId(right.source)}`,
      ),
    )) {
      const id = worldDocumentId(source);
      if (repository.existingWorldDocument(documentType, id)) continue;
      const document = await repository.createWorldDocument(
        documentType,
        plannedSource(source),
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
      idempotentFolderSkips: preview.idempotentFolderSkips,
      idempotentSceneSkips: preview.idempotentSceneSkips,
      idempotentStandaloneItemSkips: preview.idempotentStandaloneItemSkips,
      idempotentWorldDocumentSkips: preview.idempotentWorldDocumentSkips,
      rolledBackFolders: Object.freeze([]),
      rolledBackScenes: Object.freeze([]),
      rolledBackStandaloneItems: Object.freeze([]),
      rolledBackWorldDocuments: Object.freeze([]),
      rollbackFailures: Object.freeze([]),
      status: "complete",
      targetWrites:
        createdFolders.length +
        createdItems.length +
        createdScenes.length +
        createdWorldDocuments.length +
        actorReport.targetWrites,
      unresolved: Object.freeze([]),
      warnings: preview.warnings,
    });
  } catch (error) {
    const rolledBackItems: string[] = [];
    const rolledBackFolders: string[] = [];
    const rolledBackActors: string[] = [];
    const rolledBackScenes: string[] = [];
    const rolledBackWorldDocuments: string[] = [];
    const rollbackFailures = [...actorReport.rollbackFailures];
    for (const { document, documentType } of [
      ...createdWorldDocuments,
    ].reverse())
      await rollbackDocument(
        documentType,
        document.id,
        () => document.delete(),
        rolledBackWorldDocuments,
        rollbackFailures,
        `${documentType}.${document.id}`,
      );
    for (const scene of [...createdScenes].reverse())
      await rollbackDocument(
        "Scene",
        scene.id,
        () => {
          if (!scene.delete)
            throw new Error("Foundry Scene deletion is unavailable.");
          return scene.delete();
        },
        rolledBackScenes,
        rollbackFailures,
      );
    for (const actor of [...createdActors].reverse())
      await rollbackDocument(
        "Actor",
        actor.id,
        () => actor.delete(),
        rolledBackActors,
        rollbackFailures,
      );
    for (const item of [...createdItems].reverse())
      await rollbackDocument(
        "Item",
        item.id,
        () => {
          if (!item.delete)
            throw new Error("Foundry Item deletion is unavailable.");
          return item.delete();
        },
        rolledBackItems,
        rollbackFailures,
      );
    for (const folder of [...createdFolders].reverse())
      await rollbackDocument(
        "Folder",
        folder.id,
        () => folder.delete(),
        rolledBackFolders,
        rollbackFailures,
      );
    const failure = `write-failed:${error instanceof Error ? error.message : String(error)}`;
    const allRolledBackActors = unique([
      ...actorReport.rolledBackActors,
      ...rolledBackActors,
    ]);
    const remainingActorIds = createdActors
      .map(({ id }) => id)
      .filter((id) => !rolledBackActors.includes(id));
    const remainingItemIds = createdItems
      .map(({ id }) => id)
      .filter((id) => !rolledBackItems.includes(id));
    const remainingFolderIds = createdFolders
      .map(({ id }) => id)
      .filter((id) => !rolledBackFolders.includes(id));
    const remainingSceneIds = createdScenes
      .map(({ id }) => id)
      .filter((id) => !rolledBackScenes.includes(id));
    const remainingWorldDocumentIds = createdWorldDocuments
      .map(({ document, documentType }) => `${documentType}.${document.id}`)
      .filter((id) => !rolledBackWorldDocuments.includes(id));
    const remainingEmbeddedItems = plan.actors
      .filter((actor) => remainingActorIds.includes(actorId(actor)))
      .reduce((total, actor) => total + actor.items.length, 0);
    actorReport = Object.freeze({
      ...actorReport,
      createdActors: Object.freeze(remainingActorIds),
      createdItems: remainingEmbeddedItems,
      rolledBackActors: allRolledBackActors,
      rollbackFailures: unique(rollbackFailures),
      status: "failed",
      targetWrites: actorReport.targetWrites + rolledBackActors.length,
      unresolved: unique([
        ...actorReport.unresolved,
        failure,
        ...rollbackFailures,
      ]),
    });
    return Object.freeze({
      actorReport,
      createdFolders: Object.freeze(remainingFolderIds),
      createdScenes: Object.freeze(remainingSceneIds),
      createdStandaloneItems: Object.freeze(remainingItemIds),
      createdWorldDocuments: Object.freeze(remainingWorldDocumentIds),
      format: "d6-system-2e.legacy-world-document-write.v1",
      idempotentFolderSkips: preview.idempotentFolderSkips,
      idempotentSceneSkips: preview.idempotentSceneSkips,
      idempotentStandaloneItemSkips: preview.idempotentStandaloneItemSkips,
      idempotentWorldDocumentSkips: preview.idempotentWorldDocumentSkips,
      rolledBackFolders: Object.freeze(rolledBackFolders),
      rolledBackScenes: Object.freeze(rolledBackScenes),
      rolledBackStandaloneItems: Object.freeze(rolledBackItems),
      rolledBackWorldDocuments: Object.freeze(rolledBackWorldDocuments),
      rollbackFailures: unique(rollbackFailures),
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
      unresolved: actorReport.unresolved,
      warnings: preview.warnings,
    });
  }
}
