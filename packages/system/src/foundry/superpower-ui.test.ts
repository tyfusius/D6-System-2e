import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const sheet = readFileSync(
  new URL("./sheets/character-sheet.ts", import.meta.url),
  "utf8",
);
const template = readFileSync(
  new URL(
    "../../../../templates/actor/character/superheroic.hbs",
    import.meta.url,
  ),
  "utf8",
);

describe("Superpower character UI", () => {
  it("registers the Superheroic tab when Superpowers are the only active superheroic module", () => {
    expect(sheet).toContain(
      "currentSecondEditionCampaignProfile().superpowers",
    );
  });

  it("exposes budget, custom-content guidance, and declared reliance", () => {
    expect(template).toContain("superheroic.superpowers.budget");
    expect(template).toContain('data-action="relyOnSuperpower"');
    expect(template).toContain("D6E2.Superpowers.CustomBoundary");
  });
});
