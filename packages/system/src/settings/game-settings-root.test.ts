import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const implementation = readFileSync(
  new URL("./game-settings-root.ts", import.meta.url),
  "utf8",
);
const registration = readFileSync(
  new URL("./system-settings.ts", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../../../../styles/d6-system-2e.css", import.meta.url),
  "utf8",
);

describe("root Game Settings system mode", () => {
  it("enhances Foundry's native SettingsConfig system category", () => {
    expect(implementation).toContain('Hooks.on("renderSettingsConfig"');
    expect(implementation).toContain('[data-category="system"]');
    expect(implementation).toContain(
      "category.prepend(buildRootSetup(category))",
    );
    expect(implementation).toContain("buildSettingProfileSetup(category)");
    expect(implementation).toContain("buildProfilePresetSetup(category)");
    expect(implementation).toContain("availableProfilePresets()");
    expect(implementation).toContain("previewProfilePreset(");
    expect(implementation).toContain("confirmProfilePresetActivation(");
    expect(implementation).toContain("activateProfilePreset(");
    expect(implementation).toContain("data-d6e2-profile-preset");
    expect(implementation).toContain("data-d6e2-apply-profile-preset");
    expect(implementation).toContain("position: { width: 520 }");
    expect(implementation).toContain("const requestedProfileId = select.value");
    expect(implementation).toContain(
      "activateSettingProfile(requestedProfileId)",
    );
    expect(implementation).toContain("availableSettingProfiles()");
    expect(implementation).toContain("currentSettingProfileSelection()");
    expect(implementation).toContain("UnavailableSelection");
    expect(implementation).toContain("openSettingProfileTerminologyEditor()");
    expect(implementation).toContain('d6e2ProfileAction = "terminology"');
    for (const action of ["duplicate", "import", "export", "delete"]) {
      expect(implementation).toContain(`["${action}",`);
    }
    expect(implementation).toContain("importSettingProfile(value)");
    expect(implementation).toContain("settingProfileAssetDiagnostics(profile)");
    expect(implementation).toContain("promptSettingProfileDeletion()");
    expect(implementation).toContain(
      ".filter(({ id }) => id !== world.activeProfileId)",
    );
    expect(implementation).toContain("removeNativeEditionMenuRows(category)");
    expect(implementation).toContain('?.closest<HTMLElement>(".form-group")');
    expect(implementation).toContain("?.remove()");
  });

  it("uses an explicit Rules Profile selector and in-card configuration", () => {
    expect(implementation).toContain("select.dataset.d6e2RulesProfile");
    expect(implementation).toContain("availableRulesProfiles().map");
    expect(implementation).toContain("selectRulesProfile(requested)");
    expect(implementation).toContain("D6System2eRulesProfileApplication");
    expect(implementation).toContain("createWorldRulesProfile()");
    expect(implementation).toContain("withDraft(draft)");
    expect(implementation).toContain('"[data-d6e2-configure-active-rules]"');
    expect(implementation).toContain(
      'localized("D6E2.Settings.RulesProfile.ConfigureActive")',
    );
    expect(implementation).toContain("rulesProfileSettingsWorkspace(");
    expect(implementation).toContain("currentConfiguredRulesProfile())");
    expect(implementation).not.toContain("currentGameMode");
    expect(implementation).not.toContain("d6e2ConfigureMode");
    expect(implementation).toContain(
      "new D6System2eSecondEditionSettings().render(true)",
    );
    expect(implementation).toContain(
      "new D6System2eFirstEditionSettings().render(true)",
    );
  });

  it("updates the open settings category after selecting a Rules Profile", () => {
    expect(implementation).toContain(
      ".finally(() => updateSystemModeSetup(category))",
    );
    expect(implementation).toContain(
      'Hooks.on("d6e2RulesProfileChanged", synchronizeGameSettingsRoot)',
    );
    expect(registration).toContain("WORLD_RULES_PROFILES_SETTING");
  });

  it("keeps edition-owned rules out of the raw root list", () => {
    expect(registration).toContain("registerDefinition(definition, false)");
    expect(registration).not.toContain("registerRulesCompatibilitySettings");
    expect(registration).not.toContain("registerGameModeSetting");
  });

  it("provides non-color active and inactive visual cues", () => {
    expect(styles).toContain(".d6e2-game-mode-choice.is-active");
    expect(styles).toContain(".d6e2-game-mode-configure-actions");
    expect(styles).toContain(".d6e2-game-mode-configure:disabled");
    expect(styles).toContain("opacity: 0.48");
    expect(styles).toMatch(
      /\.d6e2-system-mode-setup\s*\{[^}]*grid-template-columns:\s*repeat\(\s*auto-fit,/s,
    );
    expect(styles).toMatch(
      /\.d6e2-profile-preset-block\s*\{[^}]*grid-column:\s*1 \/ -1/s,
    );
    expect(styles).toMatch(
      /\.d6e2-profile-preset-controls\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(150px, auto\)/s,
    );
  });
});
