import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../../../../", import.meta.url);

describe("Setting Profile Builder layout", () => {
  it("keeps its header and actions fixed around one constrained-height scroller", async () => {
    const [css, template, source] = await Promise.all([
      readFile(new URL("styles/d6-system-2e.css", root), "utf8"),
      readFile(new URL("templates/settings/setting-profile.hbs", root), "utf8"),
      readFile(
        new URL(
          "packages/system/src/settings/setting-profile-application.ts",
          root,
        ),
        "utf8",
      ),
    ]);

    expect(css).toMatch(
      /\.application\.d6e2-setting-profile \.window-content\s*\{[^}]*min-height: 0;[^}]*overflow: hidden/s,
    );
    expect(css).toMatch(
      /\.d6e2-setting-profile-shell\s*\{[^}]*grid-template-rows: auto auto auto minmax\(0, 1fr\) auto;[^}]*height: 100%;[^}]*min-height: 0/s,
    );
    expect(css).toMatch(
      /\.d6e2-setting-profile-scroll\s*\{[^}]*grid-auto-rows: max-content;[^}]*height: 100%;[^}]*max-height: 100%;[^}]*min-height: 0;[^}]*overflow-y: auto;[^}]*scrollbar-gutter: stable/s,
    );
    expect(css).toMatch(
      /\.d6e2-setting-profile-tabs\s*\{[^}]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/s,
    );

    expect(template).toContain('role="tablist"');
    expect(template.match(/role="tab"/gu)).toHaveLength(5);
    expect(template.match(/role="tabpanel"/gu)).toHaveLength(5);
    expect(template).toContain('name="profile.logoAsWatermark"');
    expect(template).toContain("data-setting-profile-directory");
    expect(template).toContain("d6e2-setting-profile-diagnostics");
    expect(template).toContain("d6e2-setting-profile-tab-copy");
    expect(template).toContain("d6e2-setting-profile-technical");
    expect(template).toContain('data-active="{{attribute.activeFromRules}}"');
    expect(template).toContain("number=skill.displayIndex");
    expect(template).toContain("{{face.dieValue}}");
    expect(template).toContain("assetDiagnostics.length");
    expect(template).not.toContain("attribute.{{attribute.index}}.active");
    expect(template).toContain("attribute.activeFromRules");
    expect(source).not.toContain("`attribute.${index}.active`");
    expect(source).toContain("currentSettingActiveAttributes");
    expect(source).toContain(
      "editable.logo = resolveSettingLogo(editable.logo)",
    );
    expect(source).toContain(
      'this.#draft.logoAsWatermark = checked("profile.logoAsWatermark")',
    );
    expect(source).toContain("ensureSettingProfileDirectory(this.#draft.id)");
    expect(source).toContain("settingProfileAssetDiagnostics(this.#draft)");
    expect(source).toContain("tabMeta:");
    expect(source).toContain("mergeTerminologyOverrideEntries");
    expect(source).toContain("settingProfileTerminologyFields");
    expect(source).toContain("currentConfiguredHealthModel");
    expect(source).toContain("displayIndex: index + 1");
    expect(source).toContain('"conditions"');
    expect(template).toContain('data-terminology-group="{{group.id}}"');
    expect(template).toContain('data-terminology-path="{{field.path}}"');
    expect(template).toContain('data-health-model-id="{{model.id}}"');
    expect(template).toContain('data-health-state-id="{{state.id}}"');
    expect(source).toContain("availableHealthModelsForProfile");
    expect(source).toContain("this.#draft.healthLabels[modelId]");
    expect(css).toContain('[data-terminology-group="conditions"]');
    expect(css).toContain('[data-terminology-path="conditions.track"]');
    expect(css).toContain('[data-terminology-path="wounds.track"]');
    expect(css).toContain('[data-terminology-path="bodyPoints.track"]');
    expect(css).toMatch(
      /data-terminology-group="conditions"[^}]*[\s\S]*?label\s*\{[^}]*min-height: 44px/s,
    );
    expect(source).toContain('dieValue: id === "one" ? "1" : "6"');
    for (const key of [
      "Identity",
      "Attributes",
      "Skills",
      "Terminology",
      "WildDie",
    ]) {
      expect(source).toContain(`D6E2.Settings.SettingProfile.TabMeta.${key}`);
    }
    for (const tab of [
      "identity",
      "attributes",
      "skills",
      "wild-die",
      "terminology",
    ]) {
      expect(template).toContain(`data-profile-tab="${tab}"`);
      expect(template).toContain(`data-profile-panel="${tab}"`);
    }
    for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
      expect(source).toContain(`event.key === "${key}"`);
    }

    const identity = template.indexOf('id="d6e2-profile-panel-identity"');
    const attributes = template.indexOf('id="d6e2-profile-panel-attributes"');
    const skills = template.indexOf('id="d6e2-profile-panel-skills"');
    const wildDie = template.indexOf('id="d6e2-profile-panel-wild-die"');
    const terminology = template.indexOf('id="d6e2-profile-panel-terminology"');
    const footer = template.indexOf("<footer>");
    expect(identity).toBeGreaterThanOrEqual(0);
    expect(attributes).toBeGreaterThan(identity);
    expect(skills).toBeGreaterThan(attributes);
    expect(wildDie).toBeGreaterThan(skills);
    expect(terminology).toBeGreaterThan(wildDie);
    expect(footer).toBeGreaterThan(terminology);
  });
});
