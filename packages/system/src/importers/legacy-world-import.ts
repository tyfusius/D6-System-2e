import {
  canonicalLegacyScale,
  type CanonicalLegacyScaleRow,
  type LegacyScaleDocumentKind,
  type LegacyScaleEvidence,
  type LegacyScaleSourceSystem,
} from "./legacy-scale";
import {
  canonicalLegacyDocumentEnvelopes,
  LEGACY_DOCUMENT_ENVELOPE_FORMAT,
  legacyActorRecordIdentity,
  type LegacyReferenceFinding,
} from "./legacy-document-envelope";
import {
  canonicalLegacyExtraordinaryPowerActors,
  type LegacyExtraordinaryPowerActorMapping,
} from "./legacy-extraordinary-power-actors";

export const LEGACY_WORLD_EXPORT_FORMAT =
  "d6-system-2e.legacy-world-export.v1" as const;
export const LEGACY_WORLD_REPORT_FORMAT =
  "d6-system-2e.legacy-world-report.v8" as const;

export interface LegacyWorldSource {
  readonly coreVersion: string;
  readonly system: LegacyScaleSourceSystem;
  readonly systemVersion: string;
  readonly worldId: string;
}

export interface LegacyWorldExportRecord {
  readonly collection:
    | "actors"
    | "cards"
    | "folders"
    | "items"
    | "journal"
    | "macros"
    | "playlists"
    | "scenes"
    | "settings"
    | "tables";
  readonly key: string;
  readonly value: unknown;
}

export interface LegacyWorldExport {
  readonly format: typeof LEGACY_WORLD_EXPORT_FORMAT;
  readonly records: readonly LegacyWorldExportRecord[];
  readonly source: LegacyWorldSource;
}

export interface LegacyScaleAnomalyEvidence {
  readonly code: string;
  readonly path: string;
  readonly sourceUuid: string;
}

export interface CanonicalLegacyWorldReportOptions {
  readonly extraordinaryPowerActorMapping?: LegacyExtraordinaryPowerActorMapping;
  readonly scaleAnomalies?: readonly LegacyScaleAnomalyEvidence[];
}

export interface CanonicalLegacyScaleLedgerRow extends Omit<
  CanonicalLegacyScaleRow,
  "source"
> {
  readonly source: CanonicalLegacyScaleRow["source"] &
    Readonly<{
      collection: "actors";
      pack: "world";
      recordKey: string;
    }>;
}

export interface LegacyImportWarning {
  readonly code:
    | "legacy-scale-setting-divergence"
    | "source-scale-disabled"
    | "source-scale-setting-missing";
  readonly message: string;
  readonly sourceKey: string;
  readonly sourceValue?: unknown;
}

export interface LegacyDocumentReferenceFinding extends LegacyReferenceFinding {
  readonly sourceUuid: string;
}

export interface CanonicalLegacyWorldReport {
  readonly activeEffects: ReturnType<
    typeof canonicalLegacyDocumentEnvelopes
  >["activeEffects"];
  readonly actorDeltas: ReturnType<
    typeof canonicalLegacyDocumentEnvelopes
  >["actorDeltas"];
  readonly acceptance: Readonly<{
    readonly dryRun: true;
    readonly idempotent: true;
    readonly targetWrites: 0;
  }>;
  readonly format: typeof LEGACY_WORLD_REPORT_FORMAT;
  readonly documentEnvelopeFormat: typeof LEGACY_DOCUMENT_ENVELOPE_FORMAT;
  readonly documentSummary: Readonly<{
    readonly activeEffects: number;
    readonly actorDeltaEffects: number;
    readonly actorDeltaItemEffects: number;
    readonly actorDeltaItems: number;
    readonly actorDeltas: number;
    readonly actorDocuments: number;
    readonly cards: number;
    readonly embeddedItems: number;
    readonly exact: number;
    readonly folders: number;
    readonly journalEntries: number;
    readonly macros: number;
    readonly playlists: number;
    readonly referenceFindings: number;
    readonly scenes: number;
    readonly rollTables: number;
    readonly skipped: number;
    readonly standaloneItems: number;
    readonly placedTokens: number;
    readonly unresolved: number;
    readonly withFlags: number;
    readonly withOwnership: number;
  }>;
  readonly folderTopology: ReturnType<
    typeof canonicalLegacyDocumentEnvelopes
  >["folderTopology"];
  readonly folderReferences: ReturnType<
    typeof canonicalLegacyDocumentEnvelopes
  >["folderReferences"];
  readonly extraordinaryPowerActors?: ReturnType<
    typeof canonicalLegacyExtraordinaryPowerActors
  >;
  readonly placedTokens: ReturnType<
    typeof canonicalLegacyDocumentEnvelopes
  >["placedTokens"];
  readonly prototypeTokens: ReturnType<
    typeof canonicalLegacyDocumentEnvelopes
  >["prototypeTokens"];
  readonly referenceFindings: readonly LegacyDocumentReferenceFinding[];
  readonly rulesEvidence: Readonly<{
    readonly activeKey: string;
    readonly activeValue?: boolean;
    readonly legacyKey?: string;
    readonly legacyValue?: boolean;
  }>;
  readonly scaleLedger: readonly CanonicalLegacyScaleLedgerRow[];
  readonly source: LegacyWorldSource;
  readonly summary: Readonly<{
    readonly actorDocuments: number;
    readonly embeddedItems: number;
    readonly exact: number;
    readonly lossy: 0;
    readonly nonzeroScalePaths: number;
    readonly scalePaths: number;
    readonly skipped: number;
    readonly unresolved: number;
  }>;
  readonly warnings: readonly LegacyImportWarning[];
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

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "boolean" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

interface ScaleHit {
  readonly path: string;
  readonly value: unknown;
}

function scaleHits(value: unknown): readonly ScaleHit[] {
  const result: ScaleHit[] = [];
  const visit = (candidate: unknown, path: readonly string[]): void => {
    if (Array.isArray(candidate)) {
      candidate.forEach((child, index) => {
        visit(child, [...path, String(index)]);
      });
      return;
    }
    const candidateRecord = record(candidate);
    if (!candidateRecord) return;
    const scale = record(candidateRecord.scale);
    if (scale && Object.hasOwn(scale, "score")) {
      result.push({
        path: [...path, "scale", "score"].join("."),
        value: scale.score,
      });
    }
    for (const [key, child] of Object.entries(candidateRecord)) {
      visit(child, [...path, key]);
    }
  };
  visit(value, []);
  return result;
}

function actorKind(type: string | undefined): LegacyScaleDocumentKind {
  switch (type) {
    case "character":
    case "creature":
    case "npc":
    case "starship":
    case "vehicle":
      return type;
    default:
      return "npc";
  }
}

function itemKind(type: string | undefined): LegacyScaleDocumentKind {
  if (type === "starship-weapon" || type === "vehicle-weapon") return type;
  return "weapon";
}

function scaleKind(
  documentType: string | undefined,
  path: string,
  embedded: boolean,
): LegacyScaleDocumentKind {
  if (embedded) return itemKind(documentType);
  if (path.includes(".vehicle.scale.score")) return "vehicle";
  return actorKind(documentType);
}

function scaleAnomaly(
  anomalies: readonly LegacyScaleAnomalyEvidence[],
  sourceUuid: string,
  path: string,
): string | undefined {
  return anomalies.find(
    (candidate) =>
      candidate.sourceUuid === sourceUuid && candidate.path === path,
  )?.code;
}

function scaleLedger(
  source: LegacyWorldSource,
  records: readonly LegacyWorldExportRecord[],
  anomalies: readonly LegacyScaleAnomalyEvidence[],
): {
  readonly actorDocuments: number;
  readonly embeddedItems: number;
  readonly rows: readonly CanonicalLegacyScaleLedgerRow[];
  readonly skipped: number;
} {
  let actorDocuments = 0;
  let embeddedItems = 0;
  let skipped = 0;
  const rows: CanonicalLegacyScaleLedgerRow[] = [];
  for (const exportRecord of records) {
    if (exportRecord.collection !== "actors") continue;
    const identity = legacyActorRecordIdentity(exportRecord.key);
    if (!identity) {
      skipped += 1;
      continue;
    }
    if (identity.itemId) embeddedItems += 1;
    else actorDocuments += 1;
    const value = record(exportRecord.value);
    const documentType = string(value?.type);
    const sourceUuid = identity.itemId
      ? `Actor.${identity.actorId}.Item.${identity.itemId}`
      : `Actor.${identity.actorId}`;
    for (const hit of scaleHits(exportRecord.value)) {
      const anomaly = scaleAnomaly(anomalies, sourceUuid, hit.path);
      const evidence: LegacyScaleEvidence = {
        ...(anomaly ? { anomaly } : {}),
        documentKind: scaleKind(
          documentType,
          hit.path,
          identity.itemId !== undefined,
        ),
        path: hit.path,
        sourceSystem: source.system,
        sourceUuid,
        sourceValue: hit.value,
        sourceVersion: source.systemVersion,
      };
      const canonical = canonicalLegacyScale(evidence);
      rows.push({
        ...canonical,
        source: {
          ...canonical.source,
          collection: "actors",
          pack: "world",
          recordKey: exportRecord.key,
        },
      });
    }
  }
  rows.sort((left, right) => {
    const uuid = left.source.uuid.localeCompare(right.source.uuid);
    return uuid === 0
      ? left.source.path.localeCompare(right.source.path)
      : uuid;
  });
  return {
    actorDocuments,
    embeddedItems,
    rows: Object.freeze(rows),
    skipped,
  };
}

function settingValues(
  records: readonly LegacyWorldExportRecord[],
): ReadonlyMap<string, unknown> {
  const values = new Map<string, unknown>();
  for (const exportRecord of records) {
    if (exportRecord.collection !== "settings") continue;
    const value = record(exportRecord.value);
    const key = string(value?.key);
    if (key) values.set(key, value?.value);
  }
  return values;
}

function rulesEvidence(
  source: LegacyWorldSource,
  records: readonly LegacyWorldExportRecord[],
): Pick<CanonicalLegacyWorldReport, "rulesEvidence" | "warnings"> {
  const settings = settingValues(records);
  const activeKey = `${source.system}.dice_for_scale`;
  const activeRaw = settings.get(activeKey);
  const activeValue = parseBoolean(activeRaw);
  const legacyKey =
    source.system === "od6s-next" ? "od6s.dice_for_scale" : undefined;
  const legacyRaw = legacyKey ? settings.get(legacyKey) : undefined;
  const legacyValue = parseBoolean(legacyRaw);
  const warnings: LegacyImportWarning[] = [];
  if (activeValue === undefined) {
    warnings.push({
      code: "source-scale-setting-missing",
      message: `The active source setting ${activeKey} is missing or invalid.`,
      sourceKey: activeKey,
      ...(activeRaw === undefined ? {} : { sourceValue: activeRaw }),
    });
  } else if (!activeValue) {
    warnings.push({
      code: "source-scale-disabled",
      message: `The active source setting ${activeKey} is false; values are preserved without selecting a target profile.`,
      sourceKey: activeKey,
      sourceValue: activeRaw,
    });
  }
  if (
    legacyKey &&
    legacyValue !== undefined &&
    activeValue !== undefined &&
    legacyValue !== activeValue
  ) {
    warnings.push({
      code: "legacy-scale-setting-divergence",
      message: `${legacyKey} and ${activeKey} disagree; both values remain provenance only.`,
      sourceKey: legacyKey,
      sourceValue: legacyRaw,
    });
  }
  return {
    rulesEvidence: {
      activeKey,
      ...(activeValue === undefined ? {} : { activeValue }),
      ...(legacyKey ? { legacyKey } : {}),
      ...(legacyValue === undefined ? {} : { legacyValue }),
    },
    warnings: Object.freeze(warnings),
  };
}

export function canonicalLegacyWorldReport(
  sourceExport: LegacyWorldExport,
  options: CanonicalLegacyWorldReportOptions = {},
): CanonicalLegacyWorldReport {
  const documentResult = canonicalLegacyDocumentEnvelopes(
    sourceExport.source,
    sourceExport.records,
  );
  const ledger = scaleLedger(
    sourceExport.source,
    sourceExport.records,
    options.scaleAnomalies ?? [],
  );
  const evidence = rulesEvidence(sourceExport.source, sourceExport.records);
  const extraordinaryPowerActors = options.extraordinaryPowerActorMapping
    ? canonicalLegacyExtraordinaryPowerActors(
        sourceExport.source,
        sourceExport.records,
        options.extraordinaryPowerActorMapping,
      )
    : undefined;
  const exact = ledger.rows.filter(({ status }) => status === "exact").length;
  const unresolved = ledger.rows.length - exact;
  const referenceFindings = Object.freeze(
    documentResult.documents.flatMap((document) =>
      document.findings.map((finding) => ({
        ...finding,
        sourceUuid: document.source.uuid,
      })),
    ),
  );
  return Object.freeze({
    acceptance: Object.freeze({
      dryRun: true,
      idempotent: true,
      targetWrites: 0,
    }),
    activeEffects: documentResult.activeEffects,
    actorDeltas: documentResult.actorDeltas,
    documentEnvelopeFormat: LEGACY_DOCUMENT_ENVELOPE_FORMAT,
    documentSummary: Object.freeze({
      activeEffects: documentResult.documents.filter(
        ({ kind }) => kind === "ActiveEffect",
      ).length,
      actorDeltaEffects: documentResult.documents.filter(
        ({ kind }) => kind === "ActorDeltaEffect",
      ).length,
      actorDeltaItemEffects: documentResult.documents.filter(
        ({ kind }) => kind === "ActorDeltaItemEffect",
      ).length,
      actorDeltaItems: documentResult.documents.filter(
        ({ kind }) => kind === "ActorDeltaItem",
      ).length,
      actorDeltas: documentResult.documents.filter(
        ({ kind }) => kind === "ActorDelta",
      ).length,
      actorDocuments: documentResult.documents.filter(
        ({ kind, source }) =>
          kind === "Actor" && source.collection === "actors",
      ).length,
      cards: documentResult.documents.filter(({ kind }) => kind === "Cards")
        .length,
      embeddedItems: documentResult.documents.filter(
        ({ kind, source }) => kind === "Item" && source.collection === "actors",
      ).length,
      exact: documentResult.documents.filter(({ status }) => status === "exact")
        .length,
      folders: documentResult.documents.filter(({ kind }) => kind === "Folder")
        .length,
      journalEntries: documentResult.documents.filter(
        ({ kind }) => kind === "JournalEntry",
      ).length,
      macros: documentResult.documents.filter(({ kind }) => kind === "Macro")
        .length,
      playlists: documentResult.documents.filter(
        ({ kind }) => kind === "Playlist",
      ).length,
      referenceFindings: referenceFindings.length,
      scenes: documentResult.documents.filter(({ kind }) => kind === "Scene")
        .length,
      rollTables: documentResult.documents.filter(
        ({ kind }) => kind === "RollTable",
      ).length,
      skipped: documentResult.skipped,
      standaloneItems: documentResult.documents.filter(
        ({ kind, source }) => kind === "Item" && source.collection === "items",
      ).length,
      placedTokens: documentResult.documents.filter(
        ({ kind }) => kind === "Token",
      ).length,
      unresolved: documentResult.documents.filter(
        ({ status }) => status === "unresolved",
      ).length,
      withFlags: documentResult.documents.filter(
        ({ preservation }) => preservation.flags === "retained",
      ).length,
      withOwnership: documentResult.documents.filter(
        ({ preservation }) => preservation.ownership === "retained",
      ).length,
    }),
    folderTopology: documentResult.folderTopology,
    folderReferences: documentResult.folderReferences,
    ...(extraordinaryPowerActors ? { extraordinaryPowerActors } : {}),
    format: LEGACY_WORLD_REPORT_FORMAT,
    placedTokens: documentResult.placedTokens,
    prototypeTokens: documentResult.prototypeTokens,
    referenceFindings,
    rulesEvidence: Object.freeze(evidence.rulesEvidence),
    scaleLedger: ledger.rows,
    source: Object.freeze({ ...sourceExport.source }),
    summary: Object.freeze({
      actorDocuments: ledger.actorDocuments,
      embeddedItems: ledger.embeddedItems,
      exact,
      lossy: 0,
      nonzeroScalePaths: ledger.rows.filter(({ magnitude }) => magnitude > 0)
        .length,
      scalePaths: ledger.rows.length,
      skipped: ledger.skipped,
      unresolved,
    }),
    warnings: evidence.warnings,
  });
}

export function serializeCanonicalLegacyWorldReport(
  report: CanonicalLegacyWorldReport,
): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
