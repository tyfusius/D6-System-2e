import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activeD6GmTasks,
  resetD6ActiveGmTasksForTests,
} from "../application/active-gm-tasks";
import {
  activeHighlightedRollRequests,
  activeNonGmOwners,
  executeHighlightedRollRequest,
  registerRollRequestSocket,
  requestActorResistanceRoll,
  resetRollRequestsForTests,
  requestActorRoll,
} from "./roll-requests";

afterEach(() => {
  resetD6ActiveGmTasksForTests();
  resetRollRequestsForTests();
  vi.unstubAllGlobals();
});

describe("GM Quickbar roll request ownership", () => {
  it("routes a damage resistance prompt to the first active player owner and returns its Wild Die outcome", async () => {
    const emit = vi.fn();
    let socketHandler: ((value: unknown) => void) | undefined;
    const gm = {
      active: true,
      id: "gm-1",
      isGM: true,
      name: "Gamemaster",
    };
    const player = {
      active: true,
      id: "player-1",
      isGM: false,
      name: "Player",
    };
    const actor = {
      id: "actor-1",
      img: "actor.webp",
      name: "Rook",
      testUserPermission: (user: { readonly id: string }) =>
        user.id === player.id,
    };
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      socket: {
        emit,
        on: vi.fn((_channel: string, handler: (value: unknown) => void) => {
          socketHandler = handler;
        }),
      },
      user: gm,
      users: {
        contents: [gm, player],
        get: (id: string) => [gm, player].find((user) => user.id === id),
      },
    });
    vi.stubGlobal("ui", { notifications: { warn: vi.fn() } });
    registerRollRequestSocket();

    const outcomePromise = requestActorResistanceRoll(
      actor as unknown as FoundryActorDocument,
      {
        application: "damage",
        modifierScore: 0,
        sourceActorId: "attacker-1",
        sourceName: "Attacker",
        sourcePage: 196,
        sourceRank: 0,
        targetActorId: actor.id,
        targetName: actor.name,
        targetRank: 0,
      },
      17,
    );
    await vi.waitFor(() => expect(emit).toHaveBeenCalled());
    const request = emit.mock.calls.find(
      ([, value]) => (value as { readonly type?: string }).type === "request",
    )?.[1] as {
      readonly id: string;
      readonly requesterUserId: string;
      readonly subject: { readonly damageTotal: number; readonly kind: string };
      readonly targetUserId: string;
    };
    expect(request).toMatchObject({
      requesterUserId: gm.id,
      subject: { damageTotal: 17, kind: "resistance" },
      targetUserId: player.id,
    });
    socketHandler?.({
      id: request.id,
      requesterUserId: gm.id,
      targetUserId: player.id,
      type: "acknowledged",
    });
    socketHandler?.({
      id: request.id,
      requesterUserId: gm.id,
      status: "rolled",
      targetUserId: player.id,
      total: 14,
      type: "response",
      wildOutcome: "complication",
    });

    await expect(outcomePromise).resolves.toEqual({
      status: "rolled",
      total: 14,
      wildOutcome: "complication",
    });
  });

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

  it("runs the requested roll locally when every player owner is offline", async () => {
    const rollAttribute = vi.fn().mockResolvedValue(null);
    const gm = {
      active: true,
      id: "gm-1",
      isGM: true,
      name: "Gamemaster",
    };
    const actor = {
      id: "actor-1",
      img: "actor.webp",
      name: "Rook",
      testUserPermission: () => true,
    };
    vi.stubGlobal("foundry", {
      applications: {
        api: {
          DialogV2: {
            wait: vi.fn().mockResolvedValue({
              delivery: "open-roll-window",
              recipientUserId: gm.id,
              visibility: "private",
            }),
          },
        },
        handlebars: {
          renderTemplate: vi.fn().mockResolvedValue("<form></form>"),
        },
      },
    });
    vi.stubGlobal("game", {
      i18n: {
        localize: (key: string) => key,
      },
      socket: {
        emit: vi.fn(),
      },
      system: {
        api: {
          roll: {
            attribute: rollAttribute,
            skill: vi.fn(),
          },
        },
      },
      user: gm,
      users: {
        contents: [
          gm,
          {
            active: false,
            id: "offline-owner",
            isGM: false,
          },
        ],
      },
    });
    vi.stubGlobal("ui", {
      notifications: {
        warn: vi.fn(),
      },
    });

    await requestActorRoll(
      actor as unknown as FoundryActorDocument,
      { attributeId: "agility", kind: "attribute" },
      "Agility",
    );

    await vi.waitFor(() => expect(rollAttribute).toHaveBeenCalledOnce());
    expect(rollAttribute.mock.calls[0]?.[0]).toBe(actor);
    expect(rollAttribute.mock.calls[0]?.[1]).toBe("agility");
    const requestedRoll = (
      rollAttribute.mock.calls[0]?.[2] as
        | {
            readonly requestedRoll?: {
              readonly recipientUserId: string;
              readonly requesterUserId: string;
              readonly rollMode: string;
              readonly visibility: string;
            };
          }
        | undefined
    )?.requestedRoll;
    expect(requestedRoll).toMatchObject({
      recipientUserId: gm.id,
      requesterUserId: gm.id,
      rollMode: "gmroll",
      visibility: "private",
    });
    await vi.waitFor(() => expect(activeD6GmTasks()).toHaveLength(0));
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
      delivery: "open-roll-window",
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
      version: 2,
      visibility: "private",
    });

    await vi.waitFor(() => {
      expect(emit).toHaveBeenCalledWith("system.d6-system-2e", {
        id: "request-1",
        requesterUserId: "gm-1",
        targetUserId: "player-1",
        type: "acknowledged",
      });
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

  it("holds a highlighted request until the player clicks its sheet score", async () => {
    const rollSkill = vi.fn().mockResolvedValue({ total: 12 });
    const emit = vi.fn();
    let socketHandler: ((value: unknown) => void) | undefined;
    const actor = { id: "actor-1", isOwner: true };
    const requester = {
      active: true,
      id: "gm-1",
      isGM: true,
      name: "Gamemaster",
    };
    vi.stubGlobal("game", {
      actors: { get: () => actor },
      socket: {
        emit,
        on: vi.fn((_channel: string, handler: (value: unknown) => void) => {
          socketHandler = handler;
        }),
      },
      system: { api: { roll: { attribute: vi.fn(), skill: rollSkill } } },
      user: { id: "player-1", isGM: false },
      users: { get: () => requester },
    });

    registerRollRequestSocket();
    const createdAt = Date.now();
    socketHandler?.({
      actorId: actor.id,
      createdAt,
      delivery: "highlight-on-character-sheet",
      expiresAt: createdAt + 300_000,
      id: "request-highlight",
      requesterName: requester.name,
      requesterUserId: requester.id,
      subject: { itemId: "skill-1", kind: "skill" },
      targetUserId: "player-1",
      type: "request",
      version: 2,
      visibility: "hidden",
    });

    await vi.waitFor(() =>
      expect(activeHighlightedRollRequests(actor.id)).toHaveLength(1),
    );
    expect(rollSkill).not.toHaveBeenCalled();
    await expect(
      executeHighlightedRollRequest(actor as unknown as FoundryActorDocument, {
        itemId: "skill-1",
        kind: "skill",
      }),
    ).resolves.toBe(true);
    expect(rollSkill.mock.calls[0]?.[0]).toBe(actor);
    expect(rollSkill.mock.calls[0]?.[1]).toBe("skill-1");
    const requestedRoll = (
      rollSkill.mock.calls[0]?.[2] as
        | {
            readonly requestedRoll?: {
              readonly requestId: string;
              readonly rollMode: string;
              readonly visibility: string;
            };
          }
        | undefined
    )?.requestedRoll;
    expect(requestedRoll).toMatchObject({
      requestId: "request-highlight",
      rollMode: "blindroll",
      visibility: "hidden",
    });
    await vi.waitFor(() =>
      expect(emit).toHaveBeenCalledWith("system.d6-system-2e", {
        id: "request-highlight",
        requesterUserId: "gm-1",
        status: "rolled",
        targetUserId: "player-1",
        total: 12,
        type: "response",
      }),
    );
    expect(activeHighlightedRollRequests(actor.id)).toHaveLength(0);
  });

  it("clears a highlighted request when the GM cancels it", async () => {
    const emit = vi.fn();
    let socketHandler: ((value: unknown) => void) | undefined;
    const actor = { id: "actor-1", isOwner: true };
    const requester = { active: true, id: "gm-1", isGM: true };
    vi.stubGlobal("game", {
      actors: { get: () => actor },
      socket: {
        emit,
        on: vi.fn((_channel: string, handler: (value: unknown) => void) => {
          socketHandler = handler;
        }),
      },
      system: {
        api: { roll: { attribute: vi.fn(), skill: vi.fn() } },
      },
      user: { id: "player-1", isGM: false },
      users: { get: () => requester },
    });

    registerRollRequestSocket();
    const createdAt = Date.now();
    socketHandler?.({
      actorId: actor.id,
      createdAt,
      delivery: "highlight-on-character-sheet",
      expiresAt: createdAt + 300_000,
      id: "request-cancel",
      requesterName: "Gamemaster",
      requesterUserId: requester.id,
      subject: { attributeId: "agility", kind: "attribute" },
      targetUserId: "player-1",
      type: "request",
      version: 2,
      visibility: "public",
    });
    await vi.waitFor(() =>
      expect(activeHighlightedRollRequests(actor.id)).toHaveLength(1),
    );

    socketHandler?.({
      id: "request-cancel",
      requesterUserId: requester.id,
      targetUserId: "player-1",
      type: "cancel",
    });

    await vi.waitFor(() =>
      expect(activeHighlightedRollRequests(actor.id)).toHaveLength(0),
    );
    expect(emit).toHaveBeenCalledWith("system.d6-system-2e", {
      id: "request-cancel",
      requesterUserId: requester.id,
      status: "cancelled",
      targetUserId: "player-1",
      type: "response",
    });
  });
});
