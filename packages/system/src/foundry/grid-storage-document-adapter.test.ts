import { describe, expect, it, vi } from "vitest";
import { createCurrencyWallet } from "@d6-system-2e/core";
import { LEGACY_CURRENCY_DEFINITION } from "../migrations/058-add-currency-denominations.js";
import {
  gridStorageDocumentImageMatches,
  gridStorageDocumentSourceEquivalent,
  gridStorageDocumentWitness,
  gridStorageItemParticipates,
  gridStorageObjectFromItem,
  gridStoragePhysicalProfile,
  planGridStorageDocumentWrites,
  planGridStorageQuantityWrite,
} from "./grid-storage-document-adapter.js";

function itemFixture(
  systemChanges: Record<string, unknown> = {},
  type = "gear",
) {
  const actor = {
    id: "source",
    uuid: "Actor.source",
  } as FoundryActorDocument & { uuid: string };
  const source = {
    _id: "item1",
    name: "Ration",
    type,
    system: {
      storageInstanceId: "ration",
      quantity: 3,
      equipped: false,
      storagePhysical: {
        version: 1,
        provenance: "preset",
        presetId: "small",
        widthMm: null,
        depthMm: null,
        heightMm: null,
        unitTareWeightGrams: 100,
        unitExteriorVolumeMillilitres: 250,
        rotatable: true,
        footprintsByScale: {
          personal: { columns: 1, rows: 1, provenance: "preset" },
        },
        stack: { mode: "bounded", maxQuantityPerPlacement: 6 },
      },
      storageInterior: { configured: false },
      ...systemChanges,
    },
  };
  const update = vi.fn((changes: Record<string, unknown>) => {
    if (typeof changes["system.storageInstanceId"] === "string")
      source.system.storageInstanceId = changes["system.storageInstanceId"];
    return Promise.resolve();
  });
  const item = {
    id: "item1",
    uuid: "Actor.source.Item.item1",
    name: "Ration",
    type,
    parent: actor,
    system: source.system,
    toObject: () => structuredClone(source),
    update,
  } as unknown as FoundryItemDocument & {
    uuid: string;
    parent: FoundryActorDocument & { uuid: string };
  };
  return { item, source, update };
}

describe("grid storage Foundry document adapter", () => {
  it("normalizes only the Foundry-managed fields observed in native r65", async () => {
    const expected = {
      _id: "item1",
      _stats: { createdTime: 10, modifiedTime: 20, lastModifiedBy: "gm" },
      name: "Ration",
      system: { storagePhysical: { presetId: null, widthMm: 2 } },
    };
    const normalizedByFoundry = {
      ...structuredClone(expected),
      _stats: { createdTime: 30, modifiedTime: 30, lastModifiedBy: "gm" },
      system: { storagePhysical: { presetId: "", widthMm: 2 } },
    };
    expect(
      gridStorageDocumentSourceEquivalent(expected, normalizedByFoundry),
    ).toBe(true);
    expect(await gridStorageDocumentWitness(expected)).toBe(
      await gridStorageDocumentWitness(normalizedByFoundry),
    );
    expect(
      await gridStorageDocumentImageMatches(normalizedByFoundry, {
        documentUuid: "Actor.source.Item.item1",
        parentActorUuid: "Actor.source",
        source: expected,
        witness: await gridStorageDocumentWitness(expected),
      }),
    ).toBe(true);

    expect(
      gridStorageDocumentSourceEquivalent(expected, {
        ...normalizedByFoundry,
        name: "Changed concurrently",
      }),
    ).toBe(false);
    expect(
      gridStorageDocumentSourceEquivalent(expected, {
        ...normalizedByFoundry,
        _stats: { ...normalizedByFoundry._stats, lastModifiedBy: "other-gm" },
      }),
    ).toBe(false);
  });

  it("keeps migrated unknown items nonparticipating until atomic enrollment", () => {
    const { item, update } = itemFixture({ storageInstanceId: "" });
    expect(gridStorageItemParticipates(item)).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("parses explicit physical measurements and constructs a witnessed ledger object", async () => {
    const { item } = itemFixture();
    expect(gridStoragePhysicalProfile(item.system)).toMatchObject({
      provenance: "preset",
      unitTareWeightGrams: 100,
      footprintsByScale: { personal: { columns: 1, rows: 1 } },
      stack: { mode: "bounded", maxQuantityPerPlacement: 6 },
    });
    const object = await gridStorageObjectFromItem(item, {
      state: "unplaced",
      rootUuid: "Actor.source",
      disposition: "carried",
    });
    expect(object).toMatchObject({
      definition: { instanceId: "ration" },
      quantity: 3,
      ownerActorUuid: "Actor.source",
    });
    expect(object.witness).toHaveLength(64);
  });

  it("rejects zero quantity instead of normalizing exhausted inventory to one", async () => {
    const { item } = itemFixture({ quantity: 0 });
    await expect(
      gridStorageObjectFromItem(item, {
        state: "unplaced",
        rootUuid: "Actor.source",
        disposition: "carried",
      }),
    ).rejects.toThrow("D6E2.Storage.Error.InvalidQuantity");
    await expect(
      planGridStorageDocumentWrites({
        item,
        destinationActorUuid: "Actor.source",
        destinationDisposition: "carried",
        quantity: 1,
      }),
    ).rejects.toThrow("D6E2.Storage.Error.InvalidQuantity");
  });

  it("reserves both identities before planning a partial cross-owner split", async () => {
    const { item } = itemFixture();
    const plan = await planGridStorageDocumentWrites({
      item,
      destinationActorUuid: "Actor.target",
      destinationDisposition: "stored",
      quantity: 1,
      reservedInstanceId: "ration-split",
      reservedDocumentId: "target-item",
    });
    expect(plan.reservedIdentities).toEqual([
      {
        instanceId: "ration-split",
        parentActorUuid: "Actor.target",
        documentId: "target-item",
        documentUuid: "Actor.target.Item.target-item",
      },
    ]);
    expect(plan.writes.map(({ kind, state }) => [kind, state])).toEqual([
      ["create", "planned"],
      ["update", "planned"],
    ]);
    expect(plan.writes[0]?.after?.source).toMatchObject({
      _id: "target-item",
      system: {
        storageInstanceId: "ration-split",
        quantity: 1,
        equipped: false,
      },
    });
    expect(plan.writes[1]?.after?.source).toMatchObject({
      _id: "item1",
      system: { storageInstanceId: "ration", quantity: 2 },
    });
  });

  it("rejects a partial split of a funded container", async () => {
    const { item } = itemFixture({
      currencyWallet: createCurrencyWallet(LEGACY_CURRENCY_DEFINITION, {
        currency: "7",
      }),
      storageInterior: { configured: true },
    });
    await expect(
      planGridStorageDocumentWrites({
        item,
        destinationActorUuid: "Actor.target",
        destinationDisposition: "stored",
        quantity: 1,
        reservedInstanceId: "ration-split",
        reservedDocumentId: "target-item",
      }),
    ).rejects.toThrow("D6E2.Storage.Currency.Error.FundedSplit");
  });

  it("generates a Foundry-valid 16-character document ID for a partial split", async () => {
    const { item } = itemFixture();
    const plan = await planGridStorageDocumentWrites({
      item,
      destinationActorUuid: "Actor.target",
      destinationDisposition: "stored",
      quantity: 1,
    });
    const documentId = plan.reservedIdentities[0]?.documentId;

    expect(documentId).toMatch(/^[A-Za-z0-9]{16}$/u);
    expect(plan.movedDocumentUuid).toBe(`Actor.target.Item.${documentId}`);
  });

  it("preserves the instance identity for a whole ownership relocation", async () => {
    const { item } = itemFixture();
    const plan = await planGridStorageDocumentWrites({
      item,
      destinationActorUuid: "Actor.target",
      destinationDisposition: "stored",
      quantity: 3,
      reservedDocumentId: "target-item",
    });
    expect(plan.movedInstanceId).toBe("ration");
    expect(plan.writes.map(({ kind }) => kind)).toEqual(["create", "delete"]);
    expect(plan.writes[0]?.after?.source).toMatchObject({
      system: { storageInstanceId: "ration" },
    });
  });

  it("moves a funded container wallet exactly once with a whole ownership relocation", async () => {
    const wallet = createCurrencyWallet(LEGACY_CURRENCY_DEFINITION, {
      currency: "7",
    });
    const { item } = itemFixture({
      currencyWallet: wallet,
      storageInterior: { configured: true },
    });
    const plan = await planGridStorageDocumentWrites({
      item,
      destinationActorUuid: "Actor.target",
      destinationDisposition: "stored",
      quantity: 3,
      reservedDocumentId: "target-item",
    });
    expect(plan.writes.map(({ kind }) => kind)).toEqual(["create", "delete"]);
    expect(plan.writes[0]?.after?.source).toMatchObject({
      system: { currencyWallet: { counts: { currency: "7" } } },
    });
    expect(plan.writes[1]?.after).toBeNull();
  });

  it("plans a witnessed same-document equipped mirror without changing identity or quantity", async () => {
    const { item } = itemFixture();
    const plan = await planGridStorageDocumentWrites({
      item,
      destinationActorUuid: "Actor.source",
      destinationDisposition: "equipped",
      quantity: 3,
    });
    expect(plan.reservedIdentities).toEqual([]);
    expect(plan.movedInstanceId).toBe("ration");
    expect(plan.movedDocumentUuid).toBe(item.uuid);
    expect(plan.writes).toHaveLength(1);
    expect(plan.writes[0]).toMatchObject({
      kind: "update",
      documentUuid: item.uuid,
      before: {
        source: {
          system: {
            storageInstanceId: "ration",
            quantity: 3,
            equipped: false,
          },
        },
      },
      after: {
        source: {
          system: {
            storageInstanceId: "ration",
            quantity: 3,
            equipped: true,
          },
        },
      },
    });
    expect(plan.writes[0]?.after?.source).not.toHaveProperty(
      "system.installed",
    );
  });

  it("does not invent the cybernetic-only installed field during ordinary Gear placement", async () => {
    const { item } = itemFixture();
    const plan = await planGridStorageDocumentWrites({
      item,
      destinationActorUuid: "Actor.source",
      destinationDisposition: "stored",
      quantity: 3,
    });
    expect(plan.writes).toEqual([]);

    const quantityWrite = await planGridStorageQuantityWrite(item, 2, "stored");
    expect(quantityWrite.after?.source).not.toHaveProperty("system.installed");
  });

  it("preserves the installed mirror when the source schema supplies it", async () => {
    const { item } = itemFixture({ installed: false }, "cybernetic");
    const plan = await planGridStorageDocumentWrites({
      item,
      destinationActorUuid: "Actor.source",
      destinationDisposition: "installed",
      quantity: 3,
    });
    expect(plan.writes[0]?.after?.source).toMatchObject({
      system: { equipped: false, installed: true },
    });
  });

  it("rejects an installed disposition when the source schema has no installed mirror", async () => {
    const { item } = itemFixture();
    await expect(
      planGridStorageDocumentWrites({
        item,
        destinationActorUuid: "Actor.source",
        destinationDisposition: "installed",
        quantity: 3,
      }),
    ).rejects.toThrow("D6E2.Storage.Error.InvalidIntent");
  });
});
