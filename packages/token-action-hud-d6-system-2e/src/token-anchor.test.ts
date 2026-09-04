import { describe, expect, it } from "vitest";
import { placeFlyout, positionBesideToken } from "./token-anchor";

describe("token-relative HUD positioning", () => {
  it("places the HUD to the right of a token when space is available", () => {
    expect(
      positionBesideToken(
        { x: 100, y: 100, width: 50, height: 50 },
        { width: 240, height: 180 },
        { width: 1000, height: 700 },
      ),
    ).toEqual({ left: 162, top: 35 });
  });

  it("flips left and clamps inside the viewport near an edge", () => {
    expect(
      positionBesideToken(
        { x: 940, y: 10, width: 50, height: 50 },
        { width: 240, height: 180 },
        { width: 1000, height: 700 },
      ),
    ).toEqual({ left: 688, top: 8 });
  });
});

describe("expanded HUD flyout placement", () => {
  it("keeps a flyout below when the full menu fits", () => {
    expect(placeFlyout({ y: 100, height: 30 }, 180, 700)).toEqual({
      direction: "down",
      maxHeight: 562,
    });
  });

  it("flips a flyout above the hotbar-safe viewport edge", () => {
    expect(placeFlyout({ y: 560, height: 30 }, 360, 650)).toEqual({
      direction: "up",
      maxHeight: 552,
    });
  });

  it("chooses the larger side and exposes a scroll-height cap", () => {
    expect(placeFlyout({ y: 290, height: 30 }, 600, 500)).toEqual({
      direction: "up",
      maxHeight: 282,
    });
  });
});
