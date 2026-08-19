import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../../../../", import.meta.url);
const template = readFileSync(
  new URL("templates/roll/dialog.hbs", root),
  "utf8",
);
const service = readFileSync(
  new URL("./roll-service.ts", import.meta.url),
  "utf8",
);

describe("Rules Profile difficulty suggestions", () => {
  it("decorates only the ordinary editable numeric input with a native datalist", () => {
    expect(template).toContain('type="number"');
    expect(template).toContain('list="d6e2-difficulty-suggestions"');
    expect(template).toContain('inputmode="numeric"');
    expect(template).toContain('autocomplete="off"');
    expect(template).toContain('aria-describedby="d6e2-difficulty-help"');
    expect(template).toContain("{{#if hasDifficultySuggestions}}");
    expect(template).not.toContain('role="combobox"');
    expect(service).toContain(
      "currentConfiguredRulesProfile().difficultyLadder",
    );
  });

  it("keeps target and fixed difficulties outside the suggestion control", () => {
    const editable = template.indexOf("{{else if showDifficultyControls}}");
    const list = template.indexOf('list="d6e2-difficulty-suggestions"');
    expect(editable).toBeGreaterThan(
      template.indexOf("targetContext.hasTargets"),
    );
    expect(editable).toBeGreaterThan(template.indexOf("hasFixedDifficulty"));
    expect(list).toBeGreaterThan(editable);
  });
});
