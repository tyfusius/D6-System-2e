import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const header = read("../../../../../templates/actor/character/header.hbs");
const attributes = read(
  "../../../../../templates/actor/character/attributes.hbs",
);
const combat = read("../../../../../templates/actor/character/combat.hbs");
const itemSheet = read("../../../../../templates/item/item-sheet.hbs");
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

  it("keeps short Condition labels whole while allowing long localized labels to wrap", () => {
    expect(header).toContain('class="od6v2-condition-value"');
    expect(styles).toMatch(
      /\.od6v2-condition-value > strong\s*\{[^}]*overflow-wrap:\s*break-word;[^}]*word-break:\s*normal;[^}]*hyphens:\s*auto;/s,
    );
    expect(styles).not.toMatch(
      /\.od6v2-condition-value > strong\s*\{[^}]*overflow-wrap:\s*anywhere;/s,
    );
    expect(styles).toMatch(
      /\.od6v2-wound-summary-main\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto;/s,
    );
  });

  it("uses the compact shared heading scale for Character Attributes", () => {
    expect(attributes).toContain('class="od6v2-attribute-heading"');
    expect(styles).toMatch(
      /\.od6v2-attribute-card\s*\{[^}]*--od6-attribute-label-size:\s*0\.875rem;/s,
    );
    expect(styles).toMatch(
      /\.od6v2-roll span\s*\{[^}]*font-size:\s*var\(--od6-attribute-label-size\);[^}]*line-height:\s*1\.15;/s,
    );
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

  it("keeps weapon Edit and Delete in one right-aligned action group", () => {
    const weaponSectionStart = combat.indexOf(
      '<div class="od6v2-loadout-grid d6e2-combat-loadout-grid">',
    );
    const weaponSection = combat.slice(
      weaponSectionStart,
      combat.indexOf('{{localize "D6E2.Item.Armor"}}', weaponSectionStart),
    );
    const actionGroupMatch =
      /<div\s+class="d6e2-combat-item-actions"[\s\S]*?<\/div>/u.exec(
        weaponSection,
      );
    const actionGroup = actionGroupMatch?.[0] ?? "";

    expect(actionGroupMatch).not.toBeNull();
    expect(actionGroup).toContain('role="group"');
    expect(actionGroup).toContain('data-action="editItem"');
    expect(actionGroup).toContain("{{#if @root.freeEdit}}");
    expect(actionGroup).toContain('data-action="deleteItem"');
    expect(actionGroup.indexOf('data-action="editItem"')).toBeLessThan(
      actionGroup.indexOf('data-action="deleteItem"'),
    );
    expect(styles).toMatch(
      /\.d6e2-combat-item-actions\s*\{[^}]*display: inline-flex;[^}]*flex-wrap: nowrap;[^}]*justify-self: end;/s,
    );
    expect(styles).toContain("@container d6e2-sheet (max-width: 760px)");
    expect(styles).toMatch(
      /\.d6e2-combat-item-actions > \.od6v2-icon-button\s*\{[^}]*flex: 0 0 36px;[^}]*width: 36px;[^}]*min-height: 36px !important;/s,
    );
    expect(styles).toMatch(
      /:is\(\.d6e2-combat-loadout-grid,[^}]*\)\s*\{[^}]*grid-template-columns: 1fr;/s,
    );
  });

  it("pairs roll resources at normal widths and stacks them below 520px", () => {
    const characterPointsStart = rollDialog.indexOf(
      "{{#if showOpenD6CharacterPoints}}",
    );
    const fatePointStart = rollDialog.indexOf("{{#if showOpenD6FatePoint}}");
    const optionsStart = rollDialog.indexOf(
      '<div class="od6roll-options od6roll-primary-options">',
    );
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

  it("keeps Item-sheet actions reachable through one reusable scroll-plane component", () => {
    expect(
      itemSheet.match(/class="od6item-panel[^"]*has-sheet-actions/g),
    ).toHaveLength(2);
    expect(
      itemSheet.match(/class="d6e2-sheet__footer od6v2-sheet-actions"/g),
    ).toHaveLength(2);
    expect(styles).toMatch(
      /\.od6item-panel\s*\{[^}]*min-height:\s*0;[^}]*overflow:\s*hidden auto;[^}]*scrollbar-gutter:\s*stable;/s,
    );
    expect(styles).toMatch(
      /\.od6item-panel\.has-sheet-actions\s*\{[^}]*overflow:\s*hidden auto;[^}]*overscroll-behavior:\s*contain;/s,
    );
    expect(styles).toMatch(
      /\.od6v2-sheet-actions\s*\{[^}]*position:\s*sticky;[^}]*bottom:\s*0;[^}]*padding:\s*var\(--od6-space-2\) var\(--od6-space-3\)[^}]*padding-bottom:\s*max\(var\(--od6-space-2\),\s*env\(safe-area-inset-bottom\)\);/s,
    );
  });
});
