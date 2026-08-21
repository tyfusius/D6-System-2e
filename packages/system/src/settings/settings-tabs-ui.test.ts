import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../../../../", import.meta.url);

describe("edition settings tabs", () => {
  it("keeps every edition workspace in one accessible tabbed form", async () => {
    const template = await readFile(
      new URL("templates/settings/edition-settings.hbs", root),
      "utf8",
    );

    expect(template).toContain('role="tablist"');
    expect(template).toContain('role="tab"');
    expect(template).toContain('role="tabpanel"');
    expect(template).toContain('aria-selected="{{tab.active}}"');
    expect(template).toContain('tabindex="{{tab.tabIndex}}"');
    expect(template).toContain('data-settings-panel="profile"');
    expect(template).toContain('data-settings-panel="mechanics"');
    expect(template).toContain('data-settings-panel="difficulty"');
    expect(template).toContain('data-settings-panel="general"');
    expect(template).toContain('data-settings-panel="rules"');
    expect(template).toContain('data-settings-panel="modules"');
    expect(template).not.toContain('data-settings-panel="open-d6"');
    expect(template).toContain('data-settings-panel="homebrew"');
    expect(template).toContain('data-settings-panel="reference"');
    expect(template.indexOf('data-settings-panel="profile"')).toBeLessThan(
      template.indexOf('data-settings-panel="general"'),
    );
    expect(template.indexOf('data-settings-panel="homebrew"')).toBeLessThan(
      template.indexOf("d6e2-settings-footer"),
    );
  });

  it("keeps the complete Settings at a glance summary first in General", async () => {
    const [template, source] = await Promise.all([
      readFile(
        new URL("templates/settings/edition-settings.hbs", root),
        "utf8",
      ),
      readFile(
        new URL("packages/system/src/settings/settings-application.ts", root),
        "utf8",
      ),
    ]);

    const general = template.indexOf('data-settings-panel="general"');
    const summary = template.indexOf("d6e2-settings-general-primary");
    const assistance = template.indexOf("d6e2-settings-automation");
    expect(general).toBeGreaterThanOrEqual(0);
    expect(summary).toBeGreaterThan(general);
    expect(summary).toBeLessThan(assistance);
    expect(source).toMatch(
      /const settingsSummary:[\s\S]*?= settings\s*\.filter\(\(setting\) => setting\.inputType === "checkbox"\)/,
    );
  });

  it("supports roving keyboard focus and preserved active state", async () => {
    const source = await readFile(
      new URL("packages/system/src/settings/settings-application.ts", root),
      "utf8",
    );

    for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
      expect(source).toContain(`event.key === "${key}"`);
    }
    expect(source).toContain("#activeSettingsTab");
    expect(source).toContain('tab.setAttribute("aria-selected"');
    expect(source).toContain("panel.hidden = !active");
    expect(source).toContain('this.#activateSettingsTab("modules", false)');
  });

  it("uses the localized health-model label for the health strategy row", async () => {
    const [source, translations] = await Promise.all([
      readFile(
        new URL("packages/system/src/settings/settings-application.ts", root),
        "utf8",
      ),
      readFile(new URL("lang/en.json", root), "utf8"),
    ]);

    expect(source).toContain('health: "Health"');
    expect(source).not.toContain('health: "Damage"');
    expect(translations).toContain(
      '"D6E2.Settings.RulesProfile.Mechanic.Health.Label"',
    );
    expect(translations).toContain(
      '"D6E2.Settings.RulesProfile.Mechanic.Health.Help"',
    );
  });

  it("keeps navigation and actions fixed around a single scrolling panel", async () => {
    const css = await readFile(
      new URL("styles/d6-system-2e.css", root),
      "utf8",
    );

    expect(css).toContain("grid-template-columns: 220px minmax(0, 1fr)");
    expect(css).toContain("grid-template-rows: auto minmax(0, 1fr) auto");
    expect(css).toMatch(
      /\.d6e2-settings-panel\s*\{[^}]*grid-column: 2;[^}]*grid-row: 2;[^}]*grid-auto-rows: max-content;[^}]*height: 100%;[^}]*overflow-y: auto/s,
    );
    expect(css).toMatch(
      /\.d6e2-settings-footer\s*\{[^}]*grid-column: 1 \/ -1;[^}]*grid-row: 3;/s,
    );
    expect(css).toMatch(
      /\.application\.od6s-settings-v2 \.window-content\s*\{[^}]*min-height: 0;[^}]*overflow: hidden/s,
    );
    expect(css).toContain(".d6e2-settings-panel[hidden]");
  });
});
