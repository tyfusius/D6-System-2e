import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../../../../", import.meta.url);
const read = (path: string): string =>
  readFileSync(new URL(path, root), "utf8");

describe("matching reward quantity presentation", () => {
  it("keeps authored resource labels intact instead of guessing their grammar", () => {
    const language = read("lang/en.json");
    const template = read("templates/roll/chat-card.hbs");
    const terminology = read("packages/system/src/registries/terminology.ts");

    expect(language).toContain(
      '"D6E2.Settings.RulesProfile.Rewards.RowSentence": "When {label} is the best result: add {meta} to {metaLabel} and {cp} to {characterPointsLabel}."',
    );
    expect(language).toContain(
      '"D6E2.Settings.RulesProfile.Rewards.PreviewSentence": "When {label} is the best result: add {meta} to {metaLabel} and {cp} to {characterPointsLabel}."',
    );
    expect(template).toContain("matchingObservation.reward.metaCurrencyLabel");
    expect(template).toContain(
      "matchingObservation.reward.characterPointsLabel",
    );
    expect(terminology).not.toContain("terminologyQuantityLabel");
  });
});
