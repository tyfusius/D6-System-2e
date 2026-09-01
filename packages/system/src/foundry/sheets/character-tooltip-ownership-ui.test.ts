import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const template = readFileSync(
  new URL(
    "../../../../../templates/actor/character/attributes.hbs",
    import.meta.url,
  ),
  "utf8",
);
const styles = readFileSync(
  new URL("../../../../../styles/d6-system-2e.css", import.meta.url),
  "utf8",
);
const characterSheet = readFileSync(
  new URL("./character-sheet.ts", import.meta.url),
  "utf8",
);

function blockBetween(start: string, end: string): string {
  const startIndex = template.indexOf(start);
  const endIndex = template.indexOf(end, startIndex);
  expect(startIndex, start).toBeGreaterThanOrEqual(0);
  expect(endIndex, end).toBeGreaterThan(startIndex);
  return template.slice(startIndex, endIndex);
}

describe("character tooltip ownership", () => {
  it("does not claim Foundry's shared tooltip geometry", () => {
    expect(styles).not.toMatch(/body\.system-d6-system-2e\s+#tooltip\s*\{/u);
    expect(styles).not.toMatch(
      /#tooltip\s*\{[^}]*(?:max-width|max-height|overflow)\s*:/su,
    );
  });

  it("anchors rated and unrated Attribute help to the compact semantic trigger", () => {
    const attribute = blockBetween(
      '<article\n            class="od6v2-attribute-card"',
      '<div class="od6v2-skill-list">',
    );
    const cardOpening = attribute.slice(0, attribute.indexOf(">") + 1);
    const rated = blockBetween(
      'data-action="rollAttribute"',
      "{{#if attribute.requestedRoll}}",
    );
    const unrated = blockBetween(
      'class="od6v2-roll is-unrated"',
      "{{/if}}\n              {{#if @root.freeEdit}}",
    );

    expect(cardOpening).not.toContain("data-tooltip");
    expect(rated).toContain('data-tooltip="{{attribute.tooltip}}"');
    expect(rated).toContain(
      "aria-label=\"{{localize\n                    'D6E2.Roll.Action'",
    );
    expect(unrated).toContain('data-tooltip="{{attribute.tooltip}}"');
    expect(unrated).toContain('role="group"');
    expect(unrated).toContain('tabindex="0"');
    expect(unrated).toMatch(
      /aria-label="\{\{attribute\.label\}\} \{\{attribute\.scoreLabel\}\} · \{\{localize\s+'D6E2\.Roll\.Unrated'\s+\}\}"/u,
    );
    expect(unrated).not.toContain("title=");
    expect(styles).toMatch(
      /\.od6v2-roll\.is-unrated:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--od6-focus, var\(--od6-accent-bright\)\);[^}]*outline-offset:\s*2px;/su,
    );
    expect(
      attribute.split('data-tooltip="{{attribute.tooltip}}"').length - 1,
    ).toBe(2);
  });

  it("keeps requested Attribute context visible without duplicating announcements", () => {
    const attribute = blockBetween(
      '<article\n            class="od6v2-attribute-card"',
      '<div class="od6v2-skill-list">',
    );

    expect(attribute).toContain(
      'data-requested-roll="{{attribute.requestedRoll}}"',
    );
    expect(attribute).toContain("D6E2.RequestRoll.Requested");
    expect(attribute.match(/class="od6-requested-roll-badge"/gu)).toHaveLength(
      1,
    );
  });

  it("binds keyboard tooltip lifecycle only in the Attribute sheet part", () => {
    expect(characterSheet).toContain(
      'if (partId === "attributes") {\n      bindCharacterAttributeKeyboardTooltips(',
    );
    expect(characterSheet).toContain(
      "(game as unknown as { tooltip: CharacterTooltipManager }).tooltip",
    );
  });

  it("leaves the established Skill tooltip trigger unchanged", () => {
    const skills = template.slice(
      template.indexOf('<div class="od6v2-skill-list">'),
    );
    expect(skills).toMatch(
      /class="od6v2-item-row is-\{\{skill\.training\}\}"[\s\S]*?data-tooltip="\{\{skill\.tooltip\}\}"[\s\S]*?data-action="rollSkill"/u,
    );
    expect(skills).not.toMatch(
      /data-action="rollSkill"[^>]*data-tooltip="\{\{skill\.tooltip\}\}"/u,
    );
  });
});
