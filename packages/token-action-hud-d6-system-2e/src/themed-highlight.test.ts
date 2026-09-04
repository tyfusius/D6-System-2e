import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = resolve(
  process.cwd(),
  "packages/token-action-hud-d6-system-2e",
);

function packageFile(path: string): string {
  return readFileSync(resolve(packageRoot, path), "utf8");
}

function ruleBodyForSelector(styles: string, selector: string): string | null {
  const normalize = (value: string): string =>
    value.replace(/\s+/gu, " ").trim();
  const expected = normalize(selector);
  for (const match of styles.matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
    const header = match[1];
    const body = match[2];
    if (header === undefined || body === undefined) continue;
    const selectors = header.split(",").map(normalize).filter(Boolean);
    if (selectors.includes(expected)) return body;
  }
  return null;
}

interface CssRule {
  readonly selectors: readonly string[];
  readonly body: string;
  readonly order: number;
}

function cssRules(styles: string): readonly CssRule[] {
  const normalize = (value: string): string =>
    value.replace(/\s+/gu, " ").trim();
  return [...styles.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].flatMap(
    (match, order) => {
      const header = match[1];
      const body = match[2];
      if (header === undefined || body === undefined) return [];
      return [
        {
          selectors: header.split(",").map(normalize).filter(Boolean),
          body,
          order,
        },
      ];
    },
  );
}

function selectorSpecificity(
  selector: string,
): readonly [number, number, number] {
  const ids = selector.match(/#[\w-]+/gu)?.length ?? 0;
  const classesAndPseudos =
    selector.match(/(?:\.[\w-]+|:[\w-]+)/gu)?.length ?? 0;
  const elements = selector
    .replace(/#[\w-]+|\.[\w-]+|:[\w-]+/gu, " ")
    .split(/[\s>+~]+/u)
    .filter(Boolean).length;
  return [ids, classesAndPseudos, elements];
}

function compareSpecificity(
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): number {
  for (let index = 0; index < left.length; index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function matchesFocusedOpenGroup(selector: string): boolean {
  const scoped =
    selector.includes("body.system-d6-system-2e") &&
    selector.includes("#token-action-hud-app") &&
    selector.includes("#token-action-hud");
  if (!scoped || selector.includes(".tah-button-box.active")) return false;
  return (
    selector.includes(".tah-tab-group.hover > .tah-group-button") ||
    selector.includes(".tah-button-box:focus-visible")
  );
}

function declaration(body: string, property: string): string | null {
  for (const entry of body.split(";")) {
    const separator = entry.indexOf(":");
    if (separator < 0) continue;
    if (entry.slice(0, separator).trim() !== property) continue;
    return entry
      .slice(separator + 1)
      .replace(/\s+/gu, " ")
      .trim();
  }
  return null;
}

function winningFocusedOpenGroupDeclaration(
  styles: string,
  property: string,
): string | null {
  let winner:
    | {
        readonly value: string;
        readonly specificity: readonly [number, number, number];
        readonly order: number;
      }
    | undefined;
  for (const rule of cssRules(styles)) {
    const value = declaration(rule.body, property);
    if (value === null) continue;
    for (const selector of rule.selectors) {
      if (!matchesFocusedOpenGroup(selector)) continue;
      const specificity = selectorSpecificity(selector);
      if (
        winner === undefined ||
        compareSpecificity(specificity, winner.specificity) > 0 ||
        (compareSpecificity(specificity, winner.specificity) === 0 &&
          rule.order > winner.order)
      ) {
        winner = { value, specificity, order: rule.order };
      }
    }
  }
  return winner?.value ?? null;
}

interface RenderedHudGroupButton {
  readonly classes: readonly string[];
  readonly parentClasses: readonly string[];
  readonly pointerOverButton: boolean;
}

function matchesOpenGroupLifecycle(
  selector: string,
  button: RenderedHudGroupButton,
): boolean {
  return (
    selector.endsWith(".tah-tab-group.hover > .tah-group-button") &&
    button.classes.includes("tah-group-button") &&
    !button.classes.includes("active") &&
    button.parentClasses.includes("tah-tab-group") &&
    button.parentClasses.includes("hover")
  );
}

function relativeLuminance(color: string): number {
  if (!/^#[\da-f]{6}$/iu.test(color)) {
    throw new Error(`Expected a six-digit hex color, received ${color}`);
  }
  const channelLuminance = (offset: number): number => {
    const channel = Number.parseInt(color.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  };
  return (
    channelLuminance(1) * 0.2126 +
    channelLuminance(3) * 0.7152 +
    channelLuminance(5) * 0.0722
  );
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

describe("Personal Theme Token Action HUD highlight", () => {
  it("loads a D6-owned adapter stylesheet after the required HUD Core module", () => {
    const manifest = JSON.parse(packageFile("module.json")) as {
      readonly relationships?: {
        readonly requires?: readonly { readonly id?: string }[];
      };
      readonly styles?: readonly string[];
    };

    expect(manifest.relationships?.requires?.map(({ id }) => id)).toContain(
      "token-action-hud-core",
    );
    expect(manifest.styles).toEqual([
      "styles/token-action-hud-d6-system-2e.css",
    ]);
  });

  it("derives the active highlight from the effective client theme without a fixed color", () => {
    const styles = packageFile("styles/token-action-hud-d6-system-2e.css");
    const activeRule =
      /body\.system-d6-system-2e\s+#token-action-hud-app[\s\S]*?\.tah-button-box\.active\s*\{([^}]*)\}/u.exec(
        styles,
      )?.[1];

    expect(styles).toContain(
      "--d6e2-tah-highlight: var(--od6-accent, var(--d6e2-accent));",
    );
    expect(styles).toMatch(
      /--d6e2-tah-highlight-strong:\s*var\(\s*--od6-accent-bright,\s*var\(--d6e2-accent-bright\)\s*\);/u,
    );
    expect(activeRule).not.toContain("outline:");
    expect(activeRule).toContain("font-weight: 700;");
    expect(activeRule).toContain("0 0 0 1px var(--d6e2-tah-highlight-strong)");
    expect(activeRule).toContain("var(--d6e2-tah-highlight-strong)");
    expect(activeRule).toContain("var(--d6e2-tah-highlight)");
    expect(activeRule).not.toContain("inset 0 0 0 4px");
    expect(activeRule).toContain("!important");
    expect(activeRule).not.toMatch(/#[\da-f]{3,8}|rgba?\(/iu);
  });

  it("themes the real open-group lifecycle even without an active action class", () => {
    const styles = packageFile("styles/token-action-hud-d6-system-2e.css");
    const openGroupSelector =
      "body.system-d6-system-2e #token-action-hud-app #token-action-hud .tah-groups .tah-tab-group.hover > .tah-group-button";
    const openGroupRule = ruleBodyForSelector(styles, openGroupSelector);
    const renderedOpenGroup: RenderedHudGroupButton = {
      classes: ["tah-group-button", "tah-button-box", "disable-edit"],
      parentClasses: ["tah-tab-group", "hover"],
      // Core keeps the parent lifecycle class while the pointer moves into the
      // revealed action list, so the selected cue must not depend on :hover.
      pointerOverButton: false,
    };

    expect(
      matchesOpenGroupLifecycle(openGroupSelector, renderedOpenGroup),
    ).toBe(true);
    expect(renderedOpenGroup.pointerOverButton).toBe(false);
    expect(openGroupSelector).not.toContain(":hover");
    expect(openGroupRule).not.toContain("outline:");
    expect(openGroupRule).toContain("font-weight: 700;");
    expect(openGroupRule).toContain(
      "0 0 0 1px var(--d6e2-tah-highlight-strong)",
    );
    expect(openGroupRule).not.toContain("inset 0 0 0 4px");
    expect(openGroupRule).toContain("var(--d6e2-tah-highlight)");
    expect(openGroupRule).toContain("!important");
  });

  it("keeps keyboard focus dashed when the currently open group is focused", () => {
    const styles = packageFile("styles/token-action-hud-d6-system-2e.css");

    expect(winningFocusedOpenGroupDeclaration(styles, "outline")).toBe(
      "2px dashed var(--tah-text-primary-color, var(--od6-text))",
    );
    expect(winningFocusedOpenGroupDeclaration(styles, "outline-offset")).toBe(
      "-2px",
    );
    expect(winningFocusedOpenGroupDeclaration(styles, "box-shadow")).toBe(
      "none !important",
    );
  });

  it("keeps focus visibly distinct without changing hover or layout geometry", () => {
    const styles = packageFile("styles/token-action-hud-d6-system-2e.css");
    const focusRule = ruleBodyForSelector(
      styles,
      "body.system-d6-system-2e #token-action-hud-app #token-action-hud .tah-button-box:focus-visible",
    );

    expect(focusRule).toContain(
      "outline: 2px dashed var(--tah-text-primary-color, var(--od6-text));",
    );
    expect(focusRule).toContain("outline-offset: -2px;");
    expect(focusRule).toContain("box-shadow: none !important;");
    expect(styles).not.toMatch(
      /\.tah-button-box(?::not\([^)]*\))?:hover\s*\{/u,
    );
    expect(focusRule).not.toMatch(
      /\b(?:height|inset|max-height|max-width|min-height|min-width|overflow|position|width)\s*:/u,
    );
  });

  it("uses one theme-colored active edge and one skin-relative focus edge", () => {
    const styles = packageFile("styles/token-action-hud-d6-system-2e.css");
    const activeRule =
      /body\.system-d6-system-2e\s+#token-action-hud-app[\s\S]*?\.tah-button-box\.active\s*\{([^}]*)\}/u.exec(
        styles,
      )?.[1];
    const focusRule = ruleBodyForSelector(
      styles,
      "body.system-d6-system-2e #token-action-hud-app #token-action-hud .tah-button-box:focus-visible",
    );

    expect(activeRule).not.toContain("outline:");
    expect(activeRule).toContain("0 0 0 1px var(--d6e2-tah-highlight-strong)");
    expect(activeRule).not.toContain("inset 0 0 0 4px");
    expect(focusRule).toContain(
      "outline: 2px dashed var(--tah-text-primary-color, var(--od6-text));",
    );
    expect(focusRule).toContain("outline-offset: -2px;");
    expect(`${activeRule}\n${focusRule}`).not.toMatch(
      /outline-offset:\s*[1-9]/u,
    );

    const reducedRule = ruleBodyForSelector(
      styles,
      'html[data-d6e2-visual-effects-resolved="reduced"] body.system-d6-system-2e #token-action-hud-app #token-action-hud .tah-button-box.active',
    );
    expect(reducedRule).toContain(
      "box-shadow: 0 0 0 1px var(--d6e2-tah-highlight-strong) !important;",
    );

    // Negative outline offsets keep both structural cues adjacent to Core's
    // known button surfaces instead of the arbitrary game canvas behind the
    // transparent HUD container.
    const bundledSkinPairs = [
      {
        skin: "Foundry light",
        foreground: "#000000",
        activeSurface: "#ffffff",
        focusSurface: "#d7c9aa",
      },
      {
        skin: "Foundry dark",
        foreground: "#efe6d8",
        activeSurface: "#3c0078",
        focusSurface: "#0b0a13",
      },
      {
        skin: "High contrast",
        foreground: "#ffff00",
        activeSurface: "#0c7bdc",
        focusSurface: "#000000",
      },
    ] as const;
    for (const {
      skin,
      foreground,
      activeSurface,
      focusSurface,
    } of bundledSkinPairs) {
      expect(
        contrastRatio(foreground, activeSurface),
        `${skin} active structural ring contrast`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrastRatio(foreground, focusSurface),
        `${skin} focus structural ring contrast`,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});
