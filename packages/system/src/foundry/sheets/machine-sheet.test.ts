import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const implementation = readFileSync(
  new URL("./machine-sheet.ts", import.meta.url),
  "utf8",
);
const registration = readFileSync(
  new URL("./register.ts", import.meta.url),
  "utf8",
);
const combatTemplate = readFileSync(
  new URL("../../../../../templates/actor/machine/combat.hbs", import.meta.url),
  "utf8",
);

describe("Second Edition machine Actor sheet contract", () => {
  it("registers one ApplicationV2 sheet for vehicle and starship Actors", () => {
    expect(registration).toContain("D6System2eMachineSheet");
    expect(registration).toContain('types: ["starship", "vehicle"]');
  });

  it("uses source-backed system, defense, resistance, and condition workflows", () => {
    expect(implementation).toContain(
      '["navicomp", "maneuverability", "engines", "hull"]',
    );
    expect(implementation).toContain("secondEditionStaticDefense(hullScore)");
    expect(implementation).toContain(
      "currentCombinedPipScore(hullScore, protectionScore)",
    );
    expect(implementation).toContain("game.system.api?.health.condition");
    expect(implementation).toContain("game.system.api?.roll.attribute");
    expect(implementation).toContain(
      'element.addEventListener("focusout", this.#persistNumericInput)',
    );
    expect(implementation).toContain("element instanceof HTMLElement");
  });

  it("uses assigned crew for mounted attack automation", () => {
    expect(combatTemplate).toContain('"D6E2.Machine.CrewAttackHelp"');
    expect(implementation).toContain('roll.item(this.actor, itemId, "attack")');
    expect(implementation).toContain('"system.crew.members"');
    expect(implementation).toContain("D6E2.Machine.RemoveCrewHelp");
  });

  it("offers only source-defined machine repair checks", () => {
    expect(implementation).toContain("secondEditionMachineRepairPlan");
    expect(implementation).toContain(
      "resolveMachineRepair(this.actor, repairer)",
    );
    expect(combatTemplate).toContain('data-action="repair"');
    expect(combatTemplate).toContain("combat.repair.difficulty");
    expect(combatTemplate).toContain("combat.repair.sourcePage");
  });
});
