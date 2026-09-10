import { beforeEach, describe, expect, it, vi } from "vitest";
let active = ["perception"];
vi.mock("../settings/attributes", () => ({
  currentAttributeRole: () => "perception",
  currentActiveAttributeDefinitions: () =>
    active.map((id) => ({ id, label: id })),
}));
vi.mock("../settings/initiative", () => ({
  currentInitiativeRuntimeStrategy: () => ({
    id: "open-d6.initiative.perception-reflexes",
  }),
}));
import {
  initiativeBaseBindingsForActor,
  initiativeFormulaForActor,
  registerD6CombatDocuments,
} from "./combat-documents";
beforeEach(() => {
  active = ["perception"];
});
describe("profile-activated initiative base bindings", () => {
  it("does not treat schema-default inactive Reflexes zero as a binding", () => {
    expect(
      initiativeBaseBindingsForActor({
        system: {
          attributes: {
            perception: { score: 10 },
            reflexes: { score: 0 },
            agility: { score: 15 },
          },
        },
      }),
    ).toEqual({ perception: 10 });
  });
  it("preserves full pips and a legitimate active zero without aliases", () => {
    active = ["perception", "reflexes"];
    expect(
      initiativeBaseBindingsForActor({
        system: {
          attributes: { perception: { score: 10 }, reflexes: { score: 0 } },
        },
      }),
    ).toEqual({ perception: 10, reflexes: 0 });
    expect(
      initiativeBaseBindingsForActor({
        system: {
          attributes: { perception: { score: 11 }, reflexes: { score: 14 } },
        },
      }),
    ).toEqual({ perception: 11, reflexes: 14 });
  });
  it("uses a plain Perception roll total without hidden fractional tie additions", () => {
    expect(
      initiativeFormulaForActor({
        system: {
          attributes: { perception: { score: 11 }, agility: { score: 15 } },
        },
      }),
    ).toBe("2d6[Base]+1dw[Wild]+2");
    active = ["agility"];
    expect(() =>
      initiativeFormulaForActor({
        system: { attributes: { perception: { score: 11 } } },
      }),
    ).toThrow("missingBaseAttributes");
  });
});

describe("native initiative sorting with incomplete tied subgroups", () => {
  it("retains an incomplete Reflexes subgroup transitively while resolving differing Perception", () => {
    active = ["perception", "reflexes"];
    const participant = (
      id: string,
      perception: number | undefined,
      reflexes?: number,
    ) => ({
      id,
      initiative: 12,
      actor: {
        system: {
          attributes: {
            ...(perception === undefined
              ? {}
              : { perception: { score: perception } }),
            ...(reflexes === undefined
              ? {}
              : { reflexes: { score: reflexes } }),
          },
        },
      },
    });
    const rows = [
      participant("B", 9, 3),
      participant("A", 9),
      participant("C", 9, 6),
      participant("P", 10),
    ];
    class BaseCombat {
      readonly combatants = { contents: rows };
    }
    class BaseCombatant {
      _getInitiativeFormula() {
        return "0";
      }
    }
    const config: {
      Combat: {
        documentClass?: new () => {
          _sortCombatants(
            a: (typeof rows)[number],
            b: (typeof rows)[number],
          ): number;
        };
      };
      Combatant: object;
    } = { Combat: {}, Combatant: {} };
    vi.stubGlobal("Combat", BaseCombat);
    vi.stubGlobal("Combatant", BaseCombatant);
    vi.stubGlobal("CONFIG", config);
    registerD6CombatDocuments();
    if (!config.Combat.documentClass) throw new Error("Missing combat class");
    const combat = new config.Combat.documentClass();
    expect(
      [...rows].sort((a, b) => combat._sortCombatants(a, b)).map((p) => p.id),
    ).toEqual(["P", "B", "A", "C"]);
    // Comparator is transitive for every triple, including the formerly cyclic trio.
    for (const a of rows)
      for (const b of rows)
        for (const c of rows) {
          if (
            combat._sortCombatants(a, b) <= 0 &&
            combat._sortCombatants(b, c) <= 0
          )
            expect(combat._sortCombatants(a, c)).toBeLessThanOrEqual(0);
        }
    rows.push(participant("missing-perception", undefined, 15));
    expect(
      [...rows].sort((a, b) => combat._sortCombatants(a, b)).map((p) => p.id),
    ).toEqual(["B", "A", "C", "P", "missing-perception"]);
  });
});
