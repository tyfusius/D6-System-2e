import { beforeEach, describe, expect, it, vi } from "vitest";
import { configuredSpecializationsPerSkillLimit } from "./specialization-rules";

const settingsGet = vi.hoisted(() => vi.fn(() => 0));

describe("Second Edition Specialization limit setting", () => {
  beforeEach(() => {
    vi.stubGlobal("game", {
      settings: { get: settingsGet },
    });
    settingsGet.mockReturnValue(0);
  });

  it("uses the printed phase-specific rule when the setting is zero", () => {
    expect(configuredSpecializationsPerSkillLimit()).toBeNull();
  });

  it("normalizes a positive fixed per-Skill limit", () => {
    settingsGet.mockReturnValue(4);
    expect(configuredSpecializationsPerSkillLimit()).toBe(4);

    settingsGet.mockReturnValue(99);
    expect(configuredSpecializationsPerSkillLimit()).toBe(20);
  });
});
