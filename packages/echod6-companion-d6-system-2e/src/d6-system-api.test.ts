import { describe, expect, it, vi } from "vitest";
import { isD6SystemPublicApi } from "./d6-system-api";

function candidate(includeSelection = true): Record<string, unknown> {
  const registry = {
    register: vi.fn(),
    unregisterOwner: vi.fn(),
  };
  return {
    apiVersion: 1,
    campaignPackages: {
      ...registry,
      ...(includeSelection ? { selection: vi.fn() } : {}),
    },
    rules: { applyPreset: vi.fn() },
    systemId: "d6-system-2e",
    terminology: registry,
    themes: registry,
  };
}

describe("D6 System public API guard", () => {
  it("accepts API v1 with the selected-package reader", () => {
    expect(isD6SystemPublicApi(candidate())).toBe(true);
  });

  it("rejects an API that cannot expose selected packages", () => {
    expect(isD6SystemPublicApi(candidate(false))).toBe(false);
  });
});
