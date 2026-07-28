import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const implementation = readFileSync(
  new URL("./quickbars.ts", import.meta.url),
  "utf8",
);

describe("OpenD6 Next quickbar toolbar contract", () => {
  it("registers setting-dependent Token Controls buttons for both quickbars", () => {
    expect(implementation).toContain('Hooks.on("getSceneControlButtons"');
    expect(implementation).toContain("if (gmQuickbarEnabled())");
    expect(implementation).toContain("if (activeTasksQuickbarEnabled())");
    expect(implementation).toContain('icon: "fa-solid fa-people-group"');
    expect(implementation).toContain('icon: "fa-solid fa-list-check"');
  });

  it("keeps the GM Quickbar window and toolbar unavailable to players", () => {
    expect(implementation).toContain(
      "game.user?.isGM === true &&\n    booleanSetting(SHARED_SETTING_KEYS.showPcQuickbar, true)",
    );
  });

  it("keeps toolbar buttons able to reopen manually closed windows", () => {
    expect(implementation).toContain("export function toggleGmQuickbar()");
    expect(implementation).toContain(
      "export function toggleActiveTasksQuickbar()",
    );
    expect(implementation).toContain(
      "if (gmQuickbar?.rendered) void gmQuickbar.close()",
    );
    expect(implementation).toContain(
      "if (tasksQuickbar?.rendered) void tasksQuickbar.close()",
    );
  });

  it("refreshes Scene Controls when quickbar settings change", () => {
    expect(implementation).toContain("ui.controls?.render({ reset: true })");
  });

  it("formats structured public die codes before rendering them", () => {
    expect(implementation).toContain(
      "scoreLabel: formatDieCode(attribute.code)",
    );
    expect(implementation).toContain("scoreLabel: formatDieCode(skill.code)");
  });

  it("replaces delegated listeners and guards direct rolls from overlap", () => {
    expect(implementation).toContain(
      'this.element.removeEventListener("click", this.#rootClickHandler)',
    );
    expect(implementation).toContain("if (this.#rollPending) return");
    expect(implementation).toContain(
      'control.setAttribute("aria-busy", "true")',
    );
  });

  it("disables request controls when no non-GM owner is online", () => {
    expect(implementation).toContain(
      "const onlineOwners = activeNonGmOwners(actor)",
    );
    expect(implementation).toContain(
      "game.user?.isGM === true && onlineOwners.length > 0",
    );
  });

  it("registers player request delivery only after Foundry is ready", () => {
    expect(implementation).not.toContain(
      "export function registerD6System2eQuickbars(): void {\n  registerRollRequestSocket();",
    );
    expect(implementation).toContain(
      'Hooks.once("ready", () => {\n    registerRollRequestSocket();',
    );
  });
});
