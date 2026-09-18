import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  D6StorageAuthorityStateV1,
  D6StorageLedgerV1,
  D6StorageObjectV1,
  D6StorageOperationRequestV1,
  D6StoragePhysicalProfileV1,
  D6StorageTransactionReceiptV1,
} from "@d6-system-2e/core";
import {
  advanceGridStorageReceipt,
  createGridStorageReceipt,
  storageHash,
} from "../application/grid-storage-transactions.js";

const f = vi.hoisted(() => ({
  readState: vi.fn(),
  state: undefined as D6StorageAuthorityStateV1 | undefined,
  approval: vi.fn(() => Promise.resolve(true)),
  processor: vi.fn(),
  projectionProcessor: vi.fn(),
  packPreviewProcessor: vi.fn(),
  movePreviewProcessor: vi.fn(),
  availabilityProcessor: vi.fn(),
  configurationProcessor: vi.fn(),
  documentPlan: vi.fn(),
  quantityWrite: vi.fn(),
  applyWrites:
    vi.fn<
      (
        receipt: D6StorageTransactionReceiptV1,
      ) => Promise<D6StorageTransactionReceiptV1>
    >(),
  compensateWrites:
    vi.fn<
      (
        receipt: D6StorageTransactionReceiptV1,
      ) => Promise<D6StorageTransactionReceiptV1>
    >(),
  requireAction: vi.fn(() => Promise.resolve({ canEquip: true })),
  witness: vi.fn((value?: unknown) => {
    void value;
    return Promise.resolve("tool:witness");
  }),
  playerControls: true,
  revokeOnIntent: false,
  hook: vi.fn(),
  reconcile: vi.fn(() => Promise.resolve()),
  randomId: vi.fn((length = 24) =>
    length === 16 ? "AbCdEfGhIjKlMnOp" : "reserved",
  ),
}));
vi.mock("./grid-storage-state.js", () => ({
  runGridStorageAuthorityEffect: (effect: () => Promise<unknown>) => effect(),
  readGridStorageAuthorityState: () => {
    f.readState();
    return Promise.resolve(structuredClone(f.state));
  },
  mutateGridStorageAuthorityState: async (
    _expected: number | null,
    mutation: (state: D6StorageAuthorityStateV1) => unknown,
  ) => {
    if (!f.state) throw new Error("missing fixture state");
    const result = await mutation(structuredClone(f.state));
    const [next, value] = result as readonly [
      D6StorageAuthorityStateV1,
      unknown,
    ];
    f.state = structuredClone(next);
    if (
      f.revokeOnIntent &&
      Object.values(next.receipts).some(
        (receipt) => receipt.state === "intent-recorded",
      )
    ) {
      f.playerControls = false;
      f.revokeOnIntent = false;
    }
    return value;
  },
}));
vi.mock("./grid-storage-authority.js", () => ({
  requestGridStorageApproval: f.approval,
  setGridStorageOperationProcessor: f.processor,
  setGridStorageProjectionProcessor: f.projectionProcessor,
  setGridStoragePackPreviewProcessor: f.packPreviewProcessor,
  setGridStorageMovePreviewProcessor: f.movePreviewProcessor,
  setGridStorageAvailabilityProcessor: f.availabilityProcessor,
  setGridStorageConfigurationProcessor: f.configurationProcessor,
}));
vi.mock("./destiny-crypto.js", () => ({
  destinyClientIsAuthority: () => true,
}));
vi.mock("./foundry-random-id.js", () => ({
  foundryRandomId: f.randomId,
}));
vi.mock("./grid-storage-document-adapter.js", () => ({
  GRID_STORAGE_ITEM_TYPES: [
    "armor",
    "cybernetic",
    "gear",
    "starship-gear",
    "starship-weapon",
    "vehicle",
    "vehicle-gear",
    "vehicle-weapon",
    "weapon",
  ],
  gridStorageDocumentMatchesWitness: async (value: unknown, witness: string) =>
    (await f.witness(value)) === witness,
  gridStorageWitness: f.witness,
  planGridStorageDocumentWrites: f.documentPlan,
  planGridStorageQuantityWrite: f.quantityWrite,
}));
vi.mock("./grid-storage-document-executor.js", () => ({
  applyGridStorageDocumentWrites: f.applyWrites,
  compensateGridStorageDocumentWrites: f.compensateWrites,
}));
vi.mock("./grid-storage-availability.js", () => ({
  requireGridStorageItemAction: f.requireAction,
}));
vi.mock("./grid-storage-mutation-guard.js", () => ({
  GRID_STORAGE_AUTHORITY_WRITE_OPTION: "d6GridStorageAuthorityWrite",
  reconcileGridStorageItemWitnesses: f.reconcile,
}));

import {
  previewGridStorageAutoPack,
  previewGridStorageMove,
  projectGridStorageForUser,
  projectGridStorageAvailabilityBatch,
  projectGridStorageAvailability,
  processGridStorageOperation,
  recoverGridStorageOperations,
  registerGridStorageOperationService,
  resetGridStorageOperationServiceForTests,
} from "./grid-storage-operation-service.js";

const rootUuid = "Actor.root";
const parent = {
  rootUuid,
  spaceId: "cargo",
  containerInstanceId: null,
  spaceOwnerActorUuid: rootUuid,
} as const;
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
  footprintsByScale: { personal: { columns, rows, provenance: "preset" } },
  stack: { mode: "single", maxQuantityPerPlacement: 1 },
});
const object = (
  id: string,
  columns: number,
  rows: number,
  location: D6StorageObjectV1["location"] = {
    state: "unplaced",
    rootUuid,
    disposition: "stored",
  },
): D6StorageObjectV1 => ({
  version: 1,
  definition: { version: 1, instanceId: id, physical: physical(columns, rows) },
  documentUuid: `${rootUuid}.Item.${id}`,
  ownerActorUuid: rootUuid,
  quantity: 1,
  witness: `${id}:witness`,
  location,
});
const makeLedger = (): D6StorageLedgerV1 => ({
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
    },
  },
  objects: {
    kit: object("kit", 2, 2, {
      state: "placed",
      parent,
      rectangle: { x: 0, y: 0, columns: 2, rows: 2, rotation: "none" },
      disposition: "stored",
      pinned: true,
    }),
    tool: object("tool", 3, 1),
    torch: object("torch", 1, 2),
    ration: object("ration", 1, 1),
  },
});
const gm = { id: "gm", active: true, isGM: true, name: "GM" } as FoundryUser;
const player = {
  id: "player",
  active: true,
  isGM: false,
  name: "Player",
} as FoundryUser;
const intruder = {
  id: "intruder",
  active: true,
  isGM: false,
  name: "Intruder",
} as FoundryUser;
const actor = {
  id: "root",
  uuid: rootUuid,
  name: "Root",
  type: "character",
  system: { storage: { configured: true } },
  items: { contents: [] },
  testUserPermission: (user: FoundryUser) =>
    user.id === "player" && f.playerControls,
} as unknown as FoundryActorDocument;
const item = {
  id: "tool",
  uuid: `${rootUuid}.Item.tool`,
  type: "gear",
  parent: actor,
  system: { storageInstanceId: "tool", quantity: 1 },
  toObject: () => ({
    _id: "tool",
    type: "gear",
    system: { storageInstanceId: "tool", quantity: 1 },
  }),
} as unknown as FoundryItemDocument;

beforeEach(() => {
  resetGridStorageOperationServiceForTests();
  f.readState.mockReset();
  f.state = { version: 1, ledger: makeLedger(), receipts: {} };
  f.approval.mockClear();
  f.processor.mockClear();
  f.projectionProcessor.mockClear();
  f.packPreviewProcessor.mockClear();
  f.movePreviewProcessor.mockClear();
  f.availabilityProcessor.mockClear();
  f.configurationProcessor.mockClear();
  f.requireAction.mockClear();
  f.witness.mockReset().mockResolvedValue("tool:witness");
  f.playerControls = true;
  f.revokeOnIntent = false;
  (item as unknown as { type: string }).type = "gear";
  item.system.equipped = false;
  item.system.installed = false;
  item.system.quantity = 1;
  item.system.storageInstanceId = "tool";
  f.hook.mockClear();
  f.reconcile.mockClear();
  f.randomId.mockClear();
  f.documentPlan.mockReset().mockResolvedValue({
    reservedIdentities: [],
    writes: [],
    movedInstanceId: "tool",
    movedDocumentUuid: "Actor.root.Item.tool",
  });
  f.quantityWrite.mockReset().mockResolvedValue({
    sequence: 0,
    kind: "update",
    documentUuid: item.uuid,
    before: {
      documentUuid: item.uuid,
      parentActorUuid: rootUuid,
      source: item.toObject(),
      witness: "tool:witness",
    },
    after: {
      documentUuid: item.uuid,
      parentActorUuid: rootUuid,
      source: {
        ...item.toObject(),
        system: { storageInstanceId: "", quantity: 0 },
      },
      witness: "tool:depleted",
    },
    state: "planned",
  });
  f.applyWrites.mockReset();
  f.compensateWrites
    .mockReset()
    .mockImplementation((receipt) => Promise.resolve(receipt));
  vi.stubGlobal("game", {
    user: gm,
    users: {
      contents: [gm, player, intruder],
      get: (id: string) =>
        [gm, player, intruder].find((user) => user.id === id),
    },
    i18n: {
      localize: (key: string) => key,
      format: (key: string) => key,
    },
  });
  vi.stubGlobal("foundry", {
    applications: { handlebars: { renderTemplate: () => Promise.resolve("") } },
  });
  vi.stubGlobal("Hooks", { on: f.hook });
  vi.stubGlobal(
    "fromUuid",
    vi.fn((uuid: string) =>
      Promise.resolve(
        uuid === rootUuid ? actor : uuid === item.uuid ? item : null,
      ),
    ),
  );
});

const move = (): Extract<D6StorageOperationRequestV1, { kind: "move" }> => ({
  kind: "move",
  value: {
    version: 1,
    operationId: "move",
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
});

async function reservedEquipReceipt(
  operationId: string,
): Promise<D6StorageTransactionReceiptV1> {
  const initialTool = f.state?.ledger.objects.tool;
  if (!initialTool) throw new Error("missing tool fixture");
  const request: Extract<D6StorageOperationRequestV1, { kind: "move" }> = {
    kind: "move",
    value: {
      ...move().value,
      operationId,
      destination: null,
      rectangle: null,
      disposition: "equipped",
      pinned: false,
    },
  };
  const afterLocation = {
    state: "unplaced" as const,
    rootUuid,
    disposition: "equipped" as const,
  };
  const write = {
    sequence: 0,
    kind: "update" as const,
    documentUuid: `${rootUuid}.Item.tool`,
    before: {
      documentUuid: `${rootUuid}.Item.tool`,
      parentActorUuid: rootUuid,
      source: item.toObject(),
      witness: "before",
    },
    after: {
      documentUuid: `${rootUuid}.Item.tool`,
      parentActorUuid: rootUuid,
      source: {
        ...item.toObject(),
        system: {
          storageInstanceId: "tool",
          quantity: 1,
          equipped: true,
        },
      },
      witness: "after",
    },
    state: "planned" as const,
  };
  const planHash = await storageHash({
    request,
    ledgerRevision: 8,
    beforeLocations: { tool: initialTool.location },
    afterLocations: { tool: afterLocation },
    reservedIdentities: [],
    writes: [write],
  });
  const receipt = await createGridStorageReceipt({
    request,
    requesterUserId: player.id,
    authorityUserId: gm.id,
    planHash,
    approvals: [
      {
        userId: player.id,
        actorUuid: rootUuid,
        boundary: "source-location",
        scope: "object-only",
        decision: "approved",
        decidedAt: Date.now(),
      },
    ],
    writes: [write],
    beforeRevision: 7,
    beforeLocations: { tool: initialTool.location },
    afterLocations: { tool: afterLocation },
    undoEligible: false,
  });
  return advanceGridStorageReceipt(receipt, { state: "reserved" });
}

describe("grid storage operation service", () => {
  it("records intent before committing a same-owner move and replays only to its requester", async () => {
    await expect(
      processGridStorageOperation(move(), player),
    ).resolves.toMatchObject({ status: "completed" });
    expect(f.state?.ledger.revision).toBe(8);
    expect(f.state?.receipts.move).toMatchObject({
      state: "completed",
      requesterUserId: "player",
      beforeRevision: 7,
      afterRevision: 8,
    });
    await expect(
      processGridStorageOperation(move(), player),
    ).resolves.toMatchObject({ status: "completed" });
    await expect(
      processGridStorageOperation(move(), intruder),
    ).resolves.toMatchObject({ status: "denied", issue: "authority" });
  });

  it("reserves a 16-character Foundry document ID for a partial split", async () => {
    const state = f.state;
    const source = state?.ledger.objects.tool;
    if (!state || !source) throw new Error("missing source fixture");
    f.state = {
      ...state,
      ledger: {
        ...state.ledger,
        objects: {
          ...state.ledger.objects,
          tool: { ...source, quantity: 3 },
        },
      },
    };
    item.system.quantity = 3;
    f.documentPlan.mockRejectedValueOnce(new Error("stop after reservation"));
    const baseRequest = move();
    const request = {
      ...baseRequest,
      value: { ...baseRequest.value, quantity: 1 },
    };

    await expect(
      processGridStorageOperation(request, player),
    ).resolves.toMatchObject({ status: "denied" });
    expect(f.documentPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        reservedDocumentId: "AbCdEfGhIjKlMnOp",
        reservedInstanceId: "reserved",
      }),
    );
    expect(f.randomId).toHaveBeenCalledWith(16);
  });

  it("refuses a completed replay after the requester loses read permission", async () => {
    await expect(
      processGridStorageOperation(move(), player),
    ).resolves.toMatchObject({ status: "completed" });
    f.playerControls = false;
    await expect(
      processGridStorageOperation(move(), player),
    ).resolves.toMatchObject({ status: "denied", issue: "authority" });
  });

  it("denies destinationless equipment when the live mirror is installed", async () => {
    const originalInstalled = item.system.installed;
    item.system.installed = true;
    const request: Extract<D6StorageOperationRequestV1, { kind: "move" }> = {
      kind: "move",
      value: {
        ...move().value,
        operationId: "installed-unplaced",
        destination: null,
        rectangle: null,
        disposition: "equipped",
      },
    };
    await expect(
      processGridStorageOperation(request, player),
    ).resolves.toMatchObject({
      status: "denied",
      issue: "destination-unavailable",
    });
    expect(f.documentPlan).not.toHaveBeenCalled();
    item.system.installed = originalInstalled;
  });

  it("returns full owner data and strips all objects from a redacted projection", async () => {
    await expect(
      projectGridStorageForUser({ actorUuid: rootUuid }, player),
    ).resolves.toMatchObject({
      workspace: { revision: 7, viewMode: "grid" },
      objects: { tool: { ownerActorUuid: rootUuid } },
    });
    const hidden = await projectGridStorageForUser(
      { actorUuid: rootUuid },
      intruder,
    );
    expect(hidden.workspace?.viewMode).toBe("redacted");
    expect(hidden.objects).toEqual({});
    expect(hidden.latestUndo).toBeNull();
  });

  it("equips an enrolled unplaced machine Item through the authority service", async () => {
    (item as unknown as { type: string }).type = "starship-weapon";
    const write = {
      sequence: 0,
      kind: "update" as const,
      documentUuid: `${rootUuid}.Item.tool`,
      before: {
        documentUuid: `${rootUuid}.Item.tool`,
        parentActorUuid: rootUuid,
        source: item.toObject(),
        witness: "before",
      },
      after: {
        documentUuid: `${rootUuid}.Item.tool`,
        parentActorUuid: rootUuid,
        source: {
          ...item.toObject(),
          system: {
            storageInstanceId: "tool",
            quantity: 1,
            equipped: true,
          },
        },
        witness: "after",
      },
      state: "planned" as const,
    };
    f.documentPlan.mockResolvedValue({
      reservedIdentities: [],
      writes: [write],
      movedInstanceId: "tool",
      movedDocumentUuid: item.uuid,
    });
    f.applyWrites.mockImplementation((receipt) =>
      Promise.resolve({
        ...receipt,
        state: "documents-applied" as const,
        writes: receipt.writes.map((entry) => ({
          ...entry,
          state: "verified" as const,
        })),
      }),
    );
    const request: Extract<D6StorageOperationRequestV1, { kind: "move" }> = {
      kind: "move",
      value: {
        ...move().value,
        operationId: "equip-unplaced",
        destination: null,
        rectangle: null,
        disposition: "equipped",
        pinned: false,
      },
    };

    await expect(
      processGridStorageOperation(request, player),
    ).resolves.toMatchObject({ status: "completed" });
    expect(f.requireAction).toHaveBeenCalledWith(item, rootUuid, "equip");
    expect(f.documentPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationActorUuid: rootUuid,
        destinationDisposition: "equipped",
        quantity: 1,
      }),
    );
    expect(f.applyWrites).toHaveBeenCalledTimes(1);
    expect(f.state?.ledger.objects.tool?.location).toEqual({
      state: "unplaced",
      rootUuid,
      disposition: "equipped",
    });
    expect(f.state?.receipts["equip-unplaced"]).toMatchObject({
      state: "completed",
      undoEligible: false,
      writes: [{ state: "verified" }],
    });
  });

  it("unequips an enrolled unplaced machine Item through the authority service", async () => {
    (item as unknown as { type: string }).type = "vehicle-gear";
    item.system.equipped = true;
    const current = f.state?.ledger.objects.tool;
    if (!f.state || !current) throw new Error("missing tool fixture");
    f.state = {
      ...f.state,
      ledger: {
        ...f.state.ledger,
        objects: {
          ...f.state.ledger.objects,
          tool: {
            ...current,
            location: {
              state: "unplaced",
              rootUuid,
              disposition: "equipped",
            },
          },
        },
      },
    };
    const write = {
      sequence: 0,
      kind: "update" as const,
      documentUuid: item.uuid,
      before: {
        documentUuid: item.uuid,
        parentActorUuid: rootUuid,
        source: item.toObject(),
        witness: "before",
      },
      after: {
        documentUuid: item.uuid,
        parentActorUuid: rootUuid,
        source: {
          ...item.toObject(),
          system: {
            storageInstanceId: "tool",
            quantity: 1,
            equipped: false,
          },
        },
        witness: "after",
      },
      state: "planned" as const,
    };
    f.documentPlan.mockResolvedValue({
      reservedIdentities: [],
      writes: [write],
      movedInstanceId: "tool",
      movedDocumentUuid: item.uuid,
    });
    f.applyWrites.mockImplementation((receipt) =>
      Promise.resolve({
        ...receipt,
        state: "documents-applied" as const,
        writes: receipt.writes.map((entry) => ({
          ...entry,
          state: "verified" as const,
        })),
      }),
    );
    const request: Extract<D6StorageOperationRequestV1, { kind: "move" }> = {
      kind: "move",
      value: {
        ...move().value,
        operationId: "unequip-machine",
        destination: null,
        rectangle: null,
        disposition: "carried",
        pinned: false,
      },
    };

    await expect(
      processGridStorageOperation(request, player),
    ).resolves.toMatchObject({ status: "completed" });
    expect(f.requireAction).not.toHaveBeenCalled();
    expect(f.state.ledger.objects.tool?.location).toEqual({
      state: "unplaced",
      rootUuid,
      disposition: "carried",
    });
  });

  it("resumes a reserved unplaced equipment mirror after authority takeover", async () => {
    const request: Extract<D6StorageOperationRequestV1, { kind: "move" }> = {
      kind: "move",
      value: {
        ...move().value,
        operationId: "recover-equip",
        destination: null,
        rectangle: null,
        disposition: "equipped",
        pinned: false,
      },
    };
    const initialState = f.state;
    const initialTool = initialState?.ledger.objects.tool;
    if (!initialState || !initialTool) throw new Error("missing tool fixture");
    const beforeLocation = initialTool.location;
    const afterLocation = {
      state: "unplaced" as const,
      rootUuid,
      disposition: "equipped" as const,
    };
    const write = {
      sequence: 0,
      kind: "update" as const,
      documentUuid: `${rootUuid}.Item.tool`,
      before: {
        documentUuid: `${rootUuid}.Item.tool`,
        parentActorUuid: rootUuid,
        source: item.toObject(),
        witness: "before",
      },
      after: {
        documentUuid: `${rootUuid}.Item.tool`,
        parentActorUuid: rootUuid,
        source: {
          ...item.toObject(),
          system: {
            storageInstanceId: "tool",
            quantity: 1,
            equipped: true,
          },
        },
        witness: "after",
      },
      state: "planned" as const,
    };
    const planHash = await storageHash({
      request,
      ledgerRevision: 8,
      beforeLocations: { tool: beforeLocation },
      afterLocations: { tool: afterLocation },
      reservedIdentities: [],
      writes: [write],
    });
    let receipt = await createGridStorageReceipt({
      request,
      requesterUserId: player.id,
      authorityUserId: gm.id,
      planHash,
      approvals: [
        {
          userId: player.id,
          actorUuid: rootUuid,
          boundary: "source-location",
          scope: "object-only",
          decision: "approved",
          decidedAt: Date.now(),
        },
      ],
      writes: [write],
      beforeRevision: 7,
      beforeLocations: { tool: beforeLocation },
      afterLocations: { tool: afterLocation },
      undoEligible: false,
    });
    receipt = await advanceGridStorageReceipt(receipt, { state: "reserved" });
    f.state = {
      ...initialState,
      receipts: { ...initialState.receipts, [receipt.operationId]: receipt },
    };
    f.applyWrites.mockImplementation((value) =>
      Promise.resolve({
        ...value,
        state: "documents-applied" as const,
        writes: value.writes.map((entry) => ({
          ...entry,
          state: "verified" as const,
        })),
      }),
    );

    await recoverGridStorageOperations();

    expect(f.applyWrites).toHaveBeenCalledTimes(1);
    expect(f.state.ledger.revision).toBe(8);
    expect(f.state.ledger.objects.tool?.location).toEqual(afterLocation);
    expect(f.state.receipts[receipt.operationId]).toMatchObject({
      state: "completed",
      undoEligible: false,
      response: { status: "completed" },
    });
  });

  it("refuses takeover recovery after a recorded controller loses authority", async () => {
    const initialState = f.state;
    if (!initialState) throw new Error("missing state fixture");
    const receipt = await reservedEquipReceipt("recover-revoked");
    f.state = {
      ...initialState,
      receipts: { ...initialState.receipts, [receipt.operationId]: receipt },
    };
    f.playerControls = false;

    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      await recoverGridStorageOperations();
    } finally {
      consoleError.mockRestore();
    }

    expect(f.applyWrites).not.toHaveBeenCalled();
    expect(f.state.ledger.revision).toBe(7);
    expect(f.state.receipts[receipt.operationId]).toMatchObject({
      state: "compensated",
      response: { status: "denied" },
    });
  });

  it("finishes a ledger-applied receipt without applying documents twice", async () => {
    const request = move();
    let receipt = await createGridStorageReceipt({
      request,
      requesterUserId: player.id,
      authorityUserId: gm.id,
      planHash: "already-applied",
      beforeRevision: 7,
    });
    receipt = await advanceGridStorageReceipt(receipt, {
      state: "ledger-applied",
      afterRevision: 8,
    });
    const initialState = f.state;
    if (!initialState) throw new Error("missing state fixture");
    f.state = {
      ...initialState,
      ledger: { ...initialState.ledger, revision: 8 },
      receipts: { ...initialState.receipts, [receipt.operationId]: receipt },
    };

    await recoverGridStorageOperations();

    expect(f.applyWrites).not.toHaveBeenCalled();
    expect(f.state.receipts.move).toMatchObject({
      state: "completed",
      response: { status: "completed" },
    });
  });

  it("applies and then exactly undoes the deterministic Supervisor pack", async () => {
    const previewRequest = {
      version: 1 as const,
      operationId: "pack",
      baseRevision: 7,
      parent,
      maxSearchNodes: 10_000,
      witnesses: {
        kit: "kit:witness",
        tool: "tool:witness",
        torch: "torch:witness",
        ration: "ration:witness",
      },
    };
    const preview = await previewGridStorageAutoPack(previewRequest, player);
    const apply: D6StorageOperationRequestV1 = {
      kind: "auto-pack",
      value: {
        version: 1,
        operationId: "pack",
        baseRevision: 7,
        parent,
        planHash: preview.planHash,
        witnesses: previewRequest.witnesses,
      },
    };
    await expect(
      processGridStorageOperation(apply, player),
    ).resolves.toMatchObject({ status: "completed" });
    expect(f.state?.ledger.objects.tool?.location).toMatchObject({
      state: "placed",
      rectangle: { x: 0, y: 2 },
    });
    const undo: D6StorageOperationRequestV1 = {
      kind: "undo",
      value: {
        version: 1,
        operationId: "undo",
        targetOperationId: "pack",
        baseRevision: 8,
        witnesses: previewRequest.witnesses,
      },
    };
    await expect(
      processGridStorageOperation(undo, player),
    ).resolves.toMatchObject({ status: "completed" });
    expect(f.state?.ledger.objects.tool?.location.state).toBe("unplaced");
  });

  it("denies auto-pack without every root witness or full root visibility", async () => {
    const request = {
      version: 1 as const,
      operationId: "private-pack",
      baseRevision: 7,
      parent,
      maxSearchNodes: 10_000,
      witnesses: {},
    };
    await expect(previewGridStorageAutoPack(request, player)).rejects.toThrow(
      "D6E2.Storage.Error.Stale",
    );
    f.playerControls = false;
    await expect(
      previewGridStorageAutoPack(
        {
          ...request,
          witnesses: {
            kit: "kit:witness",
            tool: "tool:witness",
            torch: "torch:witness",
            ration: "ration:witness",
          },
        },
        player,
      ),
    ).rejects.toThrow("D6E2.Storage.Error.Authority");
  });

  it("journals a participating quantity depletion and removes the ledger object", async () => {
    f.applyWrites.mockImplementation((receipt) =>
      Promise.resolve({
        ...receipt,
        state: "documents-applied" as const,
        writes: receipt.writes.map((write) => ({
          ...write,
          state: "verified" as const,
        })),
      }),
    );
    const request: D6StorageOperationRequestV1 = {
      kind: "quantity",
      value: {
        version: 1,
        operationId: "consume-tool",
        baseRevision: 7,
        instanceId: "tool",
        actingActorUuid: rootUuid,
        targetQuantity: 0,
        witnesses: { tool: "tool:witness" },
      },
    };

    await expect(
      processGridStorageOperation(request, player),
    ).resolves.toMatchObject({ status: "completed" });
    expect(f.quantityWrite).toHaveBeenCalledWith(item, 0, "stored");
    expect(f.state?.ledger.objects.tool).toBeUndefined();
    expect(f.state?.receipts["consume-tool"]).toMatchObject({
      state: "completed",
      writes: [{ state: "verified" }],
    });
  });

  it("allows an unplaced legacy stack to decrease without applying its placement maximum", async () => {
    const current = f.state?.ledger.objects.tool;
    if (!f.state || !current) throw new Error("missing tool fixture");
    f.state = {
      ...f.state,
      ledger: {
        ...f.state.ledger,
        objects: {
          ...f.state.ledger.objects,
          tool: {
            ...current,
            quantity: 3,
            location: {
              state: "unplaced",
              rootUuid,
              disposition: "carried",
            },
          },
        },
      },
    };
    item.system.quantity = 3;
    f.quantityWrite.mockResolvedValue({
      sequence: 0,
      kind: "update",
      documentUuid: item.uuid,
      before: {
        documentUuid: item.uuid,
        parentActorUuid: rootUuid,
        source: item.toObject(),
        witness: "tool:witness",
      },
      after: {
        documentUuid: item.uuid,
        parentActorUuid: rootUuid,
        source: {
          ...item.toObject(),
          system: { storageInstanceId: "tool", quantity: 2 },
        },
        witness: "tool:reduced",
      },
      state: "planned",
    });
    f.applyWrites.mockImplementation((receipt) =>
      Promise.resolve({
        ...receipt,
        state: "documents-applied" as const,
        writes: receipt.writes.map((write) => ({
          ...write,
          state: "verified" as const,
        })),
      }),
    );
    const request: D6StorageOperationRequestV1 = {
      kind: "quantity",
      value: {
        version: 1,
        operationId: "consume-legacy-stack",
        baseRevision: 7,
        instanceId: "tool",
        actingActorUuid: rootUuid,
        targetQuantity: 2,
        witnesses: { tool: "tool:witness" },
      },
    };

    await expect(
      processGridStorageOperation(request, player),
    ).resolves.toMatchObject({ status: "completed" });
    expect(f.state.ledger.objects.tool?.quantity).toBe(2);
  });

  it("revalidates quantity authority immediately before applying effects", async () => {
    f.revokeOnIntent = true;
    const request: D6StorageOperationRequestV1 = {
      kind: "quantity",
      value: {
        version: 1,
        operationId: "consume-revoked",
        baseRevision: 7,
        instanceId: "tool",
        actingActorUuid: rootUuid,
        targetQuantity: 0,
        witnesses: { tool: "tool:witness" },
      },
    };

    await expect(
      processGridStorageOperation(request, player),
    ).resolves.toMatchObject({ status: "denied", issue: "authority" });
    expect(f.applyWrites).not.toHaveBeenCalled();
    expect(f.state?.ledger.revision).toBe(7);
  });

  it("refuses quantity receipt takeover after requester permission is revoked", async () => {
    const request: Extract<D6StorageOperationRequestV1, { kind: "quantity" }> =
      {
        kind: "quantity",
        value: {
          version: 1,
          operationId: "recover-quantity-revoked",
          baseRevision: 7,
          instanceId: "tool",
          actingActorUuid: rootUuid,
          targetQuantity: 0,
          witnesses: { tool: "tool:witness" },
        },
      };
    const write = {
      sequence: 0,
      kind: "update" as const,
      documentUuid: `${rootUuid}.Item.tool`,
      before: {
        documentUuid: `${rootUuid}.Item.tool`,
        parentActorUuid: rootUuid,
        source: item.toObject(),
        witness: "tool:witness",
      },
      after: {
        documentUuid: `${rootUuid}.Item.tool`,
        parentActorUuid: rootUuid,
        source: {
          ...item.toObject(),
          system: { storageInstanceId: "", quantity: 0 },
        },
        witness: "tool:depleted",
      },
      state: "planned" as const,
    };
    let receipt = await createGridStorageReceipt({
      request,
      requesterUserId: player.id,
      authorityUserId: gm.id,
      planHash: "unreached-after-revocation",
      writes: [write],
      beforeRevision: 7,
    });
    receipt = await advanceGridStorageReceipt(receipt, { state: "reserved" });
    const initial = f.state;
    if (!initial) throw new Error("missing state fixture");
    f.state = {
      ...initial,
      receipts: { ...initial.receipts, [receipt.operationId]: receipt },
    };
    f.playerControls = false;
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      await recoverGridStorageOperations();
    } finally {
      consoleError.mockRestore();
    }

    expect(f.applyWrites).not.toHaveBeenCalled();
    expect(f.state.receipts[receipt.operationId]).toMatchObject({
      state: "compensated",
      response: { status: "denied", issue: "authority" },
    });
  });

  it("returns an exact move preview only for a fully visible root and exact source witness", async () => {
    await expect(
      previewGridStorageMove(move().value, player),
    ).resolves.toMatchObject({
      version: 1,
      operationId: "move",
      allowed: true,
      capacity: { grid: "available" },
      request: { instanceId: "tool" },
    });
    await expect(
      previewGridStorageMove(
        { ...move().value, operationId: "missing", witnesses: {} },
        player,
      ),
    ).rejects.toThrow("D6E2.Storage.Error.Authority");
    f.playerControls = false;
    await expect(
      previewGridStorageMove(
        { ...move().value, operationId: "hidden" },
        player,
      ),
    ).rejects.toThrow("D6E2.Storage.Error.Authority");
  });

  it("installs itself as the socket processor", () => {
    registerGridStorageOperationService();
    expect(f.processor).toHaveBeenCalledWith(processGridStorageOperation);
    expect(f.projectionProcessor).toHaveBeenCalledWith(expect.any(Function));
    expect(f.packPreviewProcessor).toHaveBeenCalledWith(expect.any(Function));
    expect(f.movePreviewProcessor).toHaveBeenCalledWith(expect.any(Function));
    expect(f.availabilityProcessor).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
    );
    expect(f.configurationProcessor).toHaveBeenCalledWith(expect.any(Function));
    expect(f.hook).toHaveBeenCalledWith("updateUser", expect.any(Function));
    expect(f.hook).toHaveBeenCalledWith("userConnected", expect.any(Function));
  });
});

describe("batched storage availability projection", () => {
  it("reads one authorized snapshot and preserves individual results", async () => {
    const ids = [
      "tool",
      "deleted",
      "foreign",
      "other",
      "fifth",
      "sixth",
      "seventh",
      "eighth",
    ];
    const batch = await projectGridStorageAvailabilityBatch(
      rootUuid,
      ids,
      player,
    );
    expect(f.readState).toHaveBeenCalledOnce();
    for (const id of ids)
      expect(batch[id]).toEqual(
        await projectGridStorageAvailability(rootUuid, id, player),
      );
  });
  it("denies ownership before reading and rechecks after the awaited state read", async () => {
    f.playerControls = false;
    await expect(
      projectGridStorageAvailabilityBatch(rootUuid, ["tool"], player),
    ).rejects.toThrow("Authority");
    expect(f.readState).not.toHaveBeenCalled();
    f.playerControls = true;
    f.readState.mockImplementationOnce(() => {
      f.playerControls = false;
    });
    await expect(
      projectGridStorageAvailabilityBatch(rootUuid, ["tool"], player),
    ).rejects.toThrow("Authority");
  });
  it("rejects malformed or oversized batches before reading private state", async () => {
    await expect(
      projectGridStorageAvailabilityBatch(
        rootUuid,
        Array.from({ length: 129 }, (_, i) => String(i)),
        player,
      ),
    ).rejects.toThrow("Unavailable");
    await expect(
      projectGridStorageAvailabilityBatch(rootUuid, ["tool", "tool"], player),
    ).rejects.toThrow("Unavailable");
    expect(f.readState).not.toHaveBeenCalled();
  });
});
