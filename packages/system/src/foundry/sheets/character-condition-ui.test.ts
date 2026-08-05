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
    expect(sheet).toContain('["psionics", "cyberpunk", "superheroic"]');
    expect(sheet).toContain("tabs[partId] !== undefined");
  });

  it("shows the rules-profile wound penalty beside each affected condition", () => {
    expect(sheet).toContain("firstEditionWoundPenaltyScore");
    expect(sheet).toContain("secondEditionConditionPenaltyScore");
    expect(sheet).toContain("penaltyLabel:");
    expect(combat).toContain("condition.penaltyLabel");
    expect(combat).toContain("d6e2-condition-penalty");
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
