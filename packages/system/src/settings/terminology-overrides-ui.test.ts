import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const application = readFileSync(
  new URL("./settings-application.ts", import.meta.url),
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
    "../../../../templates/settings/terminology-overrides.hbs",
    import.meta.url,
  ),
  "utf8",
);
const css = readFileSync(
  new URL("../../../../styles/d6-system-2e.css", import.meta.url),
  "utf8",
);

describe("world terminology editor UI", () => {
  it("is available from both edition workspaces and persists world overrides", () => {
    expect(editionTemplate).toContain('data-action="customizeTerminology"');
    expect(application).toContain("WORLD_TERMINOLOGY_SETTING");
    expect(application).toContain("position: { width: 720 }");
    expect(settings).toContain("setWorldTerminologyOverrides");
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
    expect(editorTemplate).toContain('placeholder="{{field.placeholder}}"');
    expect(editorTemplate).toContain('name="{{field.path}}"');
    expect(css).toContain(".d6e2-terminology-grid");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(css).toContain("max-height: min(70vh, 720px)");
  });
});
