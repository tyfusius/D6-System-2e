import { afterEach, describe, expect, it, vi } from "vitest";
import { currentFirstEditionDamageMode } from "./setting-values";

afterEach(() => vi.unstubAllGlobals());

function useValue(value: unknown): void {
  vi.stubGlobal("game", {
    settings: { get: () => value },
  });
}

describe("First Edition damage mode setting", () => {
  it.each([
    ["wounds", "wounds"],
    ["body-points", "body-points"],
    ["body-points-with-wounds", "body-points-with-wounds"],
    [false, "wounds"],
    [true, "body-points"],
    ["false", "wounds"],
    ["true", "body-points"],
    ["invalid", "wounds"],
  ])("normalizes %j to %s", (stored, expected) => {
    useValue(stored);
    expect(currentFirstEditionDamageMode()).toBe(expected);
  });
});
