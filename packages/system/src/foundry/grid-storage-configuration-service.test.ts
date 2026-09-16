/* eslint-disable @typescript-eslint/unbound-method -- Foundry document methods are Vitest mocks asserted without invocation. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  D6StorageAuthorityStateV1,
  D6StoragePhysicalProfileV1,
  D6StorageTransactionReceiptV1,
} from "@d6-system-2e/core";
import { createCurrencyWallet } from "@d6-system-2e/core";
import { LEGACY_CURRENCY_DEFINITION } from "../migrations/058-add-currency-denominations.js";

const f = vi.hoisted(() => ({
  state: undefined as D6StorageAuthorityStateV1 | undefined,
  ids: ["instance-a", "instance-b"],
  mutation: vi.fn(),
  failMutation: false,
  beforeMutationFailure: vi.fn(() => Promise.resolve()),
  documents: new Map<string, unknown>(),
  readCount: 0,
  afterRead: vi
    .fn<(state: D6StorageAuthorityStateV1, count: number) => Promise<void>>()
    .mockResolvedValue(undefined),
}));

vi.mock("./destiny-crypto.js", () => ({
  destinyClientIsAuthority: () => true,
}));
vi.mock("./foundry-random-id.js", () => ({
  foundryRandomId: () => f.ids.shift() ?? "instance-fallback",
}));
vi.mock("./grid-storage-state.js", () => ({
  runGridStorageAuthorityEffect: (effect: () => Promise<unknown>) => effect(),
  readGridStorageAuthorityState: async () => {
    if (!f.state) throw new Error("missing fixture state");
    const snapshot = structuredClone(f.state);
    f.readCount += 1;
    await f.afterRead(snapshot, f.readCount);
    return snapshot;
  },
  mutateGridStorageAuthorityState: async (
    expected: number | null,
    mutation: (state: D6StorageAuthorityStateV1) => unknown,
  ) => {
    const current = f.state;
    if (!current) throw new Error("missing fixture state");
    if (expected !== null && expected !== current.ledger.revision)
      throw new Error("D6E2.Storage.Error.Stale");
    if (f.failMutation) {
      await f.beforeMutationFailure();
      throw new Error("D6E2.Storage.Error.Stale");
    }
    const result = (await mutation(structuredClone(current))) as readonly [
      D6StorageAuthorityStateV1,
      unknown,
    ];
    f.state = structuredClone(result[0]);
    f.mutation(expected, f.state);
    return result[1];
  },
}));

import {
  configureGridStorageItem,
  configureGridStorageRoot,
  removeGridStorageRoot,
  recoverGridStorageConfigurations,
  saveGridStorageInterior,
  saveGridStorageSpace,
} from "./grid-storage-configuration-service.js";
import { gridStorageDocumentWitness } from "./grid-storage-document-adapter.js";
import {
  gridStorageWriteAlreadyApplied,
  gridStorageWriteBeforeStatePresent,
} from "./grid-storage-document-executor.js";
import { processGridStorageOperation } from "./grid-storage-operation-service.js";

function assignPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split(".");
  let current = target;
  for (const part of parts.slice(0, -1)) {
    const child = current[part];
    current[part] =
      child && typeof child === "object" && !Array.isArray(child) ? child : {};
    current = current[part] as Record<string, unknown>;
  }
  current[parts.at(-1) ?? path] = structuredClone(value);
}

function actorFixture(type = "character") {
  const system: Record<string, unknown> = {
    profile: { currency: 0 },
    storage: { configured: false, publicSummary: "none", version: 1 },
  };
  const contents: FoundryItemDocument[] = [];
  const actor = {
    id: "root",
    uuid: "Actor.root",
    name: "Root",
    type,
    system,
    items: { contents },
    update: vi.fn((changes: Record<string, unknown>) => {
      for (const [path, value] of Object.entries(changes))
        assignPath(actor as unknown as Record<string, unknown>, path, value);
      return Promise.resolve();
    }),
    testUserPermission: vi.fn(() => true),
    updateEmbeddedDocuments: vi.fn(
      async (_name: string, sources: readonly Record<string, unknown>[]) => {
        for (const source of sources) {
          const target = contents.find(
            (candidate) => candidate.id === String(source._id),
          ) as
            | (FoundryItemDocument & {
                update(changes: Record<string, unknown>): Promise<unknown>;
              })
            | undefined;
          if (!target) throw new Error("missing embedded Item");
          await target.update(source);
        }
        return contents;
      },
    ),
  } as unknown as FoundryActorDocument & { readonly uuid: string };
  f.documents.set(actor.uuid, actor);
  return { actor, contents };
}

function itemFixture(
  actor: FoundryActorDocument & { readonly uuid: string },
  type = "gear",
  id = "item",
) {
  const stats = {
    createdTime: 10,
    modifiedTime: 20,
    lastModifiedBy: "gm",
  };
  const system: Record<string, unknown> = {
    quantity: 1,
    equipped: false,
    installed: false,
    storageInstanceId: "",
    storagePhysical: {
      version: 1,
      provenance: "unknown",
      presetId: "",
      widthMm: null,
      depthMm: null,
      heightMm: null,
      unitTareWeightGrams: null,
      unitExteriorVolumeMillilitres: null,
      rotatable: true,
      footprintsByScale: {},
      stack: { mode: "single", maxQuantityPerPlacement: 1 },
    },
    storageInterior: {
      version: 1,
      configured: false,
      label: "",
      scaleId: "",
      scaleLabel: "",
      columns: 1,
      rows: 1,
      cellWidthMm: 100,
      cellDepthMm: 100,
      maxAggregateWeightGrams: null,
      maxOccupiedVolumeMillilitres: null,
      maxDirectChildren: null,
      access: "open",
    },
  };
  const item = {
    id,
    uuid: `${actor.uuid}.Item.${id}`,
    name: "Item",
    type,
    parent: actor,
    system,
    update: vi.fn(
      (changes: Record<string, unknown>, options?: Record<string, unknown>) => {
        if (options) options.parent = actor;
        for (const [path, value] of Object.entries(changes)) {
          if (path === "_stats" && value && typeof value === "object") {
            Object.assign(stats, structuredClone(value));
            continue;
          }
          if (path === "system" && value && typeof value === "object") {
            for (const key of Object.keys(system))
              Reflect.deleteProperty(system, key);
            Object.assign(system, structuredClone(value));
            continue;
          }
          assignPath(item as unknown as Record<string, unknown>, path, value);
        }
        stats.createdTime = 30;
        stats.modifiedTime = 30;
        const physical = system.storagePhysical as
          Record<string, unknown> | undefined;
        if (physical?.presetId === null) physical.presetId = "";
        return Promise.resolve();
      },
    ),
    toObject: () => ({
      _id: id,
      _stats: structuredClone(stats),
      name: "Item",
      type,
      system: structuredClone(system),
    }),
  } as unknown as FoundryItemDocument & {
    readonly uuid: string;
    readonly parent: FoundryActorDocument & { readonly uuid: string };
  };
  f.documents.set(item.uuid, item);
  return item;
}

const spaceForm = (overrides: Record<string, unknown> = {}) => ({
  label: "Cargo",
  kind: "cargo",
  configuration: "grid",
  scalePresetId: "personal-100",
  columns: 4,
  rows: 3,
  access: "open",
  ...overrides,
});

const physicalForm = (overrides: Record<string, unknown> = {}) => ({
  footprintColumns: 1,
  footprintRows: 1,
  maxQuantityPerPlacement: 1,
  stackMode: "single",
  rotatable: true,
  container: false,
  ...overrides,
});

function capturedConfigurationReceipt(kind: "root" | "root-removal" | "item") {
  for (const call of [...f.mutation.mock.calls].reverse()) {
    const snapshot = call[1] as D6StorageAuthorityStateV1 | undefined;
    const receipt = Object.values(snapshot?.configurationReceipts ?? {}).find(
      (candidate) => candidate.kind === kind,
    );
    if (receipt) return structuredClone(receipt);
  }
  return undefined;
}

function operationReceipt(
  instanceId: string,
  state: D6StorageTransactionReceiptV1["state"] = "completed",
): D6StorageTransactionReceiptV1 {
  const location = f.state?.ledger.objects[instanceId]?.location ?? {
    state: "unplaced" as const,
    rootUuid: "Actor.root",
    disposition: "carried" as const,
  };
  return {
    version: 1,
    operationId: `receipt-${state}`,
    intentHash: "intent",
    request: {
      kind: "quantity",
      value: {
        version: 1,
        operationId: `receipt-${state}`,
        baseRevision: f.state?.ledger.revision ?? 0,
        instanceId,
        actingActorUuid: "Actor.root",
        targetQuantity: 1,
        witnesses: { [instanceId]: "witness" },
      },
    },
    planHash: "plan",
    requesterUserId: "gm",
    authorityUserId: "gm",
    state,
    approvals: [],
    reservedIdentities: [],
    writes: [],
    beforeRevision: f.state?.ledger.revision ?? 0,
    afterRevision: f.state?.ledger.revision ?? null,
    beforeLocations: { [instanceId]: location },
    afterLocations: { [instanceId]: location },
    response: null,
    responseHash: null,
    undoEligible: state === "completed",
  };
}

beforeEach(() => {
  f.state = {
    version: 1,
    ledger: { version: 1, revision: 0, roots: {}, objects: {} },
    receipts: {},
  };
  f.ids = ["instance-a", "instance-b"];
  f.documents.clear();
  f.readCount = 0;
  f.afterRead.mockReset().mockResolvedValue(undefined);
  f.mutation.mockClear();
  f.failMutation = false;
  f.beforeMutationFailure.mockReset().mockResolvedValue(undefined);
  const player = { id: "player", active: true, isGM: false };
  vi.stubGlobal("game", {
    user: { id: "gm", isGM: true },
    users: {
      get: (id: string) => (id === player.id ? player : undefined),
      contents: [player],
    },
    i18n: { localize: (key: string) => key },
  });
  vi.stubGlobal("fromUuid", (uuid: string) =>
    Promise.resolve(f.documents.get(uuid) ?? null),
  );
});

describe("grid storage configuration service", () => {
  it("atomically removes a nonempty nested root without deleting or transferring Items", async () => {
    const { actor, contents } = actorFixture();
    const container = itemFixture(actor, "gear", "container");
    const child = itemFixture(actor, "gear", "child");
    contents.push(container, child);
    await configureGridStorageRoot(actor, spaceForm());
    const containerId = String(container.system.storageInstanceId);
    const childId = String(child.system.storageInstanceId);
    if (!f.state) throw new Error("missing state");
    const containerObject = f.state.ledger.objects[containerId];
    const childObject = f.state.ledger.objects[childId];
    if (!containerObject || !childObject) throw new Error("missing objects");
    f.state = {
      ...f.state,
      ledger: {
        ...f.state.ledger,
        objects: {
          ...f.state.ledger.objects,
          [containerId]: {
            ...containerObject,
            definition: {
              ...containerObject.definition,
              interior: {
                id: `container:${containerId}`,
                label: "Inside",
                kind: "container",
                ownerActorUuid: actor.uuid,
                configuration: "capacity-only",
                access: "open",
                grid: null,
                limits: {
                  maxAggregateWeightGrams: null,
                  maxOccupiedVolumeMillilitres: null,
                  maxDirectChildren: null,
                },
              },
            },
          },
          [childId]: {
            ...childObject,
            location: {
              state: "listed",
              parent: {
                rootUuid: actor.uuid,
                spaceId: `container:${containerId}`,
                containerInstanceId: containerId,
                spaceOwnerActorUuid: actor.uuid,
              },
              disposition: "stored",
              pinned: false,
            },
          },
        },
      },
    };
    const completed = operationReceipt(childId);
    f.state = {
      ...f.state,
      receipts: { [completed.operationId]: completed },
    };
    const quantityBefore = [container.system.quantity, child.system.quantity];

    await removeGridStorageRoot(actor, f.state.ledger.revision);

    expect(f.state.ledger.roots[actor.uuid]).toBeUndefined();
    expect(f.state.ledger.objects).toEqual({});
    expect(f.state.receipts[completed.operationId]).toMatchObject({
      operationId: completed.operationId,
      undoEligible: false,
    });
    expect(container.system.storageInstanceId).toBe("");
    expect(child.system.storageInstanceId).toBe("");
    expect([container.system.quantity, child.system.quantity]).toEqual(
      quantityBefore,
    );
    expect(container.parent).toBe(actor);
    expect(child.parent).toBe(actor);
    expect(actor.system.storage).toMatchObject({ configured: false });
  });

  it("refuses root removal across foreign custody boundaries before any write", async () => {
    const { actor, contents } = actorFixture();
    const owned = itemFixture(actor);
    contents.push(owned);
    await configureGridStorageRoot(actor, spaceForm());
    if (!f.state) throw new Error("missing state");
    const instanceId = String(owned.system.storageInstanceId);
    const object = f.state.ledger.objects[instanceId];
    if (!object) throw new Error("missing object");
    f.state = {
      ...f.state,
      ledger: {
        ...f.state.ledger,
        objects: {
          ...f.state.ledger.objects,
          [instanceId]: { ...object, ownerActorUuid: "Actor.foreign" },
        },
      },
    };
    vi.mocked(owned.update).mockClear();

    await expect(
      removeGridStorageRoot(actor, f.state.ledger.revision),
    ).rejects.toThrow("D6E2.Storage.Error.RootBoundary");
    expect(owned.update).not.toHaveBeenCalled();
    expect(f.state.ledger.roots[actor.uuid]).toBeDefined();
  });

  it("refuses root removal while its wallet contains funds", async () => {
    const { actor } = actorFixture();
    await configureGridStorageRoot(actor, spaceForm());
    if (!f.state) throw new Error("missing state");
    (actor.system.profile as Record<string, unknown>).currencyWallet =
      createCurrencyWallet(LEGACY_CURRENCY_DEFINITION, { currency: "3" });

    await expect(
      removeGridStorageRoot(actor, f.state.ledger.revision),
    ).rejects.toThrow("D6E2.Storage.Currency.Error.FundsPresent");
    expect(f.state.ledger.roots[actor.uuid]).toBeDefined();
  });

  it("refuses removal when participating Actor Items do not map one-to-one to ledger objects", async () => {
    const { actor, contents } = actorFixture();
    const enrolled = itemFixture(actor, "gear", "enrolled");
    contents.push(enrolled);
    await configureGridStorageRoot(actor, spaceForm());
    if (!f.state) throw new Error("missing state");
    const duplicate = itemFixture(actor, "gear", "duplicate");
    duplicate.system.storageInstanceId = enrolled.system.storageInstanceId;
    contents.push(duplicate);
    vi.mocked(enrolled.update).mockClear();
    vi.mocked(duplicate.update).mockClear();

    await expect(
      removeGridStorageRoot(actor, f.state.ledger.revision),
    ).rejects.toThrow("D6E2.Storage.Error.RootBoundary");

    expect(enrolled.update).not.toHaveBeenCalled();
    expect(duplicate.update).not.toHaveBeenCalled();
    expect(duplicate.system.storageInstanceId).toBe(
      enrolled.system.storageInstanceId,
    );
    expect(f.state.ledger.roots[actor.uuid]).toBeDefined();
  });

  it("refuses removal while an owned Item is held in another storage root", async () => {
    const { actor, contents } = actorFixture();
    const owned = itemFixture(actor);
    contents.push(owned);
    await configureGridStorageRoot(actor, spaceForm());
    if (!f.state) throw new Error("missing state");
    const instanceId = String(owned.system.storageInstanceId);
    const object = f.state.ledger.objects[instanceId];
    const root = f.state.ledger.roots[actor.uuid];
    if (!object || !root) throw new Error("missing storage fixture");
    const primary = root.spaces.primary;
    if (!primary) throw new Error("missing primary space fixture");
    f.state = {
      ...f.state,
      ledger: {
        ...f.state.ledger,
        roots: {
          ...f.state.ledger.roots,
          "Actor.other": {
            ...root,
            rootUuid: "Actor.other",
            spaces: {
              primary: {
                ...primary,
                ownerActorUuid: "Actor.other",
              },
            },
          },
        },
        objects: {
          ...f.state.ledger.objects,
          [instanceId]: {
            ...object,
            location: {
              state: "unplaced",
              rootUuid: "Actor.other",
              disposition: "stored",
            },
          },
        },
      },
    };
    vi.mocked(owned.update).mockClear();

    await expect(
      removeGridStorageRoot(actor, f.state.ledger.revision),
    ).rejects.toThrow("D6E2.Storage.Error.RootBoundary");
    expect(owned.update).not.toHaveBeenCalled();
  });

  it("refuses stale and unfinished root removals before changing documents", async () => {
    const { actor, contents } = actorFixture();
    const item = itemFixture(actor);
    contents.push(item);
    await configureGridStorageRoot(actor, spaceForm());
    if (!f.state) throw new Error("missing state");
    vi.mocked(item.update).mockClear();
    await expect(
      removeGridStorageRoot(actor, f.state.ledger.revision - 1),
    ).rejects.toThrow("D6E2.Storage.Error.Stale");
    const instanceId = String(item.system.storageInstanceId);
    const active = operationReceipt(instanceId, "reserved");
    f.state = { ...f.state, receipts: { [active.operationId]: active } };
    await expect(
      removeGridStorageRoot(actor, f.state.ledger.revision),
    ).rejects.toThrow("D6E2.Storage.Error.AuthorityBusy");
    expect(item.update).not.toHaveBeenCalled();
  });

  it("refuses root removal while configuration recovery remains unresolved", async () => {
    const { actor, contents } = actorFixture();
    const item = itemFixture(actor);
    contents.push(item);
    await configureGridStorageRoot(actor, spaceForm());
    const receipt = capturedConfigurationReceipt("root");
    if (!f.state || !receipt) throw new Error("missing configuration receipt");
    f.state = {
      ...f.state,
      configurationReceipts: {
        [receipt.operationId]: { ...receipt, state: "needs-attention" },
      },
    };
    vi.mocked(item.update).mockClear();

    await expect(
      removeGridStorageRoot(actor, f.state.ledger.revision),
    ).rejects.toThrow("D6E2.Storage.Error.AuthorityBusy");
    expect(item.update).not.toHaveBeenCalled();
  });

  it("finishes a recovered root removal only when the root is intentionally absent", async () => {
    const { actor, contents } = actorFixture();
    const item = itemFixture(actor);
    contents.push(item);
    await configureGridStorageRoot(actor, spaceForm());
    if (!f.state) throw new Error("missing state");
    await removeGridStorageRoot(actor, f.state.ledger.revision);
    const receipt = capturedConfigurationReceipt("root-removal");
    if (!receipt) throw new Error("missing removal receipt");
    actor.system.storage = {
      configured: true,
      publicSummary: "none",
      version: 1,
    };
    f.state = {
      ...f.state,
      ledger: structuredClone(receipt.afterLedger),
      configurationReceipts: {
        [receipt.operationId]: { ...receipt, state: "ledger-applied" },
      },
    };

    await recoverGridStorageConfigurations();

    expect(actor.system.storage).toMatchObject({ configured: false });
    expect(f.state.configurationReceipts).toEqual({});
  });

  it("retains an exact completed response while disabling Undo after removal", async () => {
    const { actor, contents } = actorFixture();
    const item = itemFixture(actor);
    item.system.quantity = 2;
    contents.push(item);
    await configureGridStorageRoot(actor, spaceForm());
    if (!f.state) throw new Error("missing state");
    const instanceId = String(item.system.storageInstanceId);
    const object = f.state.ledger.objects[instanceId];
    const requester = game.users?.get("player");
    if (!object || !requester) throw new Error("missing operation fixture");
    const request = {
      kind: "quantity" as const,
      value: {
        version: 1 as const,
        operationId: "completed-before-root-removal",
        baseRevision: f.state.ledger.revision,
        instanceId,
        actingActorUuid: actor.uuid,
        targetQuantity: 1,
        witnesses: { [instanceId]: object.witness },
      },
    };
    const completed = await processGridStorageOperation(request, requester);
    expect(completed).toMatchObject({ status: "completed" });
    await removeGridStorageRoot(actor, f.state.ledger.revision);

    expect(f.state.receipts[request.value.operationId]).toMatchObject({
      response: completed,
      undoEligible: false,
    });
    await expect(
      processGridStorageOperation(request, requester),
    ).resolves.toEqual(completed);
  });

  it("validates a root form before assigning identities or writing documents", async () => {
    const { actor, contents } = actorFixture();
    const item = itemFixture(actor);
    contents.push(item);

    await expect(
      configureGridStorageRoot(actor, spaceForm({ columns: 0 })),
    ).rejects.toThrow("D6E2.Storage.Error.GridColumns");
    expect(item.update).not.toHaveBeenCalled();
    expect(actor.update).not.toHaveBeenCalled();
    expect(f.mutation).not.toHaveBeenCalled();
  });

  it("stores physical metadata without orphaning an identity before a root is configured", async () => {
    const { actor } = actorFixture();
    const item = itemFixture(actor);

    await configureGridStorageItem(
      item,
      physicalForm({ footprintColumns: 2, footprintRows: 3 }),
      "cargo-500",
    );

    expect(item.system.storageInstanceId).toBe("");
    expect(item.system.storagePhysical).toMatchObject({
      footprintsByScale: {
        "cargo-500": { columns: 2, rows: 3, provenance: "user" },
      },
    });
    expect(f.mutation).not.toHaveBeenCalled();
  });

  it("atomically enrolls supported Character and machine Items on first root configuration", async () => {
    const character = actorFixture();
    const gear = itemFixture(character.actor, "gear");
    character.contents.push(gear);
    await configureGridStorageRoot(character.actor, spaceForm());

    expect(gear.system.storageInstanceId).toBe("instance-a");
    const characterState = f.state;
    if (!characterState) throw new Error("missing character state");
    expect(characterState.ledger.objects["instance-a"]).toMatchObject({
      documentUuid: gear.uuid,
      ownerActorUuid: character.actor.uuid,
      location: { state: "unplaced", rootUuid: character.actor.uuid },
    });
    const enrolled = characterState.ledger.objects["instance-a"];
    if (!enrolled) throw new Error("missing enrolled object");
    expect(enrolled.witness).toBe(
      await gridStorageDocumentWitness(structuredClone(gear.toObject())),
    );
    const player = game.users?.get("player");
    if (!player) throw new Error("missing player");
    await expect(
      processGridStorageOperation(
        {
          kind: "quantity",
          value: {
            version: 1,
            operationId: "immediate-enrollment-check",
            baseRevision: characterState.ledger.revision,
            instanceId: "instance-a",
            actingActorUuid: character.actor.uuid,
            targetQuantity: 1,
            witnesses: { "instance-a": enrolled.witness },
          },
        },
        player,
      ),
    ).resolves.toMatchObject({ status: "completed" });
    expect(character.actor.system.storage).toMatchObject({ configured: true });
    expect(characterState.configurationReceipts).toEqual({});

    f.state = {
      version: 1,
      ledger: { version: 1, revision: 0, roots: {}, objects: {} },
      receipts: {},
    };
    f.ids = ["machine-item"];
    const machine = actorFixture("starship");
    const weapon = itemFixture(machine.actor, "starship-weapon");
    machine.contents.push(weapon);
    await configureGridStorageRoot(machine.actor, spaceForm());
    expect(f.state.ledger.objects["machine-item"]?.documentUuid).toBe(
      weapon.uuid,
    );
  });

  it("keeps exhausted no-ID Items outside the ledger while retaining their physical metadata", async () => {
    const { actor, contents } = actorFixture();
    const exhausted = itemFixture(actor);
    exhausted.system.quantity = 0;
    contents.push(exhausted);

    await configureGridStorageRoot(actor, spaceForm());
    await configureGridStorageItem(
      exhausted,
      physicalForm({ footprintColumns: 2, footprintRows: 2 }),
      "personal-100",
    );

    expect(exhausted.system.storageInstanceId).toBe("");
    expect(f.state?.ledger.objects).toEqual({});
    expect(exhausted.system.storagePhysical).toMatchObject({
      footprintsByScale: {
        "personal-100": { columns: 2, rows: 2 },
      },
    });
  });

  it("enrolls a newly added Item under an already configured empty root as unplaced", async () => {
    const { actor, contents } = actorFixture();
    await configureGridStorageRoot(actor, spaceForm());
    const added = itemFixture(actor);
    contents.push(added);

    await configureGridStorageItem(
      added,
      physicalForm({ footprintColumns: 2, footprintRows: 2 }),
      "personal-100",
    );

    expect(added.system.storageInstanceId).toBeTruthy();
    expect(
      f.state?.ledger.objects[String(added.system.storageInstanceId)],
    ).toMatchObject({
      documentUuid: added.uuid,
      location: {
        state: "unplaced",
        rootUuid: actor.uuid,
        disposition: "carried",
      },
    });
  });

  it("compensates a durably proven interrupted enrollment whose exact after-state still matches", async () => {
    const { actor, contents } = actorFixture();
    const item = itemFixture(actor);
    contents.push(item);
    await configureGridStorageRoot(actor, spaceForm());
    const receipt = capturedConfigurationReceipt("root");
    if (!f.state || !receipt) throw new Error("missing configuration receipt");
    actor.system.storage = {
      configured: false,
      publicSummary: "none",
      version: 1,
    };
    f.state = {
      ...f.state,
      ledger: { version: 1, revision: 1, roots: {}, objects: {} },
      configurationReceipts: {
        [receipt.operationId]: {
          ...receipt,
          state: "reserved",
          writes: receipt.writes.map((write) => ({
            ...write,
            state: "applied",
          })),
        },
      },
    };
    await recoverGridStorageConfigurations();

    expect(item.system.storageInstanceId).toBe("");
    expect(
      f.state.configurationReceipts?.[receipt.operationId],
    ).toBeUndefined();
  });

  it("resumes an interrupted root enrollment with the exact verified after-image witness", async () => {
    const { actor, contents } = actorFixture();
    const item = itemFixture(actor);
    contents.push(item);
    await configureGridStorageRoot(actor, spaceForm());
    const receipt = capturedConfigurationReceipt("root");
    if (!f.state || !receipt) throw new Error("missing configuration receipt");
    actor.system.storage = {
      configured: false,
      publicSummary: "none",
      version: 1,
    };
    f.state = {
      ...f.state,
      ledger: { version: 1, revision: 0, roots: {}, objects: {} },
      configurationReceipts: {
        [receipt.operationId]: {
          ...receipt,
          state: "reserved",
          writes: receipt.writes.map((write) => ({
            ...write,
            state: "applied",
          })),
        },
      },
    };
    await recoverGridStorageConfigurations();

    const recovered =
      f.state.ledger.objects[String(item.system.storageInstanceId)];
    expect(recovered?.witness).toBe(
      await gridStorageDocumentWitness(structuredClone(item.toObject())),
    );
    if (!recovered) throw new Error("missing recovered object");
    const player = game.users?.get("player");
    if (!player) throw new Error("missing player");
    await expect(
      processGridStorageOperation(
        {
          kind: "quantity",
          value: {
            version: 1,
            operationId: "resumed-enrollment-check",
            baseRevision: f.state.ledger.revision,
            instanceId: recovered.definition.instanceId,
            actingActorUuid: actor.uuid,
            targetQuantity: recovered.quantity,
            witnesses: {
              [recovered.definition.instanceId]: recovered.witness,
            },
          },
        },
        player,
      ),
    ).resolves.toMatchObject({ status: "completed" });
    expect(actor.system.storage).toMatchObject({ configured: true });
    expect(f.state.configurationReceipts).toEqual({});
  });

  it("safely resumes a needs-attention Item receipt after only observed Foundry normalization", async () => {
    const { actor, contents } = actorFixture();
    await configureGridStorageRoot(actor, spaceForm());
    const item = itemFixture(actor);
    contents.push(item);
    await configureGridStorageItem(
      item,
      physicalForm({ widthMm: 2, depthMm: 2 }),
      "personal-100",
    );
    const receipt = capturedConfigurationReceipt("item");
    if (!f.state || !receipt) throw new Error("missing Item receipt");
    f.state = {
      ...f.state,
      ledger: {
        ...receipt.afterLedger,
        revision: receipt.beforeRevision,
        objects: {},
      },
      configurationReceipts: {
        [receipt.operationId]: {
          ...receipt,
          state: "needs-attention",
          writes: receipt.writes.map((write) => ({
            ...write,
            state: "planned",
          })),
        },
      },
    };
    const write = receipt.writes[0];
    if (!write) throw new Error("missing Item write");
    await expect(gridStorageWriteBeforeStatePresent(write)).resolves.toBe(
      false,
    );
    await expect(gridStorageWriteAlreadyApplied(write)).resolves.toBe(true);

    await recoverGridStorageConfigurations();

    const instanceId = String(item.system.storageInstanceId);
    expect(f.state.ledger.objects[instanceId]).toMatchObject({
      documentUuid: item.uuid,
      witness: await gridStorageDocumentWitness(item.toObject()),
      location: { state: "unplaced", rootUuid: actor.uuid },
    });
    expect(f.state.configurationReceipts).toEqual({});
  });

  it("retains needs-attention when authored Item state differs", async () => {
    const { actor, contents } = actorFixture();
    await configureGridStorageRoot(actor, spaceForm());
    const item = itemFixture(actor);
    contents.push(item);
    await configureGridStorageItem(item, physicalForm(), "personal-100");
    const receipt = capturedConfigurationReceipt("item");
    if (!f.state || !receipt) throw new Error("missing Item receipt");
    item.system.quantity = 2;
    f.state = {
      ...f.state,
      ledger: {
        ...receipt.afterLedger,
        revision: receipt.beforeRevision,
        objects: {},
      },
      configurationReceipts: {
        [receipt.operationId]: {
          ...receipt,
          state: "needs-attention",
          writes: receipt.writes.map((write) => ({
            ...write,
            state: "planned",
          })),
        },
      },
    };

    await recoverGridStorageConfigurations();

    expect(f.state.ledger.objects).toEqual({});
    expect(f.state.configurationReceipts?.[receipt.operationId]?.state).toBe(
      "needs-attention",
    );
  });

  it("leaves a newer committed Item and ledger untouched when stale recovery resumes", async () => {
    const { actor, contents } = actorFixture();
    const item = itemFixture(actor);
    contents.push(item);
    await configureGridStorageRoot(actor, spaceForm());
    await configureGridStorageItem(
      item,
      physicalForm({ widthMm: 20 }),
      "personal-100",
    );
    const receipt = capturedConfigurationReceipt("item");
    const instanceId = String(item.system.storageInstanceId);
    const object = f.state?.ledger.objects[instanceId];
    if (!f.state || !receipt || !object)
      throw new Error("missing configuration state");
    const beforeSource = receipt.writes[0]?.before?.source;
    if (!beforeSource) throw new Error("missing configuration preimage");
    const beforeSystem = beforeSource.system as Record<string, unknown>;
    const beforeLedger = {
      ...receipt.afterLedger,
      revision: receipt.beforeRevision,
      objects: {
        ...receipt.afterLedger.objects,
        [instanceId]: {
          ...object,
          definition: {
            ...object.definition,
            physical:
              beforeSystem.storagePhysical as D6StoragePhysicalProfileV1,
          },
          witness: receipt.writes[0]?.before?.witness ?? object.witness,
        },
      },
    };
    f.state = {
      ...f.state,
      ledger: beforeLedger,
      configurationReceipts: {
        ...f.state.configurationReceipts,
        [receipt.operationId]: {
          ...receipt,
          state: "reserved",
          writes: receipt.writes.map((write) => ({
            ...write,
            state: "applied",
          })),
        },
      },
    };
    f.readCount = 0;

    let releaseRecovery: (() => void) | undefined;
    const recoverySuspended = new Promise<void>((resolve) => {
      f.afterRead.mockImplementation((_snapshot, count) => {
        if (count !== 3) return Promise.resolve();
        return new Promise<void>((release) => {
          releaseRecovery = release;
          resolve();
        });
      });
    });
    const recovery = recoverGridStorageConfigurations();
    await recoverySuspended;

    item.system.storagePhysical = {
      ...(item.system.storagePhysical as Record<string, unknown>),
      widthMm: 999,
    };
    const newerLedger = {
      ...receipt.afterLedger,
      objects: {
        ...receipt.afterLedger.objects,
        [instanceId]: {
          ...object,
          definition: {
            ...object.definition,
            physical: {
              ...object.definition.physical,
              widthMm: 999,
            },
          },
          witness: "newer-committed-witness",
        },
      },
    };
    const suspendedState = f.state;
    f.state = { ...suspendedState, ledger: newerLedger };
    releaseRecovery?.();
    await recovery;

    expect(item.system.storagePhysical).toMatchObject({ widthMm: 999 });
    const recoveredState = f.state;
    expect(recoveredState.ledger).toEqual(newerLedger);
    expect(
      recoveredState.configurationReceipts?.[receipt.operationId]?.state,
    ).toBe("needs-attention");
  });

  it("preserves placements on valid reconfiguration and makes no write for an invalid resize", async () => {
    const { actor, contents } = actorFixture();
    const item = itemFixture(actor);
    item.system.storagePhysical = {
      ...(item.system.storagePhysical as Record<string, unknown>),
      footprintsByScale: {
        "personal-100": { columns: 2, rows: 2, provenance: "user" },
      },
    };
    contents.push(item);
    await configureGridStorageRoot(actor, spaceForm());
    const enrolled = f.state?.ledger.objects["instance-a"];
    if (!f.state || !enrolled) throw new Error("missing enrollment");
    (f.state.ledger.objects as Record<string, typeof enrolled>)["instance-a"] =
      {
        ...enrolled,
        location: {
          state: "placed",
          parent: {
            rootUuid: actor.uuid,
            spaceId: "primary",
            containerInstanceId: null,
            spaceOwnerActorUuid: actor.uuid,
          },
          rectangle: { x: 2, y: 1, columns: 2, rows: 2, rotation: "none" },
          disposition: "stored",
          pinned: false,
        },
      };
    const beforeUpdateCalls = vi.mocked(actor.update).mock.calls.length;
    const beforeMutations = f.mutation.mock.calls.length;

    await expect(
      saveGridStorageSpace(actor, spaceForm({ columns: 3, rows: 2 })),
    ).rejects.toThrow("D6E2.Storage.Error.InvalidLedger");
    expect(actor.update).toHaveBeenCalledTimes(beforeUpdateCalls);
    expect(f.mutation).toHaveBeenCalledTimes(beforeMutations);
    expect(f.state.ledger.objects["instance-a"]?.location).toEqual(
      enrolled.location.state === "placed"
        ? enrolled.location
        : {
            state: "placed",
            parent: {
              rootUuid: actor.uuid,
              spaceId: "primary",
              containerInstanceId: null,
              spaceOwnerActorUuid: actor.uuid,
            },
            rectangle: {
              x: 2,
              y: 1,
              columns: 2,
              rows: 2,
              rotation: "none",
            },
            disposition: "stored",
            pinned: false,
          },
    );

    await saveGridStorageSpace(actor, spaceForm({ columns: 5, rows: 4 }));
    expect(
      f.state.ledger.roots[actor.uuid]?.spaces.primary?.grid,
    ).toMatchObject({
      columns: 5,
      rows: 4,
    });
    expect(f.state.ledger.objects["instance-a"]?.location).toMatchObject({
      state: "placed",
      rectangle: { x: 2, y: 1, columns: 2, rows: 2 },
    });
  });

  it("persists and edits a container interior without replacing its exterior scale", async () => {
    const { actor, contents } = actorFixture();
    const container = itemFixture(actor);
    contents.push(container);
    await configureGridStorageRoot(actor, spaceForm());
    await configureGridStorageItem(
      container,
      physicalForm({
        sizePresetId: "field-kit",
        widthMm: 450,
        depthMm: 300,
        heightMm: 200,
        unitWeightGrams: 1250,
        exteriorVolumeMillilitres: 27000,
        container: true,
        "storageInterior.label": "Pack interior",
        "storageInterior.scalePresetId": "personal-100",
        "storageInterior.columns": 3,
        "storageInterior.rows": 2,
      }),
      "cargo-500",
    );
    expect(
      f.state?.ledger.objects["instance-a"]?.definition.interior,
    ).toMatchObject({
      id: "container:instance-a",
      label: "Pack interior",
      grid: { scaleId: "personal-100", columns: 3, rows: 2 },
    });

    await saveGridStorageInterior(container, {
      label: "Repacked",
      scalePresetId: "personal-100",
      columns: 4,
      rows: 3,
    });
    const configured = f.state?.ledger.objects["instance-a"]?.definition;
    expect(configured?.interior).toMatchObject({
      label: "Repacked",
      grid: { columns: 4, rows: 3 },
    });
    expect(configured?.physical.footprintsByScale["cargo-500"]).toMatchObject({
      columns: 1,
      rows: 1,
    });
    expect(
      configured?.physical.footprintsByScale["personal-100"],
    ).toBeUndefined();
    expect(configured?.physical).toMatchObject({
      presetId: "field-kit",
      widthMm: 450,
      depthMm: 300,
      heightMm: 200,
      unitTareWeightGrams: 1250,
      unitExteriorVolumeMillilitres: 27000,
    });
  });

  it("refuses to deconfigure a funded container interior", async () => {
    const { actor, contents } = actorFixture();
    const container = itemFixture(actor);
    contents.push(container);
    await configureGridStorageRoot(actor, spaceForm());
    await configureGridStorageItem(
      container,
      physicalForm({
        container: true,
        "storageInterior.label": "Pouch",
        "storageInterior.scalePresetId": "personal-100",
      }),
      "cargo-500",
    );
    container.system.currencyWallet = createCurrencyWallet(
      LEGACY_CURRENCY_DEFINITION,
      { currency: "2" },
    );

    await expect(
      configureGridStorageItem(
        container,
        physicalForm({ container: false }),
        "cargo-500",
      ),
    ).rejects.toThrow("D6E2.Storage.Currency.Error.FundsPresent");
    expect(container.system.storageInterior).toMatchObject({
      configured: true,
    });
  });
});
