import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { D6RollResultV1 } from "@d6-system-2e/core";
import {
  activeD6GmTasks,
  resetD6ActiveGmTasksForTests,
} from "../application/active-gm-tasks";
import {
  activeD6PendingInteractions,
  reopenD6PendingInteraction,
} from "../application/pending-interactions";
import {
  resetTerminologyRegistryForTests,
  setSettingProfileTerminology,
} from "../registries/terminology";
import {
  activeHighlightedRollRequests,
  activeNonGmOwners,
  executeHighlightedRollRequest,
  registerRollRequestSocket,
  requestActorResistanceRoll,
  requestActorRiposteRoll,
  requestedWeaponAttackRollPresentation,
  resetRollRequestsForTests,
  requestActorRoll,
  validateRequestedResistanceRollArtifacts,
  validateRequestedWeaponAttackRollArtifacts,
} from "./roll-requests";
import * as rollService from "./rolls/roll-service";

beforeEach(() => {
  vi.stubGlobal("Hooks", { on: vi.fn() });
});

afterEach(() => {
  resetD6ActiveGmTasksForTests();
  resetRollRequestsForTests();
  resetTerminologyRegistryForTests();
  vi.unstubAllGlobals();
});

describe("GM Quickbar roll request ownership", () => {
  it("keeps a deferred local Riposte failed and retryable when its roll window errors", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const riposte = vi
      .spyOn(rollService, "rollSecondEditionRiposteAttack")
      .mockRejectedValueOnce(new Error("render failed"))
      .mockResolvedValueOnce(null);
    const gm = {
      active: true,
      id: "gm-1",
      isGM: true,
      name: "Gamemaster",
    };
    const actor = {
      id: "defender",
      img: "defender.webp",
      name: "Defender",
      system: { resources: { heroPoints: { value: 2 } } },
      testUserPermission: () => false,
      update: vi.fn().mockResolvedValue(undefined),
    };
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: { get: vi.fn(() => false), set: vi.fn() },
      system: { api: { roll: {} } },
      user: gm,
      users: { contents: [gm] },
    });
    vi.stubGlobal("ui", { notifications: { warn: vi.fn() } });

    void requestActorRiposteRoll(actor as never, {
      createdAt: Date.now(),
      id: "root:riposte",
      itemId: "blade",
      rollMode: "publicroll",
      rootMessageId: "root",
      targetActorId: "attacker",
      targetTokenId: "attacker-token",
    });
    await vi.waitFor(() =>
      expect(activeD6PendingInteractions(gm.id)).toMatchObject([
        { id: "root:riposte", status: "pending" },
      ]),
    );

    await reopenD6PendingInteraction("root:riposte");
    expect(activeD6PendingInteractions(gm.id)).toMatchObject([
      { id: "root:riposte", operation: "reopen", status: "failed" },
    ]);
    expect(riposte).toHaveBeenCalledTimes(1);

    await reopenD6PendingInteraction("root:riposte");
    expect(activeD6PendingInteractions(gm.id)).toMatchObject([
      { id: "root:riposte", status: "pending" },
    ]);
    expect(riposte).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalled();
  });

  it("keeps an incoming remote Riposte failed and retryable without rejecting its coordinator", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const riposte = vi
      .spyOn(rollService, "rollSecondEditionRiposteAttack")
      .mockRejectedValueOnce(new Error("render failed"))
      .mockResolvedValueOnce(null);
    const emit = vi.fn();
    let socketHandler: ((value: unknown) => void) | undefined;
    const actor = {
      id: "defender",
      img: "defender.webp",
      isOwner: true,
      name: "Defender",
      system: { resources: { heroPoints: { value: 2 } } },
      update: vi.fn().mockResolvedValue(undefined),
    };
    const requester = {
      active: true,
      id: "gm-1",
      isGM: true,
      name: "Gamemaster",
    };
    vi.stubGlobal("game", {
      actors: { get: () => actor },
      i18n: { localize: (key: string) => key },
      settings: { get: vi.fn(() => false), set: vi.fn() },
      socket: {
        emit,
        on: vi.fn((_channel: string, handler: (value: unknown) => void) => {
          socketHandler = handler;
        }),
      },
      system: { api: { roll: {} } },
      user: { active: true, id: "player-1", isGM: false, name: "Player" },
      users: { get: () => requester },
    });
    vi.stubGlobal("ui", { notifications: { warn: vi.fn() } });
    registerRollRequestSocket();
    const createdAt = Date.now();
    socketHandler?.({
      actorId: actor.id,
      createdAt,
      delivery: "open-roll-window",
      expiresAt: createdAt + 300_000,
      id: "root:remote-riposte",
      requesterName: requester.name,
      requesterUserId: requester.id,
      subject: {
        itemId: "blade",
        kind: "riposte",
        rootMessageId: "root",
        targetActorId: "attacker",
        targetTokenId: "attacker-token",
      },
      targetUserId: "player-1",
      type: "request",
      version: 3,
      visibility: "public",
    });
    await vi.waitFor(() =>
      expect(activeD6PendingInteractions("player-1")).toMatchObject([
        { id: "root:remote-riposte", status: "pending" },
      ]),
    );

    await reopenD6PendingInteraction("root:remote-riposte");
    expect(activeD6PendingInteractions("player-1")).toMatchObject([
      {
        id: "root:remote-riposte",
        operation: "reopen",
        status: "failed",
      },
    ]);
    expect(
      emit.mock.calls.some(
        ([, value]) =>
          (value as { readonly type?: string }).type === "response",
      ),
    ).toBe(false);

    await reopenD6PendingInteraction("root:remote-riposte");
    expect(activeD6PendingInteractions("player-1")).toMatchObject([
      { id: "root:remote-riposte", status: "pending" },
    ]);
    expect(riposte).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalled();
  });

  it("validates a routed Riposte against its root, actor, item, target, and immutable dice", async () => {
    const data = {
      dice: [{ results: [{ result: 4 }, { result: 3 }, { result: 5 }] }],
      formula: "3d6",
      total: 12,
    };
    const serialized = JSON.stringify(data);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(serialized),
    );
    const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    vi.stubGlobal("Roll", {
      fromJSON: () => ({ ...data, toJSON: () => data }),
    });
    const result = {
      baseFaces: [4, 3],
      characterPointFaces: [],
      request: {
        context: {
          requestedRoll: { requestId: "root:riposte" },
          weaponAttack: {
            targetActorId: "attacker",
            targetTokenId: "attacker-token",
            weaponId: "blade",
          },
        },
        kind: "weapon-attack",
        source: { actorId: "defender", itemId: "blade" },
      },
      total: 12,
      wildFaces: [5],
    } as unknown as D6RollResultV1;
    const artifacts = [
      {
        evidence: {
          faces: [4, 3, 5],
          fingerprint,
          formula: "3d6",
          total: 12,
        },
        serialized,
        version: 1 as const,
      },
    ];
    const subject = {
      itemId: "blade",
      kind: "riposte" as const,
      rootMessageId: "root",
      targetActorId: "attacker",
      targetTokenId: "attacker-token",
    };
    const presentation = requestedWeaponAttackRollPresentation(
      result,
      subject,
      artifacts,
    );
    expect(presentation).toBeDefined();
    if (!presentation) throw new Error("Riposte presentation missing");
    await expect(
      validateRequestedWeaponAttackRollArtifacts(presentation, {
        actorId: "defender",
        itemId: "blade",
        requestId: "root:riposte",
        rootMessageId: "root",
        targetActorId: "attacker",
        targetTokenId: "attacker-token",
      }),
    ).resolves.toHaveLength(1);
    await expect(
      validateRequestedWeaponAttackRollArtifacts(presentation, {
        actorId: "defender",
        itemId: "blade",
        requestId: "root:riposte",
        rootMessageId: "other-root",
        targetActorId: "attacker",
        targetTokenId: "attacker-token",
      }),
    ).rejects.toThrow("D6E2.ActionThread.ReactionEvidenceMissing");
  });

  it("validates routed Resistance identity and serialized faces before injury authority", async () => {
    const data = {
      dice: [{ results: [{ result: 4 }, { result: 3 }, { result: 5 }] }],
      formula: "3d6",
      total: 12,
    };
    const serialized = JSON.stringify(data);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(serialized),
    );
    const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    vi.stubGlobal("Roll", {
      fromJSON: () => ({ ...data, toJSON: () => data }),
    });
    const presentation = {
      actorId: "actor-1",
      baseFaces: [4, 3],
      characterPointFaces: [],
      difficulty: 13,
      pool: { dice: 3, pips: 0 },
      requestId: "request-1",
      resultModifier: 0,
      rollArtifacts: [
        {
          evidence: {
            faces: [4, 3, 5],
            fingerprint,
            formula: "3d6",
            total: 12,
          },
          serialized,
          version: 1 as const,
        },
      ],
      rollMode: "publicroll" as const,
      total: 12,
      wildFaces: [5],
      wildOutcome: "normal" as const,
      wildPolicy: "second-edition" as const,
    };

    await expect(
      validateRequestedResistanceRollArtifacts(presentation, {
        actorId: "actor-1",
        difficulty: 13,
        requestId: "request-1",
      }),
    ).resolves.toHaveLength(1);
    await expect(
      validateRequestedResistanceRollArtifacts(presentation, {
        actorId: "actor-1",
        difficulty: 13,
        requestId: "wrong-request",
      }),
    ).rejects.toThrow("D6E2.Combat.Damage.ResistanceEvidenceMissing");
  });

  it("keeps a deterministic local-GM explosive resistance pending until explicitly opened", () => {
    const gm = {
      active: true,
      id: "gm-1",
      isGM: true,
      name: "Gamemaster",
    };
    const actor = {
      id: "actor-1",
      img: "actor.webp",
      name: "Target",
      testUserPermission: () => false,
    };
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: { get: vi.fn(() => false), set: vi.fn() },
      user: gm,
      users: { contents: [gm] },
    });
    vi.stubGlobal("ui", { notifications: { warn: vi.fn() } });

    const createdAt = Date.now();
    void requestActorResistanceRoll(
      actor as unknown as FoundryActorDocument,
      {
        application: "damage",
        modifierScore: 0,
        sourceActorId: "attacker",
        sourceName: "Attacker",
        sourcePage: 0,
        sourceRank: 0,
        targetActorId: actor.id,
        targetName: actor.name,
        targetRank: 0,
      },
      14,
      {
        createdAt,
        deferLocal: true,
        expiresAt: createdAt + 300_000,
        id: "explosive:request:resistance:target",
      },
    );

    expect(activeD6PendingInteractions(gm.id)).toMatchObject([
      {
        id: "explosive:request:resistance:target",
        kind: "resistance-roll",
        reopenable: true,
        status: "pending",
      },
    ]);
    expect(activeD6GmTasks()).toEqual([]);
  });

  it("closes an expired local Resistance dialog before settling its pending stage", async () => {
    vi.useFakeTimers();
    let finishClosing!: () => void;
    const cancelDialog = vi
      .spyOn(rollService, "cancelRequestedRollDialog")
      .mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finishClosing = resolve;
          }),
      );
    const gm = {
      active: true,
      id: "gm-1",
      isGM: true,
      name: "Gamemaster",
    };
    const actor = {
      id: "actor-1",
      img: "actor.webp",
      name: "Target",
      testUserPermission: () => false,
    };
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: { get: vi.fn(() => false), set: vi.fn() },
      user: gm,
      users: { contents: [gm] },
    });
    vi.stubGlobal("ui", { notifications: { warn: vi.fn() } });
    const createdAt = Date.now();
    const requestId = "explosive:request:resistance:expiring-target";

    const outcome = requestActorResistanceRoll(
      actor as unknown as FoundryActorDocument,
      {
        application: "damage",
        modifierScore: 0,
        sourceActorId: "attacker",
        sourceName: "Attacker",
        sourcePage: 0,
        sourceRank: 0,
        targetActorId: actor.id,
        targetName: actor.name,
        targetRank: 0,
      },
      14,
      {
        createdAt,
        deferLocal: true,
        expiresAt: createdAt + 1_000,
        id: requestId,
      },
    );

    await vi.advanceTimersByTimeAsync(1_001);

    let settled = false;
    void outcome.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(cancelDialog).toHaveBeenCalledOnce();
    expect(settled).toBe(false);

    finishClosing();

    await expect(outcome).resolves.toEqual({ status: "cancelled" });
    expect(cancelDialog).toHaveBeenCalledWith(requestId);
    vi.useRealTimers();
  });

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
      resistanceRoll: {
        actorId: actor.id,
        baseFaces: [4, 6, 4],
        characterPointFaces: [],
        difficulty: 17,
        pool: { dice: 4, pips: 0 },
        resultModifier: 0,
        requestId: request.id,
        rollArtifacts: [
          {
            evidence: {
              faces: [4, 6, 4, 1],
              fingerprint: "a".repeat(64),
              formula: "4d6",
              total: 15,
            },
            serialized: "{}",
            version: 1,
          },
        ],
        rollMode: "publicroll",
        total: 14,
        wildFaces: [1],
        wildOutcome: "complication",
        wildPolicy: "second-edition-classic",
      },
      id: request.id,
      requesterUserId: gm.id,
      status: "rolled",
      targetUserId: player.id,
      total: 14,
      type: "response",
      wildOutcome: "complication",
    });

    await expect(outcomePromise).resolves.toEqual({
      resistanceRoll: {
        actorId: actor.id,
        baseFaces: [4, 6, 4],
        characterPointFaces: [],
        difficulty: 17,
        pool: { dice: 4, pips: 0 },
        resultModifier: 0,
        requestId: request.id,
        rollArtifacts: [
          {
            evidence: {
              faces: [4, 6, 4, 1],
              fingerprint: "a".repeat(64),
              formula: "4d6",
              total: 15,
            },
            serialized: "{}",
            version: 1,
          },
        ],
        rollMode: "publicroll",
        total: 14,
        wildFaces: [1],
        wildOutcome: "complication",
        wildPolicy: "second-edition-classic",
      },
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
    setSettingProfileTerminology({ attributes: { agility: "Dexterity" } });

    registerRollRequestSocket();
    expect(socketHandler).toBeTypeOf("function");
    const createdAt = Date.now();
    const request = {
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
      version: 3,
      visibility: "private",
    } as const;
    socketHandler?.(request);
    socketHandler?.(request);

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
      expect(activeD6PendingInteractions("player-1")).toMatchObject([
        { id: "request-1", label: "Dexterity", status: "pending" },
      ]);
    });
    expect(rollAttribute).toHaveBeenCalledOnce();
    expect(
      emit.mock.calls.some(
        ([, value]) =>
          (value as { readonly type?: string }).type === "response",
      ),
    ).toBe(false);
  });

  it("redelivers a same-coordinator pending request after recipient reload without a connection transition", async () => {
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
    vi.stubGlobal("foundry", {
      applications: {
        api: {
          DialogV2: {
            wait: vi.fn().mockResolvedValue({
              delivery: "open-roll-window",
              recipientUserId: player.id,
              visibility: "public",
            }),
          },
        },
        handlebars: {
          renderTemplate: vi.fn().mockResolvedValue("<form></form>"),
        },
      },
      utils: { randomID: () => "request-reload" },
    });
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
    await requestActorRoll(
      actor as unknown as FoundryActorDocument,
      { attributeId: "agility", kind: "attribute" },
      "Dexterity",
    );
    await vi.waitFor(() =>
      expect(
        emit.mock.calls.find(
          ([, value]) =>
            (value as { readonly type?: string }).type === "request",
        )?.[1],
      ).toMatchObject({ id: "request-reload", targetUserId: player.id }),
    );
    socketHandler?.({
      id: "request-reload",
      requesterUserId: gm.id,
      targetUserId: player.id,
      type: "acknowledged",
    });

    emit.mockClear();
    socketHandler?.({
      targetUserId: player.id,
      type: "recover-pending-requests",
      version: 3,
    });
    await vi.waitFor(() => expect(emit).toHaveBeenCalledOnce());
    expect(emit.mock.calls[0]?.[1]).toMatchObject({
      id: "request-reload",
      requesterUserId: gm.id,
      targetUserId: player.id,
      type: "request",
    });

    emit.mockClear();
    socketHandler?.({
      targetUserId: "other-player",
      type: "recover-pending-requests",
      version: 3,
    });
    expect(emit).not.toHaveBeenCalled();

    socketHandler?.({
      id: "request-reload",
      requesterUserId: gm.id,
      status: "cancelled",
      targetUserId: player.id,
      type: "response",
    });
  });

  it("announces pending-request recovery after the recipient socket listener is installed", () => {
    const calls: string[] = [];
    const player = {
      active: true,
      id: "player-1",
      isGM: false,
      name: "Player",
    };
    vi.stubGlobal("game", {
      socket: {
        emit: vi.fn((_channel: string, value: { readonly type?: string }) => {
          calls.push(`emit:${value.type ?? "unknown"}`);
        }),
        on: vi.fn(() => calls.push("listen")),
      },
      user: player,
      users: { get: (id: string) => (id === player.id ? player : undefined) },
    });

    registerRollRequestSocket();

    expect(calls).toEqual(["listen", "emit:recover-pending-requests"]);
  });

  it("holds a highlighted request until the player clicks its sheet score", async () => {
    const rollSkill = vi.fn().mockResolvedValue({ total: 12 });
    const emit = vi.fn();
    let socketHandler: ((value: unknown) => void) | undefined;
    const actor = {
      id: "actor-1",
      isOwner: true,
      items: { get: () => ({ name: "Dodge" }) },
    };
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
      version: 3,
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
    ).resolves.toBe("resolved");
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

  it("keeps a highlighted request pending when its roll builder is dismissed", async () => {
    const rollSkill = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ total: 12 });
    const emit = vi.fn();
    let socketHandler: ((value: unknown) => void) | undefined;
    const actor = {
      id: "actor-1",
      isOwner: true,
      items: { get: () => ({ name: "Dodge" }) },
    };
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
      id: "request-dismissed-highlight",
      requesterName: requester.name,
      requesterUserId: requester.id,
      subject: { itemId: "skill-1", kind: "skill" },
      targetUserId: "player-1",
      type: "request",
      version: 3,
      visibility: "public",
    });

    await vi.waitFor(() =>
      expect(activeHighlightedRollRequests(actor.id)).toHaveLength(1),
    );
    await expect(
      executeHighlightedRollRequest(actor as unknown as FoundryActorDocument, {
        itemId: "skill-1",
        kind: "skill",
      }),
    ).resolves.toBe("dismissed");
    expect(activeHighlightedRollRequests(actor.id)).toHaveLength(1);
    expect(activeD6PendingInteractions("player-1")).toMatchObject([
      { id: "request-dismissed-highlight", status: "pending" },
    ]);
    expect(
      emit.mock.calls.some(
        ([, message]) =>
          (message as { readonly type?: string }).type === "response",
      ),
    ).toBe(false);

    await expect(
      executeHighlightedRollRequest(actor as unknown as FoundryActorDocument, {
        itemId: "skill-1",
        kind: "skill",
      }),
    ).resolves.toBe("resolved");
    await vi.waitFor(() =>
      expect(activeHighlightedRollRequests(actor.id)).toHaveLength(0),
    );
    await vi.waitFor(() =>
      expect(activeD6PendingInteractions("player-1")).toHaveLength(0),
    );
    expect(rollSkill).toHaveBeenCalledTimes(2);
  });

  it("clears a highlighted request when the GM cancels it", async () => {
    const emit = vi.fn();
    let socketHandler: ((value: unknown) => void) | undefined;
    const actor = {
      id: "actor-1",
      isOwner: true,
      items: { get: () => ({ name: "Dodge" }) },
    };
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
      version: 3,
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
