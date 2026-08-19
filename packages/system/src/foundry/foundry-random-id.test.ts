import { afterEach, describe, expect, it, vi } from "vitest";
import { foundryRandomId } from "./foundry-random-id";

describe("Foundry-compatible random IDs", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses Foundry randomID when browser randomUUID is unavailable", () => {
    const randomID = vi.fn(() => "foundry-player-request");
    vi.stubGlobal("crypto", {});
    vi.stubGlobal("foundry", { utils: { randomID } });

    expect(foundryRandomId()).toBe("foundry-player-request");
    expect(randomID).toHaveBeenCalledWith(24);
  });

  it("retains a Web Crypto fallback for isolated non-Foundry tests", () => {
    vi.stubGlobal("foundry", {});
    vi.stubGlobal("crypto", {
      randomUUID: () => "12345678-1234-1234-1234-123456789abc",
    });

    expect(foundryRandomId()).toBe("12345678123412341234123456789abc");
  });
});
