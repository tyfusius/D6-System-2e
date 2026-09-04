import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeHudCommand } from "./command-codec";

vi.mock("@d6-system-2e/core", () => ({ isD6System2eApiV2: () => true }));

import { createCommandDispatcher } from "./command-dispatcher";

const invalidValue = vi.fn();

class RollHandler {
  actor = { id: "actor" };

  throwInvalidValueErr(): unknown {
    return invalidValue();
  }
}

class ActionHandler {
  readonly testPort = true;
}

class SystemManager {
  readonly testPort = true;
}

const coreModule = { api: { ActionHandler, RollHandler, SystemManager } };

function apiStub() {
  return {
    combat: {
      completeNext: vi.fn().mockResolvedValue(undefined),
      read: vi.fn().mockReturnValue({
        currentAction: {
          id: "declared",
          kind: "skill",
          sourceId: "dodge",
        },
        revision: 7,
      }),
      reset: vi.fn().mockResolvedValue(undefined),
    },
    explosives: { begin: vi.fn().mockResolvedValue(undefined) },
    roll: {
      attribute: vi.fn().mockResolvedValue(undefined),
      item: vi.fn().mockResolvedValue(undefined),
      skill: vi.fn().mockResolvedValue(undefined),
    },
    ui: { openActorSheet: vi.fn() },
  };
}

describe("D6 HUD command dispatcher", () => {
  let api: ReturnType<typeof apiStub>;

  beforeEach(() => {
    vi.clearAllMocks();
    api = apiStub();
    vi.stubGlobal("game", {
      i18n: { localize: (value: string) => value },
      system: { api },
    });
    vi.stubGlobal("ui", { notifications: { error: vi.fn() } });
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ["attribute", "agility", "attribute", undefined],
    ["skill", "dodge", "skill", undefined],
    ["weapon-attack", "blaster", "item", "attack"],
    ["weapon-damage", "blaster", "item", "damage"],
  ] as const)(
    "routes %s through the public roll API",
    async (kind, id, method, mode) => {
      const Handler = createCommandDispatcher(coreModule);
      const handler = new Handler();

      await handler.handleActionClick(
        {} as Event,
        encodeHudCommand({ id, kind }),
      );

      if (method === "item") {
        expect(api.roll.item).toHaveBeenCalledWith(handler.actor, id, mode);
      } else {
        expect(api.roll[method]).toHaveBeenCalledWith(handler.actor, id);
      }
    },
  );

  it("routes explosives and declared round actions through public APIs", async () => {
    const Handler = createCommandDispatcher(coreModule);
    const handler = new Handler();

    await handler.handleActionClick(
      {} as Event,
      encodeHudCommand({ id: "grenade", kind: "explosive" }),
    );
    await handler.handleActionClick(
      {} as Event,
      encodeHudCommand({ id: "run-current", kind: "round" }),
    );

    expect(api.explosives.begin).toHaveBeenCalledWith(handler.actor, "grenade");
    expect(api.roll.skill).toHaveBeenCalledWith(handler.actor, "dodge");
  });

  it("opens Combat for an empty-round command and rejects malformed values", async () => {
    const Handler = createCommandDispatcher(coreModule);
    const handler = new Handler();

    await handler.handleActionClick(
      {} as Event,
      encodeHudCommand({ id: "open", kind: "round" }),
    );
    await handler.handleActionClick({} as Event, "not-a-d6-command");

    expect(api.ui.openActorSheet).toHaveBeenCalledWith(handler.actor, {
      tab: "combat",
    });
    expect(invalidValue).toHaveBeenCalledOnce();
  });
});
