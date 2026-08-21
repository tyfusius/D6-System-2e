import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyVisualEffectsPreference,
  resolveVisualEffects,
} from "./visual-effects";

function mediaQueryList() {
  return {
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

let media = mediaQueryList();

function installDom(preference = "automatic") {
  const root = { dataset: {} as Record<string, string> };
  vi.stubGlobal("document", { documentElement: root });
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => media),
  );
  vi.stubGlobal("game", {
    settings: { get: vi.fn(() => preference) },
  });
  return root.dataset;
}

afterEach(() => {
  vi.unstubAllGlobals();
  media = mediaQueryList();
});

describe("visual effects resolution", () => {
  it.each([
    ["automatic", false, "full"],
    ["automatic", true, "reduced"],
    ["full", true, "full"],
    ["reduced", false, "reduced"],
  ] as const)("resolves %s with OS=%s to %s", (preference, os, expected) => {
    expect(resolveVisualEffects(preference, os)).toBe(expected);
  });

  it("writes the raw and resolved markers immediately", () => {
    const dataset = installDom("reduced");
    applyVisualEffectsPreference("reduced");
    expect(dataset).toMatchObject({
      d6e2VisualEffects: "reduced",
      d6e2VisualEffectsResolved: "reduced",
    });
  });

  it("persists Automatic as a client setting and follows OS changes", () => {
    const dataset = installDom("automatic");
    applyVisualEffectsPreference();
    expect(dataset.d6e2VisualEffectsResolved).toBe("full");
    expect(media.addEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
    media.matches = true;
    const listener = media.addEventListener.mock.calls[0]?.[1] as
      (() => void) | undefined;
    expect(listener).toBeDefined();
    listener?.();
    expect(dataset.d6e2VisualEffectsResolved).toBe("reduced");
  });

  it("stops following the OS for an explicit mode", () => {
    installDom("automatic");
    applyVisualEffectsPreference("automatic");
    expect(media.addEventListener).toHaveBeenCalledOnce();
    applyVisualEffectsPreference("full");
    expect(media.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
  });

  it("normalizes an invalid stored value to Automatic", () => {
    const dataset = installDom("unexpected");
    applyVisualEffectsPreference();
    expect(dataset).toMatchObject({
      d6e2VisualEffects: "automatic",
      d6e2VisualEffectsResolved: "full",
    });
  });
});

describe("reduced-effects CSS boundary", () => {
  const reducedRoot = 'html[data-d6e2-visual-effects-resolved="reduced"]';

  function reducedRuleBody(css: string, selector: string): string {
    let searchFrom = 0;
    while (searchFrom < css.length) {
      const rootStart = css.indexOf(reducedRoot, searchFrom);
      if (rootStart < 0) return "";
      const open = css.indexOf("{", rootStart);
      const close = open < 0 ? -1 : css.indexOf("}", open);
      if (open >= 0 && close >= 0) {
        const header = css.slice(rootStart, open);
        if (header.includes(selector)) return css.slice(open + 1, close);
      }
      searchFrom = rootStart + reducedRoot.length;
    }
    return "";
  }

  function reducedRuleBodies(css: string, selector: string): string[] {
    const bodies: string[] = [];
    let searchFrom = 0;
    while (searchFrom < css.length) {
      const rootStart = css.indexOf(reducedRoot, searchFrom);
      if (rootStart < 0) return bodies;
      const open = css.indexOf("{", rootStart);
      const close = open < 0 ? -1 : css.indexOf("}", open);
      if (open >= 0 && close >= 0) {
        const header = css.slice(rootStart, open);
        if (header.includes(selector)) bodies.push(css.slice(open + 1, close));
      }
      searchFrom = rootStart + reducedRoot.length;
    }
    return bodies;
  }

  it("keeps reduced treatment system-owned and static", async () => {
    const css = await readFile("styles/d6-system-2e.css", "utf8");
    expect(css).toContain(reducedRoot);
    expect(css).not.toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".chat-message");
    expect(css).toContain(".od6item-hero");
    expect(reducedRuleBody(css, '.od6pc-request[aria-busy="true"]')).toContain(
      "animation: none;",
    );
    expect(reducedRuleBody(css, '.od6pc-score[aria-busy="true"]')).toContain(
      "animation: none;",
    );
    const itemSheetRules = reducedRuleBodies(css, ".application.od6s-item-v2");
    expect(itemSheetRules).toContainEqual(
      expect.stringContaining("backdrop-filter: none !important;"),
    );
    expect(itemSheetRules).toContainEqual(
      expect.stringContaining("box-shadow: none !important;"),
    );
    expect(css).toContain(".od6-artwork-echo");
    expect(css).toContain("opacity: 0;");
    expect(css).toContain('[data-requested-roll="true"]::after');
    expect(css).toContain("animation: none;");
    expect(css).not.toMatch(
      /data-d6e2-visual-effects-resolved="reduced"[^}]*#pause[^}]*background/,
    );
    expect(css).not.toContain(".od6v2-sheet img");
    expect(css).not.toContain(".od6-artwork-primary {\n  filter: none");
    expect(css).toContain(".od6roll-dialog");
    expect(css).toContain(".od6-pc-quickbar");
    expect(css).toContain(".d6e2-settings-v2");
    expect(css).toContain(".d6e2-setting-profile");
    expect(css).toContain(".d6e2-rules-profile");
    expect(css).toContain("*::before");
    expect(css).toContain("*::after");
    expect(css).toContain("animation: none !important;");
    expect(css).toContain("transition: none !important;");
  });
});
