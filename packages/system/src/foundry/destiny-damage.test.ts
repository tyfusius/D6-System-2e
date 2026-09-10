import { beforeEach, describe, it, expect, vi } from "vitest";
import type {
  D6ActorHealthProjectionV1,
  D6DestinyEffectV1,
} from "@d6-system-2e/core";
const f = vi.hoisted(() => ({
  enabled: true,
  model: "open-d6.health.wound-track",
  fail: false,
  health: {} as D6ActorHealthProjectionV1,
  apply: vi.fn(),
}));
vi.mock("./destiny-service", () => ({
  destinyEnabled: () => f.enabled,
  destinyPrimaryGM: () => ({ id: "gm" }),
  destinyPublicState: () => ({ status: "active" }),
}));
vi.mock("../settings/rules-profile-library", () => ({
  currentConfiguredRulesProfile: () => ({}),
}));
vi.mock("../settings/health-model-library", () => ({
  SECOND_EDITION_CONDITION_TRACK_MODEL_ID: "d6e2.health.condition-track",
  OPEN_D6_WOUND_TRACK_MODEL_ID: "open-d6.health.wound-track",
  D6MV_INJURY_TRACK_MODEL_ID: "d6mv.health.injury-track",
  currentConfiguredHealthModel: () => ({
    kind: "track",
    id: f.model,
    track: {
      damageResults: [
        { id: "stunned" },
        { id: "wounded" },
        { id: "incapacitated" },
      ],
      damageTransitions: {
        wounded: { stunned: "wounded", wounded: "incapacitated" },
      },
    },
  }),
}));
vi.mock("./destiny-effects", () => ({
  offerDestinyEffect: (e: D6DestinyEffectV1) =>
    Promise.resolve({
      ...e,
      id: e.key,
      spendId: `spend:${e.key}`,
      after: e.before - 1,
    }),
}));
vi.mock("./health-runtime", () => ({
  readActorHealth: () => structuredClone(f.health),
  applyActorHealthDamageOutcome: async (...args: unknown[]) => {
    await Promise.resolve();
    f.apply(...args);
    if (f.fail) throw new Error("interrupted");
    return {
      previous: f.health,
      current: f.health,
      heroPointSpent: 0,
      prevented: false,
    };
  },
}));
import {
  preventDestinyIncomingHit,
  acknowledgeDestinyDamage,
} from "./destiny-damage";
function actor() {
  let flags: Record<string, unknown> = {};
  return {
    id: "hero",
    name: "Hero",
    isOwner: true,
    testUserPermission: () => true,
    getFlag: () => flags,
    update: async (changes: Record<string, unknown>) => {
      await Promise.resolve();
      flags = changes["flags.d6-system-2e.destinyDamage"] as Record<
        string,
        unknown
      >;
    },
  } as unknown as FoundryActorDocument;
}
describe("Destiny single-hit wound boundary", () => {
  beforeEach(() => {
    f.enabled = true;
    f.fail = false;
    f.model = "open-d6.health.wound-track";
    f.apply.mockClear();
    f.health = {
      modelId: f.model,
      track: { currentStateId: "wounded" },
    } as D6ActorHealthProjectionV1;
    vi.stubGlobal("game", {
      user: { id: "gm", isGM: true },
      users: { contents: [{ id: "player", isGM: false }] },
    });
    vi.stubGlobal("foundry", { utils: { randomID: () => "unused" } });
  });
  it("prevents only the new lowest wound without healing an existing wound", async () => {
    const a = actor();
    const result = await preventDestinyIncomingHit(a, "hit1", "stunned");
    expect(result.incoming).toBe("none");
    expect(result.command?.current.track?.currentStateId).toBe("wounded");
    expect(f.apply).not.toHaveBeenCalled();
    await preventDestinyIncomingHit(a, "hit1", "stunned");
    expect(f.apply).not.toHaveBeenCalled();
    await preventDestinyIncomingHit(a, "hit2", "incapacitated");
    expect(f.apply).toHaveBeenCalledTimes(1);
    expect(f.apply.mock.calls[0]?.[1]).toBe("wounded");
  });
  it("leaves an interrupted claimed hit pending and lets a GM acknowledge observed health without replay", async () => {
    const a = actor();
    f.fail = true;
    await expect(
      preventDestinyIncomingHit(a, "hit", "incapacitated"),
    ).rejects.toThrow("interrupted");
    await expect(
      preventDestinyIncomingHit(a, "hit", "incapacitated"),
    ).rejects.toThrow("PendingRecovery");
    expect(f.apply).toHaveBeenCalledTimes(1);
    await acknowledgeDestinyDamage(
      a,
      "hit:hit:hero",
      "Reviewed current Actor health against the hit",
    );
    f.fail = false;
    await preventDestinyIncomingHit(a, "hit", "incapacitated");
    expect(f.apply).toHaveBeenCalledTimes(1);
  });
  it("does not infer a severity ladder for a custom model or a missing hit identity", async () => {
    f.model = "custom";
    expect(await preventDestinyIncomingHit(actor(), "hit", "wounded")).toEqual({
      incoming: "wounded",
    });
    f.model = "open-d6.health.wound-track";
    expect(await preventDestinyIncomingHit(actor(), "", "wounded")).toEqual({
      incoming: "wounded",
    });
    expect(f.apply).not.toHaveBeenCalled();
  });
});
