import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sheet = readFileSync(
  new URL("./character-sheet.ts", import.meta.url),
  "utf8",
);
const combat = readFileSync(
  new URL(
    "../../../../../templates/actor/character/combat.hbs",
    import.meta.url,
  ),
  "utf8",
);
const header = readFileSync(
  new URL(
    "../../../../../templates/actor/character/header.hbs",
    import.meta.url,
  ),
  "utf8",
);

describe("character condition-track UI", () => {
  it("filters inactive optional parts on every full or partial render", () => {
    expect(sheet).toContain("override _configureRenderOptions");
    for (const optionalPart of [
      "psionics",
      "extraordinaryPowers",
      "cyberpunk",
      "superheroic",
    ]) {
      expect(sheet).toContain(`"${optionalPart}"`);
    }
    expect(sheet).toContain("tabs[partId] !== undefined");
  });

  it("shows the rules-profile wound penalty beside each affected condition", () => {
    expect(sheet).toContain("readActorHealth(this.actor)");
    expect(sheet).toContain("state.penaltyScore");
    expect(sheet).toContain("activeHealth.track?.currentState.penaltyScore");
    expect(sheet).toContain("penaltyLabel:");
    expect(combat).toContain("condition.penaltyLabel");
    expect(combat).toContain("d6e2-condition-penalty");
  });

  it("renders ordered custom states with explicit terminal and action badges", () => {
    expect(sheet).toContain("settingHealthStateLabel(");
    expect(sheet).toContain("settingHealthTrackLabel(");
    expect(sheet).toContain("actionsUnavailable: !state.allowsActions");
    expect(sheet).toContain("terminal: state.terminal");
    expect(combat).toContain("condition.actionsUnavailable");
    expect(combat).toContain("condition.terminal");
    expect(combat).toContain("D6E2.Health.ActionsUnavailable");
    expect(combat).toContain("D6E2.Health.Terminal");
  });

  it("delegates custom state controls from the ApplicationV2 combat part", () => {
    expect(combat).toContain('type="button"');
    expect(combat).toContain('data-action="setCondition"');
    expect(sheet).toContain("setCondition: this.#setCondition");
  });

  it("keeps the active general penalty and exceptional states in the header", () => {
    expect(sheet).toContain("activeDicePenaltyScore");
    expect(sheet).toContain("movementSkillPenaltyScore");
    expect(sheet).toContain("headerStatuses");
    expect(sheet).toContain('posture === "prone"');
    expect(header).toContain("combat.activeDicePenaltyLabel");
    expect(header).toContain("#if combat.activeDicePenaltyLabel");
    expect(header).toContain("combat.headerStatuses");
    expect(header).toContain("od6v2-active-statuses");
  });
});
