import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rollService = readFileSync(
  new URL("./roll-service.ts", import.meta.url),
  "utf8",
);
const adapter = readFileSync(
  new URL("../distinction-automation-service.ts", import.meta.url),
  "utf8",
);
const dialogTemplate = readFileSync(
  new URL("../../../../../templates/roll/dialog.hbs", import.meta.url),
  "utf8",
);
const chatTemplate = readFileSync(
  new URL("../../../../../templates/roll/chat-card.hbs", import.meta.url),
  "utf8",
);

describe("Distinction ordinary-roll integration", () => {
  it("adds derived pip score before the unchanged numeric roll plan and snapshots evidence", () => {
    expect(rollService).toMatch(/distinctionRollModifier\(\s*actor,/u);
    expect(rollService).toContain("ownedDistinctionModifier.totalScore");
    expect(rollService).toContain("distinctionEffects: {");
    expect(rollService).toContain("effects: ownedDistinctionModifier.effects");
    expect(rollService).toContain("version: 1 as const");
    expect(rollService).toContain("actionEconomyRollPlan({");
    expect(rollService).toContain("executeD6Roll");
    expect(rollService).not.toContain(
      "resolvedFeatureBonusScore +\n        resolvedFeatureBonusScore",
    );
  });

  it("offers contextual Talent modifiers without selecting them or mutating the Actor", () => {
    expect(rollService).toContain("ownedDistinctionModifier.choices");
    expect(rollService).toContain("applyDistinctionRollChoices(");
    expect(rollService).toContain('input[name="distinctionEffectIds"]:checked');
    expect(dialogTemplate).toContain("hasDistinctionChoices");
    expect(dialogTemplate).toContain('name="distinctionEffectIds"');
    expect(dialogTemplate).toContain('data-score="{{choice.score}}"');
    expect(chatTemplate).toContain("{{effect.modeLabel}}");
    expect(rollService).toContain(
      "scoreLabel: distinctionModifierScoreLabel(effect.score)",
    );
    expect(adapter).not.toContain("actor.update(");
  });

  it("keeps the adapter derived, native-Item-only, and free of Actor writes", () => {
    expect(adapter).toContain('new Set(["flaw", "perk", "talent"])');
    expect(adapter).toContain('item.getFlag?.(SYSTEM_ID, "featureDefinition")');
    expect(adapter).toContain("resolveDistinctionRollEffects(sources, scope)");
    expect(adapter).not.toContain("actor.update(");
    expect(adapter).not.toContain("updateEmbeddedDocuments");
    expect(adapter).not.toContain("eval(");
    expect(adapter).not.toContain("new Function");
  });

  it("does not infer weapon attacks as Skill applications", () => {
    expect(rollService).not.toContain(
      'requestSource.kind === "weapon-attack") distinctionApplications.add("skill")',
    );
  });
});
