import { createHash } from "node:crypto";

export type LegacyPowerSourceSystem = "od6s" | "od6s-next";
export type LegacyPowerMappingStatus =
  "exact" | "lossy" | "skipped" | "unresolved";

export interface LegacyPowerSource {
  readonly pack: string;
  readonly records: readonly unknown[];
  readonly system: LegacyPowerSourceSystem;
  readonly version: string;
}

export interface CanonicalLegacyPowerRow {
  readonly aliases: readonly string[];
  readonly classifications: Readonly<{
    readonly asset: number;
    readonly exact: number;
    readonly lossy: number;
    readonly prose: number;
    readonly skipped: number;
    readonly unresolved: number;
  }>;
  readonly kind: "power" | "skill-role" | "unknown";
  readonly notes: readonly string[];
  readonly source: Readonly<{
    readonly fingerprint: string;
    readonly pack: string;
    readonly system: LegacyPowerSourceSystem;
    readonly uuid: string;
    readonly version: string;
  }>;
  readonly status: LegacyPowerMappingStatus;
}

export interface LegacyPowerDryRunReport {
  readonly dryRun: true;
  readonly format: "d6-system-2e.legacy-extraordinary-powers.v1";
  readonly rows: readonly CanonicalLegacyPowerRow[];
  readonly source: Readonly<{
    readonly pack: string;
    readonly system: LegacyPowerSourceSystem;
    readonly version: string;
  }>;
  readonly summary: Readonly<{
    readonly assetsWithheld: number;
    readonly exact: number;
    readonly lossy: number;
    readonly powers: number;
    readonly proseWithheld: number;
    readonly records: number;
    readonly skipped: number;
    readonly skillRoles: number;
    readonly unknown: number;
    readonly unresolved: number;
  }>;
  readonly targetWrites: 0;
}

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as RecordValue)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function nonempty(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function canonicalRow(
  source: LegacyPowerSource,
  value: unknown,
): CanonicalLegacyPowerRow {
  const root = record(value);
  const data = record(root.data);
  const effects = Array.isArray(root.effects) ? root.effects : [];
  const sourceId = nonempty(root._id) ? String(root._id) : "missing-id";
  const kind =
    root.type === "manifestation"
      ? "power"
      : root.type === "skill"
        ? "skill-role"
        : "unknown";
  const prose =
    Number(nonempty(root.name)) + Number(nonempty(data.description));
  const asset = Number(nonempty(root.img));
  const notes: string[] = [];
  let status: LegacyPowerMappingStatus;
  let exact = 2;
  let lossy = 0;
  let skipped = prose + asset;
  let unresolved = 0;

  if (kind === "power") {
    unresolved = 4;
    notes.push(
      "checks-not-structured",
      "difficulty-not-structured",
      "maintenance-not-structured",
      "prerequisites-not-structured",
    );
    if (effects.length > 0) {
      lossy = 1;
      notes.push("legacy-active-effects-require-explicit-conversion");
    }
    status = "unresolved";
  } else if (kind === "skill-role") {
    skipped += 1;
    notes.push("skill-role-evidence-not-a-power-definition");
    status = "skipped";
  } else {
    exact = 0;
    unresolved = 1;
    notes.push("unsupported-record-type");
    status = "unresolved";
  }
  if (prose > 0) notes.push("protected-prose-withheld");
  if (asset > 0) notes.push("asset-reference-withheld");

  return Object.freeze({
    aliases: Object.freeze([`Compendium.${source.pack}.${sourceId}`, sourceId]),
    classifications: Object.freeze({
      asset,
      exact,
      lossy,
      prose,
      skipped,
      unresolved,
    }),
    kind,
    notes: Object.freeze(notes),
    source: Object.freeze({
      fingerprint: sha256(value),
      pack: source.pack,
      system: source.system,
      uuid: `Item.${sourceId}`,
      version: source.version,
    }),
    status,
  });
}

export function canonicalLegacyPowerDryRun(
  source: LegacyPowerSource,
): LegacyPowerDryRunReport {
  const rows = Object.freeze(
    source.records
      .map((value) => canonicalRow(source, value))
      .sort((left, right) => left.source.uuid.localeCompare(right.source.uuid)),
  );
  const count = (status: LegacyPowerMappingStatus): number =>
    rows.filter((row) => row.status === status).length;
  return Object.freeze({
    dryRun: true,
    format: "d6-system-2e.legacy-extraordinary-powers.v1",
    rows,
    source: Object.freeze({
      pack: source.pack,
      system: source.system,
      version: source.version,
    }),
    summary: Object.freeze({
      assetsWithheld: rows.reduce(
        (total, row) => total + row.classifications.asset,
        0,
      ),
      exact: count("exact"),
      lossy: rows.filter((row) => row.classifications.lossy > 0).length,
      powers: rows.filter(({ kind }) => kind === "power").length,
      proseWithheld: rows.reduce(
        (total, row) => total + row.classifications.prose,
        0,
      ),
      records: rows.length,
      skipped: count("skipped"),
      skillRoles: rows.filter(({ kind }) => kind === "skill-role").length,
      unknown: rows.filter(({ kind }) => kind === "unknown").length,
      unresolved: count("unresolved"),
    }),
    targetWrites: 0,
  });
}

export function serializeLegacyPowerDryRun(
  report: LegacyPowerDryRunReport,
): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
