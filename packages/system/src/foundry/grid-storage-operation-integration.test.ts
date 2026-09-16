import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  effectiveStorageAvailability,
  type D6StorageAvailability,
  type D6StorageAuthorityStateV1,
  type D6StorageLedgerV1,
  type D6StorageOperationRequestV1,
  type D6StorageTransactionReceiptV1,
} from "@d6-system-2e/core";
import type { planGridStorageDocumentWrites } from "./grid-storage-document-adapter.js";

type GridStorageDocumentAdapterModule = Record<string, unknown> & {
  planGridStorageDocumentWrites: typeof planGridStorageDocumentWrites;
};

const f = vi.hoisted(() => ({
  state: undefined as D6StorageAuthorityStateV1 | undefined,
  planCalls: 0,
  applyWrites: vi.fn(),
  compensateWrites: vi.fn(),
  approval: vi.fn(() => Promise.resolve(true)),
  ownerPermission: true,
  custodianPermission: true,
  availability: vi.fn(),
}));

vi.mock("./grid-storage-state.js", () => ({
  runGridStorageAuthorityEffect: (effect: () => Promise<unknown>) => effect(),
  readGridStorageAuthorityState: () =>
    Promise.resolve(structuredClone(f.state)),
  mutateGridStorageAuthorityState: async (
    _expected: number | null,
    mutation: (state: D6StorageAuthorityStateV1) => unknown,
  ) => {
    if (!f.state) throw new Error("missing state");
    const [next, value] = (await mutation(
      structuredClone(f.state),
    )) as readonly [D6StorageAuthorityStateV1, unknown];
    f.state = structuredClone(next);
    return value;
  },
}));
vi.mock("./grid-storage-authority.js", () => ({
  requestGridStorageApproval: f.approval,
  requestGridStorageAvailability: (actorUuid: string, instanceId: string) =>
    f.availability(actorUuid, instanceId) as Promise<D6StorageAvailability>,
  setGridStorageOperationProcessor: vi.fn(),
  setGridStorageProjectionProcessor: vi.fn(),
  setGridStoragePackPreviewProcessor: vi.fn(),
  setGridStorageAvailabilityProcessor: vi.fn(),
  setGridStorageConfigurationProcessor: vi.fn(),
}));
vi.mock("./destiny-crypto.js", () => ({
  destinyClientIsAuthority: () => true,
}));
vi.mock("./foundry-random-id.js", () => ({
  foundryRandomId: () => "reserved",
}));
vi.mock("./grid-storage-document-adapter.js", async (importOriginal) => {
  const actual = await importOriginal<GridStorageDocumentAdapterModule>();
  return {
    ...actual,
    planGridStorageDocumentWrites: (
      ...args: Parameters<typeof actual.planGridStorageDocumentWrites>
    ) => {
      f.planCalls += 1;
      return actual.planGridStorageDocumentWrites(...args);
    },
  };
});
vi.mock("./grid-storage-document-executor.js", () => ({
  applyGridStorageDocumentWrites: f.applyWrites,
  compensateGridStorageDocumentWrites: f.compensateWrites,
}));

import { gridStorageWitness } from "./grid-storage-document-adapter.js";
import {
  processGridStorageOperation,
  resetGridStorageOperationServiceForTests,
} from "./grid-storage-operation-service.js";

const ownerUuid = "Actor.owner";
const rootUuid = "Actor.remote";
const custodianUuid = "Actor.custodian";
const parent = {
  rootUuid,
  spaceId: "cargo",
  containerInstanceId: null,
  spaceOwnerActorUuid: custodianUuid,
} as const;
const gm = { id: "gm", active: true, isGM: true, name: "GM" } as FoundryUser;
const ownerUser = {
  id: "owner-user",
  active: true,
  isGM: false,
  name: "Owner",
} as FoundryUser;
const custodianUser = {
  id: "custodian-user",
  active: true,
  isGM: false,
  name: "Custodian",
} as FoundryUser;
const ownerActor = {
  id: "owner",
  uuid: ownerUuid,
  name: "Owner Actor",
  type: "character",
  testUserPermission: (user: FoundryUser) =>
    user.id === ownerUser.id && f.ownerPermission,
} as unknown as FoundryActorDocument;
const rootActor = {
  id: "remote",
  uuid: rootUuid,
  name: "Remote Root",
  type: "character",
  testUserPermission: (user: FoundryUser) => user.id === custodianUser.id,
} as unknown as FoundryActorDocument;
const custodianActor = {
  id: "custodian",
  uuid: custodianUuid,
  name: "Custodian Actor",
  type: "character",
  testUserPermission: (user: FoundryUser) =>
    user.id === custodianUser.id && f.custodianPermission,
} as unknown as FoundryActorDocument;
const source = {
  _id: "tool-document",
  name: "Tool",
  type: "gear",
  system: {
    storageInstanceId: "tool",
    quantity: 1,
    equipped: false,
  },
};
const sourceItem = {
  id: "tool-document",
  uuid: `${ownerUuid}.Item.tool-document`,
  name: "Tool",
  type: "gear",
  parent: ownerActor,
  system: source.system,
  toObject: () => structuredClone(source),
} as unknown as FoundryItemDocument & {
  uuid: string;
  parent: FoundryActorDocument & { uuid: string };
};

function currentState(): D6StorageAuthorityStateV1 {
  if (!f.state) throw new Error("missing state");
  return f.state;
}

function ledger(witness: string): D6StorageLedgerV1 {
  return {
    version: 1,
    revision: 7,
    roots: {
      [rootUuid]: {
        version: 1,
        rootUuid,
        kind: "character",
        revision: 7,
        publicSummary: "none",
        spaces: {
          cargo: {
            id: "cargo",
            label: "Cargo",
            kind: "cargo",
            ownerActorUuid: custodianUuid,
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
      tool: {
        version: 1,
        definition: {
          version: 1,
          instanceId: "tool",
          physical: {
            version: 1,
            provenance: "preset",
            presetId: "tool",
            widthMm: null,
            depthMm: null,
            heightMm: null,
            unitTareWeightGrams: 0,
            unitExteriorVolumeMillilitres: 0,
            rotatable: true,
            footprintsByScale: {
              personal: { columns: 1, rows: 1, provenance: "preset" },
            },
            stack: { mode: "single", maxQuantityPerPlacement: 1 },
          },
        },
        documentUuid: sourceItem.uuid,
        ownerActorUuid: ownerUuid,
        quantity: 1,
        witness,
        location: {
          state: "placed",
          parent,
          rectangle: {
            x: 0,
            y: 0,
            columns: 1,
            rows: 1,
            rotation: "none",
          },
          disposition: "stored",
          pinned: false,
        },
      },
    },
  };
}

function move(
  changes: Partial<
    Extract<D6StorageOperationRequestV1, { kind: "move" }>["value"]
  > = {},
): Extract<D6StorageOperationRequestV1, { kind: "move" }> {
  const witness = f.state?.ledger.objects.tool?.witness ?? "";
  return {
    kind: "move",
    value: {
      version: 1,
      operationId: "pin-only",
      baseRevision: 7,
      instanceId: "tool",
      quantity: "all",
      destination: parent,
      rectangle: {
        x: 0,
        y: 0,
        columns: 1,
        rows: 1,
        rotation: "none",
      },
      disposition: "stored",
      pinned: true,
      ownershipTransfer: {
        mode: "preserve",
        targetOwnerActorUuid: null,
        scope: "object-only",
      },
      witnesses: { tool: witness },
      ...changes,
    },
  };
}

beforeEach(async () => {
  resetGridStorageOperationServiceForTests();
  source.system.storageInstanceId = "tool";
  source.system.quantity = 1;
  source.system.equipped = false;
  sourceItem.parent = ownerActor as FoundryActorDocument & { uuid: string };
  f.ownerPermission = true;
  f.custodianPermission = true;
  f.planCalls = 0;
  f.approval.mockReset().mockResolvedValue(true);
  f.applyWrites
    .mockReset()
    .mockImplementation((receipt: D6StorageTransactionReceiptV1) =>
      Promise.resolve({
        ...receipt,
        state: "documents-applied" as const,
        writes: receipt.writes.map((write) => ({
          ...write,
          state: "verified" as const,
        })),
      }),
    );
  f.compensateWrites
    .mockReset()
    .mockImplementation((receipt: D6StorageTransactionReceiptV1) =>
      Promise.resolve(receipt),
    );
  f.state = {
    version: 1,
    ledger: ledger(await gridStorageWitness(source)),
    receipts: {},
  };
  f.availability
    .mockReset()
    .mockImplementation((actorUuid: string, instanceId: string) =>
      Promise.resolve(
        effectiveStorageAvailability(
          currentState().ledger,
          instanceId,
          actorUuid,
        ),
      ),
    );
  vi.stubGlobal("game", {
    user: gm,
    users: {
      contents: [gm, ownerUser, custodianUser],
      get: (id: string) =>
        [gm, ownerUser, custodianUser].find((user) => user.id === id),
    },
  });
  vi.stubGlobal("Hooks", { on: vi.fn() });
  vi.stubGlobal(
    "fromUuid",
    vi.fn((uuid: string) =>
      Promise.resolve(
        uuid === ownerUuid
          ? ownerActor
          : uuid === rootUuid
            ? rootActor
            : uuid === custodianUuid
              ? custodianActor
              : uuid === sourceItem.uuid
                ? sourceItem
                : null,
      ),
    ),
  );
});

describe("grid storage operation service with real availability and document planning", () => {
  it("denies equipping an owner-preserved Item stored under another root", async () => {
    await expect(
      processGridStorageOperation(
        move({
          operationId: "remote-placed-equip",
          disposition: "equipped",
          pinned: false,
        }),
        ownerUser,
      ),
    ).resolves.toMatchObject({
      status: "denied",
      issue: "destination-unavailable",
    });
    expect(f.planCalls).toBe(0);
    expect(f.applyWrites).not.toHaveBeenCalled();
    expect(currentState().ledger.objects.tool?.location).toMatchObject({
      state: "placed",
      disposition: "stored",
    });
  });

  it("places ordinary Gear without planning an unsupported installed-field write", async () => {
    const state = currentState();
    const current = state.ledger.objects.tool;
    if (!current) throw new Error("missing tool fixture");
    f.state = {
      ...state,
      ledger: {
        ...state.ledger,
        objects: {
          tool: {
            ...current,
            location: {
              state: "unplaced",
              rootUuid,
              disposition: "carried",
            },
          },
        },
      },
    };

    await expect(
      processGridStorageOperation(
        move({ operationId: "place-gear", pinned: false }),
        ownerUser,
      ),
    ).resolves.toMatchObject({ status: "completed" });
    expect(f.planCalls).toBe(1);
    expect(f.applyWrites).not.toHaveBeenCalled();
    expect(currentState().ledger.objects.tool?.location).toMatchObject({
      state: "placed",
      parent,
      disposition: "stored",
    });
  });

  it("changes only pin state when an owner Item is held in another Actor's space", async () => {
    await expect(
      processGridStorageOperation(move(), ownerUser),
    ).resolves.toMatchObject({ status: "completed" });
    expect(f.planCalls).toBe(1);
    expect(f.applyWrites).not.toHaveBeenCalled();
    expect(f.state?.ledger.objects.tool).toMatchObject({
      documentUuid: sourceItem.uuid,
      ownerActorUuid: ownerUuid,
      location: { pinned: true, parent },
    });
  });

  it("denies remote destinationless Equip through the real availability path", async () => {
    const state = currentState();
    const current = state.ledger.objects.tool;
    if (!current) throw new Error("missing tool fixture");
    f.state = {
      ...state,
      ledger: {
        ...state.ledger,
        objects: {
          tool: {
            ...current,
            location: {
              state: "unplaced",
              rootUuid,
              disposition: "carried",
            },
          },
        },
      },
    };
    await expect(
      processGridStorageOperation(
        move({
          operationId: "remote-equip",
          destination: null,
          rectangle: null,
          disposition: "equipped",
          pinned: false,
        }),
        custodianUser,
      ),
    ).resolves.toMatchObject({
      status: "denied",
      issue: "destination-unavailable",
    });
    expect(f.planCalls).toBe(0);
    expect(f.applyWrites).not.toHaveBeenCalled();
  });

  it("does not let a location controller pin an Item without its owner's approval", async () => {
    f.approval.mockResolvedValueOnce(false);
    await expect(
      processGridStorageOperation(move(), custodianUser),
    ).resolves.toMatchObject({ status: "denied", issue: "cancelled" });
    expect(f.state?.ledger.revision).toBe(7);
    expect(f.state?.ledger.objects.tool?.location).toMatchObject({
      pinned: false,
    });
    expect(f.applyWrites).not.toHaveBeenCalled();
  });

  it("permits owner-local unknown-geometry Equip and authorized remote Unequip", async () => {
    const state = currentState();
    const current = state.ledger.objects.tool;
    if (!current) throw new Error("missing tool fixture");
    f.state = {
      ...state,
      ledger: {
        ...state.ledger,
        objects: {
          tool: {
            ...current,
            definition: {
              ...current.definition,
              physical: {
                ...current.definition.physical,
                provenance: "unknown",
                presetId: null,
                footprintsByScale: {},
              },
            },
            location: {
              state: "unplaced",
              rootUuid: ownerUuid,
              disposition: "carried",
            },
          },
        },
      },
    };
    await expect(
      processGridStorageOperation(
        move({
          operationId: "local-equip",
          destination: null,
          rectangle: null,
          disposition: "equipped",
          pinned: false,
        }),
        ownerUser,
      ),
    ).resolves.toMatchObject({ status: "completed" });
    expect(currentState().ledger.objects.tool?.location).toMatchObject({
      state: "unplaced",
      disposition: "equipped",
    });

    source.system.equipped = true;
    const equippedState = currentState();
    const equipped = equippedState.ledger.objects.tool;
    if (!equipped) throw new Error("missing equipped tool fixture");
    f.state = {
      ...equippedState,
      ledger: {
        ...equippedState.ledger,
        revision: 8,
        objects: {
          tool: {
            ...equipped,
            witness: await gridStorageWitness(source),
            location: {
              state: "unplaced",
              rootUuid,
              disposition: "equipped",
            },
          },
        },
      },
    };
    await expect(
      processGridStorageOperation(
        move({
          operationId: "remote-unequip",
          baseRevision: 8,
          destination: null,
          rectangle: null,
          disposition: "carried",
          pinned: false,
        }),
        ownerUser,
      ),
    ).resolves.toMatchObject({ status: "completed" });
    expect(currentState().ledger.objects.tool?.location).toMatchObject({
      state: "unplaced",
      rootUuid,
      disposition: "carried",
    });
  });

  it.each([
    ["quantity", () => (source.system.quantity = 2)],
    ["instance identity", () => (source.system.storageInstanceId = "drifted")],
    [
      "parent",
      () =>
        (sourceItem.parent = custodianActor as FoundryActorDocument & {
          uuid: string;
        }),
    ],
  ])(
    "denies live %s drift before invoking the document planner",
    async (_label, drift) => {
      drift();
      await expect(
        processGridStorageOperation(move(), ownerUser),
      ).resolves.toMatchObject({ status: "denied", issue: "stale" });
      expect(f.planCalls).toBe(0);
      expect(f.applyWrites).not.toHaveBeenCalled();
      expect(f.state?.receipts).toEqual({});
    },
  );

  it("rechecks requester authority after an external approval wait", async () => {
    f.approval.mockImplementationOnce(() => {
      f.ownerPermission = false;
      return Promise.resolve(true);
    });
    await expect(
      processGridStorageOperation(move(), ownerUser),
    ).resolves.toMatchObject({ status: "denied", issue: "authority" });
    expect(f.applyWrites).not.toHaveBeenCalled();
    expect(f.state?.ledger.revision).toBe(7);
  });
});
