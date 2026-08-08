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

    expect(template).toContain('role="tablist"');
    expect(template.match(/role="tab"/gu)).toHaveLength(4);
    expect(template.match(/role="tabpanel"/gu)).toHaveLength(4);
    expect(template).toContain('name="profile.logoAsWatermark"');
    expect(template).toContain("data-setting-profile-directory");
    expect(template).toContain("d6e2-setting-profile-diagnostics");
    expect(template).toContain("assetDiagnostics.length");
    expect(source).toContain(
      'this.#draft.logoAsWatermark = checked("profile.logoAsWatermark")',
    );
    expect(source).toContain("ensureSettingProfileDirectory(this.#draft.id)");
    expect(source).toContain("settingProfileAssetDiagnostics(this.#draft)");
    for (const tab of ["identity", "attributes", "skills", "wild-die"]) {
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
    const footer = template.indexOf("<footer>");
    expect(identity).toBeGreaterThanOrEqual(0);
    expect(attributes).toBeGreaterThan(identity);
    expect(skills).toBeGreaterThan(attributes);
    expect(wildDie).toBeGreaterThan(skills);
    expect(footer).toBeGreaterThan(wildDie);
  });
});
