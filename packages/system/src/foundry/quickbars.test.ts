import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const implementation = readFileSync(
  new URL("./quickbars.ts", import.meta.url),
  "utf8",
);

describe("OpenD6 Next quickbar toolbar contract", () => {
  it("registers setting-dependent Token Controls buttons for both quickbars", () => {
    expect(implementation).toContain('Hooks.on("getSceneControlButtons"');
    expect(implementation).toContain("if (pcQuickbarEnabled())");
    expect(implementation).toContain("if (activeTasksQuickbarEnabled())");
    expect(implementation).toContain('icon: "fa-solid fa-people-group"');
    expect(implementation).toContain('icon: "fa-solid fa-list-check"');
  });

  it("keeps toolbar buttons able to reopen manually closed windows", () => {
    expect(implementation).toContain("export function togglePcQuickbar()");
    expect(implementation).toContain(
      "export function toggleActiveTasksQuickbar()",
    );
    expect(implementation).toContain(
      "if (pcQuickbar?.rendered) void pcQuickbar.close()",
    );
    expect(implementation).toContain(
      "if (tasksQuickbar?.rendered) void tasksQuickbar.close()",
    );
  });

  it("refreshes Scene Controls when quickbar settings change", () => {
    expect(implementation).toContain("ui.controls?.render({ reset: true })");
  });
});
