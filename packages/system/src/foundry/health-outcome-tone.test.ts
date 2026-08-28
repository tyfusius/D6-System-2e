import { describe, expect, it } from "vitest";
import { d6HealthOutcomeTone } from "./health-outcome-tone";

describe("initiating-root Health outcome palette", () => {
  it("uses the canonical stable-state palette and safe custom fallback", () => {
    expect(d6HealthOutcomeTone("healthy")).toBe("healthy");
    expect(d6HealthOutcomeTone("staggered")).toBe("staggered");
    expect(d6HealthOutcomeTone("stunned")).toBe("stunned");
    expect(d6HealthOutcomeTone("severely-wounded")).toBe("wounded");
    expect(d6HealthOutcomeTone("incapacitated")).toBe("incapacitated");
    expect(d6HealthOutcomeTone("mortally-wounded")).toBe("mortally-wounded");
    expect(d6HealthOutcomeTone("dead")).toBe("dead");
    expect(d6HealthOutcomeTone("custom-state")).toBe("custom");
    expect(d6HealthOutcomeTone(undefined)).toBe("custom");
  });
});
