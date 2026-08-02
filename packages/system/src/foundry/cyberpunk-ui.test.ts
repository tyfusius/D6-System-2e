import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sheet = readFileSync(
  new URL("./sheets/character-sheet.ts", import.meta.url),
  "utf8",
);
const characterTemplate = readFileSync(
  new URL(
    "../../../../templates/actor/character/cyberpunk.hbs",
    import.meta.url,
  ),
  "utf8",
);
const itemTemplate = readFileSync(
  new URL("../../../../templates/item/item-sheet.hbs", import.meta.url),
  "utf8",
);
const itemSheet = readFileSync(
  new URL("./sheets/item-sheet.ts", import.meta.url),
  "utf8",
);

describe("Cyberpunk sheet integration", () => {
  it("binds hack, harden, and installation commands", () => {
    expect(sheet).toContain("hackCyberpunkTarget: this.#hackCyberpunkTarget");
    expect(sheet).toContain("hardenFirewall: this.#hardenFirewall");
    expect(sheet).toContain("installCybernetic: this.#installCybernetic");
  });

  it("renders the source-backed character guidance and persistent states", () => {
    expect(characterTemplate).toContain('data-tab="cyberpunk"');
    expect(characterTemplate).toContain('data-action="hackCyberpunkTarget"');
    expect(characterTemplate).toContain('data-action="hardenFirewall"');
    expect(characterTemplate).toContain('data-action="installCybernetic"');
    expect(characterTemplate).toContain("pp. 191–195");
  });

  it("keeps the Cybernetic Item linked to a Talent", () => {
    expect(itemTemplate).toContain('name="system.augmentationKind"');
    expect(itemTemplate).toContain('name="system.linkedTalentId"');
    expect(itemTemplate).toContain('name="system.rank"');
    expect(itemSheet).toContain("#persistEquipmentChange");
    expect(itemSheet).toContain('"cybernetic"');
  });
});
