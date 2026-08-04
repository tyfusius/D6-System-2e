import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sheet = readFileSync(
  new URL("./character-sheet.ts", import.meta.url),
  "utf8",
);
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

describe("highlighted roll-request character sheet presentation", () => {
  it("projects pending Attribute and embedded Skill IDs into the sheet view", () => {
    expect(sheet).toContain("highlightedRollRequestForSubject(");
    expect(sheet).toContain("attributeId: id");
    expect(sheet).toContain('kind: "attribute"');
    expect(sheet).toContain('{ itemId: skill.id, kind: "skill" }');
    expect(template).toContain("attribute.requestedRoll");
    expect(template).toContain("skill.requestedRoll");
  });

  it("executes the pending request before falling back to an ordinary roll", () => {
    expect(sheet).toContain("await executeHighlightedRollRequest(this.actor");
    expect(sheet).toContain("await game.system.api?.roll.attribute");
    expect(sheet).toContain("await game.system.api?.roll.skill");
  });

  it("uses a visible, non-color-only requested marker", () => {
    expect(template).toContain("fa-highlighter");
    expect(template).toContain("D6E2.RequestRoll.Requested");
    expect(styles).toContain(
      '.od6v2-attribute-card[data-requested-roll="true"]',
    );
    expect(styles).toContain(".od6-requested-roll-badge");
  });
});
