import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  effectiveStorageAvailability,
  type D6StorageLedgerV1,
} from "@d6-system-2e/core";
const f: {
  ledger: D6StorageLedgerV1;
  requestAvailability: ReturnType<typeof vi.fn>;
} = vi.hoisted(() => ({
  ledger: { version: 1, revision: 0, roots: {}, objects: {} },
  requestAvailability: vi.fn(),
}));
vi.mock("./grid-storage-authority.js", () => ({
  requestGridStorageAvailability: f.requestAvailability,
}));
import {
  effectiveGridStorageArmorItemIds,
  gridStorageAvailabilityForItem,
  requireGridStorageItemAction,
} from "./grid-storage-availability.js";

const item = (instanceId: string) =>
  ({
    system: { storageInstanceId: instanceId },
  }) as unknown as FoundryItemDocument;

beforeEach(() => {
  f.ledger = { version: 1, revision: 0, roots: {}, objects: {} };
  f.requestAvailability
    .mockReset()
    .mockImplementation((actorUuid: string, instanceId: string) =>
      Promise.resolve(
        effectiveStorageAvailability(f.ledger, instanceId, actorUuid),
      ),
    );
});

describe("central grid storage availability guard", () => {
  it("preserves unrestricted legacy behavior before an item participates", async () => {
    await expect(
      gridStorageAvailabilityForItem(item(""), "Actor.owner"),
    ).resolves.toMatchObject({
      configured: false,
      canUse: true,
      canEquip: true,
    });
    for (const action of [
      "use",
      "equip",
      "effect",
      "armor",
      "attack",
      "installed",
    ] as const)
      await expect(
        requireGridStorageItemAction(item(""), "Actor.owner", action),
      ).resolves.toMatchObject({ configured: false });
  });

  it("blocks use, equip, attack, and armor when a participating item is remote or closed", async () => {
    f.ledger = {
      version: 1,
      revision: 1,
      roots: {
        "Actor.remote": {
          version: 1,
          rootUuid: "Actor.remote",
          kind: "character",
          revision: 1,
          publicSummary: "none",
          spaces: {
            cargo: {
              id: "cargo",
              label: "Cargo",
              kind: "cargo",
              ownerActorUuid: "Actor.remote",
              configuration: "capacity-only",
              access: "closed",
              grid: null,
              limits: {
                maxAggregateWeightGrams: null,
                maxOccupiedVolumeMillilitres: null,
                maxDirectChildren: null,
              },
            },
          },
        },
      },
      objects: {
        tool: {
          version: 1,
          definition: {
            version: 1,
            instanceId: "tool",
            physical: {
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
            },
          },
          documentUuid: "Actor.owner.Item.tool",
          ownerActorUuid: "Actor.owner",
          quantity: 1,
          witness: "w",
          location: {
            state: "listed",
            parent: {
              rootUuid: "Actor.remote",
              spaceId: "cargo",
              containerInstanceId: null,
              spaceOwnerActorUuid: "Actor.remote",
            },
            disposition: "equipped",
            pinned: false,
          },
        },
      },
    };
    for (const action of ["use", "equip", "effect", "armor", "attack"] as const)
      await expect(
        requireGridStorageItemAction(item("tool"), "Actor.owner", action),
      ).rejects.toThrow(/Unavailable/);
  });

  it("blocks a participating unplaced item when it belongs to another root or is installed", async () => {
    const base = {
      version: 1 as const,
      definition: {
        version: 1 as const,
        instanceId: "tool",
        physical: {
          version: 1 as const,
          provenance: "unknown" as const,
          presetId: null,
          widthMm: null,
          depthMm: null,
          heightMm: null,
          unitTareWeightGrams: null,
          unitExteriorVolumeMillilitres: null,
          rotatable: true,
          footprintsByScale: {},
          stack: { mode: "single" as const, maxQuantityPerPlacement: 1 },
        },
      },
      documentUuid: "Actor.remote.Item.tool",
      ownerActorUuid: "Actor.remote",
      quantity: 1,
      witness: "w",
    };
    f.ledger = {
      version: 1,
      revision: 1,
      roots: {},
      objects: {
        tool: {
          ...base,
          location: {
            state: "unplaced",
            rootUuid: "Actor.remote",
            disposition: "carried",
          },
        },
      },
    };
    await expect(
      requireGridStorageItemAction(item("tool"), "Actor.owner", "use"),
    ).rejects.toThrow(/Unavailable/);
    f.ledger = {
      ...f.ledger,
      objects: {
        tool: {
          ...base,
          location: {
            state: "unplaced",
            rootUuid: "Actor.owner",
            disposition: "installed",
          },
        },
      },
    };
    await expect(
      requireGridStorageItemAction(item("tool"), "Actor.owner", "equip"),
    ).rejects.toThrow(/Unavailable/);
  });

  it("fails closed when a nonempty storage identity is missing from the authority ledger", async () => {
    f.ledger = { version: 1, revision: 1, roots: {}, objects: {} };
    await expect(
      gridStorageAvailabilityForItem(item("missing"), "Actor.owner"),
    ).resolves.toMatchObject({
      configured: true,
      reachable: false,
      canUse: false,
      canEquip: false,
      effectiveEquipped: false,
    });
    await expect(
      requireGridStorageItemAction(item("missing"), "Actor.owner", "attack"),
    ).rejects.toThrow(/Unavailable/);
  });

  it("filters participating remote armor while retaining legacy and effective armor", async () => {
    const armor = (
      id: string,
      storageInstanceId: string,
    ): FoundryItemDocument =>
      ({
        id,
        type: "armor",
        system: { equipped: true, storageInstanceId },
      }) as unknown as FoundryItemDocument;
    f.requestAvailability.mockImplementation(
      (_actorUuid: string, instanceId: string) =>
        Promise.resolve({
          configured: true,
          reachable: instanceId === "local",
          canUse: instanceId === "local",
          canEquip: instanceId === "local",
          effectiveEquipped: instanceId === "local",
          effectiveInstalled: false,
        }),
    );
    const actor = {
      uuid: "Actor.owner",
      items: {
        contents: [
          armor("legacy", ""),
          armor("remote", "remote"),
          armor("local", "local"),
        ],
      },
    } as unknown as FoundryActorDocument & { uuid: string };

    await expect(effectiveGridStorageArmorItemIds(actor)).resolves.toEqual(
      new Set(["legacy", "local"]),
    );
  });
});
