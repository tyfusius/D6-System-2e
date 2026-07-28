import { afterEach, describe, expect, it, vi } from "vitest";
import { activeNonGmOwners, registerRollRequestSocket } from "./roll-requests";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GM Quickbar roll request ownership", () => {
  it("returns only active non-GM owners", () => {
    const actor = {
      id: "actor-1",
      testUserPermission: (user: { readonly id: string }) =>
        user.id === "explicit-owner",
    };
    const users = [
      {
        active: true,
        character: { id: "actor-1" },
        id: "assigned-character",
        isGM: false,
      },
      {
        active: true,
        id: "explicit-owner",
        isGM: false,
      },
      {
        active: false,
        id: "offline-owner",
        isGM: false,
      },
      {
        active: true,
        id: "gm-owner",
        isGM: true,
      },
      {
        active: true,
        id: "observer",
        isGM: false,
      },
    ];
    vi.stubGlobal("game", { users: { contents: users } });

    expect(
      activeNonGmOwners(actor as unknown as FoundryActorDocument).map(
        (user) => user.id,
      ),
    ).toEqual(["assigned-character", "explicit-owner"]);
  });

  it("returns no request target when every owner is offline", () => {
    const actor = {
      id: "actor-1",
      testUserPermission: () => true,
    };
    vi.stubGlobal("game", {
      users: {
        contents: [
          {
            active: false,
            id: "offline-owner",
            isGM: false,
          },
        ],
      },
    });

    expect(activeNonGmOwners(actor as unknown as FoundryActorDocument)).toEqual(
      [],
    );
  });

  it("delivers a targeted socket request through the player's roll API", async () => {
    const rollAttribute = vi.fn().mockResolvedValue(null);
    const emit = vi.fn();
    let socketHandler: ((value: unknown) => void) | undefined;
    const actor = {
      id: "actor-1",
      isOwner: true,
    };
    const requester = {
      active: true,
      id: "gm-1",
      isGM: true,
      name: "Gamemaster",
    };
    vi.stubGlobal("game", {
      actors: {
        get: (id: string) => (id === actor.id ? actor : undefined),
      },
      socket: {
        emit,
        on: vi.fn((_channel: string, handler: (value: unknown) => void) => {
          socketHandler = handler;
        }),
      },
      system: {
        api: {
          roll: {
            attribute: rollAttribute,
            skill: vi.fn(),
          },
        },
      },
      user: {
        active: true,
        id: "player-1",
        isGM: false,
      },
      users: {
        get: (id: string) => (id === requester.id ? requester : undefined),
      },
    });

    registerRollRequestSocket();
    expect(socketHandler).toBeTypeOf("function");
    const createdAt = Date.now();
    socketHandler?.({
      actorId: actor.id,
      createdAt,
      expiresAt: createdAt + 300_000,
      id: "request-1",
      requesterName: requester.name,
      requesterUserId: "gm-1",
      subject: {
        attributeId: "agility",
        kind: "attribute",
      },
      targetUserId: "player-1",
      type: "request",
      version: 1,
      visibility: "private",
    });

    await vi.waitFor(() => {
      expect(rollAttribute).toHaveBeenCalledWith(actor, "agility", {
        requestedRoll: {
          recipientUserId: "player-1",
          requestId: "request-1",
          requesterName: "Gamemaster",
          requesterUserId: "gm-1",
          rollMode: "gmroll",
          visibility: "private",
        },
      });
      expect(emit).toHaveBeenCalledWith("system.d6-system-2e", {
        id: "request-1",
        requesterUserId: "gm-1",
        status: "cancelled",
        targetUserId: "player-1",
        type: "response",
      });
    });
  });
});
