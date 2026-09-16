import { describe, expect, it } from "vitest";
import type { ActorSource, ItemSource } from "@d6-system-2e/core";

import {
  addGridStorageActorDefaults,
  addGridStorageItemDefaults,
} from "./057-add-grid-storage.js";

describe("migration 057 grid storage", () => {
  it("adds an unconfigured root without creating spaces or placements", () => {
    const actor = {
      type: "character",
      system: {},
      items: [{ type: "gear", system: { quantity: 5 } }],
    } as ActorSource;

    addGridStorageActorDefaults(actor);

    expect(actor.system.storage).toEqual({
      version: 1,
      configured: false,
      publicSummary: "none",
    });
    expect(actor.items).toHaveLength(1);
  });

  it("keeps legacy mass zero unknown and does not assign identity or footprint", () => {
    const item = {
      type: "gear",
      system: { quantity: 8, mass: 0 },
    } as ItemSource;

    addGridStorageItemDefaults(item);

    expect(item.system.storageInstanceId).toBe("");
    expect(item.system.storagePhysical).toMatchObject({
      provenance: "unknown",
      widthMm: null,
      depthMm: null,
      unitTareWeightGrams: null,
      footprintsByScale: {},
      stack: { mode: "single", maxQuantityPerPlacement: 1 },
    });
    expect(item.system.storageInterior).toMatchObject({ configured: false });
    expect(item.system.quantity).toBe(8);
  });

  it("preserves explicit authored storage data idempotently", () => {
    const item = {
      type: "weapon",
      system: {
        storageInstanceId: "stable-a",
        storagePhysical: {
          version: 1,
          provenance: "preset",
          presetId: "small",
          widthMm: null,
          depthMm: null,
          heightMm: null,
          unitTareWeightGrams: 0,
          unitExteriorVolumeMillilitres: 250,
          rotatable: true,
          footprintsByScale: {
            "personal-100": { columns: 1, rows: 2, provenance: "preset" },
          },
          stack: { mode: "bounded", maxQuantityPerPlacement: 6 },
        },
      },
    } as ItemSource;

    addGridStorageItemDefaults(item);
    const once = structuredClone(item);
    addGridStorageItemDefaults(item);

    expect(item).toEqual(once);
    expect(record(item.system.storagePhysical).unitTareWeightGrams).toBe(0);
  });
});

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
