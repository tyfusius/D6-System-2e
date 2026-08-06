import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyRulesProfilePresentation,
  rulesProfileWordmark,
} from "./rules-profile-presentation";

const styles = readFileSync(
  new URL("../../../../styles/d6-system-2e.css", import.meta.url),
  "utf8",
);

afterEach(() => {
  Reflect.deleteProperty(globalThis, "document");
});

describe("rules profile presentation", () => {
  it("uses concise edition-specific background wordmarks", () => {
    expect(rulesProfileWordmark("second-edition")).toBe("D62e");
    expect(rulesProfileWordmark("open-d6")).toBe("OPEN D6");
    expect(rulesProfileWordmark("custom")).toBe("D62e");
  });

  it("applies the live wordmark and profile marker to the document root", () => {
    const properties = new Map<string, string>();
    const root = {
      dataset: {} as Record<string, string>,
      style: {
        setProperty: (name: string, value: string) => {
          properties.set(name, value);
        },
      },
    };
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { documentElement: root },
    });

    applyRulesProfilePresentation("open-d6");

    expect(root.dataset.d6System2eRulesProfile).toBe("open-d6");
    expect(properties.get("--od6-theme-mark")).toBe('"OPEN D6"');
  });

  it("keeps every diffuse wordmark inside its clipped surface", () => {
    expect(styles).not.toMatch(
      /(?:right|inset-inline-end):\s*-[\d.]+rem;[\s\S]{0,240}content:\s*var\(--od6-theme-mark\)/u,
    );
    expect(styles.match(/content:\s*var\(--od6-theme-mark\)/gu)).toHaveLength(
      5,
    );
    expect(styles).toMatch(
      /\.od6chat-dice\s*>\s*\.is-wild::before\s*\{[\s\S]{0,320}background-image:\s*var\(--od6-chat-wild-mark-image\)/u,
    );
  });
});
