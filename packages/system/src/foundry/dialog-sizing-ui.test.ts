import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../../../../styles/d6-system-2e.css", import.meta.url),
  "utf8",
);
const characterSheet = readFileSync(
  new URL("./sheets/character-sheet.ts", import.meta.url),
  "utf8",
);
const rollService = readFileSync(
  new URL("./rolls/roll-service.ts", import.meta.url),
  "utf8",
);
const sourceRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function productionTypescriptFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionTypescriptFiles(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")
      ? [path]
      : [];
  });
}

describe("system dialog sizing", () => {
  it("caps every system-styled dialog to a content-sized responsive surface", () => {
    expect(styles).toContain("max-width: min(560px, calc(100vw - 32px));");
    expect(styles).toContain("max-height: calc(100vh - 32px);");
    expect(styles).toContain(
      ".application.od6roll-dialog:is(\n    .d6e2-template-dialog,",
    );
    expect(styles).toContain("max-width: min(720px, calc(100vw - 32px));");
    expect(styles).toContain("max-width: min(520px, calc(100vw - 32px));");
  });

  it("opens Character Template at the wide dialog tier without using the viewport", () => {
    expect(characterSheet).toContain(
      'classes: ["d6e2", "od6roll-dialog", "d6e2-template-dialog"],',
    );
    expect(characterSheet).toContain("position: { width: 720 }");
    expect(styles).toContain("@media (max-width: 560px)");
    expect(styles).toContain(
      "grid-template-columns: repeat(2, minmax(0, 1fr));",
    );
    expect(styles).toContain("@media (max-width: 380px)");
  });

  it("opens the ordinary roll dialog at its usable wide tier", () => {
    expect(rollService).toMatch(
      /classes:\s*\["d6e2",\s*"d6e2-roll-dialog",\s*"od6roll-dialog"\][\s\S]*?position:\s*\{\s*width:\s*720\s*\}/,
    );
    expect(styles).toMatch(
      /\.application\.od6roll-dialog\.d6e2-roll-dialog\s*\{[^}]*min-width:\s*min\(620px, calc\(100vw - 32px\)\);/s,
    );
    expect(rollService).toMatch(
      /const scrollOwner =\s*dialog\.element\.querySelector<HTMLElement>\("\.dialog-content"\);/,
    );
    expect(rollService).toContain("scrollOwner.tabIndex = 0;");
    expect(rollService).toContain(
      'scrollOwner.setAttribute("role", "region");',
    );
    expect(rollService).toContain("control.focus({ preventScroll: true });");
    expect(rollService).toContain("scrollOwner.scrollTop = 0;");
  });

  it("keeps tall ordinary rolls inside one keyboard and wheel scroll plane with a reachable footer", () => {
    expect(styles).toMatch(
      /\.application\.od6roll-dialog\.d6e2-roll-dialog\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*overflow:\s*hidden;/s,
    );
    expect(styles).toMatch(
      /\.application\.od6roll-dialog\.d6e2-roll-dialog\s*>\s*\.window-content\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s,
    );
    expect(styles).toMatch(
      /\.application\.od6roll-dialog\.d6e2-roll-dialog\s+\.dialog-form\s*\{[^}]*grid-template-rows:\s*minmax\(0, 1fr\) auto;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s,
    );
    expect(styles).toMatch(
      /\.application\.od6roll-dialog\.d6e2-roll-dialog\s+\.dialog-content\s*\{[^}]*min-height:\s*0;[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain;[^}]*scrollbar-gutter:\s*stable;/s,
    );
    expect(styles).toMatch(
      /\.application\.od6roll-dialog\.d6e2-roll-dialog\s+\.form-footer\s*\{[^}]*flex:\s*0 0 auto;/s,
    );
    expect(styles).toMatch(
      /@media\s*\(max-height:\s*560px\)[\s\S]*?\.application\.od6roll-dialog\.d6e2-roll-dialog\s*\{[^}]*max-height:\s*calc\(100dvh - 16px\);/s,
    );

    // The difficulty combobox may paint above its section, but it remains
    // inside the sole content scroller rather than creating another owner.
    expect(styles).toContain(
      ".od6roll-shell:has(.od6roll-difficulty-combobox) {\n  overflow: visible;",
    );
  });

  it("keeps Wild and injury dialog actions at the scoped 44px target contract", () => {
    expect(styles).toContain("--d6e2-dialog-action-min-size: 44px;");
    expect(styles).toContain(
      ".application:is(.d6e2-wild-dialog, .d6e2-hero-point-dialog)",
    );
    expect(styles).toContain(
      "min-height: var(--d6e2-dialog-action-min-size, 44px);",
    );
    expect(styles).not.toContain(
      ".application.d6e2-wild-dialog .form-footer button {\n  min-height: 42px;",
    );
  });

  it("places every system DialogV2 surface inside the sizing contract", () => {
    const unstyledDialogs: string[] = [];
    let dialogCount = 0;
    for (const path of productionTypescriptFiles(sourceRoot)) {
      const source = readFileSync(path, "utf8");
      let offset = 0;
      while ((offset = source.indexOf("DialogV2.wait", offset)) >= 0) {
        dialogCount += 1;
        const nextDialog = source.indexOf("DialogV2.wait", offset + 12);
        const windowOption = source.indexOf("window:", offset);
        const options = source.slice(
          offset,
          windowOption >= 0 && (nextDialog < 0 || windowOption < nextDialog)
            ? windowOption
            : offset + 5000,
        );
        const hasSystemClass = /classes:\s*\[[^\]]*"d6e2"[^\]]*\]/s.test(
          options,
        );
        const usesSharedCap = options.includes('"od6roll-dialog"');
        const declaresWidth = /position:\s*\{[^}]*width:\s*\d+/s.test(options);
        if (!hasSystemClass || (!usesSharedCap && !declaresWidth)) {
          const line = source.slice(0, offset).split("\n").length;
          unstyledDialogs.push(`${path}:${line}`);
        }
        offset += 12;
      }
    }

    expect(dialogCount).toBe(80);
    expect(unstyledDialogs).toEqual([]);
  });
});
