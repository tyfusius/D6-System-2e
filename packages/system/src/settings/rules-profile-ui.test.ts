import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../../../", import.meta.url);
const template = readFileSync(
  new URL("templates/settings/rules-profile.hbs", root),
  "utf8",
);
const editionTemplate = readFileSync(
  new URL("templates/settings/edition-settings.hbs", root),
  "utf8",
);
const styles = readFileSync(new URL("styles/d6-system-2e.css", root), "utf8");
const catalog = readFileSync(
  new URL("./settings-catalog.ts", import.meta.url),
  "utf8",
);
const settingsApplication = readFileSync(
  new URL("./settings-application.ts", import.meta.url),
  "utf8",
);
const rulesProfileApplication = readFileSync(
  new URL("./rules-profile-application.ts", import.meta.url),
  "utf8",
);
const gameSettingsRoot = readFileSync(
  new URL("./game-settings-root.ts", import.meta.url),
  "utf8",
);

describe("Rules Profile and dependency UI", () => {
  it("uses tabs and a constrained scrolling panel at small viewport heights", () => {
    expect(template).toContain('data-rules-profile-tab="identity"');
    expect(template).toContain('data-rules-profile-tab="mechanics"');
    expect(template).toContain('data-rules-profile-tab="difficulty"');
    expect(template).not.toContain('data-rules-profile-tab="terminology"');
    expect(rulesProfileApplication).not.toContain("terminologyGroups");
    expect(styles).toMatch(
      /\.d6e2-rules-profile-shell\s*\{[^}]*grid-template-rows: auto auto minmax\(0, 1fr\) auto;[^}]*height: 100%;[^}]*min-height: 0/s,
    );
    expect(styles).toMatch(
      /\.application\.d6e2-rules-profile \.window-content\s*\{[^}]*min-height: 0;[^}]*overflow: hidden/s,
    );
    for (const icon of ["fa-signature", "fa-gears", "fa-stairs"]) {
      expect(template).toMatch(
        new RegExp(
          `d6e2-setting-profile-tab-icon[^]*${icon}[^]*d6e2-setting-profile-tab-copy`,
        ),
      );
    }
    expect(styles).toMatch(
      /\.d6e2-rules-profile-shell\s*>\s*\.d6e2-setting-profile-tabs\s+\.d6e2-setting-profile-tab-copy\s+strong\s*\{[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*anywhere;/s,
    );
    expect(styles).toMatch(
      /@container\s*\(max-width:\s*720px\)\s*\{[^]*?\.d6e2-rules-profile-shell\s*>\s*\.d6e2-setting-profile-tabs\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/s,
    );
    expect(styles).toMatch(
      /@container\s*\(max-width:\s*520px\)\s*\{[^]*?\.d6e2-rules-profile-shell\s*>\s*\.d6e2-setting-profile-tabs\s+\.d6e2-setting-profile-tab-icon\s*\{[^}]*display:\s*none;/s,
    );
    expect(styles).toMatch(
      /@container\s*\(max-width:\s*420px\)\s*\{[^]*?\.d6e2-rules-profile-shell\s*>\s*\.d6e2-setting-profile-tabs\s*\{[^}]*grid-template-columns:\s*1fr;/s,
    );
  });

  it("uses an accessible fixed-order difficulty tab with field-level validation", () => {
    expect(template).toContain('role="tabpanel"');
    expect(template).toContain(
      'aria-controls="d6e2-rules-profile-panel-difficulty"',
    );
    expect(template).toContain('data-difficulty-id="{{entry.id}}"');
    expect(template).toContain('name="difficulty.{{entry.id}}.label"');
    expect(template).toContain('name="difficulty.{{entry.id}}.value"');
    expect(rulesProfileApplication).toContain('key === "ArrowRight"');
    expect(rulesProfileApplication).toContain('key === "Home"');
    expect(rulesProfileApplication).toContain("aria-errormessage");
    expect(rulesProfileApplication).toContain('this.#activateTab("difficulty"');
    expect(styles).toContain("@container (max-width: 520px)");
    expect(styles).toContain("@container (max-width: 420px)");
  });

  it("edits a stable id only while creating a new Rules Profile", () => {
    expect(template).toContain('name="profile.id"');
    expect(template).toContain('pattern="[a-z][a-z0-9-]*"');
    expect(template).toContain("{{disabled (not canEditProfileId)}}");
    expect(rulesProfileApplication).toContain(
      'this.#draft.id = value("profile.id").toLocaleLowerCase()',
    );
    expect(rulesProfileApplication).toContain("saveNewWorldRulesProfile");
    expect(gameSettingsRoot).toContain(".withDraft(draft, { isNew })");
  });

  it("presents declarative requirements and disables unavailable settings", () => {
    expect(catalog).toContain("availability:");
    expect(catalog).toContain('message: "D6E2.Settings.Requirements.Pips"');
    expect(editionTemplate).toContain("setting.unavailableReason");
    expect(editionTemplate).toContain("{{disabled (not setting.available)}}");
    expect(settingsApplication).toContain("#refreshAvailability()");
    expect(settingsApplication).toContain("input.disabled = !available");
    expect(settingsApplication).toContain("requirement.hidden = available");
    expect(styles).toContain(".d6e2-setting-requirement");
  });

  it("offers concrete registered health models instead of an edition-only choice", () => {
    expect(rulesProfileApplication).toContain(
      "availableHealthModelsForProfile",
    );
    expect(rulesProfileApplication).toContain('typedSlot === "health"');
    expect(template).toContain('data-action="manageHealth"');
    expect(rulesProfileApplication).toContain(
      "D6System2eHealthModelLibraryApplication",
    );
    expect(rulesProfileApplication).toContain("UnavailableSelected");
    expect(styles).toMatch(
      /\.d6e2-rules-profile-mechanics\s*>\s*label\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(260px, 0\.65fr\)/s,
    );
  });

  it("places profile, mechanics, difficulty, and health in the one Rules Configure form", () => {
    for (const panel of ["profile", "mechanics", "difficulty"]) {
      expect(editionTemplate).toContain(`data-settings-panel="${panel}"`);
    }
    expect(editionTemplate).toContain('data-action="manageHealthModels"');
    expect(editionTemplate).toContain('name="profile.label"');
    expect(editionTemplate).toContain('name="strategy.{{mechanic.slot}}"');
    expect(editionTemplate).toContain('name="difficulty.{{entry.id}}.value"');
    expect(settingsApplication).toContain("#captureRulesDraft()");
    expect(settingsApplication).toContain(
      "D6System2eHealthModelLibraryApplication",
    );
    expect(gameSettingsRoot).not.toContain(
      'localized("D6E2.Settings.RulesProfile.EditDefinition")',
    );
    expect(editionTemplate).toContain("d6e2-unified-rules-profile-fields");
    expect(styles).toMatch(
      /\.d6e2-unified-rules-profile-fields\s*>\s*\.d6e2-settings-row\s*\{[^}]*grid-template-columns:\s*minmax\(180px, 260px\) minmax\(320px, 1fr\);/s,
    );
    expect(styles).toMatch(
      /@container d6e2-settings \(max-width:\s*680px\)\s*\{[^]*?\.d6e2-unified-rules-profile-fields\s*>\s*\.d6e2-settings-row\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s,
    );
  });

  it("exposes the complete world profile lifecycle without making active deletion possible", () => {
    for (const action of ["duplicate", "import", "export", "delete"]) {
      expect(gameSettingsRoot).toContain(`rulesAction === "${action}"`);
    }
    expect(gameSettingsRoot).toContain(
      ".filter(({ id }) => id !== world.activeProfileId)",
    );
    expect(gameSettingsRoot).toContain("importRulesProfile(value)");
    expect(gameSettingsRoot).toContain("document.body.append(link)");
    expect(gameSettingsRoot).toContain("document.body.append(input)");
    expect(gameSettingsRoot).toContain(".catch(reject)");
    expect(gameSettingsRoot).toContain("window.setTimeout(() =>");
    expect(template).toContain("d6e2-rules-profile-diagnostics");
    expect(template).toContain("diagnostics.length");
  });
});
