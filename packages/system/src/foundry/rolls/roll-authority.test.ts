import { afterEach, describe, expect, it, vi } from "vitest";
import type { D6RollResultV1 } from "@d6-system-2e/core";
import {
  claimRollFollowUp,
  registerRollAuthoritySocket,
  requestGmWildChoice,
  resetRollAuthorityForTests,
} from "./roll-authority";

afterEach(() => {
  resetRollAuthorityForTests();
  vi.unstubAllGlobals();
});

function result(actorId = "actor-1"): D6RollResultV1 {
  return {
    contractVersion: 1,
    request: {
      source: { actorId },
    },
    total: 12,
  } as D6RollResultV1;
}

describe("roll authority socket", () => {
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
      readonly requesterUserId: string;
      readonly targetUserId: string;
    };
    expect(request.targetUserId).toBe("gm-1");

    socketHandler?.({
      choice: "second-edition-partial",
      id: request.id,
      requesterUserId: request.requesterUserId,
      targetUserId: request.targetUserId,
      type: "roll-authority-wild-response",
    });

    await expect(choicePromise).resolves.toBe("second-edition-partial");
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
