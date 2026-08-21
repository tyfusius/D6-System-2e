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
const cargoTemplate = readFileSync(
  new URL("../../../../../templates/actor/machine/cargo.hbs", import.meta.url),
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
    expect(implementation).toContain("FocusedFieldRenderGuard");
    expect(implementation).toContain(
      "this.#focusedFieldRenderGuard.deferRenderWhileEditing()",
    );
    expect(implementation).toContain("form: applicationV2FormOptions({");
    expect(implementation).not.toContain("submitOnClose");
    expect(implementation).toContain(
      'element.addEventListener("change", this.#persistFieldChange)',
    );
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

  it("copies compatible machine equipment through the shared Actor drop route", () => {
    expect(implementation).toContain("actorItemDropData(event)");
    expect(implementation).toContain("itemFromDropData(data)");
    expect(implementation).toContain('Hooks.callAll?.("dropActorSheetData"');
    expect(implementation).toContain("previewActorItemDrop(this.actor, item)");
    expect(implementation).toContain("applyActorItemDrop(this.actor, item)");
    expect(implementation).toContain("void this.#dropItem(event)");
    expect(implementation).toContain('item.parent?.documentName === "Actor"');
    expect(implementation).toContain("transferActorItem(this.actor, item)");
    expect(implementation).toContain("sortActorItem(this.actor, item");
    expect(cargoTemplate).toContain('draggable="{{@root.editable}}"');
    expect(combatTemplate).toContain('draggable="{{@root.editable}}"');
  });

  it("lets an owner remove copied machine equipment with confirmation", () => {
    expect(implementation).toContain("static readonly #deleteItem");
    expect(implementation).toContain("confirmItemDeletion(item.name)");
    expect(implementation).toContain(
      'deleteEmbeddedDocuments("Item", [item.id])',
    );
    expect(implementation).toContain("deleteItem: this.#deleteItem");
    expect(cargoTemplate).toContain('data-action="deleteItem"');
    expect(cargoTemplate).toContain("{{#if @root.editable}}");
  });
});
