import { describe, expect, it } from "vitest";
import { chatVisibilityForMode } from "./chat-visibility";

describe("Foundry chat visibility adapter", () => {
  it("deduplicates private-GM recipients without freezing Foundry input", () => {
    const visibility = chatVisibilityForMode(
      "gmroll",
      ["gm-1", "gm-2"],
      "gm-1",
    );

    expect(visibility.whisper).toEqual(["gm-1", "gm-2"]);
    expect(Object.isFrozen(visibility.whisper)).toBe(false);
  });

  it("returns mutable recipient arrays for blind and self rolls", () => {
    const blind = chatVisibilityForMode("blindroll", ["gm-1"]);
    const self = chatVisibilityForMode("selfroll", [], "player-1");

    expect(blind).toEqual({ blind: true, whisper: ["gm-1"] });
    expect(self).toEqual({ whisper: ["player-1"] });
    expect(Object.isFrozen(blind.whisper)).toBe(false);
    expect(Object.isFrozen(self.whisper)).toBe(false);
  });

  it("adds no visibility fields to public rolls", () => {
    expect(chatVisibilityForMode("publicroll", ["gm-1"], "player-1")).toEqual(
      {},
    );
  });
});
