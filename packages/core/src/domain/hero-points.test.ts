import { describe, expect, it } from "vitest";
import { heroPointBalanceAfter } from "./hero-points";

describe("Hero Point transaction", () => {
  it("applies one expenditure and an award atomically", () => {
    expect(heroPointBalanceAfter(2, 1, 2)).toBe(3);
  });

  it("rejects overspending", () => {
    expect(() => heroPointBalanceAfter(0, 1, 0)).toThrow(RangeError);
  });
});
