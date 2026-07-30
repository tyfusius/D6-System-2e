import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Advanced Skill roll context", () => {
  it("exposes an explicit task-context selector and a structured chat audit", () => {
    const dialog = readFileSync(
      new URL("../../../../../templates/roll/dialog.hbs", import.meta.url),
      "utf8",
    );
    const chatCard = readFileSync(
      new URL("../../../../../templates/roll/chat-card.hbs", import.meta.url),
      "utf8",
    );

    expect(dialog).toContain('name="advancedSkillItemId"');
    expect(dialog).toContain("advancedSkillContextOptions");
    expect(dialog).toContain("selectedAdvancedSkillItemId");
    expect(dialog).toContain("D6E2.RulesReference");
    expect(chatCard).toContain("hasAdvancedSkillContext");
    expect(chatCard).toContain("advancedSkillContext.scoreLabel");
  });
});
