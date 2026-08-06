import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manager = readFileSync(
  new URL("./environment-manager.ts", import.meta.url),
  "utf8",
);
const template = readFileSync(
  new URL(
    "../../../../templates/apps/environment-manager.hbs",
    import.meta.url,
  ),
  "utf8",
);

describe("Foundry environment integration", () => {
  it("registers a GM-only ApplicationV2 Token Controls surface", () => {
    expect(manager).toContain("HandlebarsApplicationMixin.bind");
    expect(manager).toContain('Hooks.on("getSceneControlButtons"');
    expect(manager).toContain("d6EnvironmentsEnabled()");
    expect(manager).toContain("game.user?.isGM !== true");
    expect(manager).toContain("D6System2eEnvironmentManager");
  });

  it("exposes resistance, aid, and safe-day workflows without an automatic clock", () => {
    expect(manager).toContain("exposeActorToEnvironment");
    expect(manager).toContain("aidEnvironmentRecovery");
    expect(manager).toContain("recoverEnvironmentAfterSafeDay");
    expect(template).toContain('data-action="expose"');
    expect(template).toContain('data-action="aid"');
    expect(template).toContain('data-action="safe-day"');
    expect(template).toContain("breathRounds");
  });
});
