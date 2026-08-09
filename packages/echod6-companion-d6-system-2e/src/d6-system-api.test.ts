import { describe, expect, it, vi } from "vitest";
import { isD6SystemPublicApi } from "./d6-system-api";

function candidate(includeSelection = true): Record<string, unknown> {
  const registry = {
    register: vi.fn(),
    unregisterOwner: vi.fn(),
  };
  return {
    apiVersion: 2,
    rules: { activate: vi.fn() },
    rulesProfileRegistry: registry,
    profilePreset: { activate: vi.fn() },
    profilePresetRegistry: registry,
    setting: {
      activate: vi.fn(),
      ...(includeSelection ? { selection: vi.fn() } : {}),
    },
    settingProfileRegistry: registry,
    systemId: "d6-system-2e",
    terminology: registry,
    themes: registry,
  };
}

describe("D6 System public API guard", () => {
  it("accepts API v2 with the selected-Setting-Profile reader", () => {
    expect(isD6SystemPublicApi(candidate())).toBe(true);
  });

  it("rejects an API that cannot expose the selected Setting Profile", () => {
    expect(isD6SystemPublicApi(candidate(false))).toBe(false);
  });
});
