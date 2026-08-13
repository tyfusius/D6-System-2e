import type {
  LegacyWorldExportRecord,
  LegacyWorldSource,
} from "./legacy-world-import";

export const LEGACY_DOCUMENT_ENVELOPE_FORMAT =
  "d6-system-2e.legacy-document-envelope.v6" as const;

export type LegacyReferenceFindingKind =
  | "asset-url"
  | "document-id"
  | "foundry-uuid"
  | "legacy-data-path"
  | "private-api";

export interface LegacyReferenceFinding {
  readonly kind: LegacyReferenceFindingKind;
  readonly path: string;
  readonly value: string;
}

export interface LegacyActorRecordIdentity {
  readonly actorId: string;
  readonly itemId?: string;
}

export type LegacyFolderTopologyIssue =
  "cycle" | "missing-parent" | "parent-type-mismatch" | "self-parent";

export interface LegacyFolderTopology {
  readonly documentType?: string;
  readonly issues: readonly LegacyFolderTopologyIssue[];
  readonly parentId?: string;
  readonly parentUuid?: string;
  readonly sort?: number;
  readonly sorting?: string;
  readonly status: "exact" | "unresolved";
}

export interface LegacyDocumentFolderReference {
  readonly folderId: string;
  readonly folderUuid: string;
  readonly issue?: "folder-type-mismatch" | "missing-folder";
  readonly status: "exact" | "unresolved";
}

export type LegacyActiveEffectIssue =
  | "duplicate-index"
  | "invalid-change-path"
  | "missing-index"
  | "missing-origin"
  | "missing-parent";

export interface LegacyActiveEffectEvidence {
  readonly changePaths: readonly string[];
  readonly changeSources: readonly ("changes" | "system.changes")[];
  readonly disabled?: boolean;
  readonly index?: number;
  readonly invalidChangePaths: number;
  readonly issues: readonly LegacyActiveEffectIssue[];
  readonly origin?: string;
  readonly originStatus: "absent" | "exact" | "external" | "unresolved";
  readonly statuses: readonly string[];
  readonly status: "exact" | "unresolved";
  readonly transfer?: boolean;
}

export type LegacyPlacedTokenIssue =
  | "duplicate-index"
  | "invalid-delta"
  | "missing-actor"
  | "missing-delta"
  | "missing-index"
  | "missing-parent";

export interface LegacyPlacedTokenEvidence {
  readonly actorId?: string;
  readonly actorLink?: boolean;
  readonly actorStatus: "absent" | "exact" | "unresolved";
  readonly deltaId?: string;
  readonly deltaStatus: "absent" | "exact" | "unresolved";
  readonly geometry: Readonly<{
    readonly elevation?: number;
    readonly height?: number;
    readonly width?: number;
    readonly x?: number;
    readonly y?: number;
  }>;
  readonly index?: number;
  readonly issues: readonly LegacyPlacedTokenIssue[];
  readonly status: "exact" | "unresolved";
  readonly textureSrc?: string;
}

export interface LegacyPrototypeTokenEvidence {
  readonly actorLink?: boolean;
  readonly issue?: "invalid-prototype" | "missing-prototype";
  readonly status: "exact" | "unresolved";
  readonly textureSrc?: string;
}

export type LegacyActorDeltaIssue =
  | "duplicate-index"
  | "missing-actor"
  | "missing-delta-reference"
  | "missing-index"
  | "missing-parent"
  | "missing-token";

export interface LegacyActorDeltaEvidence {
  readonly actorId?: string;
  readonly actorStatus: "absent" | "exact" | "unresolved";
  readonly deltaId: string;
  readonly deltaReferenceStatus: "exact" | "unresolved";
  readonly index?: number;
  readonly indexStatus:
    "detached-tombstone" | "exact" | "not-applicable" | "unresolved";
  readonly issues: readonly LegacyActorDeltaIssue[];
  readonly role: "effect" | "item" | "item-effect" | "root";
  readonly rootUuid: string;
  readonly status: "exact" | "unresolved";
  readonly tokenStatus: "exact" | "unresolved";
  readonly tokenUuid: string;
  readonly tombstone: boolean;
}

export interface CanonicalLegacyDocumentEnvelope {
  readonly activeEffect?: LegacyActiveEffectEvidence;
  readonly actorDelta?: LegacyActorDeltaEvidence;
  readonly findings: readonly LegacyReferenceFinding[];
  readonly folderReference?: LegacyDocumentFolderReference;
  readonly format: typeof LEGACY_DOCUMENT_ENVELOPE_FORMAT;
  readonly identity: Readonly<{
    readonly aliases: readonly string[];
    readonly documentId?: string;
    readonly preserveId: boolean;
    readonly proposedTargetUuid?: string;
    readonly sourceId: string;
  }>;
  readonly kind:
    | "ActiveEffect"
    | "Actor"
    | "ActorDelta"
    | "ActorDeltaEffect"
    | "ActorDeltaItem"
    | "ActorDeltaItemEffect"
    | "Folder"
    | "Item"
    | "JournalEntry"
    | "JournalEntryPage"
    | "Macro"
    | "Playlist"
    | "PlaylistSound"
    | "RollTable"
    | "TableResult"
    | "Cards"
    | "Card"
    | "Scene"
    | "Token";
  readonly payload: unknown;
  readonly placedToken?: LegacyPlacedTokenEvidence;
  readonly preservation: Readonly<{
    readonly flags: "absent" | "retained";
    readonly ownership: "absent" | "retained";
    readonly payload: "exact";
    readonly unknownFields: "retained";
  }>;
  readonly source: Readonly<{
    readonly collection: Exclude<
      LegacyWorldExportRecord["collection"],
      "settings"
    >;
    readonly pack: "world";
    readonly parentUuid?: string;
    readonly recordKey: string;
    readonly system: LegacyWorldSource["system"];
    readonly uuid: string;
    readonly version: string;
  }>;
  readonly status: "exact" | "unresolved";
  readonly topology?: LegacyFolderTopology;
  readonly prototypeToken?: LegacyPrototypeTokenEvidence;
  readonly type?: string;
}

export interface CanonicalLegacyDocumentEnvelopeResult {
  readonly actorDeltas: Readonly<{
    readonly absentActorReferences: number;
    readonly changePaths: number;
    readonly danglingEffectIndexes: number;
    readonly danglingItemEffectIndexes: number;
    readonly danglingItemIndexes: number;
    readonly detachedTombstones: number;
    readonly documents: number;
    readonly duplicateEffectIndexes: number;
    readonly duplicateItemEffectIndexes: number;
    readonly duplicateItemIndexes: number;
    readonly effects: number;
    readonly exactActorReferences: number;
    readonly exactDeltaReferences: number;
    readonly exactEffectIndexes: number;
    readonly exactEvidence: number;
    readonly exactItemEffectIndexes: number;
    readonly exactItemIndexes: number;
    readonly exactTokenReferences: number;
    readonly invalidChangePaths: number;
    readonly invalidEffectIndexEntries: number;
    readonly invalidItemEffectIndexEntries: number;
    readonly invalidItemIndexEntries: number;
    readonly itemEffects: number;
    readonly items: number;
    readonly missingActorReferences: number;
    readonly missingDeltaReferences: number;
    readonly missingEffectIndexes: number;
    readonly missingItemEffectIndexes: number;
    readonly missingItemIndexes: number;
    readonly missingParents: number;
    readonly missingTokenReferences: number;
    readonly originAbsent: number;
    readonly originExact: number;
    readonly originExternal: number;
    readonly originUnresolved: number;
    readonly roots: number;
    readonly tombstones: number;
    readonly unresolvedEvidence: number;
  }>;
  readonly activeEffects: Readonly<{
    readonly changePaths: number;
    readonly danglingIndexes: number;
    readonly documents: number;
    readonly duplicateIndexes: number;
    readonly exact: number;
    readonly invalidChangePaths: number;
    readonly invalidIndexEntries: number;
    readonly missingIndexes: number;
    readonly missingParents: number;
    readonly originAbsent: number;
    readonly originExact: number;
    readonly originExternal: number;
    readonly originUnresolved: number;
    readonly unresolved: number;
  }>;
  readonly documents: readonly CanonicalLegacyDocumentEnvelope[];
  readonly folderTopology: Readonly<{
    readonly cycles: number;
    readonly exact: number;
    readonly missingParents: number;
    readonly parentLinks: number;
    readonly parentTypeMismatches: number;
    readonly roots: number;
    readonly selfParents: number;
    readonly unresolved: number;
  }>;
  readonly folderReferences: Readonly<{
    readonly exact: number;
    readonly missing: number;
    readonly parentTypeMismatches: number;
    readonly unresolved: number;
  }>;
  readonly placedTokens: Readonly<{
    readonly absentActorReferences: number;
    readonly absentDeltaReferences: number;
    readonly danglingIndexes: number;
    readonly deltaEffectRecords: number;
    readonly deltaItemEffectRecords: number;
    readonly deltaItemRecords: number;
    readonly deltaRootRecords: number;
    readonly documents: number;
    readonly duplicateIndexes: number;
    readonly exact: number;
    readonly exactActorReferences: number;
    readonly exactDeltaReferences: number;
    readonly exactIndexes: number;
    readonly invalidDeltaReferences: number;
    readonly invalidIndexEntries: number;
    readonly missingActorReferences: number;
    readonly missingDeltaReferences: number;
    readonly missingIndexes: number;
    readonly missingParents: number;
    readonly unreferencedDeltaRoots: number;
    readonly unresolved: number;
  }>;
  readonly prototypeTokens: Readonly<{
    readonly documents: number;
    readonly exact: number;
    readonly linked: number;
    readonly missing: number;
    readonly unlinked: number;
    readonly unresolved: number;
  }>;
  readonly skipped: number;
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function string(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function legacyActorRecordIdentity(
  key: string,
): LegacyActorRecordIdentity | undefined {
  const actor = /^!actors!([^.]+)$/.exec(key);
  if (actor?.[1]) return { actorId: actor[1] };
  const item = /^!actors\.items!([^.]+)\.([^.]+)$/.exec(key);
  if (item?.[1] && item[2]) return { actorId: item[1], itemId: item[2] };
  return undefined;
}

interface LegacyDocumentRecordIdentity {
  readonly actorId?: string;
  readonly deltaEffectId?: string;
  readonly deltaId?: string;
  readonly deltaItemId?: string;
  readonly effectId?: string;
  readonly id: string;
  readonly itemId?: string;
  readonly kind:
    | "ActiveEffect"
    | "Actor"
    | "ActorDelta"
    | "ActorDeltaEffect"
    | "ActorDeltaItem"
    | "ActorDeltaItemEffect"
    | "Folder"
    | "Item"
    | "JournalEntry"
    | "JournalEntryPage"
    | "Macro"
    | "Playlist"
    | "PlaylistSound"
    | "RollTable"
    | "TableResult"
    | "Cards"
    | "Card"
    | "Scene"
    | "Token";
  readonly sceneId?: string;
  readonly tokenId?: string;
  readonly parentDocumentId?: string;
}

function documentRecordIdentity(
  exportRecord: LegacyWorldExportRecord,
): LegacyDocumentRecordIdentity | undefined {
  if (exportRecord.collection === "actors") {
    const effect = /^!actors\.effects!([^.]+)\.([^.]+)$/.exec(exportRecord.key);
    if (effect?.[1] && effect[2]) {
      return {
        actorId: effect[1],
        effectId: effect[2],
        id: effect[2],
        kind: "ActiveEffect",
      };
    }
    const identity = legacyActorRecordIdentity(exportRecord.key);
    if (!identity) return undefined;
    return identity.itemId
      ? {
          actorId: identity.actorId,
          id: identity.itemId,
          itemId: identity.itemId,
          kind: "Item",
        }
      : { actorId: identity.actorId, id: identity.actorId, kind: "Actor" };
  }
  if (exportRecord.collection === "scenes") {
    const delta = sceneDeltaDocumentIdentity(exportRecord.key);
    if (delta) return delta;
    const token = /^!scenes\.tokens!([^.]+)\.([^.]+)$/.exec(exportRecord.key);
    if (token?.[1] && token[2]) {
      return {
        id: token[2],
        kind: "Token",
        sceneId: token[1],
        tokenId: token[2],
      };
    }
    const scene = /^!scenes!([^.]+)$/.exec(exportRecord.key);
    if (scene?.[1]) {
      return { id: scene[1], kind: "Scene", sceneId: scene[1] };
    }
    return undefined;
  }
  const collectionIdentity = (
    collection: LegacyWorldExportRecord["collection"],
    rootPattern: RegExp,
    rootKind: LegacyDocumentRecordIdentity["kind"],
    childPattern?: RegExp,
    childKind?: LegacyDocumentRecordIdentity["kind"],
  ): LegacyDocumentRecordIdentity | undefined => {
    if (exportRecord.collection !== collection) return undefined;
    const child = childPattern?.exec(exportRecord.key);
    if (child?.[1] && child[2] && childKind)
      return {
        id: child[2],
        kind: childKind,
        parentDocumentId: child[1],
      };
    const root = rootPattern.exec(exportRecord.key);
    return root?.[1] ? { id: root[1], kind: rootKind } : undefined;
  };
  const extended =
    collectionIdentity(
      "journal",
      /^!journal!([^.]+)$/,
      "JournalEntry",
      /^!journal\.pages!([^.]+)\.([^.]+)$/,
      "JournalEntryPage",
    ) ??
    collectionIdentity(
      "tables",
      /^!tables!([^.]+)$/,
      "RollTable",
      /^!tables\.results!([^.]+)\.([^.]+)$/,
      "TableResult",
    ) ??
    collectionIdentity(
      "playlists",
      /^!playlists!([^.]+)$/,
      "Playlist",
      /^!playlists\.sounds!([^.]+)\.([^.]+)$/,
      "PlaylistSound",
    ) ??
    collectionIdentity(
      "cards",
      /^!cards!([^.]+)$/,
      "Cards",
      /^!cards\.cards!([^.]+)\.([^.]+)$/,
      "Card",
    ) ??
    collectionIdentity("macros", /^!macros!([^.]+)$/, "Macro");
  if (extended) return extended;
  const pattern =
    exportRecord.collection === "items"
      ? /^!items!([^.]+)$/
      : exportRecord.collection === "folders"
        ? /^!folders!([^.]+)$/
        : undefined;
  const match = pattern?.exec(exportRecord.key);
  if (!match?.[1]) return undefined;
  return {
    id: match[1],
    kind: exportRecord.collection === "items" ? "Item" : "Folder",
  };
}

function canonicalPayload(value: unknown): unknown {
  if (Array.isArray(value)) return Object.freeze(value.map(canonicalPayload));
  const valueRecord = record(value);
  if (!valueRecord) return value;
  return Object.freeze(
    Object.fromEntries(
      Object.entries(valueRecord)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalPayload(child)]),
    ),
  );
}

function pathSegment(value: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(value)
    ? value
    : `[${JSON.stringify(value)}]`;
}

function childPath(parent: string, child: string): string {
  const segment = pathSegment(child);
  return parent.length === 0 || segment.startsWith("[")
    ? `${parent}${segment}`
    : `${parent}.${segment}`;
}

const FOUNDRY_UUID =
  /\bScene\.[A-Za-z0-9_-]+\.Token\.[A-Za-z0-9_-]+\.ActorDelta\.[A-Za-z0-9_-]+(?:\.Item\.[A-Za-z0-9_-]+)?(?:\.ActiveEffect\.[A-Za-z0-9_-]+)?\b|\b(?:ActiveEffect|Actor|Item|Folder|Scene|Token|JournalEntry|RollTable|Playlist|Cards|Macro)\.[A-Za-z0-9_-]+(?:\.(?:ActiveEffect|Item|Token)\.[A-Za-z0-9_-]+)?\b|\bCompendium\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const LEGACY_DATA_PATH = /\bdata(?:\.[A-Za-z_$][\w$-]*)+/g;
const ASSET_URL =
  /(?:https?:\/\/[^\s"'<>]+|(?:systems|modules|worlds|icons|Images|assets)\/[^\s"'<>]+\.(?:avif|gif|jpe?g|m4a|mp3|mp4|ogg|png|svg|webm|webp|wav)(?:\?[^\s"'<>]*)?)/gi;
const PRIVATE_API =
  /\b(?:game\.(?:system|od6s|od6s-next)|canvas|ui)(?:\.[_$A-Za-z][\w$-]*)+/g;
const DOCUMENT_ID_KEY =
  /(?:folder$|(?:actor|effect|item|parent|scene|source|target|token)(?:id|uuid)$)/i;
const FOUNDRY_ID = /^[A-Za-z0-9]{16}$/;

function matches(pattern: RegExp, value: string): readonly string[] {
  pattern.lastIndex = 0;
  return [...value.matchAll(pattern)].map(([match]) => match);
}

function referenceFindings(value: unknown): readonly LegacyReferenceFinding[] {
  const findings: LegacyReferenceFinding[] = [];
  const add = (
    kind: LegacyReferenceFindingKind,
    path: string,
    findingValue: string,
  ): void => {
    findings.push({ kind, path, value: findingValue });
  };
  const visit = (candidate: unknown, path: string, key?: string): void => {
    if (Array.isArray(candidate)) {
      candidate.forEach((child, index) => visit(child, `${path}[${index}]`));
      return;
    }
    const candidateRecord = record(candidate);
    if (candidateRecord) {
      for (const [childKey, child] of Object.entries(candidateRecord)) {
        const nextPath = childPath(path, childKey);
        if (childKey.startsWith("data.")) {
          add("legacy-data-path", nextPath, childKey);
        }
        visit(child, nextPath, childKey);
      }
      return;
    }
    if (typeof candidate !== "string") return;
    matches(FOUNDRY_UUID, candidate).forEach((match) =>
      add("foundry-uuid", path, match),
    );
    matches(LEGACY_DATA_PATH, candidate).forEach((match) =>
      add("legacy-data-path", path, match),
    );
    matches(ASSET_URL, candidate).forEach((match) =>
      add("asset-url", path, match),
    );
    matches(PRIVATE_API, candidate).forEach((match) =>
      add("private-api", path, match),
    );
    if (key && DOCUMENT_ID_KEY.test(key) && candidate.length > 0) {
      add("document-id", path, candidate);
    }
  };
  visit(value, "");
  const unique = new Map<string, LegacyReferenceFinding>();
  findings.forEach((finding) => {
    unique.set(
      `${finding.kind}\u0000${finding.path}\u0000${finding.value}`,
      finding,
    );
  });
  return Object.freeze(
    [...unique.values()].sort((left, right) => {
      const kind = left.kind.localeCompare(right.kind);
      if (kind !== 0) return kind;
      const path = left.path.localeCompare(right.path);
      return path === 0 ? left.value.localeCompare(right.value) : path;
    }),
  );
}

function sourceUuid(identity: LegacyDocumentRecordIdentity): string {
  if (identity.parentDocumentId) {
    const parentKinds: Partial<
      Record<LegacyDocumentRecordIdentity["kind"], string>
    > = {
      Card: "Cards",
      JournalEntryPage: "JournalEntry",
      PlaylistSound: "Playlist",
      TableResult: "RollTable",
    };
    return `${parentKinds[identity.kind]}.${identity.parentDocumentId}.${identity.kind}.${identity.id}`;
  }
  if (identity.sceneId && identity.tokenId && identity.deltaId) {
    const root = `Scene.${identity.sceneId}.Token.${identity.tokenId}.ActorDelta.${identity.deltaId}`;
    if (identity.deltaItemId && identity.deltaEffectId) {
      return `${root}.Item.${identity.deltaItemId}.ActiveEffect.${identity.deltaEffectId}`;
    }
    if (identity.deltaItemId) return `${root}.Item.${identity.deltaItemId}`;
    if (identity.deltaEffectId) {
      return `${root}.ActiveEffect.${identity.deltaEffectId}`;
    }
    return root;
  }
  if (identity.sceneId && identity.tokenId) {
    return `Scene.${identity.sceneId}.Token.${identity.tokenId}`;
  }
  if (identity.actorId && identity.effectId) {
    return `Actor.${identity.actorId}.ActiveEffect.${identity.effectId}`;
  }
  if (identity.actorId && identity.itemId) {
    return `Actor.${identity.actorId}.Item.${identity.itemId}`;
  }
  return `${identity.kind}.${identity.id}`;
}

function actorDeltaRootUuid(identity: LegacyDocumentRecordIdentity): string {
  return `Scene.${identity.sceneId}.Token.${identity.tokenId}.ActorDelta.${identity.deltaId}`;
}

function parentUuid(
  identity: LegacyDocumentRecordIdentity,
): string | undefined {
  if (identity.parentDocumentId) {
    const parentKinds: Partial<
      Record<LegacyDocumentRecordIdentity["kind"], string>
    > = {
      Card: "Cards",
      JournalEntryPage: "JournalEntry",
      PlaylistSound: "Playlist",
      TableResult: "RollTable",
    };
    return `${parentKinds[identity.kind]}.${identity.parentDocumentId}`;
  }
  if (identity.deltaId) {
    const root = actorDeltaRootUuid(identity);
    if (identity.deltaItemId && identity.deltaEffectId) {
      return `${root}.Item.${identity.deltaItemId}`;
    }
    return identity.deltaItemId || identity.deltaEffectId
      ? root
      : `Scene.${identity.sceneId}.Token.${identity.tokenId}`;
  }
  if (identity.tokenId) return `Scene.${identity.sceneId}`;
  if (identity.itemId || identity.effectId) return `Actor.${identity.actorId}`;
  return undefined;
}

function identityWithDocumentId(
  identity: LegacyDocumentRecordIdentity,
  documentId: string,
): LegacyDocumentRecordIdentity {
  if (identity.kind === "ActorDelta") {
    return { ...identity, deltaId: documentId, id: documentId };
  }
  if (identity.kind === "ActorDeltaItem") {
    return { ...identity, deltaItemId: documentId, id: documentId };
  }
  if (
    identity.kind === "ActorDeltaEffect" ||
    identity.kind === "ActorDeltaItemEffect"
  ) {
    return { ...identity, deltaEffectId: documentId, id: documentId };
  }
  if (identity.kind === "ActiveEffect") {
    return { ...identity, effectId: documentId, id: documentId };
  }
  if (identity.kind === "Item" && identity.actorId) {
    return { ...identity, id: documentId, itemId: documentId };
  }
  if (identity.kind === "Token") {
    return { ...identity, id: documentId, tokenId: documentId };
  }
  if (identity.kind === "Scene") {
    return { ...identity, id: documentId, sceneId: documentId };
  }
  return { ...identity, id: documentId };
}

interface FolderContext {
  readonly parents: ReadonlyMap<string, string | undefined>;
  readonly types: ReadonlyMap<string, string | undefined>;
}

interface ActiveEffectContext {
  readonly indexes: ReadonlyMap<string, readonly unknown[]>;
  readonly knownUuids: ReadonlySet<string>;
}

interface SceneTokenContext {
  readonly deltaRoots: ReadonlySet<string>;
  readonly indexes: ReadonlyMap<string, readonly unknown[]>;
  readonly knownUuids: ReadonlySet<string>;
}

interface ActorDeltaContext {
  readonly indexes: ReadonlyMap<string, readonly unknown[]>;
  readonly knownUuids: ReadonlySet<string>;
  readonly tokens: ReadonlyMap<string, JsonRecord | undefined>;
}

function sceneDeltaDocumentIdentity(
  key: string,
): LegacyDocumentRecordIdentity | undefined {
  const itemEffect =
    /^!scenes\.tokens\.delta\.items\.effects!([^.]+)\.([^.]+)\.([^.]+)\.([^.]+)\.([^.]+)$/.exec(
      key,
    );
  if (
    itemEffect?.[1] &&
    itemEffect[2] &&
    itemEffect[3] &&
    itemEffect[4] &&
    itemEffect[5]
  ) {
    return {
      deltaEffectId: itemEffect[5],
      deltaId: itemEffect[3],
      deltaItemId: itemEffect[4],
      id: itemEffect[5],
      kind: "ActorDeltaItemEffect",
      sceneId: itemEffect[1],
      tokenId: itemEffect[2],
    };
  }
  const item =
    /^!scenes\.tokens\.delta\.items!([^.]+)\.([^.]+)\.([^.]+)\.([^.]+)$/.exec(
      key,
    );
  if (item?.[1] && item[2] && item[3] && item[4]) {
    return {
      deltaId: item[3],
      deltaItemId: item[4],
      id: item[4],
      kind: "ActorDeltaItem",
      sceneId: item[1],
      tokenId: item[2],
    };
  }
  const effect =
    /^!scenes\.tokens\.delta\.effects!([^.]+)\.([^.]+)\.([^.]+)\.([^.]+)$/.exec(
      key,
    );
  if (effect?.[1] && effect[2] && effect[3] && effect[4]) {
    return {
      deltaEffectId: effect[4],
      deltaId: effect[3],
      id: effect[4],
      kind: "ActorDeltaEffect",
      sceneId: effect[1],
      tokenId: effect[2],
    };
  }
  const root = /^!scenes\.tokens\.delta!([^.]+)\.([^.]+)\.([^.]+)$/.exec(key);
  if (root?.[1] && root[2] && root[3]) {
    return {
      deltaId: root[3],
      id: root[3],
      kind: "ActorDelta",
      sceneId: root[1],
      tokenId: root[2],
    };
  }
  return undefined;
}

function placedTokenEvidence(
  identity: LegacyDocumentRecordIdentity,
  value: JsonRecord | undefined,
  context: SceneTokenContext,
): LegacyPlacedTokenEvidence {
  const sceneId = identity.sceneId ?? "";
  const tokenId = identity.tokenId ?? identity.id;
  const sceneUuid = `Scene.${sceneId}`;
  const indexes = context.indexes.get(sceneId) ?? [];
  const matchingIndexes = indexes.flatMap((candidate, index) =>
    candidate === tokenId ? [index] : [],
  );
  const actorId = string(value?.actorId);
  const actorStatus = !actorId
    ? "absent"
    : context.knownUuids.has(`Actor.${actorId}`)
      ? "exact"
      : "unresolved";
  const deltaValue = value?.delta;
  const deltaId = string(deltaValue);
  const deltaStatus =
    deltaValue === undefined || deltaValue === null || deltaValue === ""
      ? "absent"
      : !deltaId
        ? "unresolved"
        : context.deltaRoots.has(`${sceneId}.${tokenId}.${deltaId}`)
          ? "exact"
          : "unresolved";
  const issues = new Set<LegacyPlacedTokenIssue>();
  if (!context.knownUuids.has(sceneUuid)) issues.add("missing-parent");
  if (matchingIndexes.length === 0) issues.add("missing-index");
  if (matchingIndexes.length > 1) issues.add("duplicate-index");
  if (actorStatus === "unresolved") issues.add("missing-actor");
  if (deltaStatus === "unresolved") {
    issues.add(deltaId ? "missing-delta" : "invalid-delta");
  }
  const textureSrc = string(record(value?.texture)?.src);
  const geometry = Object.freeze(
    Object.fromEntries(
      ["elevation", "height", "width", "x", "y"].flatMap((key) =>
        typeof value?.[key] === "number" ? [[key, value[key]]] : [],
      ),
    ),
  );
  const sortedIssues = Object.freeze([...issues].sort());
  return Object.freeze({
    ...(actorId ? { actorId } : {}),
    ...(typeof value?.actorLink === "boolean"
      ? { actorLink: value.actorLink }
      : {}),
    actorStatus,
    ...(deltaId ? { deltaId } : {}),
    deltaStatus,
    geometry,
    ...(matchingIndexes[0] === undefined ? {} : { index: matchingIndexes[0] }),
    issues: sortedIssues,
    status: sortedIssues.length === 0 ? "exact" : "unresolved",
    ...(textureSrc ? { textureSrc } : {}),
  });
}

function prototypeTokenEvidence(
  value: JsonRecord | undefined,
): LegacyPrototypeTokenEvidence {
  if (!value || !Object.hasOwn(value, "prototypeToken")) {
    return Object.freeze({ issue: "missing-prototype", status: "unresolved" });
  }
  const prototype = record(value.prototypeToken);
  if (!prototype) {
    return Object.freeze({ issue: "invalid-prototype", status: "unresolved" });
  }
  const textureSrc = string(record(prototype.texture)?.src);
  return Object.freeze({
    ...(typeof prototype.actorLink === "boolean"
      ? { actorLink: prototype.actorLink }
      : {}),
    status: "exact",
    ...(textureSrc ? { textureSrc } : {}),
  });
}

function actorDeltaEvidence(
  identity: LegacyDocumentRecordIdentity,
  value: JsonRecord | undefined,
  context: ActorDeltaContext,
): LegacyActorDeltaEvidence {
  const tokenUuid = `Scene.${identity.sceneId}.Token.${identity.tokenId}`;
  const rootUuid = actorDeltaRootUuid(identity);
  const token = context.tokens.get(`${identity.sceneId}.${identity.tokenId}`);
  const tokenStatus = context.knownUuids.has(tokenUuid)
    ? "exact"
    : "unresolved";
  const actorId = string(token?.actorId);
  const actorStatus = !actorId
    ? "absent"
    : context.knownUuids.has(`Actor.${actorId}`)
      ? "exact"
      : "unresolved";
  const deltaReferenceStatus =
    string(token?.delta) === identity.deltaId ? "exact" : "unresolved";
  const role =
    identity.kind === "ActorDeltaItem"
      ? "item"
      : identity.kind === "ActorDeltaEffect"
        ? "effect"
        : identity.kind === "ActorDeltaItemEffect"
          ? "item-effect"
          : "root";
  const parent = parentUuid(identity);
  const indexes = parent
    ? (context.indexes.get(`${parent}|${role}`) ?? [])
    : [];
  const matchingIndexes =
    role === "root"
      ? []
      : indexes.flatMap((candidate, index) =>
          candidate === identity.id ? [index] : [],
        );
  const tombstone = value?._tombstone === true;
  const issues = new Set<LegacyActorDeltaIssue>();
  if (tokenStatus === "unresolved") issues.add("missing-token");
  if (actorStatus === "unresolved") issues.add("missing-actor");
  if (deltaReferenceStatus === "unresolved") {
    issues.add("missing-delta-reference");
  }
  if (role !== "root") {
    if (!parent || !context.knownUuids.has(parent))
      issues.add("missing-parent");
    if (matchingIndexes.length === 0 && !tombstone) issues.add("missing-index");
    if (matchingIndexes.length > 1) issues.add("duplicate-index");
  }
  const indexStatus =
    role === "root"
      ? "not-applicable"
      : matchingIndexes.length === 1
        ? "exact"
        : matchingIndexes.length === 0 && tombstone
          ? "detached-tombstone"
          : "unresolved";
  const sortedIssues = Object.freeze([...issues].sort());
  return Object.freeze({
    ...(actorId ? { actorId } : {}),
    actorStatus,
    deltaId: identity.deltaId ?? identity.id,
    deltaReferenceStatus,
    ...(matchingIndexes[0] === undefined ? {} : { index: matchingIndexes[0] }),
    indexStatus,
    issues: sortedIssues,
    role,
    rootUuid,
    status: sortedIssues.length === 0 ? "exact" : "unresolved",
    tokenStatus,
    tokenUuid,
    tombstone,
  });
}

function activeEffectEvidence(
  identity: LegacyDocumentRecordIdentity,
  value: JsonRecord | undefined,
  context: ActiveEffectContext,
): LegacyActiveEffectEvidence {
  const effectParentUuid = parentUuid(identity);
  const indexes = effectParentUuid
    ? (context.indexes.get(effectParentUuid) ?? [])
    : [];
  const matchingIndexes = indexes.flatMap((candidate, index) =>
    candidate === identity.id ? [index] : [],
  );
  const system = record(value?.system);
  const changeGroups: readonly {
    readonly changes: readonly unknown[];
    readonly source: "changes" | "system.changes";
  }[] = [
    ...(Array.isArray(value?.changes)
      ? [{ changes: value.changes, source: "changes" as const }]
      : []),
    ...(Array.isArray(system?.changes)
      ? [{ changes: system.changes, source: "system.changes" as const }]
      : []),
  ];
  const changes = changeGroups.flatMap(({ changes: entries }) => entries);
  const changePaths = changes.flatMap((change) => {
    const key = string(record(change)?.key);
    return key && key.length > 0 ? [key] : [];
  });
  const invalidChangePaths = changes.length - changePaths.length;
  const origin = string(value?.origin);
  const originStatus = !origin
    ? "absent"
    : context.knownUuids.has(origin)
      ? "exact"
      : origin.startsWith("Compendium.")
        ? "external"
        : "unresolved";
  const issues = new Set<LegacyActiveEffectIssue>();
  const tombstone = value?._tombstone === true;
  if (!effectParentUuid || !context.knownUuids.has(effectParentUuid)) {
    issues.add("missing-parent");
  }
  if (matchingIndexes.length === 0 && !tombstone) issues.add("missing-index");
  if (matchingIndexes.length > 1) issues.add("duplicate-index");
  if (invalidChangePaths > 0) issues.add("invalid-change-path");
  if (originStatus === "unresolved") issues.add("missing-origin");
  const sortedIssues = Object.freeze([...issues].sort());
  return Object.freeze({
    changePaths: Object.freeze(changePaths),
    changeSources: Object.freeze(
      changeGroups.map(({ source: changeSource }) => changeSource),
    ),
    ...(typeof value?.disabled === "boolean"
      ? { disabled: value.disabled }
      : {}),
    ...(matchingIndexes[0] === undefined ? {} : { index: matchingIndexes[0] }),
    invalidChangePaths,
    issues: sortedIssues,
    ...(origin ? { origin } : {}),
    originStatus,
    statuses: Object.freeze(
      Array.isArray(value?.statuses)
        ? value.statuses.filter(
            (status): status is string => typeof status === "string",
          )
        : [],
    ),
    status: sortedIssues.length === 0 ? "exact" : "unresolved",
    ...(typeof value?.transfer === "boolean"
      ? { transfer: value.transfer }
      : {}),
  });
}

function folderTopology(
  id: string,
  value: JsonRecord | undefined,
  context: FolderContext,
): LegacyFolderTopology {
  const parentId = string(value?.folder) ?? undefined;
  const documentType = string(value?.type);
  const sorting = string(value?.sorting);
  const issues = new Set<LegacyFolderTopologyIssue>();
  if (parentId === id) issues.add("self-parent");
  if (parentId && !context.parents.has(parentId)) issues.add("missing-parent");
  if (
    parentId &&
    context.types.has(parentId) &&
    documentType !== context.types.get(parentId)
  ) {
    issues.add("parent-type-mismatch");
  }
  if (parentId) {
    const visited = new Set([id]);
    let current: string | undefined = parentId;
    while (current) {
      if (visited.has(current)) {
        issues.add("cycle");
        break;
      }
      visited.add(current);
      current = context.parents.get(current);
    }
  }
  const sortedIssues = Object.freeze([...issues].sort());
  return Object.freeze({
    ...(documentType ? { documentType } : {}),
    issues: sortedIssues,
    ...(parentId ? { parentId, parentUuid: `Folder.${parentId}` } : {}),
    ...(typeof value?.sort === "number" ? { sort: value.sort } : {}),
    ...(sorting ? { sorting } : {}),
    status: sortedIssues.length === 0 ? "exact" : "unresolved",
  });
}

function documentFolderReference(
  identity: LegacyDocumentRecordIdentity,
  value: JsonRecord | undefined,
  context: FolderContext,
): LegacyDocumentFolderReference | undefined {
  if (
    identity.itemId ||
    identity.effectId ||
    identity.tokenId ||
    identity.kind === "Folder"
  ) {
    return undefined;
  }
  const folderId = string(value?.folder);
  if (!folderId) return undefined;
  const folderType = context.types.get(folderId);
  const issue = !context.parents.has(folderId)
    ? "missing-folder"
    : folderType !== identity.kind
      ? "folder-type-mismatch"
      : undefined;
  return Object.freeze({
    folderId,
    folderUuid: `Folder.${folderId}`,
    ...(issue ? { issue } : {}),
    status: issue ? "unresolved" : "exact",
  });
}

function envelope(
  source: LegacyWorldSource,
  exportRecord: LegacyWorldExportRecord,
  identity: LegacyDocumentRecordIdentity,
  folderContext: FolderContext,
  activeEffectContext: ActiveEffectContext,
  sceneTokenContext: SceneTokenContext,
  actorDeltaContext: ActorDeltaContext,
): CanonicalLegacyDocumentEnvelope {
  const value = record(exportRecord.value);
  const documentId = string(value?._id);
  const documentType = string(value?.type);
  const id = identity.id;
  const uuid = sourceUuid(identity);
  const preserveId = documentId === id && FOUNDRY_ID.test(id);
  const aliases = new Set([uuid]);
  const documentParentUuid = parentUuid(identity);
  const folderReference = documentFolderReference(
    identity,
    value,
    folderContext,
  );
  if (documentId && documentId !== id) {
    aliases.add(sourceUuid(identityWithDocumentId(identity, documentId)));
  }
  const effect =
    identity.kind === "ActiveEffect" ||
    identity.kind === "ActorDeltaEffect" ||
    identity.kind === "ActorDeltaItemEffect"
      ? activeEffectEvidence(identity, value, activeEffectContext)
      : undefined;
  return Object.freeze({
    ...(effect ? { activeEffect: effect } : {}),
    ...(identity.deltaId
      ? { actorDelta: actorDeltaEvidence(identity, value, actorDeltaContext) }
      : {}),
    findings: referenceFindings(exportRecord.value),
    ...(folderReference ? { folderReference } : {}),
    format: LEGACY_DOCUMENT_ENVELOPE_FORMAT,
    identity: Object.freeze({
      aliases: Object.freeze([...aliases].sort()),
      ...(documentId ? { documentId } : {}),
      preserveId,
      ...(preserveId && !identity.deltaId ? { proposedTargetUuid: uuid } : {}),
      sourceId: id,
    }),
    kind: identity.kind,
    payload: canonicalPayload(exportRecord.value),
    ...(identity.kind === "Token"
      ? { placedToken: placedTokenEvidence(identity, value, sceneTokenContext) }
      : {}),
    preservation: Object.freeze({
      flags: value && Object.hasOwn(value, "flags") ? "retained" : "absent",
      ownership:
        value && Object.hasOwn(value, "ownership") ? "retained" : "absent",
      payload: "exact",
      unknownFields: "retained",
    }),
    source: Object.freeze({
      collection: exportRecord.collection as Exclude<
        LegacyWorldExportRecord["collection"],
        "settings"
      >,
      pack: "world",
      ...(documentParentUuid ? { parentUuid: documentParentUuid } : {}),
      recordKey: exportRecord.key,
      system: source.system,
      uuid,
      version: source.systemVersion,
    }),
    status: preserveId && value ? "exact" : "unresolved",
    ...(identity.kind === "Folder"
      ? { topology: folderTopology(id, value, folderContext) }
      : {}),
    ...(identity.kind === "Actor"
      ? { prototypeToken: prototypeTokenEvidence(value) }
      : {}),
    ...(documentType ? { type: documentType } : {}),
  });
}

export function canonicalLegacyDocumentEnvelopes(
  source: LegacyWorldSource,
  records: readonly LegacyWorldExportRecord[],
): CanonicalLegacyDocumentEnvelopeResult {
  let skipped = 0;
  const recognized: {
    readonly identity: LegacyDocumentRecordIdentity;
    readonly record: LegacyWorldExportRecord;
  }[] = [];
  for (const exportRecord of records) {
    if (exportRecord.collection === "settings") continue;
    const identity = documentRecordIdentity(exportRecord);
    if (!identity) {
      skipped += 1;
      continue;
    }
    recognized.push({ identity, record: exportRecord });
  }
  const folderRecords = recognized.filter(
    ({ identity }) => identity.kind === "Folder",
  );
  const folderContext: FolderContext = {
    parents: new Map(
      folderRecords.map(({ identity, record: exportRecord }) => [
        identity.id,
        string(record(exportRecord.value)?.folder),
      ]),
    ),
    types: new Map(
      folderRecords.map(({ identity, record: exportRecord }) => [
        identity.id,
        string(record(exportRecord.value)?.type),
      ]),
    ),
  };
  const actorRecords = recognized.filter(
    ({ identity }) => identity.kind === "Actor",
  );
  const tokenRecords = recognized.filter(
    ({ identity }) => identity.kind === "Token",
  );
  const actorDeltaRootRecords = recognized.filter(
    ({ identity }) => identity.kind === "ActorDelta",
  );
  const actorDeltaItemRecords = recognized.filter(
    ({ identity }) => identity.kind === "ActorDeltaItem",
  );
  const knownUuids = new Set(
    recognized.map(({ identity }) => sourceUuid(identity)),
  );
  const activeEffectContext: ActiveEffectContext = {
    indexes: new Map(
      [...actorRecords, ...actorDeltaRootRecords, ...actorDeltaItemRecords].map(
        ({ identity, record: exportRecord }) => {
          const indexes = record(exportRecord.value)?.effects;
          return [sourceUuid(identity), Array.isArray(indexes) ? indexes : []];
        },
      ),
    ),
    knownUuids,
  };
  const sceneRecords = recognized.filter(
    ({ identity }) => identity.kind === "Scene",
  );
  const deltaRoots = new Set(
    actorDeltaRootRecords.map(
      ({ identity }) =>
        `${identity.sceneId}.${identity.tokenId}.${identity.deltaId}`,
    ),
  );
  const sceneTokenContext: SceneTokenContext = {
    deltaRoots,
    indexes: new Map(
      sceneRecords.map(({ identity, record: exportRecord }) => {
        const indexes = record(exportRecord.value)?.tokens;
        return [identity.id, Array.isArray(indexes) ? indexes : []];
      }),
    ),
    knownUuids,
  };
  const actorDeltaContext: ActorDeltaContext = {
    indexes: new Map([
      ...actorDeltaRootRecords.flatMap(({ identity, record: exportRecord }) => {
        const value = record(exportRecord.value);
        return [
          [
            `${sourceUuid(identity)}|item`,
            Array.isArray(value?.items) ? value.items : [],
          ] as const,
          [
            `${sourceUuid(identity)}|effect`,
            Array.isArray(value?.effects) ? value.effects : [],
          ] as const,
        ];
      }),
      ...actorDeltaItemRecords.map(({ identity, record: exportRecord }) => {
        const indexes = record(exportRecord.value)?.effects;
        return [
          `${sourceUuid(identity)}|item-effect`,
          Array.isArray(indexes) ? indexes : [],
        ] as const;
      }),
    ]),
    knownUuids,
    tokens: new Map(
      tokenRecords.map(({ identity, record: exportRecord }) => [
        `${identity.sceneId}.${identity.tokenId}`,
        record(exportRecord.value),
      ]),
    ),
  };
  const documents = recognized.map(({ identity, record: exportRecord }) =>
    envelope(
      source,
      exportRecord,
      identity,
      folderContext,
      activeEffectContext,
      sceneTokenContext,
      actorDeltaContext,
    ),
  );
  documents.sort((left, right) =>
    left.source.uuid.localeCompare(right.source.uuid),
  );
  const folders = documents.filter(
    (
      document,
    ): document is CanonicalLegacyDocumentEnvelope & {
      readonly topology: LegacyFolderTopology;
    } => document.kind === "Folder" && document.topology !== undefined,
  );
  const issueCount = (issue: LegacyFolderTopologyIssue): number =>
    folders.filter(({ topology }) => topology.issues.includes(issue)).length;
  const folderReferences = documents.flatMap(({ folderReference }) =>
    folderReference ? [folderReference] : [],
  );
  const activeEffects = documents.filter(
    (
      document,
    ): document is CanonicalLegacyDocumentEnvelope & {
      readonly activeEffect: LegacyActiveEffectEvidence;
    } =>
      document.kind === "ActiveEffect" && document.activeEffect !== undefined,
  );
  const activeEffectIssueCount = (issue: LegacyActiveEffectIssue): number =>
    activeEffects.filter(({ activeEffect }) =>
      activeEffect.issues.includes(issue),
    ).length;
  const actorEffectIndexes = actorRecords.flatMap(
    ({ identity, record: exportRecord }) => {
      const indexes = record(exportRecord.value)?.effects;
      return Array.isArray(indexes)
        ? indexes.map((effectId: unknown) => ({
            actorId: identity.id,
            effectId,
          }))
        : [];
    },
  );
  const placedTokens = documents.filter(
    (
      document,
    ): document is CanonicalLegacyDocumentEnvelope & {
      readonly placedToken: LegacyPlacedTokenEvidence;
    } => document.kind === "Token" && document.placedToken !== undefined,
  );
  const placedTokenIssueCount = (issue: LegacyPlacedTokenIssue): number =>
    placedTokens.filter(({ placedToken }) => placedToken.issues.includes(issue))
      .length;
  const sceneTokenIndexes = sceneRecords.flatMap(
    ({ identity, record: exportRecord }) => {
      const indexes = record(exportRecord.value)?.tokens;
      return Array.isArray(indexes)
        ? indexes.map((tokenId: unknown) => ({ sceneId: identity.id, tokenId }))
        : [];
    },
  );
  const referencedDeltaRoots = new Set(
    placedTokens.flatMap(({ placedToken, source }) => {
      const token = /^Scene\.([^.]+)\.Token\.([^.]+)$/.exec(source.uuid);
      return placedToken.deltaId && token?.[1] && token[2]
        ? [`${token[1]}.${token[2]}.${placedToken.deltaId}`]
        : [];
    }),
  );
  const prototypeTokens = documents.filter(
    (
      document,
    ): document is CanonicalLegacyDocumentEnvelope & {
      readonly prototypeToken: LegacyPrototypeTokenEvidence;
    } => document.kind === "Actor" && document.prototypeToken !== undefined,
  );
  const actorDeltaDocuments = documents.filter(
    (
      document,
    ): document is CanonicalLegacyDocumentEnvelope & {
      readonly actorDelta: LegacyActorDeltaEvidence;
    } => document.actorDelta !== undefined,
  );
  const actorDeltaRoots = actorDeltaDocuments.filter(
    ({ actorDelta }) => actorDelta.role === "root",
  );
  const actorDeltaEffects = actorDeltaDocuments.filter(
    (
      document,
    ): document is CanonicalLegacyDocumentEnvelope & {
      readonly activeEffect: LegacyActiveEffectEvidence;
      readonly actorDelta: LegacyActorDeltaEvidence;
    } => document.activeEffect !== undefined,
  );
  const actorDeltaByRole = (
    role: LegacyActorDeltaEvidence["role"],
  ): readonly (CanonicalLegacyDocumentEnvelope & {
    readonly actorDelta: LegacyActorDeltaEvidence;
  })[] =>
    actorDeltaDocuments.filter(({ actorDelta }) => actorDelta.role === role);
  const actorDeltaIndexEntries = {
    effects: actorDeltaRootRecords.flatMap(
      ({ identity, record: exportRecord }) => {
        const indexes = record(exportRecord.value)?.effects;
        return Array.isArray(indexes)
          ? indexes.map((id: unknown) => ({
              id,
              ...(typeof id === "string"
                ? { uuid: `${sourceUuid(identity)}.ActiveEffect.${id}` }
                : {}),
            }))
          : [];
      },
    ),
    itemEffects: actorDeltaItemRecords.flatMap(
      ({ identity, record: exportRecord }) => {
        const indexes = record(exportRecord.value)?.effects;
        return Array.isArray(indexes)
          ? indexes.map((id: unknown) => ({
              id,
              ...(typeof id === "string"
                ? { uuid: `${sourceUuid(identity)}.ActiveEffect.${id}` }
                : {}),
            }))
          : [];
      },
    ),
    items: actorDeltaRootRecords.flatMap(
      ({ identity, record: exportRecord }) => {
        const indexes = record(exportRecord.value)?.items;
        return Array.isArray(indexes)
          ? indexes.map((id: unknown) => ({
              id,
              ...(typeof id === "string"
                ? { uuid: `${sourceUuid(identity)}.Item.${id}` }
                : {}),
            }))
          : [];
      },
    ),
  };
  const actorDeltaRoleIssueCount = (
    role: LegacyActorDeltaEvidence["role"],
    issue: LegacyActorDeltaIssue,
  ): number =>
    actorDeltaByRole(role).filter(({ actorDelta }) =>
      actorDelta.issues.includes(issue),
    ).length;
  const invalidIndexEntries = (
    entries: readonly Readonly<{ readonly id: unknown }>[],
  ): number =>
    entries.filter(({ id }) => typeof id !== "string" || id.length === 0)
      .length;
  const danglingIndexes = (
    entries: readonly Readonly<{
      readonly id: unknown;
      readonly uuid?: string;
    }>[],
  ): number =>
    entries.filter(
      ({ id, uuid }) =>
        typeof id === "string" &&
        id.length > 0 &&
        (!uuid || !knownUuids.has(uuid)),
    ).length;
  return Object.freeze({
    actorDeltas: Object.freeze({
      absentActorReferences: actorDeltaRoots.filter(
        ({ actorDelta }) => actorDelta.actorStatus === "absent",
      ).length,
      changePaths: actorDeltaEffects.reduce(
        (total, { activeEffect }) => total + activeEffect.changePaths.length,
        0,
      ),
      danglingEffectIndexes: danglingIndexes(actorDeltaIndexEntries.effects),
      danglingItemEffectIndexes: danglingIndexes(
        actorDeltaIndexEntries.itemEffects,
      ),
      danglingItemIndexes: danglingIndexes(actorDeltaIndexEntries.items),
      detachedTombstones: actorDeltaDocuments.filter(
        ({ actorDelta }) => actorDelta.indexStatus === "detached-tombstone",
      ).length,
      documents: actorDeltaDocuments.length,
      duplicateEffectIndexes: actorDeltaRoleIssueCount(
        "effect",
        "duplicate-index",
      ),
      duplicateItemEffectIndexes: actorDeltaRoleIssueCount(
        "item-effect",
        "duplicate-index",
      ),
      duplicateItemIndexes: actorDeltaRoleIssueCount("item", "duplicate-index"),
      effects: actorDeltaByRole("effect").length,
      exactActorReferences: actorDeltaRoots.filter(
        ({ actorDelta }) => actorDelta.actorStatus === "exact",
      ).length,
      exactDeltaReferences: actorDeltaRoots.filter(
        ({ actorDelta }) => actorDelta.deltaReferenceStatus === "exact",
      ).length,
      exactEffectIndexes: actorDeltaByRole("effect").filter(
        ({ actorDelta }) => actorDelta.indexStatus === "exact",
      ).length,
      exactEvidence: actorDeltaDocuments.filter(
        ({ activeEffect, actorDelta }) =>
          actorDelta.status === "exact" &&
          (!activeEffect || activeEffect.status === "exact"),
      ).length,
      exactItemEffectIndexes: actorDeltaByRole("item-effect").filter(
        ({ actorDelta }) => actorDelta.indexStatus === "exact",
      ).length,
      exactItemIndexes: actorDeltaByRole("item").filter(
        ({ actorDelta }) => actorDelta.indexStatus === "exact",
      ).length,
      exactTokenReferences: actorDeltaRoots.filter(
        ({ actorDelta }) => actorDelta.tokenStatus === "exact",
      ).length,
      invalidChangePaths: actorDeltaEffects.reduce(
        (total, { activeEffect }) => total + activeEffect.invalidChangePaths,
        0,
      ),
      invalidEffectIndexEntries: invalidIndexEntries(
        actorDeltaIndexEntries.effects,
      ),
      invalidItemEffectIndexEntries: invalidIndexEntries(
        actorDeltaIndexEntries.itemEffects,
      ),
      invalidItemIndexEntries: invalidIndexEntries(
        actorDeltaIndexEntries.items,
      ),
      itemEffects: actorDeltaByRole("item-effect").length,
      items: actorDeltaByRole("item").length,
      missingActorReferences: actorDeltaRoots.filter(
        ({ actorDelta }) => actorDelta.actorStatus === "unresolved",
      ).length,
      missingDeltaReferences: actorDeltaRoots.filter(
        ({ actorDelta }) => actorDelta.deltaReferenceStatus === "unresolved",
      ).length,
      missingEffectIndexes: actorDeltaRoleIssueCount("effect", "missing-index"),
      missingItemEffectIndexes: actorDeltaRoleIssueCount(
        "item-effect",
        "missing-index",
      ),
      missingItemIndexes: actorDeltaRoleIssueCount("item", "missing-index"),
      missingParents: actorDeltaDocuments.filter(({ actorDelta }) =>
        actorDelta.issues.includes("missing-parent"),
      ).length,
      missingTokenReferences: actorDeltaRoots.filter(
        ({ actorDelta }) => actorDelta.tokenStatus === "unresolved",
      ).length,
      originAbsent: actorDeltaEffects.filter(
        ({ activeEffect }) => activeEffect.originStatus === "absent",
      ).length,
      originExact: actorDeltaEffects.filter(
        ({ activeEffect }) => activeEffect.originStatus === "exact",
      ).length,
      originExternal: actorDeltaEffects.filter(
        ({ activeEffect }) => activeEffect.originStatus === "external",
      ).length,
      originUnresolved: actorDeltaEffects.filter(
        ({ activeEffect }) => activeEffect.originStatus === "unresolved",
      ).length,
      roots: actorDeltaRoots.length,
      tombstones: actorDeltaDocuments.filter(
        ({ actorDelta }) => actorDelta.tombstone,
      ).length,
      unresolvedEvidence: actorDeltaDocuments.filter(
        ({ activeEffect, actorDelta }) =>
          actorDelta.status === "unresolved" ||
          activeEffect?.status === "unresolved",
      ).length,
    }),
    activeEffects: Object.freeze({
      changePaths: activeEffects.reduce(
        (total, { activeEffect }) => total + activeEffect.changePaths.length,
        0,
      ),
      danglingIndexes: actorEffectIndexes.filter(
        ({ actorId, effectId }) =>
          typeof effectId === "string" &&
          effectId.length > 0 &&
          !activeEffectContext.knownUuids.has(
            `Actor.${actorId}.ActiveEffect.${effectId}`,
          ),
      ).length,
      documents: activeEffects.length,
      duplicateIndexes: activeEffectIssueCount("duplicate-index"),
      exact: activeEffects.filter(
        ({ activeEffect }) => activeEffect.status === "exact",
      ).length,
      invalidChangePaths: activeEffects.reduce(
        (total, { activeEffect }) => total + activeEffect.invalidChangePaths,
        0,
      ),
      invalidIndexEntries: actorEffectIndexes.filter(
        ({ effectId }) => typeof effectId !== "string" || effectId.length === 0,
      ).length,
      missingIndexes: activeEffectIssueCount("missing-index"),
      missingParents: activeEffectIssueCount("missing-parent"),
      originAbsent: activeEffects.filter(
        ({ activeEffect }) => activeEffect.originStatus === "absent",
      ).length,
      originExact: activeEffects.filter(
        ({ activeEffect }) => activeEffect.originStatus === "exact",
      ).length,
      originExternal: activeEffects.filter(
        ({ activeEffect }) => activeEffect.originStatus === "external",
      ).length,
      originUnresolved: activeEffects.filter(
        ({ activeEffect }) => activeEffect.originStatus === "unresolved",
      ).length,
      unresolved: activeEffects.filter(
        ({ activeEffect }) => activeEffect.status === "unresolved",
      ).length,
    }),
    documents: Object.freeze(documents),
    folderTopology: Object.freeze({
      cycles: issueCount("cycle"),
      exact: folders.filter(({ topology }) => topology.status === "exact")
        .length,
      missingParents: issueCount("missing-parent"),
      parentLinks: folders.filter(({ topology }) => topology.parentId).length,
      parentTypeMismatches: issueCount("parent-type-mismatch"),
      roots: folders.filter(({ topology }) => !topology.parentId).length,
      selfParents: issueCount("self-parent"),
      unresolved: folders.filter(
        ({ topology }) => topology.status === "unresolved",
      ).length,
    }),
    folderReferences: Object.freeze({
      exact: folderReferences.filter(({ status }) => status === "exact").length,
      missing: folderReferences.filter(
        ({ issue }) => issue === "missing-folder",
      ).length,
      parentTypeMismatches: folderReferences.filter(
        ({ issue }) => issue === "folder-type-mismatch",
      ).length,
      unresolved: folderReferences.filter(
        ({ status }) => status === "unresolved",
      ).length,
    }),
    placedTokens: Object.freeze({
      absentActorReferences: placedTokens.filter(
        ({ placedToken }) => placedToken.actorStatus === "absent",
      ).length,
      absentDeltaReferences: placedTokens.filter(
        ({ placedToken }) => placedToken.deltaStatus === "absent",
      ).length,
      danglingIndexes: sceneTokenIndexes.filter(
        ({ sceneId, tokenId }) =>
          typeof tokenId === "string" &&
          tokenId.length > 0 &&
          !sceneTokenContext.knownUuids.has(
            `Scene.${sceneId}.Token.${tokenId}`,
          ),
      ).length,
      deltaEffectRecords: recognized.filter(
        ({ identity }) => identity.kind === "ActorDeltaEffect",
      ).length,
      deltaItemEffectRecords: recognized.filter(
        ({ identity }) => identity.kind === "ActorDeltaItemEffect",
      ).length,
      deltaItemRecords: actorDeltaItemRecords.length,
      deltaRootRecords: actorDeltaRootRecords.length,
      documents: placedTokens.length,
      duplicateIndexes: placedTokenIssueCount("duplicate-index"),
      exact: placedTokens.filter(
        ({ placedToken }) => placedToken.status === "exact",
      ).length,
      exactActorReferences: placedTokens.filter(
        ({ placedToken }) => placedToken.actorStatus === "exact",
      ).length,
      exactDeltaReferences: placedTokens.filter(
        ({ placedToken }) => placedToken.deltaStatus === "exact",
      ).length,
      exactIndexes: placedTokens.filter(
        ({ placedToken }) =>
          !placedToken.issues.includes("missing-parent") &&
          !placedToken.issues.includes("missing-index") &&
          !placedToken.issues.includes("duplicate-index"),
      ).length,
      invalidDeltaReferences: placedTokenIssueCount("invalid-delta"),
      invalidIndexEntries: sceneTokenIndexes.filter(
        ({ tokenId }) => typeof tokenId !== "string" || tokenId.length === 0,
      ).length,
      missingActorReferences: placedTokenIssueCount("missing-actor"),
      missingDeltaReferences: placedTokenIssueCount("missing-delta"),
      missingIndexes: placedTokenIssueCount("missing-index"),
      missingParents: placedTokenIssueCount("missing-parent"),
      unreferencedDeltaRoots: [...deltaRoots].filter(
        (deltaRoot) => !referencedDeltaRoots.has(deltaRoot),
      ).length,
      unresolved: placedTokens.filter(
        ({ placedToken }) => placedToken.status === "unresolved",
      ).length,
    }),
    prototypeTokens: Object.freeze({
      documents: prototypeTokens.length,
      exact: prototypeTokens.filter(
        ({ prototypeToken }) => prototypeToken.status === "exact",
      ).length,
      linked: prototypeTokens.filter(
        ({ prototypeToken }) => prototypeToken.actorLink === true,
      ).length,
      missing: prototypeTokens.filter(
        ({ prototypeToken }) => prototypeToken.issue === "missing-prototype",
      ).length,
      unlinked: prototypeTokens.filter(
        ({ prototypeToken }) => prototypeToken.actorLink === false,
      ).length,
      unresolved: prototypeTokens.filter(
        ({ prototypeToken }) => prototypeToken.status === "unresolved",
      ).length,
    }),
    skipped,
  });
}

export function serializeCanonicalLegacyDocumentEnvelopes(
  documents: readonly CanonicalLegacyDocumentEnvelope[],
): string {
  return `${documents.map((document) => JSON.stringify(document)).join("\n")}\n`;
}
