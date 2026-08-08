import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const logo = readFileSync(
  new URL("../../../../assets/ui/d6-pause-cube.png", import.meta.url),
);
const styles = readFileSync(
  new URL("../../../../styles/d6-system-2e.css", import.meta.url),
  "utf8",
);
const settingsSource = readFileSync(
  new URL("../settings/system-settings.ts", import.meta.url),
  "utf8",
);

describe("system pause logo", () => {
  it("ships a square transparent PNG at pause-display resolution", () => {
    expect(logo.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(logo.readUInt32BE(16)).toBe(768);
    expect(logo.readUInt32BE(20)).toBe(768);
    expect(logo[25]).toBe(6);
  });

  it("keeps the cube stationary while independently animating its orbit", () => {
    expect(styles).toContain("body.system-d6-system-2e #pause img");
    expect(styles).toContain('url("../assets/ui/d6-pause-cube.png")');
    expect(styles).toContain("animation: d6e2-pause-cube-breathe");
    expect(styles).toContain("animation: d6e2-pause-orbit 16s");
    expect(styles).toContain("animation: d6e2-pause-orbit-reverse 24s");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(
      /#pause::after \{[\s\S]*?transform: translate\(-50%, -50%\);/u,
    );
    expect(styles).not.toContain("border-radius: 28%");
    expect(styles).toContain("padding-top: 18px");
    expect(styles).toContain("top: calc(50% - 9px)");
  });

  it("resolves the active Setting Profile logo through Foundry's route prefix", () => {
    expect(settingsSource).toContain("foundry.utils.getRoute(pauseIcon)");
    expect(settingsSource).toContain("const profile = currentSettingProfile()");
    expect(settingsSource).toContain("resolvePauseIcon(profile, selected)");
    expect(settingsSource).not.toContain(
      '`url("${selected.pauseIcon ?? "systems/',
    );
  });
});
