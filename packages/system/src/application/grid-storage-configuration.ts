import type {
  D6StoragePhysicalProfileV1,
  D6StorageSpaceV1,
} from "@d6-system-2e/core";

export interface D6StorageScalePreset {
  readonly id: string;
  readonly label: string;
  readonly cellWidthMm: number;
  readonly cellDepthMm: number;
}

export const D6_STORAGE_SCALE_PRESETS = Object.freeze({
  "personal-100": Object.freeze<D6StorageScalePreset>({
    id: "personal-100",
    label: "Personal · 100 mm squares",
    cellWidthMm: 100,
    cellDepthMm: 100,
  }),
  "cargo-500": Object.freeze<D6StorageScalePreset>({
    id: "cargo-500",
    label: "Cargo · 500 mm squares",
    cellWidthMm: 500,
    cellDepthMm: 500,
  }),
});

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

function positive(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new TypeError(`D6E2.Storage.Error.${label}`);
  return parsed;
}

function optionalNonNegative(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0)
    throw new TypeError(`D6E2.Storage.Error.${label}`);
  return parsed;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function physicalProfileFromStorageForm(
  value: unknown,
  current: D6StoragePhysicalProfileV1,
  scaleId: string,
): D6StoragePhysicalProfileV1 {
  const source = record(value);
  const columns = positive(source.footprintColumns, "FootprintColumns");
  const rows = positive(source.footprintRows, "FootprintRows");
  const presetId = text(source.sizePresetId);
  const mode = source.stackMode === "bounded" ? "bounded" : "single";
  const maxQuantityPerPlacement =
    mode === "single"
      ? 1
      : positive(source.maxQuantityPerPlacement, "StackLimit");
  return {
    version: 1,
    provenance:
      optionalNonNegative(source.widthMm, "Width") !== null &&
      optionalNonNegative(source.depthMm, "Depth") !== null
        ? "measured"
        : presetId
          ? "preset"
          : "unknown",
    presetId: presetId || null,
    widthMm: optionalNonNegative(source.widthMm, "Width"),
    depthMm: optionalNonNegative(source.depthMm, "Depth"),
    heightMm: optionalNonNegative(source.heightMm, "Height"),
    unitTareWeightGrams: optionalNonNegative(source.unitWeightGrams, "Weight"),
    unitExteriorVolumeMillilitres: optionalNonNegative(
      source.exteriorVolumeMillilitres,
      "Volume",
    ),
    rotatable: source.rotatable === true || source.rotatable === "true",
    footprintsByScale: {
      ...current.footprintsByScale,
      [scaleId]: {
        columns,
        rows,
        provenance: presetId ? "preset" : "user",
      },
    },
    stack: { mode, maxQuantityPerPlacement },
  };
}

export function storageSpaceFromForm(
  value: unknown,
  rootUuid: string,
  spaceId: string,
  ownerActorUuid: string,
): D6StorageSpaceV1 {
  const source = record(value);
  const configuration =
    source.configuration === "capacity-only" ? "capacity-only" : "grid";
  const presetId = text(source.scalePresetId);
  const presets: Readonly<Record<string, D6StorageScalePreset | undefined>> =
    D6_STORAGE_SCALE_PRESETS;
  const preset = presets[presetId];
  const cellWidthMm = preset
    ? preset.cellWidthMm
    : positive(source.cellWidthMm, "CellWidth");
  const cellDepthMm = preset
    ? preset.cellDepthMm
    : positive(source.cellDepthMm, "CellDepth");
  const label = text(source.label);
  if (!rootUuid || !spaceId || !ownerActorUuid || !label)
    throw new TypeError("D6E2.Storage.Error.SpaceIdentity");
  return {
    id: spaceId,
    label,
    kind:
      source.kind === "installation" ||
      source.kind === "container" ||
      source.kind === "inventory"
        ? source.kind
        : "cargo",
    ownerActorUuid,
    configuration,
    access:
      source.access === "closed" || source.access === "locked"
        ? source.access
        : "open",
    grid:
      configuration === "grid"
        ? {
            version: 1,
            scaleId: (preset?.id ?? text(source.customScaleId)) || "custom",
            scaleLabel: (preset?.label ?? text(source.scaleLabel)) || "Custom",
            columns: positive(source.columns, "GridColumns"),
            rows: positive(source.rows, "GridRows"),
            cellWidthMm,
            cellDepthMm,
          }
        : null,
    limits: {
      maxAggregateWeightGrams: optionalNonNegative(
        source.maxAggregateWeightGrams,
        "WeightLimit",
      ),
      maxOccupiedVolumeMillilitres: optionalNonNegative(
        source.maxOccupiedVolumeMillilitres,
        "VolumeLimit",
      ),
      maxDirectChildren: optionalNonNegative(
        source.maxDirectChildren,
        "CountLimit",
      ),
    },
  };
}
