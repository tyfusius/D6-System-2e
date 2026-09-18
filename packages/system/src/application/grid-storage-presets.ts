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

export interface StorageSpacePreset {
  readonly id: string;
  readonly labelKey: string;
  readonly widthMm: number;
  readonly depthMm: number;
  readonly interiorHeightMm: number;
  readonly scalePresetId: keyof typeof D6_STORAGE_SCALE_PRESETS;
}

/** Illustrative usable interiors, not product specifications or weight ratings. */
export const STORAGE_SPACE_PRESETS: readonly StorageSpacePreset[] =
  Object.freeze(
    [
      ["pouch", "Pouch", 200, 100, 100, "personal-100"],
      ["backpack", "Backpack", 400, 300, 200, "personal-100"],
      ["small-case", "SmallCase", 300, 200, 150, "personal-100"],
      ["crate", "Crate", 600, 400, 400, "personal-100"],
      ["large-crate", "LargeCrate", 800, 600, 500, "personal-100"],
      ["small-cargo", "SmallCargo", 3000, 2000, 2000, "cargo-500"],
      ["medium-cargo", "MediumCargo", 6000, 2500, 2500, "cargo-500"],
      ["large-cargo", "LargeCargo", 12000, 2500, 2500, "cargo-500"],
      ["storeroom", "Storeroom", 4000, 3000, 2500, "cargo-500"],
    ].map(([id, label, widthMm, depthMm, interiorHeightMm, scalePresetId]) =>
      Object.freeze({
        id: String(id),
        labelKey: `D6E2.Storage.Preset.${label}`,
        widthMm: Number(widthMm),
        depthMm: Number(depthMm),
        interiorHeightMm: Number(interiorHeightMm),
        scalePresetId: scalePresetId as StorageSpacePreset["scalePresetId"],
      }),
    ),
  );

export function storageSpacePresetValues(
  id: unknown,
): Record<string, number | string> | null {
  if (id === undefined || id === "" || id === "custom") return null;
  const preset = STORAGE_SPACE_PRESETS.find((p) => p.id === id);
  if (!preset) throw new TypeError("D6E2.Storage.Error.InvalidIntent");
  const scale = D6_STORAGE_SCALE_PRESETS[preset.scalePresetId];
  return {
    scalePresetId: scale.id,
    columns: Math.floor(preset.widthMm / scale.cellWidthMm),
    rows: Math.floor(preset.depthMm / scale.cellDepthMm),
    cellWidthMm: scale.cellWidthMm,
    cellDepthMm: scale.cellDepthMm,
    interiorHeightMm: preset.interiorHeightMm,
  };
}
