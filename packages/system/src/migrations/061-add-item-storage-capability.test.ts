import { describe, expect, it } from "vitest";
import type { ItemSource } from "@d6-system-2e/core";
import { D6_EQUIPMENT_ITEM_TYPES } from "../equipment-item-types";
import { itemStorageCapability } from "../item-storage-capability";
import { addItemStorageCapability } from "./061-add-item-storage-capability";

describe("schema61 explicit item storage", () => {
  it.each(D6_EQUIPMENT_ITEM_TYPES)(
    "defaults ordinary %s off without changing its footprint",
    (type) => {
      const source: ItemSource = {
        type,
        system: { storagePhysical: { footprint: "retained" } },
      };
      addItemStorageCapability(source);
      expect(source.system).toEqual({
        hasStorage: false,
        storagePhysical: { footprint: "retained" },
      });
    },
  );
  it("preserves existing container interiors and funds idempotently", () => {
    const source: ItemSource = {
      type: "weapon",
      system: {
        storageInterior: { configured: true, columns: 7, rows: 2 },
        currencyWallet: { retained: true },
        storageInstanceId: "existing",
      },
    };
    const before = structuredClone(source.system);
    addItemStorageCapability(source);
    addItemStorageCapability(source);
    expect(source.system).toEqual({ ...before, hasStorage: true });
    source.system.hasStorage = false;
    addItemStorageCapability(source);
    expect(source.system.hasStorage).toBe(false);
    expect(itemStorageCapability(source).enabled).toBe(true);
  });
  it("recognizes explicit Container category without guessing from names", () => {
    const source: ItemSource = {
      type: "gear",
      name: "Knife",
      system: { gearCategory: "container" },
    };
    addItemStorageCapability(source);
    expect(source.system.hasStorage).toBe(true);
    expect(itemStorageCapability(source)).toMatchObject({
      enabled: true,
      inherent: true,
    });
    const namedChest: ItemSource = { type: "gear", name: "Chest", system: {} };
    addItemStorageCapability(namedChest);
    expect(namedChest.system.hasStorage).toBe(false);
  });
  it("does not add capability to non-equipment", () => {
    const source: ItemSource = { type: "skill", system: {} };
    addItemStorageCapability(source);
    expect(source.system).toEqual({});
  });
});

it("enables pre-61 containers even when Foundry hydrated the new field default", () => {
  const source: ItemSource = {
    type: "gear",
    system: {
      _migration: { schema: 60, foundry: "14.368", system: "0.1.0-beta.24" },
      hasStorage: false,
      storageInterior: { configured: true },
    },
  };
  addItemStorageCapability(source);
  expect(source.system.hasStorage).toBe(true);
  source.system._migration = {
    schema: 61,
    foundry: "14.368",
    system: "0.1.0-beta.24",
  };
  source.system.hasStorage = false;
  addItemStorageCapability(source);
  expect(source.system.hasStorage).toBe(false);
});
