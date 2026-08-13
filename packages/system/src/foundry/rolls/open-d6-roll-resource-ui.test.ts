import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dialog = readFileSync(
  new URL("../../../../../templates/roll/dialog.hbs", import.meta.url),
  "utf8",
);
const chat = readFileSync(
  new URL("../../../../../templates/roll/chat-card.hbs", import.meta.url),
  "utf8",
);
const service = readFileSync(
  new URL("./roll-service.ts", import.meta.url),
  "utf8",
);

describe("Open D6 roll-resource UI", () => {
  it("offers profile-gated bounded Character and Fate Point controls", () => {
    expect(dialog).toContain("{{#if showOpenD6CharacterPoints}}");
    expect(dialog).toContain('name="characterPointSpend"');
    expect(dialog).toContain('data-character-point-step="-1"');
    expect(dialog).toContain('data-character-point-step="1"');
    expect(dialog).toContain("{{#if showOpenD6FatePoint}}");
    expect(dialog).toContain('name="spendFatePoint"');
    expect(service).toContain("openD6CharacterPointSpendLimit");
    expect(service).toContain("transactOpenD6RollResources");
  });

  it("audits separate Character Point faces and Fate Point doubling", () => {
    expect(chat).toContain("{{#each characterPointFaces as |face|}}");
    expect(chat).toContain("{{#if characterPointsSpent}}");
    expect(chat).toContain("{{#if fatePointApplied}}");
    expect(service).toContain("result.characterPointFaces");
    expect(service).toContain("result.fatePointsSpent");
  });
});
