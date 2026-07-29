import { beforeEach, describe, expect, it, vi } from "vitest";
import { createD6System2eActionHandler } from "./action-handler";
import { createD6System2eDefaults } from "./defaults";
import { createD6System2eRollHandler } from "./roll-handler";

function apiStub() {
  const item = vi.fn();
  const invoke = vi.fn();
  const featureRead = vi.fn(() => ({
    contractVersion: 1,
    revision: 4,
    sessionId: "session",
    uses: {},
  }));
  const actor = vi.fn(() => ({
    attributes: [
      {
        code: { dice: 3, pips: 1 },
        id: "agility",
        label: "Agility",
        rollable: true,
        score: 9,
      },
    ],
    contractVersion: 1,
    features: [
      {
        capabilityState: "active",
        cost: 0,
        creationSkillCostScore: 0,
        focus: "",
        id: "asset-1",
        image: "asset.webp",
        name: "Lucky Break",
        rank: 0,
        repeatable: false,
        sessionMaximum: 2,
        sessionUses: 1,
        trigger: "",
        type: "asset",
      },
    ],
    id: "actor-1",
    image: "actor.webp",
    items: [
      {
        damageCode: { dice: 4, pips: 0 },
        equipped: true,
        id: "weapon-1",
        image: "weapon.webp",
        modes: ["attack", "damage"],
        name: "Service Pistol",
        type: "weapon",
      },
    ],
    name: "Test Actor",
    permissions: { canEdit: true, isOwner: true },
    resources: {
      characterPoints: 0,
      experiencePoints: 0,
      fatePoints: 0,
      heroPoints: 1,
    },
    rulesProfileId: "second-edition",
    skills: [
      {
        attributeId: "agility",
        bonusScore: 3,
        code: { dice: 4, pips: 0 },
        id: "skill-1",
        kind: "standard",
        label: "Dodge",
        rollable: true,
        score: 12,
      },
    ],
    type: "character",
  }));
  return {
    apiVersion: 1,
    advancement: {
      attribute: vi.fn(),
      item: vi.fn(),
      specialization: vi.fn(),
    },
    campaign: { current: vi.fn() },
    capabilities: { has: vi.fn(), values: vi.fn() },
    combat: {
      completeNext: vi.fn(),
      declare: vi.fn(),
      read: vi.fn(() => null),
      reset: vi.fn(),
    },
    features: {
      invoke,
      read: featureRead,
      reset: vi.fn(),
    },
    health: { condition: vi.fn() },
    migrations: { latestSchemaVersion: 11 },
    read: { actor },
    roll: {
      attribute: vi.fn(),
      doubleDown: vi.fn(),
      item,
      reroll: vi.fn(),
      skill: vi.fn(),
    },
    rules: {
      applyPreset: vi.fn(),
      capabilities: vi.fn(),
      current: vi.fn(),
    },
    systemId: "d6-system-2e",
    terminology: { register: vi.fn() },
    themes: { register: vi.fn() },
  };
}

function coreStub() {
  class ActionHandler {
    actor?: object;
    delimiter = "|";
    token?: { readonly id: string };
    readonly additions: {
      readonly actions: readonly unknown[];
      readonly group: unknown;
    }[] = [];

    addActions(actions: readonly unknown[], group: unknown): Promise<void> {
      this.additions.push({ actions, group });
      return Promise.resolve();
    }
  }
  class RollHandler {
    actor = {};
    delimiter = "|";
    invalid = vi.fn();

    handleActionClick(): Promise<unknown> {
      return Promise.resolve(undefined);
    }

    throwInvalidValueErr(): unknown {
      return this.invalid();
    }
  }
  class SystemManager {
    registerSettings(): void {
      return undefined;
    }
  }
  return {
    api: { ActionHandler, RollHandler, SystemManager },
  };
}

describe("Token Action HUD public API adapter", () => {
  beforeEach(() => {
    vi.stubGlobal("game", {
      i18n: {
        format: (
          key: string,
          data: { readonly maximum: number; readonly used: number },
        ) => `${key}:${String(data.used)}/${String(data.maximum)}`,
        localize: (key: string) => key,
      },
      system: { api: apiStub() },
      user: { isGM: false },
    });
    vi.stubGlobal("ui", {
      notifications: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    });
  });

  it.each([false, true])(
    "builds all five groups from immutable public read models when isGM is %s",
    async (isGM) => {
      (game.user as { isGM: boolean }).isGM = isGM;
      const Handler = createD6System2eActionHandler(coreStub());
      const handler = new Handler() as InstanceType<typeof Handler> & {
        actor: object;
        readonly additions: readonly {
          readonly actions: readonly { readonly encodedValue: string }[];
          readonly group: { readonly id: string };
        }[];
        token: { readonly id: string };
      };
      handler.actor = {};
      handler.token = { id: "token-1" };

      await (
        handler as unknown as { buildSystemActions(): Promise<void> }
      ).buildSystemActions();

      expect(handler.additions.map(({ group }) => group.id)).toEqual([
        "combat",
        "attributes",
        "skills",
        "weapons",
        "features",
      ]);
      expect(
        handler.additions.flatMap(({ actions }) =>
          actions.map(({ encodedValue }) => encodedValue),
        ),
      ).toEqual(
        expect.arrayContaining([
          "attribute|agility",
          "skill|skill-1",
          "item-attack|weapon-1",
          "item-damage|weapon-1",
          "feature-hero-point|asset-1",
          "feature-roll-bonus|asset-1",
        ]),
      );
      const attributeActions = handler.additions.find(
        ({ group }) => group.id === "attributes",
      )?.actions as readonly {
        readonly info1?: { readonly text: string };
      }[];
      expect(attributeActions[0]?.info1?.text).toBe("3D+1");
    },
  );

  it("dispatches weapon and narrative-feature actions through API v1", async () => {
    const api = game.system.api as unknown as ReturnType<typeof apiStub>;
    const Handler = createD6System2eRollHandler(coreStub());
    const handler = new Handler();

    await handler.handleActionClick({} as Event, "item-damage|weapon-1");
    await handler.handleActionClick({} as Event, "feature-roll-bonus|asset-1");

    expect(api.roll.item).toHaveBeenCalledWith(
      handler.actor,
      "weapon-1",
      "damage",
    );
    expect(api.features.invoke).toHaveBeenCalledWith(handler.actor, "asset-1", {
      choice: "roll-bonus",
      expectedRevision: 4,
    });
  });

  it("registers stable default group and layout identities", () => {
    const defaults = createD6System2eDefaults();
    expect(defaults.groups.map(({ id }) => id)).toEqual([
      "combat",
      "attributes",
      "skills",
      "weapons",
      "features",
    ]);
    expect(defaults.layout.map(({ id }) => id)).toEqual(
      defaults.groups.map(({ id }) => id),
    );
  });
});
