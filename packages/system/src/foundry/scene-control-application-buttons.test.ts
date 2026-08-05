import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { shouldLaunchWithoutCanvas } from "./scene-control-application-buttons";

const quickbars = readFileSync(
  new URL("./quickbars.ts", import.meta.url),
  "utf8",
);
const bestiary = readFileSync(
  new URL("./bestiary-browser.ts", import.meta.url),
  "utf8",
);

describe("scene-control application launchers", () => {
  it("uses the direct launcher only while Foundry has no ready canvas", () => {
    expect(shouldLaunchWithoutCanvas(false)).toBe(true);
    expect(shouldLaunchWithoutCanvas(true)).toBe(false);
  });

  it("registers every non-canvas utility window for the fallback path", () => {
    expect(quickbars).toContain('"d6System2eGmQuickbar"');
    expect(quickbars).toContain('"d6System2eActiveTasks"');
    expect(bestiary).toContain('"d6System2eBestiary"');
  });
});
