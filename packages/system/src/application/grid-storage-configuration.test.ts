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

it.each([
  ["pouch", 2, 1, 100, 100],
  ["backpack", 4, 3, 200, 100],
  ["small-case", 3, 2, 150, 100],
  ["crate", 6, 4, 400, 100],
  ["large-crate", 8, 6, 500, 100],
  ["small-cargo", 6, 4, 2000, 500],
  ["medium-cargo", 12, 5, 2500, 500],
  ["large-cargo", 24, 5, 2500, 500],
  ["storeroom", 8, 6, 2500, 500],
])(
  "explicit %s applies illustrative interior geometry only",
  (id, columns, rows, height, cell) => {
    const form = {
      label: "Existing label",
      spacePresetId: id,
      maxDirectChildren: 12,
      access: "locked",
    };
    const result = storageSpaceFromForm(
      form,
      "Actor.root",
      "primary",
      "Actor.root",
    );
    expect(result).toMatchObject({
      label: "Existing label",
      access: "locked",
      interiorHeightMm: height,
      grid: { columns, rows, cellWidthMm: cell, cellDepthMm: cell },
      limits: {
        maxDirectChildren: 12,
        maxAggregateWeightGrams: null,
        maxOccupiedVolumeMillilitres: null,
      },
    });
    expect(form).not.toHaveProperty("columns");
  },
);

it("custom and legacy forms preserve authored cells; absent height stays unchecked", () => {
  const result = storageSpaceFromForm(
    {
      label: "Custom",
      spacePresetId: "custom",
      customScaleId: "odd",
      columns: 7,
      rows: 9,
      cellWidthMm: 125,
      cellDepthMm: 50,
    },
    "Actor.root",
    "primary",
    "Actor.root",
  );
  expect(result).toMatchObject({
    interiorHeightMm: null,
    grid: {
      scaleId: "odd",
      columns: 7,
      rows: 9,
      cellWidthMm: 125,
      cellDepthMm: 50,
    },
  });
  expect(() =>
    storageSpaceFromForm(
      { label: "bad", spacePresetId: "not-a-preset" },
      "a",
      "b",
      "c",
    ),
  ).toThrow(/InvalidIntent/);
});

it.each([0, -1, 1.2, "NaN"])(
  "rejects invalid height %s without altering limits",
  (height) => {
    expect(() =>
      storageSpaceFromForm(
        {
          label: "Space",
          configuration: "capacity-only",
          interiorHeightMm: height,
        },
        "a",
        "b",
        "c",
      ),
    ).toThrow(/InteriorHeight/);
  },
);
