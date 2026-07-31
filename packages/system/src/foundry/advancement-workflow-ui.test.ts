import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const characterSheetSource = readFileSync(
  new URL("./sheets/character-sheet.ts", import.meta.url),
  "utf8",
);
const attributesTemplate = readFileSync(
  new URL(
    "../../../../templates/actor/character/attributes.hbs",
    import.meta.url,
  ),
  "utf8",
);
const systemStyles = readFileSync(
  new URL("../../../../styles/d6-system-2e.css", import.meta.url),
  "utf8",
);
const characterModelSource = readFileSync(
  new URL("./data-models/character.ts", import.meta.url),
  "utf8",
);

describe("Second Edition advancement workflow UI contract", () => {
  it("exposes complete Milestone award, spend, and Perk-exchange actions", () => {
    expect(attributesTemplate).toContain('data-action="awardMilestone"');
    expect(attributesTemplate).toContain('data-action="exchangeMilestonePerk"');
    expect(attributesTemplate).toContain("milestoneBalance.attributeDice");
    expect(attributesTemplate).toContain("milestoneBalance.skillPips");
    expect(characterSheetSource).toContain("await exchangeMilestoneForPerk(");
  });

  it("exposes the Narrative proposal, approval, steps, reward, and removal flow", () => {
    for (const action of [
      "proposeNarrativeArc",
      "approveNarrativeArc",
      "toggleNarrativeStep",
      "completeNarrativeArc",
      "removeNarrativeArc",
    ]) {
      expect(attributesTemplate).toContain(`data-action="${action}"`);
    }
    expect(characterSheetSource).toContain(
      "promptNarrativeArcDefinition(this.actor)",
    );
    expect(characterSheetSource).toContain(".split(/\\r?\\n/u)");
    expect(characterSheetSource).toContain('value: "perk:"');
    expect(characterSheetSource).toContain('arc.rewardKind === "perk"');
    expect(systemStyles).toContain(".od6v2-narrative-arc.is-completed");
    expect(characterModelSource).toContain(
      'choices: ["attribute", "perk", "skill"]',
    );
    expect(characterModelSource).toMatch(
      /targetScore: new NumberField\(\{[\s\S]*?min: 1,/u,
    );
  });
});
