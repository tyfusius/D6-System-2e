import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  initiativeFormulaForActor,
  manualInitiativeOrder,
  moveCombatantInManualInitiative,
  registerD6CombatDocuments,
  reorderedInitiativeIds,
  usesFirstEditionInitiativeRolls,
} from "./combat-documents";

const baseRollInitiative = vi.fn().mockResolvedValue("rolled");
const info = vi.fn();
const settingGet = vi.fn(
  (_namespace: string, key: string) => key === "useFirstEditionInitiative",
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
    expect(info).toHaveBeenCalledWith(
      "D6E2.Combat.Initiative.ContextualNotice",
    );
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
});
