import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("roll chat-card follow-up actions", () => {
  it("renders mutually exclusive Hero Point and Doubling Down commands", () => {
    const template = readFileSync(
      new URL("../../../../../templates/roll/chat-card.hbs", import.meta.url),
      "utf8",
    );
    expect(template).toContain('data-action="heroPointReroll"');
    expect(template).toContain("showHeroPointReroll");
    expect(template).toContain("heroPointReroll");
    expect(template).toContain('data-action="doubleDown"');
    expect(template).toContain("showDoublingDown");
    expect(template).toContain("showRollFollowUps");
  });
});
