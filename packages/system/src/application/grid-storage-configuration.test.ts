import { describe, expect, it } from "vitest";

import type { D6StoragePhysicalProfileV1 } from "@d6-system-2e/core";
import {
  physicalProfileFromStorageForm,
  storageSpaceFromForm,
} from "./grid-storage-configuration.js";

const unknown: D6StoragePhysicalProfileV1 = {
  version: 1,
  provenance: "unknown",
  presetId: null,
  widthMm: null,
  depthMm: null,
  heightMm: null,
  unitTareWeightGrams: null,
  unitExteriorVolumeMillilitres: null,
  rotatable: true,
  footprintsByScale: {},
  stack: { mode: "single", maxQuantityPerPlacement: 1 },
};

describe("grid storage square-first configuration", () => {
  it("authors a scale-specific footprint without requiring millimetres", () => {
    const result = physicalProfileFromStorageForm(
      {
        footprintColumns: 2,
        footprintRows: 3,
        sizePresetId: "medium",
        rotatable: true,
      },
      unknown,
      "personal-100",
    );

    expect(result.widthMm).toBeNull();
    expect(result.footprintsByScale["personal-100"]).toEqual({
      columns: 2,
      rows: 3,
      provenance: "preset",
    });
  });

  it("uses named scale cell measurements and independent nullable limits", () => {
    const result = storageSpaceFromForm(
      {
        label: "Cargo hold",
        configuration: "grid",
        scalePresetId: "cargo-500",
        columns: 12,
        rows: 8,
        maxAggregateWeightGrams: 4_000_000,
        maxOccupiedVolumeMillilitres: "",
      },
      "Actor.ship",
      "cargo",
      "Actor.ship",
    );

    expect(result.grid).toMatchObject({
      scaleId: "cargo-500",
      cellWidthMm: 500,
      cellDepthMm: 500,
      columns: 12,
      rows: 8,
    });
    expect(result.limits).toEqual({
      maxAggregateWeightGrams: 4_000_000,
      maxOccupiedVolumeMillilitres: null,
      maxDirectChildren: null,
    });
  });

  it("rejects zero geometry while preserving known zero physical measures", () => {
    expect(() =>
      physicalProfileFromStorageForm(
        { footprintColumns: 0, footprintRows: 1 },
        unknown,
        "personal-100",
      ),
    ).toThrow(/FootprintColumns/);
    expect(
      physicalProfileFromStorageForm(
        {
          footprintColumns: 1,
          footprintRows: 1,
          unitWeightGrams: 0,
          exteriorVolumeMillilitres: 0,
        },
        unknown,
        "personal-100",
      ),
    ).toMatchObject({
      unitTareWeightGrams: 0,
      unitExteriorVolumeMillilitres: 0,
    });
  });
});
