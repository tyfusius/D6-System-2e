import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sheet = readFileSync(
  new URL("./sheets/character-sheet.ts", import.meta.url),
  "utf8",
);
const template = readFileSync(
  new URL(
    "../../../../templates/actor/character/psionics.hbs",
    import.meta.url,
  ),
  "utf8",
);
const chat = readFileSync(
  new URL("../../../../templates/roll/chat-card.hbs", import.meta.url),
  "utf8",
);

describe("Psionics Foundry workflow", () => {
  it("provides a campaign-gated tab with protected training and power rolls", () => {
    expect(sheet).toContain("currentSecondEditionCampaignProfile().psionics");
    expect(sheet).toContain("game.system.api?.psionics.train");
    expect(sheet).toContain("game.system.api?.psionics.roll");
    expect(template).toContain('data-action="trainPsionics"');
    expect(template).toContain('data-action="rollPsionicPower"');
    expect(template).toContain("D6E2.Psionics.EmptyCatalog");
  });

  it("shows difficulty, attempt, and source audit on the roll card", () => {
    expect(chat).toContain("hasPsionicsContext");
    expect(chat).toContain("psionicsContext.recentAttempts");
    expect(chat).toContain("psionicsContext.scalingDifficulty");
    expect(chat).toContain("psionicsContext.sourcePage");
  });
});
