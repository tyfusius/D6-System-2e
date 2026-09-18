import { expect, it } from "vitest";
import type { ItemSource } from "@d6-system-2e/core";
import { addStorageHeightClearance } from "./062-add-storage-height-clearance";

it("adds only unchecked clearance to an existing interior, idempotently", () => {
  const item: ItemSource = {
    type: "gear",
    system: {
      storageInterior: { configured: true, columns: 7, rows: 9 },
      storagePhysical: { heightMm: 12 },
      storageInstanceId: "retained",
      currencyWallet: { retained: true },
    },
  };
  const before = structuredClone(item);
  addStorageHeightClearance(item);
  addStorageHeightClearance(item);
  expect(item).toEqual({
    ...before,
    system: {
      ...before.system,
      storageInterior: {
        configured: true,
        columns: 7,
        rows: 9,
        interiorHeightMm: null,
      },
    },
  });
});
it("preserves authored clearance and does not create storage on unrelated items", () => {
  const item: ItemSource = {
    type: "gear",
    system: { storageInterior: { interiorHeightMm: 250 } },
  };
  addStorageHeightClearance(item);
  expect(item.system.storageInterior).toEqual({ interiorHeightMm: 250 });
  const unrelated: ItemSource = { type: "skill", system: {} };
  addStorageHeightClearance(unrelated);
  expect(unrelated.system).toEqual({});
});
