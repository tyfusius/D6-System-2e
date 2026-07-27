import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleCombatUpdate } from "./combat-hooks";

const render = vi.fn();

beforeEach(() => {
  render.mockClear();
  vi.stubGlobal("game", {
    actors: { contents: [{ sheet: { render } }] },
  });
});

describe("combat round sheet refresh", () => {
  it("refreshes sheets when the round changes", () => {
    handleCombatUpdate({}, { round: 2 });
    expect(render).toHaveBeenCalledWith(false);
  });

  it("does not refresh sheets for unrelated combat updates", () => {
    handleCombatUpdate({}, { turn: 1 });
    expect(render).not.toHaveBeenCalled();
  });
});
