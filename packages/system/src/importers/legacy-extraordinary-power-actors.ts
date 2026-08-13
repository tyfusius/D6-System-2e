import { legacyActorRecordIdentity } from "./legacy-document-envelope";
import type {
  LegacyWorldExportRecord,
  LegacyWorldSource,
} from "./legacy-world-import";

export type LegacyExtraordinaryPowerActorStatus =
  "exact" | "lossy" | "skipped" | "unresolved";

export interface LegacyExtraordinaryPowerActorMapping {
  readonly actorMarkerPaths?: readonly string[];
  readonly consequenceResources?: readonly Readonly<{
    readonly paths: readonly string[];
    readonly resourceRoleId: string;
  }>[];
  readonly frameworkId: string;
  readonly ignoredManifestationNames?: readonly string[];
  readonly powers: readonly Readonly<{
    readonly id: string;
    readonly maintenance: "active-toggle" | "none";
    readonly names: readonly string[];
    readonly sourceIds?: readonly string[];
  }>[];
  readonly skillRoles: readonly Readonly<{
    readonly itemKeys?: readonly string[];
    readonly names: readonly string[];
    readonly roleId: string;
    readonly sourceIds?: readonly string[];
  }>[];
}

export interface CanonicalLegacyExtraordinaryPowerActorRow {
  readonly evidence: Readonly<{
    readonly ignoredManifestationItemIds: readonly string[];
    readonly unresolvedManifestationItemIds: readonly string[];
  }>;
  readonly notes: readonly string[];
  readonly source: Readonly<{
    readonly actorId: string;
    readonly recordKey: string;
    readonly system: LegacyWorldSource["system"];
    readonly uuid: string;
    readonly version: string;
  }>;
  readonly status: LegacyExtraordinaryPowerActorStatus;
  readonly target: Readonly<{
    readonly consequenceValues: Readonly<Record<string, number>>;
    readonly frameworkId: string;
    readonly maintainedPowerIds: readonly string[];
    readonly powerBindings: Readonly<Record<string, string>>;
    readonly skillBindings: Readonly<Record<string, string>>;
  }>;
}

export interface LegacyExtraordinaryPowerActorReport {
  readonly dryRun: true;
  readonly format: "d6-system-2e.legacy-extraordinary-power-actors.v1";
  readonly rows: readonly CanonicalLegacyExtraordinaryPowerActorRow[];
  readonly summary: Readonly<{
    readonly actors: number;
    readonly consequenceValues: number;
    readonly exact: number;
    readonly ignoredManifestations: number;
    readonly lossy: number;
    readonly maintainedPowers: number;
    readonly powerBindings: number;
    readonly skipped: number;
    readonly skillBindings: number;
    readonly unresolved: number;
    readonly unresolvedManifestations: number;
  }>;
  readonly targetWrites: 0;
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("en").replaceAll("’", "'");
}

function pathValue(value: unknown, path: string): unknown {
  let current = value;
  for (const segment of path.split(".")) {
    current = record(current)?.[segment];
  }
  return current;
}

function sourceAliases(item: JsonRecord): readonly string[] {
  const flags = record(item.flags);
  const core = record(flags?.core);
  const scenePacker = record(flags?.["scene-packer"]);
  return [item._id, core?.sourceId, scenePacker?.sourceId]
    .flatMap((value) => {
      const result = text(value);
      return result ? [result] : [];
    })
    .flatMap((value) => [value, value.split(".").at(-1) ?? value]);
}

function matchesAlias(
  item: JsonRecord,
  names: readonly string[],
  sourceIds: readonly string[] = [],
  itemKeys: readonly string[] = [],
): boolean {
  const name = text(item.name);
  if (
    name &&
    names.some((candidate) => normalized(candidate) === normalized(name))
  ) {
    return true;
  }
  const key = text(record(item.system)?.key);
  if (key && itemKeys.includes(key)) return true;
  const aliases = sourceAliases(item);
  return sourceIds.some((sourceId) => aliases.includes(sourceId));
}

function finiteNonnegative(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  return undefined;
}

function statusFor(
  notes: readonly string[],
): LegacyExtraordinaryPowerActorStatus {
  if (notes.some((note) => note.startsWith("unresolved:"))) return "unresolved";
  if (notes.some((note) => note.startsWith("lossy:"))) return "lossy";
  return "exact";
}

export function canonicalLegacyExtraordinaryPowerActors(
  source: LegacyWorldSource,
  records: readonly LegacyWorldExportRecord[],
  mapping: LegacyExtraordinaryPowerActorMapping,
): LegacyExtraordinaryPowerActorReport {
  const roots = new Map<string, { key: string; value: JsonRecord }>();
  const embedded = new Map<string, JsonRecord[]>();
  for (const entry of records) {
    if (entry.collection !== "actors") continue;
    const identity = legacyActorRecordIdentity(entry.key);
    const value = record(entry.value);
    if (!identity || !value) continue;
    if (!identity.itemId)
      roots.set(identity.actorId, { key: entry.key, value });
    else {
      const items = embedded.get(identity.actorId) ?? [];
      items.push(value);
      embedded.set(identity.actorId, items);
    }
  }

  const rows: CanonicalLegacyExtraordinaryPowerActorRow[] = [];
  for (const actorId of new Set([...roots.keys(), ...embedded.keys()])) {
    const root = roots.get(actorId);
    const items = embedded.get(actorId) ?? [];
    const manifestations = items.filter(({ type }) => type === "manifestation");
    const skillCandidates = items.filter(({ type }) => type === "skill");
    const skillBindings: Record<string, string> = {};
    const powerBindings: Record<string, string> = {};
    const consequenceValues: Record<string, number> = {};
    const maintainedPowerIds: string[] = [];
    const ignoredManifestationItemIds: string[] = [];
    const unresolvedManifestationItemIds: string[] = [];
    const notes: string[] = [];

    for (const role of mapping.skillRoles) {
      const matches = skillCandidates.filter((item) =>
        matchesAlias(item, role.names, role.sourceIds, role.itemKeys),
      );
      if (matches.length > 1)
        notes.push(`unresolved:duplicate-skill-role:${role.roleId}`);
      if (matches.length === 1) {
        const itemId = text(matches[0]?._id);
        if (itemId) skillBindings[role.roleId] = itemId;
        else notes.push(`unresolved:missing-skill-item-id:${role.roleId}`);
      }
    }

    for (const item of manifestations) {
      const itemId = text(item._id) ?? "missing-id";
      const itemName = text(item.name) ?? "";
      if (
        mapping.ignoredManifestationNames?.some(
          (candidate) => normalized(candidate) === normalized(itemName),
        )
      ) {
        ignoredManifestationItemIds.push(itemId);
        notes.push(`skipped:instructional-manifestation:${itemId}`);
        continue;
      }
      const matches = mapping.powers.filter((power) =>
        matchesAlias(item, power.names, power.sourceIds),
      );
      if (matches.length !== 1) {
        unresolvedManifestationItemIds.push(itemId);
        notes.push(
          matches.length === 0
            ? `unresolved:unknown-manifestation:${itemId}`
            : `unresolved:ambiguous-manifestation:${itemId}`,
        );
        continue;
      }
      const power = matches[0];
      if (!power) continue;
      if (itemId === "missing-id") {
        notes.push(`unresolved:missing-power-item-id:${power.id}`);
        continue;
      }
      if (powerBindings[power.id]) {
        notes.push(`unresolved:duplicate-power-binding:${power.id}`);
        continue;
      }
      powerBindings[power.id] = itemId;
      if (record(item.system)?.active === true) {
        if (power.maintenance === "active-toggle")
          maintainedPowerIds.push(power.id);
        else notes.push(`lossy:active-state-not-supported:${power.id}`);
      }
    }

    if (root) {
      for (const resource of mapping.consequenceResources ?? []) {
        const values = resource.paths
          .map((path) => pathValue(root.value, path))
          .filter(
            (value) => value !== undefined && value !== null && value !== "",
          );
        const valid = [
          ...new Set(
            values
              .map(finiteNonnegative)
              .filter((value) => value !== undefined),
          ),
        ];
        if (values.length > valid.length) {
          notes.push(
            `unresolved:invalid-consequence:${resource.resourceRoleId}`,
          );
        } else if (valid.length > 1) {
          notes.push(
            `unresolved:conflicting-consequence:${resource.resourceRoleId}`,
          );
        } else if (valid.length === 1 && valid[0] !== undefined) {
          consequenceValues[resource.resourceRoleId] = valid[0];
        }
      }
    }

    const marked = Boolean(
      root &&
      mapping.actorMarkerPaths?.some(
        (path) => pathValue(root.value, path) === true,
      ),
    );
    const relevant =
      marked ||
      Object.keys(skillBindings).length > 0 ||
      manifestations.length > 0 ||
      Object.keys(consequenceValues).some(
        (key) => consequenceValues[key] !== 0,
      );
    if (!relevant) continue;
    if (!root) notes.push("unresolved:missing-actor-root");

    const sorted = <T extends string | number>(value: Record<string, T>) =>
      Object.freeze(
        Object.fromEntries(
          Object.entries(value).sort(([a], [b]) => a.localeCompare(b)),
        ) as Record<string, T>,
      );
    rows.push(
      Object.freeze({
        evidence: Object.freeze({
          ignoredManifestationItemIds: Object.freeze(
            ignoredManifestationItemIds.sort(),
          ),
          unresolvedManifestationItemIds: Object.freeze(
            unresolvedManifestationItemIds.sort(),
          ),
        }),
        notes: Object.freeze(notes.sort()),
        source: Object.freeze({
          actorId,
          recordKey: root?.key ?? `!actors!${actorId}`,
          system: source.system,
          uuid: `Actor.${actorId}`,
          version: source.systemVersion,
        }),
        status: statusFor(notes),
        target: Object.freeze({
          consequenceValues: sorted(consequenceValues),
          frameworkId: mapping.frameworkId,
          maintainedPowerIds: Object.freeze(
            [...new Set(maintainedPowerIds)].sort(),
          ),
          powerBindings: sorted(powerBindings),
          skillBindings: sorted(skillBindings),
        }),
      }),
    );
  }
  rows.sort((left, right) => left.source.uuid.localeCompare(right.source.uuid));
  const count = (status: LegacyExtraordinaryPowerActorStatus) =>
    rows.filter((row) => row.status === status).length;
  return Object.freeze({
    dryRun: true,
    format: "d6-system-2e.legacy-extraordinary-power-actors.v1",
    rows: Object.freeze(rows),
    summary: Object.freeze({
      actors: rows.length,
      consequenceValues: rows.reduce(
        (sum, row) => sum + Object.keys(row.target.consequenceValues).length,
        0,
      ),
      exact: count("exact"),
      ignoredManifestations: rows.reduce(
        (sum, row) => sum + row.evidence.ignoredManifestationItemIds.length,
        0,
      ),
      lossy: count("lossy"),
      maintainedPowers: rows.reduce(
        (sum, row) => sum + row.target.maintainedPowerIds.length,
        0,
      ),
      powerBindings: rows.reduce(
        (sum, row) => sum + Object.keys(row.target.powerBindings).length,
        0,
      ),
      skipped: count("skipped"),
      skillBindings: rows.reduce(
        (sum, row) => sum + Object.keys(row.target.skillBindings).length,
        0,
      ),
      unresolved: count("unresolved"),
      unresolvedManifestations: rows.reduce(
        (sum, row) => sum + row.evidence.unresolvedManifestationItemIds.length,
        0,
      ),
    }),
    targetWrites: 0,
  });
}
