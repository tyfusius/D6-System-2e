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
        id: "player-1",
      },
    });

    registerRollRequestSocket();
    expect(socketHandler).toBeTypeOf("function");
    socketHandler?.({
      actorId: actor.id,
      id: "request-1",
      requesterUserId: "gm-1",
      subject: {
        attributeId: "agility",
        kind: "attribute",
      },
      targetUserId: "player-1",
      type: "request",
    });

    await vi.waitFor(() => {
      expect(rollAttribute).toHaveBeenCalledWith(actor, "agility");
      expect(emit).toHaveBeenCalledWith("system.d6-system-2e", {
        id: "request-1",
        requesterUserId: "gm-1",
        type: "complete",
      });
    });
  });
});
