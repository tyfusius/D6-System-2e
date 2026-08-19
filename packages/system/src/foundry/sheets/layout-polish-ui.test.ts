import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const header = read("../../../../../templates/actor/character/header.hbs");
const combat = read("../../../../../templates/actor/character/combat.hbs");
const rollDialog = read("../../../../../templates/roll/dialog.hbs");
const styles = read("../../../../../styles/d6-system-2e.css");

describe("sheet and roll-dialog layout polish", () => {
  it("keeps currency actions and Condition in one bounded responsive status row", () => {
    expect(header).toContain('<div class="od6v2-status-row">');
    expect(header.indexOf('data-action="spendCurrency"')).toBeLessThan(
      header.indexOf('class="od6v2-wound-summary'),
    );
    expect(styles).toContain(
      "grid-template-columns: minmax(150px, 0.9fr) minmax(0, 1.1fr);",
    );
    expect(styles).toContain(
      ".od6v2-status-row > .od6v2-wound-summary:only-child",
    );
    expect(styles).toContain("@container d6e2-sheet (max-width: 780px)");
    expect(styles).toContain("grid-template-columns: 96px minmax(0, 1fr);");
  });

  it("gives weapon Attack and Damage controls an intentional vertical rhythm", () => {
    expect(combat).toContain('data-action="rollCombatItem"');
    expect(combat).toContain('data-action="rollCombatItemDamage"');
    expect(styles).toContain(
      '.od6v2-loadout:has(> [data-action="rollCombatItemDamage"])',
    );
    expect(styles).toContain("min-height: 64px;");
    expect(styles).toContain("min-height: 44px;");
    expect(styles).toContain("padding-block: 5px;");
    expect(styles).toContain("line-height: 1.2;");
  });

  it("pairs roll resources at normal widths and stacks them below 520px", () => {
    const characterPointsStart = rollDialog.indexOf(
      "{{#if showOpenD6CharacterPoints}}",
    );
    const fatePointStart = rollDialog.indexOf("{{#if showOpenD6FatePoint}}");
    const optionsStart = rollDialog.indexOf('<div class="od6roll-options">');
    expect(characterPointsStart).toBeGreaterThanOrEqual(0);
    expect(fatePointStart).toBeGreaterThan(characterPointsStart);
    expect(optionsStart).toBeGreaterThan(fatePointStart);
    expect(rollDialog.match(/class="od6roll-pool-resources"/g)).toHaveLength(5);
    expect(styles).toContain(".od6roll-shell {");
    expect(styles).toContain(
      "grid-template-columns: repeat(2, minmax(0, 1fr));",
    );
    expect(styles).toContain(".od6roll-shell > :not(.od6roll-pool-resources)");
    expect(styles).toContain(".od6roll-pool-resources {");
    expect(styles).toContain("@media (max-width: 520px)");
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr);");
  });
});
