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
    expect(template).toContain("entry.issueLabels");
    expect(combat).toContain("bestiaryProvenance.sourceBook");
    expect(combat).toContain("bestiaryProvenance.catalogId");
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
});
