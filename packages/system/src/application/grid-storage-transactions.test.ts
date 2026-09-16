import { describe, expect, it } from "vitest";
import type {
  D6StorageAuthorityStateV1,
  D6StorageLedgerV1,
  D6StorageObjectV1,
  D6StorageOperationRequestV1,
  D6StorageParentV1,
  D6StoragePhysicalProfileV1,
  D6StorageTransactionReceiptV1,
} from "@d6-system-2e/core";
import {
  advanceGridStorageReceipt,
  applyGridStoragePack,
  createGridStorageReceipt,
  planGridStorageMove,
  previewGridStoragePack,
  recordedGridStorageResponse,
  recordGridStorageIntent,
  undoGridStorageLocations,
  unpackGridStorageContainer,
} from "./grid-storage-transactions.js";

const rootUuid = "Actor.root";
const parent: D6StorageParentV1 = {
  rootUuid,
  spaceId: "cargo",
  containerInstanceId: null,
  spaceOwnerActorUuid: rootUuid,
};
const physical = (
  columns: number,
  rows: number,
): D6StoragePhysicalProfileV1 => ({
  version: 1,
  provenance: "preset",
  presetId: "test",
  widthMm: null,
  depthMm: null,
  heightMm: null,
  unitTareWeightGrams: 0,
  unitExteriorVolumeMillilitres: 0,
  rotatable: true,
  footprintsByScale: {
    personal: { columns, rows, provenance: "preset" },
  },
  stack: { mode: "single", maxQuantityPerPlacement: 1 },
});
const object = (
  id: string,
  columns: number,
  rows: number,
  extra: Partial<D6StorageObjectV1> = {},
): D6StorageObjectV1 => ({
  version: 1,
  definition: { version: 1, instanceId: id, physical: physical(columns, rows) },
  documentUuid: `${rootUuid}.Item.${id}`,
  ownerActorUuid: rootUuid,
  quantity: 1,
  witness: `${id}:witness`,
  location: { state: "unplaced", rootUuid, disposition: "stored" },
  ...extra,
});
const ledger = (objects: readonly D6StorageObjectV1[]): D6StorageLedgerV1 => ({
  version: 1,
  revision: 7,
  roots: {
    [rootUuid]: {
      version: 1,
      rootUuid,
      kind: "character",
      revision: 7,
      spaces: {
        cargo: {
          id: "cargo",
          label: "Cargo",
          kind: "cargo",
          ownerActorUuid: rootUuid,
          configuration: "grid",
          access: "open",
          grid: {
            version: 1,
            scaleId: "personal",
            scaleLabel: "Personal",
            columns: 4,
            rows: 3,
            cellWidthMm: 100,
            cellDepthMm: 100,
          },
          limits: {
            maxAggregateWeightGrams: null,
            maxOccupiedVolumeMillilitres: null,
            maxDirectChildren: null,
          },
        },
      },
      publicSummary: "none",
    },
  },
  objects: Object.fromEntries(
    objects.map((entry) => [entry.definition.instanceId, entry]),
  ),
});

function moveRequest(
  operationId = "move-1",
): Extract<D6StorageOperationRequestV1, { kind: "move" }> {
  return {
    kind: "move",
    value: {
      version: 1,
      operationId,
      baseRevision: 7,
      instanceId: "tool",
      quantity: "all",
      destination: parent,
      rectangle: { x: 0, y: 2, columns: 3, rows: 1, rotation: "none" },
      disposition: "stored",
      pinned: false,
      ownershipTransfer: {
        mode: "preserve",
        targetOwnerActorUuid: null,
        scope: "object-only",
      },
      witnesses: { tool: "tool:witness" },
    },
  };
}

async function completedReceipt(
  before: D6StorageLedgerV1,
  after: D6StorageLedgerV1,
  request: D6StorageOperationRequestV1,
): Promise<D6StorageTransactionReceiptV1> {
  const beforeLocations = Object.fromEntries(
    Object.entries(after.objects).flatMap(([id, entry]) => {
      const old = before.objects[id];
      return old &&
        JSON.stringify(old.location) !== JSON.stringify(entry.location)
        ? [[id, old.location]]
        : [];
    }),
  );
  const afterLocations = Object.fromEntries(
    Object.entries(beforeLocations).map(([id]) => {
      const object = after.objects[id];
      if (!object) throw new Error(`missing ${id}`);
      return [id, object.location];
    }),
  );
  const initial = await createGridStorageReceipt({
    request,
    requesterUserId: "player",
    authorityUserId: "gm",
    planHash: "plan",
    beforeRevision: before.revision,
    beforeLocations,
    afterLocations,
    undoEligible: true,
  });
  const applied = await advanceGridStorageReceipt(initial, {
    state: "ledger-applied",
    afterRevision: after.revision,
  });
  return advanceGridStorageReceipt(applied, {
    state: "completed",
    response: {
      version: 1,
      operationId: request.value.operationId,
      status: "completed",
      projectionToken: null,
    },
  });
}

describe("grid storage durable transactions", () => {
  it("binds operation replay to both immutable intent and authenticated requester", async () => {
    const state: D6StorageAuthorityStateV1 = {
      version: 1,
      ledger: ledger([object("tool", 3, 1)]),
      receipts: {},
    };
    const request = moveRequest();
    const receipt = await createGridStorageReceipt({
      request,
      requesterUserId: "player",
      authorityUserId: "gm",
      planHash: "plan",
      beforeRevision: 7,
    });
    const recorded = recordGridStorageIntent(state, receipt);
    expect(recordGridStorageIntent(recorded, receipt)).toBe(recorded);
    expect(() =>
      recordGridStorageIntent(recorded, {
        ...receipt,
        requesterUserId: "intruder",
      }),
    ).toThrow(/OperationReplay/);
    await expect(
      recordedGridStorageResponse(receipt, request, "intruder"),
    ).rejects.toThrow(/OperationReplay/);
    await expect(
      recordedGridStorageResponse(
        receipt,
        {
          ...request,
          value: { ...request.value, pinned: true },
        },
        "player",
      ),
    ).rejects.toThrow(/OperationReplay/);
  });

  it("plans the same move contract used by drag and Move To", async () => {
    const before = ledger([object("tool", 3, 1)]);
    const plan = await planGridStorageMove(before, moveRequest().value);
    expect(plan.ledger.objects.tool?.location).toMatchObject({
      state: "placed",
      rectangle: { x: 0, y: 2, columns: 3, rows: 1 },
    });
    expect(plan.beforeLocations.tool).toEqual(before.objects.tool?.location);
    expect(plan.planHash).toHaveLength(64);
  });

  it("packs the exact Supervisor fixture and undoes while post-state still matches", async () => {
    const kit = object("kit", 2, 2, {
      location: {
        state: "placed",
        parent,
        rectangle: { x: 0, y: 0, columns: 2, rows: 2, rotation: "none" },
        disposition: "stored",
        pinned: true,
      },
    });
    const before = ledger([
      kit,
      object("tool", 3, 1),
      object("torch", 1, 2),
      object("ration", 1, 1),
    ]);
    const preview = await previewGridStoragePack(before, {
      version: 1,
      operationId: "pack-1",
      baseRevision: 7,
      parent,
      maxSearchNodes: 10_000,
      witnesses: {
        kit: "kit:witness",
        tool: "tool:witness",
        torch: "torch:witness",
        ration: "ration:witness",
      },
    });
    expect(preview.placements).toMatchObject({
      tool: { x: 0, y: 2 },
      torch: { x: 2, y: 0 },
      ration: { x: 3, y: 0 },
    });
    const request: Extract<D6StorageOperationRequestV1, { kind: "auto-pack" }> =
      {
        kind: "auto-pack",
        value: {
          version: 1,
          operationId: "pack-1",
          baseRevision: 7,
          parent,
          planHash: preview.planHash,
          witnesses: {
            kit: "kit:witness",
            tool: "tool:witness",
            torch: "torch:witness",
            ration: "ration:witness",
          },
        },
      };
    const applied = applyGridStoragePack(before, preview, request.value);
    const receipt = await completedReceipt(before, applied.ledger, request);
    const undone = undoGridStorageLocations(applied.ledger, receipt);
    expect(undone.objects.tool?.location.state).toBe("unplaced");
    const movedTool = applied.ledger.objects.tool;
    if (!movedTool) throw new Error("missing tool fixture");
    expect(() =>
      undoGridStorageLocations(
        {
          ...applied.ledger,
          objects: {
            ...applied.ledger.objects,
            tool: {
              ...movedTool,
              location: { state: "unplaced", rootUuid, disposition: "stored" },
            },
          },
        },
        receipt,
      ),
    ).toThrow(/Stale/);
  });

  it("unpacks direct children to the destination root without deleting them", () => {
    const interior = {
      id: "inside",
      label: "Inside",
      kind: "container" as const,
      ownerActorUuid: rootUuid,
      configuration: "grid" as const,
      access: "open" as const,
      grid: {
        version: 1 as const,
        scaleId: "personal",
        scaleLabel: "Personal",
        columns: 2,
        rows: 2,
        cellWidthMm: 100,
        cellDepthMm: 100,
      },
      limits: {
        maxAggregateWeightGrams: null,
        maxOccupiedVolumeMillilitres: null,
        maxDirectChildren: null,
      },
    };
    const bag = object("bag", 2, 2, {
      definition: {
        version: 1,
        instanceId: "bag",
        physical: physical(2, 2),
        interior,
      },
    });
    const child = object("child", 1, 1, {
      location: {
        state: "placed",
        parent: { ...parent, spaceId: "inside", containerInstanceId: "bag" },
        rectangle: { x: 0, y: 0, columns: 1, rows: 1, rotation: "none" },
        disposition: "stored",
        pinned: false,
      },
    });
    const unpacked = unpackGridStorageContainer(
      ledger([bag, child]),
      "bag",
      rootUuid,
    );
    expect(unpacked.ledger.objects.child?.location).toEqual({
      state: "unplaced",
      rootUuid,
      disposition: "stored",
    });
  });
});
