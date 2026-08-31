import { readFile } from "node:fs/promises";
import Handlebars from "handlebars";
import { describe, expect, it } from "vitest";

const root = new URL("../../../../", import.meta.url);

describe("Setting Profile Builder layout", () => {
  it("renders selected typography options with the Foundry 14 helper surface", async () => {
    const template = await readFile(
      new URL("templates/settings/setting-profile.hbs", root),
      "utf8",
    );
    const handlebars = Handlebars.create();
    handlebars.registerHelper("localize", (key: string) => key);
    handlebars.registerHelper("checked", (value: boolean) =>
      value ? "checked" : "",
    );

    expect(() =>
      handlebars.compile(template)({
        profile: { id: "qa-profile", label: "QA Profile" },
        typographyRoles: [
          {
            groups: [
              {
                label: "Built in",
                options: [
                  {
                    id: "system/d6-display",
                    label: "D6 Condensed",
                    selected: true,
                  },
                ],
              },
            ],
            help: "Display help",
            id: "display",
            label: "Display & headings",
            status: "Built in",
          },
        ],
      }),
    ).not.toThrow();
  });

  it("keeps its header and actions fixed around one constrained-height scroller", async () => {
    const [css, template, source, systemSettings] = await Promise.all([
      readFile(new URL("styles/d6-system-2e.css", root), "utf8"),
      readFile(new URL("templates/settings/setting-profile.hbs", root), "utf8"),
      readFile(
        new URL(
          "packages/system/src/settings/setting-profile-application.ts",
          root,
        ),
        "utf8",
      ),
      readFile(
        new URL("packages/system/src/settings/system-settings.ts", root),
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
    expect(template).toContain('class="d6e2-setting-profile-palette"');
    expect(template).toContain('class="d6e2-profile-palette-layout"');
    expect(template).toContain('class="d6e2-profile-palette-preview"');
    expect(template).toContain('class="d6e2-setting-profile-typography"');
    expect(template).toContain('name="profile.typography.{{role.id}}"');
    expect(template).toContain("data-setting-typography-preview");
    expect(template).toContain('data-typography-role="{{role.id}}"');
    expect(template.match(/data-color-field=/gu)).toHaveLength(1);
    expect(template.match(/data-palette-source="picker"/gu)).toHaveLength(1);
    expect(template.match(/data-palette-source="hex"/gu)).toHaveLength(1);
    expect(template).toContain('name="profile.palette.{{field.id}}"');
    expect(template).not.toContain('pattern="#[0-9A-Fa-f]{6}"');
    expect(template).not.toMatch(
      /name="profile\.palette\.\{\{field\.id\}\}"[^>]*\srequired/u,
    );
    expect(template).toContain('maxlength="7"');
    expect(template).toContain('autocomplete="off"');
    expect(template).toContain('role="group"');
    expect(template).toContain(
      'aria-labelledby="d6e2-setting-profile-palette-{{field.id}}-label"',
    );
    expect(template).toContain(
      'aria-describedby="d6e2-setting-profile-palette-{{field.id}}-help d6e2-setting-profile-palette-{{field.id}}-error"',
    );
    expect(template).toContain('class="d6e2-profile-palette-preview-mark"');
    expect(template).toMatch(
      /d6e2-profile-palette-preview-mark[\s\S]*?data-brand="\{\{profileLogoBrand\}\}"[\s\S]*?data-branding="\{\{profileLogoBranding\}\}"[\s\S]*?--d6e2-profile-logo-image: url\('\{\{profileLogo\}\}'\)/s,
    );
    expect(template).toContain("{{profile.label}}");
    expect(template).not.toContain('class="is-mark"');
    expect(template).toContain('href="#{{paletteError.target}}"');
    expect(template).toContain('class="{{paletteSummaryClass}}"');
    expect(template).toContain('class="{{palettePassedClass}}"');
    expect(template).toContain('class="{{paletteAttentionClass}}"');
    expect(template).toContain("PaletteContrastAttention");
    expect(template).toContain('data-palette-validation-status="passed"');
    expect(template).toContain('data-palette-validation-status="attention"');
    expect(template).toContain('class="d6e2-setting-profile-hero-logo"');
    expect(template).toContain("d6e2-profile-logo-mark");
    expect(template).toContain('data-branding="{{profileLogoBranding}}"');
    expect(template).not.toContain('<img src="{{profile.logo}}" alt="" />');
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
    expect(source).toContain("profileLogoBranding:");
    expect(source).toContain("resolveSettingLogoPresentation(profileLogo)");
    expect(source).toContain(
      'this.#draft.logoAsWatermark = checked("profile.logoAsWatermark")',
    );
    expect(source).toContain("synchronizedSettingProfileColor");
    expect(source).toContain("this.#previewPalette");
    expect(source).toContain("this.#previewTypography");
    expect(source).toContain("loadSettingProfileFontForRole");
    expect(source).toContain("#typographyPreviewGeneration");
    expect(source).toContain("validateSettingProfileTypography");
    expect(source).not.toContain("document.documentElement.style.setProperty");
    expect(source).toContain("validateSettingProfilePalette");
    expect(source).toContain("#updatePaletteValidationPresentation");
    expect(source).not.toContain("this.#paletteValidation = { valid: true }");
    expect(source).toContain('"is-contrast is-attention is-hidden"');
    expect(source).toContain(
      '"d6e2-setting-profile-palette-summary is-hidden"',
    );
    expect(source).toContain('this.#activeProfileTab = "identity"');
    expect(source).toContain("?.focus()");
    expect(systemSettings).toMatch(
      /WORLD_SETTING_PROFILES_SETTING,[^]*?onChange:\s*\(\) => \{[^]*?applySelectedTheme\(\);[^]*?requiresReload:\s*false/s,
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
      /\.d6e2-profile-palette-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(260px, 0\.72fr\)/s,
    );
    expect(css).toMatch(
      /\.d6e2-color-field\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) max-content/s,
    );
    expect(css).toMatch(
      /\.d6e2-color-field-controls\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*44px 9ch/s,
    );
    expect(css).toMatch(
      /\.d6e2-color-field-controls input\[type="color"\]\s*\{[^}]*width:\s*44px;[^}]*min-height:\s*44px/s,
    );
    expect(css).toMatch(
      /\.d6e2-color-field-controls input\[type="text"\]\s*\{[^}]*width:\s*9ch;[^}]*min-height:\s*44px/s,
    );
    expect(css).toMatch(
      /@container \(max-width: 720px\)[^]*\.d6e2-profile-palette-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s,
    );
    expect(css).toMatch(
      /@container \(max-width: 520px\)[^]*\.d6e2-color-field\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s,
    );
    expect(css).toMatch(
      /\.d6e2-profile-typography-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(13rem, 16rem\)/s,
    );
    expect(css).toMatch(
      /@container \(max-width: 720px\)[^]*\.d6e2-profile-typography-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s,
    );
    expect(css).toMatch(
      /\.d6e2-font-library-shell\s*\{[^}]*container-type:\s*inline-size/s,
    );
    expect(css).toMatch(
      /@container \(max-width: 520px\)[^]*\.d6e2-font-library-shell > header\s*\{[^}]*align-items:\s*stretch;[^}]*flex-direction:\s*column/s,
    );
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

  it("keeps typography selectors at the 44px control size through the later general form cascade", async () => {
    const css = await readFile(
      new URL("styles/d6-system-2e.css", root),
      "utf8",
    );
    const typographySelector =
      "body.system-d6-system-2e .d6e2-profile-typography-layout {";
    const generalSelector =
      "body.system-d6-system-2e .d6e2-setting-profile :is(input, select) {";
    const typographyStart = css.indexOf(typographySelector);
    const generalStart = css.indexOf(generalSelector);
    const typographyRule = css.slice(
      typographyStart,
      css.indexOf("}", typographyStart) + 1,
    );
    const generalRule = css.slice(
      generalStart,
      css.indexOf("}", generalStart) + 1,
    );

    expect(typographyStart).toBeGreaterThanOrEqual(0);
    expect(generalStart).toBeGreaterThan(typographyStart);
    expect(typographyRule).toContain("--d6e2-setting-control-min-size: 44px;");
    expect(generalRule).toContain(
      "min-height: var(--d6e2-setting-control-min-size, 36px);",
    );
    expect(generalRule).not.toContain("min-height: 36px;");
    expect(css.match(/--d6e2-setting-control-min-size:/gu)).toHaveLength(1);
    expect(css).not.toMatch(
      /\.d6e2-profile-typography-layout select\s*\{[^}]*min-height:/su,
    );
  });

  it("patches only removed-font selections in an open draft without rerendering the editor", async () => {
    const source = await readFile(
      new URL("./setting-profile-application.ts", import.meta.url),
      "utf8",
    );
    const start = source.indexOf(
      "applySettingProfileTypographyReplacement(\n    removedRef:",
    );
    const end = source.indexOf("readonly #profileTabClickHandler", start);
    const method = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(method).toContain("this.#draft.typography = next");
    expect(method).toContain("this.#previewTypography = { ...next }");
    expect(method).toContain("option.remove()");
    expect(method).toContain("select.value = replacement");
    expect(method).toContain(
      "this.#updateTypographyPreview(role, replacement)",
    );
    expect(method).not.toContain("this.render(");
    expect(method).not.toContain("editableProfile(");
  });

  it("subscribes the real ApplicationV2 lifecycle and refreshes font options without replacing the draft", async () => {
    const [source, typography, library] = await Promise.all([
      readFile(
        new URL("./setting-profile-application.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("./setting-profile-typography.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(
          "./setting-profile-font-library-application.ts",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);
    const start = source.indexOf(
      "async refreshSettingProfileFontAvailability(): Promise<void>",
    );
    const end = source.indexOf(
      "applySettingProfileTypographyReplacement(",
      start,
    );
    const refresh = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(refresh).toContain("this.#captureFormControlState()");
    expect(refresh).toContain("await this.render({ force: true })");
    expect(refresh).toContain("this.#restoreFormControlState(controlState)");
    expect(refresh).toContain("scrollTop");
    expect(refresh).toContain("actionIndex");
    expect(refresh).toContain("focus({ preventScroll: true })");
    expect(refresh).not.toContain("this.#readVisibleForm()");
    expect(refresh).not.toContain("editableProfile(");
    expect(source).toMatch(
      /subscribeSettingProfileTypographyEditor\(\s*this\.#typographyEditorSubscriber\s*\)/u,
    );
    expect(source).toContain("override async close(): Promise<void>");
    expect(source).toContain("this.#unsubscribeTypographyEditor?.()");
    expect(typography).not.toContain("ui.windows");
    expect(library).not.toContain("ui.windows");
    expect(typography).toContain(
      "await notifySettingProfileFontAvailabilityChanged()",
    );
    expect(library).not.toContain(
      "notifySettingProfileFontAvailabilityChanged",
    );
  });
});
