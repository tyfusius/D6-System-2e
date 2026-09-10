import { afterEach, expect, it, vi } from "vitest";
import {
  registerRollRequestSocket,
  resetRollRequestsForTests,
} from "./roll-requests";
import {
  activeD6PendingInteractions,
  resetD6PendingInteractionsForTests,
} from "../application/pending-interactions";
import {
  resetTerminologyRegistryForTests,
  setSettingProfileTerminology,
} from "../registries/terminology";
const f = vi.hoisted(() => ({
  roll: vi.fn(),
  root: vi.fn(),
  coordinator: vi.fn(),
}));
vi.mock("./combined-action-root", () => ({
  executeCombinedRootRoll: f.roll,
  combinedRoot: f.root,
  combinedRootCoordinator: f.coordinator,
}));
afterEach(() => {
  resetRollRequestsForTests();
  resetD6PendingInteractionsForTests();
  resetTerminologyRegistryForTests();
  vi.unstubAllGlobals();
});
it("authenticates the bound request and cancel sender, targets acknowledgements, and uses captured execution instead of the ordinary API", async () => {
  const apiRoll = vi.fn();
  const emit = vi.fn();
  f.roll.mockResolvedValue(null);
  let socket: ((value: unknown, senderId?: string) => void) | undefined;
  const actor = { id: "actor", isOwner: true };
  const replacement = {
    id: "replacement",
    name: "Replacement GM",
    active: true,
    isGM: true,
  };
  const gm = { id: "gm", name: "GM", active: true, isGM: true };
  vi.stubGlobal("Hooks", { on: vi.fn() });
  vi.stubGlobal("game", {
    messages: { get: () => ({ id: "root" }) },
    actors: { get: (id: string) => (id === actor.id ? actor : undefined) },
    user: { id: "owner", active: true, isGM: false },
    users: {
      get: (id: string) =>
        id === "gm" ? gm : id === "replacement" ? replacement : undefined,
    },
    socket: {
      emit,
      on: (_channel: string, handler: typeof socket) => {
        socket = handler;
      },
    },
    system: { api: { roll: { attribute: apiRoll } } },
  });
  setSettingProfileTerminology({ attributes: { perception: "Perception" } });
  registerRollRequestSocket();
  const createdAt = Date.now();
  const request = {
    actorId: "actor",
    createdAt,
    expiresAt: createdAt + 300000,
    id: "command",
    requesterUserId: "gm",
    requesterName: "GM",
    targetUserId: "owner",
    type: "request",
    version: 3,
    visibility: "public",
    delivery: "open-roll-window",
    subject: { kind: "attribute", attributeId: "perception" },
    combinedRoot: { rootMessageId: "root", coordinatorId: "gm" },
    combinedAction: {
      bonusScore: 0,
      penaltyScore: 0,
      context: {
        groupId: "group",
        stage: "command",
        allocatedBonusScore: 0,
        commandDifficulty: 7,
        commandPenaltyScore: 0,
        participantCount: 2,
        leaderActorId: "actor",
        leaderName: "Leader",
        primaryActorId: "worker",
        primaryName: "Worker",
      },
    },
  };
  socket?.(request, "stranger");
  await Promise.resolve();
  expect(f.roll).not.toHaveBeenCalled();
  socket?.(request, "gm");
  await vi.waitFor(() => expect(f.roll).toHaveBeenCalledTimes(1));
  expect(apiRoll).not.toHaveBeenCalled();
  expect(emit).toHaveBeenCalledWith(
    "system.d6-system-2e",
    expect.objectContaining({ type: "acknowledged", id: "command" }),
    { recipients: ["gm"] },
  );
  const cancel = {
    id: "command",
    requesterUserId: "gm",
    targetUserId: "owner",
    type: "cancel",
  };
  socket?.(cancel, "stranger");
  expect(activeD6PendingInteractions("owner")).toHaveLength(1);
  f.root.mockReturnValue({
    cancelled: false,
    steps: [{ id: "command", status: "requested", controllerId: "owner" }],
  });
  f.coordinator.mockReturnValue(replacement);
  socket?.(
    {
      ...request,
      requesterUserId: "replacement",
      combinedRoot: { rootMessageId: "root", coordinatorId: "replacement" },
    },
    "replacement",
  );
  await vi.waitFor(() => expect(f.roll).toHaveBeenCalledTimes(2));
  socket?.(cancel, "gm");
  expect(activeD6PendingInteractions("owner")).toHaveLength(1);
  socket?.({ ...cancel, requesterUserId: "replacement" }, "replacement");
  await vi.waitFor(() =>
    expect(activeD6PendingInteractions("owner")).toHaveLength(0),
  );
});
