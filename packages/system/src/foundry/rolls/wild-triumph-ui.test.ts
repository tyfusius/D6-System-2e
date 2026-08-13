import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Wild Triumph reward presentation", () => {
  it("labels both chat rewards as granted by Wild Triumph", () => {
    const template = readFileSync("templates/roll/chat-card.hbs", "utf8");
    expect(template).toContain("wildTriumph.metaCurrencyAwardLabel");
    expect(template).toContain("wildTriumph.characterPointLabel");
    expect(
      template.match(/D6E2\.Roll\.WildTriumph\.RewardGranted/gu),
    ).toHaveLength(2);
  });

  it("projects active Setting Profile terminology into the reward audit", () => {
    const service = readFileSync(
      "packages/system/src/foundry/rolls/roll-service.ts",
      "utf8",
    );
    expect(service).toContain("terminology.resources.fatePoints");
    expect(service).toContain("terminology.resources.heroPoints");
    expect(service).toContain("terminology.resources.characterPoints");
  });
});
