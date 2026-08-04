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
    expect(application).toContain(
      "const compatibilityResult = await applyRulesCompatibilitySelection",
    );
    expect(application).toContain('constructor.category === "second-edition"');
    expect(template).toContain("showImportedFirstEditionMechanics");
    expect(template).toContain(
      "D6E2.Settings.ContentPackages.OpenD6ImportsHeading",
    );
  });
});
