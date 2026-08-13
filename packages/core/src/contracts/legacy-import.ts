import type { ActorSource, ItemSource } from "../migrations/migration";

export interface D6LegacyExtraordinaryPowerActorWritePlanV1 {
  readonly actor: ActorSource;
  readonly items: readonly ItemSource[];
  readonly unresolved?: readonly string[];
  readonly source: Readonly<{
    readonly frameworkId?: string;
    readonly system: "od6s" | "od6s-next";
    readonly uuid: string;
    readonly version: string;
  }>;
}

export interface D6LegacyExtraordinaryPowerWriteReportV1 {
  readonly createdActors: readonly string[];
  readonly createdItems: number;
  readonly format: "d6-system-2e.legacy-extraordinary-power-write.v1";
  readonly idempotentSkips: readonly string[];
  readonly rolledBackActors: readonly string[];
  readonly status: "complete" | "failed";
  readonly targetWrites: number;
  readonly unresolved: readonly string[];
}

export interface D6LegacyFolderSourceV1 {
  readonly _id: string;
  readonly flags: Readonly<Record<string, unknown>>;
  readonly folder: string | null;
  readonly name: string;
  readonly sort: number;
  readonly sorting: string;
  readonly type: string;
}

export interface D6LegacyWorldDocumentWritePlanV1 {
  readonly actors: readonly D6LegacyExtraordinaryPowerActorWritePlanV1[];
  readonly folders: readonly D6LegacyFolderSourceV1[];
  readonly scenes?: readonly Readonly<Record<string, unknown>>[];
  readonly standaloneItems: readonly ItemSource[];
  readonly worldDocuments?: readonly Readonly<{
    readonly documentType:
      "Cards" | "JournalEntry" | "Macro" | "Playlist" | "RollTable";
    readonly source: Readonly<Record<string, unknown>>;
  }>[];
  readonly unresolved?: readonly string[];
  readonly warnings?: readonly string[];
}

export interface D6LegacyWorldDocumentWriteReportV1 {
  readonly actorReport: D6LegacyExtraordinaryPowerWriteReportV1;
  readonly createdFolders: readonly string[];
  readonly createdScenes: readonly string[];
  readonly createdStandaloneItems: readonly string[];
  readonly createdWorldDocuments: readonly string[];
  readonly format: "d6-system-2e.legacy-world-document-write.v1";
  readonly idempotentFolderSkips: readonly string[];
  readonly idempotentSceneSkips: readonly string[];
  readonly idempotentStandaloneItemSkips: readonly string[];
  readonly idempotentWorldDocumentSkips: readonly string[];
  readonly rolledBackFolders: readonly string[];
  readonly rolledBackScenes: readonly string[];
  readonly rolledBackStandaloneItems: readonly string[];
  readonly rolledBackWorldDocuments: readonly string[];
  readonly status: "complete" | "failed";
  readonly targetWrites: number;
  readonly unresolved: readonly string[];
  readonly warnings: readonly string[];
}
