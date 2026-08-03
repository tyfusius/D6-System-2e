import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const implementation = readFileSync(
  new URL("./quickbars.ts", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../../../../styles/d6-system-2e.css", import.meta.url),
  "utf8",
);
const headerControlStyles = styles.slice(
  styles.indexOf("ApplicationV2 header controls"),
  styles.indexOf(
    "body.system-d6-system-2e .application.od6s-settings-v2 .window-content",
  ),
);
const availabilitySynchronization = implementation.slice(
  implementation.indexOf("export function synchronizeQuickbarAvailability"),
  implementation.indexOf("export function toggleGmQuickbar"),
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

  it("starts enabled quickbars closed until their toolbar buttons are used", () => {
    expect(availabilitySynchronization).toContain(
      "if (!gmQuickbarEnabled()) close(gmQuickbar)",
    );
    expect(availabilitySynchronization).toContain(
      "if (!activeTasksQuickbarEnabled()) close(tasksQuickbar)",
    );
    expect(availabilitySynchronization).not.toContain(
      "new D6System2eGmQuickbar",
    );
    expect(availabilitySynchronization).not.toContain(
      "new D6System2eActiveTasksQuickbar",
    );
    expect(availabilitySynchronization).not.toContain(
      "render({ force: true })",
    );
    expect(availabilitySynchronization).toContain(
      "ui.controls?.render({ reset: true })",
    );
    expect(implementation).toContain(
      "registerRollRequestSocket();\n    synchronizeQuickbarAvailability();",
    );
  });

  it("renders stable SVG header controls in both quickbars", () => {
    expect(headerControlStyles).toContain(".od6-pc-quickbar");
    expect(headerControlStyles).toContain(".od6-active-tasks-quickbar");
    expect(headerControlStyles).toContain(
      'button.header-control[data-action="toggleControls"]::before',
    );
    expect(headerControlStyles).toContain(
      'button.header-control[data-action="close"]::before',
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

  it("persists versioned section order and wires the advertised drag controls", () => {
    expect(implementation).toContain("resolveQuickbarSections(state, actors)");
    expect(implementation).toContain("this.#setupDragAndDrop()");
    expect(implementation).toContain('card.addEventListener("dragstart"');
    expect(implementation).toContain('body.addEventListener("drop"');
    expect(implementation).toContain("reorderQuickbarActor(");
  });

  it("keeps request controls available for local GM fallback", () => {
    expect(implementation).toContain(
      "const onlineOwners = activeNonGmOwners(actor)",
    );
    expect(implementation).toContain("canRequest: game.user?.isGM === true");
  });

  it("registers player request delivery only after Foundry is ready", () => {
    expect(implementation).not.toContain(
      "export function registerD6System2eQuickbars(): void {\n  registerRollRequestSocket();",
    );
    expect(implementation).toContain(
      'Hooks.once("ready", () => {\n    registerRollRequestSocket();',
    );
  });

  it("offers takeover only after failure or owner disconnection", () => {
    expect(implementation).toContain(
      "task.remoteFailed || (!controllerOnline && task.cancellable)",
    );
    expect(implementation).toContain("D6E2.Tasks.StillOnline");
    expect(implementation).toContain(
      "Math.ceil((task.expiresAt - now) / 1000)",
    );
  });
});
