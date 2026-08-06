import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rollService = readFileSync(
  new URL("./roll-service.ts", import.meta.url),
  "utf8",
);
const itemModel = readFileSync(
  new URL("../data-models/item-types.ts", import.meta.url),
  "utf8",
);
const skillModel = readFileSync(
  new URL("../data-models/skill.ts", import.meta.url),
  "utf8",
);
const itemSheet = readFileSync(
  new URL("../sheets/item-sheet.ts", import.meta.url),
  "utf8",
);

describe("First Edition Adventure mystic workflow", () => {
  it("admits Adventure magic and Psionics manifestation data", () => {
    expect(itemModel).toContain('"first-edition-adventure"');
    expect(itemModel).toContain('choices: ["magic", "miracles", "psionics"]');
    for (const attributeId of ["coordination", "extranormal", "physique"]) {
      expect(skillModel).toContain(`"${attributeId}"`);
      expect(itemModel).toContain(`"${attributeId}"`);
    }
    expect(itemSheet).toContain('"psionics-telepathy"');
    expect(itemSheet).toContain('"psionics-astral-projection"');
    expect(itemSheet).toContain('"D6 Adventure, printed pp. 95–111"');
  });

  it("requires the Adventure profile and audits the +5 untrained rule", () => {
    expect(rollService).toContain(
      'currentFirstEditionGenreProfile().genreId !==\n      "open-d6-adventure-d6-system-2e"',
    );
    expect(rollService).toContain('sourceBook: "D6 Adventure"');
    expect(rollService).toContain('strategy: "first-edition-adventure"');
    expect(rollService).toContain("const untrainedPenalty = skill ? 0 : 5");
    expect(rollService).toContain(
      "fixedDifficulty: difficulty + untrainedPenalty",
    );
  });
});
