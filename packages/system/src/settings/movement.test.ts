import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  currentMovementRuntimeStrategy,
  movementRuntimeStrategy,
} from "./movement";

let configured = "d6e2.movement.segmented";
const settings = new Map<string, unknown>();

vi.mock("./rules-profile-library", () => ({
  currentConfiguredRulesProfile: () => ({
    strategies: { movement: configured },
  }),
}));

beforeEach(() => {
  configured = "d6e2.movement.segmented";
  settings.clear();
  vi.stubGlobal("game", {
    settings: { get: (_namespace: string, key: string) => settings.get(key) },
  });
});

describe("movement runtime strategies", () => {
  it("publishes immutable speed, posture, segment, and reaction contracts", () => {
    expect(movementRuntimeStrategy("d6e2.movement.segmented")).toEqual({
      check: "none",
      distance: "fixed-mode",
      family: "segmented",
      id: "d6e2.movement.segmented",
      posture: "standing-prone",
      reactive: "unsupported",
      segment: "declared-action",
      tokenCompletion: "complete-declared-action-after-translation",
    });
    expect(movementRuntimeStrategy("open-d6.movement.relative")).toMatchObject({
      check: "skill-or-attribute",
      distance: "relative-rate",
      posture: "untracked",
      segment: "free-or-action",
    });
    expect(Object.isFrozen(movementRuntimeStrategy(configured))).toBe(true);
  });

  it("derives segmented and non-chaining reactive movement without changing the relative family", () => {
    expect(
      movementRuntimeStrategy("open-d6.movement.relative", true),
    ).toMatchObject({
      family: "relative",
      id: "open-d6.movement.segmented",
      reactive: "consume-next-action-no-chain",
      segment: "round-robin-rate",
    });
  });

  it("honors the movement strategy selected by the active Rules Profile", () => {
    configured = "open-d6.movement.relative";
    expect(currentMovementRuntimeStrategy().id).toBe(
      "open-d6.movement.relative",
    );
  });

  it("refines Open D6 movement through the optional segment scheduler", () => {
    configured = "open-d6.movement.relative";
    settings.set("tyfusiusFirstEditionSegmentedActions", true);
    expect(currentMovementRuntimeStrategy()).toMatchObject({
      id: "open-d6.movement.segmented",
      reactive: "consume-next-action-no-chain",
    });
  });

  it("falls back safely for an unavailable contributed strategy", () => {
    configured = "community.movement.unavailable";
    expect(currentMovementRuntimeStrategy().id).toBe("d6e2.movement.segmented");
  });
});
