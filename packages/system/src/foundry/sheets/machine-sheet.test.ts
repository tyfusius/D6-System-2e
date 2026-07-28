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
  });

  it("does not invent crew attack automation", () => {
    expect(combatTemplate).toContain('"D6E2.Machine.CrewAttackHelp"');
    expect(implementation).not.toContain(
      'roll.item(this.actor, itemId, "attack")',
    );
  });
});
