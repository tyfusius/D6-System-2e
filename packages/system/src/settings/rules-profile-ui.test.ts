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
    expect(template).not.toContain('data-rules-profile-tab="terminology"');
    expect(rulesProfileApplication).not.toContain("terminologyGroups");
    expect(styles).toMatch(
      /\.d6e2-rules-profile-shell\s*\{[^}]*grid-template-rows: auto auto minmax\(0, 1fr\) auto;[^}]*height: 100%;[^}]*min-height: 0/s,
    );
    expect(styles).toMatch(
      /\.application\.d6e2-rules-profile \.window-content\s*\{[^}]*min-height: 0;[^}]*overflow: hidden/s,
    );
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
    expect(rulesProfileApplication).toContain("availableHealthModels()");
    expect(rulesProfileApplication).toContain('typedSlot === "health"');
    expect(styles).toMatch(
      /\.d6e2-rules-profile-mechanics\s*>\s*label\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(260px, 0\.65fr\)/s,
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
