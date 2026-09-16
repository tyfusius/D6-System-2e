import { beforeEach, describe, expect, it, vi } from "vitest";
import type { D6StorageOperationRequestV1 } from "@d6-system-2e/core";

const f = vi.hoisted(() => ({
  authorityUserId: "gm",
  clientAuthority: true,
  heartbeat: vi.fn(() => Promise.resolve()),
}));
vi.mock("./destiny-crypto.js", () => ({
  destinyActiveAuthority: () =>
    f.authorityUserId ? { userId: f.authorityUserId } : undefined,
  destinyClientIsAuthority: () => f.clientAuthority,
  heartbeatDestinyCrypto: f.heartbeat,
}));
vi.mock("./foundry-random-id.js", () => ({
  foundryRandomId: () => "packet-1",
}));

import {
  handleGridStorageSocketPacket,
  notifyGridStorageCommittedRoots,
  requestGridStorageMovePreview,
  requestGridStorageOperation,
  requestGridStorageProjection,
  resetGridStorageAuthorityForTests,
  setGridStorageOperationProcessor,
  setGridStorageRefreshHandler,
} from "./grid-storage-authority.js";

const request: D6StorageOperationRequestV1 = {
  kind: "unpack",
  value: {
    version: 1,
    operationId: "operation-1",
    baseRevision: 0,
    containerInstanceId: "container",
    destination: {
      rootUuid: "Actor.owner",
      spaceId: "inventory",
      containerInstanceId: null,
      spaceOwnerActorUuid: "Actor.owner",
    },
    witnesses: {},
  },
};
const users = new Map<string, FoundryUser>();
let emit: ReturnType<typeof vi.fn>;
let dialog: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetGridStorageAuthorityForTests();
  f.authorityUserId = "gm";
  f.clientAuthority = true;
  emit = vi.fn();
  dialog = vi.fn(() => Promise.resolve(true));
  users.clear();
  users.set("gm", {
    id: "gm",
    name: "GM",
    active: true,
    isGM: true,
  } as FoundryUser);
  users.set("player", {
    id: "player",
    name: "Player",
    active: true,
    isGM: false,
  } as FoundryUser);
  users.set("intruder", {
    id: "intruder",
    name: "Intruder",
    active: true,
    isGM: false,
  } as FoundryUser);
  vi.stubGlobal("game", {
    user: users.get("gm"),
    users: {
      contents: [...users.values()],
      get: (id: string) => users.get(id),
    },
    socket: { emit, on: vi.fn() },
    i18n: { localize: (key: string) => key },
  });
  vi.stubGlobal("foundry", {
    applications: { api: { DialogV2: { wait: dialog } } },
  });
  vi.stubGlobal(
    "fromUuid",
    vi.fn(() => Promise.resolve(null)),
  );
});

describe("grid storage targeted authority socket", () => {
  it("sends one committed-root refresh only to observers and accepts it only from the active authority", async () => {
    const refresh = vi.fn();
    setGridStorageRefreshHandler(refresh);
    vi.stubGlobal(
      "fromUuid",
      vi.fn(() =>
        Promise.resolve({
          uuid: "Actor.carrier",
          testUserPermission: (user: FoundryUser) => user.id === "player",
        }),
      ),
    );

    await notifyGridStorageCommittedRoots(["Actor.carrier"]);
    expect(refresh).toHaveBeenCalledWith(["Actor.carrier"]);
    expect(emit).toHaveBeenCalledWith(
      "system.d6-system-2e",
      {
        type: "grid-storage-roots-committed",
        rootUuids: ["Actor.carrier"],
      },
      { recipients: ["player"] },
    );
    expect(emit).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { recipients: ["intruder"] },
    );

    refresh.mockClear();
    await handleGridStorageSocketPacket(
      {
        type: "grid-storage-roots-committed",
        rootUuids: ["Actor.carrier"],
      },
      "intruder",
    );
    expect(refresh).not.toHaveBeenCalled();
    await handleGridStorageSocketPacket(
      {
        type: "grid-storage-roots-committed",
        rootUuids: ["Actor.carrier"],
      },
      "gm",
    );
    expect(refresh).toHaveBeenCalledWith(["Actor.carrier"]);
  });

  it("filters the complete changed-root set per recipient and chunks every permitted root", async () => {
    const refresh = vi.fn();
    setGridStorageRefreshHandler(refresh);
    const roots = Array.from(
      { length: 65 },
      (_, index) => `Actor.root${String(index + 1).padStart(2, "0")}`,
    );
    vi.stubGlobal(
      "fromUuid",
      vi.fn((uuid: string) =>
        Promise.resolve({
          uuid,
          testUserPermission: (user: FoundryUser) => {
            const index = roots.indexOf(uuid);
            return user.id === "player" && index >= 25;
          },
        }),
      ),
    );

    await notifyGridStorageCommittedRoots(roots);

    const refreshed = refresh.mock.calls as unknown as readonly (readonly [
      readonly string[],
    ])[];
    expect(refreshed.map(([packetRoots]) => packetRoots)).toEqual([
      roots.slice(0, 32),
      roots.slice(32, 64),
      roots.slice(64),
    ]);
    const emitted = emit.mock.calls as unknown as readonly (readonly [
      string,
      { readonly rootUuids?: readonly string[] },
      { readonly recipients: readonly string[] },
    ])[];
    const playerPackets = emitted
      .filter(([, , options]) => options.recipients[0] === "player")
      .map(([, packet]) => packet.rootUuids ?? []);
    expect(playerPackets).toEqual([roots.slice(25, 57), roots.slice(57)]);
    expect(playerPackets.flat()).toEqual(roots.slice(25));
    expect(
      emitted.some(([, , options]) => options.recipients.includes("intruder")),
    ).toBe(false);
  });

  it("rejects missing sender identity", async () => {
    const processor = vi.fn();
    setGridStorageOperationProcessor(processor);
    await handleGridStorageSocketPacket({
      type: "grid-storage-operation",
      packetId: "packet",
      request,
    });
    expect(processor).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("uses the server-authenticated sender and ignores a spoofed payload identity", async () => {
    const processor = vi.fn((_request, requester: FoundryUser) =>
      Promise.resolve({
        version: 1 as const,
        operationId: "operation-1",
        status: "completed" as const,
        projectionToken: null,
        requester: requester.id,
      }),
    );
    setGridStorageOperationProcessor(processor);
    await handleGridStorageSocketPacket(
      {
        type: "grid-storage-operation",
        packetId: "packet",
        requesterUserId: "intruder",
        request,
      },
      "player",
    );
    expect(processor.mock.calls[0]?.[1]).toBe(users.get("player"));
    expect(emit).toHaveBeenCalledWith(
      "system.d6-system-2e",
      expect.objectContaining({ type: "grid-storage-reply" }),
      { recipients: ["player"] },
    );
  });

  it("ignores an approval request from a non-authority sender", async () => {
    await handleGridStorageSocketPacket(
      {
        type: "grid-storage-approval-request",
        requestId: "approval",
        operationId: "operation-1",
        intentHash: "intent",
        planHash: "plan",
        actorUuid: "Actor.owner",
        boundary: "destination-location",
        scope: "object-only",
        targetUserId: "player",
        authorityUserId: "intruder",
        createdAt: Date.now(),
        expiresAt: Date.now() + 30_000,
      },
      "intruder",
    );
    expect(dialog).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("accepts a reply only from the active authority bound to the pending packet", async () => {
    f.clientAuthority = false;
    const player = users.get("player");
    if (!player) throw new Error("missing player fixture");
    (game as unknown as { user: FoundryUser }).user = player;
    const promised = requestGridStorageOperation(request);
    await vi.waitFor(() => expect(emit).toHaveBeenCalledTimes(1));
    await handleGridStorageSocketPacket(
      {
        type: "grid-storage-reply",
        packetId: "packet-1",
        value: {
          version: 1,
          operationId: "operation-1",
          status: "completed",
          projectionToken: null,
        },
      },
      "intruder",
    );
    let settled = false;
    void promised.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await handleGridStorageSocketPacket(
      {
        type: "grid-storage-reply",
        packetId: "packet-1",
        value: {
          version: 1,
          operationId: "operation-1",
          status: "completed",
          projectionToken: null,
        },
      },
      "gm",
    );
    await expect(promised).resolves.toMatchObject({ status: "completed" });
  });

  it("returns permission-safe projections only from the active authority", async () => {
    f.clientAuthority = false;
    const player = users.get("player");
    if (!player) throw new Error("missing player fixture");
    (game as unknown as { user: FoundryUser }).user = player;
    const promised = requestGridStorageProjection({
      actorUuid: "Actor.owner",
    });
    await vi.waitFor(() => expect(emit).toHaveBeenCalledTimes(1));
    const reply = {
      type: "grid-storage-projection-reply",
      packetId: "packet-1",
      value: { workspace: null, objects: {}, latestUndo: null },
    };
    await handleGridStorageSocketPacket(reply, "intruder");
    let settled = false;
    void promised.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await handleGridStorageSocketPacket(reply, "gm");
    await expect(promised).resolves.toEqual({
      workspace: null,
      objects: {},
      latestUndo: null,
    });
  });

  it("accepts an exact move preview only from the active authority", async () => {
    f.clientAuthority = false;
    const player = users.get("player");
    if (!player) throw new Error("missing player fixture");
    (game as unknown as { user: FoundryUser }).user = player;
    const moveRequest = {
      version: 1 as const,
      operationId: "move-preview",
      baseRevision: 3,
      instanceId: "item",
      quantity: "all" as const,
      destination: null,
      rectangle: null,
      disposition: "equipped" as const,
      pinned: false,
      ownershipTransfer: {
        mode: "preserve" as const,
        targetOwnerActorUuid: null,
        scope: "object-only" as const,
      },
      witnesses: { item: "witness" },
    };
    const promised = requestGridStorageMovePreview(moveRequest);
    await vi.waitFor(() => expect(emit).toHaveBeenCalledTimes(1));
    const reply = {
      type: "grid-storage-move-preview-reply",
      packetId: "packet-1",
      value: {
        version: 1,
        operationId: "move-preview",
        baseRevision: 3,
        allowed: true,
        capacity: {
          grid: "available",
          weight: "available",
          volume: "available",
          count: "available",
        },
        planHash: "plan",
        request: moveRequest,
      },
    };
    await handleGridStorageSocketPacket(reply, "intruder");
    let settled = false;
    void promised.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await handleGridStorageSocketPacket(reply, "gm");
    await expect(promised).resolves.toMatchObject({
      operationId: "move-preview",
      allowed: true,
    });
  });

  it("never emits an operation, approval, or reply without an exact recipients list", async () => {
    const processor = vi.fn(() =>
      Promise.resolve({
        version: 1 as const,
        operationId: "operation-1",
        status: "completed" as const,
        projectionToken: null,
      }),
    );
    setGridStorageOperationProcessor(processor);
    await handleGridStorageSocketPacket(
      { type: "grid-storage-operation", packetId: "packet", request },
      "player",
    );
    for (const call of emit.mock.calls)
      expect(call[2]).toEqual({ recipients: [expect.any(String)] });
  });
});
