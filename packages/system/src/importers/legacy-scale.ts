export type LegacyScaleSourceSystem = "od6s" | "od6s-next";
export type LegacyScaleDocumentKind =
  | "character"
  | "creature"
  | "npc"
  | "starship"
  | "starship-weapon"
  | "vehicle"
  | "vehicle-weapon"
  | "weapon";

export interface LegacyScaleEvidence {
  readonly anomaly?: string;
  readonly documentKind: LegacyScaleDocumentKind;
  readonly path: string;
  readonly sourceSystem: LegacyScaleSourceSystem;
  readonly sourceUuid: string;
  readonly sourceValue: unknown;
  readonly sourceVersion: string;
}

export interface CanonicalLegacyScaleRow {
  readonly confidence: "exact" | "inferred" | "unresolved";
  readonly explicit: boolean;
  readonly family: "open-d6-scalar";
  readonly magnitude: number;
  readonly notes: readonly string[];
  readonly side: "human" | "larger" | "unresolved";
  readonly source: Readonly<{
    readonly path: string;
    readonly system: LegacyScaleSourceSystem;
    readonly uuid: string;
    readonly value: unknown;
    readonly version: string;
  }>;
  readonly status: "exact" | "unresolved";
}

function mounted(kind: LegacyScaleDocumentKind): boolean {
  return kind === "starship-weapon" || kind === "vehicle-weapon";
}

function machine(kind: LegacyScaleDocumentKind): boolean {
  return kind === "starship" || kind === "vehicle";
}

function weapon(kind: LegacyScaleDocumentKind): boolean {
  return kind === "weapon" || mounted(kind);
}

export function canonicalLegacyScale(
  evidence: LegacyScaleEvidence,
): CanonicalLegacyScaleRow {
  const valid =
    Number.isSafeInteger(evidence.sourceValue) &&
    Number(evidence.sourceValue) >= 0;
  const magnitude = valid ? Number(evidence.sourceValue) : 0;
  const notes: string[] = [];
  if (!valid) notes.push("legacy-scale-value-invalid");
  if (evidence.anomaly) notes.push(evidence.anomaly);
  const unresolved = !valid || Boolean(evidence.anomaly);
  const inferredLarger =
    !unresolved &&
    magnitude > 0 &&
    (machine(evidence.documentKind) || mounted(evidence.documentKind));
  const personalUnresolved =
    !unresolved &&
    magnitude > 0 &&
    !machine(evidence.documentKind) &&
    !mounted(evidence.documentKind);
  if (inferredLarger) notes.push("larger-side-inferred-from-document-kind");
  if (personalUnresolved) notes.push("positive-personal-scale-side-unresolved");
  const status = unresolved || personalUnresolved ? "unresolved" : "exact";
  return Object.freeze({
    confidence:
      status === "unresolved"
        ? "unresolved"
        : inferredLarger
          ? "inferred"
          : "exact",
    explicit: weapon(evidence.documentKind) && magnitude > 0,
    family: "open-d6-scalar",
    magnitude,
    notes: Object.freeze(notes),
    side:
      status === "unresolved"
        ? "unresolved"
        : magnitude === 0
          ? "human"
          : "larger",
    source: Object.freeze({
      path: evidence.path,
      system: evidence.sourceSystem,
      uuid: evidence.sourceUuid,
      value: evidence.sourceValue,
      version: evidence.sourceVersion,
    }),
    status,
  });
}

export function legacyScaleDryRun(
  evidence: readonly LegacyScaleEvidence[],
): Readonly<{
  readonly exact: number;
  readonly rows: readonly CanonicalLegacyScaleRow[];
  readonly unresolved: number;
}> {
  const rows = Object.freeze(evidence.map(canonicalLegacyScale));
  return Object.freeze({
    exact: rows.filter(({ status }) => status === "exact").length,
    rows,
    unresolved: rows.filter(({ status }) => status === "unresolved").length,
  });
}
