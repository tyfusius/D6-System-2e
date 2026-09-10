import { afterEach, expect, it, vi } from "vitest";
import type { D6ScaleRollContext } from "@d6-system-2e/core";
import {
  activeD6GmTasks,
  resetD6ActiveGmTasksForTests,
} from "../application/active-gm-tasks";
import {
  registerRollRequestSocket,
  requestActorResistanceRoll,
  resetRollRequestsForTests,
} from "./roll-requests";

// Foundry14.367 handleCustomSocket: omitted routing broadcasts to other sockets;
// explicit recipients deliver to that user's sockets, with authenticated sender.
// Initial chat render precedes ready, but can restore an ordinary Resistance.
interface Packet {
  type: string;
  id?: string;
  requesterUserId?: string;
  targetUserId?: string;
  status?: string;
  total?: number;
  wildOutcome?: string;
}
type Handler = (packet: Packet, senderId: string) => void;
function transport() {
  const listeners = new Map<string, Handler[]>();
  const emit = (
    sender: string,
    channel: string,
    packet: Packet,
    routing?: { recipients: string[] },
  ) => {
    if (channel !== "system.d6-system-2e") throw new Error("wrong channel");
    const recipients =
      routing?.recipients ??
      [...listeners.keys()].filter((id) => id !== sender);
    for (const id of recipients)
      for (const listener of listeners.get(id) ?? []) listener(packet, sender);
  };
  return {
    emit,
    on: (id: string, handler: Handler) => {
      listeners.set(id, [...(listeners.get(id) ?? []), handler]);
    },
  };
}
afterEach(() => {
  resetD6ActiveGmTasksForTests();
  resetRollRequestsForTests();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("receives immediate owner acknowledgement before ready and retains the later result beyond the acknowledgement deadline", async () => {
  vi.useFakeTimers();
  const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
  const bus = transport();
  const on = vi.fn((_channel: string, handler: Handler) =>
    bus.on("gm", handler),
  );
  const gm = { id: "gm", isGM: true, active: true, name: "GM" },
    owner = { id: "owner", isGM: false, active: true, name: "Owner" };
  const actor = {
    id: "target",
    name: "Target",
    img: "target.webp",
    testUserPermission: (user: { id: string }) => user.id === owner.id,
  };
  let incoming: Packet | undefined;
  bus.on("owner", (packet, sender) => {
    if (packet.type !== "request") return;
    expect(sender).toBe("gm");
    if (!packet.id) throw new Error("Missing request id");
    incoming = packet;
    bus.emit("owner", "system.d6-system-2e", {
      type: "acknowledged",
      id: packet.id,
      requesterUserId: "gm",
      targetUserId: "owner",
    });
  });
  vi.stubGlobal("Hooks", { on: vi.fn() });
  vi.stubGlobal("game", {
    user: gm,
    users: {
      contents: [gm, owner],
      get: (id: string) => [gm, owner].find((u) => u.id === id),
    },
    i18n: { localize: (key: string) => key },
    socket: {
      on,
      emit: (
        channel: string,
        packet: Packet,
        routing?: { recipients: string[] },
      ) => bus.emit("gm", channel, packet, routing),
    },
  });
  // No registerRollRequestSocket call: restored chat initiates before ready.
  const result = requestActorResistanceRoll(
    actor as unknown as FoundryActorDocument,
    {} as D6ScaleRollContext,
    13,
    { id: "ordinary:root:resistance", createdAt: Date.now() },
  );
  await vi.advanceTimersByTimeAsync(6_000);
  expect(info).not.toHaveBeenCalled();
  expect(activeD6GmTasks()).toMatchObject([
    { id: "ordinary:root:resistance", remoteFailed: false },
  ]);
  registerRollRequestSocket(); // Later ready hook must not attach twice.
  registerRollRequestSocket();
  expect(on).toHaveBeenCalledTimes(1);
  expect(incoming?.id).toBe("ordinary:root:resistance");
  if (!incoming?.id) throw new Error("Missing request");
  bus.emit("owner", "system.d6-system-2e", {
    type: "response",
    id: incoming.id,
    requesterUserId: "gm",
    targetUserId: "owner",
    status: "rolled",
    total: 17,
    wildOutcome: "none",
  });
  await expect(result).resolves.toMatchObject({ status: "rolled", total: 17 });
  expect(activeD6GmTasks()).toHaveLength(0);
});
