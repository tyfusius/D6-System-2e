import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../../../../", import.meta.url);

describe("active health terminology consumers", () => {
  it("routes character and machine track presentation through resolved labels", () => {
    const character = readFileSync(
      new URL("./character-sheet.ts", import.meta.url),
      "utf8",
    );
    const machine = readFileSync(
      new URL("./machine-sheet.ts", import.meta.url),
      "utf8",
    );
    const characterTemplate = readFileSync(
      new URL("templates/actor/character/combat.hbs", root),
      "utf8",
    );
    const characterHeaderTemplate = readFileSync(
      new URL("templates/actor/character/header.hbs", root),
      "utf8",
    );
    const machineTemplate = readFileSync(
      new URL("templates/actor/machine/combat.hbs", root),
      "utf8",
    );
    expect(character).toContain("terminologyConditionLabel(");
    expect(character).toContain("terminologyHealthStateLabel(");
    expect(character).toContain("terminologyHealthTrackLabel(");
    expect(character).toContain("terminologyBodyPointLabel(");
    expect(machine).toContain("terminologyConditionLabel(terminology, value)");
    expect(characterTemplate).toContain("{{combat.conditionTrackLabel}}");
    expect(characterTemplate).toContain(
      'aria-describedby="{{condition.descriptionId}}"',
    );
    expect(characterTemplate).toContain(
      'data-tooltip="{{condition.description}}"',
    );
    expect(characterTemplate).toContain(
      'data-d6e2-health-description-id="{{condition.descriptionId}}"',
    );
    expect(characterTemplate).toContain(
      'aria-disabled="{{not @root.combat.conditionEditable}}"',
    );
    expect(characterTemplate).not.toContain(
      "{{disabled (not @root.combat.conditionEditable)}}",
    );
    expect(character).toMatch(
      /closest<HTMLElement>\("\[data-condition\]"\)[^]*getAttribute\("aria-disabled"\) === "true"/,
    );
    expect(character).toContain(
      'description: game.i18n.localize(state.description ?? "")',
    );
    expect(characterTemplate).toContain(
      "{{combat.firstEditionBodyPoints.currentLabel}}",
    );
    expect(characterTemplate).toContain(
      "{{combat.firstEditionBodyPoints.maximumLabel}}",
    );
    expect(characterHeaderTemplate).toContain(
      "<span>{{combat.conditionTrackLabel}}</span>",
    );
    expect(characterHeaderTemplate).not.toContain(
      '<span>{{localize "D6E2.ConditionLabel"}}</span>',
    );
    expect(machineTemplate).toContain("{{combat.conditionTrackLabel}}");
  });

  it("keeps the First Edition stable wound contract while making labels configurable", () => {
    const character = readFileSync(
      new URL("./character-sheet.ts", import.meta.url),
      "utf8",
    );
    const health = readFileSync(
      new URL("../../settings/health-model-library.ts", import.meta.url),
      "utf8",
    );
    expect(health).toContain("FIRST_EDITION_WOUND_LEVELS");
    expect(health).toContain("D6E2.Condition.${id");
    expect(character).toContain("healthStrategy.id");
    expect(character).not.toContain("localizedConditionLabel");
  });
});
