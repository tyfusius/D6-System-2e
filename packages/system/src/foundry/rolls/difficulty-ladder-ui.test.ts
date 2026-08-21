import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { difficultyListboxPlacement } from "./difficulty-combobox";

const root = new URL("../../../../../", import.meta.url);
const template = readFileSync(
  new URL("templates/roll/dialog.hbs", root),
  "utf8",
);
const service = readFileSync(
  new URL("./roll-service.ts", import.meta.url),
  "utf8",
);
const combobox = readFileSync(
  new URL("./difficulty-combobox.ts", import.meta.url),
  "utf8",
);
const styles = readFileSync(new URL("styles/d6-system-2e.css", root), "utf8");

describe("Rules Profile difficulty suggestions", () => {
  it("uses an editable numeric combobox with a field-width single-line listbox", () => {
    expect(template).toContain('type="number"');
    expect(template).toContain('inputmode="numeric"');
    expect(template).toContain('autocomplete="off"');
    expect(template).toContain('role="combobox"');
    expect(template).toContain('aria-autocomplete="list"');
    expect(template).toContain('aria-expanded="false"');
    expect(template).toContain('role="listbox"');
    expect(template).toContain('role="option"');
    expect(template).toContain('data-difficulty-value="{{entry.value}}"');
    expect(template).toContain('aria-describedby="d6e2-difficulty-help"');
    expect(template).toContain("{{#if hasDifficultySuggestions}}");
    expect(template).not.toContain("<datalist");
    expect(styles).toMatch(
      /\.od6roll-difficulty-listbox\s*\{[^}]*right:\s*0;[^}]*left:\s*0;[^}]*width:\s*100%;/s,
    );
    expect(styles).toMatch(
      /\.od6roll-difficulty-option\s*\{[^}]*grid-template-columns:\s*3ch minmax\(0, 1fr\);[^}]*white-space:\s*nowrap;/s,
    );
    expect(styles).toMatch(
      /\.od6roll-difficulty-listbox\[data-difficulty-placement\]\s*\{[^}]*position:\s*fixed;[^}]*top:\s*var\(--d6e2-difficulty-listbox-top\);[^}]*left:\s*var\(--d6e2-difficulty-listbox-left\);[^}]*width:\s*var\(--d6e2-difficulty-listbox-width\);[^}]*min-width:\s*var\(--d6e2-difficulty-listbox-width\);[^}]*max-width:\s*var\(--d6e2-difficulty-listbox-width\);[^}]*max-height:\s*var\(--d6e2-difficulty-listbox-max-height\);/s,
    );
    expect(styles).toMatch(
      /\.od6roll-options:has\(\.od6roll-difficulty-combobox\)\s*\{[^}]*z-index:\s*5;/s,
    );
    expect(service).toContain(
      "currentConfiguredRulesProfile().difficultyLadder",
    );
    expect(service).toContain("bindDifficultySuggestionComboboxes(");
    expect(combobox).toContain(
      "export function bindDifficultySuggestionComboboxes(",
    );
    for (const key of [
      "ArrowDown",
      "ArrowUp",
      "Home",
      "End",
      "Enter",
      "Escape",
      "Tab",
    ]) {
      expect(combobox).toContain(`case "${key}"`);
    }
    expect(combobox).toContain("event.stopPropagation()");
    expect(combobox).toContain("synchronizeSelection();");
    expect(combobox).toContain('toggle.setAttribute("aria-expanded"');
    expect(combobox).toContain('root.addEventListener("focusout"');
    expect(combobox).toContain('listbox.setAttribute("popover", "manual")');
    expect(combobox).toContain("listbox.showPopover()");
    expect(combobox).toContain("const anchor = input.getBoundingClientRect();");
    expect(combobox).not.toContain(
      "const anchor = root.getBoundingClientRect();",
    );
    expect(combobox).toContain('root.closest<HTMLElement>(".application")');
    expect(combobox).toContain('document.addEventListener("scroll"');
    expect(combobox).toContain('document.removeEventListener("scroll"');
    expect(combobox).toContain("listbox.scrollTop = activeTop");
    expect(combobox).not.toContain("scrollIntoView");
  });

  it("shows all six suggestions when one side has room", () => {
    expect(
      difficultyListboxPlacement({
        anchor: { bottom: 144, left: 120, right: 320, top: 100, width: 200 },
        bounds: { bottom: 500, left: 80, right: 600, top: 40, width: 520 },
        optionCount: 6,
        optionHeight: 44,
        panelChromeHeight: 10,
      }),
    ).toEqual({
      left: 120,
      maxHeight: 274,
      placement: "below",
      top: 148,
      width: 200,
    });
  });

  it("keeps top-layer width owned by the rendered input instead of its application", () => {
    const field = {
      bottom: 144,
      left: 120,
      right: 320,
      top: 100,
      width: 200,
    };
    const application = {
      bottom: 500,
      left: 80,
      right: 680,
      top: 40,
      width: 600,
    };
    const placement = difficultyListboxPlacement({
      anchor: field,
      bounds: application,
      optionCount: 6,
      optionHeight: 44,
      panelChromeHeight: 10,
    });

    expect(placement.left).toBe(field.left);
    expect(placement.width).toBe(field.width);
    expect(placement.width).not.toBe(application.width);
    expect(styles).toMatch(
      /\.d6e2-force-difficulty-field\s+\.od6roll-difficulty-listbox:not\(\[data-difficulty-placement\]\)\s*\{[^}]*min-width:\s*0;/s,
    );
    expect(styles).not.toMatch(
      /\.d6e2-force-difficulty-field\s+\.od6roll-difficulty-listbox\s*\{/s,
    );
  });

  it("places above and preserves at least four visible rows when below is clipped", () => {
    expect(
      difficultyListboxPlacement({
        anchor: { bottom: 344, left: 120, right: 320, top: 300, width: 200 },
        bounds: { bottom: 390, left: 80, right: 600, top: 100, width: 520 },
        optionCount: 6,
        optionHeight: 44,
        panelChromeHeight: 10,
      }),
    ).toEqual({
      left: 120,
      maxHeight: 196,
      placement: "above",
      top: 100,
      width: 200,
    });
  });

  it("keeps target and fixed difficulties outside the suggestion control", () => {
    const editable = template.indexOf("{{else if showDifficultyControls}}");
    const combobox = template.indexOf('role="combobox"');
    expect(editable).toBeGreaterThan(
      template.indexOf("targetContext.hasTargets"),
    );
    expect(editable).toBeGreaterThan(template.indexOf("hasFixedDifficulty"));
    expect(combobox).toBeGreaterThan(editable);
  });
});
