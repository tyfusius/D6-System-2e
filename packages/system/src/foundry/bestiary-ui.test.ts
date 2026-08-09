import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function repositoryFile(relative: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../../../${relative}`, import.meta.url)),
    "utf8",
  );
}

describe("bestiary UI contract", () => {
  it("registers a GM-only ApplicationV2 catalog and persists sheet provenance", () => {
    const browser = repositoryFile(
      "packages/system/src/foundry/bestiary-browser.ts",
    );
    const bootstrap = repositoryFile(
      "packages/system/src/foundry/bootstrap.ts",
    );
    const template = repositoryFile("templates/apps/bestiary-browser.hbs");
    const combat = repositoryFile("templates/actor/character/combat.hbs");
    expect(browser).toContain("HandlebarsApplicationMixin");
    expect(browser).toContain("game.user?.isGM !== true");
    expect(browser).toContain("getSceneControlButtons");
    expect(browser).toContain("api?.bestiary.create");
    expect(bootstrap).toContain("registerD6BestiaryBrowser");
    expect(template).toContain('data-action="createCreature"');
    expect(template).toContain('data-action="newCatalogCreature"');
    expect(template).toContain('data-action="openCreatureSource"');
    expect(template).toContain('data-action="duplicateCreature"');
    expect(template).toContain('data-action="copyCreatureToProfiles"');
    expect(template).toContain('data-action="removeCreatureFromCatalog"');
    expect(template).toContain('data-action="restoreCatalogCreature"');
    expect(template).toContain('data-action="toggleRemovedCreatures"');
    expect(template).toContain('data-action="deleteCatalogCreature"');
    expect(template).toContain('data-action="switchProfiles"');
    expect(template.indexOf('class="d6e2-bestiary-manage"')).toBeLessThan(
      template.indexOf('data-action="switchProfiles"'),
    );
    expect(template).toContain('data-tooltip="{{entry.issueTooltip}}"');
    expect(template).toContain("D6E2.Bestiary.ProfileSwitchTarget");
    expect(template).toContain('data-action="filterProfile"');
    expect(template).toContain("data-bestiary-search");
    expect(template).toContain("entry.compatibleProfileIds");
    expect(browser).toContain("bestiaryProfileFacets");
    expect(browser).toContain("d6e2-bestiary-entry:not([hidden])");
    expect(browser).toContain("browser.resetFilters()");
    expect(browser).toContain(
      'Hooks.on("d6e2RulesProfileChanged", refreshForProfileChange)',
    );
    expect(browser).toContain("bestiary.activateProfiles");
    expect(browser).toContain("D6E2.Bestiary.ProfileSwitchAction");
    expect(browser).toContain("D6E2.Bestiary.ProfileRequirements");
    expect(browser).not.toContain(
      'game.i18n.format("D6E2.Bestiary.ProfileSwitch",',
    );
    expect(browser).toContain(
      'Hooks.on("d6e2SettingProfileChanged", refreshForProfileChange)',
    );
    expect(template).toContain("entry.issueTooltip");
    expect(combat).toContain("bestiaryProvenance.sourceBook");
    expect(combat).toContain("bestiaryProvenance.catalogId");
    expect(combat).toContain('data-action="addToCreatureCatalog"');
    expect(browser).toContain("refreshBestiaryDocuments");
  });

  it("gives Creature Attributes a distinct high-Die-Code data model", () => {
    const models = repositoryFile(
      "packages/system/src/foundry/data-models/character.ts",
    );
    const registration = repositoryFile(
      "packages/system/src/foundry/data-models/register.ts",
    );
    expect(models).toContain("export class CreatureDataModel");
    expect(models).toContain('const hadScale = Object.hasOwn(source, "scale")');
    expect(models).toContain("if (!hadScale) delete source.scale");
    expect(models).toContain('Object.hasOwn(source, "bestiary")');
    expect(models).toContain("brawn: pipScoreField(3, 3)");
    expect(registration).toContain(
      "CONFIG.Actor.dataModels.creature = CreatureDataModel",
    );
  });

  it("keeps sticky catalog filters flush with the window header", () => {
    const styles = repositoryFile("styles/d6-system-2e.css");
    expect(styles).toContain(".window-content:has(> .d6e2-bestiary-shell)");
    expect(styles).toContain("padding: 0 0.85rem 0.85rem;");
    expect(styles).toContain(".d6e2-bestiary-tools {");
    expect(styles).toContain("position: sticky;");
    expect(styles).toContain("top: 0;");
    expect(styles).toContain(
      ".d6e2-bestiary-issues {\n  align-items: center;\n  background: color-mix(in srgb, var(--od6-danger) 12%, transparent);",
    );
    expect(styles).not.toContain(".d6e2-bestiary-tools::before");
  });
});
