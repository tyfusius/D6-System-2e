import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("character sheet workspace design", () => {
  const sheet = read("./character-sheet.ts");
  const navigation = read(
    "../../../../../templates/actor/character/navigation.hbs",
  );
  const biography = read(
    "../../../../../templates/actor/character/biography.hbs",
  );
  const combat = read("../../../../../templates/actor/character/combat.hbs");
  const powers = read(
    "../../../../../templates/actor/character/extraordinary-powers.hbs",
  );
  const controls = read(
    "../../../../../templates/actor/character/controls.hbs",
  );
  const styles = read("../../../../../styles/d6-system-2e.css");

  it("renders parent tabs first and only the active family's contextual subtabs", () => {
    expect(navigation).toContain('class="d6e2-parent-navigation"');
    expect(navigation).toContain('data-action="selectTabFamily"');
    expect(navigation).toContain("activeTabFamily.showChildNavigation");
    expect(navigation).toContain('class="tabs d6e2-child-navigation"');
    expect(navigation).toContain("activeTabFamily.tabs");
    expect(sheet).toContain('id: "character"');
    expect(sheet).toContain('id: "profile"');
    expect(sheet).toContain('id: "gear"');
    expect(sheet).toContain('id: "powers"');
    expect(sheet).toContain("showChildNavigation: familyTabs.length > 1");
    expect(sheet).toContain('definition.id === "powers"');
    expect(sheet).toContain("flattenedTab?.label ?? definition.label");
    expect(sheet).toContain("templates/actor/character/navigation.hbs");
  });

  it("distributes every visible root tab across the available width", () => {
    expect(styles).toMatch(
      /\.d6e2-parent-navigation\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;/su,
    );
    expect(styles).toMatch(/\.d6e2-parent-tab\s*\{[^}]*flex:\s*1 1 160px;/su);
    expect(styles).not.toMatch(
      /\.d6e2-parent-navigation\s*\{[^}]*grid-template-columns:\s*repeat\(4,/su,
    );
  });

  it("provides every od6s-next identity field in the Character Profile", () => {
    for (const field of [
      "age",
      "background",
      "gender",
      "height",
      "personality",
      "physicalDescription",
      "weight",
    ]) {
      expect(biography).toContain(`name="system.profile.${field}"`);
    }
    expect(biography).toContain('name="system.biography"');
  });

  it("keeps equipment state in Equipment rather than duplicating it in Combat", () => {
    expect(combat).not.toContain('data-action="toggleEquipped"');
    expect(combat).toContain("d6e2-combat-loadout-grid");
  });

  it("separates extraordinary Skill setup from power use with setting-aware labels", () => {
    expect(powers).toContain('data-power-workspace="skills"');
    expect(powers).toContain('data-power-workspace="powers"');
    expect(sheet).toContain("model.frameworks[0]?.label");
    expect(sheet).toContain("terminology.manifestations.plural");
    expect(sheet).toContain(
      "const extraordinaryPowers = extraordinaryPowerSheetModel(",
    );
    expect(sheet).toContain("extraordinaryPowers.frameworks.length > 0");
    expect(sheet).not.toContain(
      "systemApi().extraordinaryPowerFrameworkRegistry.current().length > 0",
    );
  });

  it("promotes Skill Tree through the module's public application API", () => {
    expect(controls).toContain('data-action="openSkillTree"');
    expect(sheet).toContain('foundryModule("skill-tree")');
    expect(sheet).toContain("api?.apps?.SkillTreeActor");
    expect(sheet).toContain("new SkillTreeActor(this.actor).render(true)");
  });
});
