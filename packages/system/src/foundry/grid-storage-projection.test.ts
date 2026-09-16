import { beforeEach, describe, expect, it, vi } from "vitest";
import type { D6StorageLedgerV1 } from "@d6-system-2e/core";
import {
  buildGridStorageWorkspace,
  gridStorageEntryPoint,
} from "./grid-storage-projection.js";

const rootUuid = "Actor.root";
const player = { id: "player", active: true, isGM: false } as FoundryUser;
const physical = (known: boolean) => ({
  version: 1 as const,
  provenance: known ? ("preset" as const) : ("unknown" as const),
  presetId: known ? "test" : null,
  widthMm: null,
  depthMm: null,
  heightMm: null,
  unitTareWeightGrams: 0,
  unitExteriorVolumeMillilitres: 0,
  rotatable: true,
  footprintsByScale: known
    ? { personal: { columns: 1, rows: 1, provenance: "preset" as const } }
    : {},
  stack: { mode: "single" as const, maxQuantityPerPlacement: 1 },
});
const parent = {
  rootUuid,
  spaceId: "cargo",
  containerInstanceId: null,
  spaceOwnerActorUuid: rootUuid,
} as const;
const ledger: D6StorageLedgerV1 = {
  version: 1,
  revision: 2,
  roots: {
    [rootUuid]: {
      version: 1,
      rootUuid,
      kind: "character",
      revision: 2,
      publicSummary: "none",
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
        },
      },
    },
  },
  objects: {
    placed: {
      version: 1,
      definition: {
        version: 1,
        instanceId: "placed",
        physical: physical(true),
      },
      documentUuid: `${rootUuid}.Item.placed`,
      ownerActorUuid: rootUuid,
      quantity: 1,
      witness: "placed",
      location: {
        state: "placed",
        parent,
        rectangle: { x: 0, y: 0, columns: 1, rows: 1, rotation: "none" },
        disposition: "equipped",
        pinned: false,
      },
    },
    unknown: {
      version: 1,
      definition: {
        version: 1,
        instanceId: "unknown",
        physical: physical(false),
      },
      documentUuid: `${rootUuid}.Item.unknown`,
      ownerActorUuid: rootUuid,
      quantity: 1,
      witness: "unknown",
      location: { state: "unplaced", rootUuid, disposition: "carried" },
    },
    listed: {
      version: 1,
      definition: {
        version: 1,
        instanceId: "listed",
        physical: physical(false),
      },
      documentUuid: `${rootUuid}.Item.listed`,
      ownerActorUuid: rootUuid,
      quantity: 1,
      witness: "listed",
      location: {
        state: "listed",
        parent,
        disposition: "equipped",
        pinned: true,
      },
    },
  },
};
let observer = true;
let owner = true;
const actorItems: FoundryItemDocument[] = [];
const actor = {
  id: "root",
  uuid: rootUuid,
  name: "Root",
  type: "character",
  img: "actor.svg",
  isOwner: true,
  system: { storage: { configured: true } },
  items: { contents: actorItems },
  testUserPermission: (_user: FoundryUser, permission: string) =>
    permission === "OBSERVER" ? observer : owner,
} as unknown as FoundryActorDocument & { uuid: string };
const remoteOwnerActor = {
  ...actor,
  id: "owner",
  uuid: "Actor.owner",
  name: "Owner",
} as FoundryActorDocument & { uuid: string };
const items = new Map([
  [
    `${rootUuid}.Item.placed`,
    {
      id: "placed",
      uuid: `${rootUuid}.Item.placed`,
      name: "Placed",
      img: "placed.svg",
    },
  ],
  [
    `${rootUuid}.Item.unknown`,
    {
      id: "unknown",
      uuid: `${rootUuid}.Item.unknown`,
      name: "Unknown",
      img: "unknown.svg",
    },
  ],
  [
    `${rootUuid}.Item.listed`,
    {
      id: "listed",
      uuid: `${rootUuid}.Item.listed`,
      name: "Listed",
      img: "listed.svg",
    },
  ],
]);

beforeEach(() => {
  observer = true;
  owner = true;
  actorItems.length = 0;
  vi.stubGlobal("game", {
    i18n: { localize: (key: string) => key },
    user: player,
  });
  vi.stubGlobal(
    "fromUuid",
    vi.fn((uuid: string) =>
      Promise.resolve(
        uuid === rootUuid
          ? actor
          : uuid === remoteOwnerActor.uuid
            ? remoteOwnerActor
            : (items.get(uuid) ?? null),
      ),
    ),
  );
});

describe("grid storage permission projection", () => {
  it("exposes root removal only to the projected GM requester", async () => {
    const playerValue = await buildGridStorageWorkspace({
      actor,
      ledger,
      user: player,
    });
    const gmValue = await buildGridStorageWorkspace({
      actor,
      ledger,
      user: { id: "gm", active: true, isGM: true } as FoundryUser,
    });

    expect(playerValue?.spaceEditor?.canRemoveRoot).toBe(false);
    expect(gmValue?.spaceEditor).toMatchObject({
      canRemoveRoot: true,
      removeAction: "removeStorageRoot",
    });
  });

  it("labels the standalone storage entry point as a storage location", () => {
    expect(
      gridStorageEntryPoint({
        ...actor,
        type: "storage-location",
      }),
    ).toMatchObject({
      context: "storage-location-sheet",
      summary: "D6E2.Storage.StorageLocation",
    });
  });

  it("omits the workspace for an unconfigured root, preserving existing inventory", async () => {
    actor.system.storage = { configured: false };
    await expect(
      buildGridStorageWorkspace({ actor, ledger, user: player }),
    ).resolves.toBeNull();
    actor.system.storage = { configured: true };
  });

  it("redacts revision, geometry, capacity, and item existence from a partial observer", async () => {
    observer = false;
    const value = await buildGridStorageWorkspace({
      actor,
      ledger,
      user: player,
    });
    expect(value).toMatchObject({
      revision: null,
      viewMode: "redacted",
      columns: null,
      rows: null,
      items: [],
      unplaced: [],
      canAutoPack: false,
    });
    expect(value?.capacities.every(({ state }) => state === "hidden")).toBe(
      true,
    );
  });

  it("projects full controls only with complete visibility and excludes unknown footprints from placement", async () => {
    const value = await buildGridStorageWorkspace({
      actor,
      ledger,
      user: player,
    });
    expect(value?.items[0]).toMatchObject({
      instanceId: "placed",
      canUse: true,
      canEquip: true,
      equipLabel: "D6E2.Storage.Unequip",
    });
    expect(value?.unplaced[0]).toMatchObject({
      instanceId: "unknown",
      measurementState: "unknown-footprint",
      canPlace: false,
    });
    expect(value?.items[1]).toMatchObject({
      instanceId: "listed",
      listed: true,
      columns: 0,
      rows: 0,
      canUnequip: true,
      equipLabel: "D6E2.Storage.Unequip",
    });
    expect(value).toMatchObject({
      revision: 2,
      columns: 2,
      rows: 2,
      canAutoPack: true,
    });
  });

  it("keeps an owned raw supported Item reachable for configuration without inventing a ledger identity", async () => {
    actorItems.push({
      id: "raw",
      uuid: `${rootUuid}.Item.raw`,
      name: "New Gear",
      img: "raw.svg",
      type: "gear",
      system: { quantity: 3, storageInstanceId: "" },
    } as unknown as FoundryItemDocument);

    const value = await buildGridStorageWorkspace({
      actor,
      ledger,
      user: player,
    });

    expect(value?.unplaced.at(-1)).toEqual({
      instanceId: "",
      documentUuid: `${rootUuid}.Item.raw`,
      name: "New Gear",
      image: "raw.svg",
      quantity: 3,
      footprintLabel: "D6E2.Storage.SizeNeeded",
      measurementState: "unknown-footprint",
      canPlace: false,
      canConfigure: true,
      canUse: false,
      canEquip: false,
      canUnequip: false,
      equipLabel: "",
      unavailableReason: "D6E2.Storage.ConfigureBeforePlacement",
    });
    expect(Object.hasOwn(ledger.objects, "")).toBe(false);
  });

  it("does not disclose raw unenrolled Items without owner permission", async () => {
    actorItems.push({
      id: "raw",
      uuid: `${rootUuid}.Item.raw`,
      name: "New Gear",
      img: "raw.svg",
      type: "gear",
      system: { quantity: 1, storageInstanceId: "" },
    } as unknown as FoundryItemDocument);
    owner = false;

    const value = await buildGridStorageWorkspace({
      actor,
      ledger,
      user: player,
    });

    expect(
      value?.unplaced.some(({ documentUuid }) => Boolean(documentUuid)),
    ).toBe(false);
  });

  it("does not offer Use or Equip for an owner-preserved Item stored under another root", async () => {
    const placed = ledger.objects.placed;
    if (!placed) throw new Error("missing placed fixture");
    const remoteLedger: D6StorageLedgerV1 = {
      ...ledger,
      objects: {
        ...ledger.objects,
        placed: { ...placed, ownerActorUuid: remoteOwnerActor.uuid },
      },
    };
    const value = await buildGridStorageWorkspace({
      actor,
      ledger: remoteLedger,
      user: player,
    });
    expect(
      value?.items.find(({ instanceId }) => instanceId === "placed"),
    ).toMatchObject({ canUse: false, canEquip: false });
  });

  it("offers Place for an unplaced Item in a capacity-only space", async () => {
    const root = ledger.roots[rootUuid];
    const cargo = root?.spaces.cargo;
    if (!root || !cargo) throw new Error("missing cargo space");
    const capacityLedger: D6StorageLedgerV1 = {
      ...ledger,
      roots: {
        ...ledger.roots,
        [rootUuid]: {
          ...root,
          spaces: {
            ...root.spaces,
            cargo: { ...cargo, configuration: "capacity-only", grid: null },
          },
        },
      },
    };

    const value = await buildGridStorageWorkspace({
      actor,
      ledger: capacityLedger,
      user: player,
    });

    expect(
      value?.unplaced.find(({ instanceId }) => instanceId === "unknown"),
    ).toMatchObject({ canPlace: true, measurementState: "unknown-footprint" });
    expect(value).toMatchObject({
      spaceMode: "capacity-only",
      viewMode: "list",
      cellSizeLabel: "D6E2.Storage.CapacityOnly",
    });
    expect(value?.capacities.map(({ id }) => id)).toEqual([
      "weight",
      "volume",
      "count",
    ]);
  });
});
