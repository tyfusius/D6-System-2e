type JsonRecord = Record<string, unknown>;

export const LEGACY_IMPORT_INTEGRITY_REVISION = 1 as const;

function record(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  const source = record(value);
  if (!source) return value;
  return Object.fromEntries(
    Object.keys(source)
      .sort()
      .flatMap((key) =>
        source[key] === undefined ? [] : [[key, canonical(source[key])]],
      ),
  );
}

function withoutIntegrity<T extends object>(source: T): T {
  const clone = structuredClone(source) as JsonRecord;
  const flags = record(clone.flags);
  const systemFlags = record(flags?.["d6-system-2e"]);
  const legacyImport = record(systemFlags?.legacyImport);
  if (legacyImport) delete legacyImport.integrity;
  return clone as T;
}

export function legacyImportFingerprint(value: unknown): string {
  const serialized = JSON.stringify(canonical(value));
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(serialized)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

export function legacyImportSourceFingerprint(source: object): string {
  return legacyImportFingerprint(withoutIntegrity(source));
}

export function legacyImportProvenance(value: unknown): Readonly<{
  fingerprint?: string;
  revision?: number;
  sourceUuid?: string;
  sourceVersion?: string;
}> {
  const legacyImport = record(
    record(record(value)?.flags)?.["d6-system-2e"],
  )?.legacyImport;
  const provenance = record(legacyImport);
  const integrity = record(provenance?.integrity);
  return Object.freeze({
    ...(typeof integrity?.fingerprint === "string"
      ? { fingerprint: integrity.fingerprint }
      : {}),
    ...(Number.isSafeInteger(integrity?.revision)
      ? { revision: Number(integrity?.revision) }
      : {}),
    ...(typeof provenance?.sourceUuid === "string"
      ? { sourceUuid: provenance.sourceUuid }
      : {}),
    ...(typeof provenance?.sourceVersion === "string"
      ? { sourceVersion: provenance.sourceVersion }
      : {}),
  });
}

export function withLegacyImportIntegrity<T extends object>(
  source: T,
  fingerprint: string,
): T {
  const clone = withoutIntegrity(source) as JsonRecord;
  const flags = { ...(record(clone.flags) ?? {}) };
  const systemFlags = { ...(record(flags["d6-system-2e"]) ?? {}) };
  const legacyImport = { ...(record(systemFlags.legacyImport) ?? {}) };
  legacyImport.integrity = {
    fingerprint,
    revision: LEGACY_IMPORT_INTEGRITY_REVISION,
  };
  systemFlags.legacyImport = legacyImport;
  flags["d6-system-2e"] = systemFlags;
  clone.flags = flags;
  return clone as T;
}

export type LegacyImportIntegrityConflict =
  "fingerprint" | "integrity-revision" | "source-uuid" | "source-version";

export function legacyImportIntegrityConflict(
  existing: unknown,
  expected: Readonly<{
    fingerprint: string;
    sourceUuid: string;
    sourceVersion: string;
  }>,
): LegacyImportIntegrityConflict | undefined {
  const actual = legacyImportProvenance(existing);
  if (actual.sourceUuid !== expected.sourceUuid) return "source-uuid";
  if (actual.sourceVersion !== expected.sourceVersion) return "source-version";
  if (actual.revision !== LEGACY_IMPORT_INTEGRITY_REVISION)
    return "integrity-revision";
  if (actual.fingerprint !== expected.fingerprint) return "fingerprint";
  return undefined;
}
