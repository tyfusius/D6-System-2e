import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Hero Point chat-card actions", () => {
  it("renders a semantic failed-roll reroll command", () => {
    const template = readFileSync(
      new URL("../../../../../templates/roll/chat-card.hbs", import.meta.url),
      "utf8",
    );
    expect(template).toContain('data-action="heroPointReroll"');
    expect(template).toContain("showHeroPointReroll");
    expect(template).toContain("heroPointReroll");
  });
});
