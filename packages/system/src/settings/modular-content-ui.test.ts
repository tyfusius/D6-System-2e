import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const application = readFileSync(
  new URL("./settings-application.ts", import.meta.url),
  "utf8",
);
const template = readFileSync(
  new URL(
    "../../../../templates/settings/edition-settings.hbs",
    import.meta.url,
  ),
  "utf8",
);

describe("modular content settings acceptance", () => {
  it("shows the same active-content and rules-selection contract in either edition workspace", () => {
    expect(application).toContain("contentSelection: {");
    expect(template).toContain("{{#if contentSelection}}");
    expect(template).not.toContain("secondEditionContent");
  });

  it("lets a Second Edition-primary world select explicit Open D6 substitutions", () => {
    expect(application).toContain("bundledRulesStrategyChoices");
    expect(application).toContain("saveWorldRulesProfile");
    expect(application).toContain("selectRulesProfile(saved.id)");
    expect(application).toContain('constructor.category === "second-edition"');
    expect(template).toContain('data-settings-panel="mechanics"');
    expect(template).toContain('name="strategy.{{mechanic.slot}}"');
  });

  it("places cross-family strategy choices in Mechanics before optional modules", () => {
    const mechanics = template.indexOf('data-settings-panel="mechanics"');
    const modules = template.indexOf('data-settings-panel="modules"');

    expect(mechanics).toBeGreaterThanOrEqual(0);
    expect(mechanics).toBeLessThan(modules);
  });

  it("projects every Second Edition homebrew option with its own explanation", () => {
    expect(application).toContain(
      "homebrewCombinedActions:\n      definition.key ===\n      TYFUSIUS_HOMEBREW_SETTING_KEYS.secondEditionCombinedActions",
    );
    expect(application).toContain(
      'constructor.category === "second-edition"\n          ? homebrewSettings.filter(',
    );
    expect(template).toContain("setting.homebrewCombinedActions");
    expect(template).toContain(
      "D6E2.Settings.TyfusiusHomebrew.CombinedActions.Explanation",
    );
    expect(template).toContain(
      "D6E2.Settings.TyfusiusHomebrew.WildTriumph.Explanation",
    );
  });
});
