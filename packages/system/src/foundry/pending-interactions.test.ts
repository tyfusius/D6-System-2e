import { afterEach, describe, expect, it, vi } from "vitest";
import * as rollService from "./rolls/roll-service";
import {
  registerRollRequestSocket,
  resetRollRequestsForTests,
} from "./roll-requests";
import {
  activeD6PendingInteractions,
  resetD6PendingInteractionsForTests,
} from "../application/pending-interactions";
import { SHARED_SETTING_KEYS } from "../settings/settings-catalog";
import {
  PENDING_INTERACTION_DELIVERY_LEDGER,
  registerFoundryPendingInteraction,
  resetFoundryPendingInteractionDeliveryForTests,
} from "./pending-interactions";

afterEach(async () => {
  await resetFoundryPendingInteractionDeliveryForTests();
  resetD6PendingInteractionsForTests();
  resetRollRequestsForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubSettings(autoOpen?: boolean) {
  const values = new Map<string, unknown>([
    [SHARED_SETTING_KEYS.autoOpenPendingPrompts, autoOpen],
    [PENDING_INTERACTION_DELIVERY_LEDGER, "[]"],
  ]);
  const write = vi.fn((_namespace: string, key: string, value: unknown) =>
    Promise.resolve(values.set(key, value)),
  );
  vi.stubGlobal("game", {
    settings: {
      get: (_namespace: string, key: string) => values.get(key),
      set: write,
    },
  });
  return { values, write };
}

function options(reopen: () => Promise<"dismissed">) {
  return {
    controllerUserId: "player",
    createdAt: 100,
    expiresAt: Date.now() + 60_000,
    id: "prompt-1",
    kind: "resistance-roll" as const,
    label: "Resistance",
    reopen,
  };
}

describe("Foundry pending interaction delivery", () => {
  it("preserves a saved opt-out while registering a reopenable task", async () => {
    const { write } = stubSettings(false);
    const reopen = vi.fn().mockResolvedValue("dismissed" as const);
    await registerFoundryPendingInteraction(options(reopen), {
      automaticEligible: true,
    });
    expect(reopen).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(activeD6PendingInteractions("player")).toHaveLength(1);
  });

  it.each([undefined, false])(
    "does not open ineligible prompts with default-on (%s eligibility)",
    async (eligible) => {
      const { write } = stubSettings();
      const reopen = vi.fn().mockResolvedValue("dismissed" as const);
      await registerFoundryPendingInteraction(
        options(reopen),
        eligible === undefined ? {} : { automaticEligible: eligible },
      );
      expect(reopen).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
      expect(activeD6PendingInteractions("player")).toHaveLength(1);
    },
  );

  it("defaults on and auto-opens once per persisted client delivery lifecycle", async () => {
    const { values } = stubSettings();
    const reopen = vi.fn().mockResolvedValue("dismissed" as const);
    const pending = options(reopen);
    await registerFoundryPendingInteraction(pending, {
      automaticEligible: true,
    });
    expect(reopen).toHaveBeenCalledOnce();
    expect(
      values.get(SHARED_SETTING_KEYS.autoOpenPendingPrompts),
    ).toBeUndefined();

    resetD6PendingInteractionsForTests();
    await registerFoundryPendingInteraction(pending, {
      automaticEligible: true,
    });
    expect(reopen).toHaveBeenCalledOnce();
    expect(String(values.get(PENDING_INTERACTION_DELIVERY_LEDGER))).toContain(
      "prompt-1",
    );
  });

  it("does not auto-open the same stable workflow again when an expired stage is renewed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const { values } = stubSettings(true);
    const reopen = vi.fn().mockResolvedValue("dismissed" as const);
    const first = options(reopen);
    await registerFoundryPendingInteraction(first, {
      automaticEligible: true,
    });
    expect(reopen).toHaveBeenCalledOnce();

    resetD6PendingInteractionsForTests();
    vi.setSystemTime(first.expiresAt + 1);
    const renewedAt = Date.now();
    await registerFoundryPendingInteraction(
      {
        ...first,
        createdAt: renewedAt,
        expiresAt: renewedAt + 60_000,
      },
      { automaticEligible: true },
    );

    expect(reopen).toHaveBeenCalledOnce();
    expect(String(values.get(PENDING_INTERACTION_DELIVERY_LEDGER))).toContain(
      "prompt-1",
    );
    vi.useRealTimers();
  });

  it("never auto-opens a prompt whose delivery lifetime has already expired", async () => {
    stubSettings(true);
    const reopen = vi.fn().mockResolvedValue("dismissed" as const);
    const now = Date.now();

    await registerFoundryPendingInteraction(
      {
        ...options(reopen),
        createdAt: now - 60_000,
        expiresAt: now - 1,
      },
      { automaticEligible: true },
    );

    expect(reopen).not.toHaveBeenCalled();
  });

  it("forces an explicitly requested roll window without changing the automatic preference", async () => {
    stubSettings(false);
    const reopen = vi.fn().mockResolvedValue("dismissed" as const);
    await registerFoundryPendingInteraction(options(reopen), {
      forceOpen: true,
    });
    expect(reopen).toHaveBeenCalledOnce();
    expect(activeD6PendingInteractions("player")).toHaveLength(1);
  });

  it("serializes automatic prompt opening without resolving or rolling for the user", async () => {
    stubSettings(true);
    let releaseFirst!: () => void;
    const first = vi.fn(
      () =>
        new Promise<"dismissed">((resolve) => {
          releaseFirst = () => resolve("dismissed");
        }),
    );
    const second = vi.fn().mockResolvedValue("dismissed" as const);
    const firstRegistration = registerFoundryPendingInteraction(
      options(first),
      {
        automaticEligible: true,
      },
    );
    await vi.waitFor(() => expect(first).toHaveBeenCalledOnce());
    const secondRegistration = registerFoundryPendingInteraction(
      { ...options(second), id: "prompt-2" },
      { automaticEligible: true },
    );
    await Promise.resolve();
    expect(second).not.toHaveBeenCalled();

    releaseFirst();
    await Promise.all([firstRegistration, secondRegistration]);
    expect(second).toHaveBeenCalledOnce();
    expect(activeD6PendingInteractions("player")).toHaveLength(2);
  });
});

describe("default-on socket prompt audience", () => {
  it.each([
    {
      label: "addressed owner",
      target: "player",
      owner: true,
      gm: false,
      preference: undefined,
      opens: true,
    },
    {
      label: "saved opt-out",
      target: "player",
      owner: true,
      gm: false,
      preference: false,
      opens: false,
    },
    {
      label: "wrong recipient",
      target: "other-player",
      owner: true,
      gm: false,
      preference: undefined,
      opens: false,
    },
    {
      label: "unowned actor",
      target: "player",
      owner: false,
      gm: false,
      preference: undefined,
      opens: false,
    },
    {
      label: "GM observing the player request",
      target: "player",
      owner: true,
      gm: true,
      preference: undefined,
      opens: false,
    },
  ])(
    "preserves hidden request delivery for $label",
    async ({ target, owner, gm, preference, opens }) => {
      const { values, write } = stubSettings(preference);
      const settings = game.settings;
      const roll = vi
        .spyOn(rollService, "rollSecondEditionRiposteAttack")
        .mockResolvedValue(null);
      const emit = vi.fn();
      let receive: ((value: unknown) => void) | undefined;
      const actor = {
        id: "defender",
        isOwner: owner,
        name: "Defender",
        system: { resources: { heroPoints: { value: 2 } } },
        update: vi.fn().mockResolvedValue(undefined),
        items: { contents: [] },
      };
      const requester = { active: true, id: "gm", isGM: true, name: "GM" };
      vi.stubGlobal("game", {
        settings,
        system: { api: { roll: {} } },
        actors: { get: () => actor },
        user: { active: true, id: "player", isGM: gm, name: "Player" },
        users: { get: () => requester },
        i18n: { localize: (key: string) => key },
        socket: {
          emit,
          on: (_channel: string, handler: (value: unknown) => void) => {
            receive = handler;
          },
        },
      });
      vi.stubGlobal("Hooks", { on: vi.fn() });
      registerRollRequestSocket();
      const now = Date.now();
      receive?.({
        actorId: actor.id,
        createdAt: now,
        expiresAt: now + 300_000,
        delivery: "open-roll-window",
        id: "hidden-riposte",
        requesterName: "GM",
        requesterUserId: "gm",
        subject: {
          kind: "riposte",
          itemId: "blade",
          rootMessageId: "root",
          targetActorId: "attacker",
          targetTokenId: "attacker-token",
        },
        targetUserId: target,
        type: "request",
        version: 3,
        visibility: "hidden",
      });
      // The socket handler schedules delivery synchronously onto the actual queue.
      await resetFoundryPendingInteractionDeliveryForTests();
      expect(roll).toHaveBeenCalledTimes(opens ? 1 : 0);
      expect(values.get(SHARED_SETTING_KEYS.autoOpenPendingPrompts)).toBe(
        preference,
      );
      if (opens) {
        expect(roll.mock.calls[0]?.[3]?.requestedRoll).toMatchObject({
          rollMode: "blindroll",
          visibility: "hidden",
          recipientUserId: "player",
        });
      }
      if (target !== "player" || !owner || gm) {
        expect(activeD6PendingInteractions("player")).toHaveLength(0);
        expect(write).not.toHaveBeenCalled();
      }
    },
  );
});
