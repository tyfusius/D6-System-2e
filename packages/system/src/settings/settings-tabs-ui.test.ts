import { readdir, readFile } from "node:fs/promises";
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

  it("edits the portable d8 explosive deviation option beside home-brew rules", async () => {
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
    expect(template).toContain(
      'name="profile.homebrew.tyfusiusD8ExplosiveDeviation"',
    );
    expect(source).toContain("this.#rulesDraft.homebrew");
    expect(source).toContain("homebrew: this.#rulesDraft.homebrew");
  });

  it("adds matching observation only to the accepted Homebrew surface", async () => {
    const [template, translations] = await Promise.all([
      readFile(
        new URL("templates/settings/edition-settings.hbs", root),
        "utf8",
      ),
      readFile(new URL("lang/en.json", root), "utf8"),
    ]);

    const profile = template.indexOf('data-settings-panel="profile"');
    const mechanics = template.indexOf('data-settings-panel="mechanics"');
    const homebrew = template.indexOf('data-settings-panel="homebrew"');
    const matching = template.indexOf("data-matching-rewards");
    const footer = template.indexOf("d6e2-settings-footer");

    expect(profile).toBeGreaterThanOrEqual(0);
    expect(mechanics).toBeGreaterThan(profile);
    expect(homebrew).toBeGreaterThan(mechanics);
    expect(matching).toBeGreaterThan(homebrew);
    expect(matching).toBeLessThan(footer);
    expect(template.slice(profile, mechanics)).not.toContain("RollResolution");
    expect(template.slice(mechanics, homebrew)).not.toContain("RollResolution");
    expect(template).not.toContain('name="strategy.rollResolution"');
    expect(template).toContain(
      "D6E2.Settings.RulesProfile.Rewards.DetectionHeading",
    );
    expect(template).toContain('data-action="reviewCombinations"');
    expect(translations).toContain(
      '"D6E2.Settings.RulesProfile.Rewards.DetectionHeading": "Enable matching-combination detection"',
    );
    expect(translations).toContain(
      "Normal totals, Wild Die, difficulty, and opposition still resolve normally.",
    );
    expect(translations).not.toMatch(
      /"D6E2\.Settings\.RulesProfile\.Rewards\.(?:Help|EvaluatorUnavailable|UnavailableHelp)"[^\n]*(?:matching roll|Roll Resolution)/u,
    );
  });

  it("uses one scoped component grammar for additive matching rewards", async () => {
    const css = await readFile(
      new URL("styles/d6-system-2e.css", root),
      "utf8",
    );
    const matchingRule =
      /body\.system-d6-system-2e\s+\.d6e2-settings-v2\s+\.d6e2-matching-rewards\s*\{(?<declarations>[^}]*)\}/su.exec(
        css,
      )?.groups?.declarations;
    const rewardRowRule =
      /body\.system-d6-system-2e\s+\.d6e2-settings-v2\s+\.d6e2-reward-row\s*\{(?<declarations>[^}]*)\}/su.exec(
        css,
      )?.groups?.declarations;

    expect(css).not.toMatch(
      /d6e2-(?:reward-master|reward-off-summary|reward-preview)/u,
    );
    expect(matchingRule).toContain("container-type: inline-size");
    expect(matchingRule).not.toContain("border-block-start");
    expect(matchingRule).not.toContain("padding-block-start");
    expect(rewardRowRule).not.toContain("border-block-start");
    expect(css).toMatch(
      /\.d6e2-matching-rewards\s+button\s*\{[^}]*min-block-size:\s*44px;/su,
    );
    expect(css).toMatch(
      /\.d6e2-reward-list\s*\{[^}]*border-block-start:\s*1px solid var\(--od6-line\);/su,
    );
    expect(css).toMatch(
      /\.d6e2-reward-list\s*>\s*\.d6e2-reward-row\s*\+\s*\.d6e2-reward-row\s*\{[^}]*border-block-start:\s*1px solid var\(--od6-line\);/su,
    );
    expect(css).toMatch(
      /\.d6e2-reward-enabled\s*\{[^}]*min-block-size:\s*44px;/su,
    );
  });

  it("confirms the Hideout dependency inside the accepted atomic save flow", async () => {
    const [source, css, translations] = await Promise.all([
      readFile(
        new URL("packages/system/src/settings/settings-application.ts", root),
        "utf8",
      ),
      readFile(new URL("styles/d6-system-2e.css", root), "utf8"),
      readFile(new URL("lang/en.json", root), "utf8"),
    ]);

    const dependency = source.indexOf("resolveHideoutSettingsDependency(");
    const persistence = source.indexOf("await persistSystemSettingsSave(");
    expect(dependency).toBeGreaterThanOrEqual(0);
    expect(dependency).toBeLessThan(persistence);
    expect(source).toContain("DialogV2.wait<boolean | null>");
    expect(source).toContain("HIDEOUT_PIPS_PREREQUISITE_SETTING_KEY");
    expect(source).toContain("pipsDependencySatisfied(");
    expect(source).toContain("position: { width: 520 }");
    expect(source).toContain("rejectClose: false");
    expect(source).toContain("?.focus({ preventScroll: true })");
    expect(translations).toContain(
      '"D6E2.Hideout.Dependency.EnableBoth": "Enable required settings"',
    );
    expect(translations).toContain(
      '"D6E2.Hideout.Dependency.DisableBoth": "Disable dependent settings"',
    );
    expect(translations).toContain(
      "Perks, Flaws & Talents, which requires an active Pips strategy",
    );
    expect(css).toMatch(
      /\.application\.d6e2-confirm-dialog\s+\.form-footer\s+button\s*\{[^}]*min-height: 44px/s,
    );
  });

  it("keeps navigation and actions fixed around a single scrolling panel", async () => {
    const [css, source] = await Promise.all([
      readFile(new URL("styles/d6-system-2e.css", root), "utf8"),
      readFile(
        new URL("packages/system/src/settings/settings-application.ts", root),
        "utf8",
      ),
    ]);
    const windowRule =
      /\.application\.d6e2-settings-v2\s*\{(?<declarations>[^}]*)\}/u.exec(css)
        ?.groups?.declarations;

    expect(source).toContain("height: 800");
    expect(source).toContain("width: 1100");
    expect(source).toContain("resizable: true");
    expect(source).not.toMatch(/game\.settings\.(?:get|set)[^]*geometry/iu);
    expect(windowRule).toContain("min-width: min(520px, calc(100vw - 32px))");
    expect(windowRule).toContain("max-width: calc(100vw - 32px)");
    expect(windowRule).toContain("min-height: min(480px, calc(100vh - 48px))");
    expect(windowRule).toContain("max-height: calc(100vh - 48px)");
    expect(windowRule).not.toContain("!important");
    expect(css).toContain("grid-template-columns: 220px minmax(0, 1fr)");
    expect(css).toContain("grid-template-rows: auto minmax(0, 1fr) auto");
    expect(css).toMatch(
      /\.d6e2-settings-shell\s*\{[^}]*height: 100%;[^}]*min-height: 0;[^}]*overflow: hidden/s,
    );
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
    expect(css).toMatch(
      /@container d6e2-settings \(max-width: 620px\)\s*\{[^]*?\.d6e2-settings-shell\s*\{[^}]*padding: 12px/s,
    );
    expect(css).not.toMatch(
      /\.d6e2-settings-shell\s*\{[^}]*(?:height|min-height): min\([^}]*vh/s,
    );
  });

  it("keeps inline resize geometry authoritative for every Settings-owned resizable ApplicationV2", async () => {
    const settingsDirectory = new URL("./", import.meta.url);
    const css = await readFile(
      new URL("styles/d6-system-2e.css", root),
      "utf8",
    );
    const applications: { className: string; file: string }[] = [];

    for (const file of await readdir(settingsDirectory)) {
      if (!file.endsWith("-application.ts")) continue;
      const source = await readFile(new URL(file, settingsDirectory), "utf8");
      if (!source.includes("resizable: true")) continue;
      const options =
        /static override DEFAULT_OPTIONS = \{(?<body>[^]*?)\n {2}\};/u.exec(
          source,
        )?.groups?.body;
      const classes = options
        ? /classes:\s*\[(?<values>[^\]]*)\]/u.exec(options)?.groups?.values
        : undefined;
      const className = classes
        ? [...classes.matchAll(/"(?<name>d6e2-[^"]+)"/gu)]
            .map(({ groups }) => groups?.name)
            .find((name) => name && name !== "d6e2")
        : undefined;
      expect(
        className,
        `${file} needs one specific D6 root class`,
      ).toBeTruthy();
      applications.push({ className: className ?? "", file });
    }

    expect(
      applications.toSorted(({ className: a }, { className: b }) =>
        a.localeCompare(b),
      ),
    ).toEqual([
      {
        className: "d6e2-font-library",
        file: "setting-profile-font-library-application.ts",
      },
      {
        className: "d6e2-health-model-builder",
        file: "health-model-application.ts",
      },
      {
        className: "d6e2-health-model-library",
        file: "health-model-library-application.ts",
      },
      {
        className: "d6e2-matching-evaluator",
        file: "matching-evaluator-application.ts",
      },
      {
        className: "d6e2-rules-profile",
        file: "rules-profile-application.ts",
      },
      {
        className: "d6e2-setting-profile",
        file: "setting-profile-application.ts",
      },
      {
        className: "d6e2-settings-v2",
        file: "settings-application.ts",
      },
    ]);

    for (const { className, file } of applications) {
      const rootRules = [
        ...css.matchAll(
          new RegExp(
            `\\.application\\.${className}\\s*\\{(?<declarations>[^}]*)\\}`,
            "gu",
          ),
        ),
      ];
      for (const { groups } of rootRules) {
        expect(
          groups?.declarations,
          `${file} must not override Foundry's inline resize geometry`,
        ).not.toMatch(/\b(?:width|height)\s*:[^;]*!important/iu);
      }
    }
  });
});
