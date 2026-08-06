import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { doublingDownNarrationResult } from "./chat-card-actions";

describe("roll chat-card follow-up actions", () => {
  it("renders mutually exclusive Hero Point and Doubling Down commands", () => {
    const template = readFileSync(
      new URL("../../../../../templates/roll/chat-card.hbs", import.meta.url),
      "utf8",
    );
    expect(template).toContain('data-action="heroPointReroll"');
    expect(template).toContain("showHeroPointReroll");
    expect(template).toContain("heroPointReroll");
    expect(template).toContain("D6E2.Roll.HeroPoint.RerollTradeoff");
    expect(template).toContain('data-action="doubleDown"');
    expect(template).toContain("showDoublingDown");
    expect(template).toContain("D6E2.Roll.DoublingDown.Tradeoff");
    expect(template).toContain("showRollFollowUps");
    expect(template).toContain("od6chat-follow-up-copy");
  });

  it("treats the DialogV2 cancel action as cancellation, not narration", () => {
    expect(doublingDownNarrationResult("cancel")).toBeNull();
    expect(doublingDownNarrationResult(null)).toBeNull();
    expect(
      doublingDownNarrationResult({ narration: "Try another route." }),
    ).toBe("Try another route.");
  });
});
