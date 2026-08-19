import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rootSettings = readFileSync(
  new URL("./game-settings-root.ts", import.meta.url),
  "utf8",
);
const settings = readFileSync(
  new URL("./system-settings.ts", import.meta.url),
  "utf8",
);
const editionTemplate = readFileSync(
  new URL(
    "../../../../templates/settings/edition-settings.hbs",
    import.meta.url,
  ),
  "utf8",
);
const editorTemplate = readFileSync(
  new URL(
    "../../../../templates/settings/setting-profile.hbs",
    import.meta.url,
  ),
  "utf8",
);
const application = readFileSync(
  new URL("./setting-profile-application.ts", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("../../../../styles/d6-system-2e.css", import.meta.url),
  "utf8",
);

describe("Setting Profile terminology editor UI", () => {
  it("is owned by the root Setting Profile and persists with that profile", () => {
    expect(rootSettings).not.toContain('if (action === "terminology")');
    expect(editionTemplate).not.toContain('data-action="customizeTerminology"');
    expect(editorTemplate).toContain('data-profile-tab="terminology"');
    expect(editorTemplate).toContain('name="terminology.{{field.path}}"');
    expect(application).toContain("mergeTerminologyOverrideEntries");
    expect(application).toContain("settingProfileTerminologyFields");
    expect(application).toContain("this.#draft.terminology");
    expect(settings).toContain("migrateLegacyWorldTerminologyOverrides");
    expect(settings).toContain("setWorldTerminologyOverrides({})");
  });

  it("refreshes terminology without opening every world document sheet", () => {
    expect(settings).toContain("refreshRenderedDocumentSheets");
    expect(settings).not.toContain(
      "for (const actor of game.actors?.contents ?? []) actor.sheet.render(true)",
    );
    expect(settings).not.toContain(
      "for (const item of game.items?.contents ?? []) item.sheet.render(true)",
    );
  });

  it("inherits blank values and remains responsive without horizontal overflow", () => {
    expect(editorTemplate).toContain('placeholder="{{field.inherited}}"');
    expect(editorTemplate).toContain('name="terminology.{{field.path}}"');
    expect(css).toContain(".d6e2-terminology-grid");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(css).toContain("max-height: min(70vh, 720px)");
  });
});
