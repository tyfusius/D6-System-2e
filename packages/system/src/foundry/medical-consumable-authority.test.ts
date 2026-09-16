/* eslint-disable @typescript-eslint/unbound-method -- Foundry document methods are Vitest mocks asserted without invocation. */
import { requireDestinyValue as required } from "@d6-system-2e/core";
import type { D6StorageOperationRequestV1 } from "@d6-system-2e/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimFirstEditionActionStage,
  recordFirstEditionActionStage,
} from "../application/first-edition-action-root";
import type { MedicalConsumableRootV1 } from "../application/medical-consumable-root";
import {
  processMedicalRootOperation,
  registerMedicalConsumableSocket,
  resetMedicalConsumableAuthorityForTests,
  requestMedicalRoot,
  setMedicalRootRenderer,
} from "./medical-consumable-authority";
import { excludesMovementSelfRollViewer } from "./first-edition-movement-visibility";

interface StorageTestState {
  readonly version: 1;
  ledger: {
    readonly version: 1;
    revision: number;
    readonly roots: Record<string, unknown>;
    objects: Record<string, { readonly witness?: string }>;
  };
  readonly receipts: Record<
    string,
    {
      readonly state: string;
      readonly response?: { readonly status: string };
      readonly request: D6StorageOperationRequestV1;
      readonly writes: readonly { readonly documentUuid: string }[];
    }
  >;
}

const f = vi.hoisted(() => ({
  count: 0,
  declaration: "action-commitment",
  envelopes: new Map<string, unknown>(),
  round: null as Record<string, unknown> | null,
  actionReceipts: new Map<string, unknown>(),
  approvalRecipients: [] as string[],
  spend: vi.fn(),
  hydrate: vi.fn(),
  storageState: undefined as StorageTestState | undefined,
  storageOperation: vi.fn(),
  storageSynchronize: vi.fn(),
  storageRequireAction: vi.fn(() => Promise.resolve()),
}));

vi.mock("./destiny-crypto", () => ({
  heartbeatDestinyCrypto: () => Promise.resolve(),
  destinyClientIsAuthority: () => game.user?.id === "gm",
  destinyActiveAuthority: () => ({ userId: "gm" }),
  destinyEnrolledGMIds: () => ["gm"],
  destinyNativeAuthor: (message: { author: { id: string } }) =>
    message.author.id,
  sealDestiny: (_topic: string, value: unknown) => {
    const ciphertext = `sealed-${++f.count}`;
    f.envelopes.set(ciphertext, structuredClone(value));
    return Promise.resolve({ ciphertext });
  },
  openDestinyEnvelope: (_topic: string, envelope: { ciphertext: string }) =>
    Promise.resolve(structuredClone(f.envelopes.get(envelope.ciphertext))),
}));
vi.mock("./foundry-random-id", () => ({
  foundryRandomId: () => `opaque-${++f.count}`,
}));
vi.mock("../settings/rules-profile-library", () => ({
  currentConfiguredRulesProfile: () => ({
    id: "open-d6",
    homebrew: { tyfusiusMedicalConsumables: true },
    strategies: { actionEconomy: "open-d6.action-economy.flexible" },
  }),
}));
vi.mock("../settings/action-economy", () => ({
  currentActionEconomyRuntimeStrategy: () => ({
    declaration: f.declaration,
  }),
}));
vi.mock("./health-runtime", () => ({
  readActorHealth: (actor: { wound?: string }) => ({
    kind: "track",
    modelId: "open-d6.health.wound-track",
    damageStrategyId: "open-d6.damage.wounds",
    track: {
      currentStateId: actor.wound ?? "wounded",
      currentState: { penaltyScore: 3 },
      firstEditionState: { consciousness: "conscious" },
    },
  }),
}));
vi.mock("./initiating-action-message", () => ({
  hydrateD6FoundryRolls: f.hydrate,
}));
vi.mock("./combat-round-private", () => ({
  PRIVATE_COMBAT_AUTHORITY: Symbol("private-combat-authority"),
}));
vi.mock("./combat-service", () => ({
  readCombatantRound: () => f.round,
  readFirstEditionCombatantActionReceipt: (_actor: unknown, key: string) =>
    f.actionReceipts.get(key),
  spendFirstEditionCombatantAction: f.spend,
}));
vi.mock("./pending-interactions", () => ({
  registerFoundryPendingInteraction: vi.fn(() => Promise.resolve()),
}));
vi.mock("../application/pending-interactions", () => ({
  resolveD6PendingInteraction: vi.fn(),
}));
vi.mock("./grid-storage-authority", () => ({
  requestGridStorageOperation: f.storageOperation,
}));
vi.mock("./grid-storage-state", () => ({
  readGridStorageAuthorityState: () =>
    Promise.resolve(structuredClone(f.storageState)),
}));
vi.mock("./grid-storage-document-adapter", () => ({
  gridStorageItemParticipates: (item: FoundryItemDocument) =>
    typeof item.system.storageInstanceId === "string" &&
    item.system.storageInstanceId.length > 0,
}));
vi.mock("./grid-storage-mutation-guard", () => ({
  GRID_STORAGE_AUTHORITY_WRITE_OPTION: "d6GridStorageAuthorityWrite",
  synchronizeGridStorageItemWitness: f.storageSynchronize,
}));
vi.mock("./grid-storage-availability", () => ({
  requireGridStorageItemAction: f.storageRequireAction,
}));

const gm = { id: "gm", active: true, isGM: true, name: "GM" } as FoundryUser;
const owner = {
  id: "owner",
  active: true,
  isGM: false,
  name: "Owner",
} as FoundryUser;
const controller = {
  id: "controller",
  active: true,
  isGM: false,
  name: "Controller",
} as FoundryUser;

let docs: Map<string, unknown>;
let messages: Map<string, FoundryChatMessageDocument>;
let settings: Map<string, unknown>;
let socketHandler: ((packet: unknown, senderId?: string) => void) | undefined;

function patch(
  target: Record<string, unknown>,
  changes: Record<string, unknown>,
) {
  for (const [path, value] of Object.entries(changes)) {
    const parts = path.split(".");
    let destination = target;
    for (const part of parts.slice(0, -1)) {
      destination[part] ??= {};
      destination = destination[part] as Record<string, unknown>;
    }
    destination[required(parts.at(-1))] = structuredClone(value);
  }
}

function actor(
  id: string,
  owners: readonly string[],
  name = id,
  observers: readonly string[] = [],
): FoundryActorDocument & { uuid: string; wound: string } {
  const value = {
    id,
    uuid: `Actor.${id}`,
    name,
    type: "character",
    wound: "wounded",
    system: {
      health: { firstEditionState: { consciousness: "conscious" } },
      medical: {
        physiology: { kind: "biological", revision: 1, source: "world" },
        stim: { version: 0, useId: "", effectId: "", status: "none" },
      },
    },
    flags: {} as Record<string, unknown>,
    items: { contents: [] as FoundryItemDocument[], get: vi.fn() },
    sheet: { render: vi.fn() },
    testUserPermission: (user: FoundryUser, level: string) =>
      owners.includes(user.id) ||
      (level === "OBSERVER" && observers.includes(user.id)),
    getFlag: (namespace: string, key: string) =>
      (value.flags[namespace] as Record<string, unknown> | undefined)?.[key],
    update: vi.fn((changes: Record<string, unknown>) => {
      changes._id ??= value.id;
      patch(value, changes);
      return Promise.resolve(value);
    }),
  };
  docs.set(value.uuid, value);
  return value as unknown as FoundryActorDocument & {
    uuid: string;
    wound: string;
  };
}

function stim(
  administrator: FoundryActorDocument & { uuid: string },
  id = "stim",
) {
  const value = {
    id,
    uuid: `${administrator.uuid}.Item.${id}`,
    name: "Model B Stim",
    type: "gear",
    parent: administrator,
    system: {
      quantity: 1,
      gearCategory: "medical-consumable",
      medicalConsumable: {
        version: 1,
        effectId: "tyfusius.model-b-wound-penalty-suppression",
        compatibility: "biological",
        treatmentFamily: "none",
        duration: { dice: 1, faces: 6, unit: "rounds" },
        actionCost: 1,
        doseCost: 1,
      },
    },
    flags: {} as Record<string, unknown>,
    getFlag: (namespace: string, key: string) =>
      (value.flags[namespace] as Record<string, unknown> | undefined)?.[key],
    update: vi.fn((changes: Record<string, unknown>) => {
      changes._id ??= value.id;
      patch(value, changes);
      return Promise.resolve(value);
    }),
  };
  docs.set(value.uuid, value);
  return value;
}

function invoke(
  method: string,
  rootMessageId: string,
  data: Record<string, unknown> = {},
  user: FoundryUser = owner,
) {
  return processMedicalRootOperation({ method, rootMessageId, ...data }, user);
}

function createInput(
  rootMessageId: string,
  useId: string,
  administrator: FoundryActorDocument & { uuid: string },
  patient: FoundryActorDocument & { uuid: string },
  item: { uuid: string },
) {
  return {
    rootMessageId,
    useId,
    administratorUuid: administrator.uuid,
    patientUuid: patient.uuid,
    itemUuid: item.uuid,
    rollMode: "selfroll",
  };
}

async function durationRecorded(
  root: MedicalConsumableRootV1,
  rollMode: "publicroll" | "gmroll" | "selfroll" | "blindroll" = "selfroll",
) {
  const duration = required(root.action.stages[0]);
  const claimed = claimFirstEditionActionStage(
    root.action,
    duration.id,
    owner.id,
    { kind: "plain-d6", dice: 1, rollMode },
  );
  expect(
    await invoke("cas", root.action.rootMessageId, {
      revision: root.action.revision,
      next: claimed,
    }),
  ).toBe(true);
  const recorded = recordFirstEditionActionStage(claimed, duration.id, {
    kind: "plain-d6",
    total: 4,
    faces: [4],
    artifacts: [
      {
        version: 1,
        serialized: "saved-duration",
        evidence: {
          formula: "1d6",
          faces: [4],
          total: 4,
          fingerprint: "a".repeat(64),
        },
      },
    ],
  });
  expect(
    await invoke("cas", root.action.rootMessageId, {
      revision: claimed.revision,
      next: recorded,
    }),
  ).toBe(true);
  return (await invoke(
    "advance",
    root.action.rootMessageId,
  )) as MedicalConsumableRootV1;
}

beforeEach(() => {
  resetMedicalConsumableAuthorityForTests();
  f.count = 0;
  f.declaration = "action-commitment";
  f.envelopes.clear();
  f.round = null;
  f.actionReceipts.clear();
  f.approvalRecipients = [];
  f.storageState = {
    version: 1,
    ledger: { version: 1, revision: 0, roots: {}, objects: {} },
    receipts: {},
  };
  f.storageOperation.mockReset();
  f.storageSynchronize.mockReset().mockResolvedValue(undefined);
  f.storageRequireAction.mockReset().mockResolvedValue(undefined);
  f.hydrate.mockReset().mockResolvedValue([]);
  f.spend
    .mockReset()
    .mockImplementation(
      (
        _actor: unknown,
        _revision: number,
        _authority: symbol,
        _combatantId: string,
        receipt: { key: string; value: unknown },
      ) => {
        f.actionReceipts.set(receipt.key, structuredClone(receipt.value));
        if (f.round)
          f.round = { ...f.round, revision: Number(f.round.revision) + 1 };
        return Promise.resolve({ changed: true, state: f.round });
      },
    );
  docs = new Map();
  messages = new Map();
  settings = new Map();
  socketHandler = undefined;
  vi.stubGlobal("fromUuid", (uuid: string) => Promise.resolve(docs.get(uuid)));
  vi.stubGlobal("game", {
    user: gm,
    users: {
      contents: [gm, owner, controller],
      get: (id: string) =>
        [gm, owner, controller].find((user) => user.id === id),
    },
    messages,
    combats: { contents: [] },
    settings: {
      get: (_namespace: string, key: string) => settings.get(key),
      set: vi.fn((_namespace: string, key: string, value: unknown) => {
        settings.set(key, value);
        return Promise.resolve(value);
      }),
    },
    time: { worldTime: 100 },
    i18n: {
      localize: (key: string) => key,
      format: (key: string) => key,
    },
    socket: {
      on: (_channel: string, handler: typeof socketHandler) => {
        socketHandler = handler;
      },
      emit: (
        _channel: string,
        packet: Record<string, unknown>,
        options?: { recipients?: string[] },
      ) => {
        if (packet.type === "medical-approval-request") {
          f.approvalRecipients = options?.recipients ?? [];
          queueMicrotask(() =>
            socketHandler?.(
              {
                type: "medical-approval-response",
                requestId: packet.requestId,
                requesterUserId: packet.requesterUserId,
                targetUserId: packet.targetUserId,
                useId: packet.useId,
                accepted: true,
              },
              String(packet.targetUserId),
            ),
          );
        }
      },
    },
  });
  vi.stubGlobal("ChatMessage", {
    getSpeaker: () => ({ actor: "administrator" }),
    create: vi.fn((data: Record<string, unknown>) => {
      const message = {
        id: String(data._id),
        author: gm,
        ...data,
        flags: data.flags as Record<string, Record<string, unknown>>,
        getFlag: (namespace: string, key: string) =>
          message.flags[namespace]?.[key],
        update: vi.fn((changes: Record<string, unknown>) => {
          changes._id ??= message.id;
          patch(message, changes);
          return Promise.resolve(message);
        }),
      };
      messages.set(
        message.id,
        message as unknown as FoundryChatMessageDocument,
      );
      return Promise.resolve(message);
    }),
  });
  setMedicalRootRenderer((root) =>
    Promise.resolve(`status:${root.action.status}`),
  );
});

describe("medical consumable authority transaction", () => {
  it("serializes the shared last dose and patient reservation, then releases an all-pending cancellation", async () => {
    const administrator = actor("administrator", [owner.id]);
    const patient = actor("patient", [owner.id]);
    const item = stim(administrator);
    const results = await Promise.allSettled([
      invoke(
        "create",
        "medicalroot00001",
        createInput(
          "medicalroot00001",
          "medicaluse000001",
          administrator,
          patient,
          item,
        ),
      ),
      invoke(
        "create",
        "medicalroot00002",
        createInput(
          "medicalroot00002",
          "medicaluse000002",
          administrator,
          patient,
          item,
        ),
      ),
    ]);
    expect(results.map(({ status }) => status)).toEqual([
      "fulfilled",
      "rejected",
    ]);
    expect(messages.size).toBe(1);
    await invoke("cancel", "medicalroot00001");
    await expect(
      invoke(
        "create",
        "medicalroot00003",
        createInput(
          "medicalroot00003",
          "medicaluse000003",
          administrator,
          patient,
          item,
        ),
      ),
    ).resolves.toMatchObject({ useId: "medicaluse000003" });
  });

  it("rejects cancellation after duration claim and retains that same saved die", async () => {
    const administrator = actor("administrator", [owner.id]);
    const patient = actor("patient", [owner.id]);
    const item = stim(administrator);
    const root = (await invoke(
      "create",
      "medicalroot00011",
      createInput(
        "medicalroot00011",
        "medicaluse000011",
        administrator,
        patient,
        item,
      ),
    )) as MedicalConsumableRootV1;
    const duration = required(root.action.stages[0]);
    const claimed = claimFirstEditionActionStage(
      root.action,
      duration.id,
      owner.id,
      { kind: "plain-d6", dice: 1, rollMode: "selfroll" },
    );
    expect(
      await invoke("cas", root.action.rootMessageId, {
        revision: root.action.revision,
        next: claimed,
      }),
    ).toBe(true);
    await expect(invoke("cancel", root.action.rootMessageId)).rejects.toThrow();
    const recorded = recordFirstEditionActionStage(claimed, duration.id, {
      kind: "plain-d6",
      total: 6,
      faces: [6],
      artifacts: [
        {
          version: 1,
          serialized: "original-six",
          evidence: {
            formula: "1d6",
            faces: [6],
            total: 6,
            fingerprint: "b".repeat(64),
          },
        },
      ],
    });
    expect(
      await invoke("cas", root.action.rootMessageId, {
        revision: claimed.revision,
        next: recorded,
      }),
    ).toBe(true);
    const loaded = (await invoke(
      "load",
      root.action.rootMessageId,
    )) as MedicalConsumableRootV1;
    expect(loaded.action.stages[0]?.receipt).toMatchObject({
      kind: "plain-d6",
      total: 6,
      faces: [6],
      artifacts: [{ serialized: "original-six" }],
    });
  });

  it("repairs an action-plus-dose reply loss without charging either twice", async () => {
    const administrator = actor("administrator", [owner.id]);
    const patient = actor("patient", [owner.id]);
    const item = stim(administrator);
    f.round = {
      combatantId: "combatant",
      actionEconomyStrategyId: "open-d6.action-economy.flexible",
      revision: 2,
      round: 4,
      firstEditionCommitment: {
        actionAllotment: 1,
        defense: "none",
        plannedActionCount: 2,
        spentActionCount: 0,
      },
    };
    const created = (await invoke(
      "create",
      "medicalroot00021",
      createInput(
        "medicalroot00021",
        "medicaluse000021",
        administrator,
        patient,
        item,
      ),
    )) as MedicalConsumableRootV1;
    const root = await durationRecorded(created);
    item.update.mockImplementationOnce((changes) => {
      patch(item, changes);
      return Promise.reject(new Error("reply lost"));
    });
    await expect(invoke("effect", root.action.rootMessageId)).rejects.toThrow(
      "reply lost",
    );
    f.round = null;
    await expect(
      invoke("effect", root.action.rootMessageId),
    ).resolves.toBeDefined();
    expect(f.spend).toHaveBeenCalledTimes(1);
    expect(item.update).toHaveBeenCalledTimes(1);
    expect(item.system.quantity).toBe(0);
    const loaded = (await invoke(
      "load",
      root.action.rootMessageId,
    )) as MedicalConsumableRootV1;
    expect(loaded.action.stages[1]?.state).toBe("recorded");
  });

  it("resumes the medical receipt after a participating storage depletion commits", async () => {
    const administrator = actor("administrator", [owner.id]);
    const patient = actor("patient", [owner.id]);
    const item = stim(administrator);
    Object.assign(item.system, { storageInstanceId: "stored-stim" });
    f.storageState = {
      version: 1,
      ledger: {
        version: 1,
        revision: 7,
        roots: {},
        objects: {
          "stored-stim": {
            witness: "stored-witness",
          },
        },
      },
      receipts: {},
    };
    f.storageOperation.mockImplementation(
      (request: Extract<D6StorageOperationRequestV1, { kind: "quantity" }>) => {
        item.system.quantity = 0;
        Object.assign(item.system, { storageInstanceId: "" });
        if (!f.storageState) throw new Error("missing storage state");
        f.storageState.ledger.revision = 8;
        f.storageState.ledger.objects = {};
        f.storageState.receipts[request.value.operationId] = {
          state: "completed",
          response: { status: "completed" },
          request,
          writes: [{ documentUuid: item.uuid }],
        };
        return Promise.resolve({
          version: 1,
          operationId: request.value.operationId,
          status: "completed",
          projectionToken: null,
        });
      },
    );
    const created = (await invoke(
      "create",
      "medicalroot00022",
      createInput(
        "medicalroot00022",
        "medicaluse000022",
        administrator,
        patient,
        item,
      ),
    )) as MedicalConsumableRootV1;
    const root = await durationRecorded(created);
    item.update.mockRejectedValueOnce(new Error("medical receipt interrupted"));

    await expect(invoke("effect", root.action.rootMessageId)).rejects.toThrow(
      "medical receipt interrupted",
    );
    await expect(
      invoke("effect", root.action.rootMessageId),
    ).resolves.toBeDefined();

    expect(f.storageOperation).toHaveBeenCalledTimes(1);
    expect(item.system.quantity).toBe(0);
    expect((item.system as Record<string, unknown>).storageInstanceId).toBe("");
    expect(f.storageSynchronize).toHaveBeenCalledTimes(1);
  });

  it("allows only a GM to end saved post-duration work and records the termination in sealed authority", async () => {
    const administrator = actor("administrator", [owner.id]);
    const patient = actor("patient", [owner.id]);
    const item = stim(administrator);
    const created = (await invoke(
      "create",
      "medicalroot00025",
      createInput(
        "medicalroot00025",
        "medicaluse000025",
        administrator,
        patient,
        item,
      ),
    )) as MedicalConsumableRootV1;
    const root = await durationRecorded(created);
    await expect(
      invoke("end-operation", root.action.rootMessageId),
    ).rejects.toThrow("authority");
    const ended = (await invoke(
      "end-operation",
      root.action.rootMessageId,
      {},
      gm,
    )) as MedicalConsumableRootV1;
    expect(ended.action.status).toBe("cancelled");
    expect(item.system.quantity).toBe(1);
    const envelope = settings.get("medicalConsumableAuthority") as {
      ciphertext: string;
    };
    const authority = f.envelopes.get(envelope.ciphertext) as {
      roots: Record<string, { termination?: Record<string, unknown> }>;
    };
    expect(authority.roots.medicalroot00025?.termination).toMatchObject({
      version: 1,
      userId: gm.id,
      reason: "manual",
    });
  });

  it("rejects a mixed persisted scheduler before creating a root or rolling", async () => {
    const administrator = actor("administrator", [owner.id]);
    const patient = actor("patient", [owner.id]);
    const item = stim(administrator);
    f.declaration = "ordered-actions";
    f.round = {
      combatantId: "combatant",
      actionEconomyStrategyId: "open-d6.action-economy.flexible",
      revision: 2,
      round: 4,
    };
    await expect(
      invoke(
        "create",
        "medicalroot00031",
        createInput(
          "medicalroot00031",
          "medicaluse000031",
          administrator,
          patient,
          item,
        ),
      ),
    ).rejects.toThrow("D6E2.Medical.Error.ActionUnavailable");
    expect(messages.size).toBe(0);
    expect(settings.has("medicalConsumableAuthority")).toBe(false);
  });

  it("binds cross-controller consent to the exact use and keeps authority data sealed", async () => {
    registerMedicalConsumableSocket();
    const administrator = actor("administrator", [owner.id], "<Admin>");
    const patient = actor("patient", [controller.id], "<Patient>");
    const item = stim(administrator);
    await expect(
      invoke(
        "create",
        "medicalroot00041",
        createInput(
          "medicalroot00041",
          "medicaluse000041",
          administrator,
          patient,
          item,
        ),
      ),
    ).resolves.toMatchObject({ useId: "medicaluse000041" });
    const envelope = settings.get("medicalConsumableAuthority") as {
      ciphertext: string;
    };
    expect(envelope.ciphertext).toMatch(/^sealed-/u);
    expect(JSON.stringify(envelope)).not.toMatch(/medicaluse|Admin|Patient/u);
    const authority = f.envelopes.get(envelope.ciphertext) as {
      roots: Record<string, { approval?: Record<string, unknown> }>;
    };
    const approval = authority.roots.medicalroot00041?.approval;
    expect(approval).toMatchObject({
      version: 1,
      controllerUserId: controller.id,
      useId: "medicaluse000041",
    });
    expect(approval?.requestId).toMatch(/^opaque-/u);
    expect(f.approvalRecipients).toEqual([controller.id]);
  });

  it("restores the latest saved root after deletion without reopening duration", async () => {
    const administrator = actor("administrator", [owner.id]);
    const patient = actor("patient", [owner.id]);
    const item = stim(administrator);
    const input = createInput(
      "medicalroot00051",
      "medicaluse000051",
      administrator,
      patient,
      item,
    );
    const created = (await invoke(
      "create",
      "medicalroot00051",
      input,
    )) as MedicalConsumableRootV1;
    const recorded = await durationRecorded(created);
    messages.delete(recorded.action.rootMessageId);
    const restored = (await invoke(
      "create",
      recorded.action.rootMessageId,
      input,
    )) as MedicalConsumableRootV1;
    expect(restored.action.stages[0]).toMatchObject({
      state: "recorded",
      receipt: { kind: "plain-d6", total: 4 },
    });
    expect(restored.action.stages[1]?.state).toBe("pending");
  });

  it("recovers write-ahead duration progress when the ChatMessage write fails", async () => {
    const administrator = actor("administrator", [owner.id]);
    const patient = actor("patient", [owner.id]);
    const item = stim(administrator);
    const input = createInput(
      "medicalroot00057",
      "medicaluse000057",
      administrator,
      patient,
      item,
    );
    const created = (await invoke(
      "create",
      "medicalroot00057",
      input,
    )) as MedicalConsumableRootV1;
    const duration = required(created.action.stages[0]);
    const claimed = claimFirstEditionActionStage(
      created.action,
      duration.id,
      owner.id,
      { kind: "plain-d6", dice: 1, rollMode: "selfroll" },
    );
    expect(
      await invoke("cas", created.action.rootMessageId, {
        revision: created.action.revision,
        next: claimed,
      }),
    ).toBe(true);
    const recorded = recordFirstEditionActionStage(claimed, duration.id, {
      kind: "plain-d6",
      total: 5,
      faces: [5],
      artifacts: [
        {
          version: 1,
          serialized: "write-ahead-five",
          evidence: {
            formula: "1d6",
            faces: [5],
            total: 5,
            fingerprint: "c".repeat(64),
          },
        },
      ],
    });
    const message = required(messages.get(created.action.rootMessageId));
    (message.update as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("message write failed"),
    );
    await expect(
      invoke("cas", created.action.rootMessageId, {
        revision: claimed.revision,
        next: recorded,
      }),
    ).rejects.toThrow("message write failed");
    messages.delete(created.action.rootMessageId);
    const restored = (await invoke(
      "create",
      created.action.rootMessageId,
      input,
    )) as MedicalConsumableRootV1;
    expect(restored.action.stages[0]).toMatchObject({
      state: "recorded",
      receipt: { total: 5, artifacts: [{ serialized: "write-ahead-five" }] },
    });
  });

  it.each([
    ["publicroll", false, []],
    ["gmroll", false, [gm.id, owner.id]],
    ["selfroll", false, [owner.id]],
    ["blindroll", true, [gm.id]],
  ] as const)(
    "restores the bound %s audience when recovering a deleted saved root",
    async (rollMode, blind, whisper) => {
      const administrator = actor("administrator", [owner.id]);
      const patient = actor("patient", [owner.id]);
      const item = stim(administrator);
      const input = {
        ...createInput(
          "medicalroot00058",
          "medicaluse000058",
          administrator,
          patient,
          item,
        ),
        rollMode,
      };
      const created = (await invoke(
        "create",
        "medicalroot00058",
        input,
      )) as MedicalConsumableRootV1;
      const recorded = await durationRecorded(created, rollMode);
      messages.delete(recorded.action.rootMessageId);
      await invoke("create", recorded.action.rootMessageId, input);
      const recovered = required(messages.get(recorded.action.rootMessageId));
      expect(recovered.blind).toBe(blind);
      expect(recovered.whisper).toEqual(whisper);
      expect(
        (
          recovered.getFlag(
            "d6-system-2e",
            "medicalConsumableRoot",
          ) as MedicalConsumableRootV1
        ).action.stages[0]?.receipt,
      ).toMatchObject({ total: 4 });
    },
  );

  it("retires the reservation atomically with write-ahead completion", async () => {
    const administrator = actor("administrator", [owner.id]);
    const patient = actor("patient", [owner.id]);
    const item = stim(administrator);
    const input = createInput(
      "medicalroot00059",
      "medicaluse000059",
      administrator,
      patient,
      item,
    );
    const created = (await invoke(
      "create",
      "medicalroot00059",
      input,
    )) as MedicalConsumableRootV1;
    const applied = await durationRecorded(created);
    await invoke("effect", applied.action.rootMessageId);
    const message = required(messages.get(applied.action.rootMessageId));
    (message.update as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("completion message failed"),
    );
    await expect(
      invoke("advance", applied.action.rootMessageId),
    ).rejects.toThrow("completion message failed");
    const envelope = settings.get("medicalConsumableAuthority") as {
      ciphertext: string;
    };
    const state = f.envelopes.get(envelope.ciphertext) as {
      roots: Record<
        string,
        { retired?: true; latestRoot: MedicalConsumableRootV1 }
      >;
    };
    expect(state.roots.medicalroot00059).toMatchObject({
      retired: true,
      latestRoot: { action: { status: "complete" } },
    });
    messages.delete(applied.action.rootMessageId);
    await expect(
      invoke("create", applied.action.rootMessageId, input),
    ).resolves.toMatchObject({ action: { status: "complete" } });
  });

  it("retries completion when the atomic authority save itself fails", async () => {
    const administrator = actor("administrator", [owner.id]);
    const patient = actor("patient", [owner.id]);
    const item = stim(administrator);
    const input = createInput(
      "medicalroot00060",
      "medicaluse000060",
      administrator,
      patient,
      item,
    );
    const created = (await invoke(
      "create",
      "medicalroot00060",
      input,
    )) as MedicalConsumableRootV1;
    const applied = await durationRecorded(created);
    await invoke("effect", applied.action.rootMessageId);
    const configured = game.settings.set.bind(game.settings);
    (game.settings as unknown as { set: ReturnType<typeof vi.fn> }).set = vi
      .fn()
      .mockRejectedValueOnce(new Error("authority save failed"))
      .mockImplementation(configured);
    await expect(
      invoke("advance", applied.action.rootMessageId),
    ).rejects.toThrow("authority save failed");
    await expect(
      invoke("advance", applied.action.rootMessageId),
    ).resolves.toMatchObject({ action: { status: "complete" } });
    const envelope = settings.get("medicalConsumableAuthority") as {
      ciphertext: string;
    };
    const state = f.envelopes.get(envelope.ciphertext) as {
      roots: Record<string, { retired?: true }>;
    };
    expect(state.roots.medicalroot00060?.retired).toBe(true);
  });

  it("releases a completed reservation but enforces no-stack until GM end", async () => {
    const administrator = actor("administrator", [owner.id]);
    const patient = actor("patient", [owner.id]);
    const item = stim(administrator, "stim-one");
    const second = stim(administrator, "stim-two");
    const created = (await invoke(
      "create",
      "medicalroot00052",
      createInput(
        "medicalroot00052",
        "medicaluse000052",
        administrator,
        patient,
        item,
      ),
    )) as MedicalConsumableRootV1;
    const applied = await durationRecorded(created);
    await invoke("effect", applied.action.rootMessageId);
    await invoke("advance", applied.action.rootMessageId);
    await expect(
      invoke(
        "create",
        applied.action.rootMessageId,
        createInput(
          applied.action.rootMessageId,
          "medicaluse000052",
          administrator,
          patient,
          item,
        ),
      ),
    ).resolves.toMatchObject({ action: { status: "complete" } });
    const next = createInput(
      "medicalroot00053",
      "medicaluse000053",
      administrator,
      patient,
      second,
    );
    await expect(invoke("create", "medicalroot00053", next)).rejects.toThrow();
    await invoke(
      "end-effect",
      "",
      { actorUuid: patient.uuid, useId: "medicaluse000052" },
      gm,
    );
    const patientEnvelope = patient.getFlag(
      "d6-system-2e",
      "medicalConsumableAuthority",
    ) as { ciphertext: string };
    const patientAuthority = f.envelopes.get(patientEnvelope.ciphertext) as {
      active: { sourceActorUuid: string };
      audits: { kind: string; actorUserId: string }[];
    };
    expect(patientAuthority.active.sourceActorUuid).toBe(administrator.uuid);
    expect(patientAuthority.audits.at(-1)).toMatchObject({
      kind: "end",
      actorUserId: gm.id,
    });
    expect(
      messages
        .get("medicalroot00052")
        ?.getFlag("d6-system-2e", "medicalEffectStatus"),
    ).toBe("ended");
    const endedView = (await invoke(
      "view",
      "",
      { actorUuid: patient.uuid },
      gm,
    )) as { stim?: { controls: unknown[]; status: string } };
    expect(endedView.stim).toMatchObject({ status: "ended", controls: [] });
    expect(
      messages
        .get("medicalroot00052")
        ?.getFlag("d6-system-2e", "medicalEffectStatus"),
    ).toBe("ended");
    const bindingEnvelope = settings.get("medicalConsumableAuthority") as {
      ciphertext: string;
    };
    const bindingState = f.envelopes.get(bindingEnvelope.ciphertext) as {
      roots: Record<string, { retired?: boolean }>;
    };
    expect(bindingState.roots).toMatchObject({
      medicalroot00052: { retired: true },
    });
    await expect(
      invoke("create", "medicalroot00053", next),
    ).resolves.toBeDefined();
  });

  it("revalidates after the action write before spending a dose", async () => {
    const administrator = actor("administrator", [owner.id]);
    const patient = actor("patient", [owner.id]);
    const item = stim(administrator);
    f.round = {
      combatantId: "combatant",
      actionEconomyStrategyId: "open-d6.action-economy.flexible",
      revision: 2,
      round: 4,
      firstEditionCommitment: { plannedActionCount: 1 },
    };
    f.spend.mockImplementationOnce(
      (
        _actor: unknown,
        _revision: number,
        _authority: symbol,
        _combatantId: string,
        receipt: { key: string; value: unknown },
      ) => {
        f.actionReceipts.set(receipt.key, structuredClone(receipt.value));
        (
          patient.system.medical as { physiology: { revision: number } }
        ).physiology.revision += 1;
        return Promise.resolve({ changed: true, state: f.round });
      },
    );
    const created = (await invoke(
      "create",
      "medicalroot00054",
      createInput(
        "medicalroot00054",
        "medicaluse000054",
        administrator,
        patient,
        item,
      ),
    )) as MedicalConsumableRootV1;
    const root = await durationRecorded(created);
    await expect(invoke("effect", root.action.rootMessageId)).rejects.toThrow();
    expect(item.system.quantity).toBe(1);
    f.actionReceipts.clear();
    f.round = null;
    const ended = (await invoke(
      "end-operation",
      root.action.rootMessageId,
      {},
      gm,
    )) as MedicalConsumableRootV1;
    expect(ended.action.status).toBe("cancelled");
    const envelope = settings.get("medicalConsumableAuthority") as {
      ciphertext: string;
    };
    const authority = f.envelopes.get(envelope.ciphertext) as {
      roots: Record<string, { termination?: { actionReceipt?: string } }>;
    };
    expect(
      authority.roots.medicalroot00054?.termination?.actionReceipt,
    ).toContain("medicaluse000054");
  });

  it("completes from patient proof after a lost root update despite later ineligibility", async () => {
    const administrator = actor("administrator", [owner.id]);
    const patient = actor("patient", [owner.id]);
    const item = stim(administrator);
    const created = (await invoke(
      "create",
      "medicalroot00056",
      createInput(
        "medicalroot00056",
        "medicaluse000056",
        administrator,
        patient,
        item,
      ),
    )) as MedicalConsumableRootV1;
    const root = await durationRecorded(created);
    (patient.update as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (changes: Record<string, unknown>) => {
        patch(patient as unknown as Record<string, unknown>, changes);
        const message = required(messages.get(root.action.rootMessageId));
        (message.update as ReturnType<typeof vi.fn>).mockImplementationOnce(
          (messageChanges: Record<string, unknown>) => {
            patch(
              message as unknown as Record<string, unknown>,
              messageChanges,
            );
            return Promise.reject(new Error("root update lost"));
          },
        );
        return Promise.resolve(patient);
      },
    );
    await expect(invoke("effect", root.action.rootMessageId)).rejects.toThrow(
      "root update lost",
    );
    patient.wound = "healthy";
    await expect(
      invoke("effect", root.action.rootMessageId),
    ).resolves.toBeDefined();
    await invoke("advance", root.action.rootMessageId);
    const loaded = (await invoke(
      "load",
      root.action.rootMessageId,
    )) as MedicalConsumableRootV1;
    expect(loaded.action.status).toBe("complete");
    expect(item.update).toHaveBeenCalledTimes(1);
  });

  it("keeps Self history and GM-authored content hidden from another GM", async () => {
    const administrator = actor("administrator", [owner.id]);
    const patient = actor("patient", [owner.id]);
    const item = stim(administrator);
    const created = (await invoke(
      "create",
      "medicalroot00055",
      createInput(
        "medicalroot00055",
        "medicaluse000055",
        administrator,
        patient,
        item,
      ),
    )) as MedicalConsumableRootV1;
    expect(
      excludesMovementSelfRollViewer(
        required(messages.get(created.action.rootMessageId)),
        gm.id,
      ),
    ).toBe(true);
    await invoke(
      "effect",
      (await durationRecorded(created)).action.rootMessageId,
    );
    const view = (await invoke(
      "view",
      "",
      { actorUuid: patient.uuid },
      gm,
    )) as {
      stim?: { itemName: string; expiryLabel: string; history: unknown[] };
    };
    expect(view.stim?.itemName).toBe("Medical effect");
    expect(view.stim?.expiryLabel).toBe("Timing hidden");
    expect(view.stim?.history).toEqual([]);
  });

  it("rechecks direct patient ownership before committing an effect", async () => {
    const administrator = actor("administrator", [owner.id]);
    const patientOwners = [owner.id];
    const patient = actor("patient", patientOwners);
    const item = stim(administrator);
    const created = (await invoke(
      "create",
      "medicalroot00061",
      createInput(
        "medicalroot00061",
        "medicaluse000061",
        administrator,
        patient,
        item,
      ),
    )) as MedicalConsumableRootV1;
    const root = await durationRecorded(created);
    patientOwners.length = 0;
    await expect(invoke("effect", root.action.rootMessageId)).rejects.toThrow(
      "authority",
    );
    expect(item.system.quantity).toBe(1);
  });

  it("rejects an untracked operation when a scheduler becomes active", async () => {
    const administrator = actor("administrator", [owner.id]);
    const patient = actor("patient", [owner.id]);
    const item = stim(administrator);
    const created = (await invoke(
      "create",
      "medicalroot00062",
      createInput(
        "medicalroot00062",
        "medicaluse000062",
        administrator,
        patient,
        item,
      ),
    )) as MedicalConsumableRootV1;
    const root = await durationRecorded(created);
    f.declaration = "ordered-actions";
    f.round = {
      combatantId: "combatant",
      actionEconomyStrategyId: "d6e2.action-economy.segmented",
      revision: 1,
      round: 2,
    };
    await expect(invoke("effect", root.action.rootMessageId)).rejects.toThrow(
      "D6E2.Medical.Error.ActionUnavailable",
    );
    expect(item.system.quantity).toBe(1);
  });

  it("permits a manual uncommitted action-commitment round", async () => {
    const administrator = actor("administrator", [owner.id]);
    const patient = actor("patient", [owner.id]);
    const item = stim(administrator);
    f.round = {
      combatantId: "combatant",
      actionEconomyStrategyId: "open-d6.action-economy.flexible",
      revision: 1,
      round: 2,
    };
    const created = (await invoke(
      "create",
      "medicalroot00067",
      createInput(
        "medicalroot00067",
        "medicaluse000067",
        administrator,
        patient,
        item,
      ),
    )) as MedicalConsumableRootV1;
    const root = await durationRecorded(created);
    await expect(
      invoke("effect", root.action.rootMessageId),
    ).resolves.toBeDefined();
    expect(item.system.quantity).toBe(0);
    expect(f.spend).not.toHaveBeenCalled();
  });

  it("leaves a charged partial operation for GM review when timing becomes invalid", async () => {
    const administrator = actor("administrator", [owner.id]);
    const patient = actor("patient", [owner.id]);
    const item = stim(administrator);
    const created = (await invoke(
      "create",
      "medicalroot00063",
      createInput(
        "medicalroot00063",
        "medicaluse000063",
        administrator,
        patient,
        item,
      ),
    )) as MedicalConsumableRootV1;
    const root = await durationRecorded(created);
    item.update.mockImplementationOnce((changes) => {
      patch(item, changes);
      (game as unknown as { time: { worldTime: number } }).time.worldTime = NaN;
      return Promise.resolve(item);
    });
    await expect(invoke("effect", root.action.rootMessageId)).rejects.toThrow(
      "uncertain",
    );
    expect(item.system.quantity).toBe(0);
    expect(
      (patient.system.medical as { stim: { version: number } }).stim.version,
    ).toBe(0);
    expect(
      messages
        .get(root.action.rootMessageId)
        ?.getFlag("d6-system-2e", "medicalEffectStatus"),
    ).toBe("needs-attention");
    await expect(
      invoke("end-operation", root.action.rootMessageId, {}, gm),
    ).resolves.toMatchObject({ action: { status: "cancelled" } });
  });

  it("keeps an explicit multi-Combat repair bound while its selected Combat remains valid", async () => {
    const administrator = actor("administrator", [owner.id]);
    const patient = actor("patient", [owner.id]);
    const item = stim(administrator);
    const combats = (
      game as unknown as { combats: { contents: Record<string, unknown>[] } }
    ).combats.contents;
    combats.push({
      uuid: "Combat.one",
      round: 2,
      combatants: { contents: [{ actor: patient }] },
    });
    const created = (await invoke(
      "create",
      "medicalroot00064",
      createInput(
        "medicalroot00064",
        "medicaluse000064",
        administrator,
        patient,
        item,
      ),
    )) as MedicalConsumableRootV1;
    const root = await durationRecorded(created);
    await invoke("effect", root.action.rootMessageId);
    combats.push({
      uuid: "Combat.two",
      round: 4,
      combatants: { contents: [{ actor: patient }] },
    });
    const unresolved = (await invoke(
      "view",
      "",
      { actorUuid: patient.uuid },
      gm,
    )) as { stim?: { needsAttention: boolean } };
    expect(unresolved.stim?.needsAttention).toBe(true);
    await invoke(
      "repair-timing",
      "",
      {
        actorUuid: patient.uuid,
        useId: "medicaluse000064",
        anchorMode: "combat",
        combatUuid: "Combat.one",
      },
      gm,
    );
    const repaired = (await invoke(
      "view",
      "",
      { actorUuid: patient.uuid },
      gm,
    )) as { stim?: { needsAttention: boolean; status: string } };
    expect(repaired.stim).toMatchObject({
      needsAttention: false,
      status: "active",
    });
    combats.shift();
    const missing = (await invoke(
      "view",
      "",
      { actorUuid: patient.uuid },
      gm,
    )) as { stim?: { needsAttention: boolean; status: string } };
    expect(missing.stim).toMatchObject({
      needsAttention: true,
      status: "needs-attention",
    });
    await invoke(
      "repair-timing",
      "",
      {
        actorUuid: patient.uuid,
        useId: "medicaluse000064",
        anchorMode: "combat",
        combatUuid: "Combat.two",
      },
      gm,
    );
    await expect(
      invoke(
        "end-effect",
        "",
        { actorUuid: patient.uuid, useId: "medicaluse000064" },
        gm,
      ),
    ).resolves.toBe(true);
  });

  it("restores a surviving stale Blind root's payload and audience on lifecycle refresh", async () => {
    const administrator = actor("administrator", [owner.id]);
    const patient = actor("patient", [owner.id]);
    const item = stim(administrator);
    const input = {
      ...createInput(
        "medicalroot00065",
        "medicaluse000065",
        administrator,
        patient,
        item,
      ),
      rollMode: "blindroll",
    };
    const created = (await invoke(
      "create",
      "medicalroot00065",
      input,
    )) as MedicalConsumableRootV1;
    const root = await durationRecorded(created, "blindroll");
    await invoke("effect", root.action.rootMessageId);
    const message = required(messages.get(root.action.rootMessageId));
    Object.assign(message, { blind: false, whisper: [owner.id] });
    await message.update({
      [`flags.d6-system-2e.medicalConsumableRoot`]: created,
    });
    await invoke("view", "", { actorUuid: patient.uuid }, gm);
    expect(message.blind).toBe(true);
    expect(message.whisper).toEqual([gm.id]);
    expect(
      (
        message.getFlag(
          "d6-system-2e",
          "medicalConsumableRoot",
        ) as MedicalConsumableRootV1
      ).action.stages[0]?.receipt,
    ).toMatchObject({ total: 4 });
  });

  it("does not suppress a Model B penalty after physiology becomes mechanical", async () => {
    const administrator = actor("administrator", [owner.id]);
    const patient = actor("patient", [owner.id]);
    const item = stim(administrator);
    const created = (await invoke(
      "create",
      "medicalroot00066",
      createInput(
        "medicalroot00066",
        "medicaluse000066",
        administrator,
        patient,
        item,
      ),
    )) as MedicalConsumableRootV1;
    await invoke(
      "effect",
      (await durationRecorded(created)).action.rootMessageId,
    );
    (
      patient.system.medical as {
        physiology: { kind: string };
      }
    ).physiology.kind = "mechanical";
    await expect(
      invoke(
        "projection",
        "",
        {
          actorUuid: patient.uuid,
          wound: "wounded",
          woundPenaltyScore: 3,
        },
        gm,
      ),
    ).resolves.toMatchObject({ applicable: false, suppressedPenaltyScore: 0 });
  });

  it("returns reconciled active view and suppression through the correlated GM socket without a reentrant sheet render", async () => {
    const administrator = actor("administrator", [owner.id]);
    const patient = actor("patient", [owner.id], "patient", [controller.id]);
    const item = stim(administrator);
    const created = (await invoke(
      "create",
      "medicalroot00067",
      createInput(
        "medicalroot00067",
        "medicaluse000067",
        administrator,
        patient,
        item,
      ),
    )) as MedicalConsumableRootV1;
    await invoke(
      "effect",
      (await durationRecorded(created)).action.rootMessageId,
    );
    await invoke("advance", created.action.rootMessageId);
    registerMedicalConsumableSocket();
    const requests: string[] = [];
    const refreshRecipients: string[][] = [];
    (game.socket as unknown as { emit: ReturnType<typeof vi.fn> }).emit = vi.fn(
      (
        _channel: string,
        packet: Record<string, unknown>,
        options?: { recipients?: string[] },
      ) => {
        if (packet.type === "medical-root-operation") {
          requests.push(String((packet.data as { method?: string }).method));
          expect(options?.recipients).toEqual([gm.id]);
          (game as { user?: FoundryUser }).user = gm;
          socketHandler?.(packet, owner.id);
        } else if (packet.type === "medical-root-reply") {
          expect(options?.recipients).toEqual([owner.id]);
          socketHandler?.(packet, gm.id);
        } else if (packet.type === "medical-status-refresh") {
          refreshRecipients.push(options?.recipients ?? []);
          (game as { user?: FoundryUser }).user = owner;
          socketHandler?.(packet, gm.id);
          (game as { user?: FoundryUser }).user = controller;
          socketHandler?.(packet, gm.id);
        }
      },
    );
    const updatesBeforeReads = (patient.update as ReturnType<typeof vi.fn>).mock
      .calls.length;
    const rootMessage = required(messages.get(created.action.rootMessageId));
    const messageUpdatesBeforeReads = (
      rootMessage.update as ReturnType<typeof vi.fn>
    ).mock.calls.length;
    const settingWritesBeforeReads = (
      game.settings.set as ReturnType<typeof vi.fn>
    ).mock.calls.length;

    (game as { user?: FoundryUser }).user = owner;
    await expect(
      requestMedicalRoot({ method: "view", actorUuid: patient.uuid }),
    ).resolves.toMatchObject({
      stim: {
        itemName: "Model B Stim",
        status: "active",
        applicable: true,
      },
    });
    expect(patient.update).toHaveBeenCalledTimes(updatesBeforeReads);
    expect(rootMessage.update).toHaveBeenCalledTimes(messageUpdatesBeforeReads);
    expect(game.settings.set).toHaveBeenCalledTimes(settingWritesBeforeReads);

    (game as unknown as { time: { worldTime: number } }).time.worldTime = 105;
    (game as { user?: FoundryUser }).user = owner;
    await expect(
      requestMedicalRoot({
        method: "projection",
        actorUuid: patient.uuid,
        wound: "wounded",
        woundPenaltyScore: 3,
      }),
    ).resolves.toMatchObject({
      active: true,
      applicable: true,
      suppressedPenaltyScore: 3,
    });
    await vi.waitFor(() => {
      expect(refreshRecipients).toEqual([[owner.id, controller.id]]);
      expect(patient.sheet.render).toHaveBeenCalledTimes(3);
    });
    (game as { user?: FoundryUser }).user = owner;
    await expect(
      requestMedicalRoot({ method: "view", actorUuid: patient.uuid }),
    ).resolves.toMatchObject({
      stim: {
        status: "active",
        applicable: true,
        remainingLabel: "15 seconds remaining",
      },
    });
    expect(requests).toEqual(["view", "projection", "view"]);
    expect(patient.update).toHaveBeenCalledTimes(updatesBeforeReads + 1);
    expect(
      (patient.update as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1],
    ).toEqual({ render: false });
    expect(rootMessage.update).toHaveBeenCalledTimes(messageUpdatesBeforeReads);
    expect(game.settings.set).toHaveBeenCalledTimes(settingWritesBeforeReads);

    (game as { user?: FoundryUser }).user = gm;
    await expect(
      invoke("view", "", { actorUuid: patient.uuid }, controller),
    ).resolves.toMatchObject({
      stim: {
        itemName: "Medical effect",
        remainingLabel: "Duration hidden",
        status: "active",
      },
    });
    await expect(
      invoke(
        "projection",
        "",
        {
          actorUuid: patient.uuid,
          wound: "wounded",
          woundPenaltyScore: 3,
        },
        controller,
      ),
    ).rejects.toThrow("authority");

    (game as { user?: FoundryUser }).user = gm;
    (game as unknown as { time: { worldTime: number } }).time.worldTime = 110;
    await invoke(
      "reconcile",
      "",
      {
        actorUuid: patient.uuid,
        event: {
          kind: "sync",
          ambiguousCombat: false,
          campaignTime: 110,
          combatUuid: null,
          combatClocks: [],
          round: null,
        },
      },
      gm,
    );
    await vi.waitFor(() => {
      expect(refreshRecipients).toEqual([
        [owner.id, controller.id],
        [owner.id, controller.id],
      ]);
      expect(patient.sheet.render).toHaveBeenCalledTimes(6);
      expect(patient.sheet.render).toHaveBeenNthCalledWith(1, false);
      expect(patient.sheet.render).toHaveBeenNthCalledWith(2, false);
      expect(patient.sheet.render).toHaveBeenNthCalledWith(3, false);
      expect(patient.sheet.render).toHaveBeenNthCalledWith(4, false);
      expect(patient.sheet.render).toHaveBeenNthCalledWith(5, false);
      expect(patient.sheet.render).toHaveBeenNthCalledWith(6, false);
    });
  });
});
