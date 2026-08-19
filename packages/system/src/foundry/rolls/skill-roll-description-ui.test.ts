import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dialog = readFileSync(
  new URL("../../../../../templates/roll/dialog.hbs", import.meta.url),
  "utf8",
);
const service = readFileSync(
  new URL("./roll-service.ts", import.meta.url),
  "utf8",
);

describe("Skill roll description UI", () => {
  it("passes the exact source Item description into every Skill roll dialog", () => {
    expect(service).toContain(
      'actor.items.get(requestSource.source.itemId ?? "")?.system.description',
    );
    expect(service).toMatch(
      /itemDescriptionExcerpt\(\s*candidate\.system\.description,\s*520,?\s*\)/u,
    );
    expect(dialog).toContain("data-roll-description");
    expect(dialog).toContain("{{rollDescription}}");
  });

  it("switches to an Advanced Skill's own description with its task context", () => {
    expect(dialog).toContain('name="advancedSkillItemId"');
    expect(dialog).toContain('data-description="{{advanced.description}}"');
    expect(service).toContain(
      "advancedSelect.selectedOptions[0].dataset.description",
    );
    expect(service).toContain('select[name="advancedSkillItemId"]');
  });
});
