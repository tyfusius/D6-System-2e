import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("freeform magic Foundry workflow", () => {
  it("exposes a calculated Manifestation editor and owner casting action", () => {
    const template = readFileSync("templates/item/item-sheet.hbs", "utf8");
    const sheet = readFileSync(
      "packages/system/src/foundry/sheets/item-sheet.ts",
      "utf8",
    );
    const roll = readFileSync(
      "packages/system/src/foundry/rolls/roll-service.ts",
      "utf8",
    );
    expect(template).toContain('name="system.school"');
    expect(template).toContain('name="system.power"');
    expect(template).toContain("magic.difficulty.difficulty");
    expect(sheet).toContain("game.system.api?.magic.cast(actor, this.item.id)");
    expect(sheet).toContain('input.closest(".d6e2-magic-design")');
    expect(sheet).toContain("this.#persistMagicDesignChange");
    expect(sheet).toContain(
      'this.element.addEventListener("focusout", this.#persistMagicDesignChange)',
    );
    expect(sheet).not.toMatch(
      /"item-group",\s*"manifestation",\s*"specialability"/,
    );
    expect(roll).toContain(
      'if (actor.isOwner !== true) throw new Error("D6E2.Magic.OwnerRequired")',
    );
    expect(roll).toContain(
      "fixedDifficulty: difficulty.difficulty + untrainedPenalty",
    );
  });

  it("audits the cast without claiming to apply arbitrary spell effects", () => {
    const chat = readFileSync("templates/roll/chat-card.hbs", "utf8");
    expect(chat).toContain("hasMagicContext");
    expect(chat).toContain("magicContext.untrainedPenalty");
    expect(chat).not.toContain("applyMagicEffect");
  });
});
