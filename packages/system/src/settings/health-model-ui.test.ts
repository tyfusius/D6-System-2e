import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../../../", import.meta.url);
const application = readFileSync(
  new URL("./health-model-application.ts", import.meta.url),
  "utf8",
);
const template = readFileSync(
  new URL("templates/settings/health-model.hbs", root),
  "utf8",
);
const libraryApplication = readFileSync(
  new URL("./health-model-library-application.ts", import.meta.url),
  "utf8",
);
const libraryTemplate = readFileSync(
  new URL("templates/settings/health-model-library.hbs", root),
  "utf8",
);
const styles = readFileSync(new URL("styles/d6-system-2e.css", root), "utf8");

describe("Dynamic Health Model editor UI contract", () => {
  it("is a dedicated responsive ApplicationV2 with a sticky save boundary", () => {
    expect(application).toContain("ApplicationV2");
    expect(application).toContain("width: 920");
    expect(template).toContain("d6e2-health-model-shell");
    expect(template).toContain('class="d6e2-setting-profile-scroll"');
    expect(template).toContain('type="submit"');
    expect(styles).toMatch(
      /\.d6e2-health-model-shell\s*\{[^}]*grid-template-rows: auto minmax\(0, 1fr\) auto/s,
    );
    expect(styles).toContain(".d6e2-health-model-builder");
  });

  it("keeps stable ordered states operable without drag precision", () => {
    expect(template).toContain("<ol");
    expect(template).toContain('data-direction="up"');
    expect(template).toContain('data-direction="down"');
    expect(template).toContain('aria-live="polite"');
    expect(application).toContain("D6E2.Settings.HealthModel.Moved");
    expect(application).toContain("#renderAndRestoreFocus");
    expect(styles).toMatch(
      /\.d6e2-health-model-state-order button\s*\{[^}]*width: 44px;[^}]*height: 44px/s,
    );
    expect(template).toContain("{{disabled state.published}}");
    expect(template).toContain('name="state.{{state.index}}.description"');
    expect(template).toContain(">{{state.description}}</textarea>");
    expect(template).not.toContain("{{{state.description}}}");
    expect(application).toContain(
      "description: value(`state.${index}.description`)",
    );
  });

  it("offers basic generation and a constrained advanced matrix", () => {
    expect(application).toContain("generateMonotonicDamageTransitions");
    expect(template).toContain("d6e2-health-model-advanced");
    expect(template).toContain("d6e2-health-model-transition-table");
    expect(template).toContain("d6e2-health-model-transition-rows");
    expect(styles).toMatch(
      /@container \(max-width: 720px\)[^]*\.d6e2-health-model-transition-table\s*\{[^}]*display: none[^]*\.d6e2-health-model-transition-rows\s*\{[^}]*display: block/s,
    );
  });

  it("surfaces validation and explicit published-state replacements", () => {
    expect(template).toContain('role="alert"');
    expect(template).toContain("aria-errormessage");
    expect(template).toContain('name="replacement.{{removed.id}}"');
    expect(application).toContain('querySelector<HTMLElement>(":invalid")');
    expect(application).toContain("#advancedOpen = true");
    expect(application).toContain("worldHealthModelReferences");
    expect(application).toContain("DialogV2.wait<boolean>");
    expect(application).toContain("worldHealthStateImpacts");
    expect(template).toContain('data-action="viewReferences"');
    expect(template).toContain("reference.label");
    expect(template).toContain("removed.actorCount");
  });

  it("exposes every health model through a dedicated world library", () => {
    expect(libraryApplication).toContain("availableHealthModels");
    expect(libraryApplication).toContain("#allModels");
    expect(libraryApplication).toContain("#uniqueModelId");
    expect(libraryApplication).toContain("saveWorldHealthModel");
    expect(libraryApplication).toContain("deleteWorldHealthModel");
    for (const action of ["createModel", "editModel", "duplicateModel"]) {
      expect(libraryTemplate).toContain(`data-action="${action}"`);
    }
    expect(libraryTemplate).toContain("missingSelected");
    expect(libraryTemplate).toContain("model.referenceCount");
    expect(styles).toContain(".d6e2-health-model-library-row");
    expect(styles).toMatch(
      /\.application\.d6e2-health-model-library\s*\{[^}]*height: min\(720px, calc\(100vh - 48px\)\)/s,
    );
  });
});
