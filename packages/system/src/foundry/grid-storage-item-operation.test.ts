import { beforeEach, describe, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({
  operation: vi.fn(),
  projection: vi.fn(),
}));

vi.mock("./grid-storage-authority.js", () => ({
  requestGridStorageOperation: f.operation,
  requestGridStorageProjection: f.projection,
}));
vi.mock("./foundry-random-id.js", () => ({
  foundryRandomId: () => "operation-id",
}));

import {
  requireGridStorageInstalledDestination,
  setGridStorageItemDisposition,
  setGridStorageItemQuantity,
} from "./grid-storage-item-operation.js";

const actor = {
  uuid: "Actor.acting",
} as FoundryActorDocument & { readonly uuid: string };
const object = (disposition: "carried" | "equipped") => ({
  version: 1 as const,
  definition: { version: 1 as const, instanceId: "item", physical: {} },
  documentUuid: "Actor.remote.Item.item",
  ownerActorUuid: "Actor.remote",
  quantity: 1,
  witness: "witness",
  location: {
    state: "unplaced" as const,
    rootUuid: "Actor.acting",
    disposition,
  },
});

beforeEach(() => {
  f.operation.mockReset().mockResolvedValue({
    version: 1,
    operationId: "operation-id",
    status: "completed",
    projectionToken: null,
  });
  f.projection.mockReset().mockResolvedValue({
    workspace: { revision: 9 },
    objects: { item: object("equipped") },
    destinations: [],
    latestUndo: null,
  });
});

describe("grid storage Item operations", () => {
  it("allows a controlled carrier to unequip a remotely owned equipped Item", async () => {
    await expect(
      setGridStorageItemDisposition(actor, "item", "carried"),
    ).resolves.toBe(true);
    const call = f.operation.mock.calls[0] as unknown as
      readonly [{ readonly kind: string; readonly value: unknown }] | undefined;
    expect(call?.[0]).toMatchObject({
      kind: "move",
      value: {
        operationId: "operation-id",
        baseRevision: 9,
        instanceId: "item",
        destination: null,
        disposition: "carried",
        witnesses: { item: "witness" },
      },
    });
  });

  it("does not let the carrier equip a remotely owned carried Item", async () => {
    f.projection.mockResolvedValue({
      workspace: { revision: 9 },
      objects: { item: object("carried") },
      destinations: [],
      latestUndo: null,
    });
    await expect(
      setGridStorageItemDisposition(actor, "item", "equipped"),
    ).resolves.toBe(false);
    expect(f.operation).not.toHaveBeenCalled();
  });

  it("routes quantity edits through the witnessed quantity operation", async () => {
    await expect(
      setGridStorageItemQuantity(actor, "item", 0, "consume"),
    ).resolves.toBe(true);
    expect(f.operation).toHaveBeenCalledWith({
      kind: "quantity",
      value: {
        version: 1,
        operationId: "consume",
        baseRevision: 9,
        instanceId: "item",
        actingActorUuid: "Actor.acting",
        targetQuantity: 0,
        witnesses: { item: "witness" },
      },
    });
  });

  it("requires participating cybernetics to have a concrete destination before installation", async () => {
    await expect(
      requireGridStorageInstalledDestination(actor, "item"),
    ).rejects.toThrow("D6E2.Storage.Error.DestinationUnavailable");
    await expect(
      setGridStorageItemDisposition(actor, "item", "installed"),
    ).resolves.toBe(false);
    expect(f.operation).not.toHaveBeenCalled();
  });
});
