import { afterEach, describe, expect, it, vi } from "vitest";
import type { D6RollResultV1 } from "@d6-system-2e/core";
import {
  claimRollFollowUp,
  promptWildChoiceDialog,
  registerRollAuthoritySocket,
  requestGmWildChoice,
  requiresGmWildChoice,
  resetRollAuthorityForTests,
  wildDecisionViewModel,
} from "./roll-authority";

afterEach(() => {
  resetRollAuthorityForTests();
  vi.unstubAllGlobals();
});

function result(
  actorId = "actor-1",
  rollMode: D6RollResultV1["request"]["rollMode"] = "publicroll",
): D6RollResultV1 {
  return {
    contractVersion: 2,
    request: {
      rollMode,
      source: { actorId },
    },
    total: 12,
  } as D6RollResultV1;
}

function d6mvResult(
  rollMode: D6RollResultV1["request"]["rollMode"] = "publicroll",
  opposed = false,
): D6RollResultV1 {
  return {
    ...result("actor-1", rollMode),
    d6mv: {
      allyHeroPointAward: 0,
      consequence: "none",
      damageMultiplier: 1,
      degree: "ordinary-success",
      difficulty: 15,
      margin: 4,
      selfHeroPointAward: 0,
      setback: false,
      version: 1,
    },
    ...(opposed
      ? {
          opposition: {
            actorTotal: 19,
            margin: 4,
            opponentTotal: 15,
            tieBreak: "none",
            winner: "actor",
          },
          request: {
            ...result("actor-1", rollMode).request,
            opposition: {
              actorKind: "character",
              name: "Long opposition label",
              opponentKind: "character",
              total: 15,
            },
          },
        }
      : {}),
    total: 19,
  } as D6RollResultV1;
}

describe("roll authority socket", () => {
  it("builds a truthful D6MV decision trace for fixed and opposed choices", () => {
    const choices = [
      "d6mv-advantage-success-exceptional",
      "d6mv-advantage-success-two-hero-points",
      "d6mv-advantage-success-ally-hero-point",
    ] as const;
    expect(
      wildDecisionViewModel(choices, d6mvResult(), {
        actorName: "A Very Long Authorized Actor Name",
        resourceLabel: "Force Points",
      }),
    ).toEqual({
      actorName: "A Very Long Authorized Actor Name",
      authority: "player",
      degree: "ordinary-success",
      difficulty: 15,
      kind: "advantage",
      margin: 4,
      resourceLabel: "Force Points",
      targetKind: "fixed",
      total: 19,
    });
    expect(
      wildDecisionViewModel(
        ["d6mv-complication-success-setback"],
        d6mvResult("gmroll", true),
      ),
    ).toMatchObject({
      authority: "game-master",
      kind: "complication",
      oppositionName: "Long opposition label",
      targetKind: "opposed",
    });
  });

  it("renders the actor, authority, exact degree, target, and margin in the modal evidence", async () => {
    const wait = vi.fn().mockResolvedValue(null);
    vi.stubGlobal("foundry", {
      applications: { api: { DialogV2: { wait } } },
    });
    vi.stubGlobal("game", {
      i18n: {
        format: (key: string, data: Record<string, string>) =>
          `${key}:${Object.values(data).join(":")}`,
        localize: (key: string) => key,
      },
    });
    await promptWildChoiceDialog(
      ["d6mv-advantage-success-ally-hero-point"],
      wildDecisionViewModel(
        ["d6mv-advantage-success-ally-hero-point"],
        d6mvResult("publicroll", true),
        { actorName: "Authorized Actor", resourceLabel: "Fate Points" },
      ),
    );
    const configuration = wait.mock.calls[0]?.[0] as {
      buttons: readonly { readonly label: string }[];
      content: string;
      modal: boolean;
      rejectClose: boolean;
    };
    expect(configuration).toMatchObject({ modal: true, rejectClose: false });
    expect(configuration.content).toContain("Authorized Actor");
    expect(configuration.content).toContain("ordinary-success");
    expect(configuration.content).toContain("Long opposition label");
    expect(configuration.content).toContain("<dd>4</dd>");
    expect(configuration.buttons[0]?.label).toContain("Fate Points");
  });

  it("uses the active resource terminology for every one- and two-point D6MV choice", async () => {
    const wait = vi.fn().mockResolvedValue(null);
    vi.stubGlobal("foundry", {
      applications: { api: { DialogV2: { wait } } },
    });
    vi.stubGlobal("game", {
      i18n: {
        format: (_key: string, data: Record<string, unknown>) => {
          const text = (value: unknown, fallback = ""): string =>
            typeof value === "string" || typeof value === "number"
              ? String(value)
              : fallback;
          return `${text(data.action, "ally")}|${text(data.resource)}|${text(data.quantity)}`;
        },
        localize: (key: string) => key,
      },
    });
    const choices = [
      "d6mv-advantage-failure-explode",
      "d6mv-advantage-success-exceptional",
      "d6mv-advantage-success-two-hero-points",
      "d6mv-complication-failure-catastrophic",
      "d6mv-complication-failure-exceptional",
      "d6mv-complication-success-failure",
      "d6mv-complication-success-partial",
    ] as const;
    await promptWildChoiceDialog(choices, {
      authority: "game-master",
      kind: "wild-choice",
      resourceLabel: "Momentum",
      total: 12,
    });
    const configuration = wait.mock.calls[0]?.[0] as {
      buttons: readonly { readonly label: string }[];
    };
    const labels = configuration.buttons
      .slice(0, choices.length)
      .map((button) => button.label);
    expect(labels).toHaveLength(7);
    expect(labels.every((label) => label.includes("Momentum"))).toBe(true);
    expect(labels.filter((label) => label.endsWith("|1"))).toHaveLength(4);
    expect(labels.filter((label) => label.endsWith("|2"))).toHaveLength(3);
    expect(labels.join(" ")).not.toContain("Hero Point");
  });
  it("routes a player Wild Die complication decision to an active GM", async () => {
    const emit = vi.fn();
    let socketHandler: ((value: unknown) => void) | undefined;
    vi.stubGlobal("ui", {
      notifications: {
        info: vi.fn(),
        warn: vi.fn(),
      },
    });
    vi.stubGlobal("game", {
      i18n: {
        format: (_key: string, data: { gm: string }) => data.gm,
        localize: (key: string) => key,
      },
      socket: {
        emit,
        on: vi.fn((_channel: string, handler: (value: unknown) => void) => {
          socketHandler = handler;
        }),
      },
      user: { active: true, id: "player-1", isGM: false, name: "Player" },
      users: {
        contents: [
          { active: true, id: "gm-2", isGM: true, name: "Zulu" },
          { active: true, id: "gm-1", isGM: true, name: "Alpha" },
        ],
      },
    });

    registerRollAuthoritySocket();
    const choicePromise = requestGmWildChoice(
      ["second-edition-partial", "second-edition-failure"],
      result(),
    );
    const request = emit.mock.calls[0]?.[1] as {
      readonly id: string;
      readonly reason: string;
      readonly requesterUserId: string;
      readonly rollMode: string;
      readonly targetUserId: string;
    };
    expect(request.targetUserId).toBe("gm-1");
    expect(request.reason).toBe("second-edition-complication");
    expect(request.rollMode).toBe("publicroll");

    socketHandler?.({
      choice: "second-edition-partial",
      id: request.id,
      requesterUserId: request.requesterUserId,
      targetUserId: request.targetUserId,
      type: "roll-authority-wild-response",
    });

    await expect(choicePromise).resolves.toBe("second-edition-partial");
  });

  it("routes a player First Edition critical-one decision to an active GM", async () => {
    const emit = vi.fn();
    let socketHandler: ((value: unknown) => void) | undefined;
    vi.stubGlobal("ui", {
      notifications: {
        info: vi.fn(),
        warn: vi.fn(),
      },
    });
    vi.stubGlobal("game", {
      i18n: {
        format: (_key: string, data: { gm: string }) => data.gm,
        localize: (key: string) => key,
      },
      socket: {
        emit,
        on: vi.fn((_channel: string, handler: (value: unknown) => void) => {
          socketHandler = handler;
        }),
      },
      user: { active: true, id: "player-1", isGM: false, name: "Player" },
      users: {
        contents: [
          { active: true, id: "gm-1", isGM: true, name: "Gamemaster" },
        ],
      },
    });

    registerRollAuthoritySocket();
    const choicePromise = requestGmWildChoice(
      ["first-edition-remove-highest", "first-edition-complication"],
      result(),
    );
    const request = emit.mock.calls[0]?.[1] as {
      readonly id: string;
      readonly reason: string;
      readonly requesterUserId: string;
      readonly targetUserId: string;
    };
    expect(request).toMatchObject({
      reason: "first-edition-critical-one",
      targetUserId: "gm-1",
    });

    socketHandler?.({
      choice: "first-edition-complication",
      id: request.id,
      requesterUserId: request.requesterUserId,
      targetUserId: request.targetUserId,
      type: "roll-authority-wild-response",
    });

    await expect(choicePromise).resolves.toBe("first-edition-complication");
  });

  it("routes a blind player Advantage decision to an active GM", async () => {
    const emit = vi.fn();
    let socketHandler: ((value: unknown) => void) | undefined;
    vi.stubGlobal("ui", {
      notifications: {
        info: vi.fn(),
        warn: vi.fn(),
      },
    });
    vi.stubGlobal("game", {
      i18n: {
        format: (_key: string, data: { gm: string }) => data.gm,
        localize: (key: string) => key,
      },
      socket: {
        emit,
        on: vi.fn((_channel: string, handler: (value: unknown) => void) => {
          socketHandler = handler;
        }),
      },
      user: { active: true, id: "player-1", isGM: false, name: "Player" },
      users: {
        contents: [
          { active: true, id: "gm-1", isGM: true, name: "Gamemaster" },
        ],
      },
    });

    registerRollAuthoritySocket();
    const choicePromise = requestGmWildChoice(
      ["second-edition-exceptional", "second-edition-ordinary"],
      result("actor-1", "blindroll"),
    );
    const request = emit.mock.calls[0]?.[1] as {
      readonly id: string;
      readonly reason: string;
      readonly requesterUserId: string;
      readonly rollMode: string;
      readonly targetUserId: string;
    };
    expect(request).toMatchObject({
      reason: "blind-second-edition-advantage",
      rollMode: "blindroll",
      targetUserId: "gm-1",
    });

    socketHandler?.({
      choice: "second-edition-exceptional",
      id: request.id,
      requesterUserId: request.requesterUserId,
      targetUserId: request.targetUserId,
      type: "roll-authority-wild-response",
    });

    await expect(choicePromise).resolves.toBe("second-edition-exceptional");
  });

  it("keeps a non-blind player Advantage choice local", () => {
    const choices = [
      "second-edition-exceptional",
      "second-edition-ordinary",
    ] as const;

    expect(requiresGmWildChoice(choices, result("actor-1", "publicroll"))).toBe(
      false,
    );
    expect(requiresGmWildChoice(choices, result("actor-1", "gmroll"))).toBe(
      false,
    );
    expect(requiresGmWildChoice(choices, result("actor-1", "selfroll"))).toBe(
      false,
    );
    expect(requiresGmWildChoice(choices, result("actor-1", "blindroll"))).toBe(
      true,
    );
  });

  it("splits D6MV Advantage to the player and Complication to the GM", () => {
    const advantage = [
      "d6mv-advantage-success-exceptional",
      "d6mv-advantage-success-two-hero-points",
      "d6mv-advantage-success-ally-hero-point",
    ] as const;
    expect(requiresGmWildChoice(advantage, result())).toBe(false);
    expect(
      requiresGmWildChoice(advantage, result("actor-1", "blindroll")),
    ).toBe(true);
    expect(
      requiresGmWildChoice(
        [
          "d6mv-complication-success-setback",
          "d6mv-complication-success-partial",
          "d6mv-complication-success-failure",
        ],
        result(),
      ),
    ).toBe(true);
  });

  it("routes every Second Edition Classic mishap classification to the GM", () => {
    const choices = [
      "second-edition-classic-penalty",
      "second-edition-classic-complication",
    ] as const;
    expect(requiresGmWildChoice(choices, result())).toBe(true);
    expect(requiresGmWildChoice(choices, result("actor-1", "selfroll"))).toBe(
      true,
    );
  });

  it("routes every First Edition critical-one consequence choice to the GM", () => {
    const choices = [
      "first-edition-remove-highest",
      "first-edition-complication",
    ] as const;
    expect(requiresGmWildChoice(choices, result())).toBe(true);
    expect(requiresGmWildChoice(choices, result("actor-1", "selfroll"))).toBe(
      true,
    );
  });

  it("cancels a valid blind Advantage when the targeted GM closes it", async () => {
    const emit = vi.fn();
    const wait = vi.fn().mockResolvedValue(null);
    const player = {
      active: true,
      id: "player-1",
      isGM: false,
      name: "Player",
    };
    const actor = {
      id: "actor-1",
      name: "Hidden Hero",
      testUserPermission: () => true,
    };
    let socketHandler: ((value: unknown) => void) | undefined;
    vi.stubGlobal("foundry", {
      applications: {
        api: {
          DialogV2: { wait },
        },
      },
    });
    vi.stubGlobal("game", {
      actors: { get: () => actor },
      i18n: {
        format: (_key: string, data: { actor: string }) => data.actor,
        localize: (key: string) => key,
      },
      socket: {
        emit,
        on: vi.fn((_channel: string, handler: (value: unknown) => void) => {
          socketHandler = handler;
        }),
      },
      user: { active: true, id: "gm-1", isGM: true, name: "Gamemaster" },
      users: {
        get: () => player,
      },
    });

    registerRollAuthoritySocket();
    const createdAt = Date.now();
    socketHandler?.({
      actorId: actor.id,
      choices: ["second-edition-exceptional", "second-edition-ordinary"],
      createdAt,
      decision: wildDecisionViewModel(
        ["second-edition-exceptional", "second-edition-ordinary"],
        result("actor-1", "blindroll"),
      ),
      expiresAt: createdAt + 60_000,
      id: "blind-advantage-1",
      reason: "blind-second-edition-advantage",
      requesterUserId: player.id,
      rollMode: "blindroll",
      targetUserId: "gm-1",
      type: "roll-authority-wild-request",
      version: 1,
    });

    await vi.waitFor(() => {
      expect(emit).toHaveBeenCalledWith("system.d6-system-2e", {
        choice: null,
        id: "blind-advantage-1",
        requesterUserId: "player-1",
        targetUserId: "gm-1",
        type: "roll-authority-wild-response",
      });
    });
    expect(wait).toHaveBeenCalledOnce();
  });

  it("rejects a blind Advantage authority request with a public roll mode", async () => {
    const emit = vi.fn();
    const wait = vi.fn();
    const player = {
      active: true,
      id: "player-1",
      isGM: false,
      name: "Player",
    };
    let socketHandler: ((value: unknown) => void) | undefined;
    vi.stubGlobal("foundry", {
      applications: {
        api: {
          DialogV2: { wait },
        },
      },
    });
    vi.stubGlobal("game", {
      actors: {
        get: () => ({
          id: "actor-1",
          name: "Hero",
          testUserPermission: () => true,
        }),
      },
      socket: {
        emit,
        on: vi.fn((_channel: string, handler: (value: unknown) => void) => {
          socketHandler = handler;
        }),
      },
      user: { active: true, id: "gm-1", isGM: true },
      users: { get: () => player },
    });

    registerRollAuthoritySocket();
    const createdAt = Date.now();
    socketHandler?.({
      actorId: "actor-1",
      choices: ["second-edition-exceptional", "second-edition-ordinary"],
      createdAt,
      decision: wildDecisionViewModel(
        ["second-edition-exceptional", "second-edition-ordinary"],
        result("actor-1", "publicroll"),
      ),
      expiresAt: createdAt + 60_000,
      id: "invalid-advantage",
      reason: "blind-second-edition-advantage",
      requesterUserId: player.id,
      rollMode: "publicroll",
      targetUserId: "gm-1",
      type: "roll-authority-wild-request",
      version: 1,
    });
    await Promise.resolve();

    expect(wait).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("stops a blind player Advantage safely when no GM is active", async () => {
    const warn = vi.fn();
    vi.stubGlobal("ui", { notifications: { info: vi.fn(), warn } });
    vi.stubGlobal("game", {
      i18n: {
        localize: (key: string) => key,
      },
      user: { active: true, id: "player-1", isGM: false },
      users: { contents: [] },
    });

    await expect(
      requestGmWildChoice(
        ["second-edition-exceptional", "second-edition-ordinary"],
        result("actor-1", "blindroll"),
      ),
    ).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith("D6E2.Roll.GmWildChoiceUnavailable");
  });

  it("accepts only one concurrent follow-up claim for a chat message", async () => {
    const flags = new Map<string, unknown>([
      ["roll", result()],
      ["rollFollowUpUsed", false],
    ]);
    let releaseUpdate!: () => void;
    const firstUpdate = new Promise<void>((resolve) => {
      releaseUpdate = resolve;
    });
    const update = vi
      .fn()
      .mockImplementationOnce(async (changes: Record<string, unknown>) => {
        await firstUpdate;
        flags.set(
          "rollFollowUpUsed",
          changes["flags.d6-system-2e.rollFollowUpUsed"],
        );
        flags.set(
          "rollFollowUpClaim",
          changes["flags.d6-system-2e.rollFollowUpClaim"],
        );
      });
    const message = {
      getFlag: (_scope: string, key: string) => flags.get(key),
      id: "message-1",
      update,
    };
    const actor = {
      id: "actor-1",
      name: "Hero",
      testUserPermission: () => true,
    };
    const player = {
      active: true,
      id: "player-1",
      isGM: false,
      name: "Player",
    };
    const emit = vi.fn();
    let socketHandler: ((value: unknown) => void) | undefined;
    vi.stubGlobal("game", {
      actors: { get: () => actor },
      messages: { get: () => message },
      socket: {
        emit,
        on: vi.fn((_channel: string, handler: (value: unknown) => void) => {
          socketHandler = handler;
        }),
      },
      user: { active: true, id: "gm-1", isGM: true, name: "GM" },
      users: {
        get: () => player,
      },
    });

    registerRollAuthoritySocket();
    const createdAt = Date.now();
    const base = {
      actorId: actor.id,
      createdAt,
      expiresAt: createdAt + 60_000,
      messageId: message.id,
      requesterUserId: player.id,
      targetUserId: "gm-1",
      type: "roll-authority-follow-up-claim",
      version: 1,
    };
    socketHandler?.({ ...base, id: "claim-1" });
    socketHandler?.({ ...base, id: "claim-1" });
    socketHandler?.({ ...base, id: "claim-2" });

    await vi.waitFor(() => {
      expect(emit).toHaveBeenCalledWith("system.d6-system-2e", {
        granted: false,
        id: "claim-2",
        requesterUserId: "player-1",
        targetUserId: "gm-1",
        type: "roll-authority-follow-up-response",
      });
    });
    releaseUpdate();
    await vi.waitFor(() => {
      expect(
        emit.mock.calls.filter(
          ([, response]) =>
            (response as { readonly granted?: boolean; readonly id?: string })
              .granted === true &&
            (response as { readonly id?: string }).id === "claim-1",
        ),
      ).toHaveLength(2);
    });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("denies a player follow-up when no active GM can arbitrate it", async () => {
    const warn = vi.fn();
    vi.stubGlobal("ui", { notifications: { warn } });
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      user: { active: true, id: "player-1", isGM: false },
      users: { contents: [] },
    });

    await expect(
      claimRollFollowUp(
        { id: "message-1" } as FoundryChatMessageDocument,
        { id: "actor-1" } as FoundryActorDocument,
      ),
    ).resolves.toBe(false);
    expect(warn).toHaveBeenCalledWith("D6E2.Roll.FollowUp.GmUnavailable");
  });
});
