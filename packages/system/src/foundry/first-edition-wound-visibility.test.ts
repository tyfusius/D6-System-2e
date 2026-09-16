import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFirstEditionWoundRoot } from "../application/first-edition-wound-root";
import { excludesMovementSelfRollViewer } from "./first-edition-movement-visibility";
const gm = { id: "gm", isGM: true },
  otherGM = { id: "other-gm", isGM: true },
  owner = { id: "owner", isGM: false };
beforeEach(() => {
  vi.stubGlobal("game", {
    user: gm,
    users: {
      get: (id: string) => [gm, otherGM, owner].find((u) => u.id === id),
    },
  });
});
function message(
  wound: "stunned" | "wounded" = "wounded",
  mode = "selfroll",
  coordinator = "gm",
) {
  const root = createFirstEditionWoundRoot({
    rootMessageId: "root",
    coordinatorUserId: coordinator,
    controllerUserId: "owner",
    patient: { actorId: "patient", actorUuid: "Actor.patient" },
    runtime: {
      profileId: "first-edition",
      healthModelId: "open-d6.health.wound-track",
      damageStrategyId: "open-d6.damage.wounds",
    },
    source: { attributeId: "brawn" },
    operation: "natural",
    wound,
  });
  return {
    id: "root",
    author: gm,
    whisper:
      mode === "publicroll"
        ? []
        : mode === "selfroll"
          ? ["owner"]
          : ["gm", "other-gm"],
    blind: mode === "blindroll",
    getFlag: (_namespace: string, key: string) =>
      key === "firstEditionWoundRoot"
        ? root
        : key === "woundRootRollMode"
          ? mode
          : undefined,
  } as unknown as FoundryChatMessageDocument;
}
describe("Wound root Self-roll presentation", () => {
  it.each(["stunned", "wounded"] as const)(
    "hides pending %s Self contents from the native GM author and other viewers",
    (wound) => {
      const root = message(wound);
      expect(excludesMovementSelfRollViewer(root, "gm")).toBe(true);
      expect(excludesMovementSelfRollViewer(root, "other-gm")).toBe(true);
      expect(excludesMovementSelfRollViewer(root, "stranger")).toBe(true);
      expect(excludesMovementSelfRollViewer(root, "owner")).toBe(false);
    },
  );
  it("preserves Self protection when authority changes from the native author", () => {
    expect(
      excludesMovementSelfRollViewer(
        message("stunned", "selfroll", "other-gm"),
        "gm",
      ),
    ).toBe(true);
  });
  it.each(["publicroll", "gmroll", "blindroll"])(
    "leaves native %s filtering intact",
    (mode) => {
      expect(
        excludesMovementSelfRollViewer(message("wounded", mode), "gm"),
      ).toBe(false);
    },
  );
  it("does not change visibility of legacy standalone cards", () => {
    const root = message();
    root.getFlag = () => ({ kind: "firstEditionHealing", version: 1 });
    expect(excludesMovementSelfRollViewer(root, "gm")).toBe(false);
  });
});
