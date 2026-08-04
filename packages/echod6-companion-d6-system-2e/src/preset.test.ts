import { describe, expect, it, vi } from "vitest";
import type { D6SystemPublicApi } from "./d6-system-api";
import { applyEchoPreset } from "./preset";

describe("Echo recommended-rules action", () => {
  it("delegates to the public Open D6 preset", async () => {
    const result = { applied: [], failed: [], unchanged: ["rulesProfile"] };
    const applyPreset = vi.fn(() => Promise.resolve(result));
    const api = { rules: { applyPreset } } as unknown as D6SystemPublicApi;

    await expect(applyEchoPreset(api)).resolves.toBe(result);
    expect(applyPreset).toHaveBeenCalledWith("open-d6");
  });
});
