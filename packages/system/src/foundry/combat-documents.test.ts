import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  chooseNextNarrativeCombatant,
  initiativeFormulaForActor,
  manualInitiativeOrder,
  moveCombatantInManualInitiative,
  registerAlternateInitiativeSocket,
  registerD6CombatDocuments,
  reorderedInitiativeIds,
  usesFirstEditionInitiativeRolls,
} from "./combat-documents";

const baseRollInitiative = vi.fn().mockResolvedValue("rolled");
const info = vi.fn();
const settingGet = vi.fn(
  (_namespace: string, key: string): unknown =>
    key === "useFirstEditionInitiative",
);

beforeEach(() => {
  baseRollInitiative.mockClear();
  info.mockClear();
  settingGet
    .mockReset()
    .mockImplementation(
      (_namespace: string, key: string) => key === "useFirstEditionInitiative",
    );
  class BaseCombat {
    readonly combatants = {
      contents: [
        { id: "combatant-1", initiative: 4 },
        { id: "combatant-2", initiative: 9 },
      ],
    };

    getFlag(): unknown {
      return undefined;
    }

    rollInitiative(
      ids: string | readonly string[],
      options?: Record<string, unknown>,
    ): Promise<unknown> {
      baseRollInitiative(ids, options);
      return Promise.resolve("rolled");
    }

    setFlag(): Promise<unknown> {
      return Promise.resolve(undefined);
    }

    _sortCombatants(
      a: { readonly id: string; readonly initiative?: number | null },
      b: { readonly id: string; readonly initiative?: number | null },
    ): number {
      return (b.initiative ?? 0) - (a.initiative ?? 0);
    }
  }
  class BaseCombatant {
    constructor(readonly actor?: object) {}

    _getInitiativeFormula(): string {
      return "undefined";
    }
  }
  vi.stubGlobal("Combat", BaseCombat);
  vi.stubGlobal("Combatant", BaseCombatant);
  vi.stubGlobal("CONFIG", {
    Actor: { dataModels: {} },
    Combat: { initiative: { decimals: 0, formula: "undefined" } },
    Combatant: {},
    Item: { dataModels: {} },
  });
  vi.stubGlobal("game", {
    i18n: { localize: (key: string) => key },
    settings: {
      get: settingGet,
    },
    user: { isGM: true },
  });
  vi.stubGlobal("ui", { notifications: { info } });
});

describe("Foundry initiative documents", () => {
  it("loads safely in minimal harnesses without Combat documents", () => {
    vi.stubGlobal("Combat", undefined);
    vi.stubGlobal("Combatant", undefined);

    expect(() => registerD6CombatDocuments()).not.toThrow();
  });

  it("reads the independent First Edition initiative compatibility switch", () => {
    expect(usesFirstEditionInitiativeRolls()).toBe(true);
  });

  it("builds the tracker roll from the Actor's Perception score", () => {
    expect(
      initiativeFormulaForActor({
        system: {
          attributes: {
            agility: { score: 9 },
            perception: { score: 11 },
          },
        },
      }),
    ).toBe("2d6[Base]+1dw[Wild]+2+0.2");
  });

  it("registers a concrete formula and blocks native Second Edition tracker rolls", async () => {
    settingGet.mockReturnValue(false);
    registerD6CombatDocuments();
    const config = CONFIG as typeof CONFIG & {
      Combat: {
        documentClass: new () => {
          rollInitiative(ids: string): Promise<unknown>;
        };
        initiative: { decimals: number; formula: string };
      };
    };

    expect(config.Combat.initiative).toEqual({ decimals: 2, formula: "0" });
    const combat = new config.Combat.documentClass();
    await expect(combat.rollInitiative("combatant-1")).resolves.toBe(combat);
    expect(baseRollInitiative).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith("D6E2.Combat.Initiative.StandardNotice");
  });

  it("keeps the contextual comparator bound when Foundry passes it to Array.sort", () => {
    settingGet.mockReturnValue(false);
    registerD6CombatDocuments();
    const config = CONFIG as typeof CONFIG & {
      Combat: {
        documentClass: new () => {
          readonly combatants: {
            readonly contents: readonly {
              readonly id: string;
              readonly initiative?: number | null;
            }[];
          };
          _sortCombatants: (
            a: { readonly id: string; readonly initiative?: number | null },
            b: { readonly id: string; readonly initiative?: number | null },
          ) => number;
        };
      };
    };
    const combat = new config.Combat.documentClass();
    const compare = combat._sortCombatants;

    expect(
      [...combat.combatants.contents].sort(compare).map(({ id }) => id),
    ).toEqual(["combatant-1", "combatant-2"]);
  });

  it("delegates enabled First Edition rolls through the Perception formula", async () => {
    registerD6CombatDocuments();
    const config = CONFIG as typeof CONFIG & {
      Combat: {
        documentClass: new () => {
          rollInitiative(ids: string): Promise<unknown>;
        };
      };
      Combatant: {
        documentClass: new (actor: object) => {
          _getInitiativeFormula(): string;
        };
      };
    };

    const combat = new config.Combat.documentClass();
    await expect(combat.rollInitiative("combatant-1")).resolves.toBe("rolled");
    expect(baseRollInitiative).toHaveBeenCalledWith("combatant-1", {});
    const combatant = new config.Combatant.documentClass({
      system: {
        attributes: {
          agility: { score: 9 },
          perception: { score: 11 },
        },
      },
    });
    expect(combatant._getInitiativeFormula()).toBe("2d6[Base]+1dw[Wild]+2+0.2");
  });

  it("persists GM drag ordering without inventing initiative scores", async () => {
    const setFlag = vi.fn().mockResolvedValue(undefined);
    const setupTurns = vi.fn();
    const combat = {
      combatants: {
        contents: [{ id: "alpha" }, { id: "bravo" }, { id: "charlie" }],
      },
      getFlag: vi.fn().mockReturnValue(["bravo", "alpha"]),
      setFlag,
      setupTurns,
    };

    expect(manualInitiativeOrder(combat)).toEqual([
      "bravo",
      "alpha",
      "charlie",
    ]);
    expect(
      reorderedInitiativeIds(
        ["bravo", "alpha", "charlie"],
        "charlie",
        "bravo",
        false,
      ),
    ).toEqual(["charlie", "bravo", "alpha"]);
    await expect(
      moveCombatantInManualInitiative(combat, "charlie", "bravo", false),
    ).resolves.toEqual(["charlie", "bravo", "alpha"]);
    expect(setFlag).toHaveBeenCalledWith(
      "d6-system-2e",
      "manualInitiativeOrder",
      ["charlie", "bravo", "alpha"],
    );
    expect(setupTurns).toHaveBeenCalledOnce();
  });

  it("rejects manual ordering for players", async () => {
    vi.stubGlobal("game", {
      ...game,
      user: { isGM: false },
    });
    await expect(
      moveCombatantInManualInitiative(
        {
          combatants: { contents: [{ id: "alpha" }, { id: "bravo" }] },
          getFlag: () => undefined,
          setFlag: vi.fn(),
        },
        "alpha",
        "bravo",
        true,
      ),
    ).rejects.toThrow("D6E2.Combat.Error.ManualInitiativeRequiresGM");
  });

  it("routes a Narrative successor chosen by the current participant owner through the active GM", async () => {
    settingGet.mockImplementation((_namespace: string, key: string) =>
      key === "secondEditionInitiativeStrategy" ? "narrative" : false,
    );
    const emit = vi.fn();
    vi.stubGlobal("game", {
      i18n: { localize: (key: string) => key },
      settings: { get: settingGet },
      socket: { emit },
      user: { id: "player", isGM: false },
      users: { activeGM: { id: "gm" } },
    });
    const flags = new Map<string, unknown>([
      ["narrativeInitiativeSequence", ["alpha"]],
      ["manualInitiativeOrder", ["alpha", "bravo", "charlie"]],
    ]);
    const combat = {
      id: "combat",
      combatants: {
        contents: [
          { actor: { isOwner: true }, id: "alpha" },
          { actor: { isOwner: false }, id: "bravo" },
          { actor: { isOwner: false }, id: "charlie" },
        ],
      },
      getFlag: (_namespace: string, key: string) => flags.get(key),
      setFlag: vi.fn((_namespace: string, key: string, value: unknown) => {
        flags.set(key, value);
        return Promise.resolve(value);
      }),
      setupTurns: vi.fn(),
    };

    await expect(
      chooseNextNarrativeCombatant(combat, "charlie"),
    ).resolves.toEqual(["alpha", "charlie"]);
    expect(combat.setFlag).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith("system.d6-system-2e", {
      combatId: "combat",
      kind: "alternate-initiative-narrative-successor",
      targetId: "charlie",
      userId: "player",
    });
  });

  it("accepts a player initiative total only through GM ownership validation", async () => {
    settingGet.mockImplementation((_namespace: string, key: string) =>
      key === "secondEditionInitiativeStrategy" ? "basic" : false,
    );
    const update = vi.fn().mockResolvedValue(undefined);
    const actor = { testUserPermission: vi.fn().mockReturnValue(true) };
    const combat = {
      combatants: {
        contents: [{ actor, id: "alpha", initiative: null, update }],
      },
      getFlag: vi.fn(),
      setFlag: vi.fn().mockResolvedValue(undefined),
      setupTurns: vi.fn(),
    };
    let listener: ((value: unknown) => void) | undefined;
    vi.stubGlobal("game", {
      combats: { get: () => combat },
      i18n: { localize: (key: string) => key },
      settings: { get: settingGet },
      socket: {
        on: (_channel: string, callback: (value: unknown) => void) => {
          listener = callback;
        },
      },
      user: { isGM: true },
      users: { get: () => ({ id: "player" }) },
    });
    registerAlternateInitiativeSocket();
    listener?.({
      combatId: "combat",
      combatantId: "alpha",
      kind: "alternate-initiative-total",
      total: 14,
      userId: "player",
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(actor.testUserPermission).toHaveBeenCalledWith(
      { id: "player" },
      "OWNER",
    );
    expect(update).toHaveBeenCalledWith({ initiative: 14 });
  });

  it("accepts a player Narrative successor only through GM ownership validation", async () => {
    settingGet.mockImplementation((_namespace: string, key: string) =>
      key === "secondEditionInitiativeStrategy" ? "narrative" : false,
    );
    const currentActor = {
      testUserPermission: vi.fn().mockReturnValue(true),
    };
    const flags = new Map<string, unknown>([
      ["narrativeInitiativeSequence", ["alpha"]],
      ["manualInitiativeOrder", ["alpha", "bravo"]],
    ]);
    const combat = {
      combatants: {
        contents: [
          { actor: currentActor, id: "alpha" },
          { actor: {}, id: "bravo" },
        ],
      },
      getFlag: (_namespace: string, key: string) => flags.get(key),
      id: "combat",
      setFlag: vi.fn((_namespace: string, key: string, value: unknown) => {
        flags.set(key, value);
        return Promise.resolve(value);
      }),
      setupTurns: vi.fn(),
    };
    let listener: ((value: unknown) => void) | undefined;
    vi.stubGlobal("game", {
      combats: { get: () => combat },
      i18n: { localize: (key: string) => key },
      settings: { get: settingGet },
      socket: {
        on: (_channel: string, callback: (value: unknown) => void) => {
          listener = callback;
        },
      },
      user: { isGM: true },
      users: { get: () => ({ id: "player" }) },
    });
    registerAlternateInitiativeSocket();
    listener?.({
      combatId: "combat",
      kind: "alternate-initiative-narrative-successor",
      targetId: "bravo",
      userId: "player",
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(currentActor.testUserPermission).toHaveBeenCalledWith(
      { id: "player" },
      "OWNER",
    );
    expect(flags.get("narrativeInitiativeSequence")).toEqual([
      "alpha",
      "bravo",
    ]);
  });
});
