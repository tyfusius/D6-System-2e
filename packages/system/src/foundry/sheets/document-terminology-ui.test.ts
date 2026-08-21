import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("Setting Profile document terminology consumers", () => {
  const characterSheet = read("./character-sheet.ts");
  const machineSheet = read("./machine-sheet.ts");
  const itemSheet = read("./item-sheet.ts");
  const hideoutSheet = read("./hideout-sheet.ts");
  const characterCombat = read(
    "../../../../../templates/actor/character/combat.hbs",
  );
  const characterAttributes = read(
    "../../../../../templates/actor/character/attributes.hbs",
  );
  const machineCombat = read(
    "../../../../../templates/actor/machine/combat.hbs",
  );
  const machineCargo = read("../../../../../templates/actor/machine/cargo.hbs");
  const hideout = read("../../../../../templates/actor/hideout-sheet.hbs");
  const systemSettings = read("../../settings/system-settings.ts");

  it("projects actor names into character, machine, and Hideout headings", () => {
    expect(characterSheet).toContain("terminologyActorLabel(");
    expect(characterSheet).toContain('this.actor.type === "creature"');
    expect(machineSheet).toContain('starship ? "starship" : "vehicle"');
    expect(machineSheet).toContain("machineTypeLabel: terminologyActorLabel(");
    expect(hideoutSheet).toContain('"hideout",');
    expect(hideout).toContain("{{hideoutLabel}}");
  });

  it("projects Item names into creation, grouping, and Item-sheet identity", () => {
    expect(characterSheet).toContain("terminologyItemDocumentLabel(");
    expect(characterSheet).toContain('"plural",');
    expect(machineSheet).toContain("currentTerminology(),");
    expect(itemSheet).toContain("terminologyItemDocumentLabel(");
    expect(itemSheet).toContain('this.item.system.training === "advanced"');
  });

  it("updates Foundry's supported native creation and directory type labels", () => {
    expect(systemSettings).toContain("applyDocumentTypeTerminology();");
  });

  it("renders resolved labels instead of fixed Weapon, Armor, Gear, Skill, and Specialization headings", () => {
    expect(characterCombat).toContain("{{documentLabels.weapon}}");
    expect(characterCombat).toContain("{{documentLabels.armor}}");
    expect(characterAttributes).toContain("{{documentLabels.skills}}");
    expect(characterAttributes).toContain(
      'aria-label="{{documentLabels.specialization}}"',
    );
    expect(machineCombat).toContain("{{documentLabels.weapon}}");
    expect(machineCargo).toContain("{{documentLabels.gear}}");
    expect(machineCargo).toContain("{{documentLabels.armor}}");
  });
});
