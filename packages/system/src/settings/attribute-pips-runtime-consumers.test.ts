import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("Attribute and Pips runtime ownership", () => {
  it("keeps profile selection and module refinement at strategy boundaries", () => {
    const attributes = source("./attributes.ts");
    const pips = source("./pip-rules.ts");
    expect(attributes).not.toContain('"useFirstEditionAttributes"');
    expect(pips).not.toContain('"useFirstEditionPips"');
    expect(attributes).toContain(
      "currentConfiguredRulesProfile().strategies.attributes",
    );
    expect(pips).toContain("currentConfiguredRulesProfile().strategies.pips");
    expect(pips).toContain('"secondEditionPipsModule"');
  });

  it("prevents runtime consumers from dispatching on Attribute compatibility", () => {
    for (const path of [
      "../foundry/actor-item-drop-service.ts",
      "../foundry/bestiary-service.ts",
      "../foundry/character-creation-service.ts",
      "../foundry/read-models/actor.ts",
      "../foundry/rolls/roll-service.ts",
      "../foundry/sheets/character-sheet.ts",
      "../foundry/sheets/item-sheet.ts",
      "../foundry/skill-sync.ts",
      "../foundry/world-character-templates.ts",
    ]) {
      expect(source(path)).not.toContain(
        "compatibility.firstEditionAttributes",
      );
    }
  });

  it("prevents effective score consumers from reading edition Pips capabilities", () => {
    expect(source("./pip-rules.ts")).not.toContain(
      "currentEditionCapabilityProfile",
    );
    expect(source("../foundry/read-models/actor.ts")).toContain(
      "currentPipsRuntimeStrategy",
    );
    expect(source("../foundry/character-creation-service.ts")).toContain(
      "currentPipsEnabled",
    );
    expect(source("../foundry/sheets/character-sheet.ts")).toContain(
      'currentPipsRuntimeStrategy().id === "open-d6.pips.classic"',
    );
    expect(
      source("../../../../templates/actor/character/attributes.hbs"),
    ).toContain("{{localize @root.pipsStrategyLabel}}");
  });
});
